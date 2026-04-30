-- =====================================================================
-- Byvaro · tenant public_ref · `IDXXXXXX` aleatoria por organización
-- ---------------------------------------------------------------------
-- Cada organización lleva una referencia pública INMUTABLE de la forma
-- `ID` + 6 caracteres del alfabeto sin ambigüedades (sin 0/O/1/I/L) ·
-- 32^6 ≈ 1.07 mil millones de combinaciones.
--
-- · Aleatoria · imposible deducir orden de registro.
-- · Única global · enforce vía UNIQUE INDEX.
-- · Auto-generada al INSERT si la columna queda NULL.
-- · Inmutable después del primer set (trigger BEFORE UPDATE).
-- · Visible públicamente (no es secreto · usable como handle externo).
--
-- Base para `tenant_links` y cualquier sistema de cross-tenant
-- discovery futuro (invite by ref, marketplace search, etc.).
-- =====================================================================

alter table public.organizations
  add column if not exists public_ref text;

create unique index if not exists idx_organizations_public_ref
  on public.organizations(public_ref) where public_ref is not null;

-- Generador · 6 chars random del alfabeto sin ambigüedades.
-- Alfabeto: A-H J-N P-Z 2-9 (32 chars · sin 0/O/1/I/L · sin minúsculas
-- para que la lectura humana sea unívoca).
create or replace function public.gen_tenant_public_ref()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := 'ID';
  i int;
  attempts int := 0;
begin
  loop
    result := 'ID';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Reintentar si por casualidad ya existe (probabilidad ínfima)
    exit when not exists (
      select 1 from public.organizations where public_ref = result
    );
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'tenant_public_ref · 10 colisiones consecutivas (alfabeto agotado?)';
    end if;
  end loop;
  return result;
end;
$$;

-- Trigger: auto-generar al INSERT si NULL.
create or replace function public.organizations_set_public_ref()
returns trigger
language plpgsql
as $$
begin
  if NEW.public_ref is null then
    NEW.public_ref := public.gen_tenant_public_ref();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_organizations_set_public_ref on public.organizations;
create trigger trg_organizations_set_public_ref
  before insert on public.organizations
  for each row execute function public.organizations_set_public_ref();

-- Trigger inmutabilidad: no permitir UPDATE de public_ref tras el set inicial.
create or replace function public.organizations_protect_public_ref()
returns trigger
language plpgsql
as $$
begin
  if OLD.public_ref is not null and NEW.public_ref is distinct from OLD.public_ref then
    raise exception 'organizations.public_ref es inmutable · no se puede modificar';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_organizations_protect_public_ref on public.organizations;
create trigger trg_organizations_protect_public_ref
  before update on public.organizations
  for each row execute function public.organizations_protect_public_ref();

-- Backfill · todas las orgs existentes sin ref reciben una.
do $$
declare
  r record;
begin
  for r in select id from public.organizations where public_ref is null loop
    update public.organizations
      set public_ref = public.gen_tenant_public_ref()
      where id = r.id;
  end loop;
end $$;

-- Hacer la columna NOT NULL una vez backfilled.
alter table public.organizations
  alter column public_ref set not null;

-- =====================================================================
-- tenant_links · relaciones cross-tenant identificadas por public_ref.
-- ---------------------------------------------------------------------
-- Tabla foundation · cada vínculo entre dos organizaciones se registra
-- aquí usando los `public_ref` (no los ids internos).
--
-- Casos de uso · invitaciones, colaboraciones, referidos, marketplace
-- requests · cualquier "link" entre dos tenants. La tabla NO sustituye
-- a `organization_collaborations` (que es la fuente de verdad de la
-- relación operativa) · es un índice de discovery + auditoría
-- cross-tenant que evita exponer ids internos en URLs / emails / API
-- públicas.
--
-- Cuando aterrice multi-tenant real, los emails de invitación llevan
-- `byvaro.app/i/<from_ref>-<to_ref>-<token>` · el token resuelve la
-- intent y el receptor ve QUIÉN le invita por su ref pública en vez
-- del id interno.
-- =====================================================================

do $$ begin
  create type tenant_link_kind as enum (
    'invitation', 'collaboration', 'referral', 'marketplace_request'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type tenant_link_status as enum (
    'pending', 'active', 'paused', 'closed', 'rejected'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.tenant_links (
  id            uuid primary key default gen_random_uuid(),
  from_ref      text not null,
  to_ref        text not null,
  kind          tenant_link_kind not null,
  status        tenant_link_status not null default 'pending',
  metadata      jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  closed_at     timestamptz,
  constraint tenant_links_distinct check (from_ref <> to_ref)
);

create index if not exists idx_tenant_links_from on public.tenant_links(from_ref, kind, status);
create index if not exists idx_tenant_links_to   on public.tenant_links(to_ref, kind, status);

alter table public.tenant_links enable row level security;

-- RLS · una org ve los links donde es from o to.
drop policy if exists tenant_links_select on public.tenant_links;
create policy tenant_links_select on public.tenant_links
  for select to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where (o.public_ref = tenant_links.from_ref or o.public_ref = tenant_links.to_ref)
        and public.is_org_member(o.id)
    )
  );

-- INSERT · solo desde from_ref (la org actual creando un link saliente).
drop policy if exists tenant_links_insert on public.tenant_links;
create policy tenant_links_insert on public.tenant_links
  for insert to authenticated
  with check (
    exists (
      select 1 from public.organizations o
      where o.public_ref = tenant_links.from_ref
        and public.is_org_member(o.id)
    )
  );

-- UPDATE · ambas orgs (from o to) pueden cambiar el status.
drop policy if exists tenant_links_update on public.tenant_links;
create policy tenant_links_update on public.tenant_links
  for update to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where (o.public_ref = tenant_links.from_ref or o.public_ref = tenant_links.to_ref)
        and public.is_org_member(o.id)
    )
  )
  with check (
    exists (
      select 1 from public.organizations o
      where (o.public_ref = tenant_links.from_ref or o.public_ref = tenant_links.to_ref)
        and public.is_org_member(o.id)
    )
  );

-- Bridge views en api schema.
drop view if exists api.organizations cascade;
create view api.organizations with (security_invoker = on)
  as select * from public.organizations;
grant select on api.organizations to anon, authenticated;
grant insert, update, delete on api.organizations to authenticated;

drop view if exists api.tenant_links cascade;
create view api.tenant_links with (security_invoker = on)
  as select * from public.tenant_links;
grant select on api.tenant_links to authenticated;
grant insert, update, delete on api.tenant_links to authenticated;

grant select on public.organizations to anon, authenticated;
grant insert, update, delete on public.organizations to authenticated, service_role;
grant select on public.tenant_links to authenticated;
grant insert, update, delete on public.tenant_links to authenticated, service_role;

-- RPC pública para resolver una org por su public_ref (descubrir un
-- tenant por su ref sin necesitar acceso a la fila completa).
create or replace function public.find_org_by_ref(p_ref text)
returns table (
  id text,
  public_ref text,
  kind org_kind,
  display_name text,
  legal_name text,
  logo_url text,
  verified boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id, public_ref, kind, display_name, legal_name, logo_url, verified
  from public.organizations
  where public_ref = upper(p_ref)
  limit 1;
$$;

grant execute on function public.find_org_by_ref(text) to anon, authenticated;

notify pgrst, 'reload schema';
