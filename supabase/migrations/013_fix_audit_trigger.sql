-- =============================================================================
-- Migration 013 — Reemplaza el trigger de audit con versión jsonb-based
-- =============================================================================
-- El trigger de migration 012 listaba columnas específicas (nationality,
-- birth_place, etc.) y falla si alguna no existe en la BD. Esta versión usa
-- to_jsonb(NEW) / to_jsonb(OLD) y compara automáticamente, sin importar qué
-- columnas tenga la tabla.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_old_val text;
  v_new_val text;
  -- Columnas técnicas/derivadas que NO auditamos (ruido)
  v_ignored text[] := ARRAY['id', 'created_at', 'updated_at', 'is_baby', 'is_deceased', 'canvas_x', 'canvas_y'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.member_history (member_id, tree_id, changed_by, action)
    VALUES (NEW.id, NEW.tree_id, auth.uid(), 'insert');
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.member_history (member_id, tree_id, changed_by, action)
    VALUES (OLD.id, OLD.tree_id, auth.uid(), 'delete');
    RETURN OLD;

  ELSE  -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    -- Recorre cada campo del row nuevo. Si cambió respecto al viejo y no está
    -- en la lista ignorada, registra un renglón de historial.
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY (v_ignored) THEN CONTINUE; END IF;

      v_old_val := v_old ->> v_key;
      v_new_val := v_new ->> v_key;

      IF v_old_val IS DISTINCT FROM v_new_val THEN
        INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
        VALUES (
          NEW.id,
          NEW.tree_id,
          auth.uid(),
          'update',
          v_key,
          -- Truncamos avatares base64 (muy largos) para no llenar el log
          CASE WHEN v_key = 'avatar_url' AND v_old_val IS NOT NULL THEN '(imagen anterior)' ELSE v_old_val END,
          CASE WHEN v_key = 'avatar_url' AND v_new_val IS NOT NULL THEN '(imagen nueva)'    ELSE v_new_val END
        );
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;
END;
$$;
