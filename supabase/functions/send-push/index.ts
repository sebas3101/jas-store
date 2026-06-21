// Supabase Edge Function — envía notificaciones push Web Push (VAPID)
// Variables requeridas (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')        ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')       ?? '';
const SB_URL        = Deno.env.get('SUPABASE_URL')             ?? '';
const SB_SERVICE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:sebascastaeda31@icloud.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Require service-role key as Bearer token
  const auth = req.headers.get('Authorization') ?? '';
  if (!SB_SERVICE || auth !== `Bearer ${SB_SERVICE}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { title, body, url } = await req.json() as { title: string; body: string; url?: string };

  const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/' });

  const results = await Promise.allSettled(
    subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
      } catch (err: unknown) {
        // 410 Gone: suscripción expirada — limpiar
        if ((err as { statusCode?: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
        throw err;
      }
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  return new Response(JSON.stringify({ sent, total: subs.length }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
