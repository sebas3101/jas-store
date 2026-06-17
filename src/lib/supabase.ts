import { createClient } from '@supabase/supabase-js';

const url        = import.meta.env.VITE_SUPABASE_URL         as string;
const key        = import.meta.env.VITE_SUPABASE_ANON_KEY    as string;
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

if (!url || !key) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

export const supabase      = createClient(url, key);
export const supabaseAdmin = createClient(url, serviceKey || key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Helpers de conversión snake_case ↔ camelCase ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** DB → App: convierte claves snake_case a camelCase */
export function toCamel(row: Row): Row {
  const out: Row = {};
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = row[key];
  }
  return out;
}

/** App → DB: convierte claves camelCase a snake_case */
export function toSnake(obj: Row): Row {
  const out: Row = {};
  for (const key of Object.keys(obj)) {
    const snake = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    out[snake] = obj[key];
  }
  return out;
}
