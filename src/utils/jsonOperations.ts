// JSON data operations for converted XML
export interface JsonData {
  [key: string]: any;
}

// SELECT: Filter specific fields from JSON
export function selectFields(data: JsonData, fields: string[]): JsonData {
  const result: JsonData = {};
  fields.forEach(field => {
    if (field in data) {
      result[field] = data[field];
    }
  });
  return result;
}

// JOIN: Merge two JSON objects
export function joinJson(
  left: JsonData,
  right: JsonData,
  leftKey: string,
  rightKey: string,
  joinType: 'inner' | 'left' | 'right' = 'inner'
): JsonData {
  const result: JsonData = { ...left };
  
  if (joinType === 'inner' || joinType === 'left') {
    Object.keys(right).forEach(key => {
      if (key !== rightKey) {
        result[key] = right[key];
      }
    });
  }
  
  return result;
}

// UNION: Combine multiple JSON objects
export function unionJson(datasets: JsonData[]): JsonData {
  return datasets.reduce((acc, curr) => ({ ...acc, ...curr }), {});
}
