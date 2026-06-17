import type { Client, Order, ClientStatus, OrderStatus } from '../types';

// ─── Deuda del cliente ────────────────────────────────────────────────────────

/** Suma la deuda pendiente de un cliente. Excluye pedidos pagados y cancelados. */
export function calculateClientDebt(clientId: string, orders: Order[]): number {
  return orders
    .filter(o => o.clientId === clientId && o.status !== 'cancelado' && o.status !== 'pagado')
    .reduce((sum, o) => sum + (o.totalAmount - o.amountPaid), 0);
}

// ─── Distribución FIFO ───────────────────────────────────────────────────────

export type FifoApplication = {
  orderId: string;
  newAmountPaid: number;
  newStatus: OrderStatus;
};

/**
 * Distribuye un monto entre pedidos usando FIFO (más antiguo primero).
 * Devuelve las actualizaciones a aplicar sin mutar los pedidos originales.
 */
export function distributeFifo(amount: number, orders: Order[]): FifoApplication[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
  );
  const result: FifoApplication[] = [];
  let remaining = amount;

  for (const order of sorted) {
    if (remaining <= 0) break;
    const pendiente = order.totalAmount - order.amountPaid;
    if (pendiente <= 0) continue;
    const toApply = Math.min(remaining, pendiente);
    const newAmountPaid = order.amountPaid + toApply;
    result.push({
      orderId: order.id,
      newAmountPaid,
      newStatus: newAmountPaid >= order.totalAmount ? 'pagado' : order.status,
    });
    remaining -= toApply;
  }

  return result;
}

// ─── Estado del cliente ───────────────────────────────────────────────────────

/**
 * Determina el estado correcto de un cliente según su deuda real.
 * 'credito_cerrado' nunca se modifica automáticamente (decisión del admin).
 */
export function deriveClientStatus(client: Client, orders: Order[]): ClientStatus {
  if (client.status === 'credito_cerrado') return 'credito_cerrado';
  const debt = calculateClientDebt(client.id, orders);
  if (debt <= 0) return 'al_dia';
  if (debt > (client.creditLimit ?? 200_000)) return 'mora';
  return 'pendiente';
}
