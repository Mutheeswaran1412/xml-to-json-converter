// Test the updated converter
import fs from 'fs';

// Read the sample workflow
const xmlContent = fs.readFileSync('./src/data/sample-workflow.yxmd', 'utf8');

// Simple XML parser for testing
function parseAlteryxWorkflow(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const workflow = {
    Nodes: [],
    Properties: {},
    Connections: []
  };

  // Extract nodes with tool details and metadata
  const nodes = xmlDoc.querySelectorAll('Node');
  nodes.forEach(nodeElement => {
    const guiSettings = nodeElement.querySelector('GuiSettings');
    const properties = nodeElement.querySelector('Properties');
    const engineSettings = nodeElement.querySelector('EngineSettings');
    
    const node = {
      toolId: nodeElement.getAttribute('ToolID') || '',
      toolName: guiSettings?.getAttribute('Plugin')?.split('.').pop() || 'Unknown',
      plugin: guiSettings?.getAttribute('Plugin') || '',
      position: {
        x: parseInt(guiSettings?.getAttribute('X') || '0'),
        y: parseInt(guiSettings?.getAttribute('Y') || '0')
      },
      metadata: {
        configuration: {}
      }
    };

    // Extract configuration from Properties
    if (properties) {
      const config = {};
      const configuration = properties.querySelector('Configuration');
      if (configuration) {
        Array.from(configuration.children).forEach(child => {
          config[child.tagName] = parseElement(child);
        });
      }
      
      // Extract annotation
      const annotation = properties.querySelector('Annotation');
      if (annotation) {
        node.metadata.annotation = parseElement(annotation);
      }
      
      // Extract metaInfo
      const metaInfo = properties.querySelector('MetaInfo');
      if (metaInfo) {
        node.metadata.metaInfo = parseElement(metaInfo);
      }
      
      node.metadata.configuration = config;
    }

    // Extract engine settings
    if (engineSettings) {
      const settings = {};
      Array.from(engineSettings.attributes).forEach(attr => {
        settings[attr.name] = attr.value;
      });
      node.metadata.engineSettings = settings;
    }

    workflow.Nodes.push(node);
  });

  // Extract connections
  const connections = xmlDoc.querySelectorAll('Connection');
  connections.forEach(connElement => {
    const origin = connElement.querySelector('Origin');
    const destination = connElement.querySelector('Destination');
    
    if (origin && destination) {
      const connection = {
        origin: {
          toolId: origin.getAttribute('ToolID') || '',
          connection: origin.getAttribute('Connection') || ''
        },
        destination: {
          toolId: destination.getAttribute('ToolID') || '',
          connection: destination.getAttribute('Connection') || ''
        }
      };
      workflow.Connections.push(connection);
    }
  });

  // Extract workflow properties
  const workflowProps = xmlDoc.querySelector('Properties');
  if (workflowProps) {
    workflow.Properties = parseElement(workflowProps);
  }

  return workflow;
}

function parseElement(element) {
  const result = {};
  
  // Add attributes
  if (element.attributes.length > 0) {
    Array.from(element.attributes).forEach(attr => {
      result[`@${attr.name}`] = attr.value;
    });
  }
  
  // Add child elements
  if (element.children.length > 0) {
    Array.from(element.children).forEach(child => {
      const childValue = parseElement(child);
      if (result[child.tagName]) {
        if (!Array.isArray(result[child.tagName])) {
          result[child.tagName] = [result[child.tagName]];
        }
        result[child.tagName].push(childValue);
      } else {
        result[child.tagName] = childValue;
      }
    });
  }
  
  // Add text content if no children
  if (element.children.length === 0 && element.textContent?.trim()) {
    if (Object.keys(result).length === 0) {
      return element.textContent.trim();
    }
    result['#text'] = element.textContent.trim();
  }
  
  return Object.keys(result).length === 0 ? null : result;
}

// Test with Node.js DOMParser
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;

const result = parseAlteryxWorkflow(xmlContent);
console.log('New JSON Structure:');
console.log(JSON.stringify(result, null, 2));