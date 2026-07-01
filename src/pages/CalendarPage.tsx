import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  format, addMonths, subMonths, isSameMonth, isToday, isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../store';
import { orderStatusColor, orderStatusLabel, parseDateOnly } from '../utils/formatters';
import type { Order } from '../types';

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

export function CalendarPage() {
  const { orders, clients } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const relevantOrders = orders.filter(o =>
    o.estimatedDeliveryDate && !['cancelado', 'pagado'].includes(o.status)
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const getOrdersForDay = (day: Date): Order[] =>
    relevantOrders.filter(o => {
      try { return isSameDay(parseDateOnly(o.estimatedDeliveryDate!), day); }
      catch { return false; }
    });

  const monthOrders = relevantOrders.filter(o => {
    try { return isSameMonth(parseDateOnly(o.estimatedDeliveryDate!), currentMonth); }
    catch { return false; }
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Calendario de entregas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {monthOrders.length} pedido{monthOrders.length !== 1 ? 's' : ''} este mes con entrega estimada
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <h2 className="text-sm font-bold text-gray-800 capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayOrders = getOrdersForDay(day);
            const inMonth   = isSameMonth(day, currentMonth);
            const today     = isToday(day);
            const visible   = dayOrders.slice(0, 3);
            const overflow  = dayOrders.length - 3;
            const isLastRow = idx >= days.length - 7;

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[72px] p-1 ${!isLastRow ? 'border-b' : ''} ${
                  idx % 7 !== 6 ? 'border-r' : ''
                } border-gray-100 ${inMonth ? 'bg-white' : 'bg-gray-50/60'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 mx-auto ${
                  today
                    ? 'bg-primary-600 text-white'
                    : inMonth ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {visible.map(o => {
                    const client = clients.find(c => c.id === o.clientId);
                    return (
                      <Link
                        key={o.id}
                        to={`/pedidos/${o.id}`}
                        title={`${o.orderNumber} — ${client?.name ?? 'Cliente'} · ${orderStatusLabel[o.status]}`}
                        className={`block text-[9px] font-semibold px-1 py-0.5 rounded truncate leading-tight ${orderStatusColor[o.status]} hover:opacity-75 transition-opacity`}
                      >
                        {client?.name?.split(' ')[0] ?? o.orderNumber}
                      </Link>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-[9px] text-gray-400 font-medium pl-1">+{overflow} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {monthOrders.length === 0 ? (
        <div className="text-center py-10">
          <CalendarDays size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Sin entregas estimadas este mes</p>
          <p className="text-xs text-gray-400 mt-1">Asigna fechas al crear o editar pedidos</p>
        </div>
      ) : (
        <div className="card !p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500">Colores por estado</p>
          <div className="flex flex-wrap gap-2">
            {(['por_recoger','recogido','entregado','pendiente_pago'] as const).map(s => (
              <span key={s} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderStatusColor[s]}`}>
                {orderStatusLabel[s]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
