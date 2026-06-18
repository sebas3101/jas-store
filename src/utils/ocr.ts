export interface ExtractedPayment {
  amount?:     number;
  date?:       string;
  bank?:       string;
  reference?:  string;
  senderName?: string;
  confidence:  'alta' | 'media' | 'baja';
  notes?:      string;
}

const PROMPT = `Eres un experto en leer comprobantes de pago colombianos (Nequi, Bancolombia, Daviplata, PSE, transferencias, Efecty, etc).

Extrae SOLO los datos visibles en este comprobante. Responde ÚNICAMENTE con un JSON así:
{"amount":150000,"date":"2024-01-15","bank":"Nequi","reference":"123456789","senderName":"Juan Pérez","confidence":"alta","notes":null}

Reglas:
- amount: número entero en pesos colombianos, sin puntos ni comas
- date: formato YYYY-MM-DD (fecha de la transacción, NO la fecha actual)
- bank: nombre del banco o billetera (Nequi, Bancolombia, Daviplata, etc)
- reference: número de referencia, aprobación o transacción
- senderName: nombre completo del remitente (quien envió el dinero)
- confidence: "alta" si todo está claro, "media" si hay dudas, "baja" si el comprobante es ilegible
- notes: observación si algo es dudoso o ambiguo, sino null
Si un campo no es visible, ponlo como null. SOLO el JSON, nada más.`;

function parseResult(text: string): ExtractedPayment | null {
  try {
    const cleaned = text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    return {
      amount:     parsed.amount     ?? undefined,
      date:       parsed.date       ?? undefined,
      bank:       parsed.bank       ?? undefined,
      reference:  parsed.reference  ?? undefined,
      senderName: parsed.senderName ?? undefined,
      confidence: (['alta','media','baja'].includes(parsed.confidence) ? parsed.confidence : 'baja') as ExtractedPayment['confidence'],
      notes:      parsed.notes      ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Extrae datos de un comprobante con Google Gemini (gratis, 1500 req/día). */
async function extractWithGemini(imageBase64: string, mimeType: string): Promise<ExtractedPayment | null> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: PROMPT },
            ],
          }],
          generationConfig: { maxOutputTokens: 512, temperature: 0 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseResult(text);
  } catch {
    return null;
  }
}

/** Extrae datos de un comprobante con Claude API (de pago). */
async function extractWithClaude(imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<ExtractedPayment | null> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_KEY as string | undefined;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseResult(data.content?.[0]?.text ?? '');
  } catch {
    return null;
  }
}

/**
 * Extrae datos de pago de un comprobante.
 * Usa Gemini (gratis) si VITE_GEMINI_KEY está configurada,
 * o Claude si VITE_ANTHROPIC_KEY está configurada.
 */
export async function extractPaymentData(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<ExtractedPayment | null> {
  return (await extractWithGemini(imageBase64, mimeType))
      ?? (await extractWithClaude(imageBase64, mimeType));
}

/** Redimensiona y comprime una imagen a JPEG base64 (sin prefijo data:...). */
export function compressImageToBase64(
  file: File,
  maxPx   = 1280,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w      = Math.round(img.width  * scale);
      const h      = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}
