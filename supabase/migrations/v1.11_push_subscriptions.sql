-- Suscripciones push por dispositivo/navegador
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede gestionar sus propias suscripciones
CREATE POLICY "users_own_subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- El service role puede leer todas (para enviar notificaciones)
CREATE POLICY "service_role_read" ON push_subscriptions
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');
