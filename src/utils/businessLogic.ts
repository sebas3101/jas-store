import type { Client, Order, Payment, ClientStatus, OrderStatus } from '../types';

// ─── Deuda del cliente ────────────────────────────────────────────────────────

/**
 * Suma la deuda pendiente de un cliente.
 * Solo cuenta pedidos en estado 'entregado' o 'pendiente_pago'.
 * Un pedido no suma deuda hasta ser entregado.
 */
export function calculateClientDebt(clientId: string, orders: Order[]): number {
  return orders
    .filter(o =>
      o.clientId === clientId &&
      (o.status === 'entregado' || o.status === 'pendiente_pago')
    )
    .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.amountPaid), 0);
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
 *
 * Reglas:
 * - 'credito_cerrado' nunca se modifica automáticamente.
 * - Sin deuda → 'al_dia'.
 * - Con deuda Y deuda > límite de crédito → 'mora'.
 * - Con deuda Y último abono hace >30 días (o sin abonos y pedido entregado >30 días) → 'mora'.
 * - Con deuda reciente → 'pendiente'.
 */
export function deriveClientStatus(
  client: Client,
  orders: Order[],
  payments: Payment[] = [],
): ClientStatus {
  if (client.status === 'credito_cerrado') return 'credito_cerrado';

  const debt = calculateClientDebt(client.id, orders);
  if (debt <= 0) return 'al_dia';

  // Mora inmediata si supera el límite de crédito
  if (debt > (client.creditLimit ?? 200_000)) return 'mora';

  // Calcular días desde el último abono o desde el pedido entregado más antiguo sin pagar
  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPaymentDate = clientPayments[0]
    ? new Date(clientPayments[0].date)
    : null;

  const oldestUnpaidDate = orders
    .filter(o =>
      o.clientId === client.id &&
      (o.status === 'entregado' || o.status === 'pendiente_pago') &&
      o.amountPaid < o.totalAmount,
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())[0]
    ?.orderDate;

  // El reloj de mora corre desde la fecha del pedido más antiguo sin pagar.
  // Un abono reciente NO reinicia el reloj — solo reduces la deuda.
  // Si el último abono cubrió TODO lo de ese pedido, el siguiente pedido más antiguo toma el reloj.
  const referenceDate = oldestUnpaidDate
    ? new Date(oldestUnpaidDate)
    : lastPaymentDate;
  if (referenceDate) {
    const diffMs   = Date.now() - referenceDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 30) return 'mora';
  }

  return 'pendiente';
}
