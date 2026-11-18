-- =============================================================================
-- DESHACER Migration 015 — regresa los permisos EXACTAMENTE a como estaban el
-- 2026-11-18 (según el diagnóstico). OJO: ese estado es INSEGURO (tablas sin
-- candado). Úsalo solo si la 015 rompió algo y necesitas la página funcionando
-- mientras se corrige.
--
-- No borra datos. Las columnas created_by y las filas nuevas de
-- tree_memberships se quedan (no estorban).
-- =============================================================================

BEGIN;

-- Triggers nuevos
DROP TRIGGER IF EXISTS trg_guard_member_write      ON public.members;
DROP TRIGGER IF EXISTS trg_member_link_membership  ON public.members;
DROP TRIGGER IF EXISTS trg_tree_owner_membership   ON public.trees;

-- members
DROP POLICY IF EXISTS "members_read"            ON public.members;
DROP POLICY IF EXISTS "members_member_insert"   ON public.members;
DROP POLICY IF EXISTS "members_member_update"   ON public.members;
DROP POLICY IF EXISTS "members_member_delete"   ON public.members;
DROP POLICY IF EXISTS "members_admin_full_access" ON public.members;
CREATE POLICY "members_admin_full_access" ON public.members FOR ALL TO authenticated
  USING (is_tree_admin(tree_id)) WITH CHECK (is_tree_admin(tree_id));
CREATE POLICY "members_invite_claim" ON public.members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM invites i
                 WHERE i.member_id = members.id AND i.accepted_by = auth.uid() AND i.accepted_at IS NOT NULL));
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;

-- trees
DROP POLICY IF EXISTS "trees_read_member"  ON public.trees;
DROP POLICY IF EXISTS "trees_delete_owner" ON public.trees;
DROP POLICY IF EXISTS "trees_insert_owner" ON public.trees;
DROP POLICY IF EXISTS "trees_update_owner" ON public.trees;
CREATE POLICY "trees_insert_owner" ON public.trees FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trees_update_owner" ON public.trees FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
ALTER TABLE public.trees DISABLE ROW LEVEL SECURITY;

-- relationships
DROP POLICY IF EXISTS "relationships_read"          ON public.relationships;
DROP POLICY IF EXISTS "relationships_admin_all"     ON public.relationships;
DROP POLICY IF EXISTS "relationships_member_insert" ON public.relationships;
DROP POLICY IF EXISTS "relationships_member_delete" ON public.relationships;
CREATE POLICY "relationships_write_own_tree" ON public.relationships FOR ALL TO authenticated
  USING (tree_id IN (SELECT trees.id FROM trees WHERE trees.owner_id = auth.uid()))
  WITH CHECK (tree_id IN (SELECT trees.id FROM trees WHERE trees.owner_id = auth.uid()));
ALTER TABLE public.relationships DISABLE ROW LEVEL SECURITY;

-- activities
DROP POLICY IF EXISTS "activities_read"          ON public.activities;
DROP POLICY IF EXISTS "activities_admin_all"     ON public.activities;
DROP POLICY IF EXISTS "activities_member_insert" ON public.activities;
DROP POLICY IF EXISTS "activities_member_own"    ON public.activities;
DROP POLICY IF EXISTS "activities_member_delete" ON public.activities;
CREATE POLICY "activities_write_own_tree" ON public.activities FOR ALL TO authenticated
  USING (tree_id IN (SELECT trees.id FROM trees WHERE trees.owner_id = auth.uid()))
  WITH CHECK (tree_id IN (SELECT trees.id FROM trees WHERE trees.owner_id = auth.uid()));
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;

-- story_comments / story_reactions
DROP POLICY IF EXISTS "story_comments_read"   ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_insert" ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_delete" ON public.story_comments;
DROP POLICY IF EXISTS "story_reactions_read"  ON public.story_reactions;
DROP POLICY IF EXISTS "story_reactions_write" ON public.story_reactions;
CREATE POLICY "Permitir todo a comentarios" ON public.story_comments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "todo_comentarios"            ON public.story_comments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "todo_reacciones"             ON public.story_reactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- tree_memberships
DROP POLICY IF EXISTS "memberships_read_own_tree" ON public.tree_memberships;
CREATE POLICY "memberships_read_own_tree" ON public.tree_memberships FOR SELECT TO authenticated
  USING (tree_id IN (SELECT tm.tree_id FROM tree_memberships tm WHERE tm.user_id = auth.uid()));

-- users
DROP POLICY IF EXISTS "users_select_shared_tree" ON public.users;
CREATE POLICY "users_select_others_basic" ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);

-- chats
DROP POLICY IF EXISTS "chats_create" ON public.chats;
CREATE POLICY "chats_create" ON public.chats FOR INSERT
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- invites
DROP POLICY IF EXISTS "invites_admin_all" ON public.invites;
CREATE POLICY "invites_read_public" ON public.invites FOR SELECT USING (true);
CREATE POLICY "invites_accept" ON public.invites FOR UPDATE
  USING (accepted_at IS NULL AND expires_at > now() AND auth.uid() IS NOT NULL);
CREATE POLICY "invites_insert_family" ON public.invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM trees WHERE trees.id = invites.tree_id AND trees.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM members WHERE members.tree_id = invites.tree_id AND members.user_id = auth.uid())
  );

-- storage family-photos
DROP POLICY IF EXISTS "family_photos_public_read"         ON storage.objects;
DROP POLICY IF EXISTS "family_photos_authenticated_write" ON storage.objects;
DROP POLICY IF EXISTS "family_photos_owner_update"        ON storage.objects;
DROP POLICY IF EXISTS "family_photos_owner_delete"        ON storage.objects;
CREATE POLICY "Give anon users access to JPG images in folder i9lukq_0" ON storage.objects FOR SELECT USING (bucket_id = 'family-photos');
CREATE POLICY "Give anon users access to JPG images in folder i9lukq_1" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'family-photos');
CREATE POLICY "Give anon users access to JPG images in folder i9lukq_2" ON storage.objects FOR UPDATE USING (bucket_id = 'family-photos');

-- Funciones nuevas (las que reemplazaban a otras se quedan: no estorban)
DROP FUNCTION IF EXISTS public.accept_my_email_invite();
DROP FUNCTION IF EXISTS public.accept_invite(TEXT);
DROP FUNCTION IF EXISTS public.get_invite_preview(TEXT);
DROP FUNCTION IF EXISTS public.can_see_story(UUID);
DROP FUNCTION IF EXISTS public.guard_member_write();
DROP FUNCTION IF EXISTS public.trg_member_link_membership();
DROP FUNCTION IF EXISTS public.trg_tree_owner_membership();
DROP FUNCTION IF EXISTS public.shares_tree_with(UUID);
DROP FUNCTION IF EXISTS public.my_editable_member_ids(UUID);
DROP FUNCTION IF EXISTS public.is_tree_member(UUID);

COMMIT;
