/**
 * Summarize Tool Fix - Prevents field dropping
 */

export function fixSummarizeToolFieldDropping(node: any, upstreamFields: any[]): void {
  const config = node.Properties?.Configuration;
  if (!config?.SummarizeFields?.SummarizeField) return;

  let summarizeFields = Array.isArray(config.SummarizeFields.SummarizeField)
    ? config.SummarizeFields.SummarizeField
    : [config.SummarizeFields.SummarizeField];

  // Get configured fields
  const configuredFields = new Set(summarizeFields.map((sf: any) => sf["@field"]));
  
  // Find missing upstream fields
  const allUpstreamFields = upstreamFields.map(f => f["@name"]);
  const missingFields = allUpstreamFields.filter(fieldName => !configuredFields.has(fieldName));

  // Add missing fields as GroupBy to prevent dropping
  if (missingFields.length > 0) {
    console.log(`🔧 FIXING Summarize: Adding ${missingFields.length} missing fields as GroupBy`);
    
    missingFields.forEach(fieldName => {
      summarizeFields.push({
        "@field": fieldName,
        "@action": "GroupBy",
        "@rename": fieldName
      });
    });

    // Update configuration
    config.SummarizeFields.SummarizeField = summarizeFields;
  }

  // Generate complete output metadata
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
      outputFields.push({
        "@name": rename,
        "@type": getAggType(action),
        "@size": getAggSize(action),
        "@source": `Summarize_${action}`
      });
    }
  });

  // Update MetaInfo
  node.Properties.MetaInfo = {
    "@connection": "Output",
    "RecordInfo": {
      "Field": outputFields
    }
  };

  console.log(`✅ Fixed Summarize: ${outputFields.length} fields preserved`);
}

function getAggType(action: string): string {
  switch (action.toLowerCase()) {
    case "sum":
    case "avg":
      return "Double";
    case "count":
    case "countdistinct":
      return "Int64";
    default:
      return "V_String";
  }
}

function getAggSize(action: string): string {
  switch (action.toLowerCase()) {
    case "sum":
    case "avg":
    case "count":
    case "countdistinct":
      return "8";
    default:
      return "254";
  }
}