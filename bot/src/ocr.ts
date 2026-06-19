import axios from 'axios';

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

// Modelos Groq con visión, en orden de preferencia
const MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

function parse(text: string): ExtractedPayment | null {
  try {
    const cleaned = text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    const p = JSON.parse(cleaned);
    return {
      amount:     typeof p.amount     === 'number' ? p.amount     : undefined,
      date:       typeof p.date       === 'string' ? p.date       : undefined,
      bank:       typeof p.bank       === 'string' ? p.bank       : undefined,
      reference:  typeof p.reference  === 'string' ? p.reference  : undefined,
      senderName: typeof p.senderName === 'string' ? p.senderName : undefined,
      confidence: (['alta', 'media', 'baja'] as const).includes(p.confidence) ? p.confidence : 'baja',
      notes:      typeof p.notes      === 'string' ? p.notes      : undefined,
    };
  } catch { return null; }
}

async function tryGroqModel(
  imageBase64: string,
  mimeType: string,
  model: string,
  key: string,
): Promise<ExtractedPayment | null> {
  try {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: PROMPT },
          ],
        }],
        max_tokens: 512,
        temperature: 0,
      },
      { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } },
    );
    const raw = data.choices?.[0]?.message?.content ?? '';
    console.log(`[OCR] ${model} →`, raw.slice(0, 120));
    return parse(raw);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`[OCR] ${model} falló:`, err.response?.status, JSON.stringify(err.response?.data));
    } else {
      console.error(`[OCR] ${model} falló:`, err);
    }
    return null;
  }
}

export async function extractPaymentData(
  imageBase64: string,
  mimeType = 'image/jpeg',
): Promise<ExtractedPayment | null> {
  const key = process.env.GROQ_KEY;
  if (!key) { console.error('[OCR] GROQ_KEY no configurado'); return null; }

  for (const model of MODELS) {
    const result = await tryGroqModel(imageBase64, mimeType, model, key);
    if (result) return result;
    console.log(`[OCR] Intentando siguiente modelo...`);
  }

  console.error('[OCR] Todos los modelos fallaron.');
  return null;
}
