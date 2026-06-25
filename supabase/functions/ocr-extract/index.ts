import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `Eres un experto en leer comprobantes de pago colombianos (Nequi, Bancolombia, Daviplata, PSE, transferencias, Efecty, etc).

La imagen puede estar comprimida o pixelada (foto de WhatsApp reenviada a Telegram). Haz tu mejor esfuerzo para extraer los datos aunque la imagen no sea perfecta.

Extrae SOLO los datos visibles en este comprobante. Responde ÚNICAMENTE con un JSON así:
{"amount":150000,"date":"2024-01-15","bank":"Nequi","reference":"123456789","senderName":"Juan Pérez","confidence":"alta","notes":null}

Reglas:
- amount: número entero en pesos colombianos, sin puntos ni comas. En Nequi Android el monto aparece grande en la pantalla de confirmación (ej: "$150.000" o "150.000"). Busca el número más prominente de la pantalla. Si hay un monto parcialmente legible, intenta inferirlo.
- date: formato YYYY-MM-DD (fecha de la transacción, NO la fecha actual)
- bank: nombre del banco o billetera. Si ves el logo o color verde/morado de Nequi, pon "Nequi". Si ves Bancolombia, pon "Bancolombia".
- reference: número de referencia, aprobación, código de transacción o número largo. En Nequi suele aparecer como "# XXXX" o "Número de transacción".
- senderName: nombre completo del remitente (quien envió el dinero)
- confidence: "alta" si ves el monto claro, "media" si hay algo borroso pero el monto es legible, "baja" si no puedes leer el monto
- notes: si la imagen está comprimida o hay campos que no puedes leer con certeza, mencionarlo aquí. Sino null.
Si un campo no es visible, ponlo como null. SOLO el JSON, nada más.`;

function parseResult(text: string) {
  try {
    const cleaned = text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function extractWithClaude(imageBase64: string, mimeType: string): Promise<{ result: unknown; error?: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_KEY');
  if (!apiKey) return { result: null, error: 'ANTHROPIC_KEY no configurada' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
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
    if (!res.ok) {
      const body = await res.text();
      return { result: null, error: `Claude HTTP ${res.status}: ${body}` };
    }
    const data = await res.json();
    return { result: parseResult(data.content?.[0]?.text ?? '') };
  } catch (e) {
    return { result: null, error: `Claude exception: ${e}` };
  }
}

async function extractWithGroq(imageBase64: string, mimeType: string): Promise<{ result: unknown; error?: string }> {
  const apiKey = Deno.env.get('GROQ_KEY');
  if (!apiKey) return { result: null, error: 'GROQ_KEY no configurada' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: PROMPT },
          ],
        }],
        max_tokens: 512,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { result: null, error: `Groq HTTP ${res.status}: ${body}` };
    }
    const data = await res.json();
    return { result: parseResult(data.choices?.[0]?.message?.content ?? '') };
  } catch (e) {
    return { result: null, error: `Groq exception: ${e}` };
  }
}

async function extractWithGemini(imageBase64: string, mimeType: string): Promise<{ result: unknown; error?: string }> {
  const apiKey = Deno.env.get('GEMINI_KEY');
  if (!apiKey) return { result: null, error: 'GEMINI_KEY no configurada' };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: PROMPT }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0 },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { result: null, error: `Gemini HTTP ${res.status}: ${body}` };
    }
    const data = await res.json();
    return { result: parseResult(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '') };
  } catch (e) {
    return { result: null, error: `Gemini exception: ${e}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'imageBase64 y mimeType son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const errors: string[] = [];

    // Claude primero (más confiable para visión)
    const claude = await extractWithClaude(imageBase64, mimeType);
    if (claude.result) {
      return new Response(JSON.stringify(claude.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (claude.error) errors.push(claude.error);

    // Groq como segundo intento
    const groq = await extractWithGroq(imageBase64, mimeType);
    if (groq.result) {
      return new Response(JSON.stringify(groq.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (groq.error) errors.push(groq.error);

    // Gemini como último fallback
    const gemini = await extractWithGemini(imageBase64, mimeType);
    if (gemini.result) {
      return new Response(JSON.stringify(gemini.result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (gemini.error) errors.push(gemini.error);

    // Todos fallaron — devolver errores para diagnóstico
    return new Response(JSON.stringify({ error: 'Todos los proveedores fallaron', details: errors }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
