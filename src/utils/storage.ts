import { supabase } from '../lib/supabase';

/**
 * Sube una imagen a un bucket público de Supabase Storage y devuelve la URL
 * pública (o null si falla). Crea el bucket si no existe.
 */
export async function uploadImage(file: File, bucket: string): Promise<string | null> {
  try {
    await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  } catch {
    return null;
  }
}

/** Borra una imagen del bucket a partir de su URL pública. */
export async function deleteImage(url: string, bucket: string): Promise<void> {
  try {
    const marker = `/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = url.slice(idx + marker.length);
    await supabase.storage.from(bucket).remove([path]);
  } catch { /* ignora errores de borrado */ }
}
