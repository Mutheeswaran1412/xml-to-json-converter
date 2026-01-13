import { useState } from 'react';
import { Upload, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DatasetUploaderProps {
  xmlContent: string;
  filename: string;
  onDatasetCreated: (datasetInfo: any) => void;
}

export function DatasetUploader({ xmlContent, filename, onDatasetCreated }: DatasetUploaderProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [datasetId, setDatasetId] = useState('');

  const uploadAsDataset = async () => {
    if (!user || !xmlContent) return;

    setIsUploading(true);
    setUploadStatus('idle');

    try {
      // Generate dataset info
      const timestamp = Date.now();
      const datasetInfo = {
        id: `DS_${timestamp}`,
        name: filename.replace(/\.(xml|yxmd)$/i, ''),
        source: 'Alteryx Data Storage',
        owner: user.email,
        location: `tfs://trinitetech-alteryx-trial-lhsa/110911/${filename}`,
        createdOn: new Date().toISOString(),
        lastRefresh: new Date().toISOString(),
        rows: extractRowCount(xmlContent),
        fields: extractFields(xmlContent),
        type: detectDataType(xmlContent)
      };

      // Store in localStorage (simulating cloud storage)
      const existingDatasets = JSON.parse(localStorage.getItem('alteryx_datasets') || '[]');
      existingDatasets.push(datasetInfo);
      localStorage.setItem('alteryx_datasets', JSON.stringify(existingDatasets));

      // Store the actual XML content
      const datasetContent = {
        datasetId: datasetInfo.id,
        content: xmlContent,
        metadata: datasetInfo
      };
      
      const existingContent = JSON.parse(localStorage.getItem('dataset_content') || '[]');
      existingContent.push(datasetContent);
      localStorage.setItem('dataset_content', JSON.stringify(existingContent));

      setDatasetId(datasetInfo.id);
      setUploadStatus('success');
      onDatasetCreated(datasetInfo);

    } catch (error) {
      console.error('Dataset upload failed:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const extractRowCount = (xml: string): number => {
    // Simple row count estimation from XML
    const matches = xml.match(/<Row>/g);
    return matches ? matches.length : 0;
  };

  const extractFields = (xml: string): any[] => {
    // Extract field information from XML
    const fields = [];
    const fieldMatches = xml.match(/<Field[^>]*name="([^"]*)"[^>]*type="([^"]*)"[^>]*>/g);
    
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const nameMatch = match.match(/name="([^"]*)"/);
        const typeMatch = match.match(/type="([^"]*)"/);
        
        if (nameMatch && typeMatch) {
          fields.push({
            name: nameMatch[1],
            type: mapAlteryxType(typeMatch[1])
          });
        }
      });
    }

    return fields;
  };

  const mapAlteryxType = (alteryxType: string): string => {
    const typeMap: { [key: string]: string } = {
      'V_WString': 'String',
      'Int32': 'Integer',
      'Double': 'Number',
      'Bool': 'Boolean',
      'Date': 'Date',
      'DateTime': 'Datetime'
    };
    return typeMap[alteryxType] || 'String';
  };

  const detectDataType = (xml: string): string => {
    if (xml.includes('empid') || xml.includes('employee')) return 'Employee Data';
    if (xml.includes('customer') || xml.includes('order')) return 'Customer Data';
    return 'General Data';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-5 h-5 text-blue-600" />
        <h3 className="font-medium text-gray-900">Upload as Dataset</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Store this XML file as a dataset in Alteryx Cloud for easy access in workflows.
      </p>

      {uploadStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md mb-4">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">
            Dataset created successfully! ID: {datasetId}
          </span>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">
            Failed to create dataset. Please try again.
          </span>
        </div>
      )}

      <button
        onClick={uploadAsDataset}
        disabled={isUploading || !user || !xmlContent}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-4 h-4" />
        {isUploading ? 'Creating Dataset...' : 'Create Dataset'}
      </button>

      {!user && (
        <p className="text-xs text-gray-500 mt-2">
          Please sign in to create datasets
        </p>
      )}
    </div>
  );
}