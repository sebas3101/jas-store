import { useState } from 'react';
import { Truck, CheckCircle2, Package, Search, ShoppingBag, Clock, MapPin, Store, ChevronDown, Check, X, ZoomIn, MessageCircle, FileText, AlertCircle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { OrderStatusButton, NEXT_STATUS } from '../components/ui/OrderStatusButton';
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
} from '../utils/formatters';
import type { Order, OrderStatus } from '../types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'por_recoger', label: 'Por recoger' },
  { value: 'recogido',    label: 'Recogido'    },
  { value: 'entregado',   label: 'Entregado'   },
  { value: 'pagado',      label: 'Pagado'      },
  { value: 'cancelado',   label: 'Cancelado'   },
];

const statusBg: Partial<Record<OrderStatus, string>> = {
  por_recoger: 'bg-amber-50/60',
  recogido:    'bg-blue-50/60',
  entregado:   'bg-emerald-50/60',
  pagado:      'bg-emerald-50/60',
  cancelado:   'bg-gray-50',
};

type Tab = 'recogidas' | 'entregas' | 'historial';

function openMaps(address: string) {
  const encoded = encodeURIComponent(address);
  window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
}

export function DeliveriesPage() {
  const { orders, clients, users, suppliers, purchases, updateOrder, updatePurchase } = useAppStore();
  const { can } = usePermissions();
  const [tab, setTab]       = useState<Tab>('recogidas');
  const [search, setSearch] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Recogidas: pedidos pendientes de ir a buscar (por_recoger)
  const recogidas = orders.filter(o => o.status === 'por_recoger');

  // Recogidas agrupadas por PROVEEDOR: compras pendientes o sin stock
  const pendingBySupplier = (() => {
    const map = new Map<string, { supplier?: typeof suppliers[number]; purchases: typeof purchases }>();
    for (const p of purchases) {
      if ((p.status !== 'pendiente' && p.status !== 'no_disponible') || !p.orderId) continue;
      const g = map.get(p.supplierId) ?? { supplier: suppliers.find(s => s.id === p.supplierId), purchases: [] };
      g.purchases.push(p);
      map.set(p.supplierId, g);
    }
    const q = search.toLowerCase();
    return [...map.values()]
      .filter(g => !q
        || (g.supplier?.name ?? '').toLowerCase().includes(q)
        || g.purchases.some(p => {
          if (p.description.toLowerCase().includes(q)) return true;
          const order = orders.find(o => o.id === p.orderId);
          const client = clients.find(c => c.id === order?.clientId);
          return (client?.name ?? '').toLowerCase().includes(q);
        }))
      .sort((a, b) => (a.supplier?.name ?? '').localeCompare(b.supplier?.name ?? ''));
  })();
  // Entregas pendientes: solo recogido (en camino). Entregados/pagados van al historial.
  const entregas        = orders.filter(o => o.status === 'recogido');
  const historialEntregas = orders.filter(o => ['entregado', 'pagado'].includes(o.status));

  const sourceList = tab === 'recogidas' ? recogidas : tab === 'entregas' ? entregas : historialEntregas;
  const activeOrders = sourceList.filter(o => {
    const client   = clients.find(c => c.id === o.clientId);
    const supplier = suppliers.find(s => s.id === o.supplierId);
    return (
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (supplier?.name ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const assignableUsers = users.filter(u => u.active);

  // Per-item sin_stock: Record<purchaseId, Set<itemIndex>>
  const [sinStockItems, setSinStockItems] = useState<Record<string, Set<number>>>({});

  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);

  const handleAssign = (orderId: string, userId: string) => {
    updateOrder(orderId, { deliveryPersonId: userId });
  };

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    const updates: Parameters<typeof updateOrder>[1] = { status };
    if (status === 'entregado' || status === 'pagado') {
      updates.deliveredAt = new Date().toISOString();
    }
    updateOrder(orderId, updates);
  };

  const handleAdvanceStatus = (order: Order) => {
    if (advancingId) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setConfirmingOrder(order);
  };

  const confirmAdvance = async () => {
    if (!confirmingOrder) return;
    const next = NEXT_STATUS[confirmingOrder.status];
    if (!next) { setConfirmingOrder(null); return; }
    setAdvancingId(confirmingOrder.id);
    setConfirmingOrder(null);
    const updates: Parameters<typeof updateOrder>[1] = { status: next.status };
    if (next.status === 'entregado' || next.status === 'pagado') {
      updates.deliveredAt = new Date().toISOString();
    }
    await updateOrder(confirmingOrder.id, updates);
    setAdvancingId(null);
  };

  // Marca una compra como recogida. El store avanza el pedido a "recogido"
  // cuando todas sus compras quedan recogidas o canceladas.
  const handleCheckPickup = async (purchaseId: string) => {
    if (checkingId) return;
    setCheckingId(purchaseId);
    await updatePurchase(purchaseId, { status: 'pagado' });
    setCheckingId(null);
  };

  // Alterna sin_stock para un ítem específico.
  // Cuando TODOS los ítems de la compra están sin stock → marca la compra como no_disponible.
  const handleToggleItemSinStock = async (purchaseId: string, itemIdx: number, totalItems: number) => {
    if (checkingId) return;
    const current = sinStockItems[purchaseId] ?? new Set<number>();
    const isAlready = current.has(itemIdx);
    const next = new Set(current);
    isAlready ? next.delete(itemIdx) : next.add(itemIdx);
    setSinStockItems(prev => ({ ...prev, [purchaseId]: next }));
    if (next.size === totalItems) {
      setCheckingId(purchaseId);
      await updatePurchase(purchaseId, { status: 'no_disponible' });
      setCheckingId(null);
    }
  };

  // Revierte una compra de sin_stock a pendiente cuando el producto llega.
  const handleMarkAvailable = async (purchaseId: string) => {
    if (checkingId) return;
    setCheckingId(purchaseId);
    await updatePurchase(purchaseId, { status: 'pendiente' });
    setSinStockItems(prev => { const n = { ...prev }; delete n[purchaseId]; return n; });
    setCheckingId(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Entregas y Recogidas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de reparto y estado de pedidos</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Por recoger" value={recogidas.length}         icon={ShoppingBag} color="yellow" />
        <StatCard title="En camino"   value={entregas.length}           icon={Truck}       color="blue"   />
        <StatCard title="Entregados"  value={historialEntregas.length}  icon={CheckCircle2} color="green" />
      </div>

      {/* Tabs */}
      <div className="card !p-4 space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setTab('recogidas')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${tab === 'recogidas' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">
            <ShoppingBag size={13} /> Recogidas
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === 'recogidas' ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>{recogidas.length}</span>
          </button>
          <button onClick={() => setTab('entregas')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${tab === 'entregas' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">
            <Truck size={13} /> En camino
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === 'entregas' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{entregas.length}</span>
          </button>
          <button onClick={() => setTab('historial')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${tab === 'historial' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} type="button">
            <CheckCircle2 size={13} /> Historial
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === 'historial' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{historialEntregas.length}</span>
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder={tab === 'recogidas' ? 'Buscar pedido o proveedor...' : 'Buscar pedido o cliente...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Context banner */}
      <div className={`rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
        tab === 'recogidas' ? 'bg-amber-50 text-amber-700' :
        tab === 'entregas'  ? 'bg-primary-50 text-primary-700' :
                              'bg-emerald-50 text-emerald-700'
      }`}>
        {tab === 'recogidas' ? <><Store size={13} /> Pedidos que hay que ir a buscar al proveedor — foco en pago y mercancía</> :
         tab === 'entregas'  ? <><Truck size={13} /> Pedidos recogidos en camino al cliente — pendientes de entrega</> :
                               <><CheckCircle2 size={13} /> Historial de pedidos ya entregados</>}
      </div>

      {tab === 'recogidas' ? (
        pendingBySupplier.length === 0 ? (
          <EmptyState icon={Package} title="Sin recogidas pendientes" description="No hay compras por recoger" />
        ) : (
          <div className="space-y-3">
            {pendingBySupplier.map(({ supplier, purchases: purs }) => {
              const sid = supplier?.id ?? 'sin';
              const expanded = expandedSupplier === sid;
              return (
                <div key={sid} className="card !p-0 overflow-hidden">
                  <button type="button" onClick={() => setExpandedSupplier(expanded ? null : sid)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Store size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{supplier?.name ?? 'Proveedor'}</p>
                      <p className="text-[11px] text-gray-500">{purs.length} pedido{purs.length !== 1 ? 's' : ''} por recoger</p>
                      {supplier?.address && <p className="text-[11px] text-gray-400">📍 {supplier.address}</p>}
                      {supplier?.phone   && <p className="text-[11px] text-gray-400">📞 {supplier.phone}</p>}
                    </div>
                    <ChevronDown size={18} className={`text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {purs.map(pur => {
                        const order    = orders.find(o => o.id === pur.orderId);
                        const client   = clients.find(c => c.id === order?.clientId);
                        const filtered = order?.items.filter(it => it.supplierId === supplier?.id) ?? [];
                        // Fallback para pedidos sin supplierId por ítem (pedidos viejos)
                        const supItems = filtered.length > 0 ? filtered : (order?.items ?? []);
                        const paid     = pur.paidAmount ?? 0;
                        const saldo    = Math.max(0, pur.cost - paid);
                        const totalItems = supItems.reduce((s, it) => s + it.quantity, 0);
                        const itemSinStock = sinStockItems[pur.id] ?? new Set<number>();
                        const allSinStock  = pur.status === 'no_disponible';
                        return (
                          <div key={pur.id} className="bg-amber-50 rounded-xl overflow-hidden border border-amber-100">

                            {/* ── Cabecera: pedido + cliente + botón ── */}
                            <div className="flex items-start justify-between gap-2 p-3 pb-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-gray-900">{order?.orderNumber ?? 'Pedido'}</span>
                                  {totalItems > 0 && (
                                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                      {totalItems} {totalItems === 1 ? 'prenda' : 'prendas'}
                                    </span>
                                  )}
                                  {allSinStock && (
                                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">
                                      <AlertCircle size={9} /> Sin stock
                                    </span>
                                  )}
                                </div>
                                {client && (
                                  <p className="text-xs font-semibold text-gray-700 mt-0.5">{client.name}</p>
                                )}
                                {client?.phone && (
                                  <a href={`https://wa.me/57${client.phone.replace(/\D/g,'')}`}
                                    target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-emerald-700 mt-0.5">
                                    <MessageCircle size={10} /> {client.phone}
                                  </a>
                                )}
                              </div>
                              {can('entregas', 'cambiar_estado') && (
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  {allSinStock ? (
                                    <button type="button" disabled={checkingId === pur.id}
                                      onClick={() => handleMarkAvailable(pur.id)}
                                      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-60">
                                      <RotateCcw size={11} /> Todo llegó
                                    </button>
                                  ) : (
                                    <button type="button" disabled={checkingId === pur.id}
                                      onClick={() => handleCheckPickup(pur.id)}
                                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60">
                                      <Check size={13} /> Recogido
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ── Ítems ── */}
                            <div className="px-3 pb-2 space-y-2">
                              {supItems.map((it, idx) => {
                                const isSinStock = allSinStock || itemSinStock.has(idx);
                                return (
                                <div key={idx} className={`flex gap-3 rounded-lg transition-colors ${isSinStock ? 'opacity-60' : ''}`}>
                                  {/* Foto portrait */}
                                  {it.imageUrl ? (
                                    <button type="button" onClick={() => setPhotoModal(it.imageUrl!)}
                                      className="relative flex-shrink-0 group">
                                      <img src={it.imageUrl} alt=""
                                        className={`w-16 h-20 rounded-xl object-cover border shadow-sm ${isSinStock ? 'border-red-200 grayscale' : 'border-amber-200'}`} />
                                      <span className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-xl opacity-0 group-active:opacity-100 transition-opacity">
                                        <ZoomIn size={18} className="text-white drop-shadow" />
                                      </span>
                                    </button>
                                  ) : (
                                    <div className={`w-16 h-20 rounded-xl border flex items-center justify-center flex-shrink-0 ${isSinStock ? 'bg-red-50 border-red-200' : 'bg-amber-100 border-amber-200'}`}>
                                      <Package size={20} className={isSinStock ? 'text-red-300' : 'text-amber-400'} />
                                    </div>
                                  )}

                                  {/* Info del ítem */}
                                  <div className="flex-1 min-w-0 pt-0.5 space-y-0.5">
                                    <p className={`text-xs font-bold leading-snug ${isSinStock ? 'text-red-500 line-through' : 'text-gray-900'}`}>{it.productName}</p>
                                    <div className="flex flex-wrap gap-1">
                                      {it.size  && (
                                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                          T. {it.size}
                                        </span>
                                      )}
                                      {it.color && (
                                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                                          {it.color}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                        ×{it.quantity}
                                      </span>
                                    </div>
                                    {it.costPrice > 0 && (
                                      <p className="text-[11px] text-gray-500">
                                        Costo: <span className="font-semibold text-gray-700">{formatCurrency(it.costPrice * it.quantity)}</span>
                                      </p>
                                    )}
                                    {/* Botón sin stock por ítem */}
                                    {can('entregas', 'cambiar_estado') && !allSinStock && (
                                      <button type="button"
                                        disabled={checkingId === pur.id}
                                        onClick={() => handleToggleItemSinStock(pur.id, idx, supItems.length)}
                                        className={`mt-1 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                                          isSinStock
                                            ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                            : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100 hover:text-red-700'
                                        }`}>
                                        <X size={10} /> {isSinStock ? 'Sin stock ✓' : 'Sin stock'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                            </div>

                            {/* ── Nota del pedido ── */}
                            {order?.notes && (
                              <div className="mx-3 mb-2 flex items-start gap-1.5 bg-white/60 rounded-lg px-2.5 py-1.5">
                                <FileText size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-600 italic">{order.notes}</p>
                              </div>
                            )}

                            {/* ── Pago al proveedor ── */}
                            <div className="mx-3 mb-3 flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 border border-amber-100">
                              <div className="space-y-0.5">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total compra</p>
                                <p className="text-sm font-bold text-gray-900">{formatCurrency(pur.cost)}</p>
                              </div>
                              {paid > 0 && (
                                <div className="space-y-0.5 text-right">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Abonado</p>
                                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(paid)}</p>
                                </div>
                              )}
                              <div className="space-y-0.5 text-right">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                                  {saldo > 0 ? 'Por pagar' : 'Pagado ✓'}
                                </p>
                                <p className={`text-sm font-bold ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {saldo > 0 ? formatCurrency(saldo) : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : activeOrders.length === 0 ? (
        <EmptyState
          icon={tab === 'entregas' ? Truck : CheckCircle2}
          title={tab === 'entregas' ? 'Sin entregas en camino' : 'Sin historial aún'}
          description={tab === 'entregas' ? 'Ningún pedido en camino al cliente' : 'Los pedidos entregados aparecerán aquí'}
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(order => {
            const client         = clients.find(c => c.id === order.clientId);
            const deliveryPerson = users.find(u => u.id === order.deliveryPersonId);
            const hasAddress     = !!client?.address;
            const pendingStock   = purchases.filter(p => p.orderId === order.id && p.status === 'no_disponible');

            return (
              <div key={order.id}
                className={`card !p-4 ${statusBg[order.status] ?? ''} hover:shadow-md transition-shadow`}>

                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-50">
                    <Truck size={14} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderStatusColor[order.status]}`}>
                        {orderStatusLabel[order.status]}
                      </span>
                      {pendingStock.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          <AlertCircle size={9} /> {pendingStock.length} sin stock
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={9} /> {formatDate(order.orderDate)}
                      {order.estimatedDeliveryDate && ` · est. ${formatDate(order.estimatedDeliveryDate)}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                    <p className={`text-xs font-semibold ${(order.totalAmount - order.amountPaid) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {(order.totalAmount - order.amountPaid) > 0
                        ? `Debe ${formatCurrency(order.totalAmount - order.amountPaid)}`
                        : 'Pagado ✓'}
                    </p>
                  </div>
                </div>

                {/* ─── ENTREGAS: foco en cliente, prendas y dirección ─── */}
                {tab === 'entregas' && (
                  <div className="space-y-2">
                    {/* Cliente */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold text-gray-800">{client?.name ?? 'Cliente'}</p>
                        {client?.phone && (
                          <p className="text-xs text-gray-500">📞 {client.phone}</p>
                        )}
                        {hasAddress
                          ? <p className="text-xs text-gray-500">📍 {client!.address}</p>
                          : <p className="text-xs text-amber-600 italic">Sin dirección registrada</p>
                        }
                      </div>
                      {/* Google Maps */}
                      <button
                        onClick={() => {
                          if (hasAddress) {
                            openMaps(client!.address!);
                          } else {
                            alert('Este cliente no tiene dirección registrada.');
                          }
                        }}
                        className={`flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors ${
                          hasAddress
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                       type="button">
                        <MapPin size={11} /> Ver en Maps
                      </button>
                    </div>

                    {/* Prendas a entregar */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Prendas a entregar</p>
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <Package size={10} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-medium text-gray-800">{it.productName}</span>
                            {it.size  && <span className="text-gray-500 ml-1">Talla {it.size}</span>}
                            {it.color && <span className="text-gray-500 ml-1">· {it.color}</span>}
                          </div>
                          <span className="text-xs font-semibold text-gray-700 flex-shrink-0">×{it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {deliveryPerson && (
                      <p className="text-xs text-primary-600">🏍️ {deliveryPerson.name}</p>
                    )}
                  </div>
                )}

                {order.notes && (
                  <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                    📝 {order.notes}
                  </p>
                )}

                {/* Controles */}
                {can('entregas', 'cambiar_estado') && tab !== 'historial' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {/* Botón de avance rápido — mismo sistema que en Pedidos */}
                    <OrderStatusButton
                      order={order}
                      onAdvance={handleAdvanceStatus}
                      advancing={advancingId === order.id}
                      variant="full"
                    />
                    {/* Controles secundarios */}
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 mb-1">Repartidor</p>
                        <select
                          value={order.deliveryPersonId ?? ''}
                          onChange={e => handleAssign(order.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 w-full max-w-[180px]"
                        >
                          <option value="">Sin asignar</option>
                          {assignableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Estado manual</p>
                        <select
                          value={order.status}
                          onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox foto de producto */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPhotoModal(null)}>
          <button type="button" onClick={() => setPhotoModal(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center">
            <X size={20} className="text-white" />
          </button>
          <img
            src={photoModal}
            alt="Foto producto"
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirmación de avance de estado */}
      {confirmingOrder && (() => {
        const next   = NEXT_STATUS[confirmingOrder.status];
        const client = clients.find(c => c.id === confirmingOrder.clientId);
        return (
          <ConfirmDialog
            isOpen={true}
            onClose={() => setConfirmingOrder(null)}
            onConfirm={confirmAdvance}
            title="Confirmar cambio de estado"
            message={`¿Marcar el pedido ${confirmingOrder.orderNumber}${client ? ` de ${client.name}` : ''} como "${next?.label}"?`}
            confirmLabel={next?.label ?? 'Confirmar'}
          />
        );
      })()}
    </div>
  );
}
