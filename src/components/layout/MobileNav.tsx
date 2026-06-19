import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  CreditCard,
  Package,
  Truck,
  Megaphone,
  BarChart3,
  Settings,
  Store,
  TrendingUp,
  Target,
  ShieldCheck,
  FileImage,
  Bell,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useAppStore } from '../../store';

const ALL_NAV_ITEMS = [
  { to: '/',               icon: LayoutDashboard, label: 'Inicio'    },
  { to: '/clientes',       icon: Users,           label: 'Clientes'  },
  { to: '/pedidos',        icon: ShoppingBag,     label: 'Pedidos'   },
  { to: '/pagos',          icon: CreditCard,      label: 'Pagos'     },
  { to: '/recordatorios',  icon: Bell,            label: 'Cobros'    },
  { to: '/productos',      icon: Package,         label: 'Productos' },
  { to: '/proveedores',    icon: Store,           label: 'Prov.'     },
  { to: '/entregas',       icon: Truck,           label: 'Entregas'  },
  { to: '/garantias',      icon: ShieldCheck,     label: 'Garantías' },
  { to: '/comprobantes',   icon: FileImage,       label: 'Comprobant'},
  { to: '/publicaciones',  icon: Megaphone,       label: 'Publi.'    },
  { to: '/reportes',       icon: BarChart3,       label: 'Reportes'  },
  { to: '/finanzas',       icon: TrendingUp,      label: 'Finanzas'  },
  { to: '/metas',          icon: Target,          label: 'Metas'     },
  { to: '/configuracion',  icon: Settings,        label: 'Config.'   },
];

export function MobileNav() {
  const { filterNavItems } = usePermissions();
  const { clients, orders } = useAppStore();
  const navItems = filterNavItems(ALL_NAV_ITEMS);

  const debtorCount = clients.filter(c => {
    const debt = orders
      .filter(o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status))
      .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
    return debt > 0;
  }).length;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex overflow-x-auto scrollbar-hide">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center min-w-[60px] flex-shrink-0 py-2 px-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`relative p-1.5 rounded-xl mb-0.5 transition-colors ${
                    isActive ? 'bg-primary-50' : ''
                  }`}
                >
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                  {to === '/recordatorios' && debtorCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {debtorCount}
                    </span>
                  )}
                </div>
                <span className="truncate w-full text-center px-0.5 max-w-[56px]">{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
