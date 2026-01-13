# File Format Normalization for Cloud Compatibility

## Overview
The XML to JSON converter now includes automatic file format normalization to ensure all input files are converted to CSV format for cloud compatibility.

## Feature Description

### What It Does
When converting an XML workflow to cloud-compatible JSON, the system automatically:

1. **Detects Input File Format**: Identifies file extensions (.xlsx, .xls, .csv) from the original configuration
2. **Normalizes Excel Files**: Converts Excel format files to CSV format
3. **Updates Configuration**: Modifies format-specific settings to match CSV requirements
4. **Preserves CSV Files**: Keeps existing CSV files unchanged

### How It Works

#### File Name Normalization
The `normalizeFileToCSV()` function handles the conversion:

```typescript
// Input: "empdata - Copy.xlsx"
// Output: "empdata - Copy.csv"

// Input: "employee_data.xls"
// Output: "employee_data.csv"

// Input: "data.csv"
// Output: "data.csv" (unchanged)
```

#### Configuration Updates
For Excel files converted to CSV, the following configuration changes are applied:

**Before (Excel format):**
```json
{
  "ConnectionName": "empdata - Copy.xlsx",
  "Format": "excel",
  "Sheet": "Sheet1",
  "Range": "A1:Z100"
}
```

**After (CSV format):**
```json
{
  "ConnectionName": "empdata - Copy.csv",
  "Format": "csv",
  "Delim": ",",
  "HasQuotes": "true",
  "Header": "true",
  "FirstRowData": "false"
}
```

## Implementation Details

### Function: normalizeFileToCSV()

**Location**: `src/utils/cloudCompatible.ts`

**Purpose**: Converts file extensions from Excel formats to CSV

**Parameters**:
- `filename` (string): Original filename with extension

**Returns**: 
- (string): Normalized filename with .csv extension

**Examples**:
```typescript
normalizeFileToCSV('empdata - Copy.xlsx')  // → 'empdata - Copy.csv'
normalizeFileToCSV('report.xls')           // → 'report.csv'
normalizeFileToCSV('data.csv')             // → 'data.csv'
normalizeFileToCSV('Sales.XLSX')           // → 'Sales.csv' (case-insensitive)
```

### Function: makeCloudCompatible()

**Enhanced Functionality**:
- Detects UniversalInput tools in the workflow
- Applies normalization to all input file references
- Updates format-specific configuration properties
- Removes Excel-specific properties (Sheet, Range)
- Adds CSV-specific properties (Delim, HasQuotes, Header)

## Supported File Formats

### Input Formats (Normalized to CSV)
- `.xlsx` - Excel 2007+ format
- `.xls` - Excel 97-2003 format
- `.XLSX` / `.XLS` - Case-insensitive variants

### Output Format
- `.csv` - Comma-Separated Values (universal cloud format)

## Benefits

1. **Cloud Consistency**: All input files use the same format in cloud environments
2. **Compatibility**: CSV is universally supported across cloud platforms
3. **Simplicity**: Reduces format-specific configuration complexity
4. **Automation**: No manual intervention required for format conversion

## Usage in Workflow

The normalization happens automatically during the conversion process:

1. User uploads XML workflow with Excel file references
2. System detects file formats in dataset configuration
3. Normalization function converts Excel references to CSV
4. Configuration is updated with CSV-specific settings
5. Cloud-compatible JSON is generated with normalized references

## Testing

Run the test file to verify normalization:

```bash
npm run test:normalization
```

Or manually test with:
```typescript
import { normalizeFileToCSV } from './utils/cloudCompatible';

console.log(normalizeFileToCSV('empdata - Copy.xlsx'));
// Output: "empdata - Copy.csv"
```

## Notes

- File names with spaces and special characters are preserved
- Only the extension is modified (e.g., "empdata - Copy.xlsx" → "empdata - Copy.csv")
- Original XML files are not modified; only the JSON output is affected
- CSV files that are already in the correct format remain unchanged

## Future Enhancements

Potential improvements for future versions:
- Support for additional input formats (TSV, TXT, etc.)
- Configurable delimiter options
- Custom normalization rules per dataset
- Format validation and warnings
