import { useState } from 'react';
import { Plus, Search, CreditCard, Calendar, CheckCircle2, TrendingUp } from 'lucide-react';

import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import {
  formatCurrency,
  formatDateTime,
  paymentMethodLabel,
} from '../utils/formatters';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import type { PaymentMethod } from '../types';

// ─── Formulario de pago — fuera del padre para evitar re-mount en cada render
function PaymentForm({ onClose }: { onClose: () => void }) {
  const { clients, orders, currentUser, addPayment, updateOrder, updateClient } = useAppStore();

  const [clientId, setClientId]           = useState('');
  const [amount, setAmount]               = useState(0);
  const [method, setMethod]               = useState<PaymentMethod>('transferencia');
  const [date, setDate]                   = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]                 = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const clientOrders = orders.filter(
    o => o.clientId === clientId && o.status !== 'pagado' && o.status !== 'cancelado'
  );

  const toggleOrder = (oid: string) =>
    setSelectedOrders(prev =>
      prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid]
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addPayment({
      clientId,
      orderIds: selectedOrders,
      amount,
      method,
      date: new Date(date).toISOString(),
      notes,
      registeredById: currentUser?.id ?? 'u1',
    });

    // Distribuir el abono entre los pedidos seleccionados (FIFO por fecha)
    const ordersToProcess = selectedOrders.length > 0
      ? orders
          .filter(o => selectedOrders.includes(o.id))
          .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())
      : [];

    // Calcular deuda total del cliente antes de distribuir (para saber si queda en cero)
    const allClientOrders = orders.filter(
      o => o.clientId === clientId && o.status !== 'cancelado' && o.status !== 'pagado'
    );
    const deudaAntes = allClientOrders.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);

    let remaining = amount;
    for (const order of ordersToProcess) {
      if (remaining <= 0) break;
      const pendiente = order.totalAmount - order.amountPaid;
      if (pendiente <= 0) continue;
      const toApply = Math.min(remaining, pendiente);
      const newPaid = order.amountPaid + toApply;
      updateOrder(order.id, {
        amountPaid: newPaid,
        status: newPaid >= order.totalAmount ? 'pagado' : order.status,
      });
      remaining -= toApply;
    }

    // Actualizar estado del cliente si la deuda queda saldada
    if (clientId && deudaAntes - amount <= 0) {
      updateClient(clientId, { status: 'al_dia' });
    }

    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Cliente *</label>
        <select className="input-field" required value={clientId}
          onChange={e => { setClientId(e.target.value); setSelectedOrders([]); }}>
          <option value="">Seleccionar cliente...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {clientOrders.length > 0 && (
        <div>
          <label className="label">Pedidos a abonar</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {clientOrders.map(o => (
              <label key={o.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={selectedOrders.includes(o.id)}
                  onChange={() => toggleOrder(o.id)}
                  className="accent-primary-600 w-4 h-4 rounded" />
                <span className="text-sm text-gray-700 flex-1">
                  {o.orderNumber} — {formatCurrency(o.totalAmount - o.amountPaid)} pendiente
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Monto ($) *</label>
          <CurrencyInput required min={1} value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className="label">Método</label>
          <select className="input-field" value={method}
            onChange={e => setMethod(e.target.value as PaymentMethod)}>
            {(['transferencia','efectivo','credito','fiado','abono'] as PaymentMethod[]).map(m => (
              <option key={m} value={m}>{paymentMethodLabel[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input-field" value={date}
            onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Notas</label>
          <input className="input-field" value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="Referencia, etc." />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        Registrar pago
      </button>
    </form>
  );
}

// ─── Página principal
export function PaymentsPage() {
  const { payments, clients, users } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]     = useState('');
  const [modalOpen, setModal]   = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const now      = new Date();
  const wkStart  = startOfWeek(now, { weekStartsOn: 1 });
  const wkEnd    = endOfWeek(now, { weekStartsOn: 1 });

  const filtered = payments.filter(p => {
    const client = clients.find(c => c.id === p.clientId);
    const matchSearch = (client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      paymentMethodLabel[p.method].toLowerCase().includes(search.toLowerCase());
    const matchDate = (!dateFrom || new Date(p.date) >= new Date(dateFrom)) &&
      (!dateTo || new Date(p.date) <= new Date(dateTo + 'T23:59:59'));
    return matchSearch && matchDate;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const weeklyPayments = payments.filter(p => {
    try {
      return isWithinInterval(parseISO(p.date), { start: wkStart, end: wkEnd });
    } catch { return false; }
  }).reduce((s, p) => s + p.amount, 0);

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonthPayments = payments.filter(p => {
    try {
      const d = parseISO(p.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  }).reduce((s, p) => s + p.amount, 0);

  const methodIcons: Record<PaymentMethod, string> = {
    transferencia: '💳',
    efectivo:      '💵',
    credito:       '📋',
    fiado:         '🤝',
    abono:         '📩',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pagos y abonos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{payments.length} pagos registrados</p>
        </div>
        {can('pagos', 'registrar_pago') && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={16} /> Registrar pago
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Esta semana"   value={formatCurrency(weeklyPayments)}    icon={Calendar}     color="green" />
        <StatCard title="Este mes"      value={formatCurrency(thisMonthPayments)}  icon={TrendingUp}   color="purple" />
        <StatCard title="Total cobrado" value={formatCurrency(totalCollected)}     icon={CheckCircle2} color="blue"
          className="col-span-2 sm:col-span-1" />
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar por cliente o método..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label !text-xs">Desde</label>
            <input type="date" className="input-field" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label !text-xs">Hasta</label>
            <input type="date" className="input-field" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="btn-ghost text-xs w-full justify-center">
            Limpiar filtro de fechas
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No hay pagos"
          description="Registra el primer abono o pago"
          action={
            <button onClick={() => setModal(true)} className="btn-primary">
              <Plus size={14} /> Registrar pago
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(payment => {
            const client = clients.find(c => c.id === payment.clientId);
            const registeredBy = users.find(u => u.id === payment.registeredById);
            return (
              <div key={payment.id} className="card !p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  {methodIcons[payment.method]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {client?.name ?? 'Cliente'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {paymentMethodLabel[payment.method]} · {formatDateTime(payment.date)}
                    {registeredBy && ` · Registrado por ${registeredBy.name}`}
                  </p>
                  {payment.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">{payment.notes}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {payment.orderIds.length} pedido(s)
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModal(false)} title="Registrar pago / abono">
        <PaymentForm onClose={() => setModal(false)} />
      </Modal>
    </div>
  );
}
