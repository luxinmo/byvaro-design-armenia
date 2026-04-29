-- =====================================================================
-- Byvaro · Tabla `inmuebles` + RLS
-- ---------------------------------------------------------------------
-- Inmueble = unidad del catálogo del workspace · NO acoplada a una
-- promoción. Multi-tenant scoped por organization_id.
-- =====================================================================

do $$ begin
  create type inmueble_type as enum (
    'piso','casa','atico','duplex','estudio',
    'local','oficina','nave','parking','trastero','terreno'
  );
  create type inmueble_operation as enum (
    'venta','alquiler','alquiler-vacacional','traspaso'
  );
  create type inmueble_status as enum (
    'available','reserved','sold','rented','draft','archived'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.inmuebles (
  id                  text primary key,
  organization_id     text not null references public.organizations(id) on delete cascade,
  reference           text,
  type                inmueble_type not null,
  operation           inmueble_operation not null,
  status              inmueble_status not null default 'available',
  price               numeric(12,2),
  address             text,
  city                text,
  province            text,
  country             text default 'ES',
  bedrooms            int,
  bathrooms           int,
  useful_area_m2      numeric(7,2),
  built_area_m2       numeric(7,2),
  branch_label        text,
  owner_member_id     uuid,
  photos              jsonb,
  description         text,
  tags                text[],
  share_with_network  boolean not null default false,
  is_favorite         boolean default false,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_inmuebles_org_status on public.inmuebles(organization_id, status);
create index if not exists idx_inmuebles_share on public.inmuebles(share_with_network) where share_with_network = true;

drop trigger if exists trg_touch_inmuebles on public.inmuebles;
create trigger trg_touch_inmuebles before update on public.inmuebles
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.inmuebles enable row level security;

drop policy if exists inmuebles_select on public.inmuebles;
create policy inmuebles_select on public.inmuebles
  for select to anon, authenticated
  using (
    /* Members del workspace dueño · O cualquiera si está compartido. */
    public.is_org_member(organization_id) or share_with_network = true
  );

drop policy if exists inmuebles_write on public.inmuebles;
create policy inmuebles_write on public.inmuebles
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Bridge view en api schema
drop view if exists api.inmuebles cascade;
create view api.inmuebles with (security_invoker = on)
  as select * from public.inmuebles;
grant select on api.inmuebles to anon, authenticated;
grant insert, update, delete on api.inmuebles to authenticated;
grant select on public.inmuebles to anon, authenticated;
grant insert, update, delete on public.inmuebles to authenticated, service_role;

notify pgrst, 'reload schema';
