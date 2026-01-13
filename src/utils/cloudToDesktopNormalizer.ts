// ============================================================================
// ALTERYX DESKTOP TO CLOUD WORKFLOW CONVERTER
// Complete TypeScript solution with proper tool handling
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Node {
  toolId: string;
  toolName: string;
  plugin: string;
  position: { x: number; y: number };
  metadata: {
    configuration: Record<string, any>;
    engineSettings?: Record<string, any>;
    annotation?: Record<string, any>;
    metaInfo?: Record<string, any>;
  };
}

export interface Connection {
  origin: { toolId: string; connection: string };
  destination: { toolId: string; connection: string };
}

export interface AlteryxWorkflow {
  Nodes: Node[];
  Properties: Record<string, any>;
  Connections: Connection[];
}

export interface ConversionReport {
  totalNodes: number;
  skippedNodes: Array<{ toolId: string; toolName: string; reason: string }>;
  toolsNeedingAttention: Array<{
    toolId: string;
    toolName: string;
    issue: string;
    hint?: string;
  }>;
  warnings: string[];
  success: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PLUGIN_MAP: { [key: string]: string } = {
  "DbFileInput": "AlteryxBasePluginsGui.UniversalInput.UniversalInput",
  "DbFileOutput": "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput",
  "TextInput": "AlteryxBasePluginsGui.TextInput.TextInput",
  "AlteryxSelect": "AlteryxBasePluginsGui.AlteryxSelect.AlteryxSelect",
  "Join": "AlteryxBasePluginsGui.Join.Join"
};

const UNSUPPORTED_CLOUD_TOOLS = [
  "TextInput",
  "Directory",
  "DynamicInput",
  "DynamicOutput"
];

// ============================================================================
// MAIN PARSING FUNCTIONS
// ============================================================================

/**
 * Parse Alteryx Desktop XML workflow
 */
export function parseAlteryxWorkflow(xmlString: string): AlteryxWorkflow {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`XML parsing failed: ${parserError.textContent}`);
  }
  
  const workflow: AlteryxWorkflow = {
    Nodes: [],
    Properties: {},
    Connections: []
  };

  // Extract nodes
  const nodes = xmlDoc.querySelectorAll('Node');
  nodes.forEach(nodeElement => {
    const guiSettings = nodeElement.querySelector('GuiSettings');
    const properties = nodeElement.querySelector('Properties');
    const engineSettings = nodeElement.querySelector('EngineSettings');
    
    const plugin = guiSettings?.getAttribute('Plugin') || '';
    const toolName = plugin.split('.').pop() || 'Unknown';
    
    const node: Node = {
      toolId: nodeElement.getAttribute('ToolID') || '',
      toolName: toolName,
      plugin: plugin,
      position: {
        x: parseInt(guiSettings?.querySelector('Position')?.getAttribute('x') || '0'),
        y: parseInt(guiSettings?.querySelector('Position')?.getAttribute('y') || '0')
      },
      metadata: {
        configuration: {}
      }
    };

    // Extract configuration
    if (properties) {
      const configuration = properties.querySelector('Configuration');
      if (configuration) {
        node.metadata.configuration = parseXmlElement(configuration);
      }
      
      const annotation = properties.querySelector('Annotation');
      if (annotation) {
        node.metadata.annotation = parseXmlElement(annotation);
      }
      
      const metaInfo = properties.querySelector('MetaInfo');
      if (metaInfo) {
        node.metadata.metaInfo = parseXmlElement(metaInfo);
      }
    }

    // Extract engine settings
    if (engineSettings) {
      const settings: Record<string, any> = {};
      Array.from(engineSettings.attributes).forEach(attr => {
        settings[attr.name] = attr.value;
      });
      node.metadata.engineSettings = settings;
    }

    workflow.Nodes.push(node);
  });

  // Extract connections
  const connections = xmlDoc.querySelectorAll('Connection');
  connections.forEach(connElement => {
    const origin = connElement.querySelector('Origin');
    const destination = connElement.querySelector('Destination');
    
    if (origin && destination) {
      workflow.Connections.push({
        origin: {
          toolId: origin.getAttribute('ToolID') || '',
          connection: origin.getAttribute('Connection') || ''
        },
        destination: {
          toolId: destination.getAttribute('ToolID') || '',
          connection: destination.getAttribute('Connection') || ''
        }
      });
    }
  });

  // Extract workflow properties
  const workflowProps = xmlDoc.querySelector('Properties');
  if (workflowProps) {
    workflow.Properties = parseXmlElement(workflowProps);
  }

  return workflow;
}

/**
 * Parse XML element recursively
 */
function parseXmlElement(element: Element): any {
  const result: any = {};
  
  // Add attributes with @ prefix
  if (element.attributes.length > 0) {
    Array.from(element.attributes).forEach(attr => {
      result[`@${attr.name}`] = attr.value;
    });
  }
  
  // Group children by tag name
  const childGroups: { [key: string]: any[] } = {};
  Array.from(element.children).forEach(child => {
    const key = child.tagName;
    if (!childGroups[key]) {
      childGroups[key] = [];
    }
    childGroups[key].push(parseXmlElement(child));
  });
  
  // Convert groups to proper structure
  for (const [key, values] of Object.entries(childGroups)) {
    result[key] = values.length === 1 ? values[0] : values;
  }
  
  // Add text content if no children
  if (element.children.length === 0 && element.textContent?.trim()) {
    if (Object.keys(result).length === 0) {
      return element.textContent.trim();
    }
    result['#text'] = element.textContent.trim();
  }
  
  return Object.keys(result).length === 0 ? null : result;
}

// ============================================================================
// CLOUD CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert workflow to cloud-compatible format
 */
export function convertToCloud(workflow: AlteryxWorkflow, workflowName?: string): {
  cloudWorkflow: any;
  report: ConversionReport;
} {
  const report: ConversionReport = {
    totalNodes: workflow.Nodes.length,
    skippedNodes: [],
    toolsNeedingAttention: [],
    warnings: [],
    success: true
  };

  // Filter out unsupported tools
  const supportedNodes = workflow.Nodes.filter(node => {
    const isUnsupported = UNSUPPORTED_CLOUD_TOOLS.some(tool => 
      node.plugin.includes(tool) || node.toolName === tool
    );
    
    if (isUnsupported) {
      report.skippedNodes.push({
        toolId: node.toolId,
        toolName: node.toolName,
        reason: `${node.toolName} not supported in Alteryx Cloud`
      });
      return false;
    }
    return true;
  });

  // Convert nodes to cloud format
  const cloudNodes = supportedNodes.map(node => {
    return convertNodeToCloud(node, report);
  }).filter(n => n !== null);

  // Fix Select tool fields based on upstream metadata
  fixSelectToolFields(cloudNodes, workflow.Connections);

  // Remove cycles from connections
  const validConnections = removeCycles(workflow.Connections, report);

  // Build cloud workflow structure
  const finalWorkflowName = workflowName || 
                            workflow.Properties?.MetaInfo?.Name || 
                            'cloud_workflow';

  const cloudWorkflow = {
    name: finalWorkflowName,
    content: {
      '@yxmdVer': '2025.1',
      Nodes: { Node: cloudNodes },
      Connections: {
        Connection: validConnections.map(conn => ({
          '@name': '',
          Origin: {
            '@ToolID': conn.origin.toolId,
            '@Connection': conn.origin.connection || 'Output'
          },
          Destination: {
            '@ToolID': conn.destination.toolId,
            '@Connection': conn.destination.connection || 'Input'
          }
        }))
      },
      Properties: buildCloudProperties(workflow.Properties, finalWorkflowName)
    }
  };

  return { cloudWorkflow, report };
}

/**
 * Convert individual node to cloud format
 */
function convertNodeToCloud(node: Node, report: ConversionReport): any | null {
  const plugin = normalizePlugin(node.plugin);
  const toolName = node.toolName;

  const cloudNode: any = {
    '@ToolID': node.toolId,
    GuiSettings: {
      '@Plugin': plugin,
      Position: {
        '@x': node.position.x.toString(),
        '@y': node.position.y.toString()
      }
    },
    Properties: {
      Configuration: {},
      Annotation: node.metadata.annotation || getDefaultAnnotation(),
      Dependencies: { Implicit: {} }
    }
  };

  // Add engine settings if present
  if (node.metadata.engineSettings) {
    cloudNode.EngineSettings = node.metadata.engineSettings;
  }

  // Convert based on tool type
  if (plugin.includes('UniversalInput') || plugin.includes('DbFileInput')) {
    convertInputTool(cloudNode, node, report);
  } else if (plugin.includes('UniversalOutput') || plugin.includes('DbFileOutput')) {
    convertOutputTool(cloudNode, node, report);
  } else if (plugin.includes('AlteryxSelect')) {
    convertSelectTool(cloudNode, node, report);
  } else if (plugin.includes('Join')) {
    convertJoinTool(cloudNode, node, report);
  } else {
    convertGenericTool(cloudNode, node, report);
  }

  return cloudNode;
}

// ============================================================================
// TOOL-SPECIFIC CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert Input tool to cloud format
 */
function convertInputTool(cloudNode: any, node: Node, report: ConversionReport): void {
  cloudNode.GuiSettings['@Plugin'] = 'AlteryxBasePluginsGui.UniversalInput.UniversalInput';
  cloudNode.EngineSettings = {
    '@EngineDll': 'UniversalInputTool.dll',
    '@EngineDllEntryPoint': 'UniversalInputTool'
  };

  const originalConfig = node.metadata.configuration;
  const fileName = extractFileName(originalConfig);

  // Cloud-compatible configuration
  cloudNode.Properties.Configuration = {
    '__page': 'LIST_CONNECTIONS',
    'DatasetId': '',
    'VendorName': '',
    'HasInferred': false,
    'ConnectionId': '',
    '__tableName': '',
    '__schemaName': '',
    'SampleFileUri': '',
    'ConnectionName': fileName,
    '__previousPage': 'LIST_CONNECTIONS'
  };

  // Preserve format settings if present
  if (originalConfig.Format) {
    cloudNode.Properties.Configuration.Format = originalConfig.Format;
  }
  if (originalConfig.Delim) {
    cloudNode.Properties.Configuration.Delim = originalConfig.Delim;
  }
  if (originalConfig.HasFieldNames !== undefined) {
    cloudNode.Properties.Configuration.HasFieldNames = originalConfig.HasFieldNames;
  }
  if (originalConfig.HasQuotes !== undefined) {
    cloudNode.Properties.Configuration.HasQuotes = originalConfig.HasQuotes;
  }

  // Preserve MetaInfo with field structure
  if (node.metadata.metaInfo?.RecordInfo?.Field) {
    const fields = Array.isArray(node.metadata.metaInfo.RecordInfo.Field)
      ? node.metadata.metaInfo.RecordInfo.Field
      : [node.metadata.metaInfo.RecordInfo.Field];

    cloudNode.Properties.MetaInfo = {
      '@connection': 'Output',
      RecordInfo: {
        Field: fields.map((field: any) => ({
          '@name': field['@name'],
          '@type': field['@type'] || 'V_WString',
          '@size': field['@size'] || '254',
          '@trifactaType': 'String'
        }))
      }
    };
  }

  // Add to report
  report.toolsNeedingAttention.push({
    toolId: node.toolId,
    toolName: 'Input',
    issue: 'Requires dataset selection in cloud',
    hint: `Select dataset matching: ${fileName}`
  });
}

/**
 * Convert Output tool to cloud format
 */
function convertOutputTool(cloudNode: any, node: Node, report: ConversionReport): void {
  cloudNode.GuiSettings['@Plugin'] = 'AlteryxBasePluginsGui.UniversalOutput.UniversalOutput';
  cloudNode.EngineSettings = {
    '@EngineDll': 'UniversalOutputTool.dll',
    '@EngineDllEntryPoint': 'UniversalOutputTool'
  };

  const originalConfig = node.metadata.configuration;
  const fileName = extractFileName(originalConfig, 'output');

  // Cloud-compatible configuration
  cloudNode.Properties.Configuration = {
    '__page': 'LIST_CONNECTIONS',
    'DatasetId': '',
    'VendorName': '',
    'HasInferred': false,
    'ConnectionId': '',
    '__tableName': '',
    '__schemaName': '',
    'SampleFileUri': '',
    'ConnectionName': fileName,
    '__previousPage': 'LIST_CONNECTIONS',
    'FileName': fileName,
    'DatasetOriginator': true
  };

  // Preserve output format settings
  const formatSettings = {
    'Format': originalConfig.Format || 'csv',
    'Action': originalConfig.Action || 'create',
    'Header': originalConfig.Header !== undefined ? originalConfig.Header : true,
    'Delim': originalConfig.Delim || ',',
    'HasQuotes': originalConfig.HasQuotes !== undefined ? originalConfig.HasQuotes : true,
    'LineEndStyle': originalConfig.LineEndStyle || 'CRLF'
  };

  Object.assign(cloudNode.Properties.Configuration, formatSettings);

  // Preserve MetaInfo if present
  if (node.metadata.metaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(node.metadata.metaInfo));
  }

  report.toolsNeedingAttention.push({
    toolId: node.toolId,
    toolName: 'Output',
    issue: 'Will create new dataset in cloud',
    hint: `Output dataset name: ${fileName}`
  });
}

/**
 * Convert Select tool to cloud format
 */
function convertSelectTool(cloudNode: any, node: Node, report: ConversionReport): void {
  cloudNode.EngineSettings = {
    '@EngineDll': 'AlteryxBasePluginsEngine.dll',
    '@EngineDllEntryPoint': 'AlteryxSelect'
  };

  const originalConfig = node.metadata.configuration;

  // Preserve original configuration structure
  cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalConfig));

  // Ensure required fields
  const config = cloudNode.Properties.Configuration;
  config.OrderChanged = config.OrderChanged || { '@value': 'False' };
  config.CommaDecimal = config.CommaDecimal || { '@value': 'False' };

  // Handle SelectFields
  if (!config.SelectFields?.SelectField) {
    config.SelectFields = {
      SelectField: [{ '@field': '*Unknown', '@selected': 'True' }]
    };
  } else {
    // Ensure it's an array
    const fields = Array.isArray(config.SelectFields.SelectField)
      ? config.SelectFields.SelectField
      : [config.SelectFields.SelectField];
    config.SelectFields.SelectField = fields;
  }

  // Preserve MetaInfo
  if (node.metadata.metaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(node.metadata.metaInfo));
  } else {
    cloudNode.Properties.MetaInfo = {
      '@connection': 'Output',
      RecordInfo: { Field: [] }
    };
  }
}

/**
 * Convert Join tool to cloud format
 */
function convertJoinTool(cloudNode: any, node: Node, report: ConversionReport): void {
  cloudNode.EngineSettings = {
    '@EngineDll': 'AlteryxBasePluginsEngine.dll',
    '@EngineDllEntryPoint': 'AlteryxJoin'
  };

  const originalConfig = node.metadata.configuration;

  // Preserve join configuration
  cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalConfig));

  const config = cloudNode.Properties.Configuration;

  // Ensure JoinByRecordPos exists
  if (!config.JoinByRecordPos) {
    config.JoinByRecordPos = { '@value': 'False' };
  }

  // Ensure JoinInfo exists
  if (!config.JoinInfo) {
    config.JoinInfo = {
      '@connection': 'Left',
      Field: []
    };
  }

  // Ensure SelectConfiguration exists
  if (!config.SelectConfiguration) {
    config.SelectConfiguration = {
      Configuration: {
        '@type': 'Auto',
        '@name': ''
      }
    };
  }

  // Preserve MetaInfo for all outputs
  if (node.metadata.metaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(node.metadata.metaInfo));
  } else {
    // Create default MetaInfo for Join (3 outputs: J, L, R)
    cloudNode.Properties.MetaInfo = [
      { '@connection': 'Join', RecordInfo: { Field: [] } },
      { '@connection': 'Left', RecordInfo: { Field: [] } },
      { '@connection': 'Right', RecordInfo: { Field: [] } }
    ];
  }
}

/**
 * Convert generic tool to cloud format
 */
function convertGenericTool(cloudNode: any, node: Node, report: ConversionReport): void {
  // Preserve original configuration
  if (node.metadata.configuration) {
    cloudNode.Properties.Configuration = JSON.parse(
      JSON.stringify(node.metadata.configuration)
    );
  }

  // Preserve MetaInfo
  if (node.metadata.metaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(
      JSON.stringify(node.metadata.metaInfo)
    );
  }

  // Ensure engine settings for common tools
  if (!cloudNode.EngineSettings) {
    cloudNode.EngineSettings = {
      '@EngineDll': 'AlteryxBasePluginsEngine.dll',
      '@EngineDllEntryPoint': node.toolName
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize plugin name to cloud-compatible format
 */
function normalizePlugin(plugin: string): string {
  for (const [key, value] of Object.entries(PLUGIN_MAP)) {
    if (plugin.includes(key)) {
      return value;
    }
  }
  return plugin;
}

/**
 * Extract clean filename from configuration
 */
function extractFileName(config: any, defaultName: string = 'input'): string {
  let fileName = '';

  // Try various config properties
  if (config.File?.['#text']) {
    fileName = config.File['#text'];
  } else if (config.File) {
    fileName = String(config.File);
  } else if (config.ConnectionName) {
    fileName = config.ConnectionName;
  } else if (config.FileName) {
    fileName = config.FileName;
  } else if (config.Path) {
    fileName = config.Path;
  }

  // Extract just the filename from path
  if (fileName.includes('\\')) {
    fileName = fileName.split('\\').pop() || fileName;
  }
  if (fileName.includes('/')) {
    fileName = fileName.split('/').pop() || fileName;
  }

  // Clean filename
  fileName = fileName.replace(/\.[^.]*$/, ''); // Remove extension
  fileName = fileName.replace(/\|\|\|.*$/, ''); // Remove Excel query
  fileName = fileName.replace(/[`'"]/g, ''); // Remove quotes

  return fileName || defaultName;
}

/**
 * Fix Select tool fields based on upstream metadata
 */
function fixSelectToolFields(cloudNodes: any[], connections: Connection[]): void {
  cloudNodes.forEach((node, index) => {
    const plugin = node.GuiSettings?.['@Plugin'] || '';
    if (!plugin.includes('AlteryxSelect')) return;

    const config = node.Properties?.Configuration;
    if (!config?.SelectFields?.SelectField) return;

    const fields = Array.isArray(config.SelectFields.SelectField)
      ? config.SelectFields.SelectField
      : [config.SelectFields.SelectField];

    const hasUnknown = fields.some(
      (f: any) => f['@field'] === '*Unknown' || f['@field'] === '*'
    );

    if (hasUnknown) {
      // Find upstream node
      const nodeId = node['@ToolID'];
      const upstreamConn = connections.find(c => c.destination.toolId === nodeId);
      
      if (upstreamConn) {
        const upstreamNode = cloudNodes.find(
          n => n['@ToolID'] === upstreamConn.origin.toolId
        );

        if (upstreamNode) {
          const upstreamFields = extractFieldsFromNode(upstreamNode);
          
          if (upstreamFields.length > 0) {
            config.SelectFields.SelectField = upstreamFields.map((f: any) => ({
              '@field': f['@name'],
              '@selected': 'True'
            }));

            // Update MetaInfo
            if (node.Properties.MetaInfo) {
              node.Properties.MetaInfo.RecordInfo = {
                Field: upstreamFields
              };
            }
          }
        }
      }
    }
  });
}

/**
 * Extract field metadata from a node
 */
function extractFieldsFromNode(node: any): any[] {
  const metaInfo = node.Properties?.MetaInfo;
  if (!metaInfo) return [];

  // Handle single MetaInfo
  if (metaInfo.RecordInfo?.Field) {
    return Array.isArray(metaInfo.RecordInfo.Field)
      ? metaInfo.RecordInfo.Field
      : [metaInfo.RecordInfo.Field];
  }

  // Handle multiple MetaInfo (for tools with multiple outputs)
  if (Array.isArray(metaInfo)) {
    const outputMeta = metaInfo.find((m: any) => 
      m['@connection'] === 'Output' || !m['@connection']
    );
    if (outputMeta?.RecordInfo?.Field) {
      return Array.isArray(outputMeta.RecordInfo.Field)
        ? outputMeta.RecordInfo.Field
        : [outputMeta.RecordInfo.Field];
    }
  }

  return [];
}

/**
 * Remove cycles from connections
 */
function removeCycles(connections: Connection[], report: ConversionReport): Connection[] {
  const validConnections: Connection[] = [];
  const edges = new Set<string>();

  connections.forEach(conn => {
    const from = conn.origin.toolId;
    const to = conn.destination.toolId;

    if (from && to && from !== to) {
      const edge = `${from}->${to}`;
      const reverseEdge = `${to}->${from}`;

      if (!edges.has(reverseEdge)) {
        edges.add(edge);
        validConnections.push(conn);
      } else {
        report.warnings.push(`Removed cycle: ${from} → ${to}`);
      }
    }
  });

  return validConnections;
}

/**
 * Build cloud-compatible workflow properties
 */
function buildCloudProperties(originalProps: any, workflowName: string): any {
  return {
    Memory: { '@default': 'True' },
    GlobalRecordLimit: { '@value': '0' },
    TempFiles: { '@default': 'True' },
    Annotation: {
      '@on': 'True',
      '@includeToolName': 'False'
    },
    ConvErrorLimit: { '@value': '10' },
    ConvErrorLimit_Stop: { '@value': 'False' },
    CancelOnError: { '@value': 'False' },
    DisableBrowse: { '@value': 'False' },
    EnablePerformanceProfiling: { '@value': 'False' },
    RunWithE2: { '@value': 'True' },
    WorkflowMode: { '@value': 'standard' },
    DefaultTZ: { '@value': 'Etc/UTC' },
    PredictiveToolsCodePage: { '@value': '1252' },
    DisableAllOutput: { '@value': 'False' },
    ShowAllMacroMessages: { '@value': 'False' },
    ShowConnectionStatusIsOn: { '@value': 'True' },
    ShowConnectionStatusOnlyWhenRunning: { '@value': 'True' },
    ZoomLevel: { '@value': '0' },
    LayoutType: 'Horizontal',
    IsTemplate: { '@value': 'False' },
    CloudDisableAutorename: { '@value': 'True' },
    MetaInfo: {
      NameIsFileName: { '@value': 'True' },
      Name: workflowName,
      Description: {},
      RootToolName: {},
      ToolVersion: {},
      ToolInDb: { '@value': 'False' },
      CategoryName: {},
      SearchTags: {},
      Author: {},
      Company: {},
      Copyright: {},
      DescriptionLink: {
        '@actual': '',
        '@displayed': ''
      },
      Example: {
        Description: {},
        File: {}
      },
      WorkflowId: {
        '@value': originalProps?.MetaInfo?.WorkflowId?.['@value'] || generateUUID()
      },
      Telemetry: {
        PreviousWorkflowId: {
          '@value': originalProps?.MetaInfo?.Telemetry?.PreviousWorkflowId?.['@value'] || ''
        },
        OriginWorkflowId: {
          '@value': originalProps?.MetaInfo?.Telemetry?.OriginWorkflowId?.['@value'] || generateUUID()
        }
      },
      PlatformWorkflowId: { '@value': '' }
    },
    Events: {
      Enabled: { '@value': 'True' }
    }
  };
}

/**
 * Get default annotation
 */
function getDefaultAnnotation(): any {
  return {
    '@DisplayMode': '0',
    Name: {},
    DefaultAnnotationText: '',
    Left: { '@value': 'False' }
  };
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// MAIN CONVERSION FUNCTION
// ============================================================================

/**
 * Main function: Convert Alteryx Desktop workflow to Cloud format
 */
export function convertWorkflowToCloud(
  xmlString: string,
  workflowName?: string
): {
  json: string;
  report: ConversionReport;
} {
  try {
    // Parse desktop workflow
    const workflow = parseAlteryxWorkflow(xmlString);

    // Convert to cloud format
    const { cloudWorkflow, report } = convertToCloud(workflow, workflowName);

    // Convert to JSON string
    const json = JSON.stringify(cloudWorkflow, null, 2);

    return { json, report };
  } catch (error) {
    throw new Error(`Conversion failed: ${error}`);
  }
}

/**
 * Pretty print conversion report
 */
export function printConversionReport(report: ConversionReport): void {
  console.log('\n' + '='.repeat(70));
  console.log('ALTERYX CLOUD CONVERSION REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n✅ Conversion ${report.success ? 'Successful' : 'Failed'}`);
  console.log(`📊 Total nodes processed: ${report.totalNodes}`);

  if (report.skippedNodes.length > 0) {
    console.log('\n⚠️  Skipped Tools (Not Supported in Cloud):');
    report.skippedNodes.forEach(node => {
      console.log(`   ❌ ${node.toolName} (ID: ${node.toolId})`);
      console.log(`      Reason: ${node.reason}`);
    });
  }

  if (report.toolsNeedingAttention.length > 0) {
    console.log('\n🔧 Manual Configuration Required:');
    report.toolsNeedingAttention.forEach(tool => {
      console.log(`   📌 ${tool.toolName} (ID: ${tool.toolId})`);
      console.log(`      ${tool.issue}`);
      if (tool.hint) {
        console.log(`      💡 ${tool.hint}`);
      }
    });
  }

  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    report.warnings.forEach(warning => {
      console.log(`   ⚠️  ${warning}`);
    });
  }

  if (report.skippedNodes.length === 0 && 
      report.toolsNeedingAttention.length === 0 &&
      report.warnings.length === 0) {
    console.log('\n✨ No issues found! Workflow is ready for cloud.');
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

export function example() {
  const sampleXml = `<?xml version="1.0"?>
<AlteryxDocument yxmdVer="2025.1">
  <Nodes>
    <Node ToolID="1">
      <GuiSettings Plugin="AlteryxBasePluginsGui.DbFileInput.DbFileInput">
        <Position x="54" y="66" />
      </GuiSettings>
      <Properties>
        <Configuration>
          <File>C:\\Data\\sales_data.csv</File>
          <Format>csv</Format>
        </Configuration>
        <Annotation DisplayMode="0">
          <Name />
          <DefaultAnnotationText>sales_data.csv</DefaultAnnotationText>
        </Annotation>
        <MetaInfo connection="Output">
          <RecordInfo>
            <Field name="OrderID" type="Int32" />
            <Field name="ProductName" size="100" type="V_String" />
            <Field name="Amount" type="Double" />
          </RecordInfo>
        </MetaInfo>
      </Properties>
    </Node>
    <Node ToolID="2">
      <GuiSettings Plugin="AlteryxBasePluginsGui.AlteryxSelect.AlteryxSelect">
        <Position x="154" y="66" />
      </GuiSettings>
      <Properties>
        <Configuration>
          <OrderChanged value="False" />
          <SelectFields>
            <SelectField field="*Unknown" selected="True" />
          </SelectFields>
        </Configuration>
      </Properties>
    </Node>
  </Nodes>
  <Connections>
    <Connection>
      <Origin ToolID="1" Connection="Output" />
      <Destination ToolID="2" Connection="Input" />
    </Connection>
  </Connections>
  <Properties>
    <MetaInfo>
      <Name>Sample Workflow</Name>
    </MetaInfo>
  </Properties>
</AlteryxDocument>`;

  const { json, report } = convertWorkflowToCloud(sampleXml);
  printConversionReport(report);
  console.log('Cloud JSON:', json);
}