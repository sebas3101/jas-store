import type { Client, Order, Payment } from '../types';
import { formatDate } from './formatters';
import { calculateClientDebt } from './businessLogic';

export async function exportPagos(payments: Payment[], clients: Client[]) {
  const XLSX = await import('xlsx');
  const rows = payments
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(p => ({
      Fecha:    formatDate(p.date),
      Cliente:  clients.find(c => c.id === p.clientId)?.name ?? '—',
      Monto:    p.amount,
      Método:   p.method,
      Notas:    p.notes ?? '',
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
  XLSX.writeFile(wb, `pagos_jas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportPedidos(orders: Order[], clients: Client[]) {
  const XLSX = await import('xlsx');
  const rows = orders
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .map(o => ({
      'N° Pedido':  o.orderNumber,
      Fecha:        formatDate(o.orderDate),
      Cliente:      clients.find(c => c.id === o.clientId)?.name ?? '—',
      Total:        o.totalAmount,
      'Abonado':    o.amountPaid,
      'Pendiente':  o.totalAmount - o.amountPaid,
      Estado:       o.status.replace(/_/g, ' '),
      'Método pago': o.paymentMethod,
    }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  XLSX.writeFile(wb, `pedidos_jas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportClientes(clients: Client[], orders: Order[], _payments: Payment[]) {
  const XLSX = await import('xlsx');
  const rows = clients.map(c => {
    const deuda = calculateClientDebt(c.id, orders);
    const totalCompras = orders
      .filter(o => o.clientId === c.id && o.status !== 'cancelado')
      .reduce((s, o) => s + o.totalAmount, 0);
    const numPedidos = orders.filter(o => o.clientId === c.id && o.status !== 'cancelado').length;
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
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `clientes_jas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
