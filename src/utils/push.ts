const SB_URL     = import.meta.env.VITE_SUPABASE_URL as string;
const SB_SERVICE = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

export function sendPush(title: string, body: string, url = '/') {
  if (!SB_URL || !SB_SERVICE) return;
  fetch(`${SB_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SB_SERVICE}`,
    },
    body: JSON.stringify({ title, body, url }),
  }).catch(err => console.error('[PUSH]', (err as Error).message));
}
