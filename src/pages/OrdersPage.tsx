import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, ShoppingBag, ArrowRight, X, MessageCircle, Download, Pen, ChevronRight, ImagePlus } from 'lucide-react';
import { useSwipeCard } from '../hooks/useSwipeCard';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { OrderStatusButton, NEXT_STATUS } from '../components/ui/OrderStatusButton';
import { exportPedidos } from '../utils/exportExcel';
import { buildOrderConfirmationMessage, sendClientMessage, openWhatsApp } from '../utils/whatsapp';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { SearchSelect } from '../components/ui/SearchSelect';
import { uploadImage } from '../utils/storage';

/** Abono al proveedor capturado al crear el pedido (por proveedor). */
export type SupplierPaymentInput = { supplierId: string; paidAmount: number; paymentMethod: 'efectivo' | 'transferencia' };

const PER_PAGE = 20;
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
  paymentMethodLabel,
} from '../utils/formatters';
import type { Order, OrderStatus, PaymentMethod, OrderItem } from '../types';

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
  onSave:   (o: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>, supplierPayments?: SupplierPaymentInput[], isHistorical?: boolean) => void;
  initial?: Order;
}) {
  const { clients, products, users, suppliers, currentUser, getClientDebt } = useAppStore();
  const [clientId, setClientId]   = useState(initial?.clientId ?? '');
  const [items, setItems]         = useState<Omit<OrderItem, 'id'>[]>(
    initial?.items.map(({ id: _id, ...rest }) => rest) ?? [{
      productId: '', productName: '', category: 'otro', quantity: 1, salePrice: 0, costPrice: 0,
    }]
  );
  const [status]                       = useState<OrderStatus>(initial?.status ?? 'tomado');
  const [payMethod, setPayMethod]     = useState<PaymentMethod>(initial?.paymentMethod ?? 'credito');
  const [sellerId, setSellerId]       = useState(initial?.sellerId ?? currentUser?.id ?? '');
  const [deliveryId, setDeliveryId]   = useState(initial?.deliveryPersonId ?? '');
  const [orderDate, setOrderDate]     = useState(
    initial?.orderDate ? initial.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [estDelivery, setEstDelivery] = useState(initial?.estimatedDeliveryDate?.slice(0, 10) ?? '');
  const [amountPaid, setAmountPaid]   = useState(initial?.amountPaid ?? 0);
  const [notes, setNotes]             = useState(initial?.notes ?? '');
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [formError, setFormError]       = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  // Abono al proveedor (por proveedor) — solo al crear
  const [supPays, setSupPays] = useState<Record<string, { paid: number; method: 'efectivo' | 'transferencia' }>>({});

  const pickImage = async (i: number, file?: File) => {
    if (!file) return;
    setUploadingIdx(i);
    const url = await uploadImage(file, 'pedidos');
    setUploadingIdx(null);
    if (url) setItem(i, 'imageUrl', url);
  };

  const addItem = () => setItems(prev => [...prev, {
    productId: '', productName: '', category: 'otro', quantity: 1, salePrice: 0, costPrice: 0,
    supplierId: prev[prev.length - 1]?.supplierId,
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

  // Proveedores distintos presentes en los ítems (para abono al proveedor)
  const supplierGroups = (() => {
    const map = new Map<string, { name: string; cost: number }>();
    for (const it of items) {
      if (!it.supplierId) continue;
      const sup = suppliers.find(s => s.id === it.supplierId);
      const g = map.get(it.supplierId) ?? { name: sup?.name ?? 'Proveedor', cost: 0 };
      g.cost += (it.costPrice ?? 0) * it.quantity;
      map.set(it.supplierId, g);
    }
    return [...map.entries()].map(([supplierId, g]) => ({ supplierId, ...g }));
  })();

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
    if (items.some(it => !it.productName.trim())) {
      setFormError('Todos los productos deben tener nombre.');
      return;
    }
    setFormError('');
    const supplierPayments: SupplierPaymentInput[] = supplierGroups.map(g => ({
      supplierId:    g.supplierId,
      paidAmount:    supPays[g.supplierId]?.paid ?? 0,
      paymentMethod: supPays[g.supplierId]?.method ?? 'efectivo',
    }));
    const finalStatus = !initial && isHistorical ? 'pendiente_pago' : status;
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
      status: finalStatus,
      paymentMethod: payMethod,
      sellerId,
      deliveryPersonId:      deliveryId     || undefined,
      orderDate: new Date(orderDate).toISOString(),
      estimatedDeliveryDate: estDelivery ? new Date(estDelivery).toISOString() : undefined,
      notes,
    }, supplierPayments, !initial && isHistorical);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Cliente *</label>
          <SearchSelect
            required
            placeholder="Buscar cliente..."
            value={clientId}
            onChange={setClientId}
            options={clients.map(c => ({ value: c.id, label: c.name, sublabel: c.phone }))}
          />
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
                  <div className="col-span-2">
                    <select className="input-field text-xs" value={item.supplierId ?? ''}
                      onChange={e => setItem(i, 'supplierId', e.target.value || undefined)}>
                      <option value="">Proveedor (para recogida)...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    {item.imageUrl ? (
                      <div className="relative">
                        <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                        <button type="button" onClick={() => setItem(i, 'imageUrl', undefined)}
                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full text-red-500 shadow border border-gray-200">
                          <X size={13} />
                        </button>
                      </div>
                    ) : null}
                    <label className="text-xs text-primary-600 font-medium flex items-center gap-1 cursor-pointer">
                      <ImagePlus size={13} />
                      {uploadingIdx === i ? 'Subiendo...' : item.imageUrl ? 'Cambiar foto' : 'Agregar foto'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => pickImage(i, e.target.files?.[0])} />
                    </label>
                  </div>
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

        {/* Abono a proveedores (uno por proveedor presente en los ítems) */}
        {supplierGroups.length > 0 && (
          <div className="col-span-2 border-t border-gray-100 pt-3">
            <label className="label font-semibold text-gray-700">Abono a proveedores</label>
            <div className="space-y-2">
              {supplierGroups.map(g => {
                const paid = supPays[g.supplierId]?.paid ?? 0;
                const saldo = Math.max(0, g.cost - paid);
                return (
                  <div key={g.supplierId} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800">{g.name}</span>
                      <span className="text-gray-500">Costo: {formatCurrency(g.cost)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <CurrencyInput className="text-xs" placeholder="Abono" value={paid} min={0}
                        onChange={v => setSupPays(p => ({ ...p, [g.supplierId]: { paid: v, method: p[g.supplierId]?.method ?? 'efectivo' } }))} />
                      <select className="input-field text-xs"
                        value={supPays[g.supplierId]?.method ?? 'efectivo'}
                        onChange={e => setSupPays(p => ({ ...p, [g.supplierId]: { paid: p[g.supplierId]?.paid ?? 0, method: e.target.value as 'efectivo' | 'transferencia' } }))}>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-right text-gray-500">Saldo al proveedor: <span className="font-semibold text-gray-700">{formatCurrency(saldo)}</span></p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        <div className="col-span-2">
          <label className="label">Notas</label>
          <textarea className="input-field resize-none" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      {/* Toggle pedido histórico — solo al crear */}
      {!initial && (
        <label className={`flex items-start gap-3 cursor-pointer rounded-xl px-3 py-3 border transition-colors ${isHistorical ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <input
            type="checkbox"
            checked={isHistorical}
            onChange={e => setIsHistorical(e.target.checked)}
            className="mt-0.5 accent-amber-500 w-4 h-4 flex-shrink-0"
          />
          <div>
            <p className={`text-sm font-semibold ${isHistorical ? 'text-amber-800' : 'text-gray-700'}`}>
              Pedido histórico (ya entregado)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              El pedido no pasará por el flujo de entregas. Quedará directamente en «Pendiente de pago» listo para recibir abonos.
            </p>
          </div>
        </label>
      )}

      {formError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {formError}
        </p>
      )}
      <button type="submit" disabled={uploadingIdx !== null} className="btn-primary w-full justify-center disabled:opacity-60">
        {uploadingIdx !== null ? 'Subiendo foto...' : initial ? 'Actualizar pedido' : 'Guardar pedido'}
      </button>
    </form>
  );
}

// Wrapper that captures the created order for the WhatsApp modal
function OrderFormWithWa({ onCreated }: { onCreated: (o: Order) => void }) {
  const { addOrder, orders } = useAppStore();
  return (
    <OrderForm onSave={async (data, supplierPayments, isHistorical) => {
      const prevCount = orders.length;
      await addOrder(data, supplierPayments, isHistorical);
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
    onSwipeLeft: client?.phone ? () => {
      const { getClientDebt, clients: allClients } = useAppStore.getState();
      const fullClient = allClients.find(c => c.id === client.id);
      const countedInDebt = order.status === 'entregado' || order.status === 'pendiente_pago';
      const previousDebt = fullClient
        ? Math.max(0, getClientDebt(fullClient.id) - (countedInDebt ? Math.max(0, order.totalAmount - order.amountPaid) : 0))
        : 0;
      const message = fullClient ? buildOrderConfirmationMessage(fullClient, order, previousDebt) : '';
      if (fullClient) sendClientMessage(fullClient, message);
      else openWhatsApp(client.phone!, message);
    } : undefined,
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

  const { orders, clients, users, updateOrder, refreshData } = useAppStore();
  const { can } = usePermissions();
  const handleRefresh = useCallback(() => refreshData(), [refreshData]);

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
    <PullToRefresh onRefresh={handleRefresh}>
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
        const waCountedInDebt = waOrder.status === 'entregado' || waOrder.status === 'pendiente_pago';
        const previousDebt = client ? Math.max(0, getClientDebt(client.id) - (waCountedInDebt ? Math.max(0, waOrder.totalAmount - waOrder.amountPaid) : 0)) : 0;
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
                    onClick={() => { sendClientMessage(client, message); setWaOrder(null); }}
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
    </PullToRefresh>
  );
}
