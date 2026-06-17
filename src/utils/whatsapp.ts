import type { Client, Order } from '../types';
import { formatCurrency, formatDate } from './formatters';

export const buildDebtReminderMessage = (
  client: Client,
  debt: number,
  orders: Order[]
) => {
  const pendingOrders = orders
    .filter(
      (o) =>
        o.clientId === client.id &&
        o.status !== 'pagado' &&
        o.status !== 'cancelado'
    )
    .map((o) => o.orderNumber)
    .join(', ');

  return (
    `Hola ${client.name} 😊, te saluda el equipo de *JAS Store*.\n\n` +
    `Te recordamos que tienes un saldo pendiente de *${formatCurrency(debt)}*` +
    (pendingOrders ? ` correspondiente a tu(s) pedido(s): ${pendingOrders}` : '') +
    `.\n\nPuedes realizar tu abono por transferencia o efectivo. ` +
    `Recuerda que manejamos pagos quincenales. 🙏\n\n` +
    `¡Muchas gracias y que tengas un excelente día!`
  );
};

// Mensaje con detalle de pedidos pendientes (diferente al recordatorio de cobro)
export const buildDebtInfoMessage = (
  client: Client,
  debt: number,
  orders: Order[]
) => {
  const pending = orders
    .filter(o => o.clientId === client.id && o.status !== 'pagado' && o.status !== 'cancelado')
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const lines = pending
    .map(o => {
      const pendiente = o.totalAmount - o.amountPaid;
      return `• ${o.orderNumber} (${formatDate(o.orderDate)}): *${formatCurrency(pendiente)}* pendiente`;
    })
    .join('\n');

  return (
    `Hola ${client.name} 😊, aquí tienes el resumen de tu cuenta en *JAS Store*:\n\n` +
    (lines ? `${lines}\n\n` : '') +
    `*Total deuda: ${formatCurrency(debt)}*\n\n` +
    `Cualquier duda estamos a tu disposición. ¡Gracias! 🙏`
  );
};

// Mensaje de confirmación de nuevo pedido
export const buildOrderConfirmationMessage = (client: Client, order: Order) => {
  const items = order.items
    .map(it => `• ${it.quantity}x ${it.productName} — ${formatCurrency(it.salePrice * it.quantity)}`)
    .join('\n');

  const pending = order.totalAmount - order.amountPaid;

  return (
    `Hola ${client.name} 😊, tu pedido en *JAS Store* ha sido registrado exitosamente.\n\n` +
    `📦 *Pedido ${order.orderNumber}*\n` +
    (items ? `${items}\n\n` : '') +
    `💰 Total: *${formatCurrency(order.totalAmount)}*\n` +
    (order.amountPaid > 0 ? `✅ Abono: ${formatCurrency(order.amountPaid)}\n` : '') +
    (pending > 0 ? `⏳ Saldo pendiente: *${formatCurrency(pending)}*\n` : '✅ Pagado en su totalidad\n') +
    `\n¡Gracias por tu compra! Nos ponemos en contacto cuando tu pedido esté listo. 🛍️`
  );
};

export const openWhatsApp = (phone: string, message: string) => {
  const cleaned = phone.replace(/\D/g, '');
  const full = cleaned.startsWith('57') ? cleaned : `57${cleaned}`;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${full}?text=${encoded}`, '_blank');
};
