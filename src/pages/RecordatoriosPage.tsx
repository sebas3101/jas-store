import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, MessageCircle, ArrowRight, Users, DollarSign,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppStore } from '../store';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../utils/formatters';
import { buildDebtReminderMessage, buildDebtInfoMessage, openWhatsApp } from '../utils/whatsapp';

type Filter = 'all' | 'mora' | 'pendiente';

function severityBg(days: number) {
  if (days > 60) return 'bg-red-100 text-red-700';
  if (days > 30) return 'bg-orange-100 text-orange-700';
  return 'bg-amber-100 text-amber-700';
}

export function RecordatoriosPage() {
  const { clients, orders, payments } = useAppStore();
  const [filter, setFilter] = useState<Filter>('all');

  const debtors = clients
    .map(c => {
      const pendingOrds = orders.filter(
        o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status),
      );
      const debt = pendingOrds.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
      const oldest = [...pendingOrds].sort(
        (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
      )[0];
      const daysOverdue = oldest
        ? differenceInDays(new Date(), parseISO(oldest.orderDate))
        : 0;
      return { ...c, debt, daysOverdue, pendingCount: pendingOrds.length };
    })
    .filter(c => c.debt > 0)
    .filter(c => filter === 'all' || c.status === filter)
    .sort((a, b) => b.debt - a.debt);

  const allDebtors = clients
    .map(c => {
      const debt = orders
        .filter(o => o.clientId === c.id && !['pagado', 'cancelado'].includes(o.status))
        .reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
      return debt;
    })
    .filter(d => d > 0);

  const totalDebt = allDebtors.reduce((s, d) => s + d, 0);
  const totalCount = allDebtors.length;

  const moraCount     = clients.filter(c => c.status === 'mora').length;
  const pendienteCount = clients.filter(c => c.status === 'pendiente').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Recordatorios de cobro</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} cliente{totalCount !== 1 ? 's' : ''} con deuda pendiente
          </p>
        </div>
        <Bell size={22} className="text-amber-500" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total deuda"       value={formatCurrency(totalDebt)} icon={DollarSign}   color="red" />
        <StatCard title="Clientes con deuda" value={String(totalCount)}        icon={Users}         color="yellow" />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'mora', 'pendiente'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-2 rounded-full font-medium flex-1 transition-colors ${
              filter === f
                ? f === 'mora' ? 'bg-red-500 text-white' : f === 'pendiente' ? 'bg-amber-500 text-white' : 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? `Todos (${totalCount})` : f === 'mora' ? `En mora (${moraCount})` : `Pendiente (${pendienteCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {debtors.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sin deudas en esta categoría"
          description="Todos los clientes están al día"
        />
      ) : (
        <div className="space-y-3">
          {debtors.map(c => {
            const clientPayments = payments.filter(p => p.clientId === c.id);
            const waReminder = buildDebtReminderMessage(c, c.debt, orders, clientPayments);
            const waInfo     = buildDebtInfoMessage(c, c.debt, orders, clientPayments);
            const sev        = severityBg(c.daysOverdue);
            return (
              <div key={c.id} className="card !p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sev.split(' ')[0]}`}>
                    <span className={`font-bold text-sm ${sev.split(' ')[1]}`}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={10} /> {c.daysOverdue} días
                      </span>
                      <span className="text-xs text-gray-400">
                        {c.pendingCount} pedido{c.pendingCount !== 1 ? 's' : ''} pendiente{c.pendingCount !== 1 ? 's' : ''}
                      </span>
                      {c.status === 'mora' && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> En mora
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-red-600">{formatCurrency(c.debt)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openWhatsApp(c.phone, waReminder)}
                    className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                  >
                    <MessageCircle size={12} /> Recordatorio
                  </button>
                  <button
                    onClick={() => openWhatsApp(c.phone, waInfo)}
                    className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                  >
                    <MessageCircle size={12} /> Detalle deuda
                  </button>
                  <Link
                    to={`/clientes/${c.id}`}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Totals footer */}
          <div className="card !p-3 bg-red-50 border-red-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Total cartera morosa ({debtors.length} clientes)
            </span>
            <span className="text-sm font-bold text-red-600">
              {formatCurrency(debtors.reduce((s, c) => s + c.debt, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
