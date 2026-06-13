import { useState } from 'react';
import { Truck, CheckCircle2, Clock, Package, Search } from 'lucide-react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import {
  formatCurrency,
  formatDate,
  orderStatusLabel,
  orderStatusColor,
} from '../utils/formatters';
import type { OrderStatus } from '../types';

export function DeliveriesPage() {
  const { orders, clients, users, updateOrder } = useAppStore();
  const [filter, setFilter]   = useState<'all' | 'pending' | 'delivered'>('pending');
  const [search, setSearch]   = useState('');

  const deliveryOrders = orders.filter(o => {
    const matchStatus =
      filter === 'all'      ? true :
      filter === 'pending'  ? ['por_recoger','recogido','entregado'].includes(o.status) :
      /* delivered */         ['pagado'].includes(o.status);
    const client = clients.find(c => c.id === o.clientId);
    const matchSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (client?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }).sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const pendingCount   = orders.filter(o => ['por_recoger','recogido'].includes(o.status)).length;
  const deliveredCount = orders.filter(o => o.status === 'entregado' || o.status === 'pagado').length;

  const assignableUsers = users.filter(u => ['admin','alexis','jennifer'].includes(u.role));

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Entregas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de reparto y entrega de pedidos</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Por entregar"  value={pendingCount}   icon={Clock}        color="yellow" />
        <StatCard title="Entregados"    value={deliveredCount} icon={CheckCircle2} color="green" />
        <StatCard title="Total pedidos" value={orders.length}  icon={Package}      color="purple" />
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar pedido o cliente..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[
            { v: 'pending',   l: 'Pendientes' },
            { v: 'delivered', l: 'Entregados' },
            { v: 'all',       l: 'Todos'      },
          ].map(tab => (
            <button key={tab.v}
              onClick={() => setFilter(tab.v as typeof filter)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === tab.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {tab.l}
            </button>
          ))}
        </div>
      </div>

      {deliveryOrders.length === 0 ? (
        <EmptyState icon={Truck} title="No hay entregas pendientes" description="Todos los pedidos están al día" />
      ) : (
        <div className="space-y-2">
          {deliveryOrders.map(order => {
            const client   = clients.find(c => c.id === order.clientId);
            return (
              <div key={order.id}
                className={`card !p-4 ${statusBg[order.status] ?? ''} hover:shadow-md transition-shadow`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Truck size={14} className="text-primary-600" />
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      Pedido: {formatDate(order.orderDate)}
                      {order.estimatedDeliveryDate && ` · Entrega est.: ${formatDate(order.estimatedDeliveryDate)}`}
                    </p>
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

                {/* Controls */}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
