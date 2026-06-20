import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

export type ReminderLog = Record<string, string>; // clientId → ISO date sent

export async function getReminderLog(): Promise<ReminderLog> {
  const { data, error } = await supabase
    .from('reminder_logs')
    .select('client_id, sent_at');
  if (error) {
    console.error('getReminderLog:', error);
    // Fallback a localStorage si Supabase falla
    try { return JSON.parse(localStorage.getItem('jas_reminders_sent') ?? '{}'); } catch { return {}; }
  }
  return Object.fromEntries((data ?? []).map(r => [r.client_id, r.sent_at]));
}

export async function markReminderSent(clientId: string): Promise<void> {
  const sentAt = new Date().toISOString();
  const { error } = await supabase
    .from('reminder_logs')
    .upsert({ client_id: clientId, sent_at: sentAt }, { onConflict: 'client_id' });
  if (error) {
    console.error('markReminderSent:', error);
    // Fallback a localStorage si Supabase falla
    try {
      const log = JSON.parse(localStorage.getItem('jas_reminders_sent') ?? '{}');
      log[clientId] = sentAt;
      localStorage.setItem('jas_reminders_sent', JSON.stringify(log));
    } catch { /* ignore */ }
  }
}

export function daysSinceReminder(clientId: string, log: ReminderLog): number | null {
  const date = log[clientId];
  if (!date) return null;
  try {
    return differenceInDays(new Date(), parseISO(date));
  } catch {
    return null;
  }
}
