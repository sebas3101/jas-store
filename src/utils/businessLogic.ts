import type { Client, Order, Payment, ClientStatus } from '../types';

// ─── Deuda del cliente ────────────────────────────────────────────────────────

/**
 * Deuda total del cliente = suma de pedidos entregados/pendiente_pago/pagado
 * menos el total de pagos recibidos.
 * Los pagos no se atribuyen por pedido individual; van contra el total.
 */
export function calculateClientDebt(
  clientId: string,
  orders: Order[],
  payments: Payment[] = [],
): number {
  const totalOwed = orders
    .filter(o =>
      o.clientId === clientId &&
      ['entregado', 'pendiente_pago', 'pagado'].includes(o.status)
    )
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalPaid = payments
    .filter(p => p.clientId === clientId)
    .reduce((sum, p) => sum + p.amount, 0);

  return Math.max(0, totalOwed - totalPaid);
}

// ─── Estado del cliente ───────────────────────────────────────────────────────

/**
 * Determina el estado correcto de un cliente según su deuda real.
 *
 * Reglas (en orden de prioridad):
 * - 'credito_cerrado' nunca se modifica automáticamente.
 * - Sin deuda → 'al_dia'.
 * - Con deuda Y último abono hace >18 días (o sin abonos y pedido entregado >18 días) → 'mora'.
 *   El abono reinicia el reloj de 18 días.
 * - Con deuda > límite de crédito → 'credito_excedido'.
 * - Con deuda reciente y dentro del límite → 'pendiente'.
 */
export function deriveClientStatus(
  client: Client,
  orders: Order[],
  payments: Payment[] = [],
): ClientStatus {
  if (client.status === 'credito_cerrado') return 'credito_cerrado';

  const debt = calculateClientDebt(client.id, orders, payments);
  if (debt <= 0) return 'al_dia';

  // Reloj de mora: corre desde el último abono. Si nunca abonó, desde el pedido entregado más antiguo.
  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPaymentDate = clientPayments[0]
    ? new Date(clientPayments[0].date)
    : null;

  // Pedidos entregados aún no resueltos (sin contar pagado)
  const oldestUnpaidDate = orders
    .filter(o =>
      o.clientId === client.id &&
      (o.status === 'entregado' || o.status === 'pendiente_pago')
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())[0]
    ?.orderDate;

  const referenceDate = lastPaymentDate ?? (oldestUnpaidDate ? new Date(oldestUnpaidDate) : null);
  if (referenceDate) {
    const diffDays = (Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 18) return 'mora';
  }

  if (debt > (client.creditLimit ?? 200_000)) return 'credito_excedido';

  return 'pendiente';
}
