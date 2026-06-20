import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
