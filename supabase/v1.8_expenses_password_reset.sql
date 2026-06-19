-- =====================================================================
-- JAS Store — Migración v1.8
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- 1. Campo para forzar cambio de contraseña en próximo inicio de sesión
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabla de gastos operativos
CREATE TABLE IF NOT EXISTS expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL,
  type            TEXT NOT NULL DEFAULT 'otro',
  description     TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  responsible     TEXT,
  payment_method  TEXT NOT NULL DEFAULT 'efectivo',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_expenses" ON expenses
  FOR ALL TO anon USING (true) WITH CHECK (true);
