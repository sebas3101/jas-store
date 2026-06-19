import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import sharp from 'sharp';
import 'dotenv/config';
import { extractPaymentData, type ExtractedPayment } from './ocr';
import { searchClients, savePaymentProof, type DbClient } from './db';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN no configurado en .env');

const bot = new TelegramBot(TOKEN, { polling: true });

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

async function downloadBase64(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const file = await bot.getFile(fileId);
  const url  = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
  const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
  // Convertir siempre a JPEG: normaliza WebP (WhatsApp), PNG y otros formatos
  const jpegBuffer = await sharp(Buffer.from(data)).jpeg({ quality: 85 }).toBuffer();
  console.log(`[IMG] ${file.file_path} → JPEG ${Math.round(jpegBuffer.length / 1024)}KB`);
  return { base64: jpegBuffer.toString('base64'), mimeType: 'image/jpeg' };
}

function buildResumen(ocr: ExtractedPayment | null, nombre: string, vinculado: boolean): string {
  const lines: string[] = ['✅ *Comprobante registrado*\n'];
  if (vinculado) lines.push(`👤 Cliente: *${nombre}*`);
  else           lines.push(`👤 Nombre: ${nombre} _(pendiente de vincular)_`);
  if (ocr?.amount)    lines.push(`💰 Monto: *${ocr.amount.toLocaleString('es-CO')} COP*`);
  if (ocr?.date)      lines.push(`📅 Fecha: ${ocr.date}`);
  if (ocr?.bank)      lines.push(`🏦 Banco: ${ocr.bank}`);
  if (ocr?.reference) lines.push(`🔐 Referencia: ${ocr.reference}`);
  lines.push(`📊 Confianza OCR: *${ocr?.confidence ?? 'sin datos'}*`);
  if (!ocr || ocr.confidence === 'baja')
    lines.push(`\n⚠️ Imagen difícil de leer — revisa los datos en el dashboard.`);
  lines.push(`\nEstado: _pendiente de confirmación_ en el dashboard.`);
  return lines.join('\n');
}

async function guardar(chatId: number, session: Session, client: DbClient | null, nombre: string) {
  sessions.delete(chatId);
  const ocr = await session.ocrPromise;
  const id  = await savePaymentProof({
    clientId:   client?.id,
    amount:     ocr?.amount,
    date:       ocr?.date,
    bank:       ocr?.bank,
    reference:  ocr?.reference,
    senderName: client?.name ?? nombre,
    notes:      ocr?.notes,
  });
  if (!id) {
    await bot.sendMessage(chatId, '❌ Error al guardar en la base de datos. Intenta de nuevo o contacta al admin.');
    return;
  }
  await bot.sendMessage(chatId, buildResumen(ocr, client?.name ?? nombre, !!client), { parse_mode: 'Markdown' });
}

// ─── Comandos ──────────────────────────────────────────────────────────────────

bot.onText(/\/start/, msg => {
  bot.sendMessage(
    msg.chat.id,
    '👋 Hola, soy el bot de pagos de *JAS Store*.\n\n' +
    'Envíame la foto de un comprobante de pago y lo registro automáticamente.\n\n' +
    '• /cancelar — cancela la operación actual',
    { parse_mode: 'Markdown' },
  );
});

bot.onText(/\/cancelar/, msg => {
  sessions.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, '❌ Operación cancelada.');
});

bot.onText(/\/sin_cliente/, async msg => {
  const chatId  = msg.chat.id;
  const session = sessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, '⚠️ No hay ninguna operación activa.');
    return;
  }
  await guardar(chatId, session, null, session.typedName ?? 'Sin nombre');
});

// ─── Recepción de imagen ───────────────────────────────────────────────────────

async function iniciarSesion(chatId: number, fileId: string, isDocument = false) {
  sessions.delete(chatId);
  try {
    await bot.sendMessage(chatId, '📥 Recibiendo comprobante...');
    const { base64, mimeType } = await downloadBase64(fileId);
    sessions.set(chatId, {
      phase:      'waiting_name',
      imageBase64: base64,
      mimeType,
      ocrPromise:  extractPaymentData(base64, mimeType), // OCR arranca en paralelo al preguntar el nombre
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
  const best = msg.photo![msg.photo!.length - 1]; // mayor resolución
  iniciarSesion(msg.chat.id, best.file_id);
});

bot.on('document', async msg => {
  const doc = msg.document!;
  if (!doc.mime_type?.startsWith('image/')) {
    await bot.sendMessage(msg.chat.id, '⚠️ Solo acepto imágenes de comprobantes.');
    return;
  }
  iniciarSesion(msg.chat.id, doc.file_id, true);
});

// ─── Recepción de texto ────────────────────────────────────────────────────────

bot.on('message', async msg => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId  = msg.chat.id;
  const session = sessions.get(chatId);

  if (!session) {
    await bot.sendMessage(chatId, '📸 Envíame primero la foto de un comprobante de pago.');
    return;
  }

  session.ts = Date.now(); // renovar timeout

  // ── Fase 1: esperar nombre del cliente ──────────────────────────────────────
  if (session.phase === 'waiting_name') {
    const nombre = msg.text.trim();
    if (!nombre) {
      await bot.sendMessage(chatId, '⚠️ Escribe el nombre del cliente.');
      return;
    }
    session.typedName = nombre; // guardar siempre por si se usa /sin_cliente
    await bot.sendMessage(chatId, '🔍 Buscando cliente...');
    const clients = await searchClients(nombre);

    if (clients.length === 0) {
      // Sin coincidencias → NO guardar, pedir que reintente
      await bot.sendMessage(
        chatId,
        `⚠️ No encontré ningún cliente con el nombre *"${nombre}"*\\.\n\nIntenta con otro nombre o un apellido diferente\\.\n\n• /sin\\_cliente — guardar sin vincular de todas formas\n• /cancelar — cancelar`,
        { parse_mode: 'MarkdownV2' },
      );
      return; // sesión sigue activa en waiting_name
    } else {
      // 1 o más coincidencias → siempre mostrar lista para que el usuario confirme
      session.phase      = 'waiting_selection';
      session.candidates = clients;
      const list = clients.map((c, i) =>
        `${i + 1}. ${c.name}${c.phone ? ` — ${c.phone}` : ''}`
      ).join('\n');
      await bot.sendMessage(
        chatId,
        `Encontré ${clients.length} cliente${clients.length > 1 ? 's' : ''}:\n\n${list}\n${clients.length + 1}. Ninguno de estos (guardar sin vincular)\n\nResponde con el número:`,
      );
    }

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
