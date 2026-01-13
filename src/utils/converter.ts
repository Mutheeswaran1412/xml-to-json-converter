import { convertXmlToJson as baseConvert, detectFileType as baseDetect } from './xmlToJsonConverter';
import { parseAlteryxWorkflow } from './workflowConverter';
import { repairJoinToolInWorkflow } from './joinToolFixer';

export function detectWorkflowType(content: string): 'yxmd' | 'generic' {
  if (content.includes('AlteryxDocument') || content.includes('yxmdVer')) {
    return 'yxmd';
  }
  return 'generic';
}

export async function convertWorkflowXmlToJson(
  xmlString: string, 
  options?: { 
    preserveAttributes?: boolean; 
    outputFormat?: string;
    filterParams?: {
      excludeNodes?: string[];
      includeOnlyNodes?: string[];
      removeAttributes?: string[];
    };
    fixJoinTools?: boolean;
  }
): Promise<string> {
  let processedXml = xmlString;
  
  // Fix Join tool configurations if requested (default: true for yxmd files)
  const isYxmd = detectWorkflowType(xmlString) === 'yxmd';
  if ((options?.fixJoinTools !== false) && isYxmd) {
    try {
      const joinFixResult = repairJoinToolInWorkflow(processedXml);
      processedXml = joinFixResult.fixedXml;
      
      // Log join tool fixes
      if (joinFixResult.report.joinToolsFixed > 0) {
        console.log(`🔧 Fixed ${joinFixResult.report.joinToolsFixed} Join tool(s)`);
        joinFixResult.report.issues.forEach(issue => {
          if (issue.fixed) {
            console.log(`  ✅ Tool ${issue.toolId}: ${issue.issue}`);
          } else {
            console.log(`  ❌ Tool ${issue.toolId}: ${issue.issue}`);
          }
        });
      }
    } catch (error) {
      console.warn('Join tool repair failed:', error);
      // Continue with original XML if repair fails
    }
  }
  
  // Apply filtering if parameters provided
  if (options?.filterParams) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedXml, 'text/xml');
    
    // Exclude specific nodes
    if (options.filterParams.excludeNodes?.length) {
      options.filterParams.excludeNodes.forEach(nodeName => {
        const nodes = doc.getElementsByTagName(nodeName);
        Array.from(nodes).forEach(node => node.remove());
      });
    }
    
    // Remove specific attributes
    if (options.filterParams.removeAttributes?.length) {
      const allElements = doc.getElementsByTagName('*');
      Array.from(allElements).forEach(element => {
        options.filterParams!.removeAttributes!.forEach(attrName => {
          element.removeAttribute(attrName.replace('@', ''));
        });
      });
    }
    
    processedXml = new XMLSerializer().serializeToString(doc);
  }
  
  return baseConvert(processedXml);
}

export function validateXmlSyntax(xml: string): Array<{line: number, message: string}> {
  const errors: Array<{line: number, message: string}> = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parserError = doc.querySelector('parsererror');
    
    if (parserError) {
      errors.push({
        line: 1,
        message: parserError.textContent || 'XML parsing error'
      });
    }
  } catch (error) {
    errors.push({
      line: 1,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  return errors;
}