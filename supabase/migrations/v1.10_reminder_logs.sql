-- Historial de recordatorios de cobro
-- Reemplaza el localStorage por persistencia en BD (sincroniza entre dispositivos)
CREATE TABLE IF NOT EXISTS reminder_logs (
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id)
);

-- Cualquier usuario autenticado puede leer y escribir
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"  ON reminder_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth write" ON reminder_logs FOR ALL    USING (auth.role() = 'authenticated');
