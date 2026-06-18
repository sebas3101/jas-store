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
  LogOut,
  Store,
  TrendingUp,
  Target,
  ShieldCheck,
  FileImage,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import logoUrl from '../../assets/logo.jpeg';
import { roleLabel } from '../../utils/formatters';

const ALL_NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Inicio'        },
  { to: '/clientes',      icon: Users,           label: 'Clientes'      },
  { to: '/pedidos',       icon: ShoppingBag,     label: 'Pedidos'       },
  { to: '/pagos',         icon: CreditCard,      label: 'Pagos'         },
  { to: '/productos',     icon: Package,         label: 'Productos'     },
  { to: '/proveedores',   icon: Store,           label: 'Proveedores'   },
  { to: '/entregas',      icon: Truck,           label: 'Entregas'      },
  { to: '/garantias',     icon: ShieldCheck,     label: 'Garantías'     },
  { to: '/comprobantes',  icon: FileImage,       label: 'Comprobantes'  },
  { to: '/publicaciones', icon: Megaphone,       label: 'Publicaciones' },
  { to: '/reportes',      icon: BarChart3,       label: 'Reportes'      },
  { to: '/finanzas',      icon: TrendingUp,      label: 'Finanzas'      },
  { to: '/metas',         icon: Target,          label: 'Metas'         },
  { to: '/configuracion', icon: Settings,        label: 'Configuración' },
];

export function Sidebar() {
  const { currentUser, logout } = useAppStore();
  const { filterNavItems } = usePermissions();
  const navItems = filterNavItems(ALL_NAV_ITEMS);

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 h-screen sticky top-0 shadow-sm">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-3">
        <img src={logoUrl} alt="JAS Store" className="w-10 h-10 rounded-xl object-cover" />
        <div>
          <p className="font-bold text-gray-900 text-sm">JAS Store</p>
          <p className="text-xs text-gray-400">Sistema de Gestión</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <span className="text-primary-700 font-bold text-sm">
              {currentUser?.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {currentUser?.name}
            </p>
            <p className="text-xs text-gray-400">
              {currentUser ? roleLabel[currentUser.role] : ''}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn-ghost w-full justify-center text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
