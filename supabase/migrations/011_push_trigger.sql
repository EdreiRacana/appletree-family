-- =============================================================================
-- Migration 011 — Trigger de push: al insertar notification, llama la Edge
-- Function notify-push vía pg_net para enviar el push al celular del usuario.
-- =============================================================================
-- Requisitos:
--   1. Extension pg_net habilitada (Supabase la trae por defecto).
--   2. Función Edge deployada como 'notify-push'.
--   3. Secrets en la función:
--       - VAPID_PUBLIC_KEY
--       - VAPID_PRIVATE_KEY
--       - VAPID_SUBJECT (opcional; default no-reply@applefamilytree.com)
--   4. Config en Postgres (una vez, desde SQL Editor):
--       SELECT set_config('app.settings.supabase_url', '<TU_SUPABASE_URL>', false);
--       SELECT set_config('app.settings.service_role_key', '<TU_SERVICE_ROLE_KEY>', false);
--     — o mejor: setear vía SUPABASE Dashboard → Database → Custom parameters.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;


CREATE OR REPLACE FUNCTION public.dispatch_push_on_notif()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url  TEXT;
  v_key  TEXT;
BEGIN
  -- Leemos config del proyecto. Si no está seteada, salimos silencioso.
  BEGIN
    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL; v_key := NULL;
  END;

  IF v_url IS NULL OR v_key IS NULL OR v_url = '' OR v_key = '' THEN
    RETURN NEW;   -- Config faltante → no rompemos el INSERT
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/notify-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'notification', jsonb_build_object(
        'id',         NEW.id,
        'user_id',    NEW.user_id,
        'type',       NEW.type,
        'title',      NEW.title,
        'body',       NEW.body,
        'action',     NEW.action,
        'related_id', NEW.related_id
      )
    )
  );

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_dispatch_push_on_notif ON public.notifications;
CREATE TRIGGER trg_dispatch_push_on_notif
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_notif();
