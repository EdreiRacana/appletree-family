-- =============================================================================
-- Migration 004 — Chat privado: tablas + políticas + Realtime
-- =============================================================================
-- Auto-suficiente: crea chats/messages/message_status si faltan (en Supabase
-- hemos visto casos donde partes de 001 no corrieron completas). Idempotente.
-- =============================================================================

-- 1. Enum de estado del mensaje (si no existe)
DO $$
BEGIN
  CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabla chats — 1:1 privada entre dos usuarios
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

-- 3. Tabla messages
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

-- 4. RLS activado
ALTER TABLE public.chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de chats
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

-- 6. Políticas de messages
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

-- 7. Realtime — habilitar las tablas en la publicación
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

-- 8. Sanity: mostrar que las tablas existen y su conteo de filas
SELECT 'chats'    AS tabla, COUNT(*) AS filas FROM public.chats
UNION ALL
SELECT 'messages' AS tabla, COUNT(*) AS filas FROM public.messages;
