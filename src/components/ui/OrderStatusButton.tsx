import { ChevronRight, Loader2 } from 'lucide-react';
import type { Order, OrderStatus } from '../../types';

export const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  tomado:         { status: 'por_recoger',    label: 'Por recoger'  },
  por_recoger:    { status: 'recogido',       label: 'Recogido'     },
  recogido:       { status: 'entregado',      label: 'Entregado'    },
  entregado:      { status: 'pendiente_pago', label: 'Pend. pago'   },
  pendiente_pago: { status: 'pagado',         label: 'Pagado'       },
};

interface OrderStatusButtonProps {
  order: Order;
  onAdvance: (order: Order) => void;
  advancing: boolean;
  /** 'pill' = chip pequeño para listas | 'chip' = botón compacto | 'full' = botón ancho para cards de detalle */
  variant?: 'pill' | 'chip' | 'full';
}

export function OrderStatusButton({
  order,
  onAdvance,
  advancing,
  variant = 'pill',
}: OrderStatusButtonProps) {
  const next = NEXT_STATUS[order.status];
  if (!next) return null;

  if (variant === 'full') {
    return (
      <button
        onClick={() => onAdvance(order)}
        disabled={advancing}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-primary-200"
      >
        {advancing
          ? <><Loader2 size={14} className="animate-spin" /> Actualizando...</>
          : <><ChevronRight size={14} /> Avanzar a {next.label}</>
        }
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button
        onClick={() => onAdvance(order)}
        disabled={advancing}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl transition-colors disabled:opacity-50 flex-shrink-0 shadow-sm shadow-primary-200"
      >
        {advancing
          ? <Loader2 size={12} className="animate-spin" />
          : <><ChevronRight size={12} /> {next.label}</>
        }
      </button>
    );
  }

  // pill (default) — igual al que ya existía en OrdersPage
  return (
    <button
      onClick={() => onAdvance(order)}
      disabled={advancing}
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
    >
      {advancing
        ? <Loader2 size={9} className="animate-spin" />
        : <><ChevronRight size={10} /> {next.label}</>
      }
    </button>
  );
}
