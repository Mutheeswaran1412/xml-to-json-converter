import json
import re
from datetime import datetime

def convert_to_cloud(workflow_json):
    """Convert local workflow to cloud-compatible format"""
    
    # Generate new IDs and timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_id = 559479
    
    for i, node in enumerate(workflow_json["content"]["Nodes"]["Node"]):
        tool_id = int(node["@ToolID"])
        
        # Convert DbFileInput to UniversalInput
        if "DbFileInput" in str(node.get("GuiSettings", {}).get("@Plugin", "")):
            node["GuiSettings"]["@Plugin"] = "AlteryxBasePluginsGui.UniversalInput.UniversalInput"
            node["EngineSettings"]["@EngineDll"] = "UniversalInputTool.dll"
            node["EngineSettings"]["@EngineDllEntryPoint"] = "UniversalInputTool"
            
            # Add cloud configuration
            config = node["Properties"]["Configuration"]
            filename = config.get("File", "").split("\\")[-1].replace(".csv", "")
            
            node["Properties"]["Configuration"] = {
                "__page": "LIST_CONNECTIONS",
                "DatasetId": str(base_id + i),
                "VendorName": "",
                "HasInferred": False,
                "__tableName": "",
                "ConnectionId": "",
                "__sampleInfo": {"createdAt": f"Dec 4, 2025 9:08 PM"},
                "__schemaName": "",
                "SampleFileUri": f"tfs://trinitetech-alteryx-trial-lhsa/110911/uploads/cf9ac204-b825-43d8-aac0-0411cb5608a3/{filename}.csv",
                "ConnectionName": "",
                "__previousPage": "LIST_CONNECTIONS"
            }
            
            # Update annotation
            node["Properties"]["Annotation"]["DefaultAnnotationText"] = f"{filename} {timestamp}.csv"
        
        # Convert DbFileOutput to UniversalOutput  
        elif "DbFileOutput" in str(node.get("GuiSettings", {}).get("@Plugin", "")):
            node["GuiSettings"]["@Plugin"] = "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput"
            node["EngineSettings"]["@EngineDll"] = "UniversalOutputTool.dll"
            node["EngineSettings"]["@EngineDllEntryPoint"] = "UniversalOutputTool"
            
            # Add cloud configuration
            config = node["Properties"]["Configuration"]
            filename = config.get("File", "").split("\\")[-1].replace(".csv", "")
            
            node["Properties"]["Configuration"] = {
                "Path": f"tfs://trinitetech-alteryx-trial-lhsa/110911/{filename}.csv",
                "Delim": ",",
                "Action": "create",
                "Format": "csv",
                "Header": True,
                "__page": "LIST_CONNECTIONS",
                "FileName": filename,
                "DatasetId": str(base_id + i + 1),
                "HasQuotes": True,
                "Operation": "create",
                "SheetName": "Sheet1",
                "TableName": "",
                "TargetType": "",
                "VendorName": "",
                "__isLoaded": True,
                "TableSchema": "",
                "ColsToUpdate": None,
                "ConnectionId": "-1",
                "InsertChecked": None,
                "MergeJoinKeys": None,
                "PartitionName": "suffixToFileName",
                "PartitionType": "noPartition",
                "ConnectionName": "",
                "OutputObjectId": None,
                "OutputSettings": None,
                "__previousPage": "LIST_CONNECTIONS",
                "LastBrowsedPath": "",
                "TableSchemaList": None,
                "OnEveryRunAction": "",
                "SelectedProtocol": "tfs",
                "DatasetOriginator": True,
                "IncludeMismatches": False,
                "MatchedRowsAction": None,
                "FileWriterSettingsId": "",
                "PartitionUsingColumn": "",
                "PublicationSettingsId": "",
                "ConversionOutputSettings": {"action": "create", "subAction": "create"},
                "ColumnOutputConfiguration": None,
                "DeleteUnmatchedRowsInTarget": None,
                "SelectedColumnInclusionInPartition": True
            }
    
    # Add cloud properties
    workflow_json["content"]["Properties"]["CloudDisableAutorename"] = {"@value": "True"}
    
    return workflow_json

# Usage
def convert_workflow_file(input_file, output_file):
    with open(input_file, 'r') as f:
        workflow = json.load(f)
    
    converted = convert_to_cloud(workflow)
    
    with open(output_file, 'w', indent=2) as f:
        json.dump(converted, f, indent=2)
    
    print(f"Converted: {input_file} → {output_file}")

if __name__ == "__main__":
    convert_workflow_file("local_workflow.json", "cloud_workflow.json")