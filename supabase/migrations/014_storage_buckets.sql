-- =============================================================================
-- Migration 014 — Buckets de Storage: avatars + chat-attachments
-- =============================================================================
-- Crea los buckets públicos donde se guardan las fotos de perfil de las
-- manzanas y las imágenes adjuntas en el chat.
--
-- Ambos son PÚBLICOS porque:
--   - Los avatares se sirven en URL directa dentro del árbol.
--   - Las URLs de chat son opacas (timestamp + random) y solo se comparten a
--     través de la BD que sí tiene RLS por participante. Un atacante no puede
--     adivinar las URLs.
--
-- Si en el futuro quieres que las imágenes del chat sean privadas de verdad,
-- cambia public=false y sirve URLs firmadas con expiración.
-- =============================================================================

-- 1. BUCKET avatars ----------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  524288,                                    -- 512 KB máx por foto de manzana
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. BUCKET chat-attachments -------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  TRUE,
  2097152,                                   -- 2 MB máx por imagen de chat
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 3. RLS en storage.objects para estos buckets --------------------------------
-- Lectura pública (los buckets son 'public=true' pero también hace falta la
-- policy explícita en algunas versiones de Supabase).

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "chat_attachments_public_read" ON storage.objects;
CREATE POLICY "chat_attachments_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');


-- Escritura: cualquier usuario autenticado puede subir a estos 2 buckets.
-- La lógica de "quién puede subir para qué manzana / qué chat" ya vive en la
-- app (EditMemberModal solo lo abre si canEditMember, ChatPanel solo si
-- hasAccount, etc.). Es defensa en profundidad; si un cliente malicioso subiera
-- un archivo, no puede sobrescribir uno existente (upsert:false en el código).

DROP POLICY IF EXISTS "avatars_authenticated_write" ON storage.objects;
CREATE POLICY "avatars_authenticated_write" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "chat_attachments_authenticated_write" ON storage.objects;
CREATE POLICY "chat_attachments_authenticated_write" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');


-- Borrado: solo el owner del objeto puede borrarlo.
-- storage.objects.owner es el auth.uid() del que subió el archivo.

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "chat_attachments_owner_delete" ON storage.objects;
CREATE POLICY "chat_attachments_owner_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid());
