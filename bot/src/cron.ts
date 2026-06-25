import TelegramBot from 'node-telegram-bot-api';
import { getDailySummary } from './db';

const STATUS_ES: Record<string, string> = {
  tomado:      'tomado',
  por_recoger: 'por recoger',
  recogido:    'recogido',
};

const DAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function formatDate(d: Date): string {
  // Colombia local: UTC-5
  const col = new Date(d.getTime() - 5 * 3_600_000);
  const day = DAYS_ES[col.getUTCDay()];
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${col.getUTCDate()} ${MONTHS_ES[col.getUTCMonth()]}`;
}

function formatCOP(amount: number): string {
  return '$' + amount.toLocaleString('es-CO');
}

async function buildSummary(): Promise<string> {
  const s   = await getDailySummary();
  const now = new Date();
  const lines: string[] = [
    `📊 *Resumen JAS Store — ${formatDate(now)}*`,
    '',
    `📦 *Pedidos activos*`,
    `• Tomados: ${s.activeOrders.tomado} · Por recoger: ${s.activeOrders.por_recoger} · Recogidos: ${s.activeOrders.recogido}`,
  ];

  if (s.staleOrders.length > 0) {
    lines.push('', '⏰ *Sin mover hace +7 días*');
    for (const o of s.staleOrders) {
      const name = o.clientName.split(' ').slice(0, 2).join(' ');
      lines.push(`• ${o.orderNumber} — ${name} (${STATUS_ES[o.status] ?? o.status}, ${o.days} días)`);
    }
  }

  lines.push('', `🧾 *Comprobantes sin revisar*`);
  lines.push(s.pendingProofs > 0
    ? `• ${s.pendingProofs} pendiente${s.pendingProofs !== 1 ? 's' : ''} de confirmación`
    : '• Ninguno pendiente ✓');

  lines.push('', `💰 *Cobros de ayer*`);
  lines.push(s.yesterdayPayments.count > 0
    ? `• ${formatCOP(s.yesterdayPayments.total)} en ${s.yesterdayPayments.count} abono${s.yesterdayPayments.count !== 1 ? 's' : ''}`
    : '• Sin cobros registrados ayer');

  if (s.clientsInMora > 0) {
    lines.push('', `👥 *Clientes en mora*`);
    lines.push(`• ${s.clientsInMora} cliente${s.clientsInMora !== 1 ? 's' : ''} superaron su límite de crédito`);
  }

  lines.push('', '_Revisa el dashboard para más detalles._');
  return lines.join('\n');
}

export function startDailyCron(bot: TelegramBot, notifyIds: number[]): void {
  let lastSentDate = '';

  setInterval(async () => {
    const now     = new Date();
    const utcHour = now.getUTCHours();
    const utcMin  = now.getUTCMinutes();
    // Colombia = UTC-5 → 8:00 AM Colombia = 13:00 UTC
    const today   = now.toISOString().slice(0, 10);

    if (utcHour === 13 && utcMin < 2 && lastSentDate !== today) {
      lastSentDate = today;
      try {
        const msg = await buildSummary();
        for (const id of notifyIds) {
          await bot.sendMessage(id, msg, { parse_mode: 'Markdown' });
        }
        console.log(`[CRON] Resumen diario enviado a ${notifyIds.length} usuario(s):`, today);
      } catch (err) {
        console.error('[CRON] Error enviando resumen:', err);
      }
    }
  }, 60_000);

  console.log(`[CRON] Resumen diario activo — se enviará a las 8:00 AM Colombia a ${notifyIds.length} usuario(s)`);
}
