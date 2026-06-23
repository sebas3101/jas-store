import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Chequear si hay nueva versión cada 10 minutos
      if (registration) {
        setInterval(() => registration.update(), 10 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
          <RefreshCw size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Nueva versión disponible</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Toca para actualizar la app</p>
        </div>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="flex-shrink-0 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
