-- 024 — Unir dos familias en una sola
--
-- Caso típico: la familia de tu mamá ya existe como árbol aparte y en las dos
-- está la misma gente (tu mamá, tus abuelos…). Al unirlas:
--   • Se conserva el árbol "keep"; el otro ("absorb") se mueve completo a él
--     (manzanas, relaciones, historias, fotos, álbumes, solicitudes…).
--   • Las personas que el usuario confirmó como "la misma" se juntan en una
--     sola manzana: se completan los datos vacíos, se conserva la cuenta, y
--     todo lo que apuntaba a la repetida pasa a la que queda.
--   • Las generaciones del árbol absorbido se alinean con las del que queda.
--   • Los administradores de ambas siguen siéndolo (el fundador del absorbido
--     queda como administrador).
-- Todo ocurre en una sola transacción: si algo falla, no cambia nada.
-- Solo puede hacerlo quien administra las DOS familias.

CREATE OR REPLACE FUNCTION public._can_admin_tree(p_tree UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_tree_admin(p_tree)
    OR EXISTS (SELECT 1 FROM public.trees t WHERE t.id = p_tree AND t.owner_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION public._can_admin_tree(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_admin_tree(UUID) TO authenticated;

-- Cambia una columna de `old` a `new` en una tabla. Si choca con una regla de
-- "único" (p. ej. la misma reacción dos veces), esa fila repetida se elimina.
CREATE OR REPLACE FUNCTION public._repoint(p_table TEXT, p_col TEXT, p_old UUID, p_new UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ctid TID;
BEGIN
  BEGIN
    EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', p_table, p_col, p_col) USING p_new, p_old;
  EXCEPTION WHEN unique_violation THEN
    FOR v_ctid IN EXECUTE format('SELECT ctid FROM public.%I WHERE %I = $1', p_table, p_col) USING p_old LOOP
      BEGIN
        EXECUTE format('UPDATE public.%I SET %I = $1 WHERE ctid = $2', p_table, p_col) USING p_new, v_ctid;
      EXCEPTION WHEN unique_violation THEN
        EXECUTE format('DELETE FROM public.%I WHERE ctid = $1', p_table) USING v_ctid;
      END;
    END LOOP;
  END;
END;
$$;
REVOKE ALL ON FUNCTION public._repoint(TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.merge_family_trees(p_keep UUID, p_absorb UUID, p_pairs JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_demo   CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  r        RECORD;
  c        RECORD;
  v_offset INT;
  v_fill   TEXT;
  v_m1     TEXT;
  v_m2     TEXT;
  v_joined INT;
  v_added  INT;
  v_name   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para unir familias.';
  END IF;
  IF p_keep IS NULL OR p_absorb IS NULL OR p_keep = p_absorb OR v_demo IN (p_keep, p_absorb) THEN
    RAISE EXCEPTION 'Esas familias no se pueden unir.';
  END IF;
  IF NOT (public._can_admin_tree(p_keep) AND public._can_admin_tree(p_absorb)) THEN
    RAISE EXCEPTION 'Solo quien administra las dos familias puede unirlas.';
  END IF;
  PERFORM 1 FROM public.trees WHERE id IN (p_keep, p_absorb) FOR UPDATE;
  IF (SELECT count(*) FROM public.trees WHERE id IN (p_keep, p_absorb)) <> 2 THEN
    RAISE EXCEPTION 'Una de las familias ya no existe.';
  END IF;
  SELECT name INTO v_name FROM public.trees WHERE id = p_keep;

  -- Funciones internas de confianza: el candado de manzanas las deja pasar.
  PERFORM set_config('app.trusted', 'on', true);

  -- ── 1. Parejas "es la misma persona" ──
  DROP TABLE IF EXISTS pg_temp._mp;
  CREATE TEMP TABLE _mp (a UUID PRIMARY KEY, k UUID NOT NULL UNIQUE) ON COMMIT DROP;
  BEGIN
    INSERT INTO _mp (a, k)
    SELECT (e->>'absorb')::UUID, (e->>'keep')::UUID
    FROM jsonb_array_elements(COALESCE(p_pairs, '[]'::jsonb)) e;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Cada persona solo puede juntarse con una.';
  END;
  IF EXISTS (SELECT 1 FROM _mp WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = _mp.a AND m.tree_id = p_absorb))
     OR EXISTS (SELECT 1 FROM _mp WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = _mp.k AND m.tree_id = p_keep)) THEN
    RAISE EXCEPTION 'Alguna persona elegida no pertenece a esas familias.';
  END IF;
  -- Quien tiene cuenta en las dos familias es, por fuerza, la misma persona.
  INSERT INTO _mp (a, k)
  SELECT a.id, k.id
  FROM public.members a JOIN public.members k ON k.user_id = a.user_id
  WHERE a.tree_id = p_absorb AND k.tree_id = p_keep AND a.user_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  IF EXISTS (
    SELECT 1 FROM public.members a JOIN public.members k ON k.user_id = a.user_id
    WHERE a.tree_id = p_absorb AND k.tree_id = p_keep AND a.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM _mp WHERE _mp.a = a.id AND _mp.k = k.id)) THEN
    RAISE EXCEPTION 'Una persona con cuenta en las dos familias debe juntarse con su propia manzana.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM _mp JOIN public.members a ON a.id = _mp.a JOIN public.members k ON k.id = _mp.k
    WHERE a.user_id IS NOT NULL AND k.user_id IS NOT NULL AND a.user_id <> k.user_id) THEN
    RAISE EXCEPTION 'No se pueden juntar dos personas que tienen cuentas distintas.';
  END IF;
  SELECT count(*) INTO v_joined FROM _mp;
  IF v_joined = 0 THEN
    RAISE EXCEPTION 'Elige al menos una persona que esté en las dos familias, para saber dónde se unen.';
  END IF;

  -- ── 2. Alinear generaciones del árbol absorbido ──
  SELECT k.generation - a.generation INTO v_offset
  FROM _mp JOIN public.members a ON a.id = _mp.a JOIN public.members k ON k.id = _mp.k
  WHERE a.generation IS NOT NULL AND k.generation IS NOT NULL
  GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  IF COALESCE(v_offset, 0) <> 0 THEN
    UPDATE public.members SET generation = generation + v_offset
    WHERE tree_id = p_absorb AND generation IS NOT NULL;
  END IF;

  -- ── 3. Completar datos vacíos de la manzana que queda ──
  SELECT string_agg(format('%1$I = COALESCE(k.%1$I, a.%1$I)', column_name), ', ')
  INTO v_fill
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members'
    AND column_name NOT IN ('id', 'tree_id', 'user_id', 'created_at', 'created_by', 'updated_at', 'generation')
    AND data_type <> 'ARRAY'
    AND is_generated = 'NEVER' AND COALESCE(is_identity, 'NO') = 'NO';
  IF v_fill IS NOT NULL THEN
    EXECUTE 'UPDATE public.members k SET ' || v_fill ||
            ' FROM _mp JOIN public.members a ON a.id = _mp.a WHERE k.id = _mp.k';
  END IF;
  -- Listas de personas (padres, parejas…): se juntan las dos.
  FOR c IN SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'members' AND udt_name = '_uuid' LOOP
    EXECUTE format(
      'UPDATE public.members k SET %1$I = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(k.%1$I, ''{}'') || COALESCE(a.%1$I, ''{}'')) x)
       FROM _mp JOIN public.members a ON a.id = _mp.a WHERE k.id = _mp.k', c.column_name);
  END LOOP;
  -- La cuenta pasa a la manzana que queda.
  FOR r IN SELECT _mp.a, _mp.k, a.user_id AS au FROM _mp
           JOIN public.members a ON a.id = _mp.a JOIN public.members k ON k.id = _mp.k
           WHERE a.user_id IS NOT NULL AND k.user_id IS NULL LOOP
    UPDATE public.members SET user_id = NULL WHERE id = r.a;
    UPDATE public.members SET user_id = r.au WHERE id = r.k;
  END LOOP;

  -- ── 4. Todo lo que apuntaba a la repetida, ahora apunta a la que queda ──
  -- Columnas con llave hacia members, o con nombre de manzana (member_id,
  -- member1_id, actor_member_id…), en cualquier tabla.
  FOR c IN
    SELECT DISTINCT kcu.table_name::TEXT AS t, kcu.column_name::TEXT AS col
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = rc.constraint_name AND kcu.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name AND ccu.constraint_schema = rc.unique_constraint_schema
    WHERE kcu.table_schema = 'public' AND ccu.table_schema = 'public' AND ccu.table_name = 'members' AND ccu.column_name = 'id'
    UNION
    SELECT col.table_name::TEXT, col.column_name::TEXT
    FROM information_schema.columns col
    JOIN information_schema.tables tb ON tb.table_schema = col.table_schema AND tb.table_name = col.table_name AND tb.table_type = 'BASE TABLE'
    WHERE col.table_schema = 'public' AND col.udt_name = 'uuid'
      AND col.column_name ~ '(^|_)member_?[12]?_id$'
  LOOP
    FOR r IN SELECT a, k FROM _mp LOOP
      PERFORM public._repoint(c.t, c.col, r.a, r.k);
    END LOOP;
  END LOOP;
  -- Listas de personas dentro de las manzanas (padres, parejas…).
  FOR c IN SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'members' AND udt_name = '_uuid' LOOP
    FOR r IN SELECT a, k FROM _mp LOOP
      EXECUTE format('UPDATE public.members SET %1$I = array_replace(%1$I, $1, $2)
                      WHERE tree_id IN ($3, $4) AND %1$I @> ARRAY[$1]', c.column_name)
        USING r.a, r.k, p_keep, p_absorb;
    END LOOP;
    EXECUTE format('UPDATE public.members SET %1$I = (SELECT COALESCE(array_agg(DISTINCT x), ''{}'') FROM unnest(%1$I) x WHERE x <> id)
                    WHERE tree_id IN ($1, $2) AND %1$I IS NOT NULL
                      AND (cardinality(%1$I) <> (SELECT count(DISTINCT x) FROM unnest(%1$I) x) OR id = ANY(%1$I))', c.column_name)
      USING p_keep, p_absorb;
  END LOOP;

  -- ── 5. Borrar las manzanas repetidas ──
  DELETE FROM public.members WHERE id IN (SELECT a FROM _mp);

  -- ── 6. Administradores y miembros ──
  FOR r IN SELECT user_id, role::TEXT AS role FROM public.tree_memberships WHERE tree_id = p_absorb LOOP
    INSERT INTO public.tree_memberships (tree_id, user_id, role, granted_by, granted_at)
    VALUES (p_keep, r.user_id, (CASE WHEN r.role = 'member' THEN 'member' ELSE 'admin' END)::public.tree_role, auth.uid(), now())
    ON CONFLICT (tree_id, user_id) DO UPDATE SET role =
      (CASE WHEN public.tree_memberships.role::TEXT = 'owner' THEN 'owner'
            WHEN public.tree_memberships.role::TEXT = 'admin' OR EXCLUDED.role::TEXT = 'admin' THEN 'admin'
            ELSE 'member' END)::public.tree_role;
  END LOOP;
  DELETE FROM public.tree_memberships WHERE tree_id = p_absorb;

  -- ── 7. Mudar todo lo demás al árbol que queda ──
  SELECT count(*) INTO v_added FROM public.members WHERE tree_id = p_absorb;
  UPDATE public.members SET tree_id = p_keep WHERE tree_id = p_absorb;
  FOR c IN
    SELECT col.table_name::TEXT AS t
    FROM information_schema.columns col
    JOIN information_schema.tables tb ON tb.table_schema = col.table_schema AND tb.table_name = col.table_name AND tb.table_type = 'BASE TABLE'
    WHERE col.table_schema = 'public' AND col.column_name = 'tree_id' AND col.udt_name = 'uuid'
      AND col.table_name NOT IN ('members', 'trees', 'tree_memberships')
  LOOP
    PERFORM public._repoint(c.t, 'tree_id', p_absorb, p_keep);
  END LOOP;

  -- ── 8. Relaciones: sin repetidas ni consigo mismo ──
  SELECT
    (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'relationships' AND column_name IN ('member1_id', 'member_1_id') LIMIT 1),
    (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'relationships' AND column_name IN ('member2_id', 'member_2_id') LIMIT 1)
  INTO v_m1, v_m2;
  IF v_m1 IS NOT NULL AND v_m2 IS NOT NULL THEN
    EXECUTE format('DELETE FROM public.relationships WHERE tree_id = $1 AND %I = %I', v_m1, v_m2) USING p_keep;
    EXECUTE format(
      'DELETE FROM public.relationships r USING public.relationships o
       WHERE r.tree_id = $1 AND o.tree_id = $1 AND r.relationship::TEXT = o.relationship::TEXT AND r.id > o.id
         AND LEAST(r.%1$I, r.%2$I) = LEAST(o.%1$I, o.%2$I) AND GREATEST(r.%1$I, r.%2$I) = GREATEST(o.%1$I, o.%2$I)', v_m1, v_m2)
      USING p_keep;
  END IF;

  -- ── 9. El árbol absorbido deja de existir ──
  DELETE FROM public.trees WHERE id = p_absorb;

  RETURN jsonb_build_object('tree_id', p_keep, 'name', v_name, 'joined', v_joined, 'added', v_added, 'generation_shift', COALESCE(v_offset, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.merge_family_trees(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_family_trees(UUID, UUID, JSONB) TO authenticated;
