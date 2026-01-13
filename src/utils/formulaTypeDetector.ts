/**
 * Formula Type Detection and Field Management
 * Fixes Formula tool type mismatches and Summarize field dropping issues
 */

export interface FormulaFieldInfo {
  fieldName: string;
  fieldType: string;
  fieldSize: string;
  isNewField: boolean;
}

/**
 * Detects the correct output type for a formula expression
 */
export function detectFormulaOutputType(expression: string): { type: string; size: string } {
  if (!expression) {
    return { type: "V_String", size: "254" };
  }

  const cleanExpr = expression
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();

  // Check for string IF expressions (returns quoted strings)
  const stringIfPattern = /IF\s+.*\s+THEN\s+["'][^"']*["']\s+ELSE\s+["'][^"']*["']/i;
  if (stringIfPattern.test(cleanExpr)) {
    // Calculate max string length from the THEN/ELSE values
    const matches = cleanExpr.match(/["']([^"']*)["']/g);
    if (matches) {
      const maxLength = Math.max(...matches.map(m => m.length - 2)); // Remove quotes
      return { type: "V_String", size: Math.max(maxLength, 10).toString() };
    }
    return { type: "V_String", size: "10" };
  }

  // Check for numeric IF expressions
  const numericIfPattern = /IF\s+.*\s+THEN\s+\d+(\.\d+)?\s+ELSE\s+\d+(\.\d+)?/i;
  if (numericIfPattern.test(cleanExpr)) {
    return { type: "Double", size: "8" };
  }

  // Check for boolean expressions
  if (isBooleanExpression(cleanExpr)) {
    return { type: "Bool", size: "1" };
  }

  // Check for numeric expressions
  if (isNumericExpression(cleanExpr)) {
    return { type: "Double", size: "8" };
  }

  // Default to string
  return { type: "V_String", size: "254" };
}

/**
 * Checks if expression returns boolean
 */
function isBooleanExpression(expression: string): boolean {
  const booleanPatterns = [
    /\b(==|!=|<>|<=|>=|<|>)\b/,
    /\b(AND|OR|NOT)\b/i,
    /\b(IsNull|IsEmpty|Contains|StartsWith|EndsWith)\s*\(/i,
    /\b(REGEX_Match|IsInteger|IsNumeric)\s*\(/i,
    /(&&|\|\|)/
  ];

  return booleanPatterns.some(pattern => pattern.test(expression));
}

/**
 * Checks if expression returns numeric value
 */
function isNumericExpression(expression: string): boolean {
  const numericPatterns = [
    /\b(ToNumber|Round|Floor|Ceil|Abs|Sqrt)\s*\(/i,
    /\b(\+|\-|\*|\/|\%)\b/,
    /^\s*\d+(\.\d+)?\s*$/
  ];

  return numericPatterns.some(pattern => pattern.test(expression));
}

/**
 * Analyzes formula fields and returns corrected field information
 */
export function analyzeFormulaFields(formulaFields: any[]): FormulaFieldInfo[] {
  return formulaFields.map(ff => {
    const expression = ff["@expression"] || "";
    const originalFieldName = ff["@field"] || "";
    const detectedType = detectFormulaOutputType(expression);
    
    // Determine if this creates a new field or modifies existing
    const isNewField = !originalFieldName.includes("_") || 
                      expression.includes("IF") || 
                      expression.includes("THEN");

    return {
      fieldName: originalFieldName,
      fieldType: detectedType.type,
      fieldSize: detectedType.size,
      isNewField
    };
  });
}

/**
 * Fixes Summarize tool configuration to include all required fields
 */
export function fixSummarizeConfiguration(config: any, upstreamFields: any[]): void {
  if (!config.SummarizeFields?.SummarizeField) {
    return;
  }

  const summarizeFields = Array.isArray(config.SummarizeFields.SummarizeField)
    ? config.SummarizeFields.SummarizeField
    : [config.SummarizeFields.SummarizeField];

  // Get list of fields that should be preserved
  const configuredFields = new Set(summarizeFields.map((sf: any) => sf["@field"]));
  const allUpstreamFields = upstreamFields.map(f => f["@name"]);

  // Find missing fields that should be added as GroupBy
  const missingFields = allUpstreamFields.filter(fieldName => 
    !configuredFields.has(fieldName)
  );

  // Add missing fields as GroupBy to preserve them
  missingFields.forEach(fieldName => {
    summarizeFields.push({
      "@field": fieldName,
      "@action": "GroupBy",
      "@rename": fieldName
    });
  });

  // Update the configuration
  config.SummarizeFields.SummarizeField = summarizeFields;

  console.log(`🔧 Fixed Summarize: added ${missingFields.length} missing fields as GroupBy`);
  console.log(`   Missing fields: ${missingFields.join(', ')}`);
}

/**
 * Generates complete field list for Summarize output
 */
export function generateSummarizeOutputFields(summarizeFields: any[], upstreamFields: any[]): any[] {
  const outputFields: any[] = [];
  const processedFields = new Set<string>();

  summarizeFields.forEach(sf => {
    const fieldName = sf["@field"];
    const action = sf["@action"];
    const rename = sf["@rename"] || fieldName;

    if (!fieldName || processedFields.has(rename)) {
      return;
    }

    if (action === "GroupBy") {
      // GroupBy fields preserve original type
      const upstreamField = upstreamFields.find(f => f["@name"] === fieldName);
      outputFields.push({
        "@name": rename,
        "@type": upstreamField?.["@type"] || "V_String",
        "@size": upstreamField?.["@size"] || "254",
        "@source": "Summarize_GroupBy"
      });
    } else {
      // Aggregation fields get specific types
      const aggType = getAggregationOutputType(action);
      outputFields.push({
        "@name": rename,
        "@type": aggType.type,
        "@size": aggType.size,
        "@source": `Summarize_${action}`
      });
    }

    processedFields.add(rename);
  });

  return outputFields;
}

/**
 * Gets output type for aggregation functions
 */
function getAggregationOutputType(action: string): { type: string; size: string } {
  switch (action.toLowerCase()) {
    case "sum":
    case "avg":
    case "average":
      return { type: "Double", size: "8" };
    case "count":
    case "countdistinct":
    case "countnonnull":
      return { type: "Int64", size: "8" };
    case "min":
    case "max":
    case "first":
    case "last":
      return { type: "V_String", size: "254" }; // Safe default
    case "concat":
      return { type: "V_WString", size: "1073741823" };
    default:
      return { type: "V_String", size: "254" };
  }
}