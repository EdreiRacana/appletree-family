-- =============================================================================
-- Migration 012 — Sistema de roles + auditoría
-- =============================================================================
-- Modelo:
--   OWNER (1 por árbol, el fundador) → puede TODO, incluyendo nombrar admins,
--                                       borrar árbol, transferir ownership.
--   ADMIN (0+ por árbol, nombrados por owner) → edita miembros/relaciones/
--                                                activities. NO nombra admins,
--                                                NO borra árbol.
--   MEMBER (todos los demás con cuenta enlazada) → edita solo SU manzana,
--                                                   solo campos personales,
--                                                   solo si NO está fallecido.
--
-- Sucesión: si el owner no ha iniciado sesión en 30 días, cualquier admin
--           puede reclamar ownership vía RPC claim_ownership().
-- =============================================================================


-- 1. TIPO DE ROL --------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.tree_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. TABLA tree_memberships ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tree_memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            public.tree_role NOT NULL DEFAULT 'member',
  granted_by      UUID REFERENCES auth.users(id),
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tree_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tree_memberships_user ON public.tree_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_tree_memberships_tree_role ON public.tree_memberships (tree_id, role);

ALTER TABLE public.tree_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memberships_read_own_tree" ON public.tree_memberships;
CREATE POLICY "memberships_read_own_tree" ON public.tree_memberships FOR SELECT TO authenticated
  USING (
    -- Puedes ver membresías del árbol si eres miembro de ese árbol
    tree_id IN (SELECT tree_id FROM public.tree_memberships WHERE user_id = auth.uid())
  );


-- 3. BACKFILL: crear una fila 'owner' por cada tree existente ----------------

INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by, granted_at)
SELECT t.id, t.owner_id, 'owner'::public.tree_role, t.owner_id, t.created_at
FROM public.trees t
WHERE t.owner_id IS NOT NULL
ON CONFLICT (tree_id, user_id) DO NOTHING;

-- Backfill 'member' para todos los que ya tienen manzana enlazada
INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by, granted_at)
SELECT DISTINCT m.tree_id, m.user_id, 'member'::public.tree_role, NULL::UUID, NOW()
FROM public.members m
WHERE m.user_id IS NOT NULL
ON CONFLICT (tree_id, user_id) DO NOTHING;


-- 4. HELPER: is_tree_admin(tree_id) ------------------------------------------
--    Devuelve TRUE si el usuario actual es 'owner' o 'admin' del árbol.

CREATE OR REPLACE FUNCTION public.is_tree_admin(p_tree_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tree_admin TO authenticated;


-- 5. RLS DE ESCRITURA EN MEMBERS: reemplaza la de solo-owner ------------------

DROP POLICY IF EXISTS "members_write_own_tree" ON public.members;
DROP POLICY IF EXISTS "members_owner_full_access" ON public.members;

-- 5a) Owners y admins pueden hacer TODO en su árbol
CREATE POLICY "members_admin_full_access" ON public.members FOR ALL TO authenticated
  USING (public.is_tree_admin(tree_id))
  WITH CHECK (public.is_tree_admin(tree_id));

-- 5b) Un miembro puede leer todo su árbol (ya existía en migration 002)
--     No la duplicamos aquí.


-- 6. RPC update_my_member_profile: autoedit de campos personales -------------
--    Solo si:
--      - El caller tiene una manzana enlazada (user_id = auth.uid())
--      - Esa manzana NO está fallecida (date_of_death IS NULL)
--    Y solo puede modificar los campos permitidos abajo. Los NULL se ignoran
--    (COALESCE mantiene el valor actual).

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members;
BEGIN
  SELECT * INTO v_member FROM public.members
  WHERE user_id = auth.uid()
    AND date_of_death IS NULL
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'No autorizado: no tienes manzana enlazada o está marcada como fallecida.';
  END IF;

  UPDATE public.members SET
    nickname    = COALESCE(p_nickname, nickname),
    biography   = COALESCE(p_biography, biography),
    occupation  = COALESCE(p_occupation, occupation),
    nationality = COALESCE(p_nationality, nationality),
    avatar_url  = COALESCE(p_avatar_url, avatar_url),
    avatar_cloudinary_id = COALESCE(p_avatar_cloudinary_id, avatar_cloudinary_id),
    birth_place = COALESCE(p_birth_place, birth_place),
    updated_at  = NOW()
  WHERE id = v_member.id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_member_profile TO authenticated;


-- 7. RPC promote_to_admin / demote_admin -------------------------------------
--    Solo el owner del árbol puede nombrar/quitar admins.

CREATE OR REPLACE FUNCTION public.promote_to_admin(p_tree_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id AND user_id = auth.uid() AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Solo el fundador puede nombrar administradores.';
  END IF;

  INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by, granted_at)
  VALUES (p_tree_id, p_user_id, 'admin'::public.tree_role, auth.uid(), NOW())
  ON CONFLICT (tree_id, user_id) DO UPDATE SET
    role = 'admin'::public.tree_role, granted_by = EXCLUDED.granted_by, granted_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_to_admin TO authenticated;


CREATE OR REPLACE FUNCTION public.demote_admin(p_tree_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id AND user_id = auth.uid() AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Solo el fundador puede quitar administradores.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'El fundador no puede quitarse a sí mismo.';
  END IF;

  UPDATE public.tree_memberships
  SET role = 'member'::public.tree_role, granted_by = auth.uid(), granted_at = NOW()
  WHERE tree_id = p_tree_id AND user_id = p_user_id AND role = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.demote_admin TO authenticated;


-- 8. RPC claim_ownership: sucesión por inactividad ---------------------------
--    Cualquier admin puede reclamar ownership si el owner no ha iniciado
--    sesión en más de 30 días (según tree_memberships.last_active_at).

CREATE OR REPLACE FUNCTION public.claim_ownership(p_tree_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_owner_last_active TIMESTAMPTZ;
  v_current_owner UUID;
BEGIN
  -- 1. Verifica que quien llama es admin del árbol
  SELECT EXISTS (
    SELECT 1 FROM public.tree_memberships
    WHERE tree_id = p_tree_id AND user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo un administrador puede reclamar el ownership.';
  END IF;

  -- 2. Encuentra al owner actual y su última actividad
  SELECT tm.user_id, tm.last_active_at
  INTO v_current_owner, v_owner_last_active
  FROM public.tree_memberships tm
  WHERE tm.tree_id = p_tree_id AND tm.role = 'owner'
  LIMIT 1;

  IF v_current_owner IS NULL THEN
    RAISE EXCEPTION 'Este árbol no tiene fundador activo.';
  END IF;

  IF v_owner_last_active > (NOW() - INTERVAL '30 days') THEN
    RAISE EXCEPTION 'El fundador ha estado activo en los últimos 30 días. No se puede reclamar el ownership.';
  END IF;

  -- 3. Transferir ownership
  UPDATE public.tree_memberships SET role = 'admin'::public.tree_role WHERE tree_id = p_tree_id AND user_id = v_current_owner;
  UPDATE public.tree_memberships SET role = 'owner'::public.tree_role WHERE tree_id = p_tree_id AND user_id = auth.uid();
  UPDATE public.trees SET owner_id = auth.uid() WHERE id = p_tree_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ownership TO authenticated;


-- 9. RPC touch_activity: actualiza last_active_at (llamada en cada login) ----

CREATE OR REPLACE FUNCTION public.touch_tree_activity()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tree_memberships
  SET last_active_at = NOW()
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.touch_tree_activity TO authenticated;


-- 10. AUDIT TRAIL ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_history (
  id           BIGSERIAL PRIMARY KEY,
  member_id    UUID NOT NULL,
  tree_id      UUID,
  changed_by   UUID REFERENCES auth.users(id),
  changed_at   TIMESTAMPTZ DEFAULT NOW(),
  action       TEXT NOT NULL,  -- 'insert' | 'update' | 'delete'
  field_name   TEXT,
  old_value    TEXT,
  new_value    TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_history_member ON public.member_history (member_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_history_tree ON public.member_history (tree_id, changed_at DESC);

ALTER TABLE public.member_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_history_read_authorized" ON public.member_history;
CREATE POLICY "member_history_read_authorized" ON public.member_history FOR SELECT TO authenticated
  USING (
    -- Admins del árbol ven todo el historial
    public.is_tree_admin(tree_id)
    -- El propio miembro también puede ver el historial de su manzana
    OR member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  );


-- 11. Trigger de audit -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.member_history (member_id, tree_id, changed_by, action)
    VALUES (NEW.id, NEW.tree_id, auth.uid(), 'insert');
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.member_history (member_id, tree_id, changed_by, action)
    VALUES (OLD.id, OLD.tree_id, auth.uid(), 'delete');
    RETURN OLD;

  ELSE  -- UPDATE
    IF NEW.first_name IS DISTINCT FROM OLD.first_name THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'first_name', OLD.first_name, NEW.first_name);
    END IF;
    IF NEW.last_name IS DISTINCT FROM OLD.last_name THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'last_name', OLD.last_name, NEW.last_name);
    END IF;
    IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'nickname', OLD.nickname, NEW.nickname);
    END IF;
    IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'date_of_birth', OLD.date_of_birth::TEXT, NEW.date_of_birth::TEXT);
    END IF;
    IF NEW.date_of_death IS DISTINCT FROM OLD.date_of_death THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'date_of_death', OLD.date_of_death::TEXT, NEW.date_of_death::TEXT);
    END IF;
    IF NEW.biography IS DISTINCT FROM OLD.biography THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'biography', OLD.biography, NEW.biography);
    END IF;
    IF NEW.occupation IS DISTINCT FROM OLD.occupation THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'occupation', OLD.occupation, NEW.occupation);
    END IF;
    IF NEW.nationality IS DISTINCT FROM OLD.nationality THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'nationality', OLD.nationality, NEW.nationality);
    END IF;
    IF NEW.birth_place IS DISTINCT FROM OLD.birth_place THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'birth_place', OLD.birth_place, NEW.birth_place);
    END IF;
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
      INSERT INTO public.member_history (member_id, tree_id, changed_by, action, field_name, old_value, new_value)
      VALUES (NEW.id, NEW.tree_id, auth.uid(), 'update', 'avatar_url',
        CASE WHEN OLD.avatar_url IS NOT NULL THEN '(imagen anterior)' END,
        CASE WHEN NEW.avatar_url IS NOT NULL THEN '(imagen nueva)' END);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_member_changes ON public.members;
CREATE TRIGGER trg_log_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.log_member_changes();


-- 12. Helper para el frontend: lista de admins de un árbol -------------------

CREATE OR REPLACE FUNCTION public.get_tree_admins(p_tree_id UUID)
RETURNS TABLE (
  user_id     UUID,
  email       TEXT,
  full_name   TEXT,
  role        public.tree_role,
  granted_at  TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tm.user_id,
         u.email::TEXT,
         (u.raw_user_meta_data->>'full_name')::TEXT AS full_name,
         tm.role,
         tm.granted_at,
         tm.last_active_at
  FROM public.tree_memberships tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tree_id = p_tree_id
    AND tm.role IN ('owner', 'admin')
    -- Solo pueden verla admins del árbol
    AND public.is_tree_admin(p_tree_id)
  ORDER BY tm.role, tm.granted_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_tree_admins TO authenticated;
