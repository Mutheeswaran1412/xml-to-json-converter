// Diagnostic test to find the exact issue with Select and Join tools

// Import converter function (update path as needed)
// import { convertXmlToJson } from './src/utils/xmlToJsonConverter.js';

// Test Select tool XML
const selectToolXML = `<?xml version="1.0"?>
<AlteryxDocument yxmdVer="2025.1">
  <Nodes>
    <Node ToolID="8">
      <GuiSettings Plugin="AlteryxBasePluginsGui.AlteryxSelect.AlteryxSelect">
        <Position x="318" y="126" />
      </GuiSettings>
      <Properties>
        <Configuration>
          <OrderChanged value="False" />
          <CommaDecimal value="False" />
          <SelectFields>
            <SelectField field="csvempid" selected="True" />
            <SelectField field="emp_name" selected="True" type="V_String" size="50" />
            <SelectField field="*Unknown" selected="True" />
          </SelectFields>
        </Configuration>
      </Properties>
    </Node>
  </Nodes>
</AlteryxDocument>`;

// Test Join tool XML
const joinToolXML = `<?xml version="1.0"?>
<AlteryxDocument yxmdVer="2025.1">
  <Nodes>
    <Node ToolID="12">
      <GuiSettings Plugin="AlteryxBasePluginsGui.Join.Join">
        <Position x="594" y="246" />
      </GuiSettings>
      <Properties>
        <Configuration>
          <JoinByRecordPos value="False" />
          <JoinInfo connection="Left">
            <JoinField field="dept_id" />
          </JoinInfo>
          <SelectConfiguration>
            <Configuration type="Auto" name="" />
          </SelectConfiguration>
        </Configuration>
      </Properties>
    </Node>
  </Nodes>
</AlteryxDocument>`;

console.log("🧪 DIAGNOSTIC TEST - Select Tool");
console.log("================================");

try {
  const selectResult = convertXmlToJson(selectToolXML);
  const selectParsed = JSON.parse(selectResult);
  
  const selectNode = selectParsed.content.Nodes.Node[0];
  console.log("Select Tool Configuration:");
  console.log(JSON.stringify(selectNode.Properties.Configuration, null, 2));
  
  console.log("\nSelect Tool SelectFields:");
  console.log(JSON.stringify(selectNode.Properties.Configuration.SelectFields, null, 2));
  
} catch (error) {
  console.error("Select tool conversion failed:", error.message);
}

console.log("\n🧪 DIAGNOSTIC TEST - Join Tool");
console.log("==============================");

try {
  const joinResult = convertXmlToJson(joinToolXML);
  const joinParsed = JSON.parse(joinResult);
  
  const joinNode = joinParsed.content.Nodes.Node[0];
  console.log("Join Tool Configuration:");
  console.log(JSON.stringify(joinNode.Properties.Configuration, null, 2));
  
} catch (error) {
  console.error("Join tool conversion failed:", error.message);
}

console.log("\n🔍 ANALYSIS COMPLETE");