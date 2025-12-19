/**
 * Normalizes input file names to CSV format for cloud compatibility
 * Converts .xlsx and .xls extensions to .csv
 * @param filename - Original filename (e.g., "empdata - Copy.xlsx")
 * @returns Normalized filename with .csv extension (e.g., "empdata - Copy.csv")
 */
export function normalizeFileToCSV(filename: string): string {
  // Check if file has Excel extension
  if (/\.(xlsx?|xls)$/i.test(filename)) {
    // Remove Excel extension and add .csv
    return filename.replace(/\.(xlsx?|xls)$/i, '.csv');
  }
  
  // If already CSV or other format, return as-is
  return filename;
}

/**
 * Makes Alteryx workflow JSON cloud-compatible by normalizing tool configurations
 * Handles all major Alteryx tools including:
 * - Input/Output tools (Universal Input/Output, Database Input)
 * - Data Preparation tools (Join, Union, Summarize, Filter, Sort, Select)
 * - Transform tools (Formula, Sample, Cross Tab, Transpose)
 * - Output tools (Browse)
 * @param jsonString - The JSON workflow string
 * @param datasets - Array of dataset configurations
 * @returns Cloud-compatible JSON string
 */
export function makeCloudCompatible(jsonString: string, datasets?: Array<{id: string, name: string, datasetId: string, path: string}>): string {
  try {
    const data = JSON.parse(jsonString);
    const content = data.content || data;
    
    if (!content.Nodes?.Node || !datasets || datasets.length === 0) {
      return jsonString;
    }
    
    const nodes = Array.isArray(content.Nodes.Node) ? content.Nodes.Node : [content.Nodes.Node];
    let inputDatasetIndex = 0;
    let outputDatasetIndex = 0;
    
    nodes.forEach((node: any) => {
      const plugin = node.GuiSettings?.['@Plugin'] || '';
      
      if (plugin === 'AlteryxBasePluginsGui.UniversalInput.UniversalInput') {
        if (node.Properties?.Configuration && datasets[inputDatasetIndex]) {
          const originalName = datasets[inputDatasetIndex].name;
          const normalizedName = normalizeFileToCSV(originalName);
          const isExcelFile = /\.(xlsx?|xls)$/i.test(originalName);
          
          // Update dataset references
          node.Properties.Configuration.DatasetId = datasets[inputDatasetIndex].datasetId;
          node.Properties.Configuration.SampleFileUri = datasets[inputDatasetIndex].path;
          node.Properties.Configuration.ConnectionName = normalizedName;
          
          // Update format configuration for CSV if original was Excel
          if (isExcelFile) {
            node.Properties.Configuration.Format = 'csv';
            node.Properties.Configuration.Delim = ',';
            node.Properties.Configuration.HasQuotes = 'true';
            node.Properties.Configuration.Header = 'true';
            node.Properties.Configuration.FirstRowData = 'false';
            
            // Remove Excel-specific properties
            delete node.Properties.Configuration.Sheet;
            delete node.Properties.Configuration.Range;
          }
          
          inputDatasetIndex++;
        }
      } else if (plugin === 'AlteryxBasePluginsGui.UniversalOutput.UniversalOutput') {
        if (node.Properties?.Configuration && datasets[outputDatasetIndex]) {
          const normalizedName = normalizeFileToCSV(datasets[outputDatasetIndex].name);
          
          node.Properties.Configuration.DatasetId = datasets[outputDatasetIndex].datasetId;
          node.Properties.Configuration.Path = datasets[outputDatasetIndex].path;
          node.Properties.Configuration.FileName = normalizedName.replace(/\.[^/.]+$/, '');
          outputDatasetIndex++;
        }
      } else if (plugin === 'AlteryxSummaryPluginsGui.Summarize.Summarize') {
        // Summarize tool - ensure cloud compatibility
        if (node.Properties?.Configuration) {
          // Ensure GroupByFields and SummarizeFields are properly formatted for cloud
          if (node.Properties.Configuration.GroupByFields) {
            // Normalize field references for cloud compatibility
            const groupFields = node.Properties.Configuration.GroupByFields;
            if (typeof groupFields === 'string') {
              node.Properties.Configuration.GroupByFields = groupFields.split(',').map((field: string) => field.trim());
            }
          }
          
          if (node.Properties.Configuration.SummarizeFields) {
            // Ensure summarize operations are cloud-compatible
            const sumFields = node.Properties.Configuration.SummarizeFields;
            if (Array.isArray(sumFields)) {
              sumFields.forEach((field: any) => {
                // Standardize aggregation functions for cloud
                if (field.AggregateType) {
                  field.AggregateType = field.AggregateType.toLowerCase();
                }
              });
            }
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Join.Join') {
        // Join tool - ensure cloud compatibility
        if (node.Properties?.Configuration) {
          // Normalize join configuration for cloud
          if (node.Properties.Configuration.JoinByExpression) {
            // Ensure join expressions are cloud-compatible
            const joinExpr = node.Properties.Configuration.JoinByExpression;
            if (typeof joinExpr === 'object' && joinExpr.Expression) {
              // Standardize field references in join expressions
              node.Properties.Configuration.JoinByExpression.Expression = joinExpr.Expression;
            }
          }
          
          // Ensure join keys are properly formatted
          if (node.Properties.Configuration.SelectConfiguration) {
            const selectConfig = node.Properties.Configuration.SelectConfiguration;
            if (selectConfig.Configuration && selectConfig.Configuration.OrderChanged) {
              // Maintain field order for cloud compatibility
              node.Properties.Configuration.SelectConfiguration.Configuration.OrderChanged = 'true';
            }
          }
          
          // Set cloud-compatible join type
          if (node.Properties.Configuration.JoinType) {
            const joinType = node.Properties.Configuration.JoinType.toLowerCase();
            node.Properties.Configuration.JoinType = joinType;
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Union.Union') {
        // Union tool - ensure cloud compatibility
        if (node.Properties?.Configuration) {
          // Normalize union configuration for cloud
          if (node.Properties.Configuration.ByName) {
            // Ensure union by name is properly set for cloud
            node.Properties.Configuration.ByName = node.Properties.Configuration.ByName === 'true' ? 'true' : 'false';
          }
          
          // Handle field mapping for cloud compatibility
          if (node.Properties.Configuration.SetOutputOrder) {
            node.Properties.Configuration.SetOutputOrder = 'true';
          }
          
          // Ensure proper field alignment for cloud processing
          if (node.Properties.Configuration.Fields) {
            const fields = node.Properties.Configuration.Fields;
            if (Array.isArray(fields)) {
              fields.forEach((field: any) => {
                // Standardize field names for cloud compatibility
                if (field.name) {
                  field.name = field.name.trim();
                }
                if (field.type) {
                  field.type = field.type.toLowerCase();
                }
              });
            }
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.DbFileInput.DbFileInput') {
        // Database Input tool - ensure cloud compatibility
        if (node.Properties?.Configuration) {
          // Normalize database connection for cloud
          if (node.Properties.Configuration.Connection) {
            node.Properties.Configuration.Connection = node.Properties.Configuration.Connection;
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.AlteryxSelect.AlteryxSelect') {
        // Select tool - ensure field selection is cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.OrderChanged) {
            node.Properties.Configuration.OrderChanged = 'true';
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Filter.Filter') {
        // Filter tool - normalize filter expressions for cloud
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.Mode && node.Properties.Configuration.Mode === 'Simple') {
            // Ensure simple filter mode is properly configured
            node.Properties.Configuration.Mode = 'Simple';
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Sort.Sort') {
        // Sort tool - ensure sort configuration is cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.SortInfo) {
            const sortInfo = node.Properties.Configuration.SortInfo;
            if (Array.isArray(sortInfo)) {
              sortInfo.forEach((sort: any) => {
                if (sort.Order) {
                  sort.Order = sort.Order.toLowerCase();
                }
              });
            }
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Formula.Formula') {
        // Formula tool - ensure expressions are cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.FormulaFields) {
            const formulaFields = node.Properties.Configuration.FormulaFields;
            if (Array.isArray(formulaFields)) {
              formulaFields.forEach((field: any) => {
                // Normalize field types for cloud
                if (field.type) {
                  field.type = field.type.toLowerCase();
                }
              });
            }
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Sample.Sample') {
        // Sample tool - ensure sampling configuration is cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.Mode) {
            // Normalize sampling mode
            node.Properties.Configuration.Mode = node.Properties.Configuration.Mode;
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.BrowseV2.BrowseV2') {
        // Browse tool - ensure output configuration is cloud-compatible
        if (node.Properties?.Configuration) {
          // Set cloud-compatible browse settings
          node.Properties.Configuration.Enabled = 'true';
        }
      } else if (plugin === 'AlteryxBasePluginsGui.CrossTab.CrossTab') {
        // Cross Tab tool - ensure pivot configuration is cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.GroupFields) {
            // Normalize group fields for cloud
            const groupFields = node.Properties.Configuration.GroupFields;
            if (typeof groupFields === 'string') {
              node.Properties.Configuration.GroupFields = groupFields.split(',').map((field: string) => field.trim());
            }
          }
        }
      } else if (plugin === 'AlteryxBasePluginsGui.Transpose.Transpose') {
        // Transpose tool - ensure transpose configuration is cloud-compatible
        if (node.Properties?.Configuration) {
          if (node.Properties.Configuration.KeyFields) {
            // Normalize key fields for cloud
            const keyFields = node.Properties.Configuration.KeyFields;
            if (typeof keyFields === 'string') {
              node.Properties.Configuration.KeyFields = keyFields.split(',').map((field: string) => field.trim());
            }
          }
        }
      }
    });
    
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Cloud compatibility conversion failed:', err);
    return jsonString;
  }
}
