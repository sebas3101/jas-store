import { useState } from 'react';
import { Bell, LogOut, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import logoUrl from '../../assets/logo.jpeg';

const PAGE_TITLES: Record<string, string> = {
  '/':              'Inicio',
  '/clientes':      'Clientes',
  '/pedidos':       'Pedidos',
  '/pagos':         'Pagos y abonos',
  '/productos':     'Productos',
  '/proveedores':   'Proveedores',
  '/entregas':      'Entregas',
  '/publicaciones': 'Publicaciones',
  '/reportes':      'Reportes',
  '/finanzas':      'Finanzas',
  '/metas':         'Metas',
  '/configuracion': 'Configuración',
};

export function Header() {
  const { currentUser, orders, clients, logout } = useAppStore();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const pageTitle = PAGE_TITLES[basePath] ?? 'JAS Store';

  const alertCount =
    orders.filter(
      (o) => o.status === 'por_recoger' || o.status === 'pendiente_pago'
    ).length +
    clients.filter((c) => c.status === 'mora').length;

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <img src={logoUrl} alt="JAS" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        <p className="font-bold text-gray-900 text-sm flex-1 truncate">{pageTitle}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button className="p-2 rounded-xl hover:bg-gray-100 relative" aria-label="Alertas">
            <Bell size={18} className="text-gray-500" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center"
            aria-label="Menú de usuario"
          >
            <span className="text-primary-700 font-bold text-xs">
              {currentUser?.name.charAt(0).toUpperCase()}
            </span>
          </button>
        </div>
      </header>

      {/* User menu sheet */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-2xl p-5 pb-safe space-y-4">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-2" />
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary-100 rounded-2xl flex items-center justify-center">
                <span className="text-primary-700 font-bold text-lg">
                  {currentUser?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{currentUser?.name}</p>
                <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
              </div>
              <button onClick={() => setMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-sm transition-colors"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );
}
