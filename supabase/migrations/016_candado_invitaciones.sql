-- =============================================================================
-- Migration 016 — Candado de invitaciones en la base de datos
-- =============================================================================
-- La función send-invite (versión vieja aún desplegada) inserta invitaciones con
-- service_role sin revisar quién la llama. Este candado vive en la base, así que
-- protege sin importar qué versión de la función esté corriendo:
--   - invited_by debe ser fundador/administrador de ESE árbol.
--   - la manzana (si viene) debe ser de ese árbol y no tener cuenta enlazada.
--   - las invitaciones pendientes que no cumplan esto se vencen.
-- Idempotente.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_invite_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invited_by IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = NEW.tree_id AND user_id = NEW.invited_by AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo un administrador del árbol puede crear invitaciones.';
  END IF;

  IF NEW.member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = NEW.member_id AND tree_id = NEW.tree_id AND user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Esa manzana no es de este árbol o ya tiene una cuenta enlazada.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invite_insert ON public.invites;
CREATE TRIGGER trg_guard_invite_insert
  BEFORE INSERT ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.guard_invite_insert();

-- Invitaciones pendientes ya existentes cuyo autor no es admin: se vencen.
UPDATE public.invites i
SET expires_at = LEAST(i.expires_at, NOW())
WHERE i.accepted_at IS NULL
  AND (i.invited_by IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tree_memberships tm
    WHERE tm.tree_id = i.tree_id AND tm.user_id = i.invited_by AND tm.role IN ('owner', 'admin')
  ));

COMMIT;
