# File Normalization Example

## Before Conversion (Original XML Configuration)

```xml
<Node ToolID="1">
  <GuiSettings Plugin="AlteryxBasePluginsGui.UniversalInput.UniversalInput">
    <Position x="54" y="54" />
  </GuiSettings>
  <Properties>
    <Configuration>
      <ConnectionName>empdata - Copy.xlsx</ConnectionName>
      <Format>excel</Format>
      <Sheet>Sheet1</Sheet>
      <Range>A1:Z100</Range>
    </Configuration>
  </Properties>
</Node>
```

## After Conversion (Cloud-Compatible JSON)

```json
{
  "name": "Employee Data Workflow",
  "content": {
    "Nodes": {
      "Node": [
        {
          "@ToolID": "1",
          "GuiSettings": {
            "@Plugin": "AlteryxBasePluginsGui.UniversalInput.UniversalInput",
            "Position": {
              "@x": "54",
              "@y": "54"
            }
          },
          "Properties": {
            "Configuration": {
              "ConnectionName": "empdata - Copy.csv",
              "DatasetId": "DS_1234567890",
              "SampleFileUri": "/cloud/datasets/DS_1234567890/empdata - Copy.csv",
              "Format": "csv",
              "Delim": ",",
              "HasQuotes": "true",
              "Header": "true",
              "FirstRowData": "false"
            }
          }
        }
      ]
    }
  }
}
```

## Key Changes

### 1. File Extension Normalization
- **Before**: `empdata - Copy.xlsx`
- **After**: `empdata - Copy.csv`

### 2. Format Configuration
- **Before**: `"Format": "excel"`
- **After**: `"Format": "csv"`

### 3. CSV-Specific Properties Added
```json
"Delim": ",",
"HasQuotes": "true",
"Header": "true",
"FirstRowData": "false"
```

### 4. Excel-Specific Properties Removed
- `Sheet` property deleted
- `Range` property deleted

### 5. Cloud Dataset References Added
```json
"DatasetId": "DS_1234567890",
"SampleFileUri": "/cloud/datasets/DS_1234567890/empdata - Copy.csv"
```

## Multiple Files Example

### Input Dataset Configuration
```javascript
[
  { name: "empdata - Copy.xlsx", datasetId: "DS_001", path: "/cloud/datasets/DS_001/empdata - Copy.xlsx" },
  { name: "sales_report.xls", datasetId: "DS_002", path: "/cloud/datasets/DS_002/sales_report.xls" },
  { name: "customer_data.csv", datasetId: "DS_003", path: "/cloud/datasets/DS_003/customer_data.csv" }
]
```

### Normalized Output
```javascript
[
  { name: "empdata - Copy.csv", datasetId: "DS_001", path: "/cloud/datasets/DS_001/empdata - Copy.csv" },
  { name: "sales_report.csv", datasetId: "DS_002", path: "/cloud/datasets/DS_002/sales_report.csv" },
  { name: "customer_data.csv", datasetId: "DS_003", path: "/cloud/datasets/DS_003/customer_data.csv" }
]
```

## Benefits

✅ **Consistency**: All files use the same format  
✅ **Compatibility**: CSV works across all cloud platforms  
✅ **Simplicity**: No format-specific configuration needed  
✅ **Automation**: Happens automatically during conversion  
✅ **Preservation**: Original file names maintained (only extension changes)
