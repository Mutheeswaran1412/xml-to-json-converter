# Alteryx Workflow XML to JSON Converter

## Overview
This enhanced converter specifically handles Alteryx workflow (.yxmd) files and generates JSON output that exactly matches the required model structure.

## Key Features

### 1. Exact Structure Matching
- **Nodes**: Converts all tools with their ToolID, Properties, GuiSettings, and EngineSettings
- **ChildNodes**: Handles nested tools within containers
- **Connections**: Maps all workflow connections between tools
- **Properties**: Preserves workflow-level settings and metadata

### 2. Model Compliance
The converter ensures the output JSON matches the exact structure:
```json
{
  "content": {
    "Nodes": {
      "Node": [...]
    },
    "Properties": {...},
    "Connections": {
      "Connection": [...]
    }
  },
  "contentChecksum": "..."
}
```

### 3. Field Mapping

#### Node Structure
- `@ToolID`: Tool identifier
- `Properties.MetaInfo`: Field definitions and connection info
- `Properties.Annotation`: Tool annotations and display settings
- `Properties.Configuration`: Tool-specific configuration
- `GuiSettings`: UI positioning and plugin information
- `EngineSettings`: Engine DLL and entry point

#### Connection Structure
- `@name`: Connection name (often empty)
- `Origin`: Source tool and connection type
- `Destination`: Target tool and connection type

### 4. Advanced Handling

#### Multiple MetaInfo Elements
For tools like Join that have multiple connections:
```json
"MetaInfo": [
  {"RecordInfo": {...}, "@connection": "Left"},
  {"RecordInfo": {...}, "@connection": "Join"},
  {"RecordInfo": {...}, "@connection": "Right"}
]
```

#### Tool Containers
Nested tools within containers are preserved:
```json
{
  "@ToolID": "3",
  "ChildNodes": {
    "Node": [
      {"@ToolID": "1", ...},
      {"@ToolID": "2", ...}
    ]
  },
  "Properties": {...}
}
```

## Usage

### Basic Conversion
```javascript
import { AlteryxWorkflowConverter } from './alteryxWorkflowConverter';

const converter = new AlteryxWorkflowConverter();
const workflowJson = converter.convertXmlToAlteryxJson(xmlString);
```

### Integration with Main Converter
The converter is automatically used when `.yxmd` files are detected:
```javascript
import { convertXmlToJson } from './converter';

const result = await convertXmlToJson(alteryxXml, {
  preserveAttributes: true,
  outputFormat: 'pretty'
});
```

## Validation

### Structure Validation
- All XML nodes are represented in JSON
- Attribute values match exactly (@ToolID, @connection, etc.)
- Nested structures are preserved
- Array structures for multiple elements

### Data Integrity
- Tool configurations are fully preserved
- Connection mappings are accurate
- Workflow properties are maintained
- Field definitions are complete

## Output Files

### Naming Convention
- `workflow_converted_YYYY-MM-DD-HHMMSS.json`
- `workflow_comparison_YYYY-MM-DD-HHMMSS.html`
- `workflow_metadata_YYYY-MM-DD-HHMMSS.json`

### Verification
1. **Structure Check**: Compare node count and hierarchy
2. **Connection Validation**: Verify all tool connections
3. **Field Mapping**: Ensure all field definitions are preserved
4. **Configuration Integrity**: Validate tool settings

## Error Handling

### Common Issues
- **Missing ToolID**: Tools without ToolID are skipped
- **Invalid XML**: Parser errors are reported with line numbers
- **Incomplete Connections**: Missing Origin/Destination elements

### Recovery Strategies
- Fallback to generic XML converter if specialized parsing fails
- Partial conversion with error reporting
- Detailed validation messages

## Testing

Use the provided test file `test-alteryx-workflow.xml` to validate:
1. Load the test XML
2. Convert using the enhanced converter
3. Compare output structure with model JSON
4. Verify all tools, connections, and properties are preserved

## Model Compliance Checklist

✅ **Nodes Structure**
- All tools converted with @ToolID
- Properties.MetaInfo with RecordInfo and Fields
- Properties.Annotation with display settings
- Properties.Configuration with tool settings
- GuiSettings with Plugin and Position
- EngineSettings with DLL information

✅ **Connections Structure**
- All connections mapped correctly
- Origin and Destination with @ToolID and @Connection
- Connection names preserved (including empty names)

✅ **Workflow Properties**
- Events, Memory, MetaInfo preserved
- Layout and display settings maintained
- Performance and execution settings included

✅ **Data Types and Formatting**
- Attributes prefixed with @
- Boolean values as strings ("True"/"False")
- Numeric values as strings for precision
- Empty elements as empty strings or null

This converter ensures your Alteryx workflows are converted to JSON with complete fidelity to the original structure and can be used for workflow analysis, migration, or integration with other systems.