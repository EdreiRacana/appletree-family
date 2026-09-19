-- =============================================================================
-- Migration 007 — Regla dura: una cuenta ↔ una manzana
-- =============================================================================
-- Antes: un mismo auth.uid podía terminar linkeado a 2+ manzanas por bugs
-- en el auto-accept (invitaciones al mismo correo, rescates repetidos).
-- Resultado: la lista de chats mostraba la manzana equivocada (última
-- iterada en el mapa por user_id).
--
-- Fix: UNIQUE constraint. Cualquier intento futuro de linkear un member
-- a un user_id ya usado por otro member falla en la DB, no en silencio.
-- =============================================================================

-- Limpiar duplicados conocidos (idempotente — si ya se limpiaron, no pasa nada)
DO $$
BEGIN
  -- Logan tenía el user_id de Eber Jr (edrei@luckysoxs.com)
  UPDATE public.members SET user_id = NULL
  WHERE id = '54070621-c956-426d-a2de-11a624237e25'
    AND user_id = '32234804-2ceb-47e2-832a-552b1cd58f08';

  -- Idaia tenía el user_id de Edrei; se corrige a su propia cuenta
  UPDATE public.members SET user_id = '4284a00f-1a74-47f7-a3f7-97a9cab69a22'
  WHERE id = '80d908a7-c42a-42dd-8d3c-5b40480d6c33'
    AND user_id = '8cbaae6a-b589-45bf-b8fe-66a5780ba82e';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cleanup opcional falló o los IDs no aplican en este proyecto: %', SQLERRM;
END $$;

-- Agregar constraint si no existe. Postgres permite múltiples NULLs con UNIQUE
-- (varios miembros sin cuenta) pero un mismo UUID no puede aparecer 2 veces.
DO $$
BEGIN
  ALTER TABLE public.members ADD CONSTRAINT members_user_id_unique UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint ya existe';
WHEN unique_violation THEN
  RAISE EXCEPTION 'No se puede aplicar UNIQUE porque quedan duplicados. Revisa: SELECT user_id, COUNT(*) FROM public.members WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1;';
END $$;

-- Sanity: mostrar las manzanas linkeadas con su cuenta correspondiente
SELECT m.first_name, m.last_name, au.email AS cuenta
FROM public.members m
LEFT JOIN auth.users au ON au.id = m.user_id
WHERE m.user_id IS NOT NULL
ORDER BY m.first_name;
