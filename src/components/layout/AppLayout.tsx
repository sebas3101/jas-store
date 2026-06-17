import { Outlet, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { usePermissions } from '../../hooks/usePermissions';

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

export function AppLayout() {
  const { canAccess } = usePermissions();
  const { pathname } = useLocation();

  // Extrae la ruta base (/clientes/abc → /clientes, / → /)
  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const hasAccess = canAccess(basePath);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
            {hasAccess ? <Outlet /> : <AccessDenied />}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
