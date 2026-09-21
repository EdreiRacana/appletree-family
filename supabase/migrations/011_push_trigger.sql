-- =============================================================================
-- Migration 011 — Trigger de push: al insertar notification, llama la Edge
-- Function notify-push vía pg_net para enviar el push al celular del usuario.
-- =============================================================================
-- ⚠️  APPROACH RECOMENDADO ACTUALMENTE:
--     En vez de este trigger, usar Supabase Database Webhooks:
--       Dashboard → Database → Webhooks → Create → Table 'notifications',
--       Event Insert, Type Supabase Edge Functions, seleccionar 'notify-push'.
--     Ventaja: no necesita ALTER DATABASE ni Vault; Supabase gestiona el auth.
--
--     Esta migration se conserva por compatibilidad, pero requiere ser
--     superusuario para setear app.settings.* — cosa que Supabase no permite
--     en proyectos gestionados.
-- =============================================================================
-- Requisitos (si usas este trigger en vez del webhook):
--   1. Extension pg_net habilitada (Supabase la trae por defecto).
--   2. Función Edge deployada como 'notify-push'.
--   3. Secrets en la función:
--       - VAPID_PUBLIC_KEY
--       - VAPID_PRIVATE_KEY
--       - VAPID_SUBJECT (opcional; default no-reply@applefamilytree.com)
--   4. Config en Postgres (requiere superuser — NO funciona en Supabase Cloud):
--       ALTER DATABASE postgres SET app.settings.supabase_url = '...';
--       ALTER DATABASE postgres SET app.settings.service_role_key = '...';
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
        'id',           NEW.id,
        'user_id',      NEW.user_id,
        'type',         NEW.type,
        'title',        NEW.title,
        'body',         NEW.body,
        'action',       NEW.action,
        'related_id',   NEW.related_id,
        'is_important', NEW.is_important
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
