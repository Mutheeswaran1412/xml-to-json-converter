# File Normalization - Quick Reference Guide

## 🎯 What It Does
Automatically converts Excel file references (.xlsx, .xls) to CSV format (.csv) during XML to JSON conversion for cloud compatibility.

## 📝 Quick Examples

### Example 1: Simple Excel File
```javascript
// Input
"empdata - Copy.xlsx"

// Output
"empdata - Copy.csv"
```

### Example 2: Multiple Files
```javascript
// Input
["sales.xlsx", "customers.xls", "data.csv"]

// Output
["sales.csv", "customers.csv", "data.csv"]
```

## 🔧 How to Use

### In Your Code
```typescript
import { normalizeFileToCSV } from './utils/cloudCompatible';

// Normalize a single filename
const normalized = normalizeFileToCSV('empdata - Copy.xlsx');
console.log(normalized); // "empdata - Copy.csv"
```

### Automatic During Conversion
The normalization happens automatically when you:
1. Upload XML workflow
2. Configure datasets
3. Click "Convert to JSON with Datasets"

No manual intervention needed! ✨

## 📋 Configuration Changes

### Before (Excel)
```json
{
  "ConnectionName": "empdata - Copy.xlsx",
  "Format": "excel",
  "Sheet": "Sheet1",
  "Range": "A1:Z100"
}
```

### After (CSV)
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

## ✅ Supported Formats

| Input Extension | Output Extension | Notes |
|----------------|------------------|-------|
| .xlsx          | .csv             | Excel 2007+ |
| .xls           | .csv             | Excel 97-2003 |
| .XLSX          | .csv             | Case insensitive |
| .csv           | .csv             | No change |

## 🚀 Key Features

- ✅ **Automatic Detection**: Identifies Excel files automatically
- ✅ **Name Preservation**: Keeps original filename (only changes extension)
- ✅ **Config Updates**: Automatically updates format settings
- ✅ **Excel Cleanup**: Removes Excel-specific properties
- ✅ **Cloud Ready**: Output works with all cloud platforms

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `FILE_NORMALIZATION.md` | Complete feature documentation |
| `NORMALIZATION_EXAMPLE.md` | Before/after examples |
| `NORMALIZATION_FLOW.md` | Process flow diagrams |
| `CHANGES_SUMMARY.md` | All changes made |
| `QUICK_REFERENCE.md` | This file - quick lookup |

## 🧪 Testing

### Run Tests
```bash
npm run test:normalization
```

### Manual Test
```typescript
import { normalizeFileToCSV } from './utils/cloudCompatible';

console.log(normalizeFileToCSV('test.xlsx'));  // "test.csv"
console.log(normalizeFileToCSV('test.xls'));   // "test.csv"
console.log(normalizeFileToCSV('test.csv'));   // "test.csv"
```

## 🎨 Visual Summary

```
Excel Files (.xlsx, .xls)
         ↓
   Normalization
         ↓
   CSV Files (.csv)
         ↓
  Cloud Compatible ✓
```

## 💡 Pro Tips

1. **File Names with Spaces**: Preserved correctly
   - `"empdata - Copy.xlsx"` → `"empdata - Copy.csv"`

2. **Case Insensitive**: Works with any case
   - `"Report.XLSX"` → `"Report.csv"`

3. **Already CSV**: No changes made
   - `"data.csv"` → `"data.csv"`

4. **Multiple Datasets**: All processed automatically
   - Batch normalization for all input files

## ⚡ Performance

- Fast: O(n) complexity
- Efficient: Single pass processing
- Lightweight: No external dependencies
- Reliable: Comprehensive error handling

## 🔍 Where to Find the Code

```
src/utils/cloudCompatible.ts
├── normalizeFileToCSV()      ← Main normalization function
└── makeCloudCompatible()     ← Integration with conversion
```

## 📞 Need Help?

1. Check `FILE_NORMALIZATION.md` for detailed docs
2. See `NORMALIZATION_EXAMPLE.md` for examples
3. Review `NORMALIZATION_FLOW.md` for process flow
4. Read `CHANGES_SUMMARY.md` for implementation details

## 🎯 Common Use Cases

### Use Case 1: Single Excel File
```javascript
Dataset: { name: "sales.xlsx", ... }
Result: { ConnectionName: "sales.csv", Format: "csv", ... }
```

### Use Case 2: Mixed File Types
```javascript
Datasets: [
  { name: "sales.xlsx", ... },
  { name: "data.csv", ... }
]
Results: [
  { ConnectionName: "sales.csv", ... },
  { ConnectionName: "data.csv", ... }
]
```

### Use Case 3: Workflow with Multiple Inputs
```javascript
// All Excel inputs automatically normalized to CSV
// Configuration updated for each input
// Cloud-compatible JSON generated
```

## ✨ Benefits at a Glance

| Benefit | Description |
|---------|-------------|
| 🔄 Automatic | No manual conversion needed |
| 🎯 Consistent | All files use same format |
| ☁️ Compatible | Works with all cloud platforms |
| 🛡️ Safe | Preserves original file names |
| ⚡ Fast | Instant normalization |
| 📦 Complete | Includes config updates |

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: ✅ Production Ready
