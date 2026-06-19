import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, User, Truck, Calendar, CreditCard, Edit2, Trash2, CheckCircle2, MessageCircle, Store, Printer } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
  paymentMethodLabel,
  categoryLabel,
} from '../utils/formatters';
import { buildAvailabilityMessage, openWhatsApp } from '../utils/whatsapp';
import type { Order, OrderStatus } from '../types';

function printReceipt(order: Order, clientName: string, payMethod: string) {
  const itemRows = order.items.map(it =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${it.productName}${it.size ? ` (T.${it.size})` : ''}${it.color ? ` / ${it.color}` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center;">${it.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatCurrency(it.salePrice)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${formatCurrency(it.salePrice * it.quantity)}</td>
    </tr>`
  ).join('');
  const balance = order.totalAmount - order.amountPaid;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo ${order.orderNumber}</title>
  <style>body{font-family:sans-serif;font-size:13px;color:#111;margin:0;padding:24px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:#6b7280;padding:6px 8px;border-bottom:2px solid #e5e7eb}td{font-size:13px}.footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center}@media print{body{padding:12px}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
    <div><h1 style="color:#7c3aed">JAS Store</h1><p style="color:#6b7280;margin:4px 0 0">Recibo de pedido</p></div>
    <div style="text-align:right"><p style="font-weight:700;font-size:16px">${order.orderNumber}</p><p style="color:#6b7280;margin:2px 0">${formatDate(order.orderDate)}</p></div>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px">
    <p style="margin:0;font-weight:600">${clientName}</p>
    <p style="margin:4px 0 0;color:#6b7280;font-size:12px">Forma de pago: ${payMethod}</p>
    ${order.notes ? `<p style="margin:4px 0 0;color:#6b7280;font-size:12px">Nota: ${order.notes}</p>` : ''}
  </div>
  <table><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${itemRows}</tbody></table>
  <div style="margin-top:16px;border-top:2px solid #e5e7eb;padding-top:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">Total</span><span style="font-weight:700;font-size:15px">${formatCurrency(order.totalAmount)}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#6b7280">Pagado</span><span style="color:#10b981;font-weight:600">${formatCurrency(order.amountPaid)}</span></div>
    <div style="display:flex;justify-content:space-between"><span style="font-weight:700">Saldo pendiente</span><span style="font-weight:700;color:${balance > 0 ? '#ef4444' : '#10b981'}">${formatCurrency(balance)}</span></div>
  </div>
  <p class="footer">Gracias por su compra — JAS Store</p>
  </body></html>`;
  const win = window.open('', '_blank', 'width=600,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, clients, users, suppliers, updateOrder, deleteOrder } = useAppStore();

  const order = orders.find(o => o.id === id);
  const [statusModal, setStatusModal]     = useState(false);
  const [deleteDialog, setDeleteDialog]   = useState(false);
  const [newStatus, setNewStatus]         = useState<OrderStatus>('entregado');
  const [availabilityModal, setAvailabilityModal] = useState(false);

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Pedido no encontrado</p>
        <Link to="/pedidos" className="btn-primary mt-4 inline-flex">
          <ArrowLeft size={16} /> Volver
        </Link>
      </div>
    );
  }

  const client   = clients.find(c => c.id === order.clientId);
  const seller   = users.find(u => u.id === order.sellerId);
  const delivery = users.find(u => u.id === order.deliveryPersonId);
  const supplier = suppliers.find(s => s.id === order.supplierId);
  const balance  = order.totalAmount - order.amountPaid;
  const profit   = order.totalAmount - order.totalCost;

  // La deuda solo se suma al cliente cuando el pedido está entregado o pendiente_pago
  const countAsDebt = order.status === 'entregado' || order.status === 'pendiente_pago';

  const STATUS_FLOW: OrderStatus[] = [
    'tomado', 'por_recoger', 'recogido', 'entregado', 'pagado', 'pendiente_pago', 'cancelado',
  ];

  const handleStatusUpdate = () => {
    const updates: Partial<typeof order> = { status: newStatus };
    if (newStatus === 'entregado' || newStatus === 'pagado') {
      updates.deliveredAt = new Date().toISOString();
    }
    if (newStatus === 'pagado') {
      updates.amountPaid = order.totalAmount;
    }
    updateOrder(order.id, updates);
    setStatusModal(false);
    // Al pasar a 'por_recoger', ofrecer enviar mensaje de disponibilidad
    if (newStatus === 'por_recoger' && client?.phone) {
      setAvailabilityModal(true);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/pedidos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-medium">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{order.orderNumber}</h1>
          <p className="text-xs text-gray-400">{formatDate(order.orderDate)}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${orderStatusColor[order.status]}`}>
          {orderStatusLabel[order.status]}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setNewStatus(order.status); setStatusModal(true); }}
          className="btn-primary">
          <Edit2 size={14} /> Cambiar estado
        </button>
        <button
          onClick={() => printReceipt(order, client?.name ?? 'Cliente', paymentMethodLabel[order.paymentMethod])}
          className="btn-ghost"
        >
          <Printer size={14} /> Recibo
        </button>
        <button onClick={() => setDeleteDialog(true)} className="btn-secondary text-red-500 hover:text-red-600">
          <Trash2 size={14} /> Eliminar
        </button>
      </div>

      {/* Client + financials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h2 className="section-title">Información</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Cliente:</span>
              {client ? (
                <Link to={`/clientes/${client.id}`} className="font-semibold text-primary-600 hover:underline">
                  {client.name}
                </Link>
              ) : (
                <span className="font-semibold text-gray-800">Desconocido</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Vendedor:</span>
              <span className="font-semibold text-gray-800">{seller?.name ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Truck size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Repartidor:</span>
              <span className="font-semibold text-gray-800">{delivery?.name ?? 'Sin asignar'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CreditCard size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">Forma de pago:</span>
              <span className="font-semibold text-gray-800">{paymentMethodLabel[order.paymentMethod]}</span>
            </div>
            {order.estimatedDeliveryDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-500">Entrega est.:</span>
                <span className="font-semibold text-gray-800">{formatDate(order.estimatedDeliveryDate)}</span>
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span className="text-gray-500">Entregado:</span>
                <span className="font-semibold text-gray-800">{formatDate(order.deliveredAt)}</span>
              </div>
            )}
            {order.notes && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                {order.notes}
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-3">Resumen financiero</h2>
          <div className="space-y-2">
            {[
              { label: 'Total vendido',  value: formatCurrency(order.totalAmount), color: 'text-gray-900' },
              { label: 'Costo total',    value: formatCurrency(order.totalCost),   color: 'text-gray-600' },
              { label: 'Ganancia est.',  value: formatCurrency(profit),            color: 'text-emerald-600' },
              { label: 'Abonado',        value: formatCurrency(order.amountPaid),  color: 'text-emerald-600' },
              { label: 'Saldo pendiente',value: formatCurrency(balance),           color: balance > 0 ? 'text-red-600' : 'text-emerald-600' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <h2 className="section-title mb-4">Productos ({order.items.length})</h2>
        <div className="space-y-2">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{item.productName}</p>
                <p className="text-xs text-gray-400">
                  {categoryLabel[item.category]}
                  {item.size && ` · Talla ${item.size}`}
                  {item.color && ` · ${item.color}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(item.salePrice * item.quantity)}
                </p>
                <p className="text-xs text-gray-400">
                  {item.quantity} × {formatCurrency(item.salePrice)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proveedor */}
      {supplier && (
        <div className="card">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Store size={14} className="text-amber-500" /> Proveedor
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Proveedor:</span>
              <span className="font-semibold text-gray-800">{supplier.name}</span>
            </div>
            {supplier.address && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dirección:</span>
                <span className="font-medium text-gray-700 text-right max-w-[60%]">{supplier.address}</span>
              </div>
            )}
            {order.supplierPaymentAmount != null && order.supplierPaymentAmount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pago al proveedor:</span>
                  <span className="font-bold text-gray-800">{formatCurrency(order.supplierPaymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Estado pago:</span>
                  <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                    order.supplierPaymentStatus === 'pagado'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {order.supplierPaymentStatus === 'pagado' ? 'Pagado ✓' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Método:</span>
                  <span className="font-medium text-gray-700">
                    {order.supplierPaymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Aviso deuda */}
      {!countAsDebt && balance > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          ℹ️ Este pedido <strong>no suma deuda</strong> al cliente hasta que pase a estado <strong>Entregado</strong>.
          Estado actual: <strong>{orderStatusLabel[order.status]}</strong>
        </div>
      )}

      {/* Status modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Cambiar estado" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Nuevo estado</label>
            <select className="input-field" value={newStatus}
              onChange={e => setNewStatus(e.target.value as OrderStatus)}>
              {STATUS_FLOW.map(s => (
                <option key={s} value={s}>{orderStatusLabel[s]}</option>
              ))}
            </select>
          </div>
          {newStatus === 'por_recoger' && client?.phone && (
            <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700">
              ✓ Al guardar, podrás enviar un WhatsApp de disponibilidad a {client.name}.
            </div>
          )}
          <button onClick={handleStatusUpdate} className="btn-primary w-full justify-center">
            Actualizar estado
          </button>
        </div>
      </Modal>

      {/* Modal WhatsApp disponibilidad */}
      {client && (
        <Modal isOpen={availabilityModal} onClose={() => setAvailabilityModal(false)} title="Confirmar disponibilidad">
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                <MessageCircle size={12} /> Mensaje para {client.name}
              </p>
              <p className="text-xs text-gray-700 whitespace-pre-line">
                {buildAvailabilityMessage(client, order)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAvailabilityModal(false)} className="btn-ghost flex-1 justify-center">
                Omitir
              </button>
              {client.phone && (
                <button
                  onClick={() => {
                    openWhatsApp(client.phone!, buildAvailabilityMessage(client, order));
                    setAvailabilityModal(false);
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle size={14} /> Enviar WhatsApp
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => { deleteOrder(order.id); navigate('/pedidos'); }}
        title="Eliminar pedido"
        message={`¿Seguro que deseas eliminar el pedido ${order.orderNumber}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
