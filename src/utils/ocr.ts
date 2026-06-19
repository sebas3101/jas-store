export interface ExtractedPayment {
  amount?:     number;
  date?:       string;
  bank?:       string;
  reference?:  string;
  senderName?: string;
  confidence:  'alta' | 'media' | 'baja';
  notes?:      string;
}

/**
 * Extrae datos de pago de un comprobante.
 * Llama al Edge Function de Supabase que guarda las API keys de forma segura.
 */
export async function extractPaymentData(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
): Promise<ExtractedPayment | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return null;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ocr-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    if (!parsed) return null;
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

/** Redimensiona y comprime una imagen a JPEG base64 (sin prefijo data:...). */
export function compressImageToBase64(
  file: File,
  maxPx   = 1280,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img     = new Image();
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
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
}
