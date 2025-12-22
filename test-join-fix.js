const fs = require('fs');

// Test XML with Join tool configuration issue
const testJoinXML = `<?xml version="1.0"?>
<AlteryxDocument yxmdVer="2025.1">
  <Nodes>
    <Node ToolID="10">
      <GuiSettings Plugin="AlteryxBasePluginsGui.Join.Join">
        <Position x="696" y="330" />
      </GuiSettings>
      <Properties>
        <Configuration>
          <JoinByRecordPos value="False" />
          <SelectConfiguration>
            <Configuration type="Auto" name="" />
          </SelectConfiguration>
        </Configuration>
        <Annotation DisplayMode="0">
          <Name />
          <DefaultAnnotationText />
          <Left value="False" />
        </Annotation>
      </Properties>
    </Node>
  </Nodes>
  <Connections>
    <Connection name="">
      <Origin ToolID="3" Connection="Output" />
      <Destination ToolID="10" Connection="Left" />
    </Connection>
    <Connection name="">
      <Origin ToolID="4" Connection="Output" />
      <Destination ToolID="10" Connection="Right" />
    </Connection>
  </Connections>
</AlteryxDocument>`;

// Import the converter functions
const { parseAlteryxWorkflow, convertWorkflowToCloud } = require('./src/utils/workflowConverter.ts');

try {
  console.log('🔧 Testing Join Tool Configuration Fix...\n');
  
  // Test the conversion
  const result = convertWorkflowToCloud(testJoinXML);
  
  console.log('✅ Conversion successful!');
  console.log('📊 Report:', JSON.stringify(result.report, null, 2));
  
  // Check if Join tool configuration is properly structured
  const workflow = JSON.parse(result.json);
  const joinNode = workflow.content.Nodes.Node.find(node => 
    node.GuiSettings['@Plugin'].includes('Join')
  );
  
  if (joinNode) {
    console.log('\n🔍 Join Tool Configuration:');
    console.log(JSON.stringify(joinNode.Properties.Configuration, null, 2));
    
    const config = joinNode.Properties.Configuration;
    
    // Verify required structures exist
    const checks = [
      { name: 'JoinInfo exists', pass: !!config.JoinInfo },
      { name: 'SelectConfiguration exists', pass: !!config.SelectConfiguration },
      { name: 'Equality exists', pass: !!config.Equality },
      { name: 'JoinByRecordPos exists', pass: !!config.JoinByRecordPos }
    ];
    
    console.log('\n✅ Configuration Validation:');
    checks.forEach(check => {
      console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
    });
    
    if (checks.every(check => check.pass)) {
      console.log('\n🎉 Join tool configuration is properly structured!');
    } else {
      console.log('\n⚠️  Some configuration elements are missing');
    }
  }
  
  // Write the fixed JSON to file
  fs.writeFileSync('test-join-fixed.json', result.json);
  console.log('\n📁 Fixed workflow saved to: test-join-fixed.json');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
}