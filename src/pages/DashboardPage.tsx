import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
  ShoppingBag, Clock, Package, Users, ArrowRight,
  Star, TrendingDown, Target, Bell, Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useAppStore } from '../store';
import { calculateClientDebt } from '../utils/businessLogic';
import { useGoalsStore } from '../store/goals';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, formatDate, orderStatusLabel } from '../utils/formatters';
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getReminderLog, daysSinceReminder } from '../utils/reminders';

export function DashboardPage() {
  const { orders, clients, payments, products, currentUser, paymentProofs } = useAppStore();
  const { goals } = useGoalsStore();

  const now = new Date();

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalSales   = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.totalAmount, 0);
  const totalPaid    = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.amountPaid, 0);
  // Deuda real: solo pedidos entregados/pendiente_pago, usando la misma lógica centralizada
  const totalPending = clients.reduce((s, c) => s + calculateClientDebt(c.id, orders), 0);
  const totalProfit  = orders.filter(o => o.status === 'entregado' || o.status === 'pagado' || o.status === 'pendiente_pago').reduce((s, o) => s + (o.totalAmount - (o.totalCost ?? 0)), 0);

  const clientsWithDebt = clients.filter(c => c.status === 'mora' || c.status === 'pendiente').length;
  const clientsUpToDate = clients.filter(c => c.status === 'al_dia').length;
  const pendingOrders   = orders.filter(o => !['pagado','cancelado','entregado'].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'entregado' || o.status === 'pagado').length;
  const ordersToPickup  = orders.filter(o => o.status === 'por_recoger').length;

  // ── Proyección de cobranza ───────────────────────────────────────────────────
  const cobradoMes = payments.filter(p => {
    try {
      const d = parseISO(p.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  }).reduce((s, p) => s + p.amount, 0);

  const pctCobrado = (cobradoMes + totalPending) > 0
    ? Math.min(100, Math.round(cobradoMes / (cobradoMes + totalPending) * 100))
    : 100;

  // ── Recordatorios urgentes (15+ días sin abonar, sin recordar en 7 días) ─────
  const [reminderLog, setReminderLog] = useState<import('../utils/reminders').ReminderLog>({});
  useEffect(() => { getReminderLog().then(setReminderLog); }, []);
  const urgentReminders = clients.filter(c => {
    const debt = calculateClientDebt(c.id, orders);
    if (debt <= 0) return false;
    const lastPay = payments
      .filter(p => p.clientId === c.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const daysSincePay = lastPay
      ? differenceInDays(now, parseISO(lastPay.date))
      : 999;
    const daysRemind = daysSinceReminder(c.id, reminderLog);
    return daysSincePay >= 15 && (daysRemind === null || daysRemind >= 7);
  }).length;

  // ── Productos más vendidos del mes ───────────────────────────────────────────
  const monthOrders = orders.filter(o => {
    try {
      const d = parseISO(o.orderDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        && o.status !== 'cancelado';
    } catch { return false; }
  });
  const productSalesMap: Record<string, { name: string; units: number; revenue: number }> = {};
  monthOrders.forEach(o => o.items.forEach(it => {
    if (!productSalesMap[it.productId]) {
      productSalesMap[it.productId] = { name: it.productName, units: 0, revenue: 0 };
    }
    productSalesMap[it.productId].units += it.quantity;
    productSalesMap[it.productId].revenue += it.salePrice * it.quantity;
  }));
  const topProductsMes = Object.values(productSalesMap)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  // ── Meta del mes ─────────────────────────────────────────────────────────────
  const monthKey = format(now, 'yyyy-MM');
  const metaMes = goals.find(g => g.month === monthKey);
  const ventasMes = monthOrders.reduce((s, o) => s + o.totalAmount, 0);

  // ── Top deudores ─────────────────────────────────────────────────────────────
  const topDeudores = clients
    .map(c => ({ ...c, debt: calculateClientDebt(c.id, orders) }))
    .filter(c => c.debt > 0)
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 5);

  // ── Mejores clientes ─────────────────────────────────────────────────────────
  const topClientes = clients
    .map(c => {
      const total = orders
        .filter(o => o.clientId === c.id && o.status !== 'cancelado')
        .reduce((s, o) => s + o.totalAmount, 0);
      const count = orders.filter(o => o.clientId === c.id && o.status !== 'cancelado').length;
      return { ...c, total, count };
    })
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Weekly chart ─────────────────────────────────────────────────────────────
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 });
  const weekDays   = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weeklyData = weekDays.map(day => {
    const dayStr   = format(day, 'EEE', { locale: es });
    const dayTotal = payments
      .filter(p => {
        try { return format(parseISO(p.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'); }
        catch { return false; }
      })
      .reduce((s, p) => s + p.amount, 0);
    return { day: dayStr, monto: dayTotal };
  });

  // ── Status pie ───────────────────────────────────────────────────────────────
  const statusGroups = [
    { name: 'Entregado/Pagado', value: deliveredOrders, color: '#10b981' },
    { name: 'Pendiente',        value: orders.filter(o => o.status === 'pendiente_pago').length, color: '#f59e0b' },
    { name: 'En proceso',       value: orders.filter(o => ['tomado','recogido','por_recoger'].includes(o.status)).length, color: '#7c3aed' },
    { name: 'Cancelado',        value: orders.filter(o => o.status === 'cancelado').length, color: '#e5e7eb' },
  ].filter(g => g.value > 0);

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const pendingProofs = paymentProofs.filter(p => p.status === 'pendiente_revision').length;

  const alerts = [
    ...(pendingProofs > 0 ? [{
      type:  'comprobantes' as const,
      msg:   `${pendingProofs} comprobante${pendingProofs !== 1 ? 's' : ''} pendiente${pendingProofs !== 1 ? 's' : ''} de revisión`,
      link:  '/comprobantes',
      color: 'text-blue-700 bg-blue-50',
    }] : []),
    ...clients.filter(c => c.status === 'mora').map(c => ({
      type: 'mora' as const,
      msg:  `${c.name} está en mora`,
      link: `/clientes/${c.id}`,
      color: 'text-red-600 bg-red-50',
    })),
    ...orders.filter(o => o.status === 'por_recoger').map(o => {
      const client = clients.find(c => c.id === o.clientId);
      return {
        type:  'recoger' as const,
        msg:   `Pedido ${o.orderNumber} por recoger${client ? ` — ${client.name}` : ''}`,
        link:  `/pedidos/${o.id}`,
        color: 'text-amber-600 bg-amber-50',
      };
    }),
    ...products.filter(p => p.status === 'agotado').map(p => ({
      type:  'agotado' as const,
      msg:   `${p.name} está agotado`,
      link:  '/productos',
      color: 'text-gray-600 bg-gray-50',
    })),
  ].slice(0, 6);

  const rankBadge = (i: number) =>
    i === 0 ? 'bg-yellow-100 text-yellow-700' :
    i === 1 ? 'bg-gray-100 text-gray-500' :
    i === 2 ? 'bg-orange-50 text-orange-600' :
              'bg-primary-50 text-primary-600';

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 px-5 py-5 text-white"
        style={{ boxShadow: '0 4px 24px rgb(124 58 237 / 0.25)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-200 mb-1">
          {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
        <h1 className="text-xl font-bold text-white leading-tight">
          Hola, {currentUser?.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-primary-200 mt-0.5">Resumen general del negocio</p>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">{orders.filter(o => o.status !== 'cancelado').length}</p>
            <p className="text-[10px] text-primary-200 font-medium">Pedidos</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">{clients.length}</p>
            <p className="text-[10px] text-primary-200 font-medium">Clientes</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums">{clientsWithDebt}</p>
            <p className="text-[10px] text-primary-200 font-medium">Con deuda</p>
          </div>
        </div>
      </div>

      {/* Banner recordatorios urgentes */}
      {urgentReminders > 0 && (
        <Link
          to="/recordatorios"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 hover:bg-red-100 transition-colors"
        >
          <Bell size={18} className="text-red-500 flex-shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              {urgentReminders} cliente{urgentReminders !== 1 ? 's' : ''} sin abonar hace 15+ días
            </p>
            <p className="text-xs text-red-400 mt-0.5">Toca para enviar recordatorios de cobro por WhatsApp</p>
          </div>
          <ArrowRight size={16} className="text-red-400 flex-shrink-0" />
        </Link>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas totales" value={formatCurrency(totalSales)}   icon={DollarSign}  color="purple" subtitle={`${orders.filter(o => o.status !== 'cancelado').length} pedidos`} />
        <StatCard title="Por cobrar"     value={formatCurrency(totalPending)} icon={Clock}       color="yellow" subtitle={`${clientsWithDebt} clientes con deuda`} />
        <StatCard title="Total cobrado"  value={formatCurrency(totalPaid)}    icon={CheckCircle2} color="green" subtitle={`${clientsUpToDate} clientes al día`} />
        <StatCard title="Ganancia est."  value={formatCurrency(totalProfit)}  icon={TrendingUp}  color="blue"  subtitle="Margen sobre ventas" />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Activos"     value={pendingOrders}   icon={ShoppingBag}   color="purple" />
        <StatCard title="Entregados"  value={deliveredOrders} icon={CheckCircle2}  color="green"  />
        <StatCard title="Por recoger" value={ordersToPickup}  icon={Package}       color="yellow" />
        <StatCard title="Con deuda"   value={clientsWithDebt} icon={AlertTriangle} color="red"    className="hidden lg:flex" />
        <StatCard title="Al día"      value={clientsUpToDate} icon={Users}         color="green"  className="hidden lg:flex" />
      </div>

      {/* Alertas — visibles antes de las gráficas */}
      {alerts.length > 0 && (
        <div className="card !p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" /> Alertas ({alerts.length})
          </h2>
          {alerts.map((a, i) => (
            <Link key={i} to={a.link}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80 ${a.color}`}>
              <span className="flex-1">{a.msg}</span>
              <ArrowRight size={12} className="flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h2 className="section-title mb-4">Abonos esta semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Cobrado']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="monto" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Estado pedidos</h2>
          {statusGroups.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={statusGroups} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {statusGroups.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'pedidos']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusGroups.map(g => (
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

      {/* Top deudores + Mejores clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top deudores */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              <h2 className="section-title">Top deudores</h2>
            </div>
            <Link to="/clientes" className="text-xs text-primary-600 font-medium hover:underline">Ver todos</Link>
          </div>
          {topDeudores.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <p className="text-sm text-gray-400">Sin deudas pendientes</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {topDeudores.map((c, i) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${rankBadge(i)}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{c.status.replace('_', ' ')}</p>
                    </div>
                    <p className="text-sm font-bold text-red-600 flex-shrink-0">{formatCurrency(c.debt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mejores clientes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-yellow-500" />
              <h2 className="section-title">Mejores clientes</h2>
            </div>
            <Link to="/clientes" className="text-xs text-primary-600 font-medium hover:underline">Ver todos</Link>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin ventas registradas</p>
          ) : (
            <ul className="space-y-1.5">
              {topClientes.map((c, i) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${rankBadge(i)}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.count} pedido{c.count !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatCurrency(c.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Proyección de cobranza */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-primary-600" />
          <h2 className="section-title">
            Proyección de cobranza — {format(now, "MMMM yyyy", { locale: es })}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="flex sm:flex-col items-center sm:justify-center justify-between p-3 bg-emerald-50 rounded-xl gap-2">
            <p className="text-xs text-emerald-600 font-medium">Cobrado este mes</p>
            <p className="text-sm sm:text-base font-bold text-emerald-700 text-right sm:text-center">{formatCurrency(cobradoMes)}</p>
          </div>
          <div className="flex sm:flex-col items-center sm:justify-center justify-between p-3 bg-amber-50 rounded-xl gap-2">
            <p className="text-xs text-amber-600 font-medium">Pendiente total</p>
            <p className="text-sm sm:text-base font-bold text-amber-700 text-right sm:text-center">{formatCurrency(totalPending)}</p>
          </div>
          <div className="flex sm:flex-col items-center sm:justify-center justify-between p-3 bg-gray-50 rounded-xl gap-2">
            <p className="text-xs text-gray-500 font-medium">Clientes a cobrar</p>
            <p className="text-sm sm:text-base font-bold text-gray-700 text-right sm:text-center">{clientsWithDebt}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Cobrado este mes vs deuda total</span>
            <span className="font-bold text-emerald-600">{pctCobrado}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${pctCobrado}%`, background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' }} />
          </div>
        </div>
      </div>

      {/* Meta del mes + Productos más vendidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Meta del mes */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="section-title">Meta del mes — {format(now, 'MMMM', { locale: es })}</h2>
          </div>
          {metaMes ? (
            <div className="space-y-4">
              {metaMes.salesTarget > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Ventas: {formatCurrency(ventasMes)} / {formatCurrency(metaMes.salesTarget)}</span>
                    <span className="font-bold text-primary-600">{Math.min(100, Math.round(ventasMes / metaMes.salesTarget * 100))}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (ventasMes / metaMes.salesTarget) * 100)}%`, background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)' }} />
                  </div>
                </div>
              )}
              {metaMes.collectionTarget > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Recaudo: {formatCurrency(cobradoMes)} / {formatCurrency(metaMes.collectionTarget)}</span>
                    <span className="font-bold text-emerald-600">{Math.min(100, Math.round(cobradoMes / metaMes.collectionTarget * 100))}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (cobradoMes / metaMes.collectionTarget) * 100)}%`, background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' }} />
                  </div>
                </div>
              )}
              {metaMes.notes && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">{metaMes.notes}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center gap-2">
              <Target size={28} className="text-gray-200" />
              <p className="text-sm text-gray-400">Sin meta para este mes</p>
              <Link to="/metas" className="text-xs text-primary-600 font-medium hover:underline">Definir meta →</Link>
            </div>
          )}
        </div>

        {/* Productos más vendidos del mes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary-600" />
              <h2 className="section-title">Más vendidos — {format(now, 'MMMM', { locale: es })}</h2>
            </div>
          </div>
          {topProductsMes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin ventas este mes</p>
          ) : (
            <ul className="space-y-2">
              {topProductsMes.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${rankBadge(i)}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.units} unidad{p.units !== 1 ? 'es' : ''}</p>
                  </div>
                  <p className="text-sm font-bold text-primary-600 flex-shrink-0">{formatCurrency(p.revenue)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Alerts + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <Link to={a.link}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium ${a.color} hover:opacity-80 transition-opacity`}>
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <span className="flex-1">{a.msg}</span>
                    <ArrowRight size={12} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Pedidos recientes</h2>
            <Link to="/pedidos" className="text-xs text-primary-600 font-medium hover:underline">Ver todos</Link>
          </div>
          <ul className="space-y-2">
            {recentOrders.map(o => {
              const client = clients.find(c => c.id === o.clientId);
              return (
                <li key={o.id}>
                  <Link to={`/pedidos/${o.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={14} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {o.orderNumber} — {client?.name ?? 'Cliente'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(o.orderDate)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
                      <span className={`text-[10px] font-semibold ${
                        o.status === 'pagado'         ? 'text-emerald-600' :
                        o.status === 'pendiente_pago' ? 'text-amber-600'   : 'text-gray-500'
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
