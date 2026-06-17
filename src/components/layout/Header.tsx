import { useState } from 'react';
import { Bell, LogOut, X, AlertTriangle, Package, CreditCard, BellOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import { formatCurrency } from '../../utils/formatters';
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

type NotifSeverity = 'high' | 'medium' | 'low';

interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: NotifSeverity;
  icon: typeof AlertTriangle;
}

const severityColors: Record<NotifSeverity, string> = {
  high:   'bg-red-50 border-red-100',
  medium: 'bg-amber-50 border-amber-100',
  low:    'bg-blue-50 border-blue-100',
};

const severityIconColors: Record<NotifSeverity, string> = {
  high:   'text-red-500',
  medium: 'text-amber-500',
  low:    'text-blue-500',
};

const severityDotColors: Record<NotifSeverity, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-blue-400',
};

export function Header() {
  const { currentUser, orders, clients, logout } = useAppStore();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const basePath = '/' + (pathname.split('/')[1] ?? '');
  const pageTitle = PAGE_TITLES[basePath] ?? 'JAS Store';

  // Build notifications from real data
  const notifications: AppNotification[] = [];

  // Clients in mora
  clients.filter(c => c.status === 'mora').forEach(c => {
    const debt = orders
      .filter(o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
    if (debt > 0) {
      notifications.push({
        id: `mora_${c.id}`,
        title: 'Cliente en mora',
        description: `${c.name} — debe ${formatCurrency(debt)}`,
        severity: 'high',
        icon: AlertTriangle,
      });
    }
  });

  // Orders por recoger
  const porRecoger = orders.filter(o => o.status === 'por_recoger').length;
  if (porRecoger > 0) {
    notifications.push({
      id: 'por_recoger',
      title: 'Pedidos por recoger',
      description: `${porRecoger} pedido${porRecoger > 1 ? 's' : ''} esperando recogida`,
      severity: 'medium',
      icon: Package,
    });
  }

  // Orders pendiente_pago
  const pendientePago = orders.filter(o => o.status === 'pendiente_pago').length;
  if (pendientePago > 0) {
    notifications.push({
      id: 'pendiente_pago',
      title: 'Pagos pendientes',
      description: `${pendientePago} pedido${pendientePago > 1 ? 's' : ''} con pago pendiente`,
      severity: 'medium',
      icon: CreditCard,
    });
  }

  const alertCount = notifications.length;

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <img src={logoUrl} alt="JAS" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        <p className="font-bold text-gray-900 text-sm flex-1 truncate">{pageTitle}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setNotifOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 relative"
            aria-label={`Notificaciones${alertCount > 0 ? ` (${alertCount})` : ''}`}
          >
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

      {/* Notification sheet */}
      {notifOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNotifOpen(false)} />
          <div className="relative w-full bg-white rounded-t-2xl shadow-2xl pb-safe max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-gray-600" />
                <h2 className="font-bold text-gray-900 text-sm">Notificaciones</h2>
                {alertCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {alertCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <BellOff size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Sin notificaciones</p>
                  <p className="text-xs text-gray-400 text-center">
                    No hay alertas pendientes en este momento.
                  </p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = n.icon;
                  return (
                    <div key={n.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${severityColors[n.severity]}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${severityIconColors[n.severity]}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityDotColors[n.severity]}`} />
                          <p className="text-xs font-bold text-gray-800">{n.title}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.description}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
