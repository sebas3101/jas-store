import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws } as any,
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

/** Verifica duplicado por referencia exacta (no rechazado). */
export async function checkDuplicateByRef(reference: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('id')
    .eq('reference', reference)
    .neq('status', 'rechazado')
    .limit(1);
  if (error) { console.error('checkDuplicateByRef:', error); return false; }
  return (data?.length ?? 0) > 0;
}

/**
 * Detecta duplicado por monto + fecha cuando no hay referencia disponible.
 * Busca comprobantes del mismo monto en las últimas 24 h.
 */
export async function checkDuplicateByAmount(amount: number, date?: string): Promise<boolean> {
  // Ventana de ±24 h alrededor de la fecha del comprobante (o las últimas 24 h si no hay fecha)
  const base = date ? new Date(date) : new Date();
  const from = new Date(base); from.setHours(0, 0, 0, 0);
  const to   = new Date(base); to.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('payment_proofs')
    .select('id')
    .eq('amount', amount)
    .gte('date', from.toISOString().slice(0, 10))
    .lte('date', to.toISOString().slice(0, 10))
    .neq('status', 'rechazado')
    .limit(1);
  if (error) { console.error('checkDuplicateByAmount:', error); return false; }
  return (data?.length ?? 0) > 0;
}

export interface DailySummary {
  activeOrders:     { tomado: number; por_recoger: number; recogido: number };
  staleOrders:      Array<{ orderNumber: string; clientName: string; status: string; days: number }>;
  pendingProofs:    number;
  yesterdayPayments:{ total: number; count: number };
  clientsInMora:    number;
}

export async function getDailySummary(): Promise<DailySummary> {
  const now       = new Date();
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const [ordersRes, staleRes, proofsRes, paymentsRes, moraRes] = await Promise.all([
    supabase.from('orders').select('status').not('status', 'in', '("cancelado","pagado")'),
    supabase.from('orders')
      .select('order_number, status, order_date, clients(name)')
      .in('status', ['tomado', 'por_recoger'])
      .lt('order_date', sevenDaysAgoStr)
      .order('order_date', { ascending: true })
      .limit(5),
    supabase.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('status', 'pendiente_revision'),
    supabase.from('payments').select('amount').eq('date', yesterdayStr),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'mora'),
  ]);

  const active = { tomado: 0, por_recoger: 0, recogido: 0 };
  for (const o of ordersRes.data ?? []) {
    if (o.status === 'tomado')      active.tomado++;
    else if (o.status === 'por_recoger') active.por_recoger++;
    else if (o.status === 'recogido')    active.recogido++;
  }

  const staleOrders = (staleRes.data ?? []).map((o: any) => ({
    orderNumber: o.order_number ?? '',
    clientName:  o.clients?.name ?? 'Sin cliente',
    status:      o.status,
    days:        Math.floor((now.getTime() - new Date(o.order_date).getTime()) / 86_400_000),
  }));

  const payments    = paymentsRes.data ?? [];
  const totalPaid   = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  return {
    activeOrders:      active,
    staleOrders,
    pendingProofs:     proofsRes.count ?? 0,
    yesterdayPayments: { total: totalPaid, count: payments.length },
    clientsInMora:     moraRes.count ?? 0,
  };
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
    })
    .select('id')
    .single();
  if (error) { console.error('savePaymentProof:', error); return null; }
  return data?.id ?? null;
}
