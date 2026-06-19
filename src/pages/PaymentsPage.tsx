import { useState } from 'react';
import { Plus, Search, CreditCard, Calendar, CheckCircle2, TrendingUp, Download } from 'lucide-react';
import { exportPagos } from '../utils/exportExcel';
import { distributeFifo } from '../utils/businessLogic';
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
  const { clients, orders, currentUser, addPayment, updateOrder } = useAppStore();

  const [clientId, setClientId] = useState('');
  const [amount, setAmount]     = useState(0);
  const [method, setMethod]     = useState<PaymentMethod>('transferencia');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]       = useState('');

  // Pedidos pendientes del cliente seleccionado, ordenados FIFO
  const pendingOrders = orders
    .filter(o =>
      o.clientId === clientId &&
      o.status !== 'pagado' &&
      o.status !== 'cancelado'
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const deudaTotal = pendingOrders.reduce((s, o) => s + (o.totalAmount - o.amountPaid), 0);
  const [confirming, setConfirming] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirming) { setConfirming(true); return; }

    // Registrar el abono vinculado a todos los pedidos pendientes (auditoría)
    addPayment({
      clientId,
      orderIds: pendingOrders.map(o => o.id),
      amount,
      method,
      date: new Date(date).toISOString(),
      notes,
      registeredById: currentUser?.id ?? 'u1',
    });

    // Distribuir automáticamente en FIFO entre todos los pedidos pendientes
    const aplicaciones = distributeFifo(amount, pendingOrders);
    for (const { orderId, newAmountPaid, newStatus } of aplicaciones) {
      updateOrder(orderId, { amountPaid: newAmountPaid, status: newStatus });
    }

    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Cliente *</label>
        <select className="input-field" required value={clientId}
          onChange={e => setClientId(e.target.value)}>
          <option value="">Seleccionar cliente...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {clientId && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          deudaTotal > 0
            ? 'bg-amber-50 border border-amber-100 text-amber-700'
            : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
        }`}>
          {deudaTotal > 0
            ? <>Saldo pendiente: <strong>{formatCurrency(deudaTotal)}</strong> en {pendingOrders.length} pedido{pendingOrders.length !== 1 ? 's' : ''}. El abono se aplicará del más antiguo al más reciente.</>
            : 'Este cliente no tiene saldo pendiente.'
          }
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
      {confirming ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            ¿Confirmar pago de <span className="text-amber-900">{formatCurrency(amount)}</span>?
          </p>
          <p className="text-xs text-amber-700">
            Se distribuirá FIFO en {pendingOrders.length} pedido{pendingOrders.length !== 1 ? 's' : ''} de{' '}
            <strong>{clients.find(c => c.id === clientId)?.name}</strong>.
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 justify-center">
              Sí, registrar
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost flex-1 justify-center">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" className="btn-primary w-full justify-center">
          Registrar pago
        </button>
      )}
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
        <div className="flex gap-2">
          <button onClick={() => exportPagos(payments, clients)} className="btn-ghost">
            <Download size={15} /> Excel
          </button>
          {can('pagos', 'registrar_pago') && (
            <button onClick={() => setModal(true)} className="btn-primary">
              <Plus size={16} /> Registrar pago
            </button>
          )}
        </div>
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
                  {payment.orderIds.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Aplicado a {payment.orderIds.length} pedido{payment.orderIds.length !== 1 ? 's' : ''}
                    </p>
                  )}
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
