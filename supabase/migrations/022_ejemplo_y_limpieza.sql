-- =============================================================================
-- Migration 022 — Árbol de ejemplo visible + limpieza de pruebas
-- =============================================================================
-- 1. La "Familia Pérez" (árbol de ejemplo, ficticio) se puede VER por
--    cualquier persona con sesión, para el recorrido de funciones (botón ?).
--    Nadie puede modificarla (no hay permisos de escritura nuevos).
-- 2. Se borra el árbol de prueba "Manriquez".
-- 3. El árbol principal se llama "Familia Elías".
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

-- 3. Nombre del árbol principal
UPDATE public.trees
SET name = 'Familia Elías', updated_at = NOW()
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
