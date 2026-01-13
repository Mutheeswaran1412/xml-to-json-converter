# File Normalization Flow Diagram

## Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER UPLOADS XML WORKFLOW                     │
│                  (Contains Excel file references)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   USER CONFIGURES DATASETS                       │
│   Dataset 1: "empdata - Copy.xlsx"                              │
│   Dataset 2: "sales_report.xls"                                 │
│   Dataset 3: "customer_data.csv"                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              USER CLICKS "CONVERT TO JSON"                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    XML TO JSON CONVERSION                        │
│              (convertXmlToJson function)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ENHANCE WITH DATASETS                            │
│           (enhanceJsonWithDatasets function)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD COMPATIBILITY CONVERSION                      │
│              (makeCloudCompatible function)                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  FOR EACH UniversalInput NODE:                         │    │
│  │                                                         │    │
│  │  1. Get original filename from dataset                 │    │
│  │     → "empdata - Copy.xlsx"                            │    │
│  │                                                         │    │
│  │  2. Call normalizeFileToCSV()                          │    │
│  │     → "empdata - Copy.csv"                             │    │
│  │                                                         │    │
│  │  3. Check if Excel file (isExcelFile)                  │    │
│  │     → true (has .xlsx extension)                       │    │
│  │                                                         │    │
│  │  4. Update ConnectionName                              │    │
│  │     → "empdata - Copy.csv"                             │    │
│  │                                                         │    │
│  │  5. Update Format Configuration:                       │    │
│  │     • Format: "csv"                                    │    │
│  │     • Delim: ","                                       │    │
│  │     • HasQuotes: "true"                                │    │
│  │     • Header: "true"                                   │    │
│  │     • FirstRowData: "false"                            │    │
│  │                                                         │    │
│  │  6. Remove Excel Properties:                           │    │
│  │     • Delete Sheet                                     │    │
│  │     • Delete Range                                     │    │
│  │                                                         │    │
│  │  7. Add Cloud References:                              │    │
│  │     • DatasetId: "DS_1234567890"                       │    │
│  │     • SampleFileUri: "/cloud/datasets/..."            │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CLOUD-COMPATIBLE JSON OUTPUT                    │
│                                                                  │
│  All Excel files normalized to CSV:                             │
│  ✓ "empdata - Copy.csv"                                         │
│  ✓ "sales_report.csv"                                           │
│  ✓ "customer_data.csv" (unchanged)                              │
│                                                                  │
│  All configurations updated for CSV format                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER DOWNLOADS JSON                           │
│              (Ready for cloud deployment)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Function Call Hierarchy

```
handleConvert()
    │
    ├─→ convertXmlToJson(xmlInput, workflowName)
    │
    ├─→ enhanceJsonWithDatasets(result)
    │
    └─→ makeCloudCompatible(result, datasets)
            │
            └─→ FOR EACH UniversalInput Node:
                    │
                    ├─→ normalizeFileToCSV(originalName)
                    │       │
                    │       ├─→ Check: /\.(xlsx?|xls)$/i.test(filename)
                    │       │
                    │       └─→ Replace: .replace(/\.(xlsx?|xls)$/i, '.csv')
                    │
                    ├─→ Update ConnectionName
                    │
                    ├─→ IF isExcelFile:
                    │       ├─→ Set Format = "csv"
                    │       ├─→ Set Delim = ","
                    │       ├─→ Set HasQuotes = "true"
                    │       ├─→ Set Header = "true"
                    │       ├─→ Set FirstRowData = "false"
                    │       ├─→ Delete Sheet
                    │       └─→ Delete Range
                    │
                    └─→ Add DatasetId & SampleFileUri
```

## Data Transformation Example

### Input Dataset Object
```javascript
{
  id: "1",
  name: "empdata - Copy.xlsx",
  datasetId: "DS_1234567890",
  path: "/cloud/datasets/DS_1234567890/empdata - Copy.xlsx"
}
```

### Normalization Process
```javascript
// Step 1: Extract original name
const originalName = "empdata - Copy.xlsx"

// Step 2: Normalize to CSV
const normalizedName = normalizeFileToCSV(originalName)
// Result: "empdata - Copy.csv"

// Step 3: Check if Excel
const isExcelFile = /\.(xlsx?|xls)$/i.test(originalName)
// Result: true
```

### Output Configuration
```json
{
  "ConnectionName": "empdata - Copy.csv",
  "DatasetId": "DS_1234567890",
  "SampleFileUri": "/cloud/datasets/DS_1234567890/empdata - Copy.xlsx",
  "Format": "csv",
  "Delim": ",",
  "HasQuotes": "true",
  "Header": "true",
  "FirstRowData": "false"
}
```

## Decision Tree

```
                    ┌─────────────────┐
                    │  Input Filename │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Check Extension │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
         │  .xlsx  │    │   .xls  │   │   .csv  │
         └────┬────┘    └────┬────┘   └────┬────┘
              │              │              │
              └──────┬───────┘              │
                     │                      │
              ┌──────▼──────┐               │
              │ Convert to  │               │
              │    .csv     │               │
              └──────┬──────┘               │
                     │                      │
              ┌──────▼──────┐               │
              │   Update    │               │
              │ Config to   │               │
              │ CSV Format  │               │
              └──────┬──────┘               │
                     │                      │
                     └──────────┬───────────┘
                                │
                         ┌──────▼──────┐
                         │   Output    │
                         │ Normalized  │
                         │  Filename   │
                         └─────────────┘
```

## Key Points

1. **Automatic Detection**: System automatically detects Excel files
2. **Seamless Conversion**: No user intervention required
3. **Configuration Sync**: Format settings updated automatically
4. **Preservation**: Original file names maintained (only extension changes)
5. **Cloud Ready**: Output is immediately compatible with cloud platforms

## Error Handling

```
┌─────────────────────────────────────────┐
│  normalizeFileToCSV(filename)           │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │ Valid filename? │
        └────────┬────────┘
                 │
         ┌───────┴───────┐
         │               │
    ┌────▼────┐     ┌────▼────┐
    │   YES   │     │   NO    │
    └────┬────┘     └────┬────┘
         │               │
         │          ┌────▼────┐
         │          │ Return  │
         │          │ as-is   │
         │          └─────────┘
         │
    ┌────▼────────────────┐
    │ Apply normalization │
    └────┬────────────────┘
         │
    ┌────▼────┐
    │ Return  │
    │ result  │
    └─────────┘
```

## Performance Considerations

- ✅ Regex matching is efficient (O(n) where n = filename length)
- ✅ Single pass through nodes array
- ✅ No external API calls
- ✅ Minimal memory overhead
- ✅ No blocking operations

## Compatibility Matrix

| Input Format | Normalized Output | Config Updated | Excel Props Removed |
|--------------|-------------------|----------------|---------------------|
| .xlsx        | .csv              | ✅ Yes         | ✅ Yes              |
| .xls         | .csv              | ✅ Yes         | ✅ Yes              |
| .XLSX        | .csv              | ✅ Yes         | ✅ Yes              |
| .csv         | .csv              | ❌ No          | ❌ N/A              |
| .txt         | .txt              | ❌ No          | ❌ N/A              |
