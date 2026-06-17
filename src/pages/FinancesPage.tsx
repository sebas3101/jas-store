import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { StatCard } from '../components/ui/StatCard';
import { formatCurrency, formatDate, paymentMethodLabel } from '../utils/formatters';

type ViewMode = 'month' | 'range';

export function FinancesPage() {
  const { orders, payments, purchases } = useAppStore();
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

  // KPIs
  const totalSales     = rangeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalCost      = rangeOrders.reduce((s, o) => s + (o.totalCost ?? 0), 0);
  const grossProfit    = totalSales - totalCost;
  const totalCollected = rangePayments.reduce((s, p) => s + p.amount, 0);
  const totalPurchases = rangePurchases.reduce((s, p) => s + p.cost, 0);
  const netBalance     = totalCollected - totalPurchases;
  const totalDebt      = rangeOrders.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);

  // Payment method breakdown
  const byMethod = rangePayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amount;
    return acc;
  }, {});

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['RESUMEN FINANCIERO — JAS Store'],
      ['Período', viewMode === 'month' ? format(from, 'MMMM yyyy', { locale: es }) : `${format(from, 'dd/MM/yyyy')} — ${format(to, 'dd/MM/yyyy')}`],
      [],
      ['Indicador', 'Valor'],
      ['Ventas brutas (pedidos)',  totalSales],
      ['Costo de pedidos',        totalCost],
      ['Ganancia bruta',          grossProfit],
      ['Recaudo (pagos recibidos)', totalCollected],
      ['Compras a proveedores',   totalPurchases],
      ['Saldo neto',              netBalance],
      ['Deuda pendiente clientes', totalDebt],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

    // Sheet 2: Orders
    const orderRows = [
      ['Pedido', 'Fecha', 'Total', 'Pagado', 'Pendiente', 'Estado'],
      ...rangeOrders.map(o => [
        o.orderNumber,
        formatDate(o.orderDate),
        o.totalAmount,
        o.amountPaid,
        o.totalAmount - o.amountPaid,
        o.status,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(orderRows), 'Pedidos');

    // Sheet 3: Payments
    const paymentRows = [
      ['Fecha', 'Método', 'Monto', 'Notas'],
      ...rangePayments.map(p => [
        formatDate(p.date),
        paymentMethodLabel[p.method] ?? p.method,
        p.amount,
        p.notes ?? '',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paymentRows), 'Pagos');

    // Sheet 4: Purchases
    const purchaseRows = [
      ['Fecha', 'Descripción', 'Costo', 'Estado'],
      ...rangePurchases.map(p => [
        formatDate(p.purchaseDate),
        p.description,
        p.cost,
        p.status,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseRows), 'Compras');

    const label = viewMode === 'month'
      ? format(from, 'yyyy-MM', { locale: es })
      : `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`;
    XLSX.writeFile(wb, `JAS-Finanzas-${label}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen financiero y exportación</p>
        </div>
        {can('finanzas', 'exportar') && (
          <button onClick={handleExportExcel} className="btn-primary">
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
            >
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas"         value={formatCurrency(totalSales)}     icon={TrendingUp}   color="green" />
        <StatCard title="Recaudo"        value={formatCurrency(totalCollected)}  icon={DollarSign}   color="blue" />
        <StatCard title="Ganancia bruta" value={formatCurrency(grossProfit)}     icon={BarChart3}    color="purple" />
        <StatCard title="Deuda activa"   value={formatCurrency(totalDebt)}       icon={TrendingDown} color="red" />
      </div>

      {/* Desglose */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compras vs Recaudo */}
        <div className="card space-y-3">
          <h2 className="section-title flex items-center gap-2"><Calendar size={16} /> Flujo de caja</h2>
          <div className="space-y-2">
            {[
              { label: 'Recaudo clientes',   value: totalCollected,  color: 'text-emerald-600' },
              { label: 'Compras proveedores', value: totalPurchases,  color: 'text-red-500'    },
              { label: 'Saldo neto',          value: netBalance,      color: netBalance >= 0 ? 'text-emerald-700' : 'text-red-700' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center gap-2 text-sm py-0.5">
                <span className="text-gray-600 text-xs sm:text-sm">{row.label}</span>
                <span className={`font-bold text-sm flex-shrink-0 ${row.color}`}>{formatCurrency(row.value)}</span>
              </div>
            ))}
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
                  <td className="py-2 px-2 text-right font-bold text-red-500">{formatCurrency(totalDebt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
