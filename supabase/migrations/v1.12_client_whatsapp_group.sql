-- Permite que un cliente (p. ej. un revendedor) reciba los mensajes de WhatsApp
-- en un grupo en vez de en su número personal.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS send_to_group       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_group_link text;
