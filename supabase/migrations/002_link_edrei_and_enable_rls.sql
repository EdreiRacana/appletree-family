-- =============================================================================
-- Migration 002 — Link Edrei's tree + enable RLS
-- =============================================================================
-- Run this from Supabase Dashboard → SQL Editor.
-- Idempotent: safe to re-run.
-- Anchor UID for the tree owner (Edrei): 8cbaae6a-b589-45bf-b8fe-66a5780ba82e
-- =============================================================================

-- 1. Make sure the public.users row exists for Edrei
INSERT INTO public.users (id, email, full_name)
VALUES ('8cbaae6a-b589-45bf-b8fe-66a5780ba82e', 'edreione1@gmail.com', 'Edrei Elias')
ON CONFLICT (id) DO NOTHING;

-- 2. Link Edrei's existing family tree to their auth account as owner
UPDATE public.trees
SET owner_id = '8cbaae6a-b589-45bf-b8fe-66a5780ba82e'
WHERE id = '4508d01c-2cdf-43eb-80d5-2d0d40989c63';

-- 3. Ensure the DEMO tree exists as a public showcase for visitors
INSERT INTO public.trees (id, owner_id, name, is_public_legacy, default_privacy)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '8cbaae6a-b589-45bf-b8fe-66a5780ba82e',
  'Árbol de Ejemplo',
  TRUE,
  'public'
)
ON CONFLICT (id) DO UPDATE
SET is_public_legacy = TRUE;

-- 4. Enable RLS on every table we touch (idempotent)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 5. Extra policy: if you are a claimed member of a tree
--    (public.members.user_id = auth.uid()), you can read that whole tree.
--    This is the "invited family member" permission on top of the schema's
--    owner + extended policies.
DROP POLICY IF EXISTS "members_family_read" ON public.members;
CREATE POLICY "members_family_read"
  ON public.members FOR SELECT
  USING (
    tree_id IN (
      SELECT DISTINCT tree_id FROM public.members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "relationships_family_read" ON public.relationships;
CREATE POLICY "relationships_family_read"
  ON public.relationships FOR SELECT
  USING (
    tree_id IN (
      SELECT DISTINCT tree_id FROM public.members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "activities_family_read" ON public.activities;
CREATE POLICY "activities_family_read"
  ON public.activities FOR SELECT
  USING (
    tree_id IN (
      SELECT DISTINCT tree_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- 6. Public read access to the DEMO tree so any visitor can see it as a
--    showcase before creating or being invited to a real family tree.
DROP POLICY IF EXISTS "members_demo_read" ON public.members;
CREATE POLICY "members_demo_read"
  ON public.members FOR SELECT
  USING (tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE));

DROP POLICY IF EXISTS "relationships_demo_read" ON public.relationships;
CREATE POLICY "relationships_demo_read"
  ON public.relationships FOR SELECT
  USING (tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE));

DROP POLICY IF EXISTS "activities_demo_read" ON public.activities;
CREATE POLICY "activities_demo_read"
  ON public.activities FOR SELECT
  USING (tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE));

-- 7. Sanity check — should return both trees, with Edrei as owner
SELECT id, name, owner_id, is_public_legacy
FROM public.trees
WHERE id IN (
  '4508d01c-2cdf-43eb-80d5-2d0d40989c63',
  '00000000-0000-0000-0000-000000000001'
);
