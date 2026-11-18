-- =============================================================================
-- Migration 017 — Sugerencias de cambios para el administrador
-- =============================================================================
-- Un familiar que no puede editar una manzana (o quiere agregar padres,
-- hermanos o alguien que falta) manda una sugerencia. Los administradores
-- del árbol la ven en su bandeja y la marcan como hecha o rechazada.
-- Notifica a los administradores al llegar y al autor al resolverse.
-- Requiere 015. Idempotente.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.member_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id      UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES public.members(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL DEFAULT 'edit'
               CHECK (kind IN ('edit', 'new_relative', 'other')),
  message      TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 3 AND 2000),
  created_by   UUID NOT NULL DEFAULT auth.uid(),
  author_name  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'done', 'rejected')),
  reviewed_by  UUID,
  reviewed_at  TIMESTAMPTZ,
  review_note  TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_suggestions_tree_status
  ON public.member_suggestions (tree_id, status, created_at DESC);

ALTER TABLE public.member_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suggestions_insert_member" ON public.member_suggestions;
DROP POLICY IF EXISTS "suggestions_read"          ON public.member_suggestions;
DROP POLICY IF EXISTS "suggestions_admin_update"  ON public.member_suggestions;
DROP POLICY IF EXISTS "suggestions_delete"        ON public.member_suggestions;

CREATE POLICY "suggestions_insert_member" ON public.member_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tree_member(tree_id)
    AND created_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND (member_id IS NULL OR EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = member_id AND m.tree_id = member_suggestions.tree_id))
  );

CREATE POLICY "suggestions_read" ON public.member_suggestions FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_tree_admin(tree_id));

CREATE POLICY "suggestions_admin_update" ON public.member_suggestions FOR UPDATE TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

-- El autor puede retirar su sugerencia mientras esté pendiente; el admin, cualquiera.
CREATE POLICY "suggestions_delete" ON public.member_suggestions FOR DELETE TO authenticated
  USING ((created_by = auth.uid() AND status = 'pending') OR public.is_tree_admin(tree_id));

-- Solo admins cambian estado/revisión; el autor no puede tocar campos de revisión
-- ni mover la sugerencia a otro árbol.
CREATE OR REPLACE FUNCTION public.guard_suggestion_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tree_id IS DISTINCT FROM OLD.tree_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'No se puede cambiar el árbol ni el autor de una sugerencia.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_suggestion_update ON public.member_suggestions;
CREATE TRIGGER trg_guard_suggestion_update
  BEFORE UPDATE ON public.member_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.guard_suggestion_update();

-- Notificaciones: a los admins cuando llega; al autor cuando se resuelve.
CREATE OR REPLACE FUNCTION public.notify_suggestion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member TEXT;
BEGIN
  SELECT trim(first_name || ' ' || last_name) INTO v_member FROM public.members WHERE id = NEW.member_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, tree_id, type, title, body, action, related_id, sender_id, is_important)
    SELECT tm.user_id, NEW.tree_id, 'suggestion',
           'Nueva sugerencia' || COALESCE(' sobre ' || v_member, ''),
           left(COALESCE(NEW.author_name || ': ', '') || NEW.message, 200),
           'open_suggestions', NEW.id, NEW.created_by, TRUE
    FROM public.tree_memberships tm
    WHERE tm.tree_id = NEW.tree_id AND tm.role IN ('owner', 'admin') AND tm.user_id <> NEW.created_by;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('done', 'rejected') THEN
    INSERT INTO public.notifications (user_id, tree_id, type, title, body, action, related_id, sender_id)
    VALUES (NEW.created_by, NEW.tree_id, 'suggestion_reviewed',
            CASE WHEN NEW.status = 'done' THEN 'Se aplicó tu sugerencia' ELSE 'Revisaron tu sugerencia' END,
            left(COALESCE(NEW.review_note, NEW.message), 200),
            'open_suggestions', NEW.id, auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- una notificación fallida nunca bloquea la sugerencia
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_suggestion ON public.member_suggestions;
CREATE TRIGGER trg_notify_suggestion
  AFTER INSERT OR UPDATE ON public.member_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.notify_suggestion();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_suggestions TO authenticated;
REVOKE ALL ON public.member_suggestions FROM anon;

COMMIT;
