-- 023 — Resumen semanal por correo
-- • users.weekly_digest: cada quien decide si lo recibe (activo por defecto).
-- • users.digest_token: enlace "darme de baja" sin iniciar sesión.
-- • weekly_digest_payload(): junta lo de la semana por familia. Solo la usa
--   el servidor (GitHub Actions con la conexión directa); nadie desde la app.
-- • digest_unsubscribe(token): la página /baja la llama sin sesión.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS digest_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS users_digest_token_key ON public.users (digest_token);

-- ── Aniversarios (cumpleaños / fallecimiento) ──────────────────────────────
-- 29-feb cae en 28-feb los años no bisiestos.
CREATE OR REPLACE FUNCTION public._anniv_in(d DATE, y INT)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT make_date(
    y,
    extract(month FROM d)::int,
    CASE WHEN extract(month FROM d) = 2 AND extract(day FROM d) = 29
              AND NOT ((y % 4 = 0 AND y % 100 <> 0) OR y % 400 = 0)
         THEN 28 ELSE extract(day FROM d)::int END)
$$;

CREATE OR REPLACE FUNCTION public._next_anniv(d DATE, today DATE)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public._anniv_in(d, extract(year FROM today)::int) >= today
              THEN public._anniv_in(d, extract(year FROM today)::int)
              ELSE public._anniv_in(d, extract(year FROM today)::int + 1) END
$$;

-- ── Contenido del resumen ───────────────────────────────────────────────────
-- Devuelve un arreglo: una entrada por persona con correo, con sus familias.
--   próximos 7 días: cumpleaños (vivos) y recuerdos (finados)
--   últimos 7 días: familiares nuevos, historias nuevas y fotos nuevas
CREATE OR REPLACE FUNCTION public.weekly_digest_payload(
  p_today DATE DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date
)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH recips AS (
  SELECT u.id AS user_id, u.email, u.digest_token, m.tree_id, m.id AS my_member_id,
         COALESCE(NULLIF(m.first_name, ''), split_part(COALESCE(u.full_name, ''), ' ', 1)) AS first_name
  FROM public.members m
  JOIN public.users u ON u.id = m.user_id
  WHERE u.weekly_digest
    AND u.email IS NOT NULL AND u.email LIKE '%@%' AND u.email NOT LIKE '%@invite.local'
    AND m.tree_id <> '00000000-0000-0000-0000-000000000001'
),
fam AS (
  SELECT t.id AS tree_id,
    COALESCE(NULLIF(t.name, ''), 'Tu familia') AS name,
    (SELECT count(*) FROM public.members x WHERE x.tree_id = t.id) AS members_total,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'member_id', b.id, 'name', trim(b.first_name || ' ' || COALESCE(b.last_name, '')),
               'avatar', b.avatar_url, 'date', b.next_day,
               'turns', extract(year FROM b.next_day)::int - extract(year FROM b.date_of_birth)::int)
             ORDER BY b.next_day)
      FROM (SELECT x.*, public._next_anniv(x.date_of_birth, p_today) AS next_day
            FROM public.members x
            WHERE x.tree_id = t.id AND x.date_of_birth IS NOT NULL AND x.date_of_death IS NULL) b
      WHERE b.next_day < p_today + 7), '[]'::jsonb) AS birthdays,
    COALESCE((
      SELECT jsonb_agg(r ORDER BY r->>'date')
      FROM (
        SELECT jsonb_build_object('member_id', x.id, 'name', trim(x.first_name || ' ' || COALESCE(x.last_name, '')),
                 'avatar', x.avatar_url, 'kind', 'birth', 'date', public._next_anniv(x.date_of_birth, p_today),
                 'years', extract(year FROM public._next_anniv(x.date_of_birth, p_today))::int - extract(year FROM x.date_of_birth)::int) AS r
        FROM public.members x
        WHERE x.tree_id = t.id AND x.date_of_death IS NOT NULL AND x.date_of_birth IS NOT NULL
          AND public._next_anniv(x.date_of_birth, p_today) < p_today + 7
        UNION ALL
        SELECT jsonb_build_object('member_id', x.id, 'name', trim(x.first_name || ' ' || COALESCE(x.last_name, '')),
                 'avatar', x.avatar_url, 'kind', 'death', 'date', public._next_anniv(x.date_of_death, p_today),
                 'years', extract(year FROM public._next_anniv(x.date_of_death, p_today))::int - extract(year FROM x.date_of_death)::int)
        FROM public.members x
        WHERE x.tree_id = t.id AND x.date_of_death IS NOT NULL
          AND public._next_anniv(x.date_of_death, p_today) < p_today + 7
          AND public._next_anniv(x.date_of_death, p_today) <> x.date_of_death   -- no el mismo día que falleció
      ) s), '[]'::jsonb) AS remembrances,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('member_id', x.id, 'name', trim(x.first_name || ' ' || COALESCE(x.last_name, '')),
               'avatar', x.avatar_url) ORDER BY x.created_at)
      FROM public.members x
      WHERE x.tree_id = t.id AND x.created_at >= p_today - 7), '[]'::jsonb) AS new_members,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', a.title, 'image', a.image_url,
               'author', NULLIF(split_part(COALESCE(au.full_name, ''), ' ', 1), '')) ORDER BY a.created_at DESC)
      FROM public.activities a
      LEFT JOIN public.users au ON au.id = a.created_by
      WHERE a.tree_id = t.id AND a.type IN ('photo_upload', 'achievement')
        AND a.created_at >= p_today - 7), '[]'::jsonb) AS stories,
    (SELECT count(*) FROM public.photos p WHERE p.tree_id = t.id AND p.created_at >= p_today - 7) AS photos_new
  FROM public.trees t
  WHERE t.id IN (SELECT tree_id FROM recips)
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
         'email', g.email, 'first_name', g.first_name, 'token', g.digest_token, 'families', g.families)), '[]'::jsonb)
FROM (
  SELECT r.user_id, r.email, r.digest_token, min(r.first_name) AS first_name,
         jsonb_agg(jsonb_build_object(
           'tree_id', f.tree_id, 'name', f.name, 'members_total', f.members_total,
           'my_member_id', r.my_member_id,
           'birthdays', f.birthdays, 'remembrances', f.remembrances,
           'new_members', f.new_members, 'stories', f.stories, 'photos_new', f.photos_new)
           ORDER BY f.name) AS families
  FROM recips r JOIN fam f ON f.tree_id = r.tree_id
  GROUP BY r.user_id, r.email, r.digest_token
) g
$$;

REVOKE ALL ON FUNCTION public.weekly_digest_payload(DATE) FROM PUBLIC, anon, authenticated;

-- ── Darse de baja con el enlace del correo ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.digest_unsubscribe(p_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  UPDATE public.users SET weekly_digest = FALSE WHERE digest_token = p_token;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.digest_unsubscribe(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.digest_unsubscribe(UUID) TO anon, authenticated;
