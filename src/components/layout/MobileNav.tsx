import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, CreditCard, Package,
  Truck, Megaphone, BarChart3, Settings, Store, TrendingUp,
  Target, ShieldCheck, FileImage, Bell, Receipt, MoreHorizontal, X, CalendarDays,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store';

const PINNED_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Inicio'        },
  { to: '/clientes',      icon: Users,           label: 'Clientes'      },
  { to: '/pedidos',       icon: ShoppingBag,     label: 'Pedidos'       },
  { to: '/comprobantes',  icon: FileImage,       label: 'Comprobantes'  },
  { to: '/recordatorios', icon: Bell,            label: 'Cobros'        },
];

const MORE_ITEMS = [
  { to: '/pagos',         icon: CreditCard,   label: 'Pagos'      },
  { to: '/calendario',    icon: CalendarDays, label: 'Calendario' },
  { to: '/productos',     icon: Package,      label: 'Productos'  },
  { to: '/proveedores',   icon: Store,      label: 'Proveedores'  },
  { to: '/entregas',      icon: Truck,      label: 'Entregas'     },
  { to: '/garantias',     icon: ShieldCheck,label: 'Garantías'    },
  { to: '/comprobantes',  icon: FileImage,  label: 'Comprobantes' },
  { to: '/publicaciones', icon: Megaphone,  label: 'Publicaciones'},
  { to: '/reportes',      icon: BarChart3,  label: 'Reportes'     },
  { to: '/finanzas',      icon: TrendingUp, label: 'Finanzas'     },
  { to: '/gastos',        icon: Receipt,    label: 'Gastos'       },
  { to: '/metas',         icon: Target,     label: 'Metas'        },
  { to: '/configuracion', icon: Settings,   label: 'Configuración'},
];

export function MobileNav() {
  const { filterNavItems } = usePermissions();
  const { clients, getClientDebt } = useAppStore();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const debtorCount = clients.filter(c => getClientDebt(c.id) > 0).length;

  const allowedPinned = filterNavItems(PINNED_ITEMS);
  const allowedMore   = filterNavItems(MORE_ITEMS);
  const moreIsActive  = allowedMore.some(item => pathname.startsWith(item.to));

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxShadow: '0 -1px 0 0 rgb(0 0 0 / 0.06)' }}
      >
        <div className="flex">
          {allowedPinned.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center flex-1 py-2 px-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary-600" />
                  )}
                  <div className={`relative p-1.5 rounded-xl mb-0.5 transition-colors ${isActive ? 'bg-primary-50' : ''}`}>
                    <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                    {to === '/recordatorios' && debtorCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {debtorCount}
                      </span>
                    )}
                  </div>
                  <span className="truncate w-full text-center">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {allowedMore.length > 0 && (
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={`relative flex flex-col items-center justify-center flex-1 py-2 px-1 text-[11px] font-medium transition-colors ${
                moreIsActive || moreOpen ? 'text-primary-600' : 'text-gray-400'
              }`}
             type="button">
              {(moreIsActive || moreOpen) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary-600" />
              )}
              <div className={`p-1.5 rounded-xl mb-0.5 ${moreIsActive || moreOpen ? 'bg-primary-50' : ''}`}>
                <MoreHorizontal size={19} strokeWidth={moreOpen ? 2.5 : 1.8} />
              </div>
              <span>Más</span>
            </button>
          )}
        </div>
      </nav>

      {/* Bottom sheet "Más" */}
      {moreOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-sm font-bold text-gray-800">Más secciones</h3>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors" type="button">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 px-4 pb-5 pt-2">
              {allowedMore.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-colors ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
