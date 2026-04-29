-- =====================================================================
-- Byvaro · Bridge views en `api` schema
-- ---------------------------------------------------------------------
-- Este proyecto Supabase está configurado para exponer el schema `api`
-- (no `public`) vía PostgREST. Como las tablas viven en `public`, creamos
-- views en `api` con `security_invoker = on` para que el caller mantenga
-- sus privilegios y RLS se aplique correctamente sobre las tablas base.
--
-- Se generan dinámicamente para todas las tablas business · si añades
-- una nueva tabla en `public`, ejecuta este script otra vez para crear
-- la view correspondiente en `api`.
-- =====================================================================

do $$
declare t record;
declare colspec text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('drop view if exists api.%I cascade;', t.tablename);
    execute format(
      'create view api.%I with (security_invoker = on) as select * from public.%I;',
      t.tablename, t.tablename
    );
    /* Permisos · authenticated y anon pueden leer; las RLS policies de
     * public.* siguen aplicando porque security_invoker se respeta. */
    execute format('grant select on api.%I to anon, authenticated;', t.tablename);
    execute format('grant insert, update, delete on api.%I to authenticated;', t.tablename);
  end loop;
end $$;

-- Notificar a PostgREST que recargue el cache.
notify pgrst, 'reload schema';
