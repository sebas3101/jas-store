import type { Client, Order, Payment } from '../types';
import { formatCurrency, formatDate } from './formatters';

// ─── Mensaje de cobro (recordatorio) con último abono ────────────────────────

export const buildDebtReminderMessage = (
  client: Client,
  debt: number,
  orders: Order[],
  payments: Payment[] = [],
) => {
  const pendingOrders = orders
    .filter(o =>
      o.clientId === client.id &&
      (o.status === 'entregado' || o.status === 'pendiente_pago'),
    )
    .map(o => o.orderNumber)
    .join(', ');

  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPayment = clientPayments[0];

  const lastPaymentLine = lastPayment
    ? `Tu último abono fue:\n📅 Fecha: ${formatDate(lastPayment.date)}\n💵 Valor: *${formatCurrency(lastPayment.amount)}*`
    : 'Aún no registramos abonos para este pedido.';

  return (
    `Hola ${client.name} 😊, esperamos que estés muy bien.\n\n` +
    `Te recordamos que tienes un *saldo pendiente de ${formatCurrency(debt)}*` +
    (pendingOrders ? ` correspondiente a tu(s) pedido(s): ${pendingOrders}` : '') +
    `.\n\n${lastPaymentLine}\n\n` +
    `Agradecemos que puedas ponerte al día con tu pago o realizar un nuevo abono.\n` +
    `Puedes hacerlo por transferencia o efectivo. 🙏\n\n` +
    `¡Muchas gracias y que tengas un excelente día!`
  );
};

// ─── Mensaje de información de deuda con abonos y fechas ─────────────────────

export const buildDebtInfoMessage = (
  client: Client,
  debt: number,
  orders: Order[],
  payments: Payment[] = [],
) => {
  const pending = orders
    .filter(o =>
      o.clientId === client.id &&
      (o.status === 'entregado' || o.status === 'pendiente_pago'),
    )
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

  const pedidosLines = pending
    .map(o => {
      const pendiente = o.totalAmount - o.amountPaid;
      const prods = o.items.map(it => it.productName).join(', ');
      return `• Pedido ${o.orderNumber} — ${prods}\n  Pendiente: *${formatCurrency(pendiente)}* | Fecha: ${formatDate(o.orderDate)}`;
    })
    .join('\n');

  const clientPayments = payments
    .filter(p => p.clientId === client.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPayment = clientPayments[0];

  const lastPaymentLine = lastPayment
    ? `💵 *Último abono:*\n📅 ${formatDate(lastPayment.date)} — *${formatCurrency(lastPayment.amount)}*`
    : '💵 *Abonos:* Sin abonos registrados.';

  return (
    `Hola ${client.name} 😊, aquí tienes el resumen de tu cuenta en *JAS Store*:\n\n` +
    `💰 *Saldo pendiente total: ${formatCurrency(debt)}*\n\n` +
    (pedidosLines
      ? `📦 *Pedidos entregados:*\n${pedidosLines}\n\n`
      : '') +
    `${lastPaymentLine}\n\n` +
    `Este mensaje es solo informativo para que tengas claridad sobre tu cuenta.\n` +
    `Cualquier duda estamos a tu disposición. ¡Gracias! 🙏`
  );
};

// ─── Confirmación de pedido: diferencia fiado/crédito vs pago directo ────────

export const buildOrderConfirmationMessage = (
  client: Client,
  order: Order,
  previousDebt = 0,
) => {
  const items = order.items
    .map(it => {
      const size = it.size ? ` (talla ${it.size})` : '';
      return `• ${it.quantity}x ${it.productName}${size} — ${formatCurrency(it.salePrice * it.quantity)}`;
    })
    .join('\n');

  const isCredit = order.paymentMethod === 'credito' ||
                   order.paymentMethod === 'fiado'   ||
                   order.paymentMethod === 'abono';
  const orderBalance = order.totalAmount - order.amountPaid;

  if (isCredit) {
    const totalDebt = previousDebt + orderBalance;
    return (
      `Hola ${client.name} 😊, tu pedido en *JAS Store* ha sido registrado.\n\n` +
      `📦 *Pedido ${order.orderNumber}*\n` +
      (items ? `${items}\n\n` : '') +
      `💰 Valor del pedido: *${formatCurrency(order.totalAmount)}*\n` +
      (order.amountPaid > 0 ? `✅ Abono inicial: ${formatCurrency(order.amountPaid)}\n` : '') +
      `\n📊 *Resumen de saldo:*\n` +
      (previousDebt > 0 ? `   Saldo anterior: ${formatCurrency(previousDebt)}\n` : '') +
      `   Nuevo pedido: ${formatCurrency(orderBalance)}\n` +
      `   *Saldo pendiente total: ${formatCurrency(totalDebt)}*\n\n` +
      `¡Gracias por tu compra! Nos ponemos en contacto cuando tu pedido esté listo. 🛍️`
    );
  }

  // Pago directo
  return (
    `Hola ${client.name} 😊, tu pedido en *JAS Store* ha sido registrado.\n\n` +
    `📦 *Pedido ${order.orderNumber}*\n` +
    (items ? `${items}\n\n` : '') +
    `💰 Valor del pedido: *${formatCurrency(order.totalAmount)}*\n` +
    `✅ Estado de pago: *Pagado*\n` +
    (previousDebt > 0
      ? `\n⚠️ Saldo pendiente anterior: *${formatCurrency(previousDebt)}*\n`
      : '') +
    `\n¡Gracias por tu compra! 🛍️`
  );
};

// ─── Mensaje de disponibilidad al pasar de tomado → por recoger ──────────────

export const buildAvailabilityMessage = (client: Client, order: Order) => {
  const items = order.items
    .map(it => {
      const size = it.size ? `\n  📏 Talla: ${it.size}` : '';
      const color = it.color ? `\n  🎨 Color: ${it.color}` : '';
      return `• ${it.quantity}x ${it.productName}${size}${color}`;
    })
    .join('\n');

  return (
    `Hola ${client.name} 😊, te confirmamos que tu pedido *#${order.orderNumber}* ya se encuentra disponible.\n\n` +
    `📦 *Productos:*\n${items || `• ${order.items[0]?.productName ?? 'Pedido'}`}\n\n` +
    `💰 Valor: *${formatCurrency(order.totalAmount)}*\n\n` +
    `Vamos a proceder con la recogida de la mercancía. Te estaremos informando cuando esté lista para entrega.\n\n` +
    `¡Muchas gracias! 🙏`
  );
};

// ─── Mensaje de actualización de base de datos de clientes ───────────────────
export const buildDataUpdateMessage = (client?: { name?: string }) => {
  const greeting = client?.name ? `Hola ${client.name.split(' ')[0]}` : 'Hola';
  return (
    `${greeting}, esperamos que estés muy bien 😊\n\n` +
    `Estamos actualizando nuestra base de datos de clientes para mejorar el control de pedidos, entregas, pagos y garantías.\n\n` +
    `Por favor ayúdanos confirmando la siguiente información:\n\n` +
    `👤 Nombre completo:\n` +
    `📱 Celular:\n` +
    `🏠 Dirección de entrega:\n` +
    `🏢 Empresa o referencia (si aplica):\n` +
    `🛍 Producto(s) pendiente(s) (si aplica):\n` +
    `💰 Saldo pendiente o último abono (si aplica):\n\n` +
    `Esta información nos ayudará a tener tus pedidos y pagos mejor organizados.\n\n` +
    `Muchas gracias por tu apoyo. 🙏`
  );
};

export const openWhatsApp = (phone: string, message: string) => {
  if (!phone?.trim()) return;
  const cleaned = phone.replace(/\D/g, '');
  const full = cleaned.startsWith('57') ? cleaned : `57${cleaned}`;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${full}?text=${encoded}`, '_blank');
};

// ─── Notificador global (registrado por App para mostrar toasts) ─────────────
let _notify: ((msg: string, type?: 'success' | 'warning') => void) | null = null;
export function registerWhatsAppNotifier(fn: (msg: string, type?: 'success' | 'warning') => void) {
  _notify = fn;
}

/**
 * Envía un mensaje al cliente por WhatsApp respetando su configuración.
 * - Cliente normal: abre el chat 1-a-1 con su número y el mensaje listo para enviar.
 * - Cliente con `sendToGroup`: copia el mensaje al portapapeles y abre el grupo de
 *   WhatsApp. WhatsApp no permite precargar texto en un grupo, así que solo hay que
 *   pegarlo (Ctrl/Cmd+V o mantener pulsado → Pegar).
 */
export const sendClientMessage = (
  client: Pick<Client, 'name' | 'phone' | 'sendToGroup' | 'whatsappGroupLink'>,
  message: string,
) => {
  if (client.sendToGroup) {
    // Abrir el grupo primero (dentro del gesto del clic, evita bloqueo de popups)
    if (client.whatsappGroupLink?.trim()) {
      window.open(client.whatsappGroupLink, '_blank');
    }
    navigator.clipboard?.writeText(message)
      .then(() => _notify?.('📋 Mensaje copiado — pégalo en el grupo', 'success'))
      .catch(() => _notify?.('No pude copiar el mensaje automáticamente. Cópialo a mano.', 'warning'));
    return;
  }
  openWhatsApp(client.phone, message);
};
