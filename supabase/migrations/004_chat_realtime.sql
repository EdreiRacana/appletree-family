-- =============================================================================
-- Migration 004 — Chat privado + backfill de public.users
-- =============================================================================
-- El proyecto Supabase de Edrei tiene public.members y public.trees pero
-- NO public.users (el bloque de 001 no corrió completo). Esta migración
-- crea todo lo faltante para que el chat funcione, sin romper nada que
-- ya exista. Idempotente.
-- =============================================================================

-- 1. public.users — perfil extendido enlazado 1:1 con auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE,
  full_name       TEXT,
  avatar_url      TEXT,
  cloudinary_id   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Backfill: cada auth.user que no tenga fila en public.users la recibe.
INSERT INTO public.users (id, email, full_name, avatar_url)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);

-- 3. Trigger para que futuros signups también entren solos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS de public.users — cada quien puede ver su fila + otros usuarios básicos
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users_select_others_basic" ON public.users;
CREATE POLICY "users_select_others_basic"
  ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- 5. message_status enum
DO $$
BEGIN
  CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. chats — 1:1 entre dos usuarios
CREATE TABLE IF NOT EXISTS public.chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (participant_1, participant_2),
  CHECK (participant_1 < participant_2)
);

CREATE INDEX IF NOT EXISTS idx_chats_p1 ON public.chats(participant_1);
CREATE INDEX IF NOT EXISTS idx_chats_p2 ON public.chats(participant_2);
CREATE INDEX IF NOT EXISTS idx_chats_last_msg ON public.chats(last_message_at DESC);

-- 7. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id         UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         TEXT,
  attachment_url  TEXT,
  attachment_type TEXT,
  status          message_status DEFAULT 'sent',
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);

-- 8. RLS de chats/messages
ALTER TABLE public.chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_participants_only" ON public.chats;
CREATE POLICY "chats_participants_only"
  ON public.chats FOR SELECT
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

DROP POLICY IF EXISTS "chats_create" ON public.chats;
CREATE POLICY "chats_create"
  ON public.chats FOR INSERT
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

DROP POLICY IF EXISTS "chats_participants_update" ON public.chats;
CREATE POLICY "chats_participants_update"
  ON public.chats FOR UPDATE
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
CREATE POLICY "messages_participant_read"
  ON public.messages FOR SELECT
  USING (
    chat_id IN (
      SELECT id FROM public.chats
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_sender_insert" ON public.messages;
CREATE POLICY "messages_sender_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND chat_id IN (
      SELECT id FROM public.chats
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_sender_soft_delete" ON public.messages;
CREATE POLICY "messages_sender_soft_delete"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_recipient_mark_read" ON public.messages;
CREATE POLICY "messages_recipient_mark_read"
  ON public.messages FOR UPDATE
  USING (
    sender_id <> auth.uid()
    AND chat_id IN (
      SELECT id FROM public.chats
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

-- 9. Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 10. Sanity — cuántos usuarios y chats/messages hay
SELECT 'users'    AS tabla, COUNT(*) AS filas FROM public.users
UNION ALL
SELECT 'chats',    COUNT(*) FROM public.chats
UNION ALL
SELECT 'messages', COUNT(*) FROM public.messages;
