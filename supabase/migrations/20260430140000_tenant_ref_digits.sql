-- =====================================================================
-- Byvaro · tenant public_ref · cambia alfabeto a dígitos
-- ---------------------------------------------------------------------
-- La migración 20260430120000_tenant_public_ref.sql introdujo
-- public_ref con formato `IDXXXXXX` usando 32 chars (sin 0/O/1/I/L).
-- Decisión 2026-04-30 unifica el scheme con el resto de entidades:
--
--   Entidad      | Prefijo | Dígitos | Total
--   -------------+---------+---------+------
--   Tenant       | ID      | 6       | 8
--   Usuario      | US      | 7       | 9
--   Promoción    | PR      | 5       | 7
--   Unidad       | UN      | 8       | 10
--   Registro     | RG      | 9       | 11
--   Contacto     | CO      | 7       | 9
--
-- Solo dígitos `0-9`. Aleatorio · NUNCA secuencial.
--
-- Esta migración:
--   1. Reemplaza `gen_tenant_public_ref()` para usar dígitos.
--   2. UPDATE explícito de las 15 orgs existentes a refs nuevas
--      pre-calculadas (matchean los seeds del frontend).
-- =====================================================================

-- 1. Generador nuevo · dígitos solo.
create or replace function public.gen_tenant_public_ref()
returns text
language plpgsql
as $$
declare
  result text := 'ID';
  i int;
  attempts int := 0;
begin
  loop
    result := 'ID';
    for i in 1..6 loop
      result := result || floor(random() * 10)::int::text;
    end loop;
    exit when not exists (
      select 1 from public.organizations where public_ref = result
    );
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'tenant_public_ref · 20 colisiones (espacio agotado?)';
    end if;
  end loop;
  return result;
end;
$$;

-- 2. UPDATE explícito de las 15 orgs existentes · valores pre-elegidos
--    para que matcheen los seeds del frontend exactamente. Random
--    pero estables en código para que el mock funcione sin DB.
--
--    El trigger `protect_public_ref` (creado en la migración anterior)
--    rechaza UPDATE de public_ref · lo deshabilitamos durante la
--    transición y lo restauramos al final.

alter table public.organizations disable trigger trg_organizations_protect_public_ref;

update public.organizations set public_ref = 'ID384729' where id = 'developer-default';
update public.organizations set public_ref = 'ID172658' where id = 'prom-1';
update public.organizations set public_ref = 'ID859421' where id = 'prom-2';
update public.organizations set public_ref = 'ID936174' where id = 'prom-3';
update public.organizations set public_ref = 'ID457820' where id = 'prom-4';
update public.organizations set public_ref = 'ID284615' where id = 'ag-1';
update public.organizations set public_ref = 'ID718342' where id = 'ag-2';
update public.organizations set public_ref = 'ID503918' where id = 'ag-3';
update public.organizations set public_ref = 'ID846207' where id = 'ag-4';
update public.organizations set public_ref = 'ID129573' where id = 'ag-5';
update public.organizations set public_ref = 'ID634891' where id = 'ag-6';
update public.organizations set public_ref = 'ID275148' where id = 'ag-7';
update public.organizations set public_ref = 'ID968452' where id = 'ag-8';
update public.organizations set public_ref = 'ID416307' where id = 'ag-9';
update public.organizations set public_ref = 'ID739526' where id = 'ag-10';

alter table public.organizations enable trigger trg_organizations_protect_public_ref;

notify pgrst, 'reload schema';
