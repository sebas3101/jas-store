-- v1.18: URL de imagen de datos de pago/QR en store_settings
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_image_url text;
