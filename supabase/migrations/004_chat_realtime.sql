-- =============================================================================
-- Migration 004 — Chat: policies faltantes + Realtime
-- =============================================================================
-- Corregir dos huecos en el esquema original:
--   1. El recipiente de un mensaje necesita poder UPDATE read_at/status
--      para marcarlo como leído. La policy previa solo dejaba al sender.
--   2. Realtime en public.messages para que los mensajes lleguen en vivo.
--   3. UPDATE en public.chats para que sendMessage pueda tocar
--      last_message_at.
-- Idempotente: safe re-run.
-- =============================================================================

-- 1. Los participantes pueden marcar como leídos los mensajes del OTRO.
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

-- 2. Cualquier participante del chat puede actualizar last_message_at
--    (usado por sendMessage para el orden de la lista).
DROP POLICY IF EXISTS "chats_participants_update" ON public.chats;
CREATE POLICY "chats_participants_update"
  ON public.chats FOR UPDATE
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- 3. Realtime: agregar tablas a la publicación de Supabase.
--    Si ya están, ALTER PUBLICATION ADD lanza notice, no error.
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
