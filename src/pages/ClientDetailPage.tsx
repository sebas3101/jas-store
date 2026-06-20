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
  FileText,
  RefreshCw,
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
import { buildDebtReminderMessage, buildDebtInfoMessage, buildDataUpdateMessage, openWhatsApp } from '../utils/whatsapp';
import { distributeFifo, calculateClientDebt } from '../utils/businessLogic';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import type { Client, Order, Payment, PaymentMethod } from '../types';

// ─── Estado de cuenta imprimible ─────────────────────────────────────────────
function printEstadoCuenta(client: Client, clientOrders: Order[], clientPayments: Payment[]) {
  const totalOrdered = clientOrders.filter(o => o.status !== 'cancelado').reduce((s, o) => s + o.totalAmount, 0);
  const totalAbonado = clientPayments.reduce((s, p) => s + p.amount, 0);
  const deuda = calculateClientDebt(client.id, clientOrders);

  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const ordersRows = clientOrders.map(o => {
    const prods    = o.items.map(it => `${it.quantity}x ${it.productName}`).join(', ');
    const pendiente = o.totalAmount - o.amountPaid;
    return `<tr>
      <td>${o.orderNumber}</td>
      <td>${formatDate(o.orderDate)}</td>
      <td style="max-width:220px">${prods}</td>
      <td>${formatCurrency(o.totalAmount)}</td>
      <td>${formatCurrency(o.amountPaid)}</td>
      <td style="color:${pendiente > 0 ? '#dc2626' : '#16a34a'};font-weight:600">${pendiente > 0 ? formatCurrency(pendiente) : 'Pagado'}</td>
      <td>${orderStatusLabel[o.status]}</td>
    </tr>`;
  }).join('');

  const payRows = clientPayments.length > 0
    ? clientPayments.map(p => `<tr>
        <td>${formatDate(p.date)}</td>
        <td>${paymentMethodLabel[p.method]}</td>
        <td style="font-weight:600;color:#16a34a">${formatCurrency(p.amount)}</td>
        ${p.notes ? `<td>${p.notes}</td>` : '<td>—</td>'}
      </tr>`).join('')
    : '<tr><td colspan="4" style="color:#999;text-align:center">Sin abonos registrados</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Cuenta — ${client.name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;padding:24px;max-width:900px;margin:0 auto}
    h1{font-size:18px;color:#7c3aed}
    h2{font-size:12px;font-weight:700;border-bottom:2px solid #7c3aed;padding-bottom:4px;margin:20px 0 8px;color:#7c3aed}
    .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #7c3aed;margin-bottom:16px}
    .info-box{background:#f5f3ff;border:1px solid #e9d5ff;border-radius:6px;padding:10px 14px;margin-bottom:14px}
    .info-box strong{font-size:13px}
    .summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
    .summary-cell{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center}
    .summary-cell .label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
    .summary-cell .value{font-size:15px;font-weight:700;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    th{background:#f5f3ff;padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#6d28d9}
    td{padding:5px 8px;border-bottom:1px solid #f3f4f6;font-size:11px}
    tr:last-child td{border-bottom:none}
    .balance{background:${deuda > 0 ? '#fef2f2' : '#f0fdf4'};border:2px solid ${deuda > 0 ? '#fca5a5' : '#86efac'};border-radius:8px;padding:16px;text-align:center;margin-top:16px}
    .balance .label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
    .balance .amount{font-size:24px;font-weight:700;color:${deuda > 0 ? '#dc2626' : '#16a34a'};margin-top:4px}
    .footer{margin-top:20px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px}
    @media print{body{padding:10px}.no-print{display:none}}
    .no-print{text-align:center;margin-top:16px}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>JAS Store</h1>
      <p style="color:#6b7280;margin-top:3px;font-size:10px">Estado de Cuenta del Cliente</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:10px;color:#6b7280">Fecha de corte</p>
      <p style="font-weight:700;font-size:12px">${today}</p>
    </div>
  </div>

  <div class="info-box">
    <strong>${client.name}</strong><br>
    <span style="color:#6b7280">Tel: ${client.phone}${client.address ? ' · Dir: ' + client.address : ''}${client.company ? ' · ' + client.company : ''}</span>
  </div>

  <div class="summary">
    <div class="summary-cell">
      <div class="label">Total pedidos</div>
      <div class="value">${formatCurrency(totalOrdered)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Total abonado</div>
      <div class="value" style="color:#16a34a">${formatCurrency(totalAbonado)}</div>
    </div>
    <div class="summary-cell">
      <div class="label">Saldo pendiente</div>
      <div class="value" style="color:${deuda > 0 ? '#dc2626' : '#16a34a'}">${formatCurrency(deuda)}</div>
    </div>
  </div>

  <h2>Pedidos (${clientOrders.length})</h2>
  <table>
    <thead>
      <tr><th>N° Pedido</th><th>Fecha</th><th>Productos</th><th>Total</th><th>Abonado</th><th>Pendiente</th><th>Estado</th></tr>
    </thead>
    <tbody>${ordersRows || '<tr><td colspan="7" style="color:#999;text-align:center">Sin pedidos</td></tr>'}</tbody>
  </table>

  <h2>Abonos registrados (${clientPayments.length})</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Método</th><th>Monto</th><th>Notas</th></tr></thead>
    <tbody>${payRows}</tbody>
  </table>

  <div class="balance">
    <div class="label">${deuda > 0 ? 'Saldo pendiente' : 'Estado'}</div>
    <div class="amount">${deuda > 0 ? formatCurrency(deuda) : '¡Al día!'}</div>
  </div>

  <div class="footer">
    Documento generado por JAS Store · ${today} · Confidencial
  </div>
  <div class="no-print"><button onclick="window.close()" style="margin-top:8px;padding:8px 20px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">✕ Cerrar ventana</button></div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=960,height=720');
  if (!w) { alert('Permite ventanas emergentes para imprimir el estado de cuenta.'); return; }
  w.document.write(html);
  w.document.close();
  w.onafterprint = () => w.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

// ─── Formulario de abono — fuera del padre para evitar re-mount en cada render
function ClientPaymentForm({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const { orders, clients, currentUser, addPayment, updateOrder } = useAppStore();

  const pendingOrders = orders
    .filter(o =>
      o.clientId === clientId &&
      (o.status === 'entregado' || o.status === 'pendiente_pago')
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const debt = pendingOrders.reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);

  const [amount, setAmount]     = useState<number>(debt > 0 ? Math.round(debt) : 0);
  const [method, setMethod]     = useState<PaymentMethod>('transferencia');
  const [notes, setNotes]       = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clientName = clients.find(c => c.id === clientId)?.name ?? '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirming) { setConfirming(true); return; }
    if (submitting) return;
    setSubmitting(true);
    addPayment({
      clientId,
      orderIds: pendingOrders.map(o => o.id),
      amount,
      method,
      date: new Date(date).toISOString(),
      notes,
      registeredById: currentUser?.id ?? 'u1',
    });
    const aplicaciones = distributeFifo(amount, pendingOrders);
    for (const { orderId, newAmountPaid, newStatus } of aplicaciones) {
      updateOrder(orderId, { amountPaid: newAmountPaid, status: newStatus });
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
      {confirming ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            ¿Confirmar abono de <span className="text-amber-900">{formatCurrency(amount)}</span>?
          </p>
          <p className="text-xs text-amber-700">
            Se distribuirá FIFO en {pendingOrders.length} pedido{pendingOrders.length !== 1 ? 's' : ''} de <strong>{clientName}</strong>.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {submitting ? 'Guardando...' : 'Sí, registrar'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-ghost flex-1 justify-center">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" className="btn-primary w-full justify-center">
          Registrar abono
        </button>
      )}
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

  const waMessage     = buildDebtReminderMessage(client, debt, orders, payments);
  const waInfoMessage = buildDebtInfoMessage(client, debt, clientOrders, clientPayments);

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
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                if (!client.phone) { alert('El cliente no tiene número registrado.'); return; }
                openWhatsApp(client.phone, buildDataUpdateMessage(client));
              }}
              className="btn-ghost text-xs"
              title="Solicitar actualización de datos por WhatsApp"
             type="button">
              <RefreshCw size={14} /> Actualizar datos
            </button>
            <button
              onClick={() => printEstadoCuenta(client, clientOrders, clientPayments)}
              className="btn-ghost text-xs"
              title="Imprimir estado de cuenta"
             type="button">
              <FileText size={14} /> Estado de cuenta
            </button>
            <Link to={`/pedidos?cliente=${client.id}`} className="btn-ghost text-xs">
              <ShoppingBag size={14} /> Nuevo pedido
            </Link>
            <button onClick={() => setPayModal(true)} className="btn-primary" type="button">
              <CreditCard size={16} /> Registrar abono
            </button>
          </div>
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

      {/* Financial summary — horizontal list on mobile, 3 cols on sm+ */}
      <div className="card !p-0 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-gray-100 sm:grid sm:grid-cols-3">
        <div className="flex items-center justify-between sm:flex-col sm:items-start px-5 py-3.5 gap-3">
          <p className="text-xs text-gray-500 flex-shrink-0">Total pedidos</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(totalOrdered)}</p>
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-start px-5 py-3.5 gap-3">
          <p className="text-xs text-gray-500 flex-shrink-0">Total pagado</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-start px-5 py-3.5 gap-3">
          <p className="text-xs text-gray-500 flex-shrink-0">{debt > 0 ? 'Saldo pendiente' : 'Al día'}</p>
          <p className={`text-lg font-bold tabular-nums ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatCurrency(debt)}
          </p>
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
               type="button">
                {msgCopied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {msgCopied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => openWhatsApp(client.phone, waMessage)}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
               type="button">
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
               type="button">
                {infoCopied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {infoCopied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => openWhatsApp(client.phone, waInfoMessage)}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
               type="button">
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
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(o.totalAmount)}</p>
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
                <p className="text-sm font-bold text-emerald-600 tabular-nums flex-shrink-0">{formatCurrency(p.amount)}</p>
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
