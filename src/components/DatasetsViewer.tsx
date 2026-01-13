import { useState, useEffect } from 'react';
import { Database, Search, Eye, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Dataset {
  id: string;
  name: string;
  source: string;
  owner: string;
  location: string;
  createdOn: string;
  lastRefresh: string;
  rows: number;
  fields: any[];
  type: string;
}

export function DatasetsViewer() {
  const { user } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  useEffect(() => {
    loadDatasets();
  }, [user]);

  const loadDatasets = () => {
    if (!user) return;
    
    const storedDatasets = JSON.parse(localStorage.getItem('alteryx_datasets') || '[]');
    const userDatasets = storedDatasets.filter((d: Dataset) => d.owner === user.email);
    setDatasets(userDatasets);
  };

  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteDataset = (datasetId: string) => {
    const updatedDatasets = datasets.filter(d => d.id !== datasetId);
    setDatasets(updatedDatasets);
    
    // Update localStorage
    const allDatasets = JSON.parse(localStorage.getItem('alteryx_datasets') || '[]');
    const filteredAll = allDatasets.filter((d: Dataset) => d.id !== datasetId);
    localStorage.setItem('alteryx_datasets', JSON.stringify(filteredAll));
    
    // Remove content
    const allContent = JSON.parse(localStorage.getItem('dataset_content') || '[]');
    const filteredContent = allContent.filter((c: any) => c.datasetId !== datasetId);
    localStorage.setItem('dataset_content', JSON.stringify(filteredContent));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Please sign in to view your datasets</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Datasets</h2>
            <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
              {datasets.length} Datasets
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Datasets List */}
      <div className="divide-y divide-gray-200">
        {filteredDatasets.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm ? 'No datasets found matching your search' : 'No datasets yet. Upload XML files to create datasets.'}
            </p>
          </div>
        ) : (
          filteredDatasets.map((dataset) => (
            <div key={dataset.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">{dataset.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span>{dataset.source}</span>
                      <span>•</span>
                      <span>{dataset.rows} rows</span>
                      <span>•</span>
                      <span>{formatDate(dataset.lastRefresh)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDataset(dataset)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDataset(dataset.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete Dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dataset Details Modal */}
      {selectedDataset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{selectedDataset.name}</h3>
                <button
                  onClick={() => setSelectedDataset(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-700">Location</label>
                  <p className="text-sm text-gray-600 break-all">{selectedDataset.location}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Owner</label>
                  <p className="text-sm text-gray-600">{selectedDataset.owner}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created On</label>
                  <p className="text-sm text-gray-600">{formatDate(selectedDataset.createdOn)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700"># of Rows</label>
                  <p className="text-sm text-gray-600">{selectedDataset.rows}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Fields</label>
                <div className="space-y-2">
                  {selectedDataset.fields.map((field, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{field.name}</span>
                      <span className="text-xs text-gray-500">{field.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}