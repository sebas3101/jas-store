import { useState } from 'react';
import { Truck, CheckCircle2, Package, Search, ShoppingBag, Clock, MapPin, Store } from 'lucide-react';
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
  const { orders, clients, users, suppliers, updateOrder } = useAppStore();
  const { can } = usePermissions();
  const [tab, setTab]       = useState<Tab>('recogidas');
  const [search, setSearch] = useState('');

  // Recogidas: pedidos pendientes de ir a buscar (por_recoger)
  const recogidas = orders.filter(o => o.status === 'por_recoger');
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

      {activeOrders.length === 0 ? (
        <EmptyState
          icon={tab === 'recogidas' ? Package : tab === 'entregas' ? Truck : CheckCircle2}
          title={tab === 'recogidas' ? 'Sin recogidas pendientes' : tab === 'entregas' ? 'Sin entregas en camino' : 'Sin historial aún'}
          description={tab === 'recogidas' ? 'No hay pedidos por recoger' : tab === 'entregas' ? 'Ningún pedido en camino al cliente' : 'Los pedidos entregados aparecerán aquí'}
        />
      ) : (
        <div className="space-y-3">
          {activeOrders.map(order => {
            const client         = clients.find(c => c.id === order.clientId);
            const supplier       = suppliers.find(s => s.id === order.supplierId);
            const deliveryPerson = users.find(u => u.id === order.deliveryPersonId);
            const hasAddress     = !!client?.address;

            return (
              <div key={order.id}
                className={`card !p-4 ${statusBg[order.status] ?? ''} hover:shadow-md transition-shadow`}>

                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tab === 'recogidas' ? 'bg-amber-50' : 'bg-primary-50'
                  }`}>
                    {tab === 'recogidas'
                      ? <Store size={14} className="text-amber-600" />
                      : <Truck size={14} className="text-primary-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderStatusColor[order.status]}`}>
                        {orderStatusLabel[order.status]}
                      </span>
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

                {/* ─── RECOGIDAS: foco en proveedor y mercancía ─── */}
                {tab === 'recogidas' && (
                  <div className="space-y-2">
                    {/* Proveedor */}
                    {supplier ? (
                      <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          <Store size={11} /> {supplier.name}
                        </p>
                        {supplier.address && (
                          <p className="text-[11px] text-amber-700">📍 {supplier.address}</p>
                        )}
                        {supplier.phone && (
                          <p className="text-[11px] text-amber-700">📞 {supplier.phone}</p>
                        )}
                        {/* Pago al proveedor */}
                        {order.supplierPaymentAmount != null && order.supplierPaymentAmount > 0 && (
                          <div className="border-t border-amber-200 pt-2 mt-2 space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-amber-700 font-medium">Pago proveedor:</span>
                              <span className="font-bold text-amber-900">{formatCurrency(order.supplierPaymentAmount)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-amber-700">Estado:</span>
                              <span className={`font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${
                                order.supplierPaymentStatus === 'pagado'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {order.supplierPaymentStatus === 'pagado' ? 'Pagado ✓' : '⚠️ Pendiente'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-amber-700">Método:</span>
                              <span className="font-medium text-amber-900">
                                {order.supplierPaymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sin proveedor asignado</p>
                    )}

                    {/* Mercancía a recoger */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Prendas a recoger</p>
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <Package size={10} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-medium text-gray-800">{it.productName}</span>
                            {it.size  && <span className="text-gray-500 ml-1">Talla {it.size}</span>}
                            {it.color && <span className="text-gray-500 ml-1">· {it.color}</span>}
                          </div>
                          <span className="text-xs font-semibold text-gray-700 flex-shrink-0">
                            ×{it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Cliente (referencia) */}
                    <p className="text-[11px] text-gray-500">
                      Para: <span className="font-medium text-gray-700">{client?.name ?? '—'}</span>
                    </p>
                  </div>
                )}

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
