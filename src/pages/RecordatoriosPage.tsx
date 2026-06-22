import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, MessageCircle, ArrowRight, Users, DollarSign,
  CheckCircle2, AlertTriangle, Clock, Send,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppStore } from '../store';
import type { Client } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../utils/formatters';
import { buildDebtReminderMessage, buildDebtInfoMessage, sendClientMessage } from '../utils/whatsapp';
import {
  getReminderLog, markReminderSent, daysSinceReminder, type ReminderLog,
} from '../utils/reminders';

type Tab = 'urgente' | 'todos';

function severityClass(days: number) {
  if (days > 60) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
  if (days > 30) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
  return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
}

function buildClientData(
  clients: ReturnType<typeof useAppStore.getState>['clients'],
  orders: ReturnType<typeof useAppStore.getState>['orders'],
  payments: ReturnType<typeof useAppStore.getState>['payments'],
  log: ReminderLog,
) {
  return clients
    .map(c => {
      const pendingOrds = orders.filter(
        o => o.clientId === c.id && ['entregado', 'pendiente_pago'].includes(o.status),
      );
      const debt = pendingOrds.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
      if (debt <= 0) return null;

      const clientPayments = payments
        .filter(p => p.clientId === c.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const lastPayment = clientPayments[0];
      const daysSincePayment = lastPayment
        ? differenceInDays(new Date(), parseISO(lastPayment.date))
        : 999;

      const oldest = [...pendingOrds].sort(
        (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
      )[0];
      const daysOverdue = oldest
        ? differenceInDays(new Date(), parseISO(oldest.orderDate))
        : 0;

      const daysReminder = daysSinceReminder(c.id, log);
      const needsReminder = daysSincePayment >= 15 && (daysReminder === null || daysReminder >= 7);

      return {
        ...c,
        debt,
        daysSincePayment,
        daysOverdue,
        pendingCount: pendingOrds.length,
        clientPayments,
        daysReminder,
        needsReminder,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.debt - a.debt);
}

export function RecordatoriosPage() {
  const { clients, orders, payments } = useAppStore();
  const [tab, setTab] = useState<Tab>('urgente');
  const [log, setLog] = useState<ReminderLog>({});

  // Carga el log desde Supabase al montar
  useEffect(() => {
    getReminderLog().then(setLog);
  }, []);

  const all     = buildClientData(clients, orders, payments, log);
  const urgente = all.filter(c => c.needsReminder);
  const list    = tab === 'urgente' ? urgente : all;

  const totalDebt  = all.reduce((s, c) => s + c.debt, 0);
  const totalCount = all.length;

  const handleSend = useCallback(async (
    client: Pick<Client, 'id' | 'name' | 'phone' | 'sendToGroup' | 'whatsappGroupLink'>,
    message: string,
  ) => {
    sendClientMessage(client, message);
    await markReminderSent(client.id);
    setLog(prev => ({ ...prev, [client.id]: new Date().toISOString() }));
  }, []);

  function handleSendAll() {
    urgente.forEach((c, i) => {
      const msg = buildDebtReminderMessage(c, c.debt, orders, c.clientPayments);
      setTimeout(async () => {
        sendClientMessage(c, msg);
        await markReminderSent(c.id);
        setLog(prev => ({ ...prev, [c.id]: new Date().toISOString() }));
      }, i * 800);
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Recordatorios de cobro</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCount} cliente{totalCount !== 1 ? 's' : ''} con deuda activa
          </p>
        </div>
        <Bell size={22} className={urgente.length > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500'} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Deuda total"        value={formatCurrency(totalDebt)} icon={DollarSign} color="red"    />
        <StatCard title="Clientes con deuda" value={String(totalCount)}         icon={Users}      color="yellow" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('urgente')}
          className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
            tab === 'urgente'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
         type="button">
          Urgente · {urgente.length}
        </button>
        <button
          onClick={() => setTab('todos')}
          className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
            tab === 'todos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
         type="button">
          Todos · {totalCount}
        </button>
      </div>

      {/* Urgente banner + send all */}
      {tab === 'urgente' && urgente.length > 0 && (
        <div className="card bg-red-50 border border-red-200 !p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-red-700">
              {urgente.length} cliente{urgente.length !== 1 ? 's' : ''} sin abonar hace 15+ días
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              No han recibido recordatorio en los últimos 7 días
            </p>
          </div>
          <button
            onClick={handleSendAll}
            className="flex-shrink-0 text-xs bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 font-semibold transition-colors"
           type="button">
            <Send size={13} /> Enviar a todos
          </button>
        </div>
      )}

      {/* Empty states */}
      {tab === 'urgente' && urgente.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="Sin recordatorios urgentes"
          description={
            totalCount > 0
              ? 'Todos los clientes con deuda fueron contactados recientemente'
              : 'Todos los clientes están al día'
          }
        />
      )}

      {tab === 'todos' && list.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="Sin deudas pendientes"
          description="Todos los clientes están al día"
        />
      )}

      {/* List */}
      {list.length > 0 && (
        <div className="space-y-3">
          {list.map(c => {
            const sev        = severityClass(c.daysOverdue);
            const waReminder = buildDebtReminderMessage(c, c.debt, orders, c.clientPayments);
            const waInfo     = buildDebtInfoMessage(c, c.debt, orders, c.clientPayments);
            const alreadySent = c.daysReminder !== null && c.daysReminder < 7;

            return (
              <div
                key={c.id}
                className={`card !p-4 space-y-3 ${c.needsReminder ? `border ${sev.border}` : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sev.bg}`}>
                    <span className={`font-bold text-sm ${sev.text}`}>
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={10} />
                        {c.daysSincePayment >= 999
                          ? 'Sin abonos registrados'
                          : `Último abono hace ${c.daysSincePayment} días`}
                      </span>
                      {c.status === 'mora' && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle size={9} /> En mora
                        </span>
                      )}
                    </div>
                    {alreadySent && (
                      <p className="text-[10px] text-emerald-600 font-medium mt-1">
                        Recordatorio enviado hace {c.daysReminder} día{c.daysReminder !== 1 ? 's' : ''}
                      </p>
                    )}
                    {c.needsReminder && !alreadySent && (
                      <p className="text-[10px] text-red-500 font-semibold mt-1">
                        Necesita recordatorio
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-red-600">{formatCurrency(c.debt)}</p>
                    <p className="text-[10px] text-gray-400">{c.pendingCount} pedido{c.pendingCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleSend(c, waReminder)}
                    className="flex-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                   type="button">
                    <MessageCircle size={12} /> Recordatorio
                  </button>
                  <button
                    onClick={() => handleSend(c, waInfo)}
                    className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                   type="button">
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

          {/* Footer total */}
          <div className="card !p-3 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">
              Deuda total ({list.length} clientes)
            </span>
            <span className="text-sm font-bold text-red-600">
              {formatCurrency(list.reduce((s, c) => s + c.debt, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
