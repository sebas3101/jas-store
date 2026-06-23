-- v1.15: tabla monthly_goals (migra de localStorage a Supabase)
-- y bucket de storage para comprobantes de pago.

-- ─── Metas mensuales ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_goals (
  id                uuid primary key default gen_random_uuid(),
  month             text not null unique,         -- "YYYY-MM"
  sales_target      numeric not null default 0,
  collection_target numeric not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

-- ─── Bucket de comprobantes de pago ──────────────────────────────────────────
-- La anon key no puede crear buckets, por eso se crean aquí con el service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Actualizar políticas de storage para incluir el bucket comprobantes
DROP POLICY IF EXISTS "jas_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "jas_storage_write"  ON storage.objects;
DROP POLICY IF EXISTS "jas_storage_delete" ON storage.objects;

CREATE POLICY "jas_storage_read"   ON storage.objects FOR SELECT
  USING (bucket_id IN ('pedidos', 'productos', 'comprobantes'));
CREATE POLICY "jas_storage_write"  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('pedidos', 'productos', 'comprobantes'));
CREATE POLICY "jas_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id IN ('pedidos', 'productos', 'comprobantes'));
