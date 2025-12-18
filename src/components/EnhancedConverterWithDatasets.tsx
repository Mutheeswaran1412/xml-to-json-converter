import { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Download, AlertCircle, CheckCircle2, Loader2, Eye, FileText, TreePine, Workflow, Database, FolderOpen } from 'lucide-react';
import { JsonViewer } from './JsonViewer';
import { DatasetManager, Dataset } from './DatasetManager';
import { ValidationSummary } from './ValidationSummary';
import { DatasetUploader } from './DatasetUploader';
import { convertXmlToJson, detectFileType } from '../utils/xmlToJsonConverter';
import { makeCloudCompatible } from '../utils/cloudCompatible';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { sampleXmlData, sampleDatasets, sampleWorkflowName } from '../utils/sampleData';
import { tokenManager } from '../utils/tokenManager';

interface EnhancedConverterWithDatasetsProps {
  onConvert: (xmlInput: string, result: string, conversionTime: number, fileType: string, filename?: string) => void;
}

export function EnhancedConverterWithDatasets({ onConvert }: EnhancedConverterWithDatasetsProps) {
  const { user } = useAuth();
  const [xmlInput, setXmlInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [fileType, setFileType] = useState<'xml' | 'json' | 'unknown' | null>(null);
  const [customFilename, setCustomFilename] = useState('');
  const [showTreeView, setShowTreeView] = useState(false);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'expired' | 'missing'>('missing');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [convertedFiles, setConvertedFiles] = useState<Set<string>>(new Set());
  const [showDatasetUploader, setShowDatasetUploader] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();

  useEffect(() => {
    checkTokenStatus();
    if (user) {
      loadUploadedFiles();
      loadSavedWorkflows();
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadUploadedFiles();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const loadUploadedFiles = () => {
    try {
      const files = JSON.parse(localStorage.getItem('file_storage') || '[]');
      const userId = user?.id || 'guest';
      const userInputFiles = files.filter((f: any) => f.file_type === 'input' && f.user_id === userId);
      setUploadedFiles(userInputFiles);
    } catch (err) {
      console.error('Error loading files:', err);
      setUploadedFiles([]);
    }
  };

  const loadSavedWorkflows = () => {
    try {
      const workflows = JSON.parse(localStorage.getItem('saved_workflows') || '[]');
      const userId = user?.id || 'guest';
      const userWorkflows = workflows.filter((w: any) => w.user_id === userId);
      setSavedWorkflows(userWorkflows);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setSavedWorkflows([]);
    }
  };

  const generateDatasetInfo = (filename: string) => {
    const datasetId = `DS_${Date.now()}`;
    const cloudPath = `/cloud/datasets/${datasetId}/${filename}`;
    return { datasetId, cloudPath };
  };

  const selectFileFromStorage = (file: any) => {
    setSelectedFile(file);
    setXmlInput(file.content);
    setCustomFilename(file.filename.replace(/\.(xml|yxmd)$/i, ''));
    
    // Auto-generate dataset info
    const { datasetId, cloudPath } = generateDatasetInfo(file.filename);
    const newDataset: Dataset = {
      id: Date.now().toString(),
      name: file.filename.replace(/\.(xml|yxmd)$/i, ''),
      datasetId,
      path: cloudPath
    };
    setDatasets([newDataset]);
    setError('');
  };

  const checkTokenStatus = async () => {
    if (!tokenManager.hasTokens()) {
      setTokenStatus('missing');
      return;
    }
    
    const validToken = await tokenManager.getValidAccessToken();
    setTokenStatus(validToken ? 'valid' : 'expired');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setXmlInput(content);
        setCustomFilename(file.name.replace(/\.(xml|yxmd)$/i, ''));
        setError('');
        
        // Save to storage immediately
        try {
          const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
          const userId = user?.id || 'guest';
          const fileId = `${Date.now()}_${file.name}`;
          
          existingFiles.push({
            _id: fileId,
            user_id: userId,
            filename: file.name,
            location: `trinity-dataset/${file.name}`,
            file_type: 'input',
            content,
            file_size: file.size,
            mime_type: file.type || 'text/xml',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('file_storage', JSON.stringify(existingFiles));
          setTimeout(() => loadUploadedFiles(), 100);
        } catch (err) {
          console.error('Failed to save file to storage:', err);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const validateInputs = (): boolean => {
    if (!xmlInput.trim()) {
      setError('Please enter XML content to convert');
      return false;
    }

    if (!workflowName.trim()) {
      setError('Please enter a workflow name');
      return false;
    }

    if (datasets.length === 0) {
      setError('Please add at least one dataset');
      return false;
    }

    for (const dataset of datasets) {
      if (!dataset.name.trim() || !dataset.datasetId.trim() || !dataset.path.trim()) {
        setError('All dataset fields (name, ID, path) are required');
        return false;
      }
    }

    return true;
  };

  const enhanceJsonWithDatasets = (originalJson: string): string => {
    try {
      const parsed = JSON.parse(originalJson);
      const content = parsed.content || parsed;
      const name = workflowName.trim() || parsed.name || "xmlconverstion";
      
      // Inject dataset information into the JSON Configuration
      if (content.Nodes && content.Nodes.Node) {
        const nodeObj = content.Nodes.Node;
        
        // Handle array structure (preferred format)
        if (Array.isArray(nodeObj)) {
          nodeObj.forEach((node: any, index: number) => {
            if (datasets[index] && node.Properties && node.Properties.Configuration) {
              node.Properties.Configuration.DatasetId = datasets[index].datasetId;
              node.Properties.Configuration.SampleFileUri = datasets[index].path;
              node.Properties.Configuration.ConnectionName = datasets[index].name;
            }
          });
        }
      }
      
      return JSON.stringify({ name, content }, null, 2);
    } catch (err) {
      console.error('Dataset enhancement error:', err);
      return originalJson;
    }
  };

  const handleConvert = async () => {
    if (!validateInputs()) {
      return;
    }

    setError('');
    setSuccess('');
    setIsConverting(true);
    
    const startTime = performance.now();

    try {
      const detectedType = detectFileType(xmlInput);
      setFileType(detectedType);

      let result = convertXmlToJson(xmlInput, workflowName.trim());
      
      // Enhance with datasets if provided
      if (datasets.length > 0) {
        result = enhanceJsonWithDatasets(result);
      }
      
      // FORCE cloud compatibility conversion with dataset info
      console.log('Before cloud conversion:', result.substring(0, 200));
      result = makeCloudCompatible(result, datasets);
      console.log('After cloud conversion:', result.substring(0, 200));
      
      const parsedResult = JSON.parse(result);
      
      const finalResult = JSON.stringify(parsedResult, null, 2);
      
      const endTime = performance.now();
      const conversionTime = Math.round(endTime - startTime);

      setJsonOutput(finalResult);
      setParsedJson(parsedResult);
      
      if (!customFilename) {
        setCustomFilename(workflowName || 'converted');
      }
      
      let successMsg = `Conversion successful! (${conversionTime}ms) - Cloud Compatible`;
      if (detectedType === 'xml') {
        successMsg += ' - XML file detected';
      }
      successMsg += ` - ${datasets.length} dataset(s) included`;
      setSuccess(successMsg);

      const filename = customFilename.trim() || workflowName.trim() || 'converted';
      onConvert(xmlInput, finalResult, conversionTime, detectedType, `${filename}.xml`);
      
      // Save workflow and files
      if (user) {
        const fileId = `${Date.now()}_${filename}.xml`;
        
        // Save input XML file
        const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
        existingFiles.push({
          _id: fileId,
          user_id: user.id,
          filename: `${filename}.xml`,
          location: `trinity-dataset/${filename}.xml`,
          file_type: 'input',
          content: xmlInput,
          file_size: new Blob([xmlInput]).size,
          mime_type: 'text/xml',
          created_at: new Date().toISOString()
        });
        
        // Save output JSON file
        const outputFileId = `${Date.now()}_${filename}.json`;
        existingFiles.push({
          _id: outputFileId,
          user_id: user.id,
          filename: `${filename}.json`,
          location: `/cloud/outputs/${filename}.json`,
          file_type: 'output',
          content: finalResult,
          file_size: new Blob([finalResult]).size,
          mime_type: 'application/json',
          created_at: new Date().toISOString()
        });
        
        localStorage.setItem('file_storage', JSON.stringify(existingFiles));
        
        // Save workflow metadata
        const workflow = {
          id: Date.now().toString(),
          user_id: user.id,
          name: workflowName,
          filename: `${filename}.xml`,
          datasets: datasets,
          createdAt: new Date().toISOString(),
          outputPath: `/cloud/outputs/${filename}.json`
        };
        
        const existingWorkflows = JSON.parse(localStorage.getItem('saved_workflows') || '[]');
        existingWorkflows.push(workflow);
        localStorage.setItem('saved_workflows', JSON.stringify(existingWorkflows));
        loadSavedWorkflows();
        loadUploadedFiles();
        
        // Mark file as converted
        setConvertedFiles(prev => new Set([...prev, filename]));
      }
      
      // Show dataset uploader option
      setShowDatasetUploader(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(jsonOutput);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const downloadJson = () => {
    const filename = customFilename.trim() || workflowName.trim() || 'converted';
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadApiFormat = () => {
    const filename = customFilename.trim() || workflowName.trim() || 'converted';
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  return (
    <div className="space-y-8">
      {/* Token Status */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">API Token Status:</span>
            <span className={`text-sm font-medium ${
              tokenStatus === 'valid' ? 'text-green-400' : 
              tokenStatus === 'expired' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {tokenStatus === 'valid' ? '✓ Valid' : 
               tokenStatus === 'expired' ? '⚠ Expired' : '✗ Not Configured'}
            </span>
          </div>
          <button
            onClick={checkTokenStatus}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Workflow Configuration */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="w-5 h-5 text-purple-400" />
          <h3 className="text-xl font-semibold text-white">Workflow Configuration</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Workflow Name *
          </label>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Enter workflow name"
            className="w-full bg-gray-900/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Uploaded Files Section */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">Select from Uploaded Files</h3>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        </div>
        {uploadedFiles.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-400">No uploaded files found. Upload files in Data Storage first.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm mx-auto"
            >
              <Upload className="w-4 h-4" />
              Upload Your First File
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => {
              const isConverted = convertedFiles.has(file.filename);
              const isSelected = selectedFile?._id === file._id;
              
              return (
                <div key={file._id || file.id || index} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{file.filename}</h4>
                          {isConverted && (
                            <span className="px-2 py-1 bg-green-500/20 border border-green-500/50 text-green-300 text-xs rounded">
                              ✓ Converted
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 text-xs rounded">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFile(null);
                            setXmlInput('');
                            setCustomFilename('');
                            setDatasets([]);
                          } else {
                            selectFileFromStorage(file);
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded ${
                          isSelected 
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isSelected ? 'Deselect' : 'Select'}
                      </button>
                      <button
                        onClick={() => {
                          const files = JSON.parse(localStorage.getItem('file_storage') || '[]');
                          const filtered = files.filter((f: any) => f._id !== file._id);
                          localStorage.setItem('file_storage', JSON.stringify(filtered));
                          if (selectedFile?._id === file._id) {
                            setSelectedFile(null);
                            setXmlInput('');
                            setCustomFilename('');
                            setDatasets([]);
                          }
                          setConvertedFiles(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(file.filename);
                            return newSet;
                          });
                          loadUploadedFiles();
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dataset Management */}
      <DatasetManager datasets={datasets} onDatasetsChange={setDatasets} />

      {/* Validation Summary */}
      <ValidationSummary 
        workflowName={workflowName}
        datasets={datasets}
        xmlInput={xmlInput}
      />

      {/* XML Input Section */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">XML Input</h3>
          {fileType && (
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 text-sm rounded">
              {fileType === 'xml' ? 'XML File' : fileType === 'json' ? 'JSON File' : 'Unknown Format'}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <textarea
            value={xmlInput}
            onChange={(e) => setXmlInput(e.target.value)}
            className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-lg p-4 text-white font-mono text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Paste your XML content here..."
          />

          <div className="space-y-2">
            <div className="text-xs text-gray-400">Maximum file size: 10MB (2MB recommended for optimal performance)</div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.yxmd,text/xml"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload XML or YXMD file"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
              <button
                onClick={() => setXmlInput('')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setXmlInput(sampleXmlData);
                  setWorkflowName(sampleWorkflowName);
                  setDatasets(sampleDatasets);
                  setCustomFilename('sample_workflow');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
              >
                Load Sample
              </button>
            </div>
            <button
              onClick={handleConvert}
              disabled={isConverting || !xmlInput.trim()}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to JSON with Datasets'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* JSON Output Section */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Enhanced JSON Output</h3>
          <div className="flex items-center gap-3">
            {jsonOutput && (
              <button
                onClick={() => setShowTreeView(!showTreeView)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
                  showTreeView ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <TreePine className="w-4 h-4" />
                JSON Viewer
              </button>
            )}
            {jsonOutput && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm">Ready</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {showTreeView && parsedJson ? (
            <div className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-lg p-4 overflow-auto">
              <JsonViewer data={parsedJson} />
            </div>
          ) : (
            <textarea
              value={jsonOutput}
              readOnly
              className="w-full h-64 bg-gray-900/50 border border-white/20 rounded-lg p-4 text-white font-mono text-sm resize-none"
              placeholder="Enhanced JSON output with workflow and dataset information will appear here..."
            />
          )}

          {jsonOutput && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  placeholder="Enter filename (without .json)"
                  className="flex-1 bg-gray-900/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-400 text-sm">.json</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={downloadApiFormat}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved Workflows */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="w-5 h-5 text-purple-400" />
          <h3 className="text-xl font-semibold text-white">Saved Workflows</h3>
          <span className="text-sm text-gray-400">({savedWorkflows.length})</span>
        </div>
        {savedWorkflows.length === 0 ? (
          <div className="text-center py-8">
            <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-400">No saved workflows yet. Convert a file to create your first workflow.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedWorkflows.map((workflow, index) => (
              <div key={workflow.id || index} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">{workflow.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(workflow.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => {
                        const workflows = JSON.parse(localStorage.getItem('saved_workflows') || '[]');
                        const filtered = workflows.filter((w: any) => w.id !== workflow.id);
                        localStorage.setItem('saved_workflows', JSON.stringify(filtered));
                        loadSavedWorkflows();
                      }}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400 mb-2">
                  File: {workflow.filename} • Datasets: {workflow.datasets.length}
                </div>
                <div className="text-xs text-blue-400">
                  Output Path: {workflow.outputPath}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}
    </div>
  );
}