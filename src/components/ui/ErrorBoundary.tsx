import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
            <RefreshCw size={24} className="text-red-400" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Algo salió mal</p>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">
              Ocurrió un error inesperado en esta sección. Recarga la página para continuar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Recargar
          </button>
          {import.meta.env.DEV && (
            <pre className="text-xs text-left text-red-600 bg-red-50 rounded-xl p-4 max-w-lg overflow-auto max-h-48">
              {this.state.error.stack ?? this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
