-- =============================================================================
-- Migration 015 — Seguridad Fase 1
-- =============================================================================
-- Escrita contra el estado REAL de producción (diagnóstico 2026-11-18), no
-- contra las migraciones 001-014 (producción se desvió de ellas).
--
-- Modelo de permisos:
--   owner (fundador)  → todo; nombra/quita admins.
--   admin (superadmin)→ todo en el árbol salvo quitarle el árbol al fundador.
--   member (invitado) → ve todo su árbol; edita SU manzana; crea hijos y pareja;
--                       edita las manzanas sin cuenta que él creó (bebés);
--                       puede enlazar como padre a sus propios hijos.
--                       Lo demás → sugerencia a admins (Fase 2).
--   anon (sin sesión) → nada, salvo ver la vista previa de UNA invitación con
--                       su token.
--
-- Idempotente: se puede correr dos veces. Deshacer: 015_seguridad_fase_1_DESHACER.sql
-- =============================================================================

BEGIN;

-- 0. COLUMNAS NUEVAS ------------------------------------------------------------
-- created_by: quién creó la fila (para "la manzana del bebé la edita quien la creó"
-- y "cada quien borra sus propias historias/comentarios").

ALTER TABLE public.members        ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();
ALTER TABLE public.activities     ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();
ALTER TABLE public.story_comments ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();
ALTER TABLE public.relationships  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid();


-- 1. FUNCIONES AUXILIARES (SECURITY DEFINER → sin recursión en RLS) ------------

CREATE OR REPLACE FUNCTION public.is_tree_member(p_tree_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.tree_memberships WHERE tree_id = p_tree_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.members WHERE tree_id = p_tree_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.trees WHERE id = p_tree_id AND owner_id = auth.uid())
  );
$$;

-- Manzanas que el usuario actual puede editar como "member": la suya y las
-- manzanas SIN cuenta que él creó (bebés / pareja sin cuenta).
CREATE OR REPLACE FUNCTION public.my_editable_member_ids(p_tree_id UUID)
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.members
  WHERE tree_id = p_tree_id
    AND auth.uid() IS NOT NULL
    AND (user_id = auth.uid() OR (user_id IS NULL AND created_by = auth.uid()));
$$;

-- ¿Comparten árbol el usuario actual y otro usuario?
CREATE OR REPLACE FUNCTION public.shares_tree_with(p_other UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.tree_memberships a
    JOIN public.tree_memberships b ON b.tree_id = a.tree_id
    WHERE a.user_id = auth.uid() AND b.user_id = p_other
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tree_member(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_editable_member_ids(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_tree_with(UUID)        TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tree_member(UUID)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_editable_member_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shares_tree_with(UUID)       FROM anon;


-- 2. MEMBRESÍAS AUTOMÁTICAS ------------------------------------------------------
-- Antes, crear un árbol o aceptar una invitación no creaba la fila en
-- tree_memberships, y el fundador nuevo se quedaba sin permisos.

CREATE OR REPLACE FUNCTION public.trg_tree_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by)
    VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id)
    ON CONFLICT (tree_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tree_owner_membership ON public.trees;
CREATE TRIGGER trg_tree_owner_membership
  AFTER INSERT ON public.trees
  FOR EACH ROW EXECUTE FUNCTION public.trg_tree_owner_membership();

CREATE OR REPLACE FUNCTION public.trg_member_link_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.tree_id IS NOT NULL THEN
    INSERT INTO public.tree_memberships (tree_id, user_id, role)
    VALUES (NEW.tree_id, NEW.user_id, 'member')
    ON CONFLICT (tree_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_link_membership ON public.members;
CREATE TRIGGER trg_member_link_membership
  AFTER INSERT OR UPDATE OF user_id ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.trg_member_link_membership();

-- Backfill: dueños y manzanas ya enlazadas
INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by)
SELECT t.id, t.owner_id, 'owner', t.owner_id
FROM public.trees t
WHERE t.owner_id IS NOT NULL
ON CONFLICT (tree_id, user_id) DO NOTHING;

INSERT INTO public.tree_memberships (tree_id, user_id, role)
SELECT DISTINCT m.tree_id, m.user_id, 'member'::public.tree_role
FROM public.members m
WHERE m.user_id IS NOT NULL AND m.tree_id IS NOT NULL
ON CONFLICT (tree_id, user_id) DO NOTHING;


-- 3. REGLAS DE ESCRITURA DE MANZANAS PARA "member" ------------------------------
-- RLS decide QUÉ filas puede tocar; este trigger decide QUÉ puede cambiar.
-- Admins, el servidor (service_role, sin auth.uid()) y funciones internas de
-- confianza (app.trusted = on) pasan directo.

CREATE OR REPLACE FUNCTION public.guard_member_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_editable  UUID[];
  v_mine      UUID[];
  v_parent_gen INT;
BEGIN
  IF v_uid IS NULL
     OR COALESCE(current_setting('app.trusted', true), '') = 'on'
     OR public.is_tree_admin(COALESCE(NEW.tree_id, OLD.tree_id)) THEN
    RETURN NEW;
  END IF;

  v_editable := public.my_editable_member_ids(NEW.tree_id);

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := v_uid;
    IF NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'No puedes enlazar una cuenta a una manzana nueva.';
    END IF;
    IF COALESCE(cardinality(NEW.parents), 0) > 0 THEN
      -- HIJO: al menos uno de los padres debe ser una manzana tuya,
      -- y el hijo debe estar en una generación más abajo.
      IF NOT (NEW.parents && v_editable) THEN
        RAISE EXCEPTION 'Solo puedes agregar hijos tuyos. Para otros familiares envía una sugerencia al administrador.';
      END IF;
      SELECT max(generation) INTO v_parent_gen
      FROM public.members WHERE id = ANY (NEW.parents) AND id = ANY (v_editable);
      IF NEW.generation IS NOT NULL AND v_parent_gen IS NOT NULL AND NEW.generation <= v_parent_gen THEN
        RAISE EXCEPTION 'Solo puedes agregar hijos o pareja. Padres y hermanos se piden como sugerencia al administrador.';
      END IF;
    END IF;
    -- Sin padres = pareja (se enlaza después desde tu propia manzana).
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.tree_id IS DISTINCT FROM OLD.tree_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'No autorizado para cambiar árbol, cuenta o autor de una manzana.';
  END IF;

  IF OLD.user_id = v_uid THEN
    -- Tu propia manzana: todo menos tus padres (eso es sugerencia).
    IF NEW.parents IS DISTINCT FROM OLD.parents THEN
      RAISE EXCEPTION 'Para cambiar tus padres envía una sugerencia al administrador.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.user_id IS NULL AND OLD.created_by = v_uid THEN
    RETURN NEW;  -- manzana sin cuenta que tú creaste (bebé, pareja)
  END IF;

  -- Hijo tuyo creado por otro (p.ej. el fundador): solo puedes ajustar sus padres
  -- (p.ej. agregar a tu pareja como co-padre), y tú debes seguir siendo padre.
  v_mine := public.my_editable_member_ids(NEW.tree_id);
  IF OLD.parents && v_mine AND NEW.parents && v_mine
     AND (to_jsonb(NEW) - 'parents') = (to_jsonb(OLD) - 'parents') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Solo puedes editar tu manzana y las que tú creaste. Envía una sugerencia al administrador.';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_member_write ON public.members;
CREATE TRIGGER trg_guard_member_write
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_write();


-- 4. RLS: members -----------------------------------------------------------------

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_invite_claim"       ON public.members;
DROP POLICY IF EXISTS "members_family_read"        ON public.members;
DROP POLICY IF EXISTS "members_write_own_tree"     ON public.members;
DROP POLICY IF EXISTS "members_owner_full_access"  ON public.members;
DROP POLICY IF EXISTS "members_admin_full_access"  ON public.members;
DROP POLICY IF EXISTS "members_read"               ON public.members;
DROP POLICY IF EXISTS "members_member_insert"      ON public.members;
DROP POLICY IF EXISTS "members_member_update"      ON public.members;
DROP POLICY IF EXISTS "members_member_delete"      ON public.members;

CREATE POLICY "members_read" ON public.members FOR SELECT TO authenticated
  USING (public.is_tree_member(tree_id));

CREATE POLICY "members_admin_full_access" ON public.members FOR ALL TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

CREATE POLICY "members_member_insert" ON public.members FOR INSERT TO authenticated
  WITH CHECK (public.is_tree_member(tree_id) AND user_id IS NULL);

CREATE POLICY "members_member_update" ON public.members FOR UPDATE TO authenticated
  USING (
    public.is_tree_member(tree_id) AND (
      user_id = auth.uid()
      OR (user_id IS NULL AND created_by = auth.uid())
      OR parents && public.my_editable_member_ids(tree_id)
    )
  )
  WITH CHECK (public.is_tree_member(tree_id));

-- Deshacer un error: puedes borrar una manzana sin cuenta que tú creaste.
CREATE POLICY "members_member_delete" ON public.members FOR DELETE TO authenticated
  USING (user_id IS NULL AND created_by = auth.uid() AND public.is_tree_member(tree_id));


-- 5. RLS: trees ---------------------------------------------------------------------

ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trees_read_visible"  ON public.trees;
DROP POLICY IF EXISTS "trees_read_member"   ON public.trees;
DROP POLICY IF EXISTS "trees_write_owner"   ON public.trees;
DROP POLICY IF EXISTS "trees_update_owner"  ON public.trees;
DROP POLICY IF EXISTS "trees_insert_owner"  ON public.trees;
DROP POLICY IF EXISTS "trees_delete_owner"  ON public.trees;

CREATE POLICY "trees_read_member" ON public.trees FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_tree_member(id));

CREATE POLICY "trees_insert_owner" ON public.trees FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "trees_update_owner" ON public.trees FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "trees_delete_owner" ON public.trees FOR DELETE TO authenticated
  USING (owner_id = auth.uid());


-- 6. RLS: relationships -------------------------------------------------------------

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relationships_write_own_tree"   ON public.relationships;
DROP POLICY IF EXISTS "relationships_read"             ON public.relationships;
DROP POLICY IF EXISTS "relationships_admin_all"        ON public.relationships;
DROP POLICY IF EXISTS "relationships_member_insert"    ON public.relationships;
DROP POLICY IF EXISTS "relationships_member_delete"    ON public.relationships;

CREATE POLICY "relationships_read" ON public.relationships FOR SELECT TO authenticated
  USING (public.is_tree_member(tree_id));

CREATE POLICY "relationships_admin_all" ON public.relationships FOR ALL TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

-- Un familiar puede crear/quitar conexiones de pareja donde participa su manzana
-- (o una manzana que él creó).
CREATE POLICY "relationships_member_insert" ON public.relationships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tree_member(tree_id)
    AND relationship = 'spouse'
    AND (member1_id = ANY (public.my_editable_member_ids(tree_id))
         OR member2_id = ANY (public.my_editable_member_ids(tree_id)))
  );

CREATE POLICY "relationships_member_delete" ON public.relationships FOR DELETE TO authenticated
  USING (
    public.is_tree_member(tree_id)
    AND relationship = 'spouse'
    AND (member1_id = ANY (public.my_editable_member_ids(tree_id))
         OR member2_id = ANY (public.my_editable_member_ids(tree_id)))
  );


-- 7. RLS: activities (historias, eventos) ------------------------------------------

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_write_own_tree"  ON public.activities;
DROP POLICY IF EXISTS "activities_owner_write"     ON public.activities;
DROP POLICY IF EXISTS "activities_read"            ON public.activities;
DROP POLICY IF EXISTS "activities_admin_all"       ON public.activities;
DROP POLICY IF EXISTS "activities_member_insert"   ON public.activities;
DROP POLICY IF EXISTS "activities_member_own"      ON public.activities;
DROP POLICY IF EXISTS "activities_member_delete"   ON public.activities;

CREATE POLICY "activities_read" ON public.activities FOR SELECT TO authenticated
  USING (public.is_tree_member(tree_id));

CREATE POLICY "activities_admin_all" ON public.activities FOR ALL TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

CREATE POLICY "activities_member_insert" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (public.is_tree_member(tree_id) AND created_by = auth.uid());

CREATE POLICY "activities_member_own" ON public.activities FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_tree_member(tree_id))
  WITH CHECK (created_by = auth.uid() AND public.is_tree_member(tree_id));

CREATE POLICY "activities_member_delete" ON public.activities FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.is_tree_member(tree_id));


-- 8. RLS: comentarios y reacciones de historias (estaban abiertos a anónimos) -------

DROP POLICY IF EXISTS "Permitir todo a comentarios" ON public.story_comments;
DROP POLICY IF EXISTS "todo_comentarios"            ON public.story_comments;
DROP POLICY IF EXISTS "todo_reacciones"             ON public.story_reactions;
DROP POLICY IF EXISTS "story_comments_read"         ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_insert"       ON public.story_comments;
DROP POLICY IF EXISTS "story_comments_delete"       ON public.story_comments;
DROP POLICY IF EXISTS "story_reactions_read"        ON public.story_reactions;
DROP POLICY IF EXISTS "story_reactions_write"       ON public.story_reactions;

ALTER TABLE public.story_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_story(p_story_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = p_story_id AND public.is_tree_member(a.tree_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_see_story(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_see_story(UUID) FROM anon;

CREATE POLICY "story_comments_read" ON public.story_comments FOR SELECT TO authenticated
  USING (public.can_see_story(story_id));
CREATE POLICY "story_comments_insert" ON public.story_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_see_story(story_id) AND created_by = auth.uid());
CREATE POLICY "story_comments_delete" ON public.story_comments FOR DELETE TO authenticated
  USING (created_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.activities a
                    WHERE a.id = story_id AND public.is_tree_admin(a.tree_id)));

CREATE POLICY "story_reactions_read" ON public.story_reactions FOR SELECT TO authenticated
  USING (public.can_see_story(story_id));
CREATE POLICY "story_reactions_write" ON public.story_reactions FOR ALL TO authenticated
  USING (public.can_see_story(story_id))
  WITH CHECK (public.can_see_story(story_id));


-- 9. RLS: tree_memberships (la política anterior se consultaba a sí misma) ---------

DROP POLICY IF EXISTS "memberships_read_own_tree" ON public.tree_memberships;
CREATE POLICY "memberships_read_own_tree" ON public.tree_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tree_member(tree_id));


-- 10. users: solo ves a quien comparte árbol contigo (antes: a todos) --------------

DROP POLICY IF EXISTS "users_select_others_basic" ON public.users;
DROP POLICY IF EXISTS "users_select_shared_tree"  ON public.users;
CREATE POLICY "users_select_shared_tree" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_tree_with(id));


-- 11. chats: solo con alguien de tu árbol ------------------------------------------

DROP POLICY IF EXISTS "chats_create" ON public.chats;
CREATE POLICY "chats_create" ON public.chats FOR INSERT TO authenticated
  WITH CHECK (
    (participant_1 = auth.uid() AND public.shares_tree_with(participant_2))
    OR (participant_2 = auth.uid() AND public.shares_tree_with(participant_1))
  );


-- 12. INVITACIONES -------------------------------------------------------------------
-- Antes: cualquiera (incluso sin sesión) podía leer TODAS y marcarlas aceptadas.
-- Ahora: la tabla solo la ven los admins de su árbol; aceptar pasa por funciones
-- que validan token, vigencia, correo y que la manzana no tenga dueño.

DROP POLICY IF EXISTS "invites_read_public"   ON public.invites;
DROP POLICY IF EXISTS "invites_accept"        ON public.invites;
DROP POLICY IF EXISTS "invites_insert_owner"  ON public.invites;
DROP POLICY IF EXISTS "invites_insert_family" ON public.invites;
DROP POLICY IF EXISTS "invites_admin_all"     ON public.invites;

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_admin_all" ON public.invites FOR ALL TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

-- Vista previa para la pantalla de registro (funciona sin sesión, con el token).
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token TEXT)
RETURNS TABLE (email TEXT, tree_name TEXT, member_first_name TEXT, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE WHEN i.email LIKE '%@invite.local' OR i.email LIKE '%@placeholder%' THEN NULL ELSE i.email END,
    t.name,
    m.first_name,
    CASE
      WHEN i.accepted_at IS NOT NULL THEN 'accepted'
      WHEN i.expires_at < NOW()      THEN 'expired'
      WHEN m.user_id IS NOT NULL     THEN 'claimed'
      ELSE 'valid'
    END
  FROM public.invites i
  JOIN public.trees t ON t.id = i.tree_id
  LEFT JOIN public.members m ON m.id = i.member_id
  WHERE i.token = p_token
    AND length(p_token) >= 16;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO anon, authenticated;

-- Acepta una invitación por token. Devuelve el tree_id.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_inv    public.invites;
  v_member public.members;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para aceptar la invitación.';
  END IF;

  SELECT * INTO v_inv FROM public.invites WHERE token = p_token FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada.';
  END IF;

  -- Ya la aceptaste tú: idempotente.
  IF v_inv.accepted_at IS NOT NULL THEN
    IF v_inv.accepted_by = v_uid THEN RETURN v_inv.tree_id; END IF;
    RAISE EXCEPTION 'Esta invitación ya fue usada por otra persona.';
  END IF;

  IF v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'Esta invitación expiró. Pide una nueva al familiar que te invitó.';
  END IF;

  -- Si la invitación es para un correo real, debe ser el de tu cuenta.
  IF v_inv.email NOT LIKE '%@invite.local' AND v_inv.email NOT LIKE '%@placeholder%'
     AND lower(v_inv.email) <> lower(COALESCE((SELECT email FROM auth.users WHERE id = v_uid), '')) THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo. Entra con la cuenta de %.', v_inv.email;
  END IF;

  IF v_inv.member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM public.members WHERE id = v_inv.member_id FOR UPDATE;
    IF v_member.user_id IS NOT NULL AND v_member.user_id <> v_uid THEN
      RAISE EXCEPTION 'Esa manzana ya pertenece a otra cuenta. Avisa al administrador.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.members
               WHERE tree_id = v_inv.tree_id AND user_id = v_uid AND id <> v_inv.member_id) THEN
      RAISE EXCEPTION 'Tu cuenta ya tiene otra manzana en este árbol. Avisa al administrador.';
    END IF;
    PERFORM set_config('app.trusted', 'on', true);
    UPDATE public.members SET user_id = v_uid WHERE id = v_inv.member_id;
    PERFORM set_config('app.trusted', 'off', true);
  END IF;

  INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by)
  VALUES (v_inv.tree_id, v_uid, 'member', v_inv.invited_by)
  ON CONFLICT (tree_id, user_id) DO NOTHING;

  UPDATE public.invites SET accepted_at = NOW(), accepted_by = v_uid WHERE id = v_inv.id;

  RETURN v_inv.tree_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_invite(TEXT) FROM anon;

-- Acepta automáticamente la invitación más antigua dirigida al correo de tu cuenta
-- (cubre cuando se perdió el token). Solo si el correo está confirmado.
CREATE OR REPLACE FUNCTION public.accept_my_email_invite()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_email TEXT;
  v_conf  TIMESTAMPTZ;
  v_token TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT email, email_confirmed_at INTO v_email, v_conf FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_conf IS NULL THEN RETURN NULL; END IF;

  SELECT i.token INTO v_token
  FROM public.invites i
  LEFT JOIN public.members m ON m.id = i.member_id
  WHERE lower(i.email) = lower(v_email)
    AND i.accepted_at IS NULL
    AND i.expires_at > NOW()
    AND (m.id IS NULL OR m.user_id IS NULL)
  ORDER BY i.created_at
  LIMIT 1;

  IF v_token IS NULL THEN RETURN NULL; END IF;
  RETURN public.accept_invite(v_token);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_my_email_invite() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_my_email_invite() FROM anon;


-- 13. update_my_member_profile: la versión en producción usaba columnas que no
--     existen (nationality, avatar_cloudinary_id, updated_at) y fallaba siempre.
--     Se conserva la firma para no romper el frontend.

CREATE OR REPLACE FUNCTION public.update_my_member_profile(
  p_nickname    TEXT DEFAULT NULL,
  p_biography   TEXT DEFAULT NULL,
  p_occupation  TEXT DEFAULT NULL,
  p_nationality TEXT DEFAULT NULL,
  p_avatar_url  TEXT DEFAULT NULL,
  p_avatar_cloudinary_id TEXT DEFAULT NULL,
  p_birth_place TEXT DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.members;
BEGIN
  SELECT * INTO v_member FROM public.members
  WHERE user_id = auth.uid() AND date_of_death IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'No autorizado: no tienes manzana enlazada o está marcada como fallecida.';
  END IF;

  UPDATE public.members SET
    nickname    = COALESCE(p_nickname, nickname),
    biography   = COALESCE(p_biography, biography),
    occupation  = COALESCE(p_occupation, occupation),
    avatar_url  = COALESCE(p_avatar_url, avatar_url),
    birth_place = COALESCE(p_birth_place, birth_place)
  WHERE id = v_member.id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;


-- 14. STORAGE: family-photos permitía subir/reemplazar archivos SIN sesión ---------

DROP POLICY IF EXISTS "Give anon users access to JPG images in folder i9lukq_0" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder i9lukq_1" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder i9lukq_2" ON storage.objects;
DROP POLICY IF EXISTS "family_photos_public_read"        ON storage.objects;
DROP POLICY IF EXISTS "family_photos_authenticated_write" ON storage.objects;
DROP POLICY IF EXISTS "family_photos_owner_update"       ON storage.objects;
DROP POLICY IF EXISTS "family_photos_owner_delete"       ON storage.objects;

CREATE POLICY "family_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'family-photos');
CREATE POLICY "family_photos_authenticated_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'family-photos');
CREATE POLICY "family_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'family-photos' AND owner = auth.uid());
CREATE POLICY "family_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'family-photos' AND owner = auth.uid());

COMMIT;
