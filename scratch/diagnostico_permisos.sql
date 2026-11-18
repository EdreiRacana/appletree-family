-- Diagnóstico de solo lectura: NO cambia nada.
-- Pegar en Supabase → SQL Editor → Run, y copiar el resultado (JSON) completo.
select json_build_object(
  'tablas', (
    select json_agg(json_build_object('tabla', c.relname, 'rls', c.relrowsecurity) order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'politicas', (
    select json_agg(json_build_object(
      'esquema', schemaname, 'tabla', tablename, 'nombre', policyname,
      'accion', cmd, 'roles', roles, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies where schemaname in ('public', 'storage')
  ),
  'funciones', (
    select json_agg(json_build_object('nombre', p.proname, 'security_definer', p.prosecdef) order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  'triggers', (
    select json_agg(json_build_object('tabla', event_object_table, 'nombre', trigger_name) order by event_object_table)
    from information_schema.triggers where trigger_schema = 'public'
  ),
  'buckets', (
    select json_agg(json_build_object('id', id, 'publico', public)) from storage.buckets
  ),
  'membresias', (
    select json_agg(json_build_object('tabla', table_name, 'columna', column_name, 'tipo', data_type) order by table_name, ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name in ('tree_memberships', 'members', 'invites', 'trees')
  )
) as diagnostico;
