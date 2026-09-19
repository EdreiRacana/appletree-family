-- =============================================================================
-- Migration 008 — Comentarios de eventos, Buzón familiar, Silenciar
-- =============================================================================
-- Añade 3 sistemas:
--   1. event_comments  → hilo de comentarios en cada evento (activity)
--   2. family_wall_messages → buzón grupal único por árbol (banter cotidiano)
--   3. user_mute_prefs → silenciar notificaciones por evento/buzón/chat
--
-- Todo con RLS + Realtime habilitado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. EVENT COMMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id        UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  author_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name        TEXT NOT NULL,
  author_avatar_url  TEXT,
  content            TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_deleted         BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_comments_activity ON public.event_comments(activity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_comments_author ON public.event_comments(author_user_id);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro registrado del mismo árbol que el evento
DROP POLICY IF EXISTS "event_comments_read" ON public.event_comments;
CREATE POLICY "event_comments_read"
  ON public.event_comments FOR SELECT
  USING (
    activity_id IN (
      SELECT a.id FROM public.activities a
      WHERE a.tree_id IN (
        SELECT tree_id FROM public.members WHERE user_id = auth.uid()
      )
    )
  );

-- Insertar: cualquier miembro registrado del mismo árbol, solo con su propio user_id
DROP POLICY IF EXISTS "event_comments_insert" ON public.event_comments;
CREATE POLICY "event_comments_insert"
  ON public.event_comments FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND activity_id IN (
      SELECT a.id FROM public.activities a
      WHERE a.tree_id IN (
        SELECT tree_id FROM public.members WHERE user_id = auth.uid()
      )
    )
  );

-- Soft-delete: solo el autor
DROP POLICY IF EXISTS "event_comments_update_own" ON public.event_comments;
CREATE POLICY "event_comments_update_own"
  ON public.event_comments FOR UPDATE
  USING (author_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. FAMILY WALL MESSAGES (Buzón familiar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_wall_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id            UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  author_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name        TEXT NOT NULL,
  author_avatar_url  TEXT,
  content            TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  is_deleted         BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_wall_tree ON public.family_wall_messages(tree_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_wall_author ON public.family_wall_messages(author_user_id);

ALTER TABLE public.family_wall_messages ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro registrado del árbol
DROP POLICY IF EXISTS "family_wall_read" ON public.family_wall_messages;
CREATE POLICY "family_wall_read"
  ON public.family_wall_messages FOR SELECT
  USING (
    tree_id IN (SELECT tree_id FROM public.members WHERE user_id = auth.uid())
  );

-- Insertar: solo con propio user_id, en árbol donde eres miembro registrado
DROP POLICY IF EXISTS "family_wall_insert" ON public.family_wall_messages;
CREATE POLICY "family_wall_insert"
  ON public.family_wall_messages FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND tree_id IN (SELECT tree_id FROM public.members WHERE user_id = auth.uid())
  );

-- Soft-delete: solo el autor
DROP POLICY IF EXISTS "family_wall_update_own" ON public.family_wall_messages;
CREATE POLICY "family_wall_update_own"
  ON public.family_wall_messages FOR UPDATE
  USING (author_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. MUTE PREFERENCES (silenciar notificaciones)
-- ---------------------------------------------------------------------------
-- subject_type indica de qué se está silenciando:
--   'event'  → subject_id = activity_id  (ese evento en particular)
--   'wall'   → subject_id = tree_id      (buzón familiar)
--   'chat'   → subject_id = chat_id      (conversación 1:1)
CREATE TABLE IF NOT EXISTS public.user_mute_prefs (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('event', 'wall', 'chat')),
  subject_id   UUID NOT NULL,
  muted_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_mute_prefs_user ON public.user_mute_prefs(user_id);

ALTER TABLE public.user_mute_prefs ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve/gestiona SOLO sus propias preferencias
DROP POLICY IF EXISTS "mute_prefs_own_read" ON public.user_mute_prefs;
CREATE POLICY "mute_prefs_own_read"
  ON public.user_mute_prefs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mute_prefs_own_insert" ON public.user_mute_prefs;
CREATE POLICY "mute_prefs_own_insert"
  ON public.user_mute_prefs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mute_prefs_own_delete" ON public.user_mute_prefs;
CREATE POLICY "mute_prefs_own_delete"
  ON public.user_mute_prefs FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. REALTIME — habilitar las 3 tablas
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.family_wall_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------------------------------------------------------------------------
-- Sanity check
-- ---------------------------------------------------------------------------
SELECT 'event_comments' AS tabla, COUNT(*) AS filas FROM public.event_comments
UNION ALL SELECT 'family_wall_messages', COUNT(*) FROM public.family_wall_messages
UNION ALL SELECT 'user_mute_prefs', COUNT(*) FROM public.user_mute_prefs;
