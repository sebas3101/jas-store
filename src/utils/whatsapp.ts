import type { Client, Order } from '../types';
import { formatCurrency } from './formatters';

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

export const openWhatsApp = (phone: string, message: string) => {
  const cleaned = phone.replace(/\D/g, '');
  const full = cleaned.startsWith('57') ? cleaned : `57${cleaned}`;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${full}?text=${encoded}`, '_blank');
};
