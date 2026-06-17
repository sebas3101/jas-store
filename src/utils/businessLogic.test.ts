import { describe, it, expect } from 'vitest';
import { calculateClientDebt, distributeFifo, deriveClientStatus } from './businessLogic';
import type { Order, Client } from '../types';

// ─── Helpers para construir fixtures mínimos ───────────────────────────────────

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

describe('calculateClientDebt', () => {
  it('devuelve 0 cuando el cliente no tiene pedidos', () => {
    expect(calculateClientDebt('c1', [])).toBe(0);
  });

  it('devuelve el total de un pedido sin abonos', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, amountPaid: 0 })];
    expect(calculateClientDebt('c1', orders)).toBe(150_000);
  });

  it('descuenta el monto ya pagado', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, amountPaid: 50_000 })];
    expect(calculateClientDebt('c1', orders)).toBe(100_000);
  });

  it('excluye pedidos con status pagado', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, amountPaid: 150_000, status: 'pagado' })];
    expect(calculateClientDebt('c1', orders)).toBe(0);
  });

  it('excluye pedidos con status cancelado', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 200_000, amountPaid: 0, status: 'cancelado' })];
    expect(calculateClientDebt('c1', orders)).toBe(0);
  });

  it('suma la deuda de múltiples pedidos activos', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 30_000 }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  amountPaid: 0 }),
    ];
    expect(calculateClientDebt('c1', orders)).toBe(150_000);
  });

  it('ignora pedidos de otros clientes', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0 }),
      makeOrder({ id: 'o2', clientId: 'c2', totalAmount: 200_000, amountPaid: 0 }),
    ];
    expect(calculateClientDebt('c1', orders)).toBe(100_000);
  });
});

// ─── distributeFifo ───────────────────────────────────────────────────────────

describe('distributeFifo', () => {
  it('devuelve array vacío si el monto es 0', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0 })];
    expect(distributeFifo(0, orders)).toEqual([]);
  });

  it('devuelve array vacío si no hay pedidos', () => {
    expect(distributeFifo(50_000, [])).toEqual([]);
  });

  it('paga parcialmente un pedido sin cubrirlo completo', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0, status: 'tomado' })];
    const result = distributeFifo(60_000, orders);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ orderId: 'o1', newAmountPaid: 60_000, newStatus: 'tomado' });
  });

  it('marca el pedido como pagado cuando el monto lo cubre exactamente', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0 })];
    const result = distributeFifo(100_000, orders);
    expect(result[0]).toMatchObject({ newAmountPaid: 100_000, newStatus: 'pagado' });
  });

  it('distribuye FIFO: aplica primero al pedido más antiguo', () => {
    const orders = [
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000, amountPaid: 0, orderDate: '2024-02-01T00:00:00.000Z' }),
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0, orderDate: '2024-01-01T00:00:00.000Z' }),
    ];
    const result = distributeFifo(60_000, orders);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o1'); // el más antiguo
  });

  it('cubre el primer pedido completo y aplica el resto al segundo', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0, orderDate: '2024-01-01T00:00:00.000Z' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  amountPaid: 0, orderDate: '2024-02-01T00:00:00.000Z' }),
    ];
    const result = distributeFifo(130_000, orders);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ orderId: 'o1', newAmountPaid: 100_000, newStatus: 'pagado' });
    expect(result[1]).toMatchObject({ orderId: 'o2', newAmountPaid: 30_000, newStatus: 'tomado' });
  });

  it('cubre todos los pedidos cuando el monto es suficiente', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 0, orderDate: '2024-01-01T00:00:00.000Z' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  amountPaid: 0, orderDate: '2024-02-01T00:00:00.000Z' }),
    ];
    const result = distributeFifo(200_000, orders);
    expect(result).toHaveLength(2);
    expect(result[0].newStatus).toBe('pagado');
    expect(result[1].newStatus).toBe('pagado');
  });

  it('omite pedidos ya completamente pagados', () => {
    const orders = [
      makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 100_000, orderDate: '2024-01-01T00:00:00.000Z' }),
      makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 80_000,  amountPaid: 0,       orderDate: '2024-02-01T00:00:00.000Z' }),
    ];
    const result = distributeFifo(50_000, orders);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe('o2');
  });

  it('tiene en cuenta el amountPaid previo al calcular la diferencia', () => {
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 100_000, amountPaid: 70_000 })];
    const result = distributeFifo(30_000, orders);
    expect(result[0]).toMatchObject({ newAmountPaid: 100_000, newStatus: 'pagado' });
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
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 150_000, amountPaid: 0 })];
    expect(deriveClientStatus(client, orders)).toBe('pendiente');
  });

  it('devuelve mora cuando la deuda supera el límite de crédito', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: 100_000 });
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 250_000, amountPaid: 0 })];
    expect(deriveClientStatus(client, orders)).toBe('mora');
  });

  it('nunca cambia credito_cerrado sin importar la deuda', () => {
    const client = makeClient({ id: 'c1', status: 'credito_cerrado' });
    // Sin deuda
    expect(deriveClientStatus(client, [])).toBe('credito_cerrado');
    // Con deuda alta
    const orders = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 500_000, amountPaid: 0 })];
    expect(deriveClientStatus(client, orders)).toBe('credito_cerrado');
  });

  it('usa 200.000 como límite por defecto cuando creditLimit es null', () => {
    const client = makeClient({ id: 'c1', status: 'al_dia', creditLimit: undefined });
    const ordersEnMora = [makeOrder({ id: 'o1', clientId: 'c1', totalAmount: 250_000, amountPaid: 0 })];
    const ordersEnPendiente = [makeOrder({ id: 'o2', clientId: 'c1', totalAmount: 100_000, amountPaid: 0 })];
    expect(deriveClientStatus(client, ordersEnMora)).toBe('mora');
    expect(deriveClientStatus(client, ordersEnPendiente)).toBe('pendiente');
  });
});
