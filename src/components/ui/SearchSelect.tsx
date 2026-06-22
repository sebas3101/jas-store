import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  required,
  className = '',
}: SearchSelectProps) {
  const selected = options.find(o => o.value === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)
    : options.slice(0, 30);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (opt: Option) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for native form required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, height: 0, pointerEvents: 'none' }}
        />
      )}

      {/* Display field */}
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={`input-field text-left flex items-center justify-between gap-2 w-full ${!value ? 'text-gray-400' : 'text-gray-900'}`}
        >
          <span className="truncate flex-1">
            {selected ? (
              <span>
                {selected.label}
                {selected.sublabel && <span className="text-gray-400 text-xs ml-1">· {selected.sublabel}</span>}
              </span>
            ) : placeholder}
          </span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span onClick={e => { e.stopPropagation(); clear(); }}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={13} />
              </span>
            )}
            <Search size={13} className="text-gray-400" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            className="input-field pl-8 pr-8 w-full"
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); select(filtered[0]); }
            }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-gray-400 text-center">Sin resultados</li>
          ) : filtered.map(opt => (
            <li key={opt.value}>
              <button
                type="button"
                onMouseDown={() => select(opt)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 transition-colors flex flex-col gap-0.5 ${opt.value === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-800'}`}
              >
                <span>{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-gray-400">{opt.sublabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
