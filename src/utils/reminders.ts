import { differenceInDays, parseISO } from 'date-fns';

const KEY = 'jas_reminders_sent';

export type ReminderLog = Record<string, string>; // clientId → ISO date sent

export function getReminderLog(): ReminderLog {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function markReminderSent(clientId: string): void {
  const log = getReminderLog();
  log[clientId] = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(log));
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
