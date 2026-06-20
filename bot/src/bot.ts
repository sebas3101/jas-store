import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';
import { extractPaymentData, type ExtractedPayment } from './ocr';
import { searchClients, savePaymentProof, checkDuplicate, type DbClient } from './db';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN no configurado en .env');

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Autenticación ─────────────────────────────────────────────────────────────

const ALLOWED_IDS = (process.env.ALLOWED_CHAT_IDS ?? '')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(n => !isNaN(n));

if (ALLOWED_IDS.length === 0) {
  console.warn('[AUTH] ALLOWED_CHAT_IDS no configurado — cualquier usuario puede usar el bot.');
}

function isAllowed(chatId: number): boolean {
  return ALLOWED_IDS.length === 0 || ALLOWED_IDS.includes(chatId);
}

// ─── Estado de sesiones ────────────────────────────────────────────────────────

type Phase = 'waiting_name' | 'waiting_selection';

interface Session {
  phase:       Phase;
  imageBase64: string;
  mimeType:    string;
  ocrPromise:  Promise<ExtractedPayment | null>;
  typedName?:  string;
  candidates?: DbClient[];
  ts:          number;
}

const sessions = new Map<number, Session>();

// Limpia sesiones con más de 10 minutos sin actividad
setInterval(() => {
  const limit = Date.now() - 10 * 60_000;
  for (const [id, s] of sessions) if (s.ts < limit) sessions.delete(id);
}, 60_000);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function withOcrTimeout(p: Promise<ExtractedPayment | null>): Promise<ExtractedPayment | null> {
  const timeout = new Promise<null>(r => setTimeout(() => r(null), 40_000));
  return Promise.race([p, timeout]);
}

async function downloadBase64(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const file = await bot.getFile(fileId);
  const url  = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
  const res  = await fetch(url);
  const buf  = Buffer.from(await res.arrayBuffer());
  const ext  = file.file_path?.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  console.log(`[IMG] ${file.file_path} → ${Math.round(buf.length / 1024)}KB`);
  return { base64: buf.toString('base64'), mimeType };
}

function buildResumen(ocr: ExtractedPayment, nombre: string, vinculado: boolean, advertencias: string[]): string {
  const lines: string[] = ['✅ *Comprobante registrado*\n'];
  if (vinculado) lines.push(`👤 Cliente: *${nombre}*`);
  else           lines.push(`👤 Nombre: ${nombre} _(pendiente de vincular)_`);
  lines.push(`💰 Monto: *${ocr.amount!.toLocaleString('es-CO')} COP*`);
  if (ocr.date)      lines.push(`📅 Fecha: ${ocr.date}`);
  if (ocr.bank)      lines.push(`🏦 Banco: ${ocr.bank}`);
  if (ocr.reference) lines.push(`🔐 Referencia: ${ocr.reference}`);
  lines.push(`📊 Confianza OCR: *${ocr.confidence}*`);
  if (advertencias.length > 0)
    lines.push(`\n⚠️ ${advertencias.join(' · ')}`);
  lines.push(`\nEstado: _pendiente de confirmación_ en el dashboard.`);
  return lines.join('\n');
}

async function guardar(chatId: number, session: Session, client: DbClient | null, nombre: string) {
  const ocr = await withOcrTimeout(session.ocrPromise);

  // Solo el monto es obligatorio
  if (!ocr?.amount) {
    sessions.delete(chatId);
    await bot.sendMessage(
      chatId,
      '📷 No pude leer el *monto* del comprobante.\n\nVerifica que la imagen sea clara, esté bien iluminada y sin recortes, luego envíala de nuevo.',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  // Advertencias por campos faltantes (sin bloquear el guardado)
  const advertencias: string[] = [];
  if (!ocr.date)      advertencias.push('fecha no detectada — revisa en el dashboard');
  if (!ocr.reference) advertencias.push('referencia no detectada — revisa en el dashboard');
  if (ocr.confidence === 'baja') advertencias.push('imagen difícil de leer');

  // Detección de duplicado por referencia
  if (ocr.reference) {
    const esDuplicado = await checkDuplicate(ocr.reference);
    if (esDuplicado) {
      advertencias.push('⚠️ posible duplicado — ya existe un comprobante con esta referencia');
    }
  }

  const notasCompletas = [ocr.notes, ...advertencias.filter(a => a.startsWith('fecha') || a.startsWith('referencia'))].filter(Boolean).join(' · ');

  sessions.delete(chatId);

  const id = await savePaymentProof({
    clientId:   client?.id,
    amount:     ocr.amount,
    date:       ocr.date,
    bank:       ocr.bank,
    reference:  ocr.reference,
    senderName: client?.name ?? nombre,
    notes:      notasCompletas || undefined,
  });

  if (!id) {
    await bot.sendMessage(chatId, '❌ Error al guardar en la base de datos. Intenta de nuevo o contacta al admin.');
    return;
  }

  // Notificar al admin si el comprobante lo registró otra persona
  const adminId = parseInt(process.env.ADMIN_CHAT_ID ?? '0', 10);
  if (adminId && adminId !== chatId) {
    const adminMsg = [
      `🧾 *Nuevo comprobante registrado*`,
      `👤 ${client?.name ?? nombre}`,
      `💰 *${ocr.amount!.toLocaleString('es-CO')} COP*`,
      ocr.bank ? `🏦 ${ocr.bank}` : null,
      `\nRevisa el dashboard para confirmar.`,
    ].filter(Boolean).join('\n');
    bot.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' }).catch(() => {});
  }

  await bot.sendMessage(chatId, buildResumen(ocr, client?.name ?? nombre, !!client, advertencias), { parse_mode: 'Markdown' });
}

// ─── Comandos ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, msg => {
  if (!isAllowed(msg.chat.id)) return;
  bot.sendMessage(
    msg.chat.id,
    '👋 Hola, soy el bot de pagos de *JAS Store*.\n\n' +
    'Envíame la foto de un comprobante de pago y lo registro automáticamente.\n\n' +
    '• /cancelar — cancela la operación actual\n' +
    '• /sin\\_cliente — guarda sin vincular a ningún cliente',
    { parse_mode: 'Markdown' },
  );
});

bot.onText(/\/myid/, msg => {
  bot.sendMessage(msg.chat.id, `Tu chat ID es: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/cancelar/, msg => {
  if (!isAllowed(msg.chat.id)) return;
  sessions.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, '❌ Operación cancelada.');
});

bot.onText(/\/sin_cliente/, async msg => {
  const chatId = msg.chat.id;
  if (!isAllowed(chatId)) return;
  const session = sessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, '⚠️ No hay ninguna operación activa.');
    return;
  }
  await guardar(chatId, session, null, session.typedName ?? 'Sin nombre');
});

// ─── Recepción de imagen ───────────────────────────────────────────────────────

async function iniciarSesion(chatId: number, fileId: string, isDocument = false) {
  if (!isAllowed(chatId)) {
    await bot.sendMessage(chatId, '⛔ No tienes acceso a este bot.');
    return;
  }
  sessions.delete(chatId);
  try {
    await bot.sendMessage(chatId, '📥 Recibiendo comprobante...');
    const { base64, mimeType } = await downloadBase64(fileId);
    sessions.set(chatId, {
      phase:       'waiting_name',
      imageBase64: base64,
      mimeType,
      ocrPromise:  extractPaymentData(base64, mimeType), // OCR arranca en paralelo mientras el usuario escribe el nombre
      ts:          Date.now(),
    });
    await bot.sendMessage(chatId, '👤 ¿A nombre de quién es este pago?\n\nEscribe el nombre del cliente:');
  } catch (err) {
    console.error('iniciarSesion:', err);
    const hint = isDocument ? 'Prueba enviar la imagen directamente (no como archivo).' : 'Intenta de nuevo.';
    await bot.sendMessage(chatId, `❌ No pude recibir la imagen. ${hint}`);
  }
}

bot.on('photo', msg => {
  const best = msg.photo![msg.photo!.length - 1];
  iniciarSesion(msg.chat.id, best.file_id).catch(err => console.error('photo handler:', err));
});

bot.on('document', async msg => {
  const doc = msg.document!;
  if (!doc.mime_type?.startsWith('image/')) {
    await bot.sendMessage(msg.chat.id, '⚠️ Solo acepto imágenes de comprobantes.');
    return;
  }
  iniciarSesion(msg.chat.id, doc.file_id, true).catch(err => console.error('document handler:', err));
});

// ─── Recepción de texto ────────────────────────────────────────────────────────

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId  = msg.chat.id;

  if (!isAllowed(chatId)) {
    await bot.sendMessage(chatId, '⛔ No tienes acceso a este bot.');
    return;
  }

  const session = sessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, '📸 Envíame primero la foto de un comprobante de pago.');
    return;
  }

  session.ts = Date.now();

  // ── Fase 1: esperar nombre del cliente ──────────────────────────────────────
  if (session.phase === 'waiting_name') {
    const nombre = msg.text.trim();
    if (!nombre) {
      await bot.sendMessage(chatId, '⚠️ Escribe el nombre del cliente.');
      return;
    }
    session.typedName = nombre;
    await bot.sendMessage(chatId, '🔍 Buscando cliente...');
    const clients = await searchClients(nombre);

    if (clients.length === 0) {
      await bot.sendMessage(
        chatId,
        `⚠️ No encontré ningún cliente con ese nombre.\n\nIntenta con otro nombre o un apellido diferente.\n\n• /sin_cliente — guardar sin vincular\n• /cancelar — cancelar`,
      );
      return;
    }

    session.phase      = 'waiting_selection';
    session.candidates = clients;
    const list = clients.map((c, i) =>
      `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}`
    ).join('\n');
    await bot.sendMessage(
      chatId,
      `Encontré ${clients.length} cliente${clients.length > 1 ? 's' : ''}:\n\n${list}\n${clients.length + 1}. Ninguno de estos (guardar sin vincular)\n\nResponde con el número:`,
    );

  // ── Fase 2: esperar selección ────────────────────────────────────────────────
  } else if (session.phase === 'waiting_selection') {
    const n     = parseInt(msg.text.trim(), 10);
    const cands = session.candidates ?? [];
    if (isNaN(n) || n < 1 || n > cands.length + 1) {
      await bot.sendMessage(chatId, `⚠️ Responde con un número del 1 al ${cands.length + 1}.`);
      return;
    }
    const chosen = n <= cands.length ? cands[n - 1] : null;
    await guardar(chatId, session, chosen, session.typedName!);
  }
});

console.log('🤖 JAS Bot iniciado — esperando comprobantes...');
