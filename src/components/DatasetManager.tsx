import { useState } from 'react';
import { Plus, Trash2, Database } from 'lucide-react';

export interface Dataset {
  id: string;
  name: string;
  datasetId: string;
  path: string;
}

interface DatasetManagerProps {
  datasets: Dataset[];
  onDatasetsChange: (datasets: Dataset[]) => void;
}

export function DatasetManager({ datasets, onDatasetsChange }: DatasetManagerProps) {
  const addDataset = () => {
    const newDataset: Dataset = {
      id: Date.now().toString(),
      name: '',
      datasetId: '',
      path: ''
    };
    onDatasetsChange([...datasets, newDataset]);
  };

  const removeDataset = (id: string) => {
    onDatasetsChange(datasets.filter(dataset => dataset.id !== id));
  };

  const updateDataset = (id: string, field: keyof Omit<Dataset, 'id'>, value: string) => {
    onDatasetsChange(
      datasets.map(dataset =>
        dataset.id === id ? { ...dataset, [field]: value } : dataset
      )
    );
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="text-xl font-semibold text-black">Dataset Configuration</h3>
        </div>
        <button
          onClick={addDataset}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Dataset
        </button>
      </div>

      {datasets.length === 0 ? (
        <div className="text-center py-8 text-black">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No datasets configured. Click "Add Dataset" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {datasets.map((dataset, index) => (
            <div key={dataset.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-black font-medium">Dataset {index + 1}</h4>
                <button
                  onClick={() => removeDataset(dataset.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Remove dataset"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Dataset Name *
                  </label>
                  <input
                    type="text"
                    value={dataset.name}
                    onChange={(e) => updateDataset(dataset.id, 'name', e.target.value)}
                    placeholder="Enter dataset name"
                    className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-black text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Dataset ID *
                  </label>
                  <input
                    type="text"
                    value={dataset.datasetId}
                    onChange={(e) => updateDataset(dataset.id, 'datasetId', e.target.value)}
                    placeholder="Enter dataset ID"
                    className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-black text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Dataset Path *
                  </label>
                  <input
                    type="text"
                    value={dataset.path}
                    onChange={(e) => updateDataset(dataset.id, 'path', e.target.value)}
                    placeholder="Enter dataset path"
                    className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-black text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}