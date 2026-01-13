import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  name?: string;
  level?: number;
}

export function JsonViewer({ data, name = 'JSON', level = 0 }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [copied, setCopied] = useState(false);

  const getValueType = (value: any): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const getValueColor = (value: any): string => {
    const type = getValueType(value);
    switch (type) {
      case 'string': return 'text-green-400';
      case 'number': return 'text-blue-400';
      case 'boolean': return 'text-purple-400';
      case 'null': return 'text-gray-500';
      default: return 'text-gray-300';
    }
  };

  const formatValue = (value: any): string => {
    const type = getValueType(value);
    switch (type) {
      case 'string': return `"${value}"`;
      case 'null': return 'null';
      default: return String(value);
    }
  };

  const copyValue = async (value: any) => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const isExpandable = (value: any): boolean => {
    return typeof value === 'object' && value !== null;
  };

  const getPreview = (value: any): string => {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      // Don't show preview for objects with numeric keys (our indexed structure)
      if (keys.every(key => /^\d+$/.test(key))) {
        return '';
      }
      return `{${keys.length} keys}`;
    }
    return '';
  };

  const indent = level * 16;

  if (!isExpandable(data)) {
    return (
      <div 
        className="flex items-center justify-between group hover:bg-white/5 rounded px-2 py-1"
        style={{ paddingLeft: `${indent}px` }}
      >
        <div className="flex items-center">
          {name.startsWith('@') ? (
            <>
              <span className="text-orange-400 mr-1 font-medium">{name}</span>
              <span className="text-gray-400 mr-1">:</span>
              <span className={getValueColor(data)}>{formatValue(data)}</span>
            </>
          ) : (
            <>
              <span className="text-cyan-300 mr-2 font-medium">{name}:</span>
              <span className={getValueColor(data)}>{formatValue(data)}</span>
            </>
          )}
        </div>
        <button
          onClick={() => copyValue(data)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div 
        className="flex items-center justify-between group hover:bg-white/5 rounded px-2 py-1 cursor-pointer"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 mr-1" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 mr-1" />
          )}
          <span className="text-cyan-300 mr-2 font-medium">{name}</span>
          <span className="text-gray-400 text-sm">{getPreview(data)}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyValue(data);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="border-l border-white/10 ml-2" style={{ marginLeft: `${indent + 8}px` }}>
          {Array.isArray(data) ? (
            data.map((item, index) => (
              <JsonViewer
                key={index}
                data={item}
                name={`[${index}]`}
                level={level + 1}
              />
            ))
          ) : (
            Object.entries(data)
              .sort(([a], [b]) => {
                // Sort attributes (@) first, then numeric keys, then alphabetical
                if (a.startsWith('@') && !b.startsWith('@')) return -1;
                if (!a.startsWith('@') && b.startsWith('@')) return 1;
                if (/^\d+$/.test(a) && /^\d+$/.test(b)) return parseInt(a) - parseInt(b);
                if (/^\d+$/.test(a) && !/^\d+$/.test(b)) return 1;
                if (!/^\d+$/.test(a) && /^\d+$/.test(b)) return -1;
                return a.localeCompare(b);
              })
              .map(([key, value]) => (
                <JsonViewer
                  key={key}
                  data={value}
                  name={key}
                  level={level + 1}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}