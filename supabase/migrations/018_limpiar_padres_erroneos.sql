-- =============================================================================
-- Migration 018 — Limpiar vínculos padre/hijo guardados por error
-- =============================================================================
-- Un error del formulario "Agregar familiar" (corregido en el código) guardó:
--   1) a la PAREJA agregada como "hija/o" de su cónyuge
--      (p.ej. Enrique quedó como hijo de su esposa).
--   2) al PADRE/MADRE agregado como "hijo/a" de su propio hijo (ciclo)
--      (p.ej. Miguel quedó como padre Y como hijo de Francisco).
-- Este script quita esos vínculos falsos y muestra la lista de lo corregido.
-- Solo quita; no agrega nada. Los ciclos con generación igual o vacía NO se
-- tocan (no se puede saber cuál es el bueno): aparecen en la lista como
-- "revisar a mano".
-- =============================================================================

WITH links AS (
  SELECT m.id AS child_id, p AS parent_id
  FROM public.members m, unnest(COALESCE(m.parents, '{}')) AS p
),
classified AS (
  SELECT l.child_id, l.parent_id,
    CASE
      -- 1) el "padre" es en realidad su pareja
      WHEN l.parent_id = ANY (COALESCE(c.spouses, '{}'))
        OR c.id = ANY (COALESCE(par.spouses, '{}'))
        OR EXISTS (
          SELECT 1 FROM public.relationships r
          WHERE r.relationship = 'spouse'
            AND ((r.member1_id = c.id AND r.member2_id = par.id) OR (r.member1_id = par.id AND r.member2_id = c.id)))
        THEN 'era su pareja'
      -- 2) ciclo: cada uno aparece como padre del otro
      WHEN c.id = ANY (COALESCE(par.parents, '{}')) THEN
        CASE
          WHEN par.generation IS NULL OR c.generation IS NULL OR par.generation = c.generation THEN 'revisar a mano'
          WHEN par.generation > c.generation THEN 'ciclo (era su hijo, no su padre)'
          ELSE NULL      -- este es el sentido correcto: se conserva
        END
      ELSE NULL
    END AS motivo
  FROM links l
  JOIN public.members c   ON c.id = l.child_id
  JOIN public.members par ON par.id = l.parent_id
),
to_remove AS (
  SELECT * FROM classified WHERE motivo IN ('era su pareja', 'ciclo (era su hijo, no su padre)')
),
upd AS (
  UPDATE public.members m
  SET parents = ARRAY(
    SELECT q FROM unnest(m.parents) AS q
    WHERE q NOT IN (SELECT tr.parent_id FROM to_remove tr WHERE tr.child_id = m.id)
  )
  WHERE m.id IN (SELECT child_id FROM to_remove)
  RETURNING m.id
)
SELECT
  c.first_name || ' ' || c.last_name   AS persona,
  p.first_name || ' ' || p.last_name   AS ya_no_aparece_como_su_padre,
  x.motivo,
  CASE WHEN x.motivo = 'revisar a mano' THEN 'sin cambio' ELSE 'corregido' END AS resultado
FROM classified x
JOIN public.members c ON c.id = x.child_id
JOIN public.members p ON p.id = x.parent_id
WHERE x.motivo IS NOT NULL
ORDER BY resultado, persona;
