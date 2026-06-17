import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Building2,
  ShoppingBag,
  CreditCard,
  MessageCircle,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  orderStatusLabel,
  orderStatusColor,
  paymentMethodLabel,
  clientStatusLabel,
} from '../utils/formatters';
import { buildDebtReminderMessage, buildDebtInfoMessage, openWhatsApp } from '../utils/whatsapp';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import type { PaymentMethod } from '../types';

// ─── Formulario de abono — fuera del padre para evitar re-mount en cada render
function ClientPaymentForm({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { orders, currentUser, addPayment, updateOrder, updateClient } = useAppStore();

  // Pedidos pendientes de este cliente, del más antiguo al más nuevo (FIFO)
  const pendingOrders = orders
    .filter(o => o.clientId === clientId && o.status !== 'pagado' && o.status !== 'cancelado')
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const debt = pendingOrders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);

  const [amount, setAmount] = useState<number>(debt > 0 ? Math.round(debt) : 0);
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [notes, setNotes]   = useState('');
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addPayment({
      clientId,
      orderIds: pendingOrders.map(o => o.id),
      amount,
      method,
      date: new Date(date).toISOString(),
      notes,
      registeredById: currentUser?.id ?? 'u1',
    });

    // Distribuir el abono entre pedidos pendientes (FIFO: más antiguo primero)
    let remaining = amount;
    for (const order of pendingOrders) {
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

    // Actualizar estado del cliente si quedó al día
    if (debt - amount <= 0) {
      updateClient(clientId, { status: 'al_dia' });
    }

    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Monto del abono *</label>
        <CurrencyInput required min={1} value={amount} onChange={setAmount} />
        {debt > 0 && (
          <p className="text-xs text-amber-600 mt-1">
            Deuda actual: {formatCurrency(debt)}
          </p>
        )}
      </div>
      <div>
        <label className="label">Método de pago</label>
        <select className="input-field" value={method}
          onChange={e => setMethod(e.target.value as PaymentMethod)}>
          {(['transferencia','efectivo','credito','fiado','abono'] as PaymentMethod[]).map(m => (
            <option key={m} value={m}>{paymentMethodLabel[m]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Fecha del pago</label>
        <input type="date" className="input-field" value={date}
          onChange={e => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Notas</label>
        <textarea className="input-field resize-none" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)} placeholder="Referencia de transferencia, etc." />
      </div>
      {pendingOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">Pedidos que se abonarán (FIFO):</p>
          {pendingOrders.map(o => (
            <div key={o.id} className="flex justify-between text-xs text-amber-700 py-0.5">
              <span>{o.orderNumber}</span>
              <span>Pendiente: {formatCurrency(o.totalAmount - o.amountPaid)}</span>
            </div>
          ))}
        </div>
      )}
      <button type="submit" className="btn-primary w-full justify-center">
        Registrar abono
      </button>
    </form>
  );
}

// ─── Página de detalle del cliente
export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    clients,
    orders,
    payments,
    getClientDebt,
  } = useAppStore();

  const client = clients.find(c => c.id === id);
  const [payModal, setPayModal]   = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [infoCopied, setInfoCopied] = useState(false);

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Cliente no encontrado</p>
        <Link to="/clientes" className="btn-primary mt-4 inline-flex">
          <ArrowLeft size={16} /> Volver
        </Link>
      </div>
    );
  }

  const debt         = getClientDebt(client.id);
  const clientOrders = orders.filter(o => o.clientId === client.id)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  const clientPayments = payments.filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPaid    = clientPayments.reduce((s, p) => s + p.amount, 0);
  const totalOrdered = clientOrders.reduce((s, o) => s + o.totalAmount, 0);

  const waMessage     = buildDebtReminderMessage(client, debt, orders);
  const waInfoMessage = buildDebtInfoMessage(client, debt, clientOrders);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(waMessage);
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const handleCopyInfo = () => {
    navigator.clipboard.writeText(waInfoMessage);
    setInfoCopied(true);
    setTimeout(() => setInfoCopied(false), 2000);
  };

  const statusColors: Record<string, string> = {
    al_dia:          'text-emerald-600 bg-emerald-50',
    pendiente:       'text-amber-600 bg-amber-50',
    mora:            'text-red-600 bg-red-50',
    credito_cerrado: 'text-gray-600 bg-gray-100',
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link to="/clientes" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium">
        <ArrowLeft size={16} /> Clientes
      </Link>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
              <span className="text-primary-700 font-bold text-xl">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[client.status]}`}>
                  {clientStatusLabel[client.status]}
                </span>
                {client.isInternal && (
                  <span className="badge-blue text-xs">Cliente interno</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setPayModal(true)} className="btn-primary">
            <CreditCard size={16} /> Registrar abono
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Teléfono</p>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
              <Phone size={12} className="text-gray-400" /> {client.phone}
            </p>
          </div>
          {client.address && (
            <div>
              <p className="text-xs text-gray-400">Dirección</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-gray-400" /> {client.address}
              </p>
            </div>
          )}
          {client.company && (
            <div>
              <p className="text-xs text-gray-400">Empresa</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                <Building2 size={12} className="text-gray-400" /> {client.company}
              </p>
            </div>
          )}
          {client.notes && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">Notas</p>
              <p className="text-sm text-gray-700 mt-0.5">{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOrdered)}</p>
          <p className="text-xs text-gray-500 mt-1">Total pedidos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-gray-500 mt-1">Total pagado</p>
        </div>
        <div className="card text-center">
          <p className={`text-2xl font-bold ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(debt)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{debt > 0 ? 'Saldo pendiente' : 'Al día'}</p>
        </div>
      </div>

      {/* WhatsApp message */}
      {debt > 0 && (
        <div className="card bg-emerald-50 border-emerald-100">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-800">Mensaje de cobro</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyMessage}
                className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {msgCopied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {msgCopied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => openWhatsApp(client.phone, waMessage)}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle size={12} /> WhatsApp
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600 bg-white rounded-xl p-3 whitespace-pre-line border border-gray-100">
            {waMessage}
          </p>
        </div>
      )}

      {/* WhatsApp info de deuda — con detalle de pedidos */}
      {debt > 0 && (
        <div className="card bg-blue-50 border-blue-100">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-800">Resumen de deuda</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyInfo}
                className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {infoCopied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {infoCopied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => openWhatsApp(client.phone, waInfoMessage)}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle size={12} /> WhatsApp
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600 bg-white rounded-xl p-3 whitespace-pre-line border border-gray-100">
            {waInfoMessage}
          </p>
        </div>
      )}

      {/* Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Pedidos ({clientOrders.length})</h2>
          <Link to={`/pedidos?cliente=${client.id}`} className="text-xs text-primary-600 font-medium hover:underline">
            Ver todos
          </Link>
        </div>
        {clientOrders.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Sin pedidos aún" />
        ) : (
          <div className="space-y-2">
            {clientOrders.map(o => (
              <Link
                key={o.id}
                to={`/pedidos/${o.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">{formatDate(o.orderDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
                  <span className={`text-[10px] font-semibold ${orderStatusColor[o.status]}`}>
                    {orderStatusLabel[o.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Historial de abonos ({clientPayments.length})</h2>
        </div>
        {clientPayments.length === 0 ? (
          <EmptyState icon={CreditCard} title="Sin abonos registrados" />
        ) : (
          <div className="space-y-2">
            {clientPayments.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {paymentMethodLabel[p.method]}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(p.date)}</p>
                  {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Registrar abono" size="sm">
        <ClientPaymentForm clientId={client.id} onClose={() => setPayModal(false)} />
      </Modal>
    </div>
  );
}
