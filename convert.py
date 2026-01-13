#!/usr/bin/env python3
import json
import sys

def quick_convert(input_file):
    """Quick conversion script"""
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Convert tools and paths
    for node in data["content"]["Nodes"]["Node"]:
        plugin = node.get("GuiSettings", {}).get("@Plugin", "")
        
        # DbFileInput → UniversalInput
        if "DbFileInput" in plugin:
            node["GuiSettings"]["@Plugin"] = "AlteryxBasePluginsGui.UniversalInput.UniversalInput"
            node["EngineSettings"] = {
                "@EngineDll": "UniversalInputTool.dll",
                "@EngineDllEntryPoint": "UniversalInputTool"
            }
            
            # Replace local path with cloud path
            config = node["Properties"]["Configuration"]
            if "File" in config:
                filename = config["File"].split("\\")[-1]
                config.clear()
                config.update({
                    "__page": "LIST_CONNECTIONS",
                    "DatasetId": "559479",
                    "SampleFileUri": f"tfs://trinitetech-alteryx-trial-lhsa/110911/uploads/cf9ac204-b825-43d8-aac0-0411cb5608a3/{filename}",
                    "__sampleInfo": {"createdAt": "Dec 4, 2025 9:08 PM"}
                })
        
        # DbFileOutput → UniversalOutput  
        elif "DbFileOutput" in plugin:
            node["GuiSettings"]["@Plugin"] = "AlteryxBasePluginsGui.UniversalOutput.UniversalOutput"
            node["EngineSettings"] = {
                "@EngineDll": "UniversalOutputTool.dll", 
                "@EngineDllEntryPoint": "UniversalOutputTool"
            }
            
            # Replace local path with cloud path
            config = node["Properties"]["Configuration"]
            if "File" in config:
                filename = config["File"].split("\\")[-1]
                config.clear()
                config.update({
                    "Path": f"tfs://trinitetech-alteryx-trial-lhsa/110911/{filename}",
                    "Format": "csv",
                    "Action": "create",
                    "DatasetId": "559480",
                    "SelectedProtocol": "tfs"
                })
    
    # Add cloud property
    data["content"]["Properties"]["CloudDisableAutorename"] = {"@value": "True"}
    
    # Save converted file
    output_file = input_file.replace('.json', '_cloud.json')
    with open(output_file, 'w', indent=2) as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Converted: {output_file}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert.py <workflow.json>")
    else:
        quick_convert(sys.argv[1])