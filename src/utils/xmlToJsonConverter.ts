// cloudCompatible.ts
export function makeCloudCompatible(jsonString: string): string {
  let result = jsonString;
  
  // Replace Desktop-specific paths with Cloud paths
  result = result.replace(/C:\\[^"']*/g, '');
  result = result.replace(/\\\\[^"']*/g, '');
  
  // Ensure TFS protocol for cloud storage
  result = result.replace(/"Protocol":\s*"file"/g, '"Protocol": "tfs"');
  
  // Remove any null or undefined values
  result = result.replace(/,?\s*"[^"]+":\s*null/g, '');
  result = result.replace(/,?\s*"[^"]+":\s*undefined/g, '');
  
  return result;
}

// iconFixer.ts
export function fixIconPaths(node: any): any {
  if (node.GuiSettings?.["@Plugin"]) {
    const plugin = node.GuiSettings["@Plugin"];
    
    // Ensure correct plugin paths
    const pluginMap: { [key: string]: string } = {
      "DbFileInput": "AlteryxBasePluginsGui.UniversalInput.UniversalInput",
      "DbFileOutput": "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput",
      "AlteryxSelect": "AlteryxBasePluginsGui.AlteryxSelect.AlteryxSelect"
    };
    
    for (const [key, value] of Object.entries(pluginMap)) {
      if (plugin.includes(key)) {
        node.GuiSettings["@Plugin"] = value;
        break;
      }
    }
  }
  
  return node;
}

export function cleanGuiSettings(node: any): any {
  if (node.GuiSettings) {
    // Remove desktop-specific settings
    delete node.GuiSettings.Mode;
    delete node.GuiSettings.Designer;
    
    // Ensure Position exists
    if (!node.GuiSettings.Position) {
      node.GuiSettings.Position = {
        "@x": "0",
        "@y": "0"
      };
    }
  }
  
  return node;
}

export function removeExternalResources(jsonString: string): string {
  let result = jsonString;
  
  // Clean up file paths only
  result = result.replace(/file:\/\/\/[^"']*/g, '');
  
  return result;
}

// File format normalization
interface FileFormatInfo {
  fileName: string;
  extension: string;
  isExcel: boolean;
  isCsv: boolean;
  normalizedName: string;
}

function normalizeInputFileFormat(config: any): FileFormatInfo {
  let fileName = "";
  
  // Extract filename from various config properties
  if (config.File?.["#text"]) {
    fileName = config.File["#text"];
  } else if (config.File) {
    fileName = String(config.File);
  } else if (config.ConnectionName) {
    fileName = config.ConnectionName;
  } else if (config.Path) {
    fileName = config.Path;
  } else if (config.FileName) {
    fileName = config.FileName;
  } else if (config.__originalFileName) {
    fileName = config.__originalFileName;
  }
  
  // Extract just the filename from full path
  if (fileName.includes('\\')) {
    fileName = fileName.split('\\').pop() || fileName;
  }
  if (fileName.includes('/')) {
    fileName = fileName.split('/').pop() || fileName;
  }
  
  // Clean Excel query parts (e.g., "file.xlsx|||Sheet1")
  if (fileName.includes('|||')) {
    fileName = fileName.split('|||')[0];
  }
  
  // Detect file extension
  const extensionMatch = fileName.match(/\.([^.]+)$/);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : '';
  
  // Check file formats
  const excelExtensions = ['xlsx', 'xls', 'xlsm', 'xlsb', 'xltx', 'xltm'];
  const isExcel = excelExtensions.includes(extension);
  const isCsv = extension === 'csv';
  
  // Keep original filename without conversion
  const normalizedName = fileName;
  
  return {
    fileName,
    extension,
    isExcel,
    isCsv,
    normalizedName
  };
}

function createFileConfiguration(fileInfo: FileFormatInfo): any {
  const baseConfig = {
    "__page": "LIST_CONNECTIONS",
    "DatasetId": "",
    "VendorName": "",
    "HasInferred": false,
    "ConnectionId": "",
    "__tableName": "",
    "__schemaName": "",
    "SampleFileUri": "",
    "ConnectionName": fileInfo.normalizedName,
    "__previousPage": "LIST_CONNECTIONS",
    "__needsDatasetSelection": true,
    "__originalFileName": fileInfo.fileName,
    "__normalizedFileName": fileInfo.normalizedName,
    "__wasExcelFile": fileInfo.isExcel
  };

  // Add format-specific settings based on file type
  if (fileInfo.isCsv) {
    return {
      ...baseConfig,
      "Format": "csv",
      "HasHeader": true,
      "Delimiter": ",",
      "QuoteChar": "\"",
      "EscapeChar": "\"",
      "Encoding": "UTF-8"
    };
  } else if (fileInfo.isExcel) {
    return {
      ...baseConfig,
      "Format": "excel",
      "HasHeader": true,
      "Encoding": "UTF-8"
    };
  } else {
    // Default configuration for other file types
    return {
      ...baseConfig,
      "Format": fileInfo.extension || "txt",
      "HasHeader": true,
      "Encoding": "UTF-8"
    };
  }
}

// Main XML to JSON converter
function xmlToJson(node: Element): any {
  let obj: any = {};

  // Convert attributes
  if (node.attributes.length > 0) {
    for (const attr of Array.from(node.attributes)) {
      let value = attr.value;
      // Clean desktop paths
      if (attr.name === 'source' && value.includes('C:\\')) {
        value = '';
      }
      obj[`@${attr.name}`] = value;
    }
  }

  const children = Array.from(node.children);
  const text = node.textContent?.trim();

  // Handle leaf nodes
  if (children.length === 0) {
    if (text && Object.keys(obj).length > 0) {
      obj["#text"] = text;
      return obj;
    }
    return text || obj || null;
  }

  // Group children by tag name
  const childGroups: { [key: string]: any[] } = {};
  for (const child of children) {
    const key = child.nodeName;
    if (!childGroups[key]) {
      childGroups[key] = [];
    }
    childGroups[key].push(xmlToJson(child));
  }

  // Convert groups to proper structure
  for (const [key, values] of Object.entries(childGroups)) {
    obj[key] = values.length === 1 ? values[0] : values;
  }

  return obj;
}

function detectFileType(content: string): 'xml' | 'json' | 'unknown' {
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) return 'xml';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'unknown';
}

function convertXmlToJson(xmlString: string, workflowName?: string): string {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Invalid XML: Unable to parse the XML content");
    }

    const json = xmlToJson(xmlDoc.documentElement);
    const cloudJson = convertToCloudFormat(json, workflowName);

    let jsonString = JSON.stringify(cloudJson, null, 2);
    jsonString = makeCloudCompatible(jsonString);
    
    return jsonString;
  } catch (error) {
    console.error("Conversion error:", error);
    throw new Error(`Failed to convert XML to JSON: ${error}`);
  }
}

function convertToCloudFormat(data: any, workflowName?: string): any {
  const workflowContent: any = {};
  
  // Version
  workflowContent["@yxmdVer"] = data["@yxmdVer"] || "2025.1";
  
  // Initialize structure
  workflowContent.Nodes = { Node: [] };
  workflowContent.Connections = { Connection: [] };
  
  // Cloud-compatible Properties
  workflowContent.Properties = {
    Memory: { "@default": "True" },
    GlobalRecordLimit: { "@value": "0" },
    TempFiles: { "@default": "True" },
    Annotation: {
      "@on": "True",
      "@includeToolName": "False"
    },
    ConvErrorLimit: { "@value": "10" },
    ConvErrorLimit_Stop: { "@value": "False" },
    CancelOnError: { "@value": "False" },
    DisableBrowse: { "@value": "False" },
    EnablePerformanceProfiling: { "@value": "False" },
    RunWithE2: { "@value": "True" },
    WorkflowMode: { "@value": "standard" },
    DefaultTZ: { "@value": "Etc/UTC" },
    PredictiveToolsCodePage: { "@value": "1252" },
    DisableAllOutput: { "@value": "False" },
    ShowAllMacroMessages: { "@value": "False" },
    ShowConnectionStatusIsOn: { "@value": "True" },
    ShowConnectionStatusOnlyWhenRunning: { "@value": "True" },
    ZoomLevel: { "@value": "0" },
    LayoutType: "Horizontal",
    IsTemplate: { "@value": "False" },
    CloudDisableAutorename: { "@value": "True" },
    MetaInfo: {
      NameIsFileName: { "@value": "True" },
      Name: workflowName || data.Properties?.MetaInfo?.Name || "cloud_workflow",
      Description: {},
      RootToolName: {},
      ToolVersion: {},
      ToolInDb: { "@value": "False" },
      CategoryName: {},
      SearchTags: {},
      Author: {},
      Company: {},
      Copyright: {},
      DescriptionLink: {
        "@actual": "",
        "@displayed": ""
      },
      Example: {
        Description: {},
        File: {}
      },
      WorkflowId: {
        "@value": data.Properties?.MetaInfo?.WorkflowId?.["@value"] || generateUUID()
      },
      Telemetry: {
        PreviousWorkflowId: {
          "@value": data.Properties?.MetaInfo?.Telemetry?.PreviousWorkflowId?.["@value"] || ""
        },
        OriginWorkflowId: {
          "@value": data.Properties?.MetaInfo?.Telemetry?.OriginWorkflowId?.["@value"] || generateUUID()
        }
      },
      PlatformWorkflowId: {
        "@value": ""
      }
    },
    Events: {
      Enabled: { "@value": "True" }
    }
  };

  // Process Nodes
  let nodes = [];
  if (data.Nodes?.Node) {
    nodes = Array.isArray(data.Nodes.Node) ? data.Nodes.Node : [data.Nodes.Node];
  }
  
  console.log('Processing nodes:', nodes.length);
  
  // Process Connections first to build dependency graph
  let connections = [];
  if (data.Connections?.Connection) {
    connections = Array.isArray(data.Connections.Connection)
      ? data.Connections.Connection
      : [data.Connections.Connection];
  }
  
  // Build connection map: toolId -> upstream tools
  const upstreamMap = new Map<string, string[]>();
  connections.forEach((conn: any) => {
    const from = conn.Origin?.["@ToolID"];
    const to = conn.Destination?.["@ToolID"];
    if (from && to) {
      if (!upstreamMap.has(to)) {
        upstreamMap.set(to, []);
      }
      upstreamMap.get(to)!.push(from);
    }
  });
  
  // First pass: Convert all nodes
  const convertedNodesMap = new Map<string, any>();
  nodes.forEach((node: any) => {
    const converted = convertNodeToCloud(node, upstreamMap, convertedNodesMap);
    if (converted) {
      convertedNodesMap.set(node['@ToolID'], converted);
      
      // Also convert child nodes if they exist (for containers)
      if (converted.ChildNodes?.Node) {
        const childNodes = Array.isArray(converted.ChildNodes.Node) 
          ? converted.ChildNodes.Node 
          : [converted.ChildNodes.Node];
        converted.ChildNodes.Node = childNodes
          .map((child: any) => convertNodeToCloud(child, upstreamMap, convertedNodesMap))
          .filter((n: any) => n !== null);
      }
    }
  });
  
  // Second pass: Propagate metadata through the workflow
  propagateMetadata(convertedNodesMap, upstreamMap);
  
  workflowContent.Nodes.Node = Array.from(convertedNodesMap.values());

  // Process Connections with cycle detection
  console.log('Original connections:', connections.map((c: any) => `${c.Origin?.["@ToolID"]} -> ${c.Destination?.["@ToolID"]}`));
  
  // Remove cycles
  const validConnections = removeCycles(connections);
  
  console.log('Valid connections after cycle removal:', validConnections.map((c: any) => `${c.Origin?.["@ToolID"]} -> ${c.Destination?.["@ToolID"]}`));

  workflowContent.Connections.Connection = validConnections.map((c: any) => ({
    "@name": c["@name"] || "",
    Origin: {
      "@ToolID": c.Origin?.["@ToolID"] || "",
      "@Connection": c.Origin?.["@Connection"] || "Output"
    },
    Destination: {
      "@ToolID": c.Destination?.["@ToolID"] || "",
      "@Connection": c.Destination?.["@Connection"] || "Input"
    }
  }));

  const finalWorkflowName = workflowName || 
                            data.Properties?.MetaInfo?.Name || 
                            data["@name"] || 
                            "cloud_workflow";

  return {
    name: finalWorkflowName,
    content: workflowContent
  };
}

// 🔥 NEW: Metadata propagation function
function propagateMetadata(nodesMap: Map<string, any>, upstreamMap: Map<string, string[]>): void {
  console.log('🔄 Starting metadata propagation...');
  
  // Topological sort to process nodes in dependency order
  const visited = new Set<string>();
  const sorted: string[] = [];
  
  function visit(toolId: string) {
    if (visited.has(toolId)) return;
    visited.add(toolId);
    
    const upstream = upstreamMap.get(toolId) || [];
    upstream.forEach(upId => visit(upId));
    
    sorted.push(toolId);
  }
  
  Array.from(nodesMap.keys()).forEach(toolId => visit(toolId));
  
  console.log('Processing order:', sorted);
  
  // Process each node in topological order
  sorted.forEach(toolId => {
    const node = nodesMap.get(toolId);
    if (!node) return;
    
    const plugin = node.GuiSettings?.["@Plugin"] || "";
    const upstream = upstreamMap.get(toolId) || [];
    
    // Get upstream metadata
    const upstreamFields = getUpstreamFields(upstream, nodesMap);
    
    if (plugin.includes("AlteryxSelect")) {
      updateSelectMetadata(node, upstreamFields);
    } else if (plugin.includes("Union")) {
      updateUnionMetadata(node, upstream, nodesMap);
    } else if (plugin.includes("Join")) {
      updateJoinMetadata(node, upstream, nodesMap);
    } else if (plugin.includes("Summarize")) {
      updateSummarizeMetadata(node, upstreamFields);
    } else if (upstreamFields.length > 0) {
      // For other tools, inherit upstream metadata if not already set
      inheritUpstreamMetadata(node, upstreamFields);
    }
  });
}

// 🔥 FIXED: Get fields from upstream tools
function getUpstreamFields(upstreamIds: string[], nodesMap: Map<string, any>): any[] {
  const fields: any[] = [];
  
  upstreamIds.forEach(upId => {
    const upNode = nodesMap.get(upId);
    if (!upNode?.Properties?.MetaInfo) return;
    
    const metaInfo = upNode.Properties.MetaInfo;
    let recordInfo = null;
    
    // Handle different MetaInfo structures
    if (Array.isArray(metaInfo)) {
      // Multiple outputs (e.g., Filter tool)
      recordInfo = metaInfo.find((m: any) => m["@connection"] === "Output" || m["@connection"] === "True")?.RecordInfo;
    } else if (metaInfo.RecordInfo) {
      recordInfo = metaInfo.RecordInfo;
    }
    
    if (recordInfo?.Field) {
      const upFields = Array.isArray(recordInfo.Field) ? recordInfo.Field : [recordInfo.Field];
      fields.push(...upFields);
    }
  });
  
  return fields;
}

// 🔥 PRESERVE EXACT DESKTOP SELECTION - NO MODIFICATIONS
function updateSelectMetadata(node: any, upstreamFields: any[]): void {
  const config = node.Properties?.Configuration;
  if (!config) return;
  
  console.log(`🔧 Preserving EXACT Select tool ${node['@ToolID']} configuration from desktop`);
  
  // DON'T modify SelectFields - preserve exactly as saved from desktop
  if (!config.SelectFields) {
    config.SelectFields = { SelectField: [] };
    return;
  }
  
  let selectFields = Array.isArray(config.SelectFields.SelectField)
    ? config.SelectFields.SelectField
    : [config.SelectFields.SelectField];
  
  // PRESERVE EXACT SELECTION - no modifications
  console.log(`   🔒 Preserving ${selectFields.length} fields exactly as configured in desktop`);
  
  // Create MetaInfo based ONLY on fields marked as selected="True" in original XML
  const outputFields = selectFields
    .filter((sf: any) => sf["@selected"] === "True")
    .map((sf: any) => {
      const outputName = sf["@rename"] || sf["@field"];
      return {
        "@name": outputName,
        "@type": sf["@type"] || "V_String",
        "@size": sf["@size"] || "254",
        "@source": "Select"
      };
    });
  
  node.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": {
      "Field": outputFields
    }
  };
  
  console.log(`   ✅ Select tool preserved: ${selectFields.length} total fields, ${outputFields.length} selected (EXACT desktop match)`);
}

// 🔥 FIXED: Update Union tool metadata
function updateUnionMetadata(node: any, upstreamIds: string[], nodesMap: Map<string, any>): void {
  console.log(`🔗 Updating Union tool ${node['@ToolID']} with ${upstreamIds.length} inputs`);
  
  // Collect all unique fields from all upstream tools
  const fieldMap = new Map<string, any>();
  
  upstreamIds.forEach(upId => {
    const upNode = nodesMap.get(upId);
    if (!upNode?.Properties?.MetaInfo) return;
    
    const fields = getUpstreamFields([upId], nodesMap);
    fields.forEach((field: any) => {
      const fieldName = field["@name"];
      if (!fieldMap.has(fieldName)) {
        fieldMap.set(fieldName, {
          "@name": fieldName,
          "@type": field["@type"] || "V_String",
          "@size": field["@size"] || "254",
          "@source": "Union"
        });
      } else {
        // If field exists, take the widest type/size
        const existing = fieldMap.get(fieldName);
        const newSize = parseInt(field["@size"] || "254");
        const existingSize = parseInt(existing["@size"] || "254");
        
        if (newSize > existingSize) {
          existing["@size"] = String(newSize);
        }
        
        // Type precedence: V_WString > V_String > others
        if (field["@type"] === "V_WString" || 
            (existing["@type"] !== "V_WString" && field["@type"] === "V_String")) {
          existing["@type"] = field["@type"];
        }
      }
    });
  });
  
  const unionFields = Array.from(fieldMap.values());
  
  console.log(`   ✅ Union output: ${unionFields.length} merged fields`);
  
  // Update MetaInfo
  node.Properties = node.Properties || {};
  node.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": {
      "Field": unionFields
    }
  };
}

// 🔥 NEW: Update Join tool metadata
function updateJoinMetadata(node: any, upstreamIds: string[], nodesMap: Map<string, any>): void {
  console.log(`🔀 Updating Join tool ${node['@ToolID']}`);
  
  // Join outputs all fields from both inputs (with prefixes if needed)
  const allFields: any[] = [];
  const fieldNames = new Set<string>();
  
  upstreamIds.forEach((upId, index) => {
    const fields = getUpstreamFields([upId], nodesMap);
    fields.forEach((field: any) => {
      const fieldName = field["@name"];
      let finalName = fieldName;
      
      // Add prefix if field name conflicts
      if (fieldNames.has(fieldName)) {
        finalName = `${index === 0 ? 'Left' : 'Right'}_${fieldName}`;
      }
      
      fieldNames.add(finalName);
      allFields.push({
        "@name": finalName,
        "@type": field["@type"] || "V_String",
        "@size": field["@size"] || "254",
        "@source": `Join_Input${index + 1}`
      });
    });
  });
  
  console.log(`   ✅ Join output: ${allFields.length} fields`);
  
  // Update MetaInfo for all join outputs
  node.Properties = node.Properties || {};
  node.Properties.MetaInfo = [
    {
      "@connection": "Join",
      "RecordInfo": { "Field": allFields }
    },
    {
      "@connection": "Left",
      "RecordInfo": { "Field": getUpstreamFields([upstreamIds[0]], nodesMap) }
    },
    {
      "@connection": "Right",
      "RecordInfo": { "Field": upstreamIds[1] ? getUpstreamFields([upstreamIds[1]], nodesMap) : [] }
    }
  ];
}

// 🔥 NEW: Update Summarize tool metadata
function updateSummarizeMetadata(node: any, upstreamFields: any[]): void {
  const config = node.Properties?.Configuration;
  if (!config?.SummarizeFields?.SummarizeField) return;
  
  console.log(`📈 Updating Summarize tool ${node['@ToolID']}`);
  
  const summarizeFields = Array.isArray(config.SummarizeFields.SummarizeField)
    ? config.SummarizeFields.SummarizeField
    : [config.SummarizeFields.SummarizeField];
  
  // Build output fields based on summarize configuration
  const outputFields: any[] = [];
  
  summarizeFields.forEach((sf: any) => {
    const field = sf["@field"];
    const action = sf["@action"];
    
    if (action === "GroupBy") {
      // Group by fields pass through
      const upstreamField = upstreamFields.find((uf: any) => uf["@name"] === field);
      outputFields.push({
        "@name": field,
        "@type": upstreamField?.["@type"] || "V_String",
        "@size": upstreamField?.["@size"] || "254",
        "@source": "Summarize_GroupBy"
      });
    } else {
      // Aggregation fields - output name might be different
      const outputName = sf["@rename"] || field;
      const outputType = getAggregationOutputType(action, upstreamFields.find((uf: any) => uf["@name"] === field));
      outputFields.push({
        "@name": outputName,
        "@type": outputType.type,
        "@size": outputType.size,
        "@source": `Summarize_${action}`
      });
    }
  });
  
  node.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": {
      "Field": outputFields
    }
  };
  
  console.log(`   ✅ Summarize output: ${outputFields.length} fields`);
}

// Helper to determine output type for aggregation functions
function getAggregationOutputType(action: string, upstreamField: any): { type: string; size: string } {
  const fieldType = upstreamField?.["@type"] || "V_String";
  
  switch (action) {
    case "Sum":
    case "Avg":
      return { type: "Double", size: "8" };
    case "Count":
    case "CountDistinct":
    case "CountNonNull":
      return { type: "Int64", size: "8" };
    case "Min":
    case "Max":
    case "First":
    case "Last":
      return { type: fieldType, size: upstreamField?.["@size"] || "254" };
    case "Concat":
      return { type: "V_WString", size: "1073741823" };
    default:
      return { type: "V_String", size: "254" };
  }
}

// 🔥 NEW: Inherit upstream metadata for generic tools
function inheritUpstreamMetadata(node: any, upstreamFields: any[]): void {
  if (!node.Properties?.MetaInfo || !node.Properties.MetaInfo.RecordInfo?.Field?.length) {
    node.Properties = node.Properties || {};
    node.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": {
        "Field": upstreamFields.map((f: any) => ({ ...f }))
      }
    };
  }
}

function convertNodeToCloud(node: any, upstreamMap: Map<string, string[]>, nodesMap: Map<string, any>): any {
  const plugin = node.GuiSettings?.["@Plugin"] || "";
  console.log('Converting node:', node['@ToolID'], 'Plugin:', plugin);
  
  // Skip TextInput tools - not supported in Cloud
  if (plugin.includes("TextInput")) {
    console.warn(`TextInput tool (ID: ${node['@ToolID']}) not supported in Cloud. Skipping.`);
    return null;
  }
  
  // Deep clone to avoid mutations
  let cloudNode = JSON.parse(JSON.stringify(node));
  
  // Apply fixes
  cloudNode = fixIconPaths(cloudNode);
  cloudNode = cleanGuiSettings(cloudNode);
  
  // Check plugin AFTER fixIconPaths
  const updatedPlugin = cloudNode.GuiSettings?.["@Plugin"] || "";
  
  // Detect tool types
  const isInputTool = updatedPlugin.includes("UniversalInput") || updatedPlugin.includes("DbFileInput");
  const isOutputTool = updatedPlugin.includes("UniversalOutput") || updatedPlugin.includes("DbFileOutput");
  const isSelectTool = updatedPlugin.includes("AlteryxSelect");
  const isFilterTool = updatedPlugin.includes("Filter");
  const isFormulaTool = updatedPlugin.includes("Formula") && !updatedPlugin.includes("MultiRowFormula") && !updatedPlugin.includes("MultiFieldFormula");
  const isUnionTool = updatedPlugin.includes("Union");
  const isJoinTool = updatedPlugin.includes("Join") && !updatedPlugin.includes("FindReplace") && !updatedPlugin.includes("FuzzyMatch");
  const isSortTool = updatedPlugin.includes("Sort");
  const isSummarizeTool = updatedPlugin.includes("Summarize");
  const isContainerTool = updatedPlugin.includes("ToolContainer");
  
  // Auto-convert desktop tools to universal tools
  if (updatedPlugin === "AlteryxBasePluginsGui.DbFileInput.DbFileInput") {
    cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalInput.UniversalInput";
    cloudNode.EngineSettings = {
      "@EngineDll": "UniversalInputTool.dll",
      "@EngineDllEntryPoint": "UniversalInputTool"
    };
  }
  if (updatedPlugin === "AlteryxBasePluginsGui.DbFileOutput.DbFileOutput") {
    cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput";
    cloudNode.EngineSettings = {
      "@EngineDll": "UniversalOutputTool.dll",
      "@EngineDllEntryPoint": "UniversalOutputTool"
    };
  }
  
  // Route to specific converter based on tool type
  if (isInputTool) {
    convertInputTool(cloudNode, node);
  } else if (isOutputTool) {
    convertOutputTool(cloudNode, node);
  } else if (isSelectTool) {
    convertSelectTool(cloudNode, node);
  } else if (isFilterTool) {
    convertFilterTool(cloudNode, node);
  } else if (isFormulaTool) {
    convertFormulaTool(cloudNode, node);
  } else if (isUnionTool) {
    convertUnionTool(cloudNode, node);
  } else if (isJoinTool) {
    convertJoinTool(cloudNode, node);
  } else if (isSortTool) {
    convertSortTool(cloudNode, node);
  } else if (isSummarizeTool) {
    convertSummarizeTool(cloudNode, node);
  } else if (isContainerTool) {
    convertContainerTool(cloudNode, node);
  } else {
    // Generic tool conversion
    convertGenericTool(cloudNode, node);
  }
  
  // Ensure all nodes have proper annotation
  ensureAnnotation(cloudNode);
  
  return cloudNode;
}

function convertInputTool(cloudNode: any, originalNode: any): void {
  // Ensure it's using UniversalInput
  cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalInput.UniversalInput";
  
  cloudNode.EngineSettings = {
    "@EngineDll": "UniversalInputTool.dll",
    "@EngineDllEntryPoint": "UniversalInputTool"
  };
  
  const originalConfig = originalNode.Properties?.Configuration || {};
  
  // Get file format information
  const fileInfo = normalizeInputFileFormat(originalConfig);
  
  console.log(`📁 Processing input file: "${fileInfo.fileName}" (${fileInfo.extension || 'no extension'})`);
  
  // Create format-appropriate configuration
  cloudNode.Properties = cloudNode.Properties || {};
  cloudNode.Properties.Configuration = createFileConfiguration(fileInfo);
  
  // Preserve MetaInfo with proper field structure
  if (originalNode.Properties?.MetaInfo?.RecordInfo?.Field) {
    const fields = Array.isArray(originalNode.Properties.MetaInfo.RecordInfo.Field)
      ? originalNode.Properties.MetaInfo.RecordInfo.Field
      : [originalNode.Properties.MetaInfo.RecordInfo.Field];
    
    cloudNode.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": {
        "Field": fields.map((field: any) => ({
          "@name": field["@name"],
          "@type": field["@type"] || "V_WString",
          "@size": field["@size"] || "254",
          "@source": field["@source"] || "File: " + fileInfo.normalizedName
        }))
      }
    };
    
    console.log(`✅ Preserved ${fields.length} fields in MetaInfo for Input tool`);
  } else {
    // If no MetaInfo, create empty structure - Cloud will infer from dataset
    cloudNode.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": { "Field": [] }
    };
    console.log(`⚠️ No MetaInfo found - Cloud will infer schema from dataset`);
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertOutputTool(cloudNode: any, originalNode: any): void {
  // Ensure it's using UniversalOutput
  cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput";
  
  cloudNode.EngineSettings = {
    "@EngineDll": "UniversalOutputTool.dll",
    "@EngineDllEntryPoint": "UniversalOutputTool"
  };
  
  const originalConfig = originalNode.Properties?.Configuration || {};
  
  // Get output file format information
  const fileInfo = normalizeInputFileFormat(originalConfig);
  
  console.log(`📤 Processing output file: "${fileInfo.fileName}" (${fileInfo.extension || 'no extension'})`);
  
  cloudNode.Properties = cloudNode.Properties || {};
  const baseConfig = createFileConfiguration(fileInfo);
  
  // Add output-specific settings
  cloudNode.Properties.Configuration = {
    ...baseConfig,
    "FileName": fileInfo.normalizedName,
    "Action": "create",
    "DatasetOriginator": true
  };
  
  // Add format-specific output settings
  if (fileInfo.isCsv) {
    cloudNode.Properties.Configuration.Delim = ",";
    cloudNode.Properties.Configuration.HasQuotes = true;
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertSelectTool(cloudNode: any, originalNode: any): void {
  console.log(`✅ Converting Select tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxSelect"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  // Preserve original configuration structure
  const originalConfig = originalNode.Properties?.Configuration || {};
  cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalConfig));
  
  const config = cloudNode.Properties.Configuration;
  config.OrderChanged = config.OrderChanged || { "@value": "False" };
  config.CommaDecimal = config.CommaDecimal || { "@value": "False" };
  
  // Ensure SelectFields structure with ALL attributes preserved
  if (config.SelectFields?.SelectField) {
    let selectFields = Array.isArray(config.SelectFields.SelectField)
      ? config.SelectFields.SelectField
      : [config.SelectFields.SelectField];
    
    // Preserve ALL attributes from original XML
    selectFields = selectFields.map((sf: any) => {
      const field: any = {
        "@field": sf["@field"] || sf.field,
        "@selected": sf["@selected"] || sf.selected || "True"
      };
      
      // Preserve rename attribute if it exists
      if (sf["@rename"] || sf.rename) {
        field["@rename"] = sf["@rename"] || sf.rename;
      }
      
      // Preserve type and size
      if (sf["@type"] || sf.type) {
        field["@type"] = sf["@type"] || sf.type;
      }
      if (sf["@size"] || sf.size) {
        field["@size"] = sf["@size"] || sf.size;
      }
      
      return field;
    });
    
    config.SelectFields.SelectField = selectFields;
  } else {
    config.SelectFields = {
      SelectField: [{ "@field": "*Unknown", "@selected": "True" }]
    };
  }
  
  // Preserve original MetaInfo if exists
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  } else {
    cloudNode.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": { "Field": [] }
    };
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertFilterTool(cloudNode: any, originalNode: any): void {
  console.log(`🔍 Converting Filter tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxFilter"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  // PRESERVE EXACT DESKTOP FILTER CONFIGURATION
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    
    const config = cloudNode.Properties.Configuration;
    console.log(`   🔧 Filter expression: ${config.Expression}`);
    console.log(`   🔧 Filter mode: ${config.Mode}`);
  } else {
    cloudNode.Properties.Configuration = {
      Expression: "",
      Mode: "Simple"
    };
  }
  
  // Ensure MetaInfo for BOTH True and False outputs
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  } else {
    // Create MetaInfo for both outputs if missing
    cloudNode.Properties.MetaInfo = [
      {
        "@connection": "True",
        "RecordInfo": { "Field": [] }
      },
      {
        "@connection": "False", 
        "RecordInfo": { "Field": [] }
      }
    ];
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
  
  console.log(`   ✅ Filter tool configured with TRUE and FALSE outputs`);
}

function convertFormulaTool(cloudNode: any, originalNode: any): void {
  console.log(`🔢 Converting Formula tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxFormula"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  // Preserve original formula configuration
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    
    const config = cloudNode.Properties.Configuration;
    if (!config.FormulaFields) {
      config.FormulaFields = { FormulaField: [] };
    } else if (config.FormulaFields.FormulaField) {
      if (!Array.isArray(config.FormulaFields.FormulaField)) {
        config.FormulaFields.FormulaField = [config.FormulaFields.FormulaField];
      }
      
      // Fix type mismatches for each formula field
      config.FormulaFields.FormulaField.forEach((formulaField: any, index: number) => {
        let expression = formulaField["@expression"] || "";
        const currentType = formulaField["@type"] || "";
        const fieldName = formulaField["@field"] || "";
        
        console.log(`   Analyzing formula ${index + 1}: field="${fieldName}", type="${currentType}"`);
        
        const isBooleanExpression = detectBooleanExpression(expression);
        
        if (isBooleanExpression) {
          console.warn(`   ⚠️ Boolean expression detected`);
          
          const fixedExpression = wrapFieldsWithToNumber(expression);
          if (fixedExpression !== expression) {
            formulaField["@expression"] = fixedExpression;
            console.log(`   🔧 Fixed expression: "${expression}" → "${fixedExpression}"`);
            expression = fixedExpression;
          }
          
          if (currentType !== "Bool" && currentType !== "Boolean") {
            console.error(`   ❌ TYPE MISMATCH: type="${currentType}" but expression returns Boolean`);
            
            formulaField["@type"] = "Bool";
            formulaField["@size"] = "1";
            
            const needsNewFieldName = currentType && 
                                     currentType !== "Bool" && 
                                     currentType !== "Boolean" &&
                                     !fieldName.endsWith("_check") &&
                                     !fieldName.endsWith("_flag") &&
                                     !fieldName.endsWith("_bool");
            
            if (needsNewFieldName) {
              const newFieldName = `${fieldName}_check`;
              formulaField["@field"] = newFieldName;
              console.log(`   ✅ FIXED: field="${fieldName}" → "${newFieldName}", type="Bool"`);
            } else {
              console.log(`   ✅ FIXED: type="Bool" for field="${fieldName}"`);
            }
          }
        }
      });
    }
  } else {
    cloudNode.Properties.Configuration = {
      FormulaFields: {
        FormulaField: []
      }
    };
  }
  
  // Preserve MetaInfo
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  } else {
    cloudNode.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": { "Field": [] }
    };
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function detectBooleanExpression(expression: string): boolean {
  if (!expression) return false;
  
  const cleanExpr = expression
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
  
  const comparisonOperators = [
    '==', '!=', '<>', '<=', '>=', '<', '>',
    ' = ', ' != ', ' <> '
  ];
  
  for (const op of comparisonOperators) {
    if (cleanExpr.includes(op)) {
      return true;
    }
  }
  
  const logicalKeywords = [
    /\bAND\b/i, /\bOR\b/i, /\bNOT\b/i,
    /\band\b/, /\bor\b/, /\bnot\b/,
    '&&', '||'
  ];
  
  for (const keyword of logicalKeywords) {
    if (typeof keyword === 'string') {
      if (cleanExpr.includes(keyword)) return true;
    } else {
      if (keyword.test(cleanExpr)) return true;
    }
  }
  
  const booleanFunctions = [
    'IsNull(', 'IsEmpty(', 'Contains(', 'StartsWith(', 'EndsWith(',
    'IN(', 'REGEX_Match(', 'IsInteger(', 'IsNumeric('
  ];
  
  for (const func of booleanFunctions) {
    if (cleanExpr.includes(func)) {
      return true;
    }
  }
  
  if (/IF\s+.*\s+THEN\s+(true|false|TRUE|FALSE|True|False)/i.test(cleanExpr)) {
    return true;
  }
  
  return false;
}

function wrapFieldsWithToNumber(expression: string): string {
  let cleaned = expression
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  
  const fieldPattern = /\[([^\]]+)\]/g;
  const fields: string[] = [];
  let match;
  
  while ((match = fieldPattern.exec(cleaned)) !== null) {
    fields.push(match[0]);
  }
  
  fields.forEach(field => {
    if (!cleaned.includes(`ToNumber(${field})`)) {
      const escapedField = field.replace(/[\[\]]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escapedField, 'g'), `ToNumber(${field})`);
    }
  });
  
  return cleaned;
}

function convertUnionTool(cloudNode: any, originalNode: any): void {
  console.log(`🔗 Converting Union tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxUnion"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  // PRESERVE EXACT DESKTOP UNION CONFIGURATION
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    
    const config = cloudNode.Properties.Configuration;
    console.log(`   🔧 Preserved Union configuration:`);
    console.log(`     - Mode: ${config.Mode}`);
    console.log(`     - ErrorMode: ${config.ByName_ErrorMode}`);
    console.log(`     - OutputMode: ${config.ByName_OutputMode}`);
    
    // Ensure proper attribute format for SetOutputOrder
    if (config.SetOutputOrder && typeof config.SetOutputOrder === 'string') {
      config.SetOutputOrder = { "@value": config.SetOutputOrder };
    }
  } else {
    cloudNode.Properties.Configuration = {
      "ByName_ErrorMode": "Warning",
      "ByName_OutputMode": "All", 
      "Mode": "ByName",
      "SetOutputOrder": { "@value": "False" }
    };
  }
  
  // Preserve MetaInfo exactly as is
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
  
  console.log(`   ✅ Union tool configured for cloud compatibility`);
}

function convertJoinTool(cloudNode: any, originalNode: any): void {
  console.log(`🔀 Converting Join tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxJoin"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    
    const config = cloudNode.Properties.Configuration;
    if (config.JoinInfo && !Array.isArray(config.JoinInfo)) {
      config.JoinInfo = [config.JoinInfo];
    }
  } else {
    cloudNode.Properties.Configuration = {
      "@joinByRecordPos": "False",
      "JoinInfo": [],
      "SelectConfiguration": {
        "Configuration": {
          "@outputConnection": "Join",
          "OrderChanged": { "@value": "False" },
          "SelectFields": { "SelectField": [] }
        }
      }
    };
  }
  
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertSortTool(cloudNode: any, originalNode: any): void {
  console.log(`📊 Converting Sort tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxSort"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
  } else {
    cloudNode.Properties.Configuration = {
      SortInfo: {
        Field: []
      }
    };
  }
  
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  } else {
    cloudNode.Properties.MetaInfo = {
      "@connection": "Output",
      "RecordInfo": { "Field": [] }
    };
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertSummarizeTool(cloudNode: any, originalNode: any): void {
  console.log(`📈 Converting Summarize tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxSummarize"
  };
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  // PRESERVE EXACT DESKTOP SUMMARIZE CONFIGURATION
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    
    const config = cloudNode.Properties.Configuration;
    if (config.SummarizeFields?.SummarizeField) {
      // Ensure array format
      if (!Array.isArray(config.SummarizeFields.SummarizeField)) {
        config.SummarizeFields.SummarizeField = [config.SummarizeFields.SummarizeField];
      }
      
      console.log(`   🔧 Preserved ${config.SummarizeFields.SummarizeField.length} summarize fields from desktop`);
      config.SummarizeFields.SummarizeField.forEach((sf: any) => {
        console.log(`     - Field: ${sf['@field']}, Action: ${sf['@action']}, Rename: ${sf['@rename']}`);
      });
    }
  } else {
    cloudNode.Properties.Configuration = {
      SummarizeFields: {
        SummarizeField: []
      }
    };
  }
  
  // Preserve MetaInfo exactly as is
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertContainerTool(cloudNode: any, originalNode: any): void {
  console.log(`📦 Converting Container tool (ID: ${cloudNode['@ToolID']})`);
  
  cloudNode.Properties = cloudNode.Properties || {};
  
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
  } else {
    cloudNode.Properties.Configuration = {
      Caption: "Container",
      Style: {
        "@TextColor": "#314c4a",
        "@FillColor": "#ecf2f2",
        "@BorderColor": "#314c4a",
        "@Transparency": "25",
        "@Margin": "25"
      },
      Disabled: { "@value": "False" },
      Folded: { "@value": "False" }
    };
  }
  
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function convertGenericTool(cloudNode: any, originalNode: any): void {
  console.log(`⚙️ Converting Generic tool (ID: ${cloudNode['@ToolID']})`);
  
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties = cloudNode.Properties || {};
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
  }
  
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties = cloudNode.Properties || {};
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  }
  
  if (originalNode.EngineSettings) {
    cloudNode.EngineSettings = JSON.parse(JSON.stringify(originalNode.EngineSettings));
  }
  
  cloudNode.Properties = cloudNode.Properties || {};
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}

function ensureAnnotation(cloudNode: any): void {
  if (!cloudNode.Properties) cloudNode.Properties = {};
  if (!cloudNode.Properties.Annotation) {
    cloudNode.Properties.Annotation = {
      "@DisplayMode": "0",
      "Name": {},
      "DefaultAnnotationText": "",
      "Left": { "@value": "False" }
    };
  }
}

function removeCycles(connections: any[]): any[] {
  const validConnections: any[] = [];
  const edges = new Set<string>();
  
  // Track Filter tool outputs to ensure both TRUE and FALSE are connected
  const filterOutputs = new Map<string, Set<string>>();
  
  connections.forEach(conn => {
    const from = conn.Origin?.["@ToolID"];
    const to = conn.Destination?.["@ToolID"];
    const fromConnection = conn.Origin?.["@Connection"];
    
    if (from && to && from !== to) {
      const edge = `${from}->${to}`;
      const reverseEdge = `${to}->${from}`;
      
      // Track Filter outputs
      if (fromConnection === "True" || fromConnection === "False") {
        if (!filterOutputs.has(from)) {
          filterOutputs.set(from, new Set());
        }
        filterOutputs.get(from)!.add(fromConnection);
      }
      
      if (!edges.has(reverseEdge)) {
        edges.add(edge);
        validConnections.push(conn);
      } else {
        console.warn(`Removing potential cycle: ${from} → ${to}`);
      }
    }
  });
  
  // Warn about disconnected Filter outputs
  filterOutputs.forEach((outputs, toolId) => {
    if (outputs.size === 1) {
      const connected = Array.from(outputs)[0];
      const missing = connected === "True" ? "False" : "True";
      console.warn(`⚠️ Filter tool ${toolId}: ${missing} output is DISCONNECTED - this may cause workflow failure`);
    }
  });
  
  return validConnections;
}



function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export {
  convertXmlToJson,
  detectFileType,
  xmlToJson,
  normalizeInputFileFormat,
  createFileConfiguration
};