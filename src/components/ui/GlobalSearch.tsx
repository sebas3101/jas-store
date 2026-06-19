import { useState, useEffect, useRef } from 'react';
import { Search, X, Users, ShoppingBag, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { formatCurrency } from '../../utils/formatters';

interface Result {
  id:       string;
  label:    string;
  sub:      string;
  icon:     typeof Users;
  color:    string;
  href:     string;
}

export function GlobalSearch() {
  const { clients, orders, products } = useAppStore();
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Abrir con Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();

  const results: Result[] = q.length < 2 ? [] : [
    ...clients
      .filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q))
      .slice(0, 3)
      .map(c => ({
        id:    c.id,
        label: c.name,
        sub:   `${c.phone ?? ''} · ${c.status.replace('_', ' ')}`,
        icon:  Users,
        color: 'bg-blue-50 text-blue-600',
        href:  `/clientes/${c.id}`,
      })),
    ...orders
      .filter(o => o.orderNumber.toLowerCase().includes(q) ||
        clients.find(c => c.id === o.clientId)?.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map(o => ({
        id:    o.id,
        label: o.orderNumber,
        sub:   `${clients.find(c => c.id === o.clientId)?.name ?? ''} · ${formatCurrency(o.totalAmount)}`,
        icon:  ShoppingBag,
        color: 'bg-purple-50 text-purple-600',
        href:  `/pedidos/${o.id}`,
      })),
    ...products
      .filter(p => p.name.toLowerCase().includes(q) || p.reference?.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({
        id:    p.id,
        label: p.name,
        sub:   formatCurrency(p.salePrice),
        icon:  Package,
        color: 'bg-emerald-50 text-emerald-600',
        href:  '/productos',
      })),
  ];

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-400 text-sm transition-colors w-full"
        aria-label="Buscar"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-400">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar clientes, pedidos, productos..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {q.length < 2 ? (
                <p className="text-xs text-gray-400 text-center py-8">Escribe al menos 2 caracteres</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">Sin resultados para "{query}"</p>
              ) : (
                <ul className="p-2 space-y-0.5">
                  {results.map(r => {
                    const Icon = r.icon;
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => go(r.href)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${r.color}`}>
                            <Icon size={15} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{r.label}</p>
                            <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
