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
import { EnhancedConverterWithDatasets } from './components/EnhancedConverterWithDatasets';
import { TokenManager } from './components/TokenManager';
import { DataStorage } from './components/DataStorage';


type ViewMode = 'enhanced' | 'tokens' | 'history' | 'bulk' | 'api' | 'tutorial' | 'cloud' | 'database' | 'integrations' | 'knowledge' | 'analytics' | 'storage';

function App() {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState<ViewMode>('enhanced');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {

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
  }, []);

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

  const handleSignOut = async () => {
    await signOut();
    setActiveView('enhanced');
  };

  return (
    <div className="min-h-screen">
      <nav className="py-6">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-300">
            <div className="flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/images/TNova-Logo-01.png" 
                  alt="TNova Logo" 
                  className="h-12 w-auto"
                />
              </div>

              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden text-gray-700 p-2"
                title="Toggle mobile menu"
              >
                {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => setActiveView('enhanced')}
                  className={`px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    activeView === 'enhanced' 
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                      : 'text-white hover:bg-white/20 hover:text-white border border-transparent'
                  }`}
                >
                  Converter
                </button>

                <button
                  onClick={() => setActiveView('tokens')}
                  className={`px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    activeView === 'tokens' 
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                      : 'text-white hover:bg-white/20 hover:text-white border border-transparent'
                  }`}
                >
                  Tokens
                </button>
                
                <button
                  onClick={() => setActiveView('bulk')}
                  className={`px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    activeView === 'bulk' 
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                      : 'text-white hover:bg-white/20 hover:text-white border border-transparent'
                  }`}
                >
                  Bulk Convert
                </button>
                
                <button
                  onClick={() => setActiveView('history')}
                  className={`px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    activeView === 'history' 
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                      : 'text-white hover:bg-white/20 hover:text-white border border-transparent'
                  }`}
                >
                  History
                </button>
                
                <button
                  onClick={() => setActiveView('api')}
                  className={`px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    activeView === 'api' 
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-500' 
                      : 'text-white hover:bg-white/20 hover:text-white border border-transparent'
                  }`}
                >
                  API
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="px-6 py-3 text-sm font-bold rounded-xl transition-all duration-200 text-white hover:bg-white/20 hover:text-white border border-transparent"
                  >
                    More
                  </button>
                  {showMoreMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] min-w-48 max-w-xs">
                    <button
                      onClick={() => { setActiveView('storage'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 rounded-t-xl transition-colors"
                    >
                      Data Storage
                    </button>
                    <button
                      onClick={() => { setActiveView('cloud'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      Cloud Storage
                    </button>
                    <button
                      onClick={() => { setActiveView('database'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      Database Export
                    </button>
                    <button
                      onClick={() => { setActiveView('integrations'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      Integrations
                    </button>
                    <button
                      onClick={() => { setActiveView('knowledge'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      Knowledge Base
                    </button>
                    <button
                      onClick={() => { setActiveView('analytics'); setShowMoreMenu(false); }}
                      className="block w-full text-left px-4 py-3 text-gray-800 font-medium hover:bg-blue-50 hover:text-blue-700 rounded-b-xl transition-colors"
                    >
                      Analytics
                    </button>
                    </div>
                  )}
                </div>

                {user ? (
                  <div className="flex items-center gap-3 ml-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-transparent rounded-xl border border-white/20">
                      <User className="w-4 h-4 text-white" />
                      <span className="text-sm text-white">{user.email}</span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2 text-sm font-medium text-white hover:bg-white/20 hover:text-white rounded-xl transition-all duration-200"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 ml-4">
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-4 py-2 text-sm font-medium text-white hover:bg-white/20 hover:text-white rounded-xl transition-all duration-200"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="p-2 text-white hover:bg-white/20 hover:text-white rounded-xl transition-all duration-200"
                      title="Open settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showMobileMenu && (
            <div className="lg:hidden mt-4 bg-white rounded-xl border border-gray-200 p-4">
              <div className="space-y-2">
                <button
                  onClick={() => { setActiveView('enhanced'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'enhanced' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  Converter
                </button>
                <button
                  onClick={() => { setActiveView('tokens'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'tokens' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  Token Management
                </button>
                <button
                  onClick={() => { setActiveView('bulk'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'bulk' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  Bulk Convert
                </button>
                <button
                  onClick={() => { setActiveView('history'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'history' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => { setActiveView('api'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'api' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  API
                </button>
                <button
                  onClick={() => { setActiveView('storage'); setShowMobileMenu(false); }}
                  className={`block w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeView === 'storage' ? 'bg-blue-600 text-white' : 'text-black hover:bg-gray-100 hover:text-black'
                  }`}
                >
                  Data Storage
                </button>
                {!user && (
                  <button
                    onClick={() => { setShowAuthModal(true); setShowMobileMenu(false); }}
                    className="block w-full text-left px-4 py-3 bg-orange-500 text-white rounded-xl mt-4 font-semibold"
                  >
                    Get Started
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        {activeView === 'enhanced' && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">
                Designer Desktop to Alteryx One 
              </h1>
              <p className="text-[#c7d4dd] text-lg">
                Advanced XML to JSON conversion with comprehensive workflow and dataset management capabilities.
              </p>
            </div>
            
            <EnhancedConverterWithDatasets onConvert={handleConversionComplete} />
            
            <footer className="mt-16 pt-8 border-t border-white/20 text-center">
              <p className="text-white text-sm mb-2">
                Enhanced XML to JSON Converter with Dataset Management
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
