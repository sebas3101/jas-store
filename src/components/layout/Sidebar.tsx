import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, CreditCard, Package,
  Truck, Megaphone, BarChart3, Settings, LogOut, Store,
  TrendingUp, Target, ShieldCheck, FileImage, Bell, Receipt, CalendarDays,
} from 'lucide-react';
import { useAppStore } from '../../store';
import { usePermissions } from '../../hooks/usePermissions';
import { GlobalSearch } from '../ui/GlobalSearch';
import logoUrl from '../../assets/logo.jpeg';
import { roleLabel } from '../../utils/formatters';
import { calculateClientDebt } from '../../utils/businessLogic';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Inicio' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { to: '/clientes',      icon: Users,      label: 'Clientes'      },
      { to: '/pedidos',       icon: ShoppingBag,label: 'Pedidos'       },
      { to: '/calendario',    icon: CalendarDays,label: 'Calendario'   },
      { to: '/pagos',         icon: CreditCard, label: 'Pagos'         },
      { to: '/comprobantes',  icon: FileImage,  label: 'Comprobantes'  },
      { to: '/recordatorios', icon: Bell,       label: 'Recordatorios' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/productos',    icon: Package,    label: 'Productos'    },
      { to: '/proveedores',  icon: Store,      label: 'Proveedores'  },
      { to: '/entregas',     icon: Truck,      label: 'Entregas'     },
      { to: '/garantias',    icon: ShieldCheck,label: 'Garantías'    },
      { to: '/publicaciones',icon: Megaphone,  label: 'Publicaciones'},
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { to: '/reportes', icon: BarChart3,  label: 'Reportes' },
      { to: '/finanzas', icon: TrendingUp, label: 'Finanzas' },
      { to: '/gastos',   icon: Receipt,    label: 'Gastos'   },
      { to: '/metas',    icon: Target,     label: 'Metas'    },
    ],
  },
  {
    label: null,
    items: [
      { to: '/configuracion', icon: Settings, label: 'Configuración' },
    ],
  },
];

export function Sidebar() {
  const { currentUser, logout, clients, orders } = useAppStore();
  const { filterNavItems } = usePermissions();

  const allowedGroups = NAV_GROUPS.map(g => ({
    label: g.label,
    items: filterNavItems(g.items),
  })).filter(g => g.items.length > 0);

  const debtorCount = clients.filter(c => calculateClientDebt(c.id, orders) > 0).length;

  const initial = currentUser?.name.charAt(0).toUpperCase() ?? '?';

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #12121f 100%)' }}>

      {/* Thin purple accent line at top */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary-600 via-primary-500 to-primary-800 flex-shrink-0" />

      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/8 flex-shrink-0">
        <div className="relative">
          <img src={logoUrl} alt="JAS Store" className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary-500/30" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0f0f1a]" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm tracking-tight">JAS Store</p>
          <p className="text-[11px] text-slate-500 font-medium">Sistema de Gestión</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-white/8 flex-shrink-0">
        <GlobalSearch dark />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide space-y-3">
        {allowedGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pt-1 pb-1.5 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 relative group'
                      : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-all duration-150 group'
                  }
                  style={({ isActive }) => isActive
                    ? { background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', boxShadow: '0 2px 12px rgb(124 58 237 / 0.4)' }
                    : undefined
                  }
                >
                  {({ isActive }) => (
                    <>
                      {!isActive && (
                        <span className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/8 transition-colors duration-150 pointer-events-none" />
                      )}
                      <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className="flex-shrink-0 relative" />
                      <span className="flex-1 relative">{label}</span>
                      {to === '/recordatorios' && debtorCount > 0 && (
                        <span className="relative min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                          {debtorCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
            {gi < allowedGroups.length - 1 && group.label && (
              <div className="border-t border-white/8 mt-3" />
            )}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' }}>
            <span className="text-white font-bold text-sm">{initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentUser?.name}</p>
            <p className="text-[11px] text-slate-500">{currentUser ? roleLabel[currentUser.role] : ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
         type="button">
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
