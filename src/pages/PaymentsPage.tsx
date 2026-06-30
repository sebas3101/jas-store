import { useState, useEffect } from 'react';
import { Plus, Search, CreditCard, Calendar, CheckCircle2, TrendingUp, Download, Trash2 } from 'lucide-react';
import { exportPagos } from '../utils/exportExcel';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';

const PER_PAGE = 25;
import { StatCard } from '../components/ui/StatCard';
import {
  formatCurrency,
  formatDate,
  paymentMethodLabel,
} from '../utils/formatters';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import type { PaymentMethod } from '../types';

// ─── Formulario de pago — fuera del padre para evitar re-mount en cada render
function PaymentForm({ onClose }: { onClose: () => void }) {
  const { clients, orders, currentUser, addPayment, getClientDebt } = useAppStore();

  const [clientId, setClientId]     = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [amount, setAmount]         = useState(0);
  const [method, setMethod]         = useState<PaymentMethod>('transferencia');
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]           = useState('');

  // Pedidos entregados del cliente — para el registro de auditoría en orderIds
  const deliveredOrders = orders
    .filter(o =>
      o.clientId === clientId &&
      (o.status === 'entregado' || o.status === 'pendiente_pago')
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const deudaTotal = clientId ? getClientDebt(clientId) : 0;
  const [confirming, setConfirming] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirming) { setConfirming(true); return; }

    // Registrar abono — addPayment reconcilia automáticamente los pedidos del cliente
    addPayment({
      clientId,
      orderIds: deliveredOrders.map(o => o.id),
      amount,
      method,
      date: new Date(date).toISOString(),
      notes,
      registeredById: currentUser?.id ?? 'u1',
    });

    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Cliente *</label>
        <input
          className="input-field mb-1"
          placeholder="Buscar cliente..."
          value={clientSearch}
          onChange={e => { setClientSearch(e.target.value); setClientId(''); }}
        />
        {clientSearch && !clientId && (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-48 overflow-y-auto">
            {clients
              .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone ?? '').includes(clientSearch))
              .slice(0, 8)
              .map(c => (
                <button key={c.id} type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  onClick={() => { setClientId(c.id); setClientSearch(c.name); }}>
                  {c.name}
                  {c.phone && <span className="text-xs text-gray-400 ml-2">{c.phone}</span>}
                </button>
              ))
            }
            {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
              <p className="text-sm text-gray-400 px-3 py-2">Sin resultados</p>
            )}
          </div>
        )}
        {clientId && (
          <button type="button" className="text-xs text-gray-400 hover:text-gray-600 mt-0.5"
            onClick={() => { setClientId(''); setClientSearch(''); }}>
            × Cambiar cliente
          </button>
        )}
        <input type="hidden" required value={clientId} onChange={() => {}} />
      </div>
      {clientId && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          deudaTotal > 0
            ? 'bg-amber-50 border border-amber-100 text-amber-700'
            : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
        }`}>
          {deudaTotal > 0
            ? <>Saldo pendiente: <strong>{formatCurrency(deudaTotal)}</strong>. El abono reducirá el saldo total del cliente.</>
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
            Se registrará un abono a <strong>{clients.find(c => c.id === clientId)?.name}</strong> que reducirá su saldo pendiente.
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
  const { payments, clients, users, deletePayment } = useAppStore();
  const { can } = usePermissions();
  const [search, setSearch]     = useState('');
  const [modalOpen, setModal]   = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);
  const [deleting, setDeleting] = useState<(typeof payments)[0] | null>(null);

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
          <button onClick={() => exportPagos(payments, clients)} className="btn-ghost" type="button">
            <Download size={15} /> Excel
          </button>
          {can('pagos', 'registrar_pago') && (
            <button onClick={() => setModal(true)} className="btn-primary" type="button">
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
            className="btn-ghost text-xs w-full justify-center" type="button">
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
            <button onClick={() => setModal(true)} className="btn-primary" type="button">
              <Plus size={14} /> Registrar pago
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(payment => {
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
                    {paymentMethodLabel[payment.method]} · {formatDate(payment.date)}
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
                {can('pagos', 'eliminar') && (
                  <button
                    type="button"
                    onClick={() => setDeleting(payment)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eliminar pago"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination total={filtered.length} page={page} perPage={PER_PAGE} onChange={setPage} />

      <Modal isOpen={modalOpen} onClose={() => setModal(false)} title="Registrar pago / abono">
        <PaymentForm onClose={() => setModal(false)} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deletePayment(deleting.id); setDeleting(null); }}
        title="Eliminar pago"
        message={`¿Eliminar el pago de ${deleting ? formatCurrency(deleting.amount) : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
