import { useState } from 'react';
import { Truck, CheckCircle2, Package, Search, ShoppingBag, Clock } from 'lucide-react';
import { useAppStore } from '../store';
import { usePermissions } from '../hooks/usePermissions';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
} from '../utils/formatters';
import type { OrderStatus } from '../types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'por_recoger', label: 'Por recoger' },
  { value: 'recogido',    label: 'Recogido'    },
  { value: 'entregado',   label: 'Entregado'   },
  { value: 'pagado',      label: 'Pagado'      },
  { value: 'cancelado',   label: 'Cancelado'   },
];

const statusBg: Partial<Record<OrderStatus, string>> = {
  por_recoger: 'border-l-4 border-amber-400',
  recogido:    'border-l-4 border-blue-400',
  entregado:   'border-l-4 border-emerald-400',
  pagado:      'border-l-4 border-emerald-500',
  cancelado:   'border-l-4 border-gray-300',
};

type Tab = 'recogidas' | 'entregas';

export function DeliveriesPage() {
  const { orders, clients, users, updateOrder } = useAppStore();
  const { can } = usePermissions();
  const [tab, setTab]       = useState<Tab>('recogidas');
  const [search, setSearch] = useState('');

  // Recogidas: pedidos pendientes de ir a buscar (por_recoger)
  const recogidas = orders.filter(o => o.status === 'por_recoger');
  // Entregas: pedidos recogidos listos para llevar al cliente, o ya entregados
  const entregas  = orders.filter(o => ['recogido', 'entregado', 'pagado'].includes(o.status));

  const activeOrders = (tab === 'recogidas' ? recogidas : entregas).filter(o => {
    const client = clients.find(c => c.id === o.clientId);
    return (
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }).sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const assignableUsers = users.filter(u => u.active);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Entregas y Recogidas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de reparto y estado de pedidos</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Por recoger"  value={recogidas.length}  icon={ShoppingBag} color="yellow" />
        <StatCard title="En camino"    value={entregas.filter(o => o.status === 'recogido').length} icon={Truck} color="blue" />
        <StatCard title="Entregados"   value={entregas.filter(o => ['entregado','pagado'].includes(o.status)).length} icon={CheckCircle2} color="green" />
      </div>

      {/* Tabs */}
      <div className="card !p-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('recogidas')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'recogidas'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingBag size={15} />
            Recogidas
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'recogidas' ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {recogidas.length}
            </span>
          </button>
          <button
            onClick={() => setTab('entregas')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'entregas'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Truck size={15} />
            Entregas
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'entregas' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {entregas.length}
            </span>
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar pedido o cliente..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Context banner */}
      <div className={`rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
        tab === 'recogidas' ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'
      }`}>
        {tab === 'recogidas'
          ? <><ShoppingBag size={13} /> Pedidos que hay que ir a buscar al proveedor o almacén</>
          : <><Truck size={13} /> Pedidos recogidos listos para entregar al cliente</>
        }
      </div>

      {activeOrders.length === 0 ? (
        <EmptyState
          icon={tab === 'recogidas' ? Package : Truck}
          title={tab === 'recogidas' ? 'Sin recogidas pendientes' : 'Sin entregas pendientes'}
          description={tab === 'recogidas' ? 'No hay pedidos por recoger' : 'Todos los pedidos han sido entregados'}
        />
      ) : (
        <div className="space-y-2">
          {activeOrders.map(order => {
            const client       = clients.find(c => c.id === order.clientId);
            const deliveryPerson = users.find(u => u.id === order.deliveryPersonId);
            return (
              <div key={order.id}
                className={`card !p-4 ${statusBg[order.status] ?? ''} hover:shadow-md transition-shadow`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    tab === 'recogidas' ? 'bg-amber-50' : 'bg-primary-50'
                  }`}>
                    {tab === 'recogidas'
                      ? <ShoppingBag size={14} className="text-amber-600" />
                      : <Truck size={14} className="text-primary-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderStatusColor[order.status]}`}>
                        {orderStatusLabel[order.status]}
                      </span>
                      {client?.isInternal && (
                        <span className="badge-blue text-[10px]">Interno</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">
                      {client?.name ?? 'Cliente'}
                    </p>
                    {client?.address && (
                      <p className="text-xs text-gray-400 mt-0.5">📍 {client.address}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> Pedido: {formatDate(order.orderDate)}
                      {order.estimatedDeliveryDate && ` · Entrega est.: ${formatDate(order.estimatedDeliveryDate)}`}
                    </p>
                    {deliveryPerson && (
                      <p className="text-xs text-primary-600 mt-0.5">🏍️ {deliveryPerson.name}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                    <p className={`text-xs font-semibold ${(order.totalAmount - order.amountPaid) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {(order.totalAmount - order.amountPaid) > 0
                        ? `Debe ${formatCurrency(order.totalAmount - order.amountPaid)}`
                        : 'Pagado ✓'}
                    </p>
                  </div>
                </div>

                {can('entregas', 'cambiar_estado') && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 mb-1">Repartidor</p>
                      <select
                        value={order.deliveryPersonId ?? ''}
                        onChange={e => handleAssign(order.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 w-full max-w-[160px]"
                      >
                        <option value="">Sin asignar</option>
                        {assignableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Estado</p>
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
                    {order.notes && (
                      <div className="w-full">
                        <p className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
