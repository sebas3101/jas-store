import { describe, it, expect } from 'vitest';
import { calculateClientDebt, deriveClientStatus } from './businessLogic';
import type { Order, Client, Payment } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> & { id: string; clientId: string }): Order {
  return {
    orderNumber: 'JAS-001',
    orderDate: '2024-01-01T00:00:00.000Z',
    status: 'tomado',
    totalAmount: 100_000,
    amountPaid: 0,
    totalCost: 0,
    paymentMethod: 'efectivo',
    sellerId: 'u1',
    items: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> & { id: string; clientId: string; amount: number }): Payment {
  return {
    orderIds: [],
    method: 'efectivo',
    date: '2024-01-01T00:00:00.000Z',
    notes: '',
    registeredById: 'u1',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> & { id: string }): Client {
  return {
    name: 'Cliente Test',
    phone: '',
    status: 'al_dia',
    isInternal: false,
    creditLimit: 200_000,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── calculateClientDebt ──────────────────────────────────────────────────────
// Modelo: deuda = suma de pedidos entregados/pendiente_pago/pagado − total pagos recibidos.
// Los pagos no se atribuyen por pedido; van contra el total del cliente.

describe('calculateClientDebt', () => {
  it('devuelve 0 cuando el cliente no tiene pedidos ni pagos', () => {
    expect(calculateClientDebt('c1', [], [])).toBe(0);
  });

  it('devuelve el total de un pedido entregado sin pagos', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, status: 'entregado' })];
    expect(calculateClientDebt('c1', orders, [])).toBe(150_000);
  });

  it('descuenta el total de pagos recibidos del cliente', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, status: 'entregado' })];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 50_000 })];
    expect(calculateClientDebt('c1', orders, payments)).toBe(100_000);
  });

  it('deuda 0 cuando los pagos cubren exactamente todos los pedidos', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, status: 'pagado' })];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 150_000 })];
    expect(calculateClientDebt('c1', orders, payments)).toBe(0);
  });

  it('no es negativa aunque los pagos superen la deuda (saldo a favor → 0)', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado' })];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 150_000 })];
    expect(calculateClientDebt('c1', orders, payments)).toBe(0);
  });

  it('excluye pedidos con status cancelado', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 200_000, status: 'cancelado' })];
    expect(calculateClientDebt('c1', orders, [])).toBe(0);
  });

  it('excluye pedidos no entregados (tomado, por_recoger, recogido)', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'tomado' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  status: 'por_recoger' }),
    ];
    expect(calculateClientDebt('c1', orders, [])).toBe(0);
  });

  it('suma la deuda de múltiples pedidos activos descontando pagos totales', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  status: 'entregado' }),
    ];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 30_000 })];
    expect(calculateClientDebt('c1', orders, payments)).toBe(150_000);
  });

  it('incluye pedidos con status pagado en la suma total', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'pagado' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 50_000,  status: 'pendiente_pago' }),
    ];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 100_000 })];
    // owed=150K, paid=100K → 50K
    expect(calculateClientDebt('c1', orders, payments)).toBe(50_000);
  });

  it('ignora pedidos de otros clientes', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado' }),
      makeOrder({ id: 'o2', clientId: 'c2', totalAmount: 200_000, status: 'entregado' }),
    ];
    expect(calculateClientDebt('c1', orders, [])).toBe(100_000);
  });

  it('ignora pagos de otros clientes', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado' })];
    const payments = [makePayment({ id: 'p1', clientId: 'c2', amount: 100_000 })];
    expect(calculateClientDebt('c1', orders, payments)).toBe(100_000);
  });
});

// ─── deriveClientStatus ───────────────────────────────────────────────────────

describe('deriveClientStatus', () => {
  it('devuelve al_dia cuando la deuda es 0', () => {
    const client = makeClient({ id: 'c1', status: 'pendiente' });
    expect(deriveClientStatus(client, [])).toBe('al_dia');
  });

  it('devuelve pendiente cuando la deuda está dentro del límite de crédito', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 300_000 });
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, status: 'entregado', orderDate: recentDate })];
    expect(deriveClientStatus(client, orders, [])).toBe('pendiente');
  });

  it('devuelve credito_excedido cuando la deuda supera el límite (dentro de 18 días)', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 100_000 });
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 250_000, status: 'entregado', orderDate: recentDate })];
    expect(deriveClientStatus(client, orders, [])).toBe('credito_excedido');
  });

  it('devuelve mora cuando llevan más de 18 días sin abono', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 500_000 });
    const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado', orderDate: oldDate })];
    expect(deriveClientStatus(client, orders, [])).toBe('mora');
  });

  it('un abono reciente reinicia el reloj — no mora aunque el pedido sea antiguo', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 500_000 });
    const oldDate           = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const recentPaymentDate = new Date(Date.now() - 5  * 86_400_000).toISOString();
    const orders   = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, status: 'entregado', orderDate: oldDate })];
    const payments = [makePayment({ id: 'p1', clientId: 'c1', amount: 30_000, date: recentPaymentDate })];
    expect(deriveClientStatus(client, orders, payments)).toBe('pendiente');
  });

  it('mora tiene prioridad sobre credito_excedido', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 50_000 });
    const oldDate = new Date(Date.now() - 25 * 86_400_000).toISOString();
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 200_000, status: 'entregado', orderDate: oldDate })];
    expect(deriveClientStatus(client, orders, [])).toBe('mora');
  });

  it('nunca cambia credito_cerrado sin importar la deuda', () => {
    const client = makeClient({ id: 'c1', status: 'credito_cerrado' });
    expect(deriveClientStatus(client, [])).toBe('credito_cerrado');
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 500_000, status: 'entregado' })];
    expect(deriveClientStatus(client, orders)).toBe('credito_cerrado');
  });

  it('usa 200.000 como límite por defecto cuando creditLimit es null', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: undefined });
    const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const ordersExcedido   = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 250_000, status: 'entregado', orderDate: recentDate })];
    const ordersEnPendiente = [makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 100_000, status: 'entregado', orderDate: recentDate })];
    expect(deriveClientStatus(client, ordersExcedido)).toBe('credito_excedido');
    expect(deriveClientStatus(client, ordersEnPendiente)).toBe('pendiente');
  });
});
