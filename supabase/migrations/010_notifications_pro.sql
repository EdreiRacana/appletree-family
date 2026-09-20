-- =============================================================================
-- Migration 010 — Sistema de notificaciones persistente + preferencias
-- =============================================================================
-- - Tabla notifications: cada evento genera 1 row inmutable.
-- - Tabla notification_prefs: preferencias por usuario, por tipo, por canal.
-- - Triggers auto-crean notifications al insertar messages/event_comments/wall.
-- - RLS: cada usuario solo ve/modifica lo suyo.
-- =============================================================================


-- 1. TABLA notifications ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id      UUID REFERENCES public.trees(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,            -- 'birthday' | 'event' | 'chat' | 'story_comment' | 'event_comment' | 'wall'
  title        TEXT NOT NULL,
  body         TEXT,
  action       TEXT,                     -- 'open_chat' | 'open_event_thread' | 'open_wall' | 'open_stories' | 'open_events'
  related_id   UUID,                     -- id del objeto (chat_id, activity_id, etc)
  sender_id    UUID,                     -- usuario que dispara la notif (opcional)
  is_important BOOLEAN DEFAULT FALSE,
  seen_at      TIMESTAMPTZ,              -- se marcó cuando el usuario abrió la campana
  read_at      TIMESTAMPTZ,              -- se marcó cuando el usuario hizo clic
  dismissed_at TIMESTAMPTZ,              -- descartada explícitamente
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifs_user_unread
  ON public.notifications (user_id)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs_own_all" ON public.notifications;
CREATE POLICY "notifs_own_all" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 2. TABLA notification_prefs -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birthday_enabled      BOOLEAN DEFAULT TRUE,
  event_enabled         BOOLEAN DEFAULT TRUE,
  chat_enabled          BOOLEAN DEFAULT TRUE,
  story_comment_enabled BOOLEAN DEFAULT TRUE,
  event_comment_enabled BOOLEAN DEFAULT TRUE,
  wall_enabled          BOOLEAN DEFAULT TRUE,
  push_enabled          BOOLEAN DEFAULT FALSE,
  email_digest_enabled  BOOLEAN DEFAULT FALSE,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prefs_own_all" ON public.notification_prefs;
CREATE POLICY "prefs_own_all" ON public.notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 3. TABLA push_subscriptions (para FASE 2) -----------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_own_all" ON public.push_subscriptions;
CREATE POLICY "push_own_all" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- 4. TRIGGER: mensajes de chat --------------------------------------------------
--    Al insertar un mensaje, crear notification para el otro participante.

CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_sender_name TEXT;
  v_preview TEXT;
  v_pref BOOLEAN;
BEGIN
  -- Buscar el otro participante del chat
  SELECT CASE
    WHEN c.participant_1 = NEW.sender_id THEN c.participant_2
    ELSE c.participant_1
  END INTO v_recipient
  FROM public.chats c
  WHERE c.id = NEW.chat_id;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Preferencia (default true si no hay row)
  SELECT COALESCE(chat_enabled, TRUE) INTO v_pref
  FROM public.notification_prefs WHERE user_id = v_recipient;
  IF v_pref IS FALSE THEN RETURN NEW; END IF;

  -- Nombre del sender (via public.users)
  SELECT COALESCE(full_name, email, 'Familiar') INTO v_sender_name
  FROM public.users WHERE id = NEW.sender_id;

  v_preview := LEFT(COALESCE(NEW.content, ''), 60);

  INSERT INTO public.notifications
    (user_id, type, title, body, action, related_id, sender_id)
  VALUES (
    v_recipient, 'chat',
    COALESCE(v_sender_name, 'Familiar'),
    v_preview,
    'open_chat',
    NEW.chat_id,
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_message ON public.messages;
CREATE TRIGGER trg_notify_chat_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_chat_message();


-- 5. TRIGGER: comentarios en eventos ------------------------------------------
--    Notifica a todos los miembros del árbol que tienen chat/event_enabled true,
--    excepto al autor del comentario.

CREATE OR REPLACE FUNCTION public.notify_new_event_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree_id UUID;
  v_title   TEXT;
  r RECORD;
  v_preview TEXT;
BEGIN
  -- Obtener tree_id y título del evento
  SELECT tree_id, title INTO v_tree_id, v_title
  FROM public.activities WHERE id = NEW.activity_id;

  IF v_tree_id IS NULL THEN RETURN NEW; END IF;

  v_preview := LEFT(COALESCE(NEW.content, ''), 60);

  -- Insertar notification para cada miembro con user_id, respetando prefs
  FOR r IN
    SELECT DISTINCT m.user_id
    FROM public.members m
    LEFT JOIN public.notification_prefs np ON np.user_id = m.user_id
    WHERE m.tree_id = v_tree_id
      AND m.user_id IS NOT NULL
      AND m.user_id <> COALESCE(NEW.author_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND COALESCE(np.event_comment_enabled, TRUE) = TRUE
  LOOP
    INSERT INTO public.notifications
      (user_id, tree_id, type, title, body, action, related_id, sender_id)
    VALUES (
      r.user_id, v_tree_id, 'event_comment',
      COALESCE(NEW.author_name, 'Familiar') || ' comentó en ' || COALESCE(v_title, 'Evento'),
      v_preview,
      'open_event_thread',
      NEW.activity_id,
      NEW.author_user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_comment ON public.event_comments;
CREATE TRIGGER trg_notify_event_comment
  AFTER INSERT ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_event_comment();


-- 6. TRIGGER: mensajes del Buzón Familiar -------------------------------------

CREATE OR REPLACE FUNCTION public.notify_new_wall_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_preview TEXT;
BEGIN
  v_preview := LEFT(COALESCE(NEW.content, ''), 60);

  FOR r IN
    SELECT DISTINCT m.user_id
    FROM public.members m
    LEFT JOIN public.notification_prefs np ON np.user_id = m.user_id
    WHERE m.tree_id = NEW.tree_id
      AND m.user_id IS NOT NULL
      AND m.user_id <> COALESCE(NEW.author_user_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND COALESCE(np.wall_enabled, TRUE) = TRUE
  LOOP
    INSERT INTO public.notifications
      (user_id, tree_id, type, title, body, action, related_id, sender_id)
    VALUES (
      r.user_id, NEW.tree_id, 'wall',
      COALESCE(NEW.author_name, 'Familiar') || ' escribió en el Buzón',
      v_preview,
      'open_wall',
      NEW.tree_id,
      NEW.author_user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_wall_message ON public.family_wall_messages;
CREATE TRIGGER trg_notify_wall_message
  AFTER INSERT ON public.family_wall_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_wall_message();


-- 7. Helper para marcar todas leídas / descartar todas / ver contador --------

CREATE OR REPLACE FUNCTION public.notif_mark_all_read()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE user_id = auth.uid()
      AND read_at IS NULL
      AND dismissed_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.notif_mark_all_read() TO authenticated;


CREATE OR REPLACE FUNCTION public.notif_dismiss_all()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.notifications
    SET dismissed_at = NOW()
    WHERE user_id = auth.uid()
      AND dismissed_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.notif_dismiss_all() TO authenticated;


-- 8. Auto-purga: limpiar notifications >90 días y ya leídas/descartadas ------

CREATE OR REPLACE FUNCTION public.notif_purge_old()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND (read_at IS NOT NULL OR dismissed_at IS NOT NULL)
      AND is_important = FALSE
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER FROM deleted;
$$;

-- Se puede llamar manualmente o programar con pg_cron.


-- 9. Realtime: agregar a la publicación para que el frontend reciba INSERTs --

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
