-- =============================================================================
-- Migration 021 — Varias familias por persona
-- =============================================================================
-- Cada persona puede pertenecer a varios árboles (p.ej. Familia Elías y
-- Familia Fuentes) y fundar el de la otra rama de su familia.
--
--  1. Una cuenta = una manzana POR ÁRBOL (antes: una en total).
--  2. trees.surname: apellido de la familia (para sugerir y evitar duplicados).
--  3. get_my_families(): mis árboles.
--  4. find_family_trees(apellidos): árboles de mis familiares con esos apellidos.
--  5. create_family_tree(): crea "Familia X" copiando a mí, a mi papá/mamá y a
--     sus hijos desde el árbol actual. Yo soy el fundador.
--  6. rename_family_tree(): el fundador/admin cambia el nombre.
--  7. Solicitudes para unirse (tree_join_requests) + request/answer.
--  8. update_my_member_profile: acepta el árbol (p_tree_id).
--
-- Requiere 015 y 017. Idempotente.
-- =============================================================================

BEGIN;

-- 1. UNA MANZANA POR ÁRBOL ------------------------------------------------------

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_user_id_unique;
DO $$
BEGIN
  ALTER TABLE public.members ADD CONSTRAINT members_tree_user_unique UNIQUE (tree_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;


-- 2. APELLIDO DE LA FAMILIA -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.norm_surname(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    regexp_replace(
      translate(lower(btrim(COALESCE(p, ''))), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'),
      '\s+', ' ', 'g'),
    '');
$$;

ALTER TABLE public.trees ADD COLUMN IF NOT EXISTS surname TEXT;
CREATE INDEX IF NOT EXISTS idx_trees_surname ON public.trees (surname);

-- Árboles existentes con familia: el primer apellido más común.
UPDATE public.trees t
SET surname = s.sur
FROM (
  SELECT DISTINCT ON (tree_id) tree_id, sur
  FROM (
    SELECT tree_id, public.norm_surname(split_part(btrim(last_name), ' ', 1)) AS sur, count(*) AS n
    FROM public.members
    WHERE COALESCE(btrim(last_name), '') <> ''
    GROUP BY 1, 2
  ) c
  WHERE sur IS NOT NULL
  ORDER BY tree_id, n DESC
) s
WHERE s.tree_id = t.id
  AND t.surname IS NULL
  AND (SELECT count(*) FROM public.members m WHERE m.tree_id = t.id) > 1;


-- 3. MIS FAMILIAS ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_families()
RETURNS TABLE (
  tree_id      UUID,
  tree_name    TEXT,
  surname      TEXT,
  role         TEXT,
  member_count BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.surname,
         CASE WHEN t.owner_id = auth.uid() THEN 'owner'
              ELSE COALESCE((SELECT tm.role::TEXT FROM public.tree_memberships tm
                             WHERE tm.tree_id = t.id AND tm.user_id = auth.uid()), 'member')
         END,
         (SELECT count(*) FROM public.members m WHERE m.tree_id = t.id),
         t.created_at
  FROM public.trees t
  WHERE auth.uid() IS NOT NULL
    AND t.id <> '00000000-0000-0000-0000-000000000001'::UUID
    AND (t.owner_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.tree_memberships tm WHERE tm.tree_id = t.id AND tm.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.members m WHERE m.tree_id = t.id AND m.user_id = auth.uid()))
  ORDER BY t.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_families() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_families() FROM anon;


-- 4. FAMILIAS DE MIS FAMILIARES CON ESOS APELLIDOS ------------------------------
-- Solo árboles cuyo fundador comparte algún árbol conmigo (un familiar) y a
-- los que todavía no pertenezco. Devuelve el estado de mi solicitud, si hay.

CREATE TABLE IF NOT EXISTS public.tree_join_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id        UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL DEFAULT auth.uid(),
  requester_name TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by     UUID,
  decided_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_join_request_pending
  ON public.tree_join_requests (tree_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_join_requests_tree
  ON public.tree_join_requests (tree_id, status, created_at DESC);

ALTER TABLE public.tree_join_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "join_requests_read"   ON public.tree_join_requests;
DROP POLICY IF EXISTS "join_requests_cancel" ON public.tree_join_requests;
CREATE POLICY "join_requests_read" ON public.tree_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_tree_admin(tree_id));
CREATE POLICY "join_requests_cancel" ON public.tree_join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');
-- Crear y responder solo por las funciones de abajo.
REVOKE ALL ON public.tree_join_requests FROM anon;
REVOKE INSERT, UPDATE ON public.tree_join_requests FROM authenticated;
GRANT SELECT, DELETE ON public.tree_join_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.find_family_trees(p_surnames TEXT[])
RETURNS TABLE (
  tree_id        UUID,
  tree_name      TEXT,
  surname        TEXT,
  owner_name     TEXT,
  request_status TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.surname,
         COALESCE(
           (SELECT trim(m.first_name || ' ' || COALESCE(m.last_name, ''))
            FROM public.members m WHERE m.tree_id = t.id AND m.user_id = t.owner_id LIMIT 1),
           (SELECT u.full_name FROM public.users u WHERE u.id = t.owner_id),
           'un familiar'),
         (SELECT r.status FROM public.tree_join_requests r
          WHERE r.tree_id = t.id AND r.user_id = auth.uid()
          ORDER BY r.created_at DESC LIMIT 1)
  FROM public.trees t
  WHERE auth.uid() IS NOT NULL
    AND t.surname IS NOT NULL
    AND t.surname = ANY (SELECT public.norm_surname(s) FROM unnest(COALESCE(p_surnames, '{}')) s LIMIT 10)
    AND t.id <> '00000000-0000-0000-0000-000000000001'::UUID
    AND NOT public.is_tree_member(t.id)
    AND public.shares_tree_with(t.owner_id)
  ORDER BY t.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.find_family_trees(TEXT[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.find_family_trees(TEXT[]) FROM anon;


-- Copia una manzana a otro árbol (todas las columnas copiables, sin padres,
-- cuenta ni posición). Uso interno.
CREATE OR REPLACE FUNCTION public._copy_member(p_src UUID, p_tree UUID, p_user UUID, p_created_by UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cols TEXT;
  v_new  UUID := gen_random_uuid();
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members'
    AND is_generated = 'NEVER'
    AND column_name NOT IN ('id', 'tree_id', 'user_id', 'parents', 'created_by',
                            'created_at', 'updated_at', 'canvas_x', 'canvas_y', 'notes');
  EXECUTE format(
    'INSERT INTO public.members (id, tree_id, user_id, created_by, %1$s)
     SELECT $1, $2, $3, $4, %1$s FROM public.members WHERE id = $5', v_cols)
  USING v_new, p_tree, p_user, p_created_by, p_src;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public._copy_member(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;


-- 5. CREAR UNA FAMILIA NUEVA ----------------------------------------------------
-- p_source_tree + p_seed: manzanas del árbol actual que se copian (yo, mi
-- papá o mamá y sus hijos). Mi copia queda enlazada a mi cuenta; las demás
-- quedan sin cuenta, listas para invitarlas.

CREATE OR REPLACE FUNCTION public.create_family_tree(
  p_surname     TEXT,
  p_source_tree UUID   DEFAULT NULL,
  p_seed        UUID[] DEFAULT '{}'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_norm    TEXT := public.norm_surname(p_surname);
  v_display TEXT;
  v_tree    UUID;
  v_me_src  UUID;
  v_seed    UUID[];
  v_map     JSONB := '{}';
  v_src     UUID;
  v_new     UUID;
  v_cols    TEXT;
  v_dup     TEXT;
  v_email   TEXT;
  v_name    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para crear una familia.';
  END IF;
  IF v_norm IS NULL OR length(v_norm) > 40 THEN
    RAISE EXCEPTION 'Escribe el apellido de la familia (máximo 40 letras).';
  END IF;

  -- No duplicar: ¿ya existe esa familia entre mis árboles o los de mis familiares?
  SELECT t.name INTO v_dup
  FROM public.trees t
  WHERE t.surname = v_norm
    AND (public.is_tree_member(t.id) OR public.shares_tree_with(t.owner_id))
  LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe "%" en tu familia. Pide unirte en lugar de crear otra.', v_dup;
  END IF;

  -- Límite anti-abuso
  IF (SELECT count(*) FROM public.trees WHERE owner_id = v_uid AND created_at > NOW() - INTERVAL '1 day') >= 5 THEN
    RAISE EXCEPTION 'Ya creaste varias familias hoy. Intenta mañana.';
  END IF;

  -- Validar el árbol de origen y las manzanas a copiar
  IF p_source_tree IS NOT NULL THEN
    IF NOT public.is_tree_member(p_source_tree) THEN
      RAISE EXCEPTION 'No perteneces a ese árbol.';
    END IF;
    SELECT id INTO v_me_src FROM public.members WHERE tree_id = p_source_tree AND user_id = v_uid;
    IF v_me_src IS NULL THEN
      RAISE EXCEPTION 'No tienes manzana en ese árbol.';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_seed
    FROM unnest(COALESCE(p_seed, '{}') || v_me_src) x;
    IF cardinality(v_seed) > 60 THEN
      RAISE EXCEPTION 'Demasiadas personas para copiar.';
    END IF;
    IF (SELECT count(*) FROM public.members WHERE id = ANY (v_seed) AND tree_id = p_source_tree) <> cardinality(v_seed) THEN
      RAISE EXCEPTION 'Algunas personas no pertenecen a tu árbol.';
    END IF;
  END IF;

  -- Nombre visible: "Familia Fuentes" (respeta acentos tal como se escribió)
  v_display := initcap(regexp_replace(btrim(p_surname), '\s+', ' ', 'g'));

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO public.users (id, email, full_name)
  VALUES (v_uid, COALESCE(v_email, ''), split_part(COALESCE(v_email, 'Familiar'), '@', 1))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trees (owner_id, name, surname, default_privacy, is_public_legacy)
  VALUES (v_uid, 'Familia ' || v_display, v_norm, 'core', FALSE)
  RETURNING id INTO v_tree;
  -- (el trigger trg_tree_owner_membership me hace 'owner')

  PERFORM set_config('app.trusted', 'on', true);

  IF p_source_tree IS NOT NULL THEN
    FOREACH v_src IN ARRAY v_seed LOOP
      v_new := public._copy_member(v_src, v_tree,
                 CASE WHEN v_src = v_me_src THEN v_uid ELSE NULL END, v_uid);
      v_map := v_map || jsonb_build_object(v_src::TEXT, v_new::TEXT);
    END LOOP;

    -- Padres: solo los que también se copiaron
    UPDATE public.members n
    SET parents = ARRAY(
          SELECT (v_map ->> p::TEXT)::UUID
          FROM unnest(COALESCE(o.parents, '{}')) p
          WHERE v_map ? p::TEXT)
    FROM public.members o
    WHERE o.id = ANY (v_seed)
      AND n.id = (v_map ->> o.id::TEXT)::UUID;

    -- Relaciones (pareja, etc.) entre personas copiadas
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'relationships'
      AND is_generated = 'NEVER'
      AND column_name NOT IN ('id', 'tree_id', 'member_1_id', 'member_2_id', 'created_by', 'created_at');
    EXECUTE format(
      'INSERT INTO public.relationships (tree_id, member_1_id, member_2_id, created_by%1$s)
       SELECT $1, ($2 ->> r.member_1_id::TEXT)::UUID, ($2 ->> r.member_2_id::TEXT)::UUID, $3%2$s
       FROM public.relationships r
       WHERE r.tree_id = $4 AND $2 ? r.member_1_id::TEXT AND $2 ? r.member_2_id::TEXT
       ON CONFLICT DO NOTHING',
      CASE WHEN v_cols IS NULL THEN '' ELSE ', ' || v_cols END,
      CASE WHEN v_cols IS NULL THEN '' ELSE ', ' || (SELECT string_agg('r.' || c, ', ') FROM unnest(string_to_array(v_cols, ', ')) c) END)
    USING v_tree, v_map, v_uid, p_source_tree;
  ELSE
    -- Sin árbol de origen: solo yo, con mi nombre de otra manzana o del correo
    SELECT trim(first_name) INTO v_name FROM public.members
    WHERE user_id = v_uid ORDER BY created_at LIMIT 1;
    INSERT INTO public.members (tree_id, user_id, created_by, first_name, last_name, generation, apple_type)
    VALUES (v_tree, v_uid, v_uid,
            COALESCE(NULLIF(v_name, ''), split_part(COALESCE(v_email, 'Yo'), '@', 1)),
            v_display, 0, 'red');
  END IF;

  PERFORM set_config('app.trusted', 'off', true);

  BEGIN
    INSERT INTO public.activities (tree_id, actor_user_id, activity_type, title, description, privacy)
    VALUES (v_tree, v_uid, 'new_member', 'Familia creada',
            'Comenzó el árbol de la Familia ' || v_display || '.', 'core');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_tree;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_family_tree(TEXT, UUID, UUID[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_family_tree(TEXT, UUID, UUID[]) FROM anon;


-- 6. CAMBIAR EL NOMBRE ----------------------------------------------------------

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
  UPDATE public.trees SET name = v_name, surname = COALESCE(surname, v_sur), updated_at = NOW()
  WHERE id = p_tree;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rename_family_tree(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rename_family_tree(UUID, TEXT) FROM anon;


-- 7. SOLICITUDES PARA UNIRSE ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_join_tree(p_tree UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_owner UUID;
  v_tname TEXT;
  v_name  TEXT;
  v_id    UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión.'; END IF;
  SELECT owner_id, name INTO v_owner, v_tname FROM public.trees WHERE id = p_tree;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Esa familia no existe.'; END IF;
  IF public.is_tree_member(p_tree) THEN RAISE EXCEPTION 'Ya perteneces a esa familia.'; END IF;
  IF NOT public.shares_tree_with(v_owner) THEN
    RAISE EXCEPTION 'Solo puedes pedir unirte a familias de tus familiares.';
  END IF;

  SELECT id INTO v_id FROM public.tree_join_requests
  WHERE tree_id = p_tree AND user_id = v_uid AND status = 'pending';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF (SELECT count(*) FROM public.tree_join_requests
      WHERE user_id = v_uid AND created_at > NOW() - INTERVAL '1 day') >= 10 THEN
    RAISE EXCEPTION 'Enviaste muchas solicitudes hoy. Intenta mañana.';
  END IF;

  SELECT trim(first_name || ' ' || COALESCE(last_name, '')) INTO v_name
  FROM public.members WHERE user_id = v_uid ORDER BY created_at LIMIT 1;

  INSERT INTO public.tree_join_requests (tree_id, user_id, requester_name)
  VALUES (p_tree, v_uid, COALESCE(v_name, 'Un familiar'))
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.notifications (user_id, tree_id, type, title, body, action, related_id, sender_id, is_important)
    SELECT tm.user_id, p_tree, 'join_request',
           COALESCE(v_name, 'Un familiar') || ' quiere unirse',
           'Pidió entrar a ' || v_tname || '. Revisa la solicitud.',
           'open_suggestions', v_id, v_uid, TRUE
    FROM public.tree_memberships tm
    WHERE tm.tree_id = p_tree AND tm.role IN ('owner', 'admin');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_join_tree(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_join_tree(UUID) FROM anon;

-- Aprobar: p_member_id = la manzana que ya existe para esa persona (sin cuenta),
-- o NULL para agregarla como manzana nueva (copia de su manzana en otro árbol).
CREATE OR REPLACE FUNCTION public.answer_join_request(
  p_request   UUID,
  p_approve   BOOLEAN,
  p_member_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req   public.tree_join_requests;
  v_src   UUID;
  v_tname TEXT;
  v_m     public.members;
BEGIN
  SELECT * INTO v_req FROM public.tree_join_requests WHERE id = p_request FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  IF NOT public.is_tree_admin(v_req.tree_id) THEN
    RAISE EXCEPTION 'Solo el fundador o un administrador puede responder.';
  END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Esa solicitud ya se respondió.'; END IF;

  SELECT name INTO v_tname FROM public.trees WHERE id = v_req.tree_id;

  IF p_approve THEN
    PERFORM set_config('app.trusted', 'on', true);
    IF EXISTS (SELECT 1 FROM public.members WHERE tree_id = v_req.tree_id AND user_id = v_req.user_id) THEN
      NULL;  -- ya tiene manzana aquí
    ELSIF p_member_id IS NOT NULL THEN
      SELECT * INTO v_m FROM public.members WHERE id = p_member_id FOR UPDATE;
      IF v_m.id IS NULL OR v_m.tree_id <> v_req.tree_id THEN
        RAISE EXCEPTION 'Esa manzana no es de esta familia.';
      END IF;
      IF v_m.user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Esa manzana ya pertenece a otra cuenta.';
      END IF;
      IF v_m.date_of_death IS NOT NULL THEN
        RAISE EXCEPTION 'Esa manzana está marcada como fallecida.';
      END IF;
      UPDATE public.members SET user_id = v_req.user_id WHERE id = p_member_id;
    ELSE
      SELECT id INTO v_src FROM public.members
      WHERE user_id = v_req.user_id ORDER BY created_at LIMIT 1;
      IF v_src IS NOT NULL THEN
        PERFORM public._copy_member(v_src, v_req.tree_id, v_req.user_id, auth.uid());
      ELSE
        INSERT INTO public.members (tree_id, user_id, created_by, first_name, last_name, generation, apple_type)
        VALUES (v_req.tree_id, v_req.user_id, auth.uid(),
                COALESCE(NULLIF(split_part(v_req.requester_name, ' ', 1), ''), 'Familiar'),
                COALESCE(NULLIF(btrim(substr(v_req.requester_name, length(split_part(v_req.requester_name, ' ', 1)) + 1)), ''), ''),
                0, 'red');
      END IF;
    END IF;
    PERFORM set_config('app.trusted', 'off', true);

    INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by)
    VALUES (v_req.tree_id, v_req.user_id, 'member', auth.uid())
    ON CONFLICT (tree_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.tree_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = auth.uid(), decided_at = NOW()
  WHERE id = p_request;

  BEGIN
    INSERT INTO public.notifications (user_id, tree_id, type, title, body, action, related_id, sender_id, is_important)
    VALUES (v_req.user_id, v_req.tree_id, 'join_answered',
            CASE WHEN p_approve THEN 'Ya eres parte de ' || v_tname ELSE 'Revisaron tu solicitud' END,
            CASE WHEN p_approve THEN 'Elige la familia en la lista de arriba para verla.'
                 ELSE 'Tu solicitud para unirte a ' || v_tname || ' no fue aprobada.' END,
            CASE WHEN p_approve THEN 'open_tree' ELSE NULL END,
            v_req.tree_id, auth.uid(), p_approve);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.answer_join_request(UUID, BOOLEAN, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.answer_join_request(UUID, BOOLEAN, UUID) FROM anon;


-- 8. EDITAR MI PERFIL EN UN ÁRBOL CONCRETO ------------------------------------

DROP FUNCTION IF EXISTS public.update_my_member_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_my_member_profile(
  p_nickname    TEXT DEFAULT NULL,
  p_biography   TEXT DEFAULT NULL,
  p_occupation  TEXT DEFAULT NULL,
  p_nationality TEXT DEFAULT NULL,
  p_avatar_url  TEXT DEFAULT NULL,
  p_avatar_cloudinary_id TEXT DEFAULT NULL,
  p_birth_place TEXT DEFAULT NULL,
  p_tree_id     UUID DEFAULT NULL
)
RETURNS public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.members;
BEGIN
  SELECT * INTO v_member FROM public.members
  WHERE user_id = auth.uid() AND date_of_death IS NULL
    AND (p_tree_id IS NULL OR tree_id = p_tree_id)
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
GRANT EXECUTE ON FUNCTION public.update_my_member_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_member_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM anon;

COMMIT;

-- Revisión: mis árboles después de aplicar
SELECT name AS familia, surname AS apellido,
       (SELECT count(*) FROM public.members m WHERE m.tree_id = t.id) AS manzanas
FROM public.trees t
ORDER BY manzanas DESC;
