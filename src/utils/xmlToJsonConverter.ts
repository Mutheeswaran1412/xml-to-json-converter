// cloudCompatible.ts
export function makeCloudCompatible(jsonString: string): string {
  try {
    let result = jsonString;
   
    // ✅ KEEP ONLY protocol fix
    result = result.replace(/"Protocol":\s*"file"/g, '"Protocol": "tfs"');
   
    // 🔥 PRODUCTION-SAFE: Remove only known optional fields that can be null
    result = result.replace(/"SampleFileUri":\s*null,?/g, '');
    result = result.replace(/"ConnectionId":\s*null,?/g, '');
    result = result.replace(/"VendorName":\s*null,?/g, '');
   
    return result;
  } catch (error) {
    console.error('Error in makeCloudCompatible:', error);
    return jsonString;
  }
}


// iconFixer.ts
interface WorkflowNode {
  GuiSettings?: {
    "@Plugin"?: string;
    [key: string]: any;
  };
  [key: string]: any;
}


export function fixIconPaths(node: WorkflowNode): WorkflowNode {
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


function createFileConfiguration(fileInfo: FileFormatInfo, datasetInfo?: {datasetId: string, path: string, name: string}): any {
  const baseConfig = {
    "__page": "LIST_CONNECTIONS",
    "__previousPage": "LIST_CONNECTIONS",
    "DatasetId": datasetInfo?.datasetId || "",
    "VendorName": "",
    "HasInferred": false,
    "ConnectionId": "",
    "__tableName": "",
    "__schemaName": "",
    "SampleFileUri": datasetInfo?.path || "",
    "ConnectionName": datasetInfo?.name || fileInfo.normalizedName,
    "__needsDatasetSelection": !datasetInfo,
    "__originalFileName": fileInfo.fileName,
    "__normalizedFileName": fileInfo.normalizedName,
    "__wasExcelFile": fileInfo.isExcel,
    "__sampleInfo": {
      "createdAt": new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
    }
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
    return {
      ...baseConfig,
      "Format": fileInfo.extension || "txt",
      "HasHeader": true,
      "Encoding": "UTF-8"
    };
  }
}


// Main XML to JSON converter with proper attribute handling
function xmlToJson(node: Element): any {
  let obj: any = {};

  // Convert attributes with proper format detection
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
   
    const childValue = xmlToJson(child);
   
    // Fix: Handle value attribute at parent level
    const valueAttr = child.getAttribute('value');
    if (valueAttr !== null && typeof childValue === 'object' && !Array.isArray(childValue)) {
      childGroups[key].push({ "@value": valueAttr });
    } else {
      childGroups[key].push(childValue);
    }
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


// Helper function to detect field type based on name patterns
function detectFieldType(fieldName: string): string {
  const name = fieldName.toLowerCase();
  
  // Numeric patterns
  if (name.includes('score') || name.includes('amount') || name.includes('salary') || 
      name.includes('price') || name.includes('total') || name.includes('sum') ||
      name.includes('count') || name.includes('number') || name.includes('qty') ||
      name.includes('quantity') || name.includes('rate') || name.includes('percent')) {
    return "Double";
  }
  
  // ID patterns
  if (name === 'id' || 
      name.endsWith('_id') || 
      name.endsWith('id') ||
      name === 'empid' || name === 'userid' || name === 'customerid') {
    return "Int32";
  }
  
  // Default to string
  return "V_String";
}

// Helper function to fix boolean attributes
function fixBooleanAttributes(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
 
  const booleanProps = [
    'SetOutputOrder', 'joinByRecordPos',
    'HasHeader', 'HasInferred', 'DatasetOriginator', 'Disabled', 'Folded',
    'IgnoreErrors', 'AllowShareWrite', 'SingleThreadRead', 'QuoteRecordBreak',
    'ForceQuotes', 'WriteBOM', 'SuppressBlankFile'
  ];
 
  for (const prop of booleanProps) {
    if (obj[prop] !== undefined) {
      // Skip if already in correct format
      if (typeof obj[prop] === 'object' && obj[prop] !== null && '@value' in obj[prop]) {
        continue;
      }
     
      // Only fix strings and booleans
      if (typeof obj[prop] === 'string' || typeof obj[prop] === 'boolean') {
        obj[prop] = { "@value": String(obj[prop]) };
      }
    }
  }
 
  // Recursively fix nested objects
  for (const key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object') {
      obj[key] = fixBooleanAttributes(obj[key]);
    }
  }
 
  return obj;
}


function convertXmlToJson(xmlString: string, workflowName?: string, datasets?: Array<{id: string, name: string, datasetId: string, path: string}>): string {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Invalid XML: Unable to parse the XML content");
    }

    const json = xmlToJson(xmlDoc.documentElement);
    const cloudJson = convertToCloudFormat(json, workflowName, datasets);

    let jsonString = JSON.stringify(cloudJson, null, 2);
    jsonString = makeCloudCompatible(jsonString);
   
    return jsonString;
  } catch (error) {
    console.error("Conversion error:", error);
    throw new Error(`Failed to convert XML to JSON: ${error}`);
  }
}


function convertToCloudFormat(data: any, workflowName?: string, datasets?: Array<{id: string, name: string, datasetId: string, path: string}>): any {
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
 
  // 🔥 TWO-PASS CONVERSION TO FIX SUMMARIZE TIMING ISSUE
  console.log('🔄 Starting TWO-PASS node conversion...');
  
  // PASS 1: Convert all nodes WITHOUT Summarize validation
  console.log('📋 PASS 1: Converting all nodes (Summarize validation disabled)');
  const convertedNodesMap = new Map<string, any>();
  const originalNodesMap = new Map<string, any>();
  
  nodes.forEach((node: any) => {
    // Store original node for second pass
    originalNodesMap.set(node['@ToolID'], node);
    
    const converted = convertNodeToCloud(node, upstreamMap, convertedNodesMap, datasets, false); // false = skip Summarize validation
    if (converted) {
      fixBooleanAttributes(converted);
      convertedNodesMap.set(node['@ToolID'], converted);
     
      // Also convert child nodes if they exist (for containers)
      if (converted.ChildNodes?.Node) {
        const childNodes = Array.isArray(converted.ChildNodes.Node)
          ? converted.ChildNodes.Node
          : [converted.ChildNodes.Node];
        converted.ChildNodes.Node = childNodes
          .map((child: any) => {
            const convertedChild = convertNodeToCloud(child, upstreamMap, convertedNodesMap, datasets, false);
            if (convertedChild) {
              fixBooleanAttributes(convertedChild);
            }
            return convertedChild;
          })
          .filter((n: any) => n !== null);
      }
    }
  });
  
  console.log(`✅ PASS 1 complete: ${convertedNodesMap.size} nodes converted`);
  
  // PASS 2: Fix Summarize tools now that all MetaInfo exists
  console.log('🔧 PASS 2: Fixing Summarize tools with complete MetaInfo');
  let summarizeToolsFixed = 0;
  
  convertedNodesMap.forEach((convertedNode, toolId) => {
    const plugin = convertedNode.GuiSettings?.["@Plugin"] || "";
    if (plugin.includes("Summarize")) {
      console.log(`🔧 Fixing Summarize tool ${toolId} in second pass...`);
      const originalNode = originalNodesMap.get(toolId);
      if (originalNode) {
        // Re-run Summarize conversion with validation enabled
        convertSummarizeTool(convertedNode, originalNode, upstreamMap, convertedNodesMap);
        summarizeToolsFixed++;
      }
    }
  });
  
  console.log(`✅ PASS 2 complete: ${summarizeToolsFixed} Summarize tools fixed`);
  console.log('🎯 TWO-PASS conversion finished - all MetaInfo available for validation');
 
  // Process Connections with cycle detection
  console.log('Original connections:', connections.map((c: any) => `${c.Origin?.["@ToolID"]} -> ${c.Destination?.["@ToolID"]}`));
 
  // Remove cycles
  const validConnections = removeCycles(connections);
 
  console.log('Valid connections after cycle removal:', validConnections.map((c: any) => `${c.Origin?.["@ToolID"]} -> ${c.Destination?.["@ToolID"]}`));
 
  workflowContent.Nodes.Node = Array.from(convertedNodesMap.values());

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


function convertNodeToCloud(node: any, upstreamMap: Map<string, string[]>, nodesMap: Map<string, any>, datasets?: Array<{id: string, name: string, datasetId: string, path: string}>, enableSummarizeValidation: boolean = true): any {
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
  const isBrowseTool = updatedPlugin.includes("Browse");
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
 
  // Find matching dataset for input tools
  let datasetInfo = undefined;
  if (isInputTool && datasets && datasets.length > 0) {
    const originalConfig = node.Properties?.Configuration || {};
    const fileInfo = normalizeInputFileFormat(originalConfig); // ✅ FIX

    console.log(`🔍 Looking for dataset matching filename: "${fileInfo.normalizedName}"`);

    const matchedDataset = datasets.find(d => {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/\s+/g, '').replace(/\.csv$/, '');
      return normalize(d.name) === normalize(fileInfo.normalizedName);
    });

    if (matchedDataset) {
      datasetInfo = {
        datasetId: matchedDataset.datasetId,
        path: matchedDataset.path,
        name: matchedDataset.name
      };
      console.log(`✅ Found matching dataset:`, datasetInfo);
    } else {
      console.log(`⚠️ No matching dataset found – NOT injecting DatasetId`);
      datasetInfo = undefined; // ❌ DO NOT fallback
    }
  }
 
  // Route to specific converter based on tool type
  if (isInputTool) {
    convertInputTool(cloudNode, node, datasetInfo);
  } else if (isOutputTool) {
    convertOutputTool(cloudNode, node);
  } else if (isBrowseTool) {
    console.warn(`👁️ Browse tool ${node['@ToolID']} skipped (Cloud unsupported)`);
    return null;
  } else if (isSelectTool) {
    convertSelectTool(cloudNode, node);
  } else if (isFilterTool) {
    convertFilterTool(cloudNode, node);
  } else if (isFormulaTool) {
    convertFormulaTool(cloudNode, node);
  } else if (isUnionTool) {
    convertUnionTool(cloudNode, node);
  } else if (isJoinTool) {
    convertJoinTool(cloudNode, node, upstreamMap, nodesMap);
  } else if (isSortTool) {
    convertSortTool(cloudNode, node);
  } else if (isSummarizeTool) {
    if (!enableSummarizeValidation) {
      console.log(`⏭️ Skipping Summarize tool ${cloudNode['@ToolID']} in PASS 1`);
      return cloudNode; // Skip completely in first pass
    }
    convertSummarizeTool(cloudNode, node, upstreamMap, nodesMap);
  } else if (isContainerTool) {
    convertContainerTool(cloudNode, node);
  } else {
    convertGenericTool(cloudNode, node);
  }
 
  ensureAnnotation(cloudNode);
 
  return cloudNode;
}


function convertInputTool(cloudNode: any, originalNode: any, datasetInfo?: {datasetId: string, path: string, name: string}): void {
  cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalInput.UniversalInput";
 
  cloudNode.EngineSettings = {
    "@EngineDll": "UniversalInputTool.dll",
    "@EngineDllEntryPoint": "UniversalInputTool"
  };
 
  const originalConfig = originalNode.Properties?.Configuration || {};
  const fileInfo = normalizeInputFileFormat(originalConfig);
 
  console.log(`📁 Processing input file: "${fileInfo.fileName}" (${fileInfo.extension || 'no extension'})`);
 
  cloudNode.Properties = cloudNode.Properties || {};
  
  // 🔥 CORRECT FIX: Cloud-specific logic
  if (datasetInfo?.datasetId) {
    // Case 1: DatasetId exists → Only DatasetId + ConnectionName
    console.log(`🔧 Injecting dataset info:`, datasetInfo);
    
    cloudNode.Properties.Configuration = {
      "DatasetId": datasetInfo.datasetId,
      "ConnectionName": datasetInfo.name
    };
  } else {
    // Case 2: No DatasetId → Full file configuration
    console.log(`⚠️ No dataset provided - creating full file config`);
    
    cloudNode.Properties.Configuration = createFileConfiguration(fileInfo);
    
    // ✅ 1. Only inject DatasetId if it exists in Cloud
    if (!datasetInfo?.datasetId) {
      delete cloudNode.Properties.Configuration.DatasetId;
    }
  }
  
  // ✅ 2. REMOVE dataset UI flags for Cloud (🔥 Mandatory)
  delete cloudNode.Properties.Configuration.__page;
  delete cloudNode.Properties.Configuration.__previousPage;
  delete cloudNode.Properties.Configuration.__needsDatasetSelection;
 
  // Use empty MetaInfo - Cloud will infer from dataset
  cloudNode.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": { "Field": [] }
  };
 
  console.log(`✅ Input tool configured: DatasetId=${cloudNode.Properties.Configuration.DatasetId || 'NONE'}`);
}


function convertOutputTool(cloudNode: any, originalNode: any): void {
  cloudNode.GuiSettings["@Plugin"] = "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput";
 
  cloudNode.EngineSettings = {
    "@EngineDll": "UniversalOutputTool.dll",
    "@EngineDllEntryPoint": "UniversalOutputTool"
  };
 
  const originalConfig = originalNode.Properties?.Configuration || {};
  const fileInfo = normalizeInputFileFormat(originalConfig);
 
  console.log(`📤 Processing output file: "${fileInfo.fileName}" (${fileInfo.extension || 'no extension'})`);
 
  cloudNode.Properties = cloudNode.Properties || {};
  
  // ✅ Cloud Output expects dataset creation, not file config
  cloudNode.Properties.Configuration = {
    "FileName": fileInfo.normalizedName,
    "Action": "create",
    "DatasetOriginator": { "@value": "True" }
  };
 
  if (fileInfo.isCsv) {
    cloudNode.Properties.Configuration.Delim = ",";
    cloudNode.Properties.Configuration.HasQuotes = true;
  }
}


function convertSelectTool(cloudNode: any, originalNode: any): void {
  console.log(`✅ Converting Select tool (ID: ${cloudNode['@ToolID']}) - STRICT cleaning`);
 
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxSelect"
  };
 
  cloudNode.Properties = cloudNode.Properties || {};
 
  const originalConfig = originalNode.Properties?.Configuration;
  const originalFields = originalConfig?.SelectFields?.SelectField;
   
  const fields = Array.isArray(originalFields)
    ? originalFields
    : originalFields ? [originalFields] : [];
   
  cloudNode.Properties.Configuration = {
    SelectFields: {
      SelectField: fields
        .filter((f: any) => f["@field"] && f["@field"] !== "*Unknown")
        .map((f: any) => ({
          "@field": f["@field"],
          "@selected": f["@selected"] ?? "True",
          ...(f["@rename"] ? { "@rename": f["@rename"] } : {})
        }))
    }
  };
   
  cloudNode.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": {
      "Field": fields
        .filter((f: any) => f["@field"] && f["@field"] !== "*Unknown" && (f["@selected"] === "True" || f["@selected"] === true || f["@selected"] === undefined))
        .map((f: any) => {
          const fieldName = f["@rename"] || f["@field"];
          const fieldType = detectFieldType(fieldName);
          return {
            "@name": fieldName,
            "@type": fieldType,
            "@size": fieldType === "V_String" ? "254" : "8",
            "@source": "Select"
          };
        })
    }
  };
   
  console.log(`   ✅ Select tool configured with ${fields.length} fields`);
 
  // Cleanup dataset fields
  const datasetFields = [
    'DatasetId', 'SampleFileUri', 'ConnectionName', 'VendorName', 'HasInferred',
    'ConnectionId', '__tableName', '__schemaName', '__needsDatasetSelection',
    '__originalFileName', '__normalizedFileName', '__wasExcelFile', '__sampleInfo',
    'Format', 'HasHeader', 'Delimiter', 'QuoteChar', 'EscapeChar', 'Encoding',
    '__page', '__previousPage', 'Protocol', 'Path', 'FileName', 'Action',
    'DatasetOriginator', 'Delim', 'HasQuotes'
  ];
 
  datasetFields.forEach(field => {
    if (cloudNode.Properties.Configuration[field]) {
      delete cloudNode.Properties.Configuration[field];
    }
  });
}


function convertFilterTool(cloudNode: any, originalNode: any): void {
  console.log(`🔍 Converting Filter tool (ID: ${cloudNode['@ToolID']})`);
 
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxFilter"
  };
 
  cloudNode.Properties = cloudNode.Properties || {};
 
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
  } else {
    cloudNode.Properties.Configuration = {
      Expression: "",
      Mode: "Simple"
    };
  }
 
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  } else {
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
}


function convertFormulaTool(cloudNode: any, originalNode: any): void {
  console.log(`🔢 Converting Formula tool (ID: ${cloudNode['@ToolID']})`);
 
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxFormula"
  };
 
  cloudNode.Properties = cloudNode.Properties || {};
 
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
   
    const config = cloudNode.Properties.Configuration;
    if (config.FormulaFields?.FormulaField) {
      let formulaFields = Array.isArray(config.FormulaFields.FormulaField)
        ? config.FormulaFields.FormulaField
        : [config.FormulaFields.FormulaField];
     
      formulaFields.forEach((formula: any) => {
        if (formula["@expression"]) {
          const originalExpr = formula["@expression"];
          const fixedExpr = autoFixFormulaExpression(originalExpr);
         
          if (fixedExpr !== originalExpr) {
            formula["@expression"] = fixedExpr;
            console.log(`   🔧 Fixed expression`);
          } else {
            formula["@expression"] = fixedExpr;
          }
         
          const correctType = inferFormulaOutputType(fixedExpr);
          if (formula["@type"] !== correctType) {
            console.log(`   🔥 Fixed type: ${formula["@type"]} → ${correctType}`);
            formula["@type"] = correctType;
          }
        }
      });
     
      config.FormulaFields.FormulaField = formulaFields;
    }
  } else {
    cloudNode.Properties.Configuration = {
      FormulaFields: { FormulaField: [] }
    };
  }
 
  cloudNode.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": { "Field": [] }
  };
}


function inferFormulaOutputType(expr: string): string {
  if (!expr) return "V_String";
 
  const cleanExpr = expr.toLowerCase();
 
  if (cleanExpr.includes("datetimediff")) return "Int32";
  if (cleanExpr.includes("datetimeyear") || cleanExpr.includes("datetimemonth") || cleanExpr.includes("datetimeday")) return "Int32";
 
  if (/[+\-*/]/.test(expr) && !expr.includes('"') && !expr.includes("'")) {
    return "Double";
  }
 
  if (cleanExpr.includes("if") && cleanExpr.includes("then") && (expr.includes('"') || expr.includes("'"))) {
    return "V_String";
  }
 
  return "V_String";
}

function autoFixFormulaExpression(expression: string): string {
  if (!expression) return expression;
 
  let fixed = expression
    .replace(/&gt;=/g, '>=')
    .replace(/&lt;=/g, '<=')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
 
  fixed = fixed.replace(
    /\[([^\]]+)\]\s*(>=|<=|>|<)\s*([0-9]+\.?[0-9]*)/g,
    'ToNumber([$1]) $2 $3'
  );
 
  fixed = fixed.replace(
    /\[([^\]]+)\]\s*(\+|\-|\*|\/)\s*([0-9]+\.?[0-9]*)/g,
    'ToNumber([$1]) $2 $3'
  );
 
  fixed = fixed.replace(
    /\[([^\]]+)\]\s*(\+|\-|\*|\/)\s*\[([^\]]+)\]/g,
    'ToNumber([$1]) $2 ToNumber([$3])'
  );
 
  fixed = fixed.replace(/ToNumber\(ToNumber\(([^)]+)\)\)/g, 'ToNumber($1)');
 
  return fixed;
}


function convertUnionTool(cloudNode: any, originalNode: any): void {
  console.log(`🔗 Converting Union tool (ID: ${cloudNode['@ToolID']})`);
 
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxUnion"
  };
 
  cloudNode.Properties = cloudNode.Properties || {};
 
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
   
    const config = cloudNode.Properties.Configuration;
   
    if (!config.Mode) {
      config.Mode = "ByName";
    }
   
    if (!config.ByName_ErrorMode) {
      config.ByName_ErrorMode = "Warning";
    }
   
    if (!config.ByName_OutputMode) {
      config.ByName_OutputMode = "All";
    }
   
    if (config.SetOutputOrder) {
      if (typeof config.SetOutputOrder === 'string') {
        config.SetOutputOrder = { "@value": config.SetOutputOrder };
      }
    } else {
      config.SetOutputOrder = { "@value": "False" };
    }
   
    if (config.ByName === true || config.ByName === "true" || config.ByName === "True") {
      config.Mode = "ByName";
    } else if (config.ByName === false || config.ByName === "false" || config.ByName === "False") {
      config.Mode = "ByPosition";
    }
  } else {
    cloudNode.Properties.Configuration = {
      "ByName_ErrorMode": "Warning",
      "ByName_OutputMode": "All",
      "Mode": "ByName",
      "SetOutputOrder": { "@value": "False" }
    };
  }
 
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
  }
 
  cloudNode.Properties.Dependencies = { "Implicit": {} };
}


function convertJoinTool(cloudNode: any, originalNode: any, upstreamMap?: Map<string, string[]>, nodesMap?: Map<string, any>): void {
  console.log(`🔀 Converting Join tool (ID: ${cloudNode['@ToolID']})`);
 
  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxJoin"
  };
 
  cloudNode.Properties = cloudNode.Properties || {};
  
  // 🔥 CRITICAL: Copy COMPLETE Configuration from Desktop XML (including SelectConfiguration)
  if (originalNode.Properties?.Configuration) {
    cloudNode.Properties.Configuration = JSON.parse(JSON.stringify(originalNode.Properties.Configuration));
    console.log(`   ✅ Copied full Configuration from Desktop XML`);
    
    // Log what we got
    const joinInfo = cloudNode.Properties.Configuration.JoinInfo;
    const selectConfig = cloudNode.Properties.Configuration.SelectConfiguration;
    console.log(`   📋 JoinInfo:`, joinInfo ? 'Present' : 'Missing');
    console.log(`   📋 SelectConfiguration:`, selectConfig ? 'Present' : 'Missing');
  } else {
    console.log(`   ⚠️ No Configuration in Desktop XML - creating default`);
    cloudNode.Properties.Configuration = {
      "@joinByRecordPos": { "@value": "False" },
      "JoinInfo": []
    };
  }
 
  // 🔥 CRITICAL: Copy MetaInfo from Desktop XML if available
  if (originalNode.Properties?.MetaInfo) {
    cloudNode.Properties.MetaInfo = JSON.parse(JSON.stringify(originalNode.Properties.MetaInfo));
    console.log(`   ✅ Copied MetaInfo from Desktop XML`);
    return;
  }
  
  console.log(`   ⚠️ No MetaInfo in Desktop XML - building from upstream`);
  
  // Fallback: Collect from upstream tools
  const upstreamIds = upstreamMap?.get(cloudNode['@ToolID']) || [];
  let leftFields: any[] = [];
  let rightFields: any[] = [];
  
  if (upstreamIds.length >= 2 && nodesMap) {
    const leftUpstream = nodesMap.get(upstreamIds[0]);
    const leftFieldList = leftUpstream?.Properties?.MetaInfo?.RecordInfo?.Field;
    if (leftFieldList) {
      leftFields = Array.isArray(leftFieldList) ? leftFieldList : [leftFieldList];
    }
    
    const rightUpstream = nodesMap.get(upstreamIds[1]);
    const rightFieldList = rightUpstream?.Properties?.MetaInfo?.RecordInfo?.Field;
    if (rightFieldList) {
      rightFields = Array.isArray(rightFieldList) ? rightFieldList : [rightFieldList];
    }
  }
  
  // Extract join keys from JoinInfo
  const joinKeys = (cloudNode.Properties.Configuration.JoinInfo || [])
    .map((j: any) => j.Field?.["@field"])
    .filter(Boolean);
  
  const joinKeyFallback = joinKeys.map((k: string) => ({
    "@name": k,
    "@type": detectFieldType(k),
    "@size": detectFieldType(k) === "V_String" ? "254" : "8",
    "@source": "JoinKey"
  }));
  
  const placeholderField = [{
    "@name": "_auto",
    "@type": "V_String",
    "@size": "1",
    "@source": "Auto"
  }];
  
  const safeLeftFields = 
    leftFields.length > 0 ? leftFields :
    joinKeyFallback.length > 0 ? joinKeyFallback :
    placeholderField;
  
  const safeRightFields = 
    rightFields.length > 0 ? rightFields :
    joinKeyFallback.length > 0 ? joinKeyFallback :
    placeholderField;
  
  const allFieldsMap = new Map<string, any>();
  [...safeLeftFields, ...safeRightFields].forEach(f => {
    if (f["@name"] && !allFieldsMap.has(f["@name"])) {
      allFieldsMap.set(f["@name"], f);
    }
  });
  const joinFields = Array.from(allFieldsMap.values());
  
  cloudNode.Properties.MetaInfo = [
    {
      "@connection": "Left",
      "RecordInfo": { "Field": safeLeftFields }
    },
    {
      "@connection": "Right",
      "RecordInfo": { "Field": safeRightFields }
    },
    {
      "@connection": "Join",
      "RecordInfo": { "Field": joinFields }
    }
  ];
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


// 🔥 FIXED SUMMARIZE TOOL - VALIDATES AGAINST UPSTREAM
function convertSummarizeTool(
  cloudNode: any, 
  originalNode: any,
  upstreamMap?: Map<string, string[]>,
  nodesMap?: Map<string, any>
): void {
  const toolId = cloudNode['@ToolID'] || originalNode['@ToolID'];
  console.log(`📈 Converting Summarize tool (ID: ${toolId})`);

  cloudNode.EngineSettings = {
    "@EngineDll": "AlteryxBasePluginsEngine.dll",
    "@EngineDllEntryPoint": "AlteryxSummarize"
  };

  cloudNode.Properties = cloudNode.Properties || {};

  // Extract summarize fields from XML
  const summarizeFields =
    originalNode.Properties?.Configuration?.SummarizeFields?.SummarizeField;

  const fields = Array.isArray(summarizeFields)
    ? summarizeFields
    : summarizeFields ? [summarizeFields] : [];

  console.log(`🔍 Found ${fields.length} Summarize fields in original XML`);
  fields.forEach((f: any, i: number) => {
    console.log(`   ${i + 1}. "${f["@field"]}" (${f["@action"]})`);
  });

  // First, create initial processed fields
  let processedFields = fields
    .filter((f: any) => {
      if (!f["@field"] || !f["@action"]) {
        console.warn(`⚠️ Skipping invalid field: missing @field or @action`);
        return false;
      }
      return true;
    })
    .map((f: any) => {
      const field: any = {
        "@field": f["@field"],
        "@action": f["@action"]
      };
      
      // Preserve rename if present
      if (f["@rename"]) {
        field["@rename"] = f["@rename"];
      }
      
      // Add type hint for numeric aggregations
      if (["Sum", "Avg", "Min", "Max"].includes(f["@action"])) {
        field["@type"] = f["@type"] || "Double";
      }
      
      return field;
    });

  console.log(`✅ After initial validation: ${processedFields.length} fields`);

  // CRITICAL: Validate against upstream tools to remove fields that don't exist
  if (upstreamMap && nodesMap) {
    console.log(`🔍 Starting upstream validation...`);
    processedFields = validateFieldsAgainstUpstream(
      processedFields, 
      toolId,
      upstreamMap, 
      nodesMap
    );
    console.log(`✅ After upstream validation: ${processedFields.length} fields remain`);
  } else {
    console.warn(`⚠️ No upstream validation - upstreamMap or nodesMap missing`);
  }

  console.log(`✅ Final configuration has ${processedFields.length} fields:`);
  processedFields.forEach((f: any, i: number) => {
    console.log(`   ${i + 1}. Field: "${f["@field"]}" Action: "${f["@action"]}"`);
  });

  if (processedFields.length === 0) {
    console.error(`❌ CRITICAL ERROR: No fields remaining in Summarize tool!`);
    console.error(`   This workflow will fail. Check your Select tool configuration.`);
  }

  // Create clean configuration
  cloudNode.Properties.Configuration = {
    SummarizeFields: {
      SummarizeField: processedFields
    }
  };

  // Build output MetaInfo based on remaining fields (optional - can use empty for Cloud)
  cloudNode.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": { "Field": [] }  // Let Cloud infer the schema
  };

  console.log(`✅ Summarize tool conversion complete`);
}

// Helper function to validate fields against upstream SELECT tools specifically
function validateFieldsAgainstUpstream(
  fields: any[],
  toolId: string,
  upstreamMap: Map<string, string[]>,
  nodesMap: Map<string, any>
): any[] {
  console.log(`🔍 Validating Summarize fields for tool ${toolId}`);
  
  const upstreamToolIds = upstreamMap.get(toolId) || [];
  
  if (upstreamToolIds.length === 0) {
    console.warn(`⚠️ No upstream tools found for Summarize ${toolId} - keeping all fields`);
    return fields;
  }

  console.log(`✅ Found ${upstreamToolIds.length} upstream tools: ${upstreamToolIds.join(', ')}`);

  // 🔥 CRITICAL FIX: Find nearest upstream SELECT tool specifically
  const allowedFields = new Set<string>();
  
  for (const upstreamId of upstreamToolIds) {
    console.log(`   Checking upstream tool ${upstreamId}...`);
    const upstreamNode = nodesMap.get(upstreamId);
    
    // Only process SELECT tools for field validation
    if (upstreamNode?.GuiSettings?.["@Plugin"]?.includes("AlteryxSelect")) {
      console.log(`   📋 Found Select tool ${upstreamId} - using its MetaInfo`);
      
      const metaInfo = upstreamNode.Properties?.MetaInfo;
      const fieldList = metaInfo?.RecordInfo?.Field;
      
      if (fieldList) {
        const fieldArray = Array.isArray(fieldList) ? fieldList : [fieldList];
        fieldArray.forEach((f: any) => {
          if (f["@name"]) {
            allowedFields.add(f["@name"]);
            console.log(`      ✅ Allowed field: ${f["@name"]} (${f["@type"] || 'Unknown'})`);
          }
        });
      }
    } else {
      console.log(`   ⏭️ Skipping non-Select tool ${upstreamId}`);
    }
  }

  console.log(`🔍 Total allowed fields from Select: ${Array.from(allowedFields).join(', ')}`);

  // 🚨 SAFETY NET: If no Select fields found, keep only aggregate operations
  if (allowedFields.size === 0) {
    console.warn("⚠️ No Select fields detected — keeping only aggregate operations");
    return fields.filter(f =>
      ["Sum", "Avg", "Min", "Max", "Count"].includes(f["@action"])
    );
  }

  // 🔥 HARD FILTER: Only keep fields that exist in Select tool output
  let keptCount = 0;
  let removedCount = 0;
  
  const validatedFields = fields.filter((f: any) => {
    const fieldName = f["@field"];
    
    if (!allowedFields.has(fieldName)) {
      console.log(`   ❌ REMOVING field "${fieldName}" - NOT in Select tool output`);
      removedCount++;
      return false;
    }
    
    console.log(`   ✅ KEEPING field "${fieldName}" - exists in Select tool`);
    keptCount++;
    return true;
  });

  console.log(`📈 Result: Kept ${keptCount} of ${fields.length} fields (removed ${removedCount})`);
  return validatedFields;
}


function convertBrowseTool(cloudNode: any, originalNode: any): void {
  console.log(`👁️ Browse tool detected → disabled for Cloud`);

  // ❌ NO EngineSettings for Browse

  cloudNode.Properties = {
    Disabled: { "@value": "True" },
    Annotation: {
      "@DisplayMode": "0",
      "Name": "Browse (Desktop only)",
      "AnnotationText": "Ignored in Alteryx Cloud",
      "DefaultAnnotationText": "",
      "Left": { "@value": "False" }
    }
  };

  // Optional: remove MetaInfo entirely
  delete cloudNode.Properties.MetaInfo;
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
    cloudNode.Properties.Annotation = {};
  }
 
  cloudNode.Properties.Annotation = {
    "@DisplayMode": cloudNode.Properties.Annotation["@DisplayMode"] || "0",
    "Name": "",
    "AnnotationText": "",
    "DefaultAnnotationText": "",
    "Left": cloudNode.Properties.Annotation.Left || { "@value": "False" }
  };
}


function removeCycles(connections: any[]): any[] {
  const validConnections: any[] = [];
  const edges = new Set<string>();
 
  const filterOutputs = new Map<string, Set<string>>();
 
  connections.forEach(conn => {
    const from = conn.Origin?.["@ToolID"];
    const to = conn.Destination?.["@ToolID"];
    const fromConnection = conn.Origin?.["@Connection"];
   
    if (from && to && from !== to) {
      const edge = `${String(from).replace(/[<>&"']/g, '')}->${String(to).replace(/[<>&"']/g, '')}`;
      const reverseEdge = `${String(to).replace(/[<>&"']/g, '')}->${String(from).replace(/[<>&"']/g, '')}`;
     
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
        console.warn(`⚠️ Potential cycle detected: ${from} → ${to}`);
        validConnections.push(conn);
      }
    }
  });
 
  filterOutputs.forEach((outputs, toolId) => {
    if (outputs.size === 1) {
      const connected = Array.from(outputs)[0];
      const missing = connected === "True" ? "False" : "True";
      console.warn(`⚠️ Filter tool ${toolId}: ${missing} output is DISCONNECTED`);
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