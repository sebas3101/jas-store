-- Buckets de imágenes (públicos). createBucket() desde el cliente con la llave
-- anon no tiene permisos, así que se crean aquí + políticas de subida/lectura/borrado.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos', 'pedidos', true), ('productos', 'productos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "jas_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "jas_storage_write"  ON storage.objects;
DROP POLICY IF EXISTS "jas_storage_delete" ON storage.objects;

CREATE POLICY "jas_storage_read"   ON storage.objects FOR SELECT
  USING (bucket_id IN ('pedidos', 'productos'));
CREATE POLICY "jas_storage_write"  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('pedidos', 'productos'));
CREATE POLICY "jas_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id IN ('pedidos', 'productos'));
