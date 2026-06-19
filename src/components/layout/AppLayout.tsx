import { Outlet, useLocation } from 'react-router-dom';
import { Shield, Clock } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { usePermissions } from '../../hooks/usePermissions';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';

function AccessDenied() {
  return (
    <div className="text-center py-20">
      <Shield size={48} className="text-gray-200 mx-auto mb-4" />
      <p className="text-gray-600 font-semibold text-lg">Acceso no autorizado</p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
        No tienes permisos para ver esta sección. Contacta al administrador para solicitar acceso.
      </p>
    </div>
  );
}

function InactivityWarning({ onStay }: { onStay: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
          <Clock size={28} className="text-amber-500" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base">Tu sesión está por cerrarse</p>
          <p className="text-sm text-gray-500 mt-1">
            Por inactividad, la sesión se cerrará en 2 minutos.
          </p>
        </div>
        <button onClick={onStay} className="btn-primary w-full justify-center">
          Seguir en la app
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { canAccess } = usePermissions();
  const { pathname }  = useLocation();
  const { showWarning, stayActive } = useInactivityLogout();

  const basePath  = '/' + (pathname.split('/')[1] ?? '');
  const hasAccess = canAccess(basePath);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto lg:pb-6" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6 lg:!pb-6">
            {hasAccess ? <Outlet /> : <AccessDenied />}
          </div>
        </main>
      </div>
      <MobileNav />
      {showWarning && <InactivityWarning onStay={stayActive} />}
    </div>
  );
}
