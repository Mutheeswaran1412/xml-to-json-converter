import { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Download, AlertCircle, CheckCircle2, Loader2, Eye, FileText, TreePine, Database, FolderOpen } from 'lucide-react';
import { JsonViewer } from './JsonViewer';
import { convertXmlToJson, detectFileType } from '../utils/xmlToJsonConverter';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

interface SimpleConverterProps {
  onConvert: (xmlInput: string, result: string, conversionTime: number, fileType: string, filename?: string) => void;
}

export function SimpleConverter({ onConvert }: SimpleConverterProps) {
  const { user } = useAuth();
  const [xmlInput, setXmlInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [fileType, setFileType] = useState<'yxmd' | 'generic' | null>(null);
  const [customFilename, setCustomFilename] = useState('');
  const [conversionMetadata, setConversionMetadata] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [showTreeView, setShowTreeView] = useState(false);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  useEffect(() => {
    loadUploadedFiles();
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadUploadedFiles();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadUploadedFiles = () => {
    try {
      const files = JSON.parse(localStorage.getItem('file_storage') || '[]');
      const userId = user?.id || 'guest';
      console.log('Loading files - Total:', files.length, 'UserId:', userId);
      
      // Debug: Check first file structure
      if (files.length > 0) {
        console.log('Sample file:', files[0]);
      }
      
      const userInputFiles = files.filter((f: any) => {
        const match = f.file_type === 'input' && f.user_id === userId;
        if (!match && files.length < 5) {
          console.log('File not matched:', f.filename, 'type:', f.file_type, 'userId:', f.user_id);
        }
        return match;
      });
      
      console.log('Filtered files:', userInputFiles.length);
      
      // Keep only last 10 files to prevent quota issues
      if (files.length > 10) {
        const recentFiles = files.slice(-10);
        localStorage.setItem('file_storage', JSON.stringify(recentFiles));
        console.log('Cleaned up old files, kept last 10');
      }
      
      setUploadedFiles(userInputFiles);
    } catch (err) {
      console.error('Error loading files:', err);
      setUploadedFiles([]);
    }
  };

  const selectFileFromStorage = (file: any) => {
    setSelectedFile(file);
    setXmlInput(file.content);
    setCustomFilename(file.filename.replace(/\.(xml|yxmd)$/i, ''));
    setError('');
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
        
        // Save to storage
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
          console.log('File saved to storage:', file.name, 'Total files:', existingFiles.length);
          console.log('Saved with userId:', userId);
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

  const handleConvert = async () => {
    if (!xmlInput.trim()) {
      setError('Please enter XML content to convert');
      return;
    }

    setError('');
    setSuccess('');
    setIsConverting(true);
    
    const startTime = performance.now();

    try {
      const detectedType = detectFileType(xmlInput);
      setFileType(detectedType);

      const result = convertXmlToJson(xmlInput);
      const parsedResult = JSON.parse(result);
      
      const filename = customFilename.trim() || 'converted';
      
      // Create structured format with name first, then content
      const structuredResult = {
        name: filename,
        content: parsedResult
      };
      
      const finalResult = JSON.stringify(structuredResult, null, 2);
      
      const endTime = performance.now();
      const conversionTime = Math.round(endTime - startTime);

      setJsonOutput(finalResult);
      setParsedJson(structuredResult);
      
      if (!customFilename) {
        setCustomFilename('converted');
      }
      
      let successMsg = `Conversion successful! (${conversionTime}ms)`;
      if (detectedType === 'yxmd') {
        successMsg += ' - Alteryx workflow detected';
      }
      setSuccess(successMsg);

      onConvert(xmlInput, finalResult, conversionTime, detectedType, `${filename}.xml`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert XML to JSON');
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
    const filename = customFilename.trim() || 'converted';
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
      {/* Uploaded Files Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="text-xl font-semibold text-black">Select from Uploaded Files</h3>
        </div>
        {uploadedFiles.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-black">No uploaded files found. Upload files in Data Storage first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {uploadedFiles.map((file) => (
              <div
                key={file._id}
                onClick={() => selectFileFromStorage(file)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedFile?._id === file._id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-black text-sm font-medium truncate">{file.filename}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFile?._id === file._id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setXmlInput('');
                          setCustomFilename('');
                        }}
                        className="text-yellow-600 hover:text-yellow-800 text-xs"
                      >
                        Deselect
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const files = JSON.parse(localStorage.getItem('file_storage') || '[]');
                        const filtered = files.filter((f: any) => f._id !== file._id);
                        localStorage.setItem('file_storage', JSON.stringify(filtered));
                        if (selectedFile?._id === file._id) {
                          setSelectedFile(null);
                          setXmlInput('');
                          setCustomFilename('');
                        }
                        loadUploadedFiles();
                      }}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                </div>
                {selectedFile?._id === file._id && (
                  <div className="mt-2 text-xs text-green-600">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XML Input Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-black">XML Input</h3>
          {fileType && (
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 text-sm rounded">
              {fileType === 'yxmd' ? 'Alteryx Workflow' : 'Generic XML'}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <textarea
            value={xmlInput}
            onChange={(e) => setXmlInput(e.target.value)}
            className="w-full h-64 bg-white border border-gray-300 rounded-lg p-4 text-black font-mono text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Paste your XML content here..."
          />

          <div className="space-y-2">
            <div className="text-xs text-black">Maximum file size: 10MB (2MB recommended for optimal performance)</div>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.yxmd,text/xml"
                onChange={handleFileUpload}
                className="hidden"
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
            </div>
            <button
              onClick={handleConvert}
              disabled={isConverting || !xmlInput.trim()}
              className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to JSON'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* JSON Output Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-black">JSON Output</h3>
          <div className="flex items-center gap-3">
            {jsonOutput && (
              <button
                onClick={() => setShowTreeView(!showTreeView)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
                  showTreeView ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-black'
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
            <div className="w-full h-64 bg-white border border-gray-300 rounded-lg p-4 overflow-auto">
              <JsonViewer data={parsedJson} />
            </div>
          ) : (
            <textarea
              value={jsonOutput}
              readOnly
              className="w-full h-64 bg-white border border-gray-300 rounded-lg p-4 text-black font-mono text-sm resize-none"
              placeholder="JSON output will appear here..."
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
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-black text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-black text-sm">.json</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={downloadJson}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}

    </div>
  );
}