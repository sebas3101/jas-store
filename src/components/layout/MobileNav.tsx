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
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

const ALL_NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Inicio'    },
  { to: '/clientes',     icon: Users,           label: 'Clientes'  },
  { to: '/pedidos',      icon: ShoppingBag,     label: 'Pedidos'   },
  { to: '/pagos',        icon: CreditCard,      label: 'Pagos'     },
  { to: '/productos',    icon: Package,         label: 'Productos' },
  { to: '/proveedores',  icon: Store,           label: 'Prov.'     },
  { to: '/entregas',     icon: Truck,           label: 'Entregas'  },
  { to: '/publicaciones',icon: Megaphone,       label: 'Publi.'    },
  { to: '/reportes',     icon: BarChart3,       label: 'Reportes'  },
  { to: '/finanzas',     icon: TrendingUp,      label: 'Finanzas'  },
  { to: '/metas',        icon: Target,          label: 'Metas'     },
  { to: '/configuracion',icon: Settings,        label: 'Config.'   },
];

export function MobileNav() {
  const { filterNavItems } = usePermissions();
  const navItems = filterNavItems(ALL_NAV_ITEMS);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg">
      <div className="flex overflow-x-auto scrollbar-hide">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center min-w-[64px] py-2 px-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1.5 rounded-xl mb-0.5 ${
                    isActive ? 'bg-primary-50' : ''
                  }`}
                >
                  <Icon size={20} />
                </div>
                <span className="truncate max-w-[52px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
