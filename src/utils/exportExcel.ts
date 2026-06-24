import type { Client, Order, Payment } from '../types';
import { formatDate } from './formatters';
import { toCSV, downloadCSV } from './csvExport';

export function exportPagos(payments: Payment[], clients: Client[]) {
  const rows = payments
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(p => ({
      Fecha:    formatDate(p.date),
      Cliente:  clients.find(c => c.id === p.clientId)?.name ?? '—',
      Monto:    p.amount,
      Método:   p.method,
      Notas:    p.notes ?? '',
    }));
  downloadCSV(toCSV(rows), `pagos_jas_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportPedidos(orders: Order[], clients: Client[]) {
  const rows = orders
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .map(o => ({
      'N° Pedido':   o.orderNumber,
      Fecha:         formatDate(o.orderDate),
      Cliente:       clients.find(c => c.id === o.clientId)?.name ?? '—',
      Total:         o.totalAmount,
      Abonado:       o.amountPaid,
      Pendiente:     o.totalAmount - o.amountPaid,
      Estado:        o.status.replace(/_/g, ' '),
      'Método pago': o.paymentMethod,
    }));
  downloadCSV(toCSV(rows), `pedidos_jas_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportClientes(clients: Client[], orders: Order[], payments: Payment[]) {
  const rows = clients.map(c => {
    const deliveredTotal = orders
      .filter(o => o.clientId === c.id && ['entregado', 'pendiente_pago', 'pagado'].includes(o.status))
      .reduce((s, o) => s + o.totalAmount, 0);
    const totalPaid = payments.filter(p => p.clientId === c.id).reduce((s, p) => s + p.amount, 0);
    const deuda = Math.max(0, deliveredTotal - totalPaid);
    const totalCompras = orders
      .filter(o => o.clientId === c.id && o.status !== 'cancelado')
      .reduce((s, o) => s + o.totalAmount, 0);
    const numPedidos = orders
      .filter(o => o.clientId === c.id && o.status !== 'cancelado').length;
    return {
      Nombre:          c.name,
      Teléfono:        c.phone,
      Estado:          c.status.replace(/_/g, ' '),
      'Total compras': totalCompras,
      'Deuda actual':  deuda,
      'N° pedidos':    numPedidos,
      Dirección:       c.address ?? '',
      Notas:           c.notes   ?? '',
    };
  });
  downloadCSV(toCSV(rows), `clientes_jas_${new Date().toISOString().slice(0, 10)}.csv`);
}
