import { useState, useEffect } from 'react';
import { User, ArrowLeft, Menu, X, Settings, Keyboard } from 'lucide-react';
import { convertXmlToJson, detectFileType } from './utils/xmlToJsonConverter';
import { mongoClient } from './lib/mongodb';
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';
import { AuthModal } from './components/AuthModal';
import { ConversionHistory } from './components/ConversionHistory';
import { BulkConverter } from './components/BulkConverter';
import { SettingsModal } from './components/SettingsModal';
import { ApiDocs } from './components/ApiDocs';
import { Tutorial } from './components/Tutorial';
import { CloudStorage } from './components/CloudStorage';
import { DatabaseExport } from './components/DatabaseExport';
import { Integrations } from './components/Integrations';
import { KnowledgeBase } from './components/KnowledgeBase';
import { AdvancedAnalytics } from './components/AdvancedAnalytics';
import { SimpleConverter } from './components/SimpleConverter';
import { EnhancedConverterWithDatasets } from './components/EnhancedConverterWithDatasets';
import { TokenManager } from './components/TokenManager';
import { DataStorage } from './components/DataStorage';


type ViewMode = 'converter' | 'enhanced' | 'tokens' | 'history' | 'bulk' | 'api' | 'tutorial' | 'cloud' | 'database' | 'integrations' | 'knowledge' | 'analytics' | 'storage';

function App() {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState<ViewMode>('converter');
  const [xmlInput, setXmlInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [fileType, setFileType] = useState<'yxmd' | 'generic' | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            if (xmlInput.trim()) handleConvert();
            break;
          case ',':
            e.preventDefault();
            setShowSettings(true);
            break;
          case '/':
            e.preventDefault();
            setShowKeyboardShortcuts(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [xmlInput]);

  const handleConversionComplete = async (xmlInput: string, result: string, conversionTime: number, fileType: string, filename?: string) => {
    if (user) {
      try {
        const conversions = await mongoClient.getCollection('conversions');
        const conversionResult = await conversions.insertOne({
          user_id: user.id,
          filename: filename || 'Enhanced Converter',
          xml_input: xmlInput,
          json_output: result,
          file_size: new Blob([xmlInput]).size,
          conversion_time_ms: conversionTime,
          status: 'success' as const,
          error_message: null,
          created_at: new Date().toISOString()
        });

        const conversionId = conversionResult.insertedId.toString();

        // Save input file to storage
        const fileStorage = await mongoClient.getCollection('file_storage');
        await fileStorage.insertOne({
          user_id: user.id,
          filename: filename || 'input.xml',
          file_type: 'input' as const,
          content: xmlInput,
          file_size: new Blob([xmlInput]).size,
          mime_type: 'text/xml',
          conversion_id: conversionId,
          created_at: new Date().toISOString()
        });

        // Save output file to storage
        const outputFilename = filename ? filename.replace(/\.(xml|yxmd)$/i, '.json') : 'output.json';
        await fileStorage.insertOne({
          user_id: user.id,
          filename: outputFilename,
          file_type: 'output' as const,
          content: result,
          file_size: new Blob([result]).size,
          mime_type: 'application/json',
          conversion_id: conversionId,
          created_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to save conversion:', error);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setXmlInput(content);
      };
      reader.readAsText(file);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setActiveView('converter');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-green-700 to-blue-900">
      <nav className="border-b border-white/10 bg-gradient-to-r from-blue-900/80 via-purple-900/80 to-blue-900/80 backdrop-blur-sm relative z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20 py-4">
            <div className="flex items-center gap-3">
              <img src="./images/trinity-logo.webp" alt="Trinity Logo" className="w-40 h-16" />
            </div>

            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden text-white p-2"
              title="Toggle mobile menu"
            >
              {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="hidden lg:flex items-center gap-6">
              <button
                onClick={() => setActiveView('converter')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'converter' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setActiveView('enhanced')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'enhanced' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Enhanced
              </button>

              <button
                onClick={() => setActiveView('tokens')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'tokens' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Tokens
              </button>
              <button
                onClick={() => setActiveView('bulk')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'bulk' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Bulk Convert
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'history' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveView('api')}
                className={`text-sm font-medium transition-colors ${
                  activeView === 'api' ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                API
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  More
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-[9999] min-w-48 max-w-xs">
                  <button
                    onClick={() => { setActiveView('storage'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10 rounded-t-lg"
                  >
                    Data Storage
                  </button>
                  <button
                    onClick={() => { setActiveView('cloud'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10"
                  >
                    Cloud Storage
                  </button>
                  <button
                    onClick={() => { setActiveView('database'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10"
                  >
                    Database Export
                  </button>
                  <button
                    onClick={() => { setActiveView('integrations'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10"
                  >
                    Integrations
                  </button>
                  <button
                    onClick={() => { setActiveView('knowledge'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10"
                  >
                    Knowledge Base
                  </button>
                  <button
                    onClick={() => { setActiveView('analytics'); setShowMoreMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-white hover:bg-white/10 rounded-b-lg"
                  >
                    Analytics
                  </button>
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg border border-white/20">
                    <User className="w-4 h-4 text-white" />
                    <span className="text-sm text-white">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    title="Open settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>

          {showMobileMenu && (
            <div className="lg:hidden py-4 space-y-2">
              <button
                onClick={() => { setActiveView('converter'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'converter' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                Simple Converter
              </button>
              <button
                onClick={() => { setActiveView('enhanced'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'enhanced' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                Enhanced Converter
              </button>
              <button
                onClick={() => { setActiveView('tokens'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'tokens' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                Token Management
              </button>
              <button
                onClick={() => { setActiveView('bulk'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'bulk' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                Bulk Convert
              </button>
              <button
                onClick={() => { setActiveView('history'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'history' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                History
              </button>
              <button
                onClick={() => { setActiveView('api'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'api' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                API
              </button>
              <button
                onClick={() => { setActiveView('storage'); setShowMobileMenu(false); }}
                className={`block w-full text-left px-4 py-2 rounded-lg ${
                  activeView === 'storage' ? 'bg-white/10 text-white' : 'text-gray-400'
                }`}
              >
                Data Storage
              </button>
              {!user && (
                <button
                  onClick={() => { setShowAuthModal(true); setShowMobileMenu(false); }}
                  className="block w-full text-left px-4 py-2 bg-orange-500 text-white rounded-lg"
                >
                  Get Started
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        {activeView === 'converter' && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">
                Simple XML to JSON Converter
              </h1>
              <p className="text-gray-400 text-lg">
                Convert XML files to JSON format with specialized Alteryx workflow support.
              </p>
            </div>
            
            <SimpleConverter onConvert={handleConversionComplete} />
            
            <footer className="mt-16 pt-8 border-t border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-2">
                Trinity Technology Solutions - XML to JSON Converter
              </p>
            </footer>
          </div>
        )}

        {activeView === 'enhanced' && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">
                Designer Desktop to Designer Cloud Converter
              </h1>
              <p className="text-gray-400 text-lg">
                Advanced XML to JSON conversion with comprehensive workflow and dataset management capabilities.
              </p>
            </div>
            
            <EnhancedConverterWithDatasets onConvert={handleConversionComplete} />
            
            <footer className="mt-16 pt-8 border-t border-white/10 text-center">
              <p className="text-gray-400 text-sm mb-2">
                Trinity Technology Solutions - Enhanced XML to JSON Converter with Dataset Management
              </p>
            </footer>
          </div>
        )}

        {activeView === 'tokens' && (
          <div className="max-w-7xl mx-auto">
            <TokenManager />
          </div>
        )}

        {activeView === 'bulk' && <BulkConverter />}
        {activeView === 'history' && <ConversionHistory />}
        {activeView === 'api' && <ApiDocs />}



        {activeView === 'storage' && <DataStorage />}
        {activeView === 'cloud' && <CloudStorage />}
        {activeView === 'database' && <DatabaseExport />}
        {activeView === 'integrations' && <Integrations />}
        {activeView === 'knowledge' && <KnowledgeBase />}
        {activeView === 'analytics' && <AdvancedAnalytics />}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      
      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Keyboard className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
              </div>
              <button onClick={() => setShowKeyboardShortcuts(false)} className="text-gray-400 hover:text-white" title="Close shortcuts">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Convert XML</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl+Enter</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Open Settings</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl+,</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Show Shortcuts</span>
                <kbd className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl+/</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
