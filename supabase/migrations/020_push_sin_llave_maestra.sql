-- =============================================================================
-- Migration 020 — Notificaciones push sin la llave maestra escrita en la base
-- =============================================================================
-- La función dispatch_push_on_notif tenía la llave service_role (vieja) escrita
-- en su código. Ahora usa un secreto propio guardado en Supabase Vault
-- ('push_webhook_secret') y la función notify-push solo acepta llamadas que
-- traigan ese secreto en el encabezado x-push-secret.
--
-- Al final muestra el valor del secreto: cópialo en
-- Edge Functions → Secrets → PUSH_WEBHOOK_SECRET.
-- Idempotente (si el secreto ya existe, no lo cambia).
-- =============================================================================

-- 1. Secreto compartido en Vault (aleatorio, 64 caracteres)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_webhook_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'push_webhook_secret',
      'Secreto compartido: trigger de notificaciones → función notify-push'
    );
  END IF;
END $$;

-- 2. Trigger que pide el push: manda solo el id de la notificación + el secreto
CREATE OR REPLACE FUNCTION public.dispatch_push_on_notif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://efsgxflltatbrbdvicxn.supabase.co/functions/v1/notify-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('notification', jsonb_build_object('id', NEW.id))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- un push fallido nunca bloquea la notificación
END;
$function$;

-- 3. Había un segundo disparador (webhook viejo) que mandaba el mismo push con
--    la llave vieja: se quita para no enviar dos veces.
DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;

-- 4. Valor del secreto para copiarlo en Edge Functions → Secrets
SELECT decrypted_secret AS copia_esto_en_PUSH_WEBHOOK_SECRET
FROM vault.decrypted_secrets
WHERE name = 'push_webhook_secret';
