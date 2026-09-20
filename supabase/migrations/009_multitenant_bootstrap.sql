-- =============================================================================
-- Migration 009 — Multi-tenant bootstrap
-- =============================================================================
-- - Nuevo usuario sin invitación → arbol propio con su primer nodo (root).
-- - Usuarios existentes (Edrei) → intactos.
-- - Demo tree (00000000-0000-0000-0000-000000000001) se queda como preview
--   público de solo lectura (RLS lo bloquea para escritura excepto owner).
-- - Ejecutar desde Supabase Dashboard → SQL Editor. Idempotente.
-- =============================================================================


-- 1. Función que crea árbol nuevo con member root para un usuario -------------
--    Se llama desde el onboarding cuando el usuario elige nombre familiar.
--    SECURITY DEFINER porque necesita bypass de RLS para el INSERT inicial.

CREATE OR REPLACE FUNCTION public.bootstrap_user_tree(
  p_family_name TEXT,
  p_first_name  TEXT DEFAULT NULL,
  p_last_name   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_tree_id      UUID;
  v_first        TEXT;
  v_last         TEXT;
  v_email        TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() es NULL — solo usuarios autenticados';
  END IF;

  -- Traemos el email del usuario para fallback de nombres
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  v_first := COALESCE(NULLIF(TRIM(p_first_name), ''), SPLIT_PART(COALESCE(v_email, 'Miembro'), '@', 1));
  v_last  := COALESCE(NULLIF(TRIM(p_last_name), ''), NULLIF(TRIM(p_family_name), ''), 'Familia');

  -- Aseguramos que exista el row en public.users (por si se registró antes del trigger)
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    v_user_id,
    COALESCE(v_email, ''),
    TRIM(v_first || ' ' || v_last)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Creamos el árbol nuevo
  INSERT INTO public.trees (owner_id, name, default_privacy, is_public_legacy)
  VALUES (
    v_user_id,
    COALESCE(NULLIF(TRIM(p_family_name), ''), 'Mi Familia'),
    'core',
    FALSE
  )
  RETURNING id INTO v_tree_id;

  -- Insertamos el primer member (root, generación 0) vinculado al user
  INSERT INTO public.members (
    tree_id, user_id, first_name, last_name,
    apple_type, generation, member_privacy
  )
  VALUES (
    v_tree_id, v_user_id, v_first, v_last,
    'red', 0, 'core'
  );

  RETURN v_tree_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_user_tree(TEXT, TEXT, TEXT) TO authenticated;


-- 2. Función que lista árboles del usuario (owner + member) -------------------
--    Devuelve id, name, role ('owner' | 'member'), member_count.

CREATE OR REPLACE FUNCTION public.get_user_trees()
RETURNS TABLE (
  tree_id      UUID,
  tree_name    TEXT,
  role         TEXT,
  member_count INT,
  is_demo      BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT t.id, t.name, 'owner'::TEXT AS role, t.member_count,
           (t.id = '00000000-0000-0000-0000-000000000001'::UUID) AS is_demo
    FROM public.trees t
    WHERE t.owner_id = auth.uid()
    UNION
    SELECT t.id, t.name, 'member'::TEXT AS role, t.member_count,
           (t.id = '00000000-0000-0000-0000-000000000001'::UUID) AS is_demo
    FROM public.trees t
    JOIN public.members m ON m.tree_id = t.id
    WHERE m.user_id = auth.uid() AND t.owner_id <> auth.uid()
  )
  SELECT id, name, role, COALESCE(member_count, 0), is_demo FROM mine;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_trees() TO authenticated;


-- 3. RLS de escritura reforzada -----------------------------------------------
--    Un usuario solo puede INSERT/UPDATE/DELETE en árboles donde es owner.
--    Esto evita que alguien logueado escriba en el DEMO o en árbol ajeno.

-- members
DROP POLICY IF EXISTS "members_write_own_tree" ON public.members;
CREATE POLICY "members_write_own_tree"
  ON public.members FOR ALL
  TO authenticated
  USING (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  );

-- relationships
DROP POLICY IF EXISTS "relationships_write_own_tree" ON public.relationships;
CREATE POLICY "relationships_write_own_tree"
  ON public.relationships FOR ALL
  TO authenticated
  USING (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  );

-- activities
DROP POLICY IF EXISTS "activities_write_own_tree" ON public.activities;
CREATE POLICY "activities_write_own_tree"
  ON public.activities FOR ALL
  TO authenticated
  USING (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
  );

-- trees: cada uno lee los suyos + los públicos; solo el owner escribe.
DROP POLICY IF EXISTS "trees_read_visible" ON public.trees;
CREATE POLICY "trees_read_visible"
  ON public.trees FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT DISTINCT tree_id FROM public.members WHERE user_id = auth.uid())
    OR is_public_legacy = TRUE
  );

DROP POLICY IF EXISTS "trees_write_owner" ON public.trees;
CREATE POLICY "trees_write_owner"
  ON public.trees FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "trees_insert_owner" ON public.trees;
CREATE POLICY "trees_insert_owner"
  ON public.trees FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "trees_delete_owner" ON public.trees;
CREATE POLICY "trees_delete_owner"
  ON public.trees FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());


-- 4. Bootstrap automático para usuarios que YA existen sin árbol propio -------
--    (personas que se registraron antes de esta migración y quedaron viendo el
--    demo). No corre para Edrei porque él SÍ es owner de árboles reales.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1)) AS name
    FROM auth.users u
    LEFT JOIN public.trees t ON t.owner_id = u.id
    LEFT JOIN public.members m ON m.user_id = u.id
    WHERE t.id IS NULL AND m.id IS NULL
  LOOP
    -- Nada aquí — el frontend hace el onboarding la próxima vez que el usuario entre.
    NULL;
  END LOOP;
END $$;


COMMENT ON FUNCTION public.bootstrap_user_tree IS
  'Crea árbol nuevo con member root para el usuario autenticado. Llamado desde el onboarding.';

COMMENT ON FUNCTION public.get_user_trees IS
  'Devuelve todos los árboles a los que pertenece el usuario (owner o member).';
