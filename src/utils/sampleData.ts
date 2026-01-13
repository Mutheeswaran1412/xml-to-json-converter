export const sampleXmlData = `<?xml version="1.0" encoding="UTF-8"?>
<workflow>
  <metadata>
    <name>Sample Data Processing Workflow</name>
    <version>1.0</version>
    <description>A sample workflow for data processing</description>
  </metadata>
  <tools>
    <tool id="1" type="Input">
      <configuration>
        <file>data/input.csv</file>
        <format>CSV</format>
      </configuration>
    </tool>
    <tool id="2" type="Filter">
      <configuration>
        <condition>Amount > 1000</condition>
      </configuration>
    </tool>
    <tool id="3" type="Output">
      <configuration>
        <file>data/output.csv</file>
        <format>CSV</format>
      </configuration>
    </tool>
  </tools>
  <connections>
    <connection from="1" to="2" />
    <connection from="2" to="3" />
  </connections>
</workflow>`;

export const sampleDatasets = [
  {
    id: '1',
    name: 'Customer Data',
    datasetId: 'CUST_001',
    path: '/data/customers/customer_data.csv'
  },
  {
    id: '2',
    name: 'Transaction Records',
    datasetId: 'TXN_002',
    path: '/data/transactions/txn_records.csv'
  },
  {
    id: '3',
    name: 'Product Catalog',
    datasetId: 'PROD_003',
    path: '/data/products/product_catalog.json'
  }
];

export const sampleWorkflowName = 'Data Processing Pipeline Demo';