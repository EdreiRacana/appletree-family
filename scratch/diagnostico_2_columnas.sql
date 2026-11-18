-- Diagnóstico 2, solo lectura: NO cambia nada.
-- Pegar en Supabase → SQL Editor → Run, y copiar el resultado (JSON) completo.
select json_build_object(
  'columnas', (
    select json_object_agg(t.table_name, t.cols)
    from (
      select table_name,
             json_agg(column_name || ':' || udt_name || case when is_nullable = 'NO' then '!' else '' end
                      order by ordinal_position) as cols
      from information_schema.columns
      where table_schema = 'public'
      group by table_name
    ) t
  ),
  'conteos', json_build_object(
    'trees', (select count(*) from public.trees),
    'members', (select count(*) from public.members),
    'members_con_cuenta', (select count(*) from public.members where user_id is not null),
    'relationships', (select count(*) from public.relationships),
    'activities', (select count(*) from public.activities),
    'invites', (select count(*) from public.invites),
    'invites_aceptadas', (select count(*) from public.invites where accepted_at is not null),
    'usuarios_auth', (select count(*) from auth.users),
    'membresias_por_rol', (select json_object_agg(role, n) from (select role, count(*) n from public.tree_memberships group by role) x),
    'arboles_sin_owner_en_membresias', (
      select count(*) from public.trees t
      where t.owner_id is not null and not exists (
        select 1 from public.tree_memberships tm where tm.tree_id = t.id and tm.user_id = t.owner_id and tm.role = 'owner'))
  ),
  'enums', (
    select json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ),
  'funciones_def', (
    select json_object_agg(p.proname, pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('bootstrap_user_tree', 'handle_new_user', 'log_member_changes',
                        'update_my_member_profile', 'is_tree_admin', 'dispatch_push_on_notif')
  ),
  'triggers_auth', (
    select json_agg(json_build_object('tabla', event_object_table, 'nombre', trigger_name, 'accion', action_statement))
    from information_schema.triggers where event_object_schema = 'auth'
  ),
  'grants_anon', (
    select json_agg(distinct table_name)
    from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
  )
) as diagnostico_2;
