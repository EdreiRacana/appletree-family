-- =============================================================================
-- Migration 019 — Álbumes y fotos de la familia
-- =============================================================================
-- El módulo de Fotos usaba tablas `albums` y `photos` que no existían en
-- producción (y guardaba las fotos solo en el navegador de quien subía).
-- Reglas:
--   - Ver: cualquier miembro del árbol.
--   - Crear álbum / subir foto: cualquier miembro del árbol.
--   - Renombrar o borrar: quien lo creó, o un administrador del árbol.
--   - Archivos en storage: family-photos/<tree_id>/<album_id>/<archivo>;
--     el admin del árbol también puede borrar archivos de su árbol.
-- Requiere 015 (is_tree_member). Idempotente.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.albums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  cover_url       TEXT,
  created_by      UUID NOT NULL DEFAULT auth.uid(),
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_albums_tree ON public.albums (tree_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id         UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  tree_id          UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  storage_path     TEXT,
  caption          TEXT CHECK (caption IS NULL OR length(caption) <= 500),
  uploaded_by      UUID NOT NULL DEFAULT auth.uid(),
  uploaded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photos_album ON public.photos (album_id, created_at);

-- Una foto debe ser del mismo árbol que su álbum.
CREATE OR REPLACE FUNCTION public.guard_photo_tree()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.albums a WHERE a.id = NEW.album_id AND a.tree_id = NEW.tree_id) THEN
    RAISE EXCEPTION 'La foto no corresponde al árbol del álbum.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_photo_tree ON public.photos;
CREATE TRIGGER trg_guard_photo_tree BEFORE INSERT OR UPDATE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.guard_photo_tree();

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "albums_read"   ON public.albums;
DROP POLICY IF EXISTS "albums_insert" ON public.albums;
DROP POLICY IF EXISTS "albums_update" ON public.albums;
DROP POLICY IF EXISTS "albums_delete" ON public.albums;
CREATE POLICY "albums_read" ON public.albums FOR SELECT TO authenticated
  USING (public.is_tree_member(tree_id));
CREATE POLICY "albums_insert" ON public.albums FOR INSERT TO authenticated
  WITH CHECK (public.is_tree_member(tree_id) AND created_by = auth.uid());
CREATE POLICY "albums_update" ON public.albums FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_member(tree_id));
CREATE POLICY "albums_delete" ON public.albums FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_tree_admin(tree_id));

DROP POLICY IF EXISTS "photos_read"   ON public.photos;
DROP POLICY IF EXISTS "photos_insert" ON public.photos;
DROP POLICY IF EXISTS "photos_update" ON public.photos;
DROP POLICY IF EXISTS "photos_delete" ON public.photos;
CREATE POLICY "photos_read" ON public.photos FOR SELECT TO authenticated
  USING (public.is_tree_member(tree_id));
CREATE POLICY "photos_insert" ON public.photos FOR INSERT TO authenticated
  WITH CHECK (public.is_tree_member(tree_id) AND uploaded_by = auth.uid());
CREATE POLICY "photos_update" ON public.photos FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_member(tree_id));
CREATE POLICY "photos_delete" ON public.photos FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_tree_admin(tree_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.albums, public.photos TO authenticated;
REVOKE ALL ON public.albums, public.photos FROM anon;

-- Storage: el admin del árbol puede borrar archivos de su árbol
-- (la carpeta raíz del archivo es el tree_id).
DROP POLICY IF EXISTS "family_photos_admin_delete" ON storage.objects;
CREATE POLICY "family_photos_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.is_tree_admin(((storage.foldername(name))[1])::uuid)
  );

COMMIT;
