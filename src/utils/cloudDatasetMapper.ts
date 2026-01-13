// Map real Cloud datasets for proper icon display
export interface CloudDataset {
  name: string;
  datasetId: string;
  uri: string;
}

// Real datasets from your Cloud (update these with actual values)
export const CLOUD_DATASETS: CloudDataset[] = [
  {
    name: "empdata.csv",
    datasetId: "560409", 
    uri: "tfs://trinitetech-alteryx-trial-lhsa/empdata.csv"
  },
  {
    name: "test2.csv", 
    datasetId: "204000",
    uri: "tfs://trinitetech-alteryx-trial-lhsa/test2.csv"
  },
  {
    name: "test.csv",
    datasetId: "201426", 
    uri: "tfs://trinitetech-alteryx-trial-lhsa/test.csv"
  }
];

export function getCloudDataset(filename: string): CloudDataset {
  const found = CLOUD_DATASETS.find(ds => 
    ds.name.toLowerCase() === filename.toLowerCase() ||
    ds.name.includes(filename) ||
    filename.includes(ds.name.replace('.csv', ''))
  );
  
  if (found) {
    console.log(`✅ Found Cloud dataset: ${filename} -> ${found.datasetId}`);
    return found;
  }
  
  // Default fallback to empdata.csv
  console.log(`⚠️  Using default dataset for: ${filename}`);
  return CLOUD_DATASETS[0];
}

export function generateOutputDataset(inputDataset: CloudDataset): CloudDataset {
  return {
    name: "output.csv",
    datasetId: (parseInt(inputDataset.datasetId) + 1).toString(),
    uri: inputDataset.uri.replace(inputDataset.name, "output.csv")
  };
}