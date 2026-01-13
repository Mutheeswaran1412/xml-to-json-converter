import { useState, useEffect } from 'react';
import { Database, Download, Trash2, FileText, Code, Upload, FolderOpen } from 'lucide-react';
import { mongoClient } from '../lib/mongodb';
import { useAuth } from '../contexts/AuthContext';

interface StoredFile {
  id: string;
  filename: string;
  file_type: 'input' | 'output';
  content: string;
  file_size: number;
  created_at: string;
  conversion_id?: string;
}

export function DataStorage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        loadFiles();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [user]);

  const loadFiles = async () => {
    try {
      // Clean up storage before loading
      cleanupStorage();
      
      const data = JSON.parse(localStorage.getItem('file_storage') || '[]');
      const userId = user?.id || 'guest';
      const userFiles = data.filter((file: any) => file.user_id === userId);
      
      const formattedData = userFiles.map((doc: any) => ({
        ...doc,
        id: doc._id?.toString() || '',
        created_at: typeof doc.created_at === 'string' ? doc.created_at : doc.created_at.toISOString()
      }));
      
      setFiles(formattedData as StoredFile[]);
    } catch (error) {
      console.error('Error loading files:', error);
      // If loading fails, clear corrupted storage
      localStorage.removeItem('file_storage');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 1MB)
    if (file.size > 1024 * 1024) {
      alert('File too large. Please use files smaller than 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      try {
        // Clean up old files if storage is getting full
        cleanupStorage();
        
        const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
        const userId = user?.id || 'guest';
        const fileId = `${Date.now()}_${file.name}`;
        const location = `trinity-dataset/${file.name}`;
        
        const newFile = {
          _id: fileId,
          user_id: userId,
          filename: file.name,
          location: location,
          file_type: 'input' as const,
          content,
          file_size: file.size,
          mime_type: file.type || 'text/xml',
          created_at: new Date().toISOString()
        };
        
        existingFiles.push(newFile);
        
        try {
          localStorage.setItem('file_storage', JSON.stringify(existingFiles));
        } catch (storageError) {
          // If storage is full, remove oldest files and try again
          console.warn('Storage full, cleaning up old files...');
          const cleanedFiles = existingFiles.slice(-10); // Keep only last 10 files
          localStorage.setItem('file_storage', JSON.stringify(cleanedFiles));
        }
        
        await loadFiles();
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file. Storage may be full.');
      }
    };
    reader.readAsText(file);
    
    // Clear the input to allow re-uploading the same file
    event.target.value = '';
  };

  // Add cleanup function
  const cleanupStorage = () => {
    try {
      const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
      
      // Remove files older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentFiles = existingFiles.filter((file: any) => {
        const fileDate = new Date(file.created_at);
        return fileDate > sevenDaysAgo;
      });
      
      // If still too many files, keep only the 20 most recent
      const limitedFiles = recentFiles.slice(-20);
      
      if (limitedFiles.length < existingFiles.length) {
        localStorage.setItem('file_storage', JSON.stringify(limitedFiles));
        console.log(`Cleaned up ${existingFiles.length - limitedFiles.length} old files`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      // If cleanup fails, clear all storage
      localStorage.removeItem('file_storage');
    }
  };

  const downloadFile = (file: StoredFile) => {
    const blob = new Blob([file.content], { 
      type: file.file_type === 'input' ? 'text/xml' : 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteFile = async (fileId: string) => {
    try {
      const existingFiles = JSON.parse(localStorage.getItem('file_storage') || '[]');
      const filteredFiles = existingFiles.filter((file: any) => file._id !== fileId);
      localStorage.setItem('file_storage', JSON.stringify(filteredFiles));
      await loadFiles();
      setSelectedFile(null);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const filteredFiles = files.filter(file => file.file_type === activeTab);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadFiles();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Data Storage</h1>
        <p className="text-gray-400 text-lg">
          Manage your uploaded XML files and converted JSON outputs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File List Panel */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-white/10 rounded-xl overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab('input')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'input'
                    ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Input Files ({files.filter(f => f.file_type === 'input').length})
              </button>
              <button
                onClick={() => setActiveTab('output')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === 'output'
                    ? 'bg-green-500/20 text-green-400 border-b-2 border-green-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Code className="w-4 h-4 inline mr-2" />
                Output Files ({files.filter(f => f.file_type === 'output').length})
              </button>
            </div>

            {/* Upload Section for Input Files */}
            {activeTab === 'input' && (
              <div className="p-6 border-b border-white/10">
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Click to upload XML files</p>
                  </div>
                  <input
                    type="file"
                    accept=".xml,.yxmd"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* File List */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading files...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {activeTab === 'input' 
                      ? 'No input files uploaded yet' 
                      : 'No output files generated yet'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedFile?.id === file.id
                          ? 'border-blue-400 bg-blue-500/10'
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {file.file_type === 'input' ? (
                            <FileText className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Code className="w-5 h-5 text-green-400" />
                          )}
                          <div>
                            <p className="text-white font-medium">{file.filename}</p>
                            <p className="text-sm text-gray-400">
                              {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file);
                            }}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Download file"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFile(file.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Preview Panel */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 border border-white/10 rounded-xl overflow-hidden h-fit">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">File Preview</h3>
            </div>
            <div className="p-6">
              {selectedFile ? (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-1">Filename</p>
                    <p className="text-white font-medium">{selectedFile.filename}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-1">Type</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      selectedFile.file_type === 'input'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {selectedFile.file_type === 'input' ? 'Input File' : 'Output File'}
                    </span>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-1">Size</p>
                    <p className="text-white">{(selectedFile.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-1">Created</p>
                    <p className="text-white">{new Date(selectedFile.created_at).toLocaleString()}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-2">Content Preview</p>
                    <div className="bg-slate-900 border border-white/10 rounded-lg p-3 max-h-64 overflow-auto">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {selectedFile.content.substring(0, 500)}
                        {selectedFile.content.length > 500 && '...'}
                      </pre>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadFile(selectedFile)}
                      className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => deleteFile(selectedFile.id)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    Select a file to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}