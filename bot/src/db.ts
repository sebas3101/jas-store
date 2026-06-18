import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export interface DbClient {
  id:     string;
  name:   string;
  phone?: string;
  status: string;
}

/** Busca clientes por nombre (búsqueda parcial, máx 5 resultados). */
export async function searchClients(query: string): Promise<DbClient[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, status')
    .ilike('name', `%${query}%`)
    .limit(5);
  if (error) { console.error('searchClients:', error); return []; }
  return (data ?? []).map(r => ({
    id:     r.id,
    name:   r.name,
    phone:  r.phone ?? undefined,
    status: r.status,
  }));
}

/** Inserta un comprobante en payment_proofs con estado pendiente_revision. */
export async function savePaymentProof(p: {
  clientId?:   string;
  amount?:     number;
  date?:       string;
  bank?:       string;
  reference?:  string;
  senderName?: string;
  notes?:      string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('payment_proofs')
    .insert({
      client_id:   p.clientId   ?? null,
      amount:      p.amount     ?? null,
      date:        p.date       ?? null,
      bank:        p.bank       ?? null,
      reference:   p.reference  ?? null,
      sender_name: p.senderName ?? null,
      status:      'pendiente_revision',
      notes:       p.notes      ?? null,
      created_at:  new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) { console.error('savePaymentProof:', error); return null; }
  return data?.id ?? null;
}
