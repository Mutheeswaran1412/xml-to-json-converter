import { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { convertXmlToJson, detectFileType } from '../utils/xmlToJsonConverter';
import { validateXmlSyntax } from '../utils/converter';
import { tokenManager } from '../utils/tokenManager';
import { useSettings } from '../contexts/SettingsContext';

interface EnhancedConverterProps {
  onConvert: (xmlInput: string, result: string, conversionTime: number, fileType: string) => void;
}

export function EnhancedConverter({ onConvert }: EnhancedConverterProps) {
  const [xmlInput, setXmlInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Array<{line: number, message: string}>>([]);
  const [fileType, setFileType] = useState<'yxmd' | 'generic' | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string, size: number, type: string, content: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();

  // Real-time validation
  useEffect(() => {
    if (xmlInput.trim()) {
      const errors = validateXmlSyntax(xmlInput);
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  }, [xmlInput]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const xmlFile = files.find(file => 
      file.name.endsWith('.xml') || 
      file.name.endsWith('.yxmd') || 
      file.type === 'text/xml'
    );
    
    if (xmlFile) {
      handleFileRead(xmlFile);
    } else {
      setError('Please drop a valid XML or YXMD file');
    }
  };

  const handleFileRead = (file: File) => {
    if (file.size > settings.maxFileSize * 1024) {
      setError(`File size exceeds ${settings.maxFileSize}KB limit`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // Add to uploaded files list
      const newFile = {
        name: file.name,
        size: file.size,
        type: file.type || 'text/xml',
        content
      };
      
      setUploadedFiles(prev => {
        const exists = prev.find(f => f.name === file.name);
        if (exists) {
          return prev.map(f => f.name === file.name ? newFile : f);
        }
        return [...prev, newFile];
      });
      
      setXmlInput(content);
      setError('');
      
      // Save to storage
      try {
        const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
        const fileId = `${Date.now()}_${file.name}`;
        
        existingFiles.push({
          _id: fileId,
          user_id: 'guest',
          filename: file.name,
          location: `trinity-dataset/${file.name}`,
          file_type: 'input',
          content,
          file_size: file.size,
          mime_type: file.type || 'text/xml',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('file_storage', JSON.stringify(existingFiles));
        console.log('File saved to storage:', file.name);
      } catch (err) {
        console.error('Failed to save file to storage:', err);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => handleFileRead(file));
    e.target.value = '';
  };

  const loadFileFromList = (fileContent: string, fileName: string) => {
    setXmlInput(fileContent);
    setError('');
    setSuccess(`Loaded: ${fileName}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleConvert = async () => {
    if (!xmlInput.trim()) {
      setError('Please enter XML content to convert');
      return;
    }

    if (validationErrors.length > 0) {
      setError('Please fix XML syntax errors before converting');
      return;
    }

    setError('');
    setSuccess('');
    setIsConverting(true);
    
    const startTime = performance.now();

    try {
      const detectedType = detectFileType(xmlInput);
      setFileType(detectedType);

      let result: string;
      
      // Check if tokens are available for API conversion
      const { tokenManager } = await import('../utils/tokenManager');
      const hasTokens = tokenManager.hasTokens();
      
      if (hasTokens) {
        // Use API conversion with authentication
        const { apiClient } = await import('../utils/apiClient');
        result = await apiClient.convertXmlToJsonAPI(xmlInput, {
          preserveAttributes: settings.preserveAttributes,
          outputFormat: settings.outputFormat,
          fileType: detectedType
        });
      } else {
        // Fallback to local conversion
        result = await convertXmlToJson(xmlInput, {
          preserveAttributes: settings.preserveAttributes,
          outputFormat: settings.outputFormat
        });
      }
      
      const endTime = performance.now();
      const conversionTime = Math.round(endTime - startTime);

      setJsonOutput(result);
      
      let successMsg = `Conversion successful! (${conversionTime}ms)`;
      if (hasTokens) {
        successMsg += ' - API conversion';
      } else {
        successMsg += ' - Local conversion';
      }
      
      if (detectedType === 'yxmd') {
        try {
          const parsed = JSON.parse(result);
          successMsg += ` - Alteryx workflow: ${parsed.tools?.length || 0} tools, ${parsed.connections?.length || 0} connections`;
        } catch {
          successMsg += ' - Alteryx workflow detected';
        }
      }
      setSuccess(successMsg);

      onConvert(xmlInput, result, conversionTime, detectedType);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to convert XML to JSON';
      setError(errorMsg);
    } finally {
      setIsConverting(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(jsonOutput);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const downloadJson = (minified = false) => {
    const content = minified ? JSON.stringify(JSON.parse(jsonOutput)) : jsonOutput;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extension = fileType === 'yxmd' ? '.yxmd' : '.json';
    a.download = `converted${minified ? '-minified' : ''}${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const highlightXml = (xml: string) => {
    return xml
      .replace(/(&lt;[^&gt;]+&gt;)/g, '<span class="text-blue-400">$1</span>')
      .replace(/(&quot;[^&quot;]*&quot;)/g, '<span class="text-green-400">$1</span>')
      .replace(/(=)/g, '<span class="text-yellow-400">$1</span>');
  };

  const highlightJson = (json: string) => {
    return json
      .replace(/("[\w]+"):/g, '<span class="text-blue-400">$1</span>:')
      .replace(/: (".*?")/g, ': <span class="text-green-400">$1</span>')
      .replace(/: (true|false|null)/g, ': <span class="text-purple-400">$1</span>')
      .replace(/: (\d+)/g, ': <span class="text-orange-400">$1</span>');
  };

  return (
    <div className="space-y-4">
      {/* Uploaded Files List - Row Layout */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Uploaded Files ({uploadedFiles.length})</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Files
            </button>
          </div>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div 
                key={index}
                className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/70 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                    <span className="text-blue-400 text-xs font-bold">{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{file.name}</p>
                    <p className="text-gray-400 text-xs">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadFileFromList(file.content, file.name)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => removeFile(file.name)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 h-[600px]">
      {/* XML Input Panel */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">XML Input</h3>
          {validationErrors.length > 0 && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{validationErrors.length} errors</span>
            </div>
          )}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 border-2 border-dashed rounded-lg p-4 transition-all relative ${
            isDragging 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-white/20 hover:border-white/30'
          }`}
        >
          <div className="h-full flex flex-col">
            <textarea
              value={xmlInput}
              onChange={(e) => setXmlInput(e.target.value)}
              className="flex-1 bg-gray-900/50 rounded p-3 font-mono text-sm text-white resize-none border-none outline-none"
              placeholder="Paste your XML content here or drag & drop files..."
            />
            {!xmlInput && (
              <div className="absolute inset-4 flex flex-col items-center justify-center pointer-events-none">
                <Upload className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-gray-400 text-sm">Paste XML or drop files here</p>
              </div>
            )}
            {validationErrors.length > 0 && (
              <div className="mt-2 max-h-20 overflow-y-auto">
                {validationErrors.map((error, index) => (
                  <div key={index} className="text-red-400 text-xs">
                    Line {error.line}: {error.message}
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.yxmd,text/xml"
              onChange={handleFileUpload}
              multiple
              className="hidden"
              title="Select XML or YXMD file to upload"
              placeholder="Choose file"
            />
          </div>
        </div>

        {/* Input Controls */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setXmlInput('')}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Browse Desktop Files
          </button>
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setXmlInput(text);
                setError('');
              } catch {
                setError('Failed to read clipboard. Please paste manually.');
              }
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
          >
            Paste Text
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting || !xmlInput.trim() || validationErrors.length > 0}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm flex items-center justify-center gap-2"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>Convert to JSON {tokenManager.hasTokens() ? '(API)' : '(Local)'}</>
            )}
          </button>
        </div>
      </div>

      {/* JSON Output Panel */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">JSON Output</h3>
            {fileType && (
              <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-300 text-xs rounded">
                {fileType === 'yxmd' ? 'Alteryx Workflow' : 'Generic XML'}
              </span>
            )}
          </div>
          {jsonOutput && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Ready</span>
            </div>
          )}
        </div>

        {/* JSON Display */}
        <div className="flex-1 border border-white/20 rounded-lg overflow-hidden">
          {jsonOutput ? (
            <div 
              className="h-full bg-gray-900/50 p-3 font-mono text-sm overflow-auto"
              dangerouslySetInnerHTML={{ __html: highlightJson(jsonOutput) }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <p>JSON output will appear here</p>
            </div>
          )}
        </div>

        {/* Output Controls */}
        {jsonOutput && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
            <button
              onClick={() => downloadJson(false)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              <Download className="w-4 h-4" />
              Pretty
            </button>
            <button
              onClick={() => downloadJson(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
            >
              <Download className="w-4 h-4" />
              Minified
            </button>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}