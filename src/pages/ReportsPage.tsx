
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Users, ShoppingBag, Package, Percent, ReceiptText, Wallet, Download } from 'lucide-react';
import { useAppStore } from '../store';
import { StatCard } from '../components/ui/StatCard';
import { aoaToCSV, downloadCSV } from '../utils/csvExport';
import {
  formatCurrency,
  categoryLabel,
  paymentMethodLabel,
  parseDateOnly,
} from '../utils/formatters';
import { format, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ProductCategory } from '../types';

const COLORS = ['#7c3aed','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899'];

export function ReportsPage() {
  const { orders, clients, payments, purchases, expenses, getClientDebt } = useAppStore();
  const activePurchases = purchases.filter(p => p.status !== 'cancelado');

  const now = new Date();

  // Monthly sales for last 6 months
  const last6Months = eachMonthOfInterval({
    start: subMonths(now, 5),
    end: now,
  });

  const monthlySales = last6Months.map(month => {
    const monthOrders = orders.filter(o => {
      try {
        const d = parseDateOnly(o.orderDate);
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
          && o.status !== 'cancelado';
      } catch { return false; }
    });
    const monthExpenses = expenses.filter(e => {
      try {
        const d = parseDateOnly(e.date);
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      } catch { return false; }
    });
    const cobrado = payments.filter(p => {
      try {
        const d = parseDateOnly(p.date);
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      } catch { return false; }
    }).reduce((s, p) => s + p.amount, 0);
    const gastos   = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const compras  = activePurchases.filter(p => {
      try {
        const d = parseDateOnly(p.purchaseDate);
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      } catch { return false; }
    }).reduce((s, p) => s + p.cost, 0);
    return {
      mes:      format(month, 'MMM', { locale: es }),
      ventas:   monthOrders.reduce((s, o) => s + o.totalAmount, 0),
      cobrado,
      ganancia: monthOrders.reduce((s, o) => s + (o.totalAmount - (o.totalCost ?? 0)), 0),
      gastos,
      compras,
      utilidad: cobrado - compras - gastos,
    };
  });

  const totalExpenses     = expenses.reduce((s, e) => s + e.amount, 0);
  const totalCollectedAll = orders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + Math.min(o.amountPaid, o.totalAmount), 0);
  const totalPurchasesAll = activePurchases.reduce((s, p) => s + p.cost, 0);
  const totalNetProfit    = totalCollectedAll - totalPurchasesAll - totalExpenses;

  // By category
  const byCategory = Object.entries(
    orders.filter(o => o.status !== 'cancelado').flatMap(o => o.items).reduce((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + item.salePrice * item.quantity;
      return acc;
    }, {} as Record<string, number>)
  ).map(([cat, value]) => ({
    name: categoryLabel[cat as ProductCategory] ?? cat,
    value,
  })).sort((a, b) => b.value - a.value);

  // By payment method
  const byMethod = Object.entries(
    payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + p.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([method, value]) => ({
    name: paymentMethodLabel[method as keyof typeof paymentMethodLabel] ?? method,
    value,
  }));

  // By client status
  const byClientStatus = [
    { name: 'Al día',       value: clients.filter(c => c.status === 'al_dia').length,         color: '#10b981' },
    { name: 'Pendiente',    value: clients.filter(c => c.status === 'pendiente').length,       color: '#f59e0b' },
    { name: 'En mora',      value: clients.filter(c => c.status === 'mora').length,            color: '#ef4444' },
    { name: 'Cred. cerrado',value: clients.filter(c => c.status === 'credito_cerrado').length, color: '#6b7280' },
  ].filter(g => g.value > 0);

  // Top clients by sales
  const clientSales = clients.map(c => ({
    name: c.name,
    total: orders.filter(o => o.clientId === c.id && o.status !== 'cancelado')
      .reduce((s, o) => s + o.totalAmount, 0),
    deuda: getClientDebt(c.id),
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  // KPIs
  const activeOrders  = orders.filter(o => o.status !== 'cancelado');
  const totalSales    = activeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const totalProfit   = activeOrders.reduce((s, o) => s + (o.totalAmount - (o.totalCost ?? 0)), 0);
  const totalDebt     = clients.reduce((s, c) => s + getClientDebt(c.id), 0);
  const totalInvestment = purchases.filter(p => p.status !== 'cancelado').reduce((s, p) => s + p.cost, 0);

  // Indicadores de rendimiento
  const tasaCobro = totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0;
  const ticketPromedio = activeOrders.length > 0 ? totalSales / activeOrders.length : 0;
  const margenPromedio = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  // Top productos más vendidos (todos los tiempos)
  const productMap: Record<string, { name: string; units: number; revenue: number }> = {};
  activeOrders.forEach(o => o.items.forEach(it => {
    if (!productMap[it.productId]) productMap[it.productId] = { name: it.productName, units: 0, revenue: 0 };
    productMap[it.productId].units += it.quantity;
    productMap[it.productId].revenue += it.salePrice * it.quantity;
  }));
  const topProducts = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 10);

  const handleExport = () => {
    const rows: unknown[][] = [
      ['Mes', 'Ventas ($)', 'Cobrado ($)', 'Ganancia ($)', 'Compras ($)', 'Gastos ($)', 'Utilidad ($)'],
      ...monthlySales.map(m => [m.mes, m.ventas, m.cobrado, m.ganancia, m.compras, m.gastos, m.utilidad]),
    ];
    downloadCSV(aoaToCSV(rows), `JAS-Reportes-${format(now, 'yyyy-MM')}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis completo del negocio</p>
        </div>
        <button type="button" onClick={handleExport} className="btn-secondary">
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas totales"    value={formatCurrency(totalSales)}      icon={DollarSign}  color="purple" />
        <StatCard title="Ganancia estimada" value={formatCurrency(totalProfit)}     icon={TrendingUp}  color="green" />
        <StatCard title="Deuda total"       value={formatCurrency(totalDebt)}       icon={Users}       color="red" />
        <StatCard title="Inversión"         value={formatCurrency(totalInvestment)} icon={ShoppingBag} color="yellow" />
      </div>

      {/* P&L: utilidad neta */}
      <div className="card !p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-emerald-600" />
          <h2 className="section-title">Utilidad neta (cobrado − compras − gastos)</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Total cobrado</p>
            <p className="text-base font-bold text-emerald-700 mt-1">{formatCurrency(totalCollectedAll)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide">Compras prov.</p>
            <p className="text-base font-bold text-orange-600 mt-1">{formatCurrency(totalPurchasesAll)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Gastos operat.</p>
            <p className="text-base font-bold text-red-600 mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${totalNetProfit >= 0 ? 'bg-primary-50' : 'bg-amber-50'}`}>
            <p className={`text-[10px] font-medium uppercase tracking-wide ${totalNetProfit >= 0 ? 'text-primary-600' : 'text-amber-600'}`}>Utilidad neta</p>
            <p className={`text-base font-bold mt-1 ${totalNetProfit >= 0 ? 'text-primary-700' : 'text-amber-600'}`}>{formatCurrency(totalNetProfit)}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlySales} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip
              formatter={(v: number, name: string) => [formatCurrency(v),
                name === 'cobrado' ? 'Cobrado' :
                name === 'compras' ? 'Compras' :
                name === 'gastos'  ? 'Gastos'  : 'Utilidad']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Legend formatter={v =>
              v === 'cobrado' ? 'Cobrado' :
              v === 'compras' ? 'Compras' :
              v === 'gastos'  ? 'Gastos'  : 'Utilidad'} />
            <Bar dataKey="cobrado"  fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="compras"  fill="#f97316" radius={[4,4,0,0]} />
            <Bar dataKey="gastos"   fill="#ef4444" radius={[4,4,0,0]} />
            <Bar dataKey="utilidad" fill="#7c3aed" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Indicadores de rendimiento */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card !p-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Percent size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Tasa de cobro</p>
            <p className="text-xl font-bold text-emerald-600">{tasaCobro}%</p>
            <p className="text-[10px] text-gray-400">del total vendido</p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-4">
          <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ReceiptText size={20} className="text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Ticket promedio</p>
            <p className="text-xl font-bold text-primary-600">{formatCurrency(ticketPromedio)}</p>
            <p className="text-[10px] text-gray-400">{activeOrders.length} pedidos</p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-4 col-span-2 lg:col-span-1">
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 font-medium">Margen promedio</p>
            <p className="text-xl font-bold text-amber-600">{margenPromedio}%</p>
            <p className="text-[10px] text-gray-400">ganancia / ventas</p>
          </div>
        </div>
      </div>

      {/* Top productos más vendidos */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-primary-600" />
          <h2 className="section-title">Productos más vendidos</h2>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Sin datos de productos</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-100 text-gray-700' :
                  i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-primary-50 text-primary-600'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.units} unidad{p.units !== 1 ? 'es' : ''} vendidas</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(p.revenue)}</p>
                </div>
                <div className="w-20 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                  <div className="bg-primary-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (p.units / (topProducts[0]?.units || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly sales */}
      <div className="card">
        <h2 className="section-title mb-4">Ventas últimos 6 meses</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthlySales} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip
              formatter={(v: number, name: string) => [formatCurrency(v), name === 'ventas' ? 'Ventas' : name === 'cobrado' ? 'Cobrado' : 'Ganancia']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Legend formatter={(v) => v === 'ventas' ? 'Ventas' : v === 'cobrado' ? 'Cobrado' : 'Ganancia'} />
            <Bar dataKey="ventas"   fill="#7c3aed" radius={[4,4,0,0]} />
            <Bar dataKey="cobrado"  fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="ganancia" fill="#f59e0b" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By category */}
        <div className="card">
          <h2 className="section-title mb-4">Ventas por categoría</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byCategory} cx="50%" cy="50%" outerRadius={65}
                    paddingAngle={3} dataKey="value">
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Ventas']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {byCategory.map((g, i) => (
                  <div key={g.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600 flex-1">{g.name}</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(g.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Client status */}
        <div className="card">
          <h2 className="section-title mb-4">Estado de clientes</h2>
          {byClientStatus.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin clientes</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byClientStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    paddingAngle={3} dataKey="value">
                    {byClientStatus.map((g, i) => (
                      <Cell key={i} fill={g.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'clientes']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {byClientStatus.map(g => (
                  <div key={g.name} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <span className="text-gray-600 flex-1">{g.name}</span>
                    <span className="font-semibold text-gray-800">{g.value} clientes</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top clients */}
      <div className="card">
        <h2 className="section-title mb-4">Top clientes por ventas</h2>
        {clientSales.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin datos</p>
        ) : (
          <div className="space-y-3">
            {clientSales.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' :
                  i === 1 ? 'bg-gray-100 text-gray-700' :
                  i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-primary-50 text-primary-600'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                  {c.deuda > 0 && (
                    <p className="text-xs text-red-500">Debe {formatCurrency(c.deuda)}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(c.total)}</p>
                </div>
                <div className="w-24 bg-gray-100 rounded-full h-2 flex-shrink-0">
                  <div
                    className="bg-primary-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (c.total / (clientSales[0]?.total || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="card">
        <h2 className="section-title mb-4">Métodos de pago</h2>
        {byMethod.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Sin pagos registrados</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {byMethod.map((m) => (
              <div key={m.name} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(m.value)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debtors list */}
      <div className="card">
        <h2 className="section-title mb-4 text-red-600">Clientes con deuda</h2>
        {(() => {
          const debtors = clients.map(c => {
            const debt = orders.filter(o => o.clientId === c.id && !['pagado','cancelado'].includes(o.status))
              .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
            return { ...c, debt };
          }).filter(c => c.debt > 0).sort((a, b) => b.debt - a.debt);

          if (debtors.length === 0) return (
            <p className="text-sm text-emerald-600 text-center py-4">✓ Ningún cliente con deuda</p>
          );

          return (
            <div className="space-y-2">
              {debtors.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-red-700 font-bold text-xs">{c.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600 flex-shrink-0">
                    {formatCurrency(c.debt)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between px-3 pt-2 border-t border-red-100">
                <span className="text-sm font-semibold text-gray-600">Total deuda</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(totalDebt)}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
