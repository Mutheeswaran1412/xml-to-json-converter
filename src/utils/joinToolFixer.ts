/**
 * Join Tool Configuration Fixer
 * Fixes the "We can't load the tool's configuration" error for Join tools
 */

export interface JoinFieldConfig {
  '@field': string;
  '@type'?: string;
}

export interface JoinConfiguration {
  JoinByRecordPos?: { '@value': string };
  JoinInfo?: {
    '@connection': string;
    JoinField?: JoinFieldConfig[];
  };
  SelectConfiguration?: {
    Configuration?: {
      '@type': string;
      '@name': string;
    };
  };
  Equality?: {
    Left?: string;
    Right?: string;
  };
}

/**
 * Fix corrupted Join tool configuration
 */
export function fixJoinToolConfiguration(config: any): JoinConfiguration {
  const fixed: JoinConfiguration = {};
  
  // 1. Fix JoinByRecordPos
  if (config.JoinByRecordPos) {
    if (typeof config.JoinByRecordPos === 'object' && config.JoinByRecordPos['@value']) {
      fixed.JoinByRecordPos = config.JoinByRecordPos;
    } else if (typeof config.JoinByRecordPos === 'string') {
      fixed.JoinByRecordPos = { '@value': config.JoinByRecordPos };
    } else {
      fixed.JoinByRecordPos = { '@value': 'False' };
    }
  } else {
    fixed.JoinByRecordPos = { '@value': 'False' };
  }
  
  // 2. Fix JoinInfo structure
  if (config.JoinInfo) {
    fixed.JoinInfo = {
      '@connection': config.JoinInfo['@connection'] || 'Left',
      JoinField: []
    };
    
    // Handle JoinField array
    if (config.JoinInfo.JoinField) {
      if (Array.isArray(config.JoinInfo.JoinField)) {
        fixed.JoinInfo.JoinField = config.JoinInfo.JoinField.map((field: any) => ({
          '@field': field['@field'] || field.field || '',
          '@type': field['@type'] || 'String'
        }));
      } else {
        fixed.JoinInfo.JoinField = [{
          '@field': config.JoinInfo.JoinField['@field'] || config.JoinInfo.JoinField.field || '',
          '@type': config.JoinInfo.JoinField['@type'] || 'String'
        }];
      }
    }
  } else {
    // Create default JoinInfo if missing
    fixed.JoinInfo = {
      '@connection': 'Left',
      JoinField: []
    };
  }
  
  // 3. Fix SelectConfiguration
  if (config.SelectConfiguration) {
    fixed.SelectConfiguration = {
      Configuration: {
        '@type': config.SelectConfiguration.Configuration?.['@type'] || 'Auto',
        '@name': config.SelectConfiguration.Configuration?.['@name'] || ''
      }
    };
  } else {
    fixed.SelectConfiguration = {
      Configuration: {
        '@type': 'Auto',
        '@name': ''
      }
    };
  }
  
  // 4. Fix Equality (join conditions)
  if (config.Equality) {
    fixed.Equality = {
      Left: config.Equality.Left || '',
      Right: config.Equality.Right || ''
    };
  } else {
    fixed.Equality = {
      Left: '',
      Right: ''
    };
  }
  
  return fixed;
}

/**
 * Validate Join tool configuration
 */
export function validateJoinConfiguration(config: JoinConfiguration): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required structures
  if (!config.JoinByRecordPos) {
    errors.push('Missing JoinByRecordPos configuration');
  }
  
  if (!config.JoinInfo) {
    errors.push('Missing JoinInfo configuration');
  } else {
    if (!config.JoinInfo['@connection']) {
      errors.push('Missing connection type in JoinInfo');
    }
    
    if (!config.JoinInfo.JoinField || config.JoinInfo.JoinField.length === 0) {
      warnings.push('No join fields specified - tool may need manual configuration');
    }
  }
  
  if (!config.SelectConfiguration) {
    errors.push('Missing SelectConfiguration');
  }
  
  if (!config.Equality) {
    warnings.push('Missing Equality configuration - join conditions may need to be set');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate a complete Join tool configuration template
 */
export function generateJoinToolTemplate(): JoinConfiguration {
  return {
    JoinByRecordPos: { '@value': 'False' },
    JoinInfo: {
      '@connection': 'Left',
      JoinField: []
    },
    SelectConfiguration: {
      Configuration: {
        '@type': 'Auto',
        '@name': ''
      }
    },
    Equality: {
      Left: '',
      Right: ''
    }
  };
}

/**
 * Main function to fix Join tool in workflow
 */
export function repairJoinToolInWorkflow(xmlString: string): {
  fixedXml: string;
  report: {
    joinToolsFound: number;
    joinToolsFixed: number;
    issues: Array<{
      toolId: string;
      issue: string;
      fixed: boolean;
    }>;
  };
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const report = {
    joinToolsFound: 0,
    joinToolsFixed: 0,
    issues: [] as Array<{
      toolId: string;
      issue: string;
      fixed: boolean;
    }>
  };
  
  // Find all Join tools
  const nodes = doc.querySelectorAll('Node');
  
  nodes.forEach(node => {
    const guiSettings = node.querySelector('GuiSettings');
    const plugin = guiSettings?.getAttribute('Plugin') || '';
    
    if (plugin.includes('Join')) {
      report.joinToolsFound++;
      const toolId = node.getAttribute('ToolID') || 'unknown';
      
      try {
        const properties = node.querySelector('Properties');
        const configuration = properties?.querySelector('Configuration');
        
        if (configuration) {
          // Parse current configuration
          const currentConfig = parseConfigurationElement(configuration);
          
          // Validate current configuration
          const validation = validateJoinConfiguration(currentConfig);
          
          if (!validation.isValid || validation.warnings.length > 0) {
            // Fix the configuration
            const fixedConfig = fixJoinToolConfiguration(currentConfig);
            
            // Replace the configuration in the DOM
            replaceConfigurationInDOM(configuration, fixedConfig);
            
            report.joinToolsFixed++;
            report.issues.push({
              toolId,
              issue: validation.errors.concat(validation.warnings).join(', '),
              fixed: true
            });
          }
        } else {
          // No configuration found, create one
          const newConfig = generateJoinToolTemplate();
          const configElement = doc.createElement('Configuration');
          
          // Add the new configuration to Properties
          const props = node.querySelector('Properties') || doc.createElement('Properties');
          props.appendChild(configElement);
          if (!node.querySelector('Properties')) {
            node.appendChild(props);
          }
          
          replaceConfigurationInDOM(configElement, newConfig);
          
          report.joinToolsFixed++;
          report.issues.push({
            toolId,
            issue: 'Missing configuration',
            fixed: true
          });
        }
      } catch (error) {
        report.issues.push({
          toolId,
          issue: `Failed to fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fixed: false
        });
      }
    }
  });
  
  const fixedXml = new XMLSerializer().serializeToString(doc);
  
  return {
    fixedXml,
    report
  };
}

/**
 * Helper: Parse configuration element to object
 */
function parseConfigurationElement(element: Element): any {
  const result: any = {};
  
  // Add attributes
  Array.from(element.attributes).forEach(attr => {
    result[`@${attr.name}`] = attr.value;
  });
  
  // Add child elements
  Array.from(element.children).forEach(child => {
    const key = child.tagName;
    const value = parseConfigurationElement(child);
    
    if (result[key]) {
      if (!Array.isArray(result[key])) {
        result[key] = [result[key]];
      }
      result[key].push(value);
    } else {
      result[key] = value;
    }
  });
  
  // Add text content if no children
  if (element.children.length === 0 && element.textContent?.trim()) {
    if (Object.keys(result).length === 0) {
      return element.textContent.trim();
    }
    result['#text'] = element.textContent.trim();
  }
  
  return Object.keys(result).length === 0 ? null : result;
}

/**
 * Helper: Replace configuration in DOM
 */
function replaceConfigurationInDOM(configElement: Element, config: JoinConfiguration): void {
  // Clear existing content
  configElement.innerHTML = '';
  
  // Add JoinByRecordPos
  if (config.JoinByRecordPos) {
    const joinByRecordPos = document.createElement('JoinByRecordPos');
    joinByRecordPos.setAttribute('value', config.JoinByRecordPos['@value']);
    configElement.appendChild(joinByRecordPos);
  }
  
  // Add JoinInfo
  if (config.JoinInfo) {
    const joinInfo = document.createElement('JoinInfo');
    joinInfo.setAttribute('connection', config.JoinInfo['@connection']);
    
    if (config.JoinInfo.JoinField) {
      config.JoinInfo.JoinField.forEach(field => {
        const joinField = document.createElement('JoinField');
        joinField.setAttribute('field', field['@field']);
        if (field['@type']) {
          joinField.setAttribute('type', field['@type']);
        }
        joinInfo.appendChild(joinField);
      });
    }
    
    configElement.appendChild(joinInfo);
  }
  
  // Add SelectConfiguration
  if (config.SelectConfiguration) {
    const selectConfig = document.createElement('SelectConfiguration');
    const configuration = document.createElement('Configuration');
    
    if (config.SelectConfiguration.Configuration) {
      configuration.setAttribute('type', config.SelectConfiguration.Configuration['@type']);
      configuration.setAttribute('name', config.SelectConfiguration.Configuration['@name']);
    }
    
    selectConfig.appendChild(configuration);
    configElement.appendChild(selectConfig);
  }
  
  // Add Equality
  if (config.Equality) {
    const equality = document.createElement('Equality');
    
    if (config.Equality.Left) {
      const left = document.createElement('Left');
      left.textContent = config.Equality.Left;
      equality.appendChild(left);
    }
    
    if (config.Equality.Right) {
      const right = document.createElement('Right');
      right.textContent = config.Equality.Right;
      equality.appendChild(right);
    }
    
    configElement.appendChild(equality);
  }
}