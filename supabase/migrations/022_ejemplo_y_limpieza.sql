-- =============================================================================
-- Migration 022 — Árbol de ejemplo visible + limpieza de pruebas
-- =============================================================================
-- 1. La "Familia Pérez" (árbol de ejemplo, ficticio) se puede VER por
--    cualquier persona con sesión, para el recorrido de funciones (botón ?).
--    Nadie puede modificarla (no hay permisos de escritura nuevos).
-- 2. Se borra el árbol de prueba "Manriquez".
-- 3. Corrige rename_family_tree (021 usaba una columna que no existe).
-- 4. El árbol principal se llama "Familia Elías".
-- =============================================================================

BEGIN;

-- 1. Ejemplo: solo lectura para usuarios con sesión
DROP POLICY IF EXISTS "members_demo_read" ON public.members;
CREATE POLICY "members_demo_read" ON public.members FOR SELECT TO authenticated
  USING (tree_id = '00000000-0000-0000-0000-000000000001'::UUID);

DROP POLICY IF EXISTS "relationships_demo_read" ON public.relationships;
CREATE POLICY "relationships_demo_read" ON public.relationships FOR SELECT TO authenticated
  USING (tree_id = '00000000-0000-0000-0000-000000000001'::UUID);

-- 2. Borrar el árbol de prueba Manriquez (con todo lo que contiene)
DELETE FROM public.trees
WHERE name = 'Manriquez' AND surname = 'manriquez'
  AND id <> '00000000-0000-0000-0000-000000000001'::UUID;

-- 3. Corrección: la tabla trees no tiene updated_at; cambiar nombre fallaba.
CREATE OR REPLACE FUNCTION public.rename_family_tree(p_tree UUID, p_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT := regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g');
  v_sur  TEXT;
BEGIN
  IF NOT public.is_tree_admin(p_tree) THEN
    RAISE EXCEPTION 'Solo el fundador o un administrador puede cambiar el nombre.';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 60 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 60 letras.';
  END IF;
  -- El apellido de la familia no cambia con el nombre (evita duplicados);
  -- solo se toma del nombre si el árbol aún no tenía ("Familia X" → "x").
  v_sur := public.norm_surname(regexp_replace(v_name, '^(familia|fam\.?)\s+', '', 'i'));
  UPDATE public.trees SET name = v_name, surname = COALESCE(surname, v_sur)
  WHERE id = p_tree;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rename_family_tree(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rename_family_tree(UUID, TEXT) FROM anon;

-- 4. Nombre del árbol principal
UPDATE public.trees
SET name = 'Familia Elías'
WHERE surname = 'elias'
  AND id <> '00000000-0000-0000-0000-000000000001'::UUID
  AND (SELECT count(*) FROM public.members m WHERE m.tree_id = trees.id) > 10;

COMMIT;

-- Revisión
SELECT t.name AS familia,
       CASE WHEN t.id = '00000000-0000-0000-0000-000000000001'::UUID THEN 'sí' ELSE '' END AS es_el_ejemplo,
       (SELECT count(*) FROM public.members m WHERE m.tree_id = t.id) AS manzanas
FROM public.trees t
ORDER BY manzanas DESC;
