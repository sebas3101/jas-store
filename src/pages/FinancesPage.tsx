import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
  BarChart3,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, formatDate, paymentMethodLabel } from '../utils/formatters';
import { aoaToCSV, downloadCSV } from '../utils/csvExport';

type ViewMode = 'month' | 'range';

export function FinancesPage() {
  const { orders, payments, purchases, expenses, openingBalance } = useAppStore();
  const { can } = usePermissions();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo]     = useState(format(new Date(), 'yyyy-MM-dd'));

  // Determine date range
  const { from, to } = useMemo(() => {
    if (viewMode === 'month') {
      const d = parseISO(`${selectedMonth}-01`);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    return {
      from: parseISO(dateFrom),
      to:   parseISO(dateTo),
    };
  }, [viewMode, selectedMonth, dateFrom, dateTo]);

  const inRange = (dateStr: string) =>
    isWithinInterval(parseISO(dateStr), { start: from, end: to });

  // Orders in range
  const rangeOrders = orders.filter(o => inRange(o.orderDate) && o.status !== 'cancelado');
  // Payments in range
  const rangePayments = payments.filter(p => inRange(p.date));
  // Purchases in range
  const rangePurchases = purchases.filter(p => inRange(p.purchaseDate));
  // Expenses in range
  const rangeExpenses = (expenses ?? []).filter(e => inRange(e.date));

  // ── Caja real acumulada (histórico completo, independiente del filtro de período) ──
  const allCollected         = payments.reduce((s, p) => s + p.amount, 0);
  const allPaidToSuppliers   = purchases
    .filter(p => p.status !== 'cancelado')
    .reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const allExpenses          = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const cajaReal             = openingBalance + allCollected - allPaidToSuppliers - allExpenses;
  // Cuánto se le debe todavía a proveedores (excluye cancelado y no_disponible — no hubo entrega)
  const deudaProveedores     = purchases
    .filter(p => p.status !== 'cancelado' && p.status !== 'no_disponible')
    .reduce((s, p) => s + Math.max(0, p.cost - (p.paidAmount ?? 0)), 0);

  // ── KPIs del período seleccionado ──
  const totalSales     = rangeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalCost      = rangeOrders.reduce((s, o) => s + (o.totalCost ?? 0), 0);
  const grossProfit    = totalSales - totalCost;
  const totalCollected = rangePayments.reduce((s, p) => s + p.amount, 0);
  // Usa paidAmount (lo realmente pagado al proveedor) no cost
  const totalPaidToSuppliers = rangePurchases
    .filter(p => p.status !== 'cancelado')
    .reduce((s, p) => s + (p.paidAmount ?? 0), 0);
  const totalExpenses  = rangeExpenses.reduce((s, e) => s + e.amount, 0);
  // Resultado del período = cobrado − abonado a proveedores − gastos (sin saldo inicial)
  const periodBalance  = totalCollected - totalPaidToSuppliers - totalExpenses;
  // Solo pedidos entregados/pendiente_pago generan deuda real
  const totalDebt = rangeOrders
    .filter(o => o.status === 'entregado' || o.status === 'pendiente_pago')
    .reduce((s, o) => s + Math.max(0, o.totalAmount - o.amountPaid), 0);

  // Payment method breakdown
  const byMethod = rangePayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amount;
    return acc;
  }, {});

  const handleExportExcel = () => {
    const periodo = viewMode === 'month'
      ? format(from, 'MMMM yyyy', { locale: es })
      : `${format(from, 'dd/MM/yyyy')} — ${format(to, 'dd/MM/yyyy')}`;
    const label = viewMode === 'month'
      ? format(from, 'yyyy-MM')
      : `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`;

    const sections: unknown[][] = [
      ['=== RESUMEN FINANCIERO — JAS Store ==='],
      ['Período', periodo],
      [],
      ['Indicador', 'Valor'],
      ['Ventas brutas (pedidos)',       totalSales],
      ['Costo de pedidos',             totalCost],
      ['Ganancia bruta estimada',      grossProfit],
      [],
      ['--- CAJA REAL (histórico total) ---', ''],
      ['Capital inicial',              openingBalance],
      ['Total cobrado a clientes',     allCollected],
      ['Total abonado a proveedores',  allPaidToSuppliers],
      ['Total gastos operativos',      allExpenses],
      ['Caja disponible hoy',          cajaReal],
      ['Deuda pendiente a proveedores',deudaProveedores],
      [],
      ['--- PERÍODO SELECCIONADO ---', ''],
      ['Recaudo clientes (período)',    totalCollected],
      ['Abonado a proveedores (perd.)', totalPaidToSuppliers],
      ['Gastos operativos (período)',   totalExpenses],
      ['Resultado del período',         periodBalance],
      ['Deuda pendiente clientes',      totalDebt],
      [],
      ['=== PEDIDOS ==='],
      ['Pedido', 'Fecha', 'Total', 'Pagado', 'Pendiente', 'Estado'],
      ...rangeOrders.map(o => [
        o.orderNumber, formatDate(o.orderDate),
        o.totalAmount, o.amountPaid, o.totalAmount - o.amountPaid, o.status,
      ]),
      [],
      ['=== PAGOS ==='],
      ['Fecha', 'Método', 'Monto', 'Notas'],
      ...rangePayments.map(p => [
        formatDate(p.date), paymentMethodLabel[p.method] ?? p.method, p.amount, p.notes ?? '',
      ]),
      [],
      ['=== COMPRAS ==='],
      ['Fecha', 'Descripción', 'Costo total', 'Abonado al proveedor', 'Saldo pendiente', 'Estado'],
      ...rangePurchases.map(p => [
        formatDate(p.purchaseDate), p.description, p.cost,
        p.paidAmount ?? 0, Math.max(0, p.cost - (p.paidAmount ?? 0)), p.status,
      ]),
      ...(rangeExpenses.length > 0 ? [
        [],
        ['=== GASTOS ==='],
        ['Fecha', 'Tipo', 'Descripción', 'Responsable', 'Método', 'Valor'],
        ...rangeExpenses.map(e => [
          formatDate(e.date), e.type, e.description ?? '', e.responsible ?? '', e.paymentMethod, e.amount,
        ]),
        [],
        ['TOTAL', '', '', '', '', totalExpenses],
      ] : []),
    ];

    downloadCSV(aoaToCSV(sections), `JAS-Finanzas-${label}.csv`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen financiero y exportación</p>
        </div>
        {can('finanzas', 'exportar') && (
          <button onClick={handleExportExcel} className="btn-primary" type="button">
            <Download size={15} /> Exportar Excel
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card !p-4 space-y-3">
        <div className="flex gap-2">
          {(['month', 'range'] as ViewMode[]).map(m => (
            <button key={m}
              onClick={() => setViewMode(m)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                viewMode === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {m === 'month' ? 'Por mes' : 'Rango de fechas'}
            </button>
          ))}
        </div>
        {viewMode === 'month' ? (
          <div>
            <label className="label">Mes</label>
            <input type="month" className="input-field sm:max-w-[200px]"
              value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Desde</label>
              <input type="date" className="input-field"
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="date" className="input-field"
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Caja real hoy — histórico completo, independiente del período */}
      <div className="card !p-4 border border-emerald-200 bg-emerald-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote size={15} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Caja disponible hoy</p>
            </div>
            <p className="text-3xl font-bold text-emerald-700">{formatCurrency(cajaReal)}</p>
            <p className="text-[11px] text-emerald-600 mt-1">
              Capital inicial + todo lo cobrado − todo lo pagado a proveedores − gastos
            </p>
          </div>
          {deudaProveedores > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-amber-700">Deuda a proveedores</p>
                <p className="text-base font-bold text-amber-700">{formatCurrency(deudaProveedores)}</p>
                <p className="text-[10px] text-amber-600">pendiente de pagar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas"         value={formatCurrency(totalSales)}     icon={TrendingUp}   color="green" />
        <StatCard title="Recaudo"        value={formatCurrency(totalCollected)}  icon={DollarSign}   color="blue" />
        <StatCard title="Ganancia bruta" value={formatCurrency(grossProfit)}     icon={BarChart3}    color="purple" />
        <StatCard title="Deuda activa"   value={formatCurrency(totalDebt)}       icon={TrendingDown} color="red" />
      </div>

      {/* Desglose */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flujo de caja del período */}
        <div className="card space-y-3">
          <h2 className="section-title flex items-center gap-2"><Calendar size={16} /> Flujo del período</h2>
          <div className="space-y-2">
            {[
              { label: 'Recaudo clientes',         value: totalCollected,        color: 'text-emerald-600', sign: '+' },
              { label: 'Abonado a proveedores',     value: totalPaidToSuppliers,  color: 'text-red-500',     sign: '−' },
              { label: 'Gastos operativos',         value: totalExpenses,         color: 'text-orange-500',  sign: '−' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center gap-2 text-sm py-0.5">
                <span className="text-gray-500 text-xs sm:text-sm">
                  <span className="font-medium mr-1">{row.sign}</span>{row.label}
                </span>
                <span className={`font-bold text-sm flex-shrink-0 ${row.color}`}>{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center gap-2">
              <span className="text-gray-700 text-xs sm:text-sm font-semibold">Resultado del período</span>
              <span className={`font-bold text-sm flex-shrink-0 ${periodBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(periodBalance)}
              </span>
            </div>
            {openingBalance > 0 && (
              <p className="text-[10px] text-gray-400 pt-1">
                Capital inicial ${openingBalance.toLocaleString('es-CO')} — incluido en "Caja disponible hoy"
              </p>
            )}
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="card space-y-3">
          <h2 className="section-title flex items-center gap-2"><DollarSign size={16} /> Métodos de pago recibidos</h2>
          {Object.keys(byMethod).length === 0 ? (
            <p className="text-xs text-gray-400">Sin pagos en el período</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(byMethod)
                .sort(([,a], [,b]) => b - a)
                .map(([method, amount]) => (
                  <div key={method} className="flex justify-between text-sm">
                    <span className="text-gray-600">{paymentMethodLabel[method as keyof typeof paymentMethodLabel] ?? method}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div className="card space-y-3">
        <h2 className="section-title">Pedidos del período ({rangeOrders.length})</h2>
        {rangeOrders.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Sin pedidos en el período seleccionado</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs" style={{ minWidth: '460px' }}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Pedido</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Total</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Pagado</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {rangeOrders.map(o => {
                  const pending = o.totalAmount - o.amountPaid;
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 font-semibold text-gray-800">{o.orderNumber}</td>
                      <td className="py-2 px-2 text-gray-500">{formatDate(o.orderDate)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{formatCurrency(o.totalAmount)}</td>
                      <td className="py-2 px-2 text-right text-emerald-600">{formatCurrency(o.amountPaid)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${pending > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {formatCurrency(pending)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="py-2 px-2 font-bold text-gray-700 text-right">Totales:</td>
                  <td className="py-2 px-2 text-right font-bold">{formatCurrency(totalSales)}</td>
                  <td className="py-2 px-2 text-right font-bold text-emerald-600">
                    {formatCurrency(rangeOrders.reduce((s, o) => s + o.amountPaid, 0))}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-red-500">
                    {formatCurrency(rangeOrders.reduce((s, o) => s + Math.max(0, o.totalAmount - o.amountPaid), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
