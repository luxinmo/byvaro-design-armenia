-- =====================================================================
-- Byvaro · responsible_invitations table + RPC find-by-token
-- ---------------------------------------------------------------------
-- Invitaciones para que el admin de una agencia recién creada invite
-- al "Responsable legal" (CLAUDE.md regla "Setup de Responsable").
--
-- RPC `find_responsible_invitation(token)` · búsqueda PRE-AUTH (la
-- página /responsible/:token es pública) · bypassa RLS via SECURITY
-- DEFINER. Solo devuelve datos no-sensibles (estado + agencia +
-- caducidad). El siguiente paso (signup del Responsable) ya autentica.
-- =====================================================================

do $$ begin
  create type respinv_status as enum ('pendiente','aceptada','rechazada','caducada','cancelada');
exception when duplicate_object then null;
end $$;

create table if not exists public.responsible_invitations (
  id                    text primary key,
  token                 text not null unique,
  agency_id             text not null references public.organizations(id) on delete cascade,
  agency_name           text not null,
  responsible_email     text not null,
  responsible_name      text not null,
  responsible_telefono  text,
  inviter_user_email    text,
  inviter_user_name     text,
  status                respinv_status not null default 'pendiente',
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null,
  responded_at          timestamptz
);

create index if not exists idx_respinv_agency on public.responsible_invitations(agency_id, status);
create index if not exists idx_respinv_token on public.responsible_invitations(token) where status = 'pendiente';

drop trigger if exists trg_touch_respinv on public.responsible_invitations;
-- updated_at no aplica · los cambios son finales (status flip).

alter table public.responsible_invitations enable row level security;

-- Members de la agencia ven sus invitaciones.
drop policy if exists respinv_select_member on public.responsible_invitations;
create policy respinv_select_member on public.responsible_invitations
  for select to authenticated using (public.is_org_member(agency_id));

-- Admins de la agencia crean.
drop policy if exists respinv_insert_admin on public.responsible_invitations;
create policy respinv_insert_admin on public.responsible_invitations
  for insert to authenticated with check (public.is_org_admin(agency_id));

-- Admins de la agencia editan (cancel, reenviar).
drop policy if exists respinv_update_admin on public.responsible_invitations;
create policy respinv_update_admin on public.responsible_invitations
  for update to authenticated
  using (public.is_org_admin(agency_id))
  with check (public.is_org_admin(agency_id));

-- RPC pública para que la página /responsible/:token (sin auth)
-- pueda mostrar los datos de la invitación. SECURITY DEFINER
-- bypassa RLS pero solo devuelve campos seguros.
create or replace function public.find_responsible_invitation(p_token text)
returns table (
  id text,
  agency_id text,
  agency_name text,
  responsible_email text,
  responsible_name text,
  status respinv_status,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id, agency_id, agency_name, responsible_email, responsible_name, status, expires_at
  from public.responsible_invitations
  where token = p_token
  limit 1;
$$;

grant execute on function public.find_responsible_invitation(text) to anon, authenticated;

-- Bridge view en api schema
drop view if exists api.responsible_invitations cascade;
create view api.responsible_invitations with (security_invoker = on)
  as select * from public.responsible_invitations;
grant select on api.responsible_invitations to anon, authenticated;
grant insert, update, delete on api.responsible_invitations to authenticated;
grant select on public.responsible_invitations to anon, authenticated;
grant insert, update, delete on public.responsible_invitations to authenticated, service_role;

notify pgrst, 'reload schema';
