/**
 * Fixed converter logic for Formula and Summarize tools
 */

// Fix Formula tool type detection
export function fixFormulaField(formulaField: any): void {
  const expression = formulaField["@expression"] || "";
  const fieldName = formulaField["@field"] || "";
  
  // Check for string IF expressions (returns quoted strings)
  const stringIfPattern = /IF\s+.*\s+THEN\s+["'][^"']*["']\s+ELSE\s+["'][^"']*["']/i;
  if (stringIfPattern.test(expression)) {
    formulaField["@type"] = "V_String";
    formulaField["@size"] = "10";
    console.log(`✅ String IF: field="${fieldName}", type="V_String"`);
    return;
  }
  
  // Check for boolean expressions
  const booleanPatterns = [
    /\b(==|!=|<>|<=|>=|<|>)\b/,
    /\b(AND|OR|NOT)\b/i,
    /(&&|\|\|)/
  ];
  
  const isBooleanExpression = booleanPatterns.some(pattern => pattern.test(expression));
  
  if (isBooleanExpression) {
    formulaField["@type"] = "Bool";
    formulaField["@size"] = "1";
    if (!fieldName.endsWith("_check")) {
      formulaField["@field"] = `${fieldName}_check`;
    }
    console.log(`✅ Boolean: field="${formulaField["@field"]}", type="Bool"`);
  } else {
    formulaField["@type"] = "V_String";
    formulaField["@size"] = "254";
    console.log(`✅ Default: field="${fieldName}", type="V_String"`);
  }
}

// Fix Summarize tool field dropping
export function fixSummarizeFields(config: any, upstreamFields: any[]): void {
  if (!config.SummarizeFields?.SummarizeField) return;
  
  let summarizeFields = Array.isArray(config.SummarizeFields.SummarizeField)
    ? config.SummarizeFields.SummarizeField
    : [config.SummarizeFields.SummarizeField];
  
  // Get configured fields
  const configuredFields = new Set(summarizeFields.map((sf: any) => sf["@field"]));
  
  // Find missing fields
  const allUpstreamFields = upstreamFields.map(f => f["@name"]);
  const missingFields = allUpstreamFields.filter(fieldName => !configuredFields.has(fieldName));
  
  // Add missing fields as GroupBy
  missingFields.forEach(fieldName => {
    summarizeFields.push({
      "@field": fieldName,
      "@action": "GroupBy",
      "@rename": fieldName
    });
  });
  
  config.SummarizeFields.SummarizeField = summarizeFields;
  
  if (missingFields.length > 0) {
    console.log(`🔧 Added ${missingFields.length} missing fields: ${missingFields.join(', ')}`);
  }
}

// Generate complete Summarize output fields
export function generateSummarizeOutput(summarizeFields: any[], upstreamFields: any[]): any[] {
  const outputFields: any[] = [];
  
  summarizeFields.forEach(sf => {
    const field = sf["@field"];
    const action = sf["@action"];
    const rename = sf["@rename"] || field;
    
    if (action === "GroupBy") {
      const upstreamField = upstreamFields.find(f => f["@name"] === field);
      outputFields.push({
        "@name": rename,
        "@type": upstreamField?.["@type"] || "V_String",
        "@size": upstreamField?.["@size"] || "254",
        "@source": "Summarize_GroupBy"
      });
    } else {
      const aggType = getAggregationType(action);
      outputFields.push({
        "@name": rename,
        "@type": aggType.type,
        "@size": aggType.size,
        "@source": `Summarize_${action}`
      });
    }
  });
  
  return outputFields;
}

function getAggregationType(action: string): { type: string; size: string } {
  switch (action.toLowerCase()) {
    case "sum":
    case "avg":
      return { type: "Double", size: "8" };
    case "count":
    case "countdistinct":
      return { type: "Int64", size: "8" };
    default:
      return { type: "V_String", size: "254" };
  }
}