import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, User, Truck, Calendar, CreditCard, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
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
import type { OrderStatus } from '../types';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, clients, users, updateOrder, deleteOrder } = useAppStore();

  const order = orders.find(o => o.id === id);
  const [statusModal, setStatusModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [newStatus, setNewStatus]   = useState<OrderStatus>('entregado');

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
  const balance  = order.totalAmount - order.amountPaid;
  const profit   = order.totalAmount - order.totalCost;

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
          <button onClick={handleStatusUpdate} className="btn-primary w-full justify-center">
            Actualizar estado
          </button>
        </div>
      </Modal>

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
