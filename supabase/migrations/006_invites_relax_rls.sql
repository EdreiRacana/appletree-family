-- =============================================================================
-- Migration 006 — RLS de invites: cualquier miembro registrado puede invitar
-- =============================================================================
-- La policy actual (003) exige que seas OWNER del árbol. Pero un usuario
-- puede estar cargado en un árbol donde es miembro registrado (via
-- member.user_id) sin ser el owner original. Esa persona también debe
-- poder mandar invitaciones a más familiares.
--
-- Además blindamos contra el bug reportado por el usuario:
--   "new row violates row-level security policy for table invites"
-- que sucede cuando el owner_id del tree quedó desincronizado del auth.uid
-- (típico después de recrear cuentas o cambiar correos).
-- =============================================================================

DROP POLICY IF EXISTS "invites_insert_owner" ON public.invites;
CREATE POLICY "invites_insert_family"
  ON public.invites FOR INSERT
  WITH CHECK (
    -- Owner del árbol
    EXISTS (
      SELECT 1 FROM public.trees
      WHERE trees.id = tree_id AND trees.owner_id = auth.uid()
    )
    OR
    -- O cualquier miembro registrado del mismo árbol
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.tree_id = invites.tree_id
        AND members.user_id = auth.uid()
    )
  );

-- Sanity: por si el owner_id del árbol de Edrei quedó en NULL o en un uid
-- viejo. Le asignamos al primer registered user con correo edreione1@gmail.com.
UPDATE public.trees t
SET owner_id = au.id
FROM auth.users au
WHERE au.email = 'edreione1@gmail.com'
  AND t.id = '4508d01c-2cdf-43eb-80d5-2d0d40989c63'
  AND (t.owner_id IS NULL OR t.owner_id <> au.id);

-- Ver estado final
SELECT id, name, owner_id FROM public.trees WHERE id = '4508d01c-2cdf-43eb-80d5-2d0d40989c63';
