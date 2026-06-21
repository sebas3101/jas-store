import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, ShoppingBag, ArrowRight, X, MessageCircle, Download, Pen, ChevronRight } from 'lucide-react';
import { useSwipeCard } from '../hooks/useSwipeCard';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { OrderStatusButton, NEXT_STATUS } from '../components/ui/OrderStatusButton';
import { exportPedidos } from '../utils/exportExcel';
import { buildOrderConfirmationMessage, openWhatsApp } from '../utils/whatsapp';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';

const PER_PAGE = 20;
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
  paymentMethodLabel,
} from '../utils/formatters';
import type { Order, OrderStatus, PaymentMethod, OrderItem, SupplierPaymentStatus, SupplierPaymentMethod } from '../types';

const STATUS_FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',           label: 'Todos'          },
  { value: 'tomado',        label: 'Tomado'         },
  { value: 'por_recoger',   label: 'Por recoger'    },
  { value: 'recogido',      label: 'Recogido'       },
  { value: 'entregado',     label: 'Entregado'      },
  { value: 'pendiente_pago',label: 'Pend. pago'     },
  { value: 'pagado',        label: 'Pagado'         },
  { value: 'cancelado',     label: 'Cancelado'      },
];

function OrderForm({ onSave, initial }: {
  onSave:   (o: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => void;
  initial?: Order;
}) {
  const { clients, products, users, suppliers, currentUser, getClientDebt } = useAppStore();
  const [clientId, setClientId]   = useState(initial?.clientId ?? '');
  const [items, setItems]         = useState<Omit<OrderItem, 'id'>[]>(
    initial?.items.map(({ id: _id, ...rest }) => rest) ?? [{
      productId: '', productName: '', category: 'otro', quantity: 1, salePrice: 0, costPrice: 0,
    }]
  );
  const [status, setStatus]           = useState<OrderStatus>(initial?.status ?? 'tomado');
  const [payMethod, setPayMethod]     = useState<PaymentMethod>(initial?.paymentMethod ?? 'credito');
  const [sellerId, setSellerId]       = useState(initial?.sellerId ?? currentUser?.id ?? '');
  const [deliveryId, setDeliveryId]   = useState(initial?.deliveryPersonId ?? '');
  const [orderDate, setOrderDate]     = useState(
    initial?.orderDate ? initial.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [estDelivery, setEstDelivery] = useState(initial?.estimatedDeliveryDate?.slice(0, 10) ?? '');
  const [amountPaid, setAmountPaid]   = useState(initial?.amountPaid ?? 0);
  const [notes, setNotes]             = useState(initial?.notes ?? '');
  // Proveedor
  const [supplierId, setSupplierId]                 = useState(initial?.supplierId ?? '');
  const [supplierPayStatus, setSupplierPayStatus]   = useState<SupplierPaymentStatus>(initial?.supplierPaymentStatus ?? 'pendiente');
  const [supplierPayAmount, setSupplierPayAmount]   = useState(initial?.supplierPaymentAmount ?? 0);
  const [supplierPayMethod, setSupplierPayMethod]   = useState<SupplierPaymentMethod>(initial?.supplierPaymentMethod ?? 'efectivo');

  const addItem = () => setItems(prev => [...prev, {
    productId: '', productName: '', category: 'otro', quantity: 1, salePrice: 0, costPrice: 0,
  }]);

  const setItem = (i: number, k: string, v: unknown) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [k]: v };
      if (k === 'productId') {
        const prod = products.find(p => p.id === v);
        if (prod) {
          updated.productName = prod.name;
          updated.category    = prod.category;
          updated.salePrice   = prod.salePrice;
          updated.costPrice   = prod.costPrice;
          updated.size        = prod.size ?? '';
          updated.color       = prod.color ?? '';
        }
      }
      return updated;
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const totalAmount = items.reduce((s, it) => s + it.salePrice * it.quantity, 0);
  const totalCost   = items.reduce((s, it) => s + it.costPrice * it.quantity, 0);

  // Alerta de límite de crédito (solo pedidos nuevos)
  const creditWarning = (() => {
    if (initial || !clientId || !['credito', 'fiado', 'abono'].includes(payMethod)) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client?.creditLimit) return null;
    const currentDebt  = getClientDebt(clientId);
    const newBalance   = Math.max(0, totalAmount - amountPaid);
    const projectedDebt = currentDebt + newBalance;
    if (projectedDebt <= client.creditLimit) return null;
    return { limit: client.creditLimit, currentDebt, newBalance, projectedDebt };
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      clientId,
      items: items.map((it, i) => ({
        ...it,
        id:    `item_${i}`,
        size:  it.size?.trim()  || undefined,
        color: it.color?.trim() || undefined,
      })),
      totalAmount,
      totalCost,
      amountPaid,
      status,
      paymentMethod: payMethod,
      sellerId,
      deliveryPersonId:      deliveryId     || undefined,
      supplierId:            supplierId     || undefined,
      supplierPaymentStatus: supplierId ? supplierPayStatus  : undefined,
      supplierPaymentAmount: supplierId ? supplierPayAmount  : undefined,
      supplierPaymentMethod: supplierId ? supplierPayMethod  : undefined,
      orderDate: new Date(orderDate).toISOString(),
      estimatedDeliveryDate: estDelivery ? new Date(estDelivery).toISOString() : undefined,
      notes,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Cliente *</label>
          <select className="input-field" required value={clientId}
            onChange={e => setClientId(e.target.value)}>
            <option value="">Seleccionar cliente...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {creditWarning && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs">
              <p className="font-semibold text-red-700">⚠️ Supera el límite de crédito</p>
              <p className="text-red-600 mt-0.5">
                Límite: {formatCurrency(creditWarning.limit)} · Deuda actual: {formatCurrency(creditWarning.currentDebt)} · Nuevo saldo: {formatCurrency(creditWarning.newBalance)} → Total proyectado: <strong>{formatCurrency(creditWarning.projectedDebt)}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0">Productos *</label>
            <button type="button" onClick={addItem}
              className="text-xs text-primary-600 font-medium hover:underline flex items-center gap-1">
              <Plus size={12} /> Agregar
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <select className="input-field text-xs" value={item.productId}
                      onChange={e => setItem(i, 'productId', e.target.value)}>
                      <option value="">Producto libre...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.salePrice)}</option>
                      ))}
                    </select>
                  </div>
                  {!item.productId && (
                    <div className="col-span-2">
                      <input className="input-field text-xs" placeholder="Nombre del producto"
                        value={item.productName}
                        onChange={e => setItem(i, 'productName', e.target.value)} />
                    </div>
                  )}
                  <div>
                    <input className="input-field text-xs" placeholder="Talla (S, M, L...)"
                      value={item.size ?? ''}
                      onChange={e => setItem(i, 'size', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <input className="input-field text-xs" placeholder="Color"
                      value={item.color ?? ''}
                      onChange={e => setItem(i, 'color', e.target.value)} />
                  </div>
                  <div>
                    <CurrencyInput className="text-xs" placeholder="Precio venta"
                      value={item.salePrice} min={0}
                      onChange={v => setItem(i, 'salePrice', v)} />
                  </div>
                  <div>
                    <CurrencyInput className="text-xs" placeholder="Precio costo"
                      value={item.costPrice} min={0}
                      onChange={v => setItem(i, 'costPrice', v)} />
                  </div>
                  <div>
                    <input type="text" inputMode="numeric" pattern="[0-9]*"
                      className="input-field text-xs" placeholder="Cantidad"
                      value={item.quantity}
                      onChange={e => setItem(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">
                      Total: {formatCurrency(item.salePrice * item.quantity)}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="ml-auto text-red-400 hover:text-red-600 text-xs">
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold mt-2 px-1">
            <span className="text-gray-600">Total pedido:</span>
            <span className="text-primary-700">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div>
          <label className="label">Estado</label>
          <select className="input-field" value={status}
            onChange={e => setStatus(e.target.value as OrderStatus)}>
            {STATUS_FILTERS.filter(s => s.value !== 'all').map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Forma de pago</label>
          <select className="input-field" value={payMethod}
            onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
            {(['transferencia','efectivo','credito','fiado','abono'] as PaymentMethod[]).map(m => (
              <option key={m} value={m}>{paymentMethodLabel[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Abono inicial ($)</label>
          <CurrencyInput value={amountPaid} min={0} onChange={v => setAmountPaid(Math.min(v, totalAmount || v))} />
          {amountPaid > 0 && totalAmount > 0 && amountPaid > totalAmount && (
            <p className="text-xs text-red-500 mt-1">El abono no puede superar el total del pedido.</p>
          )}
        </div>
        <div>
          <label className="label">Vendedor</label>
          <select className="input-field" value={sellerId}
            onChange={e => setSellerId(e.target.value)}>
            <option value="">Sin asignar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Repartidor</label>
          <select className="input-field" value={deliveryId}
            onChange={e => setDeliveryId(e.target.value)}>
            <option value="">Sin asignar</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fecha pedido</label>
          <input type="date" className="input-field" value={orderDate}
            onChange={e => setOrderDate(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Fecha estimada entrega</label>
          <input type="date" className="input-field" value={estDelivery}
            onChange={e => setEstDelivery(e.target.value)} />
        </div>

        {/* Proveedor */}
        <div className="col-span-2 border-t border-gray-100 pt-3">
          <label className="label font-semibold text-gray-700">Proveedor (para recogida)</label>
          <select className="input-field" value={supplierId}
            onChange={e => setSupplierId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        {supplierId && (
          <>
            <div>
              <label className="label">Pago proveedor ($)</label>
              <CurrencyInput value={supplierPayAmount} min={0} onChange={setSupplierPayAmount} />
            </div>
            <div>
              <label className="label">Estado pago proveedor</label>
              <select className="input-field" value={supplierPayStatus}
                onChange={e => setSupplierPayStatus(e.target.value as SupplierPaymentStatus)}>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Método pago proveedor</label>
              <select className="input-field" value={supplierPayMethod}
                onChange={e => setSupplierPayMethod(e.target.value as SupplierPaymentMethod)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </>
        )}

        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn-primary w-full justify-center">
        {initial ? 'Actualizar pedido' : 'Guardar pedido'}
      </button>
    </form>
  );
}

// Wrapper that captures the created order for the WhatsApp modal
function OrderFormWithWa({ onCreated }: { onCreated: (o: Order) => void }) {
  const { addOrder, orders } = useAppStore();
  return (
    <OrderForm onSave={async data => {
      const prevCount = orders.length;
      await addOrder(data);
      // addOrder is async; get the new order from latest store state
      const storeOrders = useAppStore.getState().orders;
      if (storeOrders.length > prevCount) {
        const newest = [...storeOrders]
          .filter(o => o.clientId === data.clientId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (newest) { onCreated(newest); return; }
      }
      onCreated({ ...data, id: '', orderNumber: '', createdAt: '', updatedAt: '' } as Order);
    }} />
  );
}

interface SwipeableCardProps {
  order:           Order;
  client?:         { id: string; name: string; phone?: string };
  seller?:         { id: string; name: string };
  canEdit:         boolean;
  canChangeStatus: boolean;
  advancing:       boolean;
  onAdvance:       () => void;
  onEdit:          () => void;
}

function SwipeableOrderCard({ order, client, seller, canEdit, canChangeStatus, advancing, onAdvance, onEdit }: SwipeableCardProps) {
  const balance = order.totalAmount - order.amountPaid;
  const canAdvance = canChangeStatus && !['pagado', 'cancelado'].includes(order.status);

  const { handlers, translateX, isSwiping } = useSwipeCard({
    onSwipeRight: canAdvance ? onAdvance : undefined,
    onSwipeLeft:  client?.phone ? () => openWhatsApp(client.phone!, '') : undefined,
  });

  const showAdvanceHint = translateX > 30;
  const showWaHint      = translateX < -30;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background: swipe right → avanzar estado */}
      <div className={`absolute inset-y-0 left-0 flex items-center gap-1 px-4 bg-emerald-500 rounded-l-2xl transition-opacity ${showAdvanceHint && canAdvance ? 'opacity-100' : 'opacity-0'}`}>
        <ChevronRight size={18} className="text-white" />
        <span className="text-white text-xs font-semibold">Avanzar</span>
      </div>
      {/* Background: swipe left → WhatsApp */}
      <div className={`absolute inset-y-0 right-0 flex items-center gap-1 px-4 bg-emerald-500 rounded-r-2xl transition-opacity ${showWaHint && client?.phone ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-white text-xs font-semibold">WhatsApp</span>
        <MessageCircle size={18} className="text-white" />
      </div>

      {/* Card */}
      <div
        {...handlers}
        style={{ transform: `translateX(${translateX}px)`, transition: isSwiping ? 'none' : 'transform 0.25s ease' }}
        className="card !p-4 hover:shadow-md transition-shadow relative z-10 touch-pan-y"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={16} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderStatusColor[order.status]}`}>
                {orderStatusLabel[order.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {client?.name ?? 'Cliente'} · {formatDate(order.orderDate)}
              {seller && ` · ${seller.name}`}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
            {balance > 0 && (
              <p className="text-xs font-semibold text-amber-600">Debe {formatCurrency(balance)}</p>
            )}
          </div>
          {canEdit && !['pagado', 'cancelado'].includes(order.status) && (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              title="Editar pedido"
            >
              <Pen size={14} />
            </button>
          )}
          <Link to={`/pedidos/${order.id}`} className="btn-primary !px-2.5 !py-1.5 flex-shrink-0">
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="flex items-center gap-1 mt-3 flex-wrap">
          <div className="flex gap-1 flex-1 flex-wrap">
            {order.items.map((it, i) => (
              <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {it.quantity}x {it.productName}
              </span>
            ))}
          </div>
          {canChangeStatus && (
            <OrderStatusButton
              order={order}
              onAdvance={() => onAdvance()}
              advancing={advancing}
              variant="pill"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const location  = useLocation();
  const clienteParam = new URLSearchParams(location.search).get('cliente') ?? '';

  const { orders, clients, users, updateOrder } = useAppStore();
  const { can } = usePermissions();

  const prefilledName = clienteParam
    ? (clients.find(c => c.id === clienteParam)?.name ?? '')
    : '';

  const [search, setSearch]       = useState(prefilledName);
  const [filterClient, setFilterClient] = useState(clienteParam);
  const [filterStatus, setFilter] = useState<OrderStatus | 'all'>('all');
  const [filterSeller, setFilterSeller] = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [page, setPage]               = useState(1);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterClient, filterSeller]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [waOrder, setWaOrder]         = useState<Order | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const handleAdvanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || advancingId) return;
    setAdvancingId(order.id);
    await updateOrder(order.id, { status: next.status });
    setAdvancingId(null);
  };

  const clearClientFilter = () => { setFilterClient(''); setSearch(''); };

  const filtered = orders.filter(o => {
    const client = clients.find(c => c.id === o.clientId);
    const matchSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchClient = !filterClient || o.clientId === filterClient;
    const matchSeller = !filterSeller || o.sellerId === filterSeller;
    return matchSearch && matchStatus && matchClient && matchSeller;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} pedidos en total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportPedidos(filtered, clients)} className="btn-ghost" type="button">
            <Download size={15} /> Excel
          </button>
          {can('pedidos', 'crear') && (
            <button onClick={() => setModalOpen(true)} className="btn-primary" type="button">
              <Plus size={16} /> Nuevo pedido
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        {filterClient && (
          <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2">
            <span className="text-xs text-primary-700 font-medium flex-1">
              Filtrando por: <strong>{prefilledName || clients.find(c => c.id === filterClient)?.name}</strong>
            </span>
            <button onClick={clearClientFilter} className="text-primary-400 hover:text-primary-700 transition-colors" type="button">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar por número o cliente..."
            value={search} onChange={e => { setSearch(e.target.value); if (filterClient) setFilterClient(''); }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map(s => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                filterStatus === s.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
             type="button">
              {s.label}
            </button>
          ))}
        </div>
        {users.length > 0 && (
          <select
            className="input-field !text-xs !py-1.5"
            value={filterSeller}
            onChange={e => setFilterSeller(e.target.value)}
          >
            <option value="">Todos los vendedores</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No hay pedidos"
          description="Registra el primer pedido del día"
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary" type="button">
              <Plus size={14} /> Nuevo pedido
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(order => (
            <SwipeableOrderCard
              key={order.id}
              order={order}
              client={clients.find(c => c.id === order.clientId)}
              seller={users.find(u => u.id === order.sellerId)}
              canEdit={can('pedidos', 'editar')}
              canChangeStatus={can('pedidos', 'cambiar_estado')}
              advancing={advancingId === order.id}
              onAdvance={() => handleAdvanceStatus(order)}
              onEdit={() => setEditingOrder(order)}
            />
          ))}
        </div>
      )}

      <Pagination total={filtered.length} page={page} perPage={PER_PAGE} onChange={setPage} />

      <Modal isOpen={!!editingOrder} onClose={() => setEditingOrder(null)} title="Editar pedido" size="lg">
        {editingOrder && (
          <OrderForm
            initial={editingOrder}
            onSave={async data => {
              await updateOrder(editingOrder.id, data);
              setEditingOrder(null);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo pedido" size="lg">
        <OrderFormWithWa
          onCreated={order => { setModalOpen(false); setWaOrder(order); }}
        />
      </Modal>

      {/* Modal WhatsApp confirmación de pedido */}
      {waOrder && (() => {
        const client  = clients.find(c => c.id === waOrder.clientId);
        const { getClientDebt } = useAppStore.getState();
        const previousDebt = client ? Math.max(0, getClientDebt(client.id) - Math.max(0, waOrder.totalAmount - waOrder.amountPaid)) : 0;
        const message = client ? buildOrderConfirmationMessage(client, waOrder, previousDebt) : '';
        return (
          <Modal isOpen={!!waOrder} onClose={() => setWaOrder(null)} title="Pedido creado">
            <div className="space-y-4">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                  <MessageCircle size={12} /> Mensaje de confirmación para {client?.name}
                </p>
                <p className="text-xs text-gray-700 whitespace-pre-line">{message}</p>
              </div>
              {!client?.phone && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                  ⚠️ El cliente no tiene número de celular registrado.
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setWaOrder(null)} className="btn-ghost flex-1 justify-center" type="button">
                  Cerrar
                </button>
                {client?.phone && (
                  <button
                    onClick={() => { openWhatsApp(client.phone, message); setWaOrder(null); }}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                   type="button">
                    <MessageCircle size={14} /> Enviar por WhatsApp
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
