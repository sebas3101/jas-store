import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShoppingBag,
  Clock,
  Package,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAppStore } from '../store';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, formatDate, orderStatusLabel } from '../utils/formatters';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export function DashboardPage() {
  const { orders, clients, payments, products, currentUser } = useAppStore();

  const now = new Date();

  // KPIs
  const totalSales   = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.totalAmount, 0);
  const totalPaid    = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.amountPaid, 0);
  const totalPending = totalSales - totalPaid;
  const totalProfit  = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + (o.totalAmount - o.totalCost), 0);

  const clientsWithDebt  = clients.filter(c => c.status === 'mora' || c.status === 'pendiente').length;
  const clientsUpToDate  = clients.filter(c => c.status === 'al_dia').length;
  const pendingOrders    = orders.filter(o => !['pagado','cancelado','entregado'].includes(o.status)).length;
  const deliveredOrders  = orders.filter(o => o.status === 'entregado' || o.status === 'pagado').length;
  const ordersToPickup   = orders.filter(o => o.status === 'por_recoger').length;

  // Weekly sales chart
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weeklyData = weekDays.map(day => {
    const dayStr = format(day, 'EEE', { locale: es });
    const dayTotal = payments
      .filter(p => {
        try {
          const d = parseISO(p.date);
          return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
        } catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);
    return { day: dayStr, monto: dayTotal };
  });

  // Order status distribution
  const statusGroups = [
    { name: 'Entregado/Pagado', value: deliveredOrders, color: '#10b981' },
    { name: 'Pendiente',        value: orders.filter(o => o.status === 'pendiente_pago').length, color: '#f59e0b' },
    { name: 'En proceso',       value: orders.filter(o => ['tomado','recogido','por_recoger'].includes(o.status)).length, color: '#7c3aed' },
    { name: 'Cancelado',        value: orders.filter(o => o.status === 'cancelado').length, color: '#e5e7eb' },
  ].filter(g => g.value > 0);

  // Recent orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Alerts
  const alerts = [
    ...clients.filter(c => c.status === 'mora').map(c => ({
      type: 'mora' as const,
      msg: `${c.name} está en mora`,
      link: `/clientes/${c.id}`,
      color: 'text-red-600 bg-red-50',
    })),
    ...orders.filter(o => o.status === 'por_recoger').map(o => {
      const client = clients.find(c => c.id === o.clientId);
      return {
        type: 'recoger' as const,
        msg: `Pedido ${o.orderNumber} por recoger${client ? ` — ${client.name}` : ''}`,
        link: `/pedidos/${o.id}`,
        color: 'text-amber-600 bg-amber-50',
      };
    }),
    ...products.filter(p => p.status === 'agotado').map(p => ({
      type: 'agotado' as const,
      msg: `${p.name} está agotado`,
      link: '/productos',
      color: 'text-gray-600 bg-gray-50',
    })),
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="page-title">
          Hola, {currentUser?.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Resumen general del negocio al {format(now, "d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas totales"
          value={formatCurrency(totalSales)}
          icon={DollarSign}
          color="purple"
          subtitle={`${orders.filter(o => o.status !== 'cancelado').length} pedidos`}
        />
        <StatCard
          title="Por cobrar"
          value={formatCurrency(totalPending)}
          icon={Clock}
          color="yellow"
          subtitle={`${clientsWithDebt} clientes con deuda`}
        />
        <StatCard
          title="Total cobrado"
          value={formatCurrency(totalPaid)}
          icon={CheckCircle2}
          color="green"
          subtitle={`${clientsUpToDate} clientes al día`}
        />
        <StatCard
          title="Ganancia est."
          value={formatCurrency(totalProfit)}
          icon={TrendingUp}
          color="blue"
          subtitle={`Margen sobre ventas`}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Activos"      value={pendingOrders}   icon={ShoppingBag}  color="purple" />
        <StatCard title="Entregados"   value={deliveredOrders} icon={CheckCircle2} color="green"  />
        <StatCard title="Por recoger"  value={ordersToPickup}  icon={Package}      color="yellow" />
        <StatCard title="Con deuda"    value={clientsWithDebt} icon={AlertTriangle} color="red"   className="hidden lg:flex" />
        <StatCard title="Al día"       value={clientsUpToDate} icon={Users}        color="green"  className="hidden lg:flex" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly bar */}
        <div className="card lg:col-span-2">
          <h2 className="section-title mb-4">Abonos esta semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Cobrado']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="monto" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card">
          <h2 className="section-title mb-4">Estado pedidos</h2>
          {statusGroups.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={statusGroups} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    paddingAngle={3} dataKey="value">
                    {statusGroups.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [v, 'pedidos']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusGroups.map((g) => (
                  <div key={g.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <span className="text-gray-600 flex-1">{g.name}</span>
                    <span className="font-semibold text-gray-800">{g.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sin pedidos</p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Alertas</h2>
            <span className="badge-red">{alerts.length} alertas</span>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 size={28} className="text-emerald-400 mb-2" />
              <p className="text-sm text-gray-500">Todo al día ✓</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}>
                  <Link
                    to={a.link}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium ${a.color} hover:opacity-80 transition-opacity`}
                  >
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <span className="flex-1">{a.msg}</span>
                    <ArrowRight size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Pedidos recientes</h2>
            <Link to="/pedidos" className="text-xs text-primary-600 font-medium hover:underline">
              Ver todos
            </Link>
          </div>
          <ul className="space-y-2">
            {recentOrders.map((o) => {
              const client = clients.find(c => c.id === o.clientId);
              return (
                <li key={o.id}>
                  <Link
                    to={`/pedidos/${o.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={14} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {o.orderNumber} — {client?.name ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(o.orderDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
                      <span className={`text-[10px] font-semibold ${
                        o.status === 'pagado' ? 'text-emerald-600' :
                        o.status === 'pendiente_pago' ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {orderStatusLabel[o.status]}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
