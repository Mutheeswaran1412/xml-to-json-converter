import { useState } from 'react';
import { Upload, Download, X, FileCode2, CheckCircle2, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { convertXmlToJson } from '../utils/xmlToJsonConverter';
import { mongoClient } from '../lib/mongodb';
import { useAuth } from '../contexts/AuthContext';


interface FileConversion {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'success' | 'error';
  jsonOutput?: string;
  error?: string;
  progress?: number;
  conversionTime?: number;
  fileType?: string;
}

export function BulkConverter() {
  const { user } = useAuth();
  const [conversions, setConversions] = useState<FileConversion[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];
    const errors: string[] = [];
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    Array.from(files).forEach(file => {
      // File size validation
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 2MB limit`);
        return;
      }
      
      // Basic file type validation
      if (file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.yxmd')) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: Only XML and YXMD files are supported`);
      }
    });

    if (errors.length > 0) {
      alert(`Some files were rejected:\n${errors.join('\n')}`);
    }

    const newConversions: FileConversion[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      progress: 0,
    }));

    setConversions(prev => [...prev, ...newConversions]);
  };

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
    handleFileSelect(e.dataTransfer.files);
  };

  const convertAll = async () => {
    const pendingConversions = conversions.filter(c => c.status === 'pending');
    if (pendingConversions.length === 0) return;

    setIsProcessing(true);
    setOverallProgress(0);

    try {
      // Process files one by one
      for (const conversion of pendingConversions) {
        // Update status to converting
        setConversions(prev =>
          prev.map(c => c.id === conversion.id ? { ...c, status: 'converting', progress: 0 } : c)
        );

        try {
          const xmlContent = await conversion.file.text();
          
          // Detect file type
          const isYxmdFile = conversion.file.name.toLowerCase().endsWith('.yxmd') || 
                           xmlContent.includes('AlteryxDocument');
          const fileType = isYxmdFile ? 'yxmd' : 'generic';

          // Update progress
          setConversions(prev =>
            prev.map(c => c.id === conversion.id ? { ...c, progress: 50 } : c)
          );

          const startTime = performance.now();
          const jsonOutput = convertXmlToJson(xmlContent);
          const endTime = performance.now();
          const conversionTime = Math.round(endTime - startTime);

          setConversions(prev =>
            prev.map(c =>
              c.id === conversion.id
                ? { 
                    ...c, 
                    status: 'success', 
                    jsonOutput, 
                    progress: 100,
                    conversionTime,
                    fileType
                  }
                : c
            )
          );

          // Save to database
          if (user) {
            const conversions = await mongoClient.getCollection('conversions');
            await conversions.insertOne({
              user_id: user.id,
              filename: conversion.file.name,
              xml_input: xmlContent,
              json_output: jsonOutput,
              file_size: conversion.file.size,
              conversion_time_ms: conversionTime,
              status: 'success' as const,
              error_message: null,
              created_at: new Date().toISOString()
            });
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
          setConversions(prev =>
            prev.map(c =>
              c.id === conversion.id
                ? {
                    ...c,
                    status: 'error',
                    error: errorMsg,
                    progress: 0
                  }
                : c
            )
          );

          // Save error to database
          if (user) {
            try {
              const conversions = await mongoClient.getCollection('conversions');
              await conversions.insertOne({
                user_id: user.id,
                filename: conversion.file.name,
                xml_input: await conversion.file.text(),
                json_output: null,
                file_size: conversion.file.size,
                conversion_time_ms: 0,
                status: 'error' as const,
                error_message: errorMsg,
                created_at: new Date().toISOString()
              });
            } catch (dbError) {
              console.error('Failed to save error to database:', dbError);
            }
          }
        }
        
        // Update overall progress
        const completed = conversions.filter(c => c.status === 'success' || c.status === 'error').length;
        const total = conversions.length;
        setOverallProgress((completed / total) * 100);
      }
    } finally {
      setIsProcessing(false);
      setOverallProgress(100);
    }
  };

  const downloadAll = () => {
    conversions
      .filter(c => c.status === 'success' && c.jsonOutput)
      .forEach(conversion => {
        const blob = new Blob([conversion.jsonOutput!], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = conversion.file.name.replace(/\.xml$/, '.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  const removeFile = (id: string) => {
    setConversions(prev => prev.filter(c => c.id !== id));
  };

  const clearAll = () => {
    setConversions([]);
  };

  const successCount = conversions.filter(c => c.status === 'success').length;
  const errorCount = conversions.filter(c => c.status === 'error').length;
  const pendingCount = conversions.filter(c => c.status === 'pending').length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-white font-semibold text-lg">Bulk File Converter</h2>
          <p className="text-white text-sm mt-1">Convert multiple XML files at once{!user && ' (Sign in to save history)'}</p>
        </div>

        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 text-white mx-auto mb-4" />
            <p className="text-white font-medium mb-2">
              Drag and drop XML files here
            </p>
            <p className="text-white text-sm mb-2">Maximum 2MB per file</p>
            <p className="text-white text-sm mb-4">or</p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xml,text/xml,.yxmd"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <span className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                Select Files
              </span>
            </label>
          </div>

          {conversions.length > 0 && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-black">
                    Total: <strong className="text-black">{conversions.length}</strong>
                  </span>
                  {successCount > 0 && (
                    <span className="text-green-600">
                      Success: <strong>{successCount}</strong>
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-red-600">
                      Failed: <strong>{errorCount}</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <button
                      onClick={convertAll}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Convert All'
                      )}
                    </button>
                  )}
                  
                  {isProcessing && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${overallProgress}%` }}
                        />
                      </div>
                      <span className="text-sm text-black">{Math.round(overallProgress)}%</span>
                    </div>
                  )}
                  {successCount > 0 && (
                    <button
                      onClick={downloadAll}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download All
                    </button>
                  )}
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-black font-medium rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {conversions.map((conversion) => (
                  <div
                    key={conversion.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileCode2 className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-black font-medium truncate">
                          {conversion.file.name}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{(conversion.file.size / 1024).toFixed(1)} KB</span>
                          {conversion.fileType && (
                            <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {conversion.fileType === 'yxmd' ? 'Alteryx' : 'XML'}
                            </span>
                          )}
                          {conversion.conversionTime && (
                            <span className="text-green-400">{conversion.conversionTime}ms</span>
                          )}
                        </div>
                        {conversion.status === 'converting' && conversion.progress !== undefined && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${conversion.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{conversion.progress}% complete</p>
                          </div>
                        )}
                        {conversion.error && (
                          <p className="text-red-600 text-sm mt-1">{conversion.error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conversion.status === 'pending' && (
                        <span className="text-gray-600 text-sm">Pending</span>
                      )}
                      {conversion.status === 'converting' && (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      {conversion.status === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {conversion.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(conversion.id)}
                        title="Remove file"
                        className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
