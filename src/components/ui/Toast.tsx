import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

// ── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Item individual ───────────────────────────────────────────────────────────

function ToastItem({ toast: t, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Entrada
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : AlertTriangle;
  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  const iconColors = {
    success: 'text-emerald-500',
    error:   'text-red-500',
    warning: 'text-amber-500',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-xs transition-all duration-300 ${colors[t.type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <Icon size={16} className={`flex-shrink-0 ${iconColors[t.type]}`} />
      <p className="text-sm font-medium flex-1">{t.message}</p>
      <button onClick={onClose} className="flex-shrink-0 hover:opacity-60 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}
