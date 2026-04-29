-- =====================================================================
-- Byvaro · dual-role schema · Phase 2 (read-only-ready)
-- ---------------------------------------------------------------------
-- Implementa §3 de docs/backend-dual-role-architecture.md.
-- 10 tablas con FKs estrictas, índices canónicos y enums tipados.
--
-- DECISIÓN · IDs en `text` (no `uuid`). El frontend ya usa strings
-- (`developer-default`, `ag-1`, `prom-1`, `dev-1`, `1`, `2`...) y
-- mantenerlos así evita un refactor masivo. Postgres acepta text PKs
-- sin penalty real. Si en el futuro se migra a UUIDs, es un ALTER
-- TABLE + script de remap, no un día perdido.
--
-- Solo `auth.users` es UUID (lo crea Supabase Auth). El bridge a
-- `organizations` es vía `organization_members.user_id uuid`.
-- =====================================================================

-- ─── Extensiones ─────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ─── Enums ───────────────────────────────────────────────────────────
do $$ begin
  create type org_kind          as enum ('developer','agency');
  create type org_status        as enum ('active','inactive','suspended');
  create type member_role       as enum ('admin','member');
  create type member_status     as enum ('active','invited','deactivated');
  create type office_status     as enum ('active','archived');
  create type promo_owner_role  as enum ('promotor','comercializador');
  create type promo_status      as enum ('incomplete','active','paused','sold_out','archived');
  create type request_kind      as enum ('invitation','org_request','promotion_request');
  create type request_status    as enum ('pending','accepted','rejected','cancelled');
  create type collab_status     as enum ('active','paused','ended');
  create type promo_collab_status as enum ('pending_contract','active','paused','ended');
  create type contract_status   as enum ('none','draft','sent','viewed','signed','revoked','expired');
  create type document_type     as enum ('collaboration_contract','commission_agreement','nda','other');
  create type doc_provider      as enum ('firmafy','manual','other');
  create type visibility_status as enum ('visible','incomplete','hidden');
exception when duplicate_object then null;
end $$;


-- ─── 3.1 organizations ──────────────────────────────────────────────
create table if not exists public.organizations (
  id                  text primary key,
  kind                org_kind not null,
  legal_name          text,
  display_name        text,
  tax_id              text,
  email               text,
  phone               text,
  phone_prefix        text,
  website             text,
  logo_url            text,
  cover_url           text,
  address_line        text,
  address_street      text,
  address_postal_code text,
  address_city        text,
  address_province    text,
  country             text,
  status              org_status not null default 'active',
  verified            boolean not null default false,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_orgs_kind_status on public.organizations(kind, status);
create index if not exists idx_orgs_country on public.organizations(country);
create unique index if not exists uniq_orgs_tax_id_country
  on public.organizations(tax_id, country)
  where tax_id is not null;


-- ─── 3.2 organization_profiles ──────────────────────────────────────
create table if not exists public.organization_profiles (
  organization_id                  text primary key references public.organizations(id) on delete cascade,
  description                      text,
  public_description               text,
  tagline                          text,
  quote                            text,
  quote_description                text,
  founded_year                     int,
  license_number                   text,
  licenses                         jsonb,
  corporate_color                  text,
  default_currency                 text default 'EUR',
  default_language                 text default 'es',
  timezone                         text default 'Europe/Madrid',
  attention_languages              text[],
  commission_national_default      numeric(5,2) default 3,
  commission_international_default numeric(5,2) default 5,
  commission_payment_term_days     int default 30,
  -- Sensitive · `/sensitive` only
  main_contact_name                text,
  main_contact_email               text,
  main_contact_phone               text,
  schedule                         text,
  -- Social
  linkedin                         text,
  instagram                        text,
  facebook                         text,
  youtube                          text,
  tiktok                           text,
  -- Marketing snapshot
  marketing_top_nationalities      jsonb,
  marketing_product_types          jsonb,
  marketing_client_sources         jsonb,
  marketing_portals                text[],
  -- Google Places
  google_place_id                  text,
  google_rating                    numeric(3,2),
  google_ratings_total             int,
  google_fetched_at                timestamptz,
  google_maps_url                  text,
  -- Visibility cache
  visibility_status                visibility_status not null default 'visible',
  metadata                         jsonb,
  updated_at                       timestamptz not null default now()
);

create index if not exists idx_profiles_visibility on public.organization_profiles(visibility_status);


-- ─── 3.3 organization_members ───────────────────────────────────────
create table if not exists public.organization_members (
  id                uuid primary key default gen_random_uuid(),
  organization_id   text not null references public.organizations(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  role              member_role not null,
  status            member_status not null default 'active',
  job_title         text,
  department        text,
  languages         text[],
  bio               text,
  phone             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deactivated_at    timestamptz,
  unique (organization_id, user_id)
);

create index if not exists idx_members_org on public.organization_members(organization_id);
create index if not exists idx_members_user on public.organization_members(user_id);

-- Trigger · garantiza al menos un admin activo por org. Phase 2 minimal:
-- solo previene UPDATE/DELETE que dejaría 0 admins. Inserts no se gating.
create or replace function public.enforce_at_least_one_admin()
returns trigger language plpgsql as $$
declare
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.status = 'active')
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.status = 'active'
          and (new.role <> 'admin' or new.status <> 'active')) then
    select count(*) into remaining
    from public.organization_members
    where organization_id = old.organization_id
      and role = 'admin' and status = 'active'
      and id <> old.id;
    if remaining = 0 then
      raise exception 'Cannot demote/remove last active admin of org %', old.organization_id;
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_at_least_one_admin on public.organization_members;
create trigger trg_at_least_one_admin
  before update or delete on public.organization_members
  for each row execute function public.enforce_at_least_one_admin();


-- ─── 3.4 offices ────────────────────────────────────────────────────
create table if not exists public.offices (
  id                text primary key,
  organization_id   text not null references public.organizations(id) on delete cascade,
  name              text not null,
  address           text,
  city              text,
  province          text,
  postal_code       text,
  country           text,
  phone             text,
  phone_prefix      text,
  email             text,
  whatsapp          text,
  schedule          text,
  logo_url          text,
  cover_url         text,
  is_main           boolean not null default false,
  status            office_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_offices_org on public.offices(organization_id);
-- Solo una oficina principal por organización (cuando is_main=true)
create unique index if not exists uniq_office_main_per_org
  on public.offices(organization_id) where is_main;


-- ─── 3.5 promotions ─────────────────────────────────────────────────
create table if not exists public.promotions (
  id                       text primary key,
  owner_organization_id    text not null references public.organizations(id) on delete restrict,
  owner_role               promo_owner_role not null,
  name                     text not null,
  reference                text,
  description              text,
  address                  text,
  city                     text,
  province                 text,
  country                  text,
  lat                      numeric(9,6),
  lng                      numeric(9,6),
  status                   promo_status not null,
  total_units              int not null default 0,
  available_units          int not null default 0,
  price_from               numeric(12,2),
  price_to                 numeric(12,2),
  delivery                 text,
  image_url                text,
  gallery                  jsonb,
  can_share_with_agencies  boolean not null default true,
  marketing_prohibitions   text[],
  metadata                 jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_promos_owner_status on public.promotions(owner_organization_id, status);
create index if not exists idx_promos_country_city on public.promotions(country, city);
create index if not exists idx_promos_active on public.promotions(status) where status = 'active';


-- ─── 3.6 collab_requests ────────────────────────────────────────────
create table if not exists public.collab_requests (
  id                     uuid primary key default gen_random_uuid(),
  from_organization_id   text not null references public.organizations(id) on delete cascade,
  to_organization_id     text not null references public.organizations(id) on delete cascade,
  promotion_id           text references public.promotions(id) on delete set null,
  kind                   request_kind not null,
  status                 request_status not null default 'pending',
  created_by_user_id     uuid not null references auth.users(id) on delete restrict,
  responded_by_user_id   uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  responded_at           timestamptz,
  expires_at             timestamptz,
  message                text,
  metadata               jsonb,
  check (from_organization_id <> to_organization_id),
  check (kind <> 'promotion_request' or promotion_id is not null)
);

create index if not exists idx_requests_to_status_kind   on public.collab_requests(to_organization_id, status, kind);
create index if not exists idx_requests_from_status_kind on public.collab_requests(from_organization_id, status, kind);
create index if not exists idx_requests_promo            on public.collab_requests(promotion_id);
create index if not exists idx_requests_pending_expiry   on public.collab_requests(status, kind, expires_at)
  where status = 'pending' and expires_at is not null;

-- Idempotency · pending requests entre el mismo par no se duplican.
-- (kind+promo_id discrimina · una invitación y una org_request al mismo tenant
-- pueden coexistir, dos invitaciones a la misma promo no.)
create unique index if not exists uniq_pending_request_per_pair
  on public.collab_requests(from_organization_id, to_organization_id, kind, coalesce(promotion_id, ''))
  where status = 'pending';


-- ─── 3.7 organization_collaborations ────────────────────────────────
create table if not exists public.organization_collaborations (
  id                  uuid primary key default gen_random_uuid(),
  organization_a_id   text not null references public.organizations(id) on delete cascade,
  organization_b_id   text not null references public.organizations(id) on delete cascade,
  status              collab_status not null default 'active',
  started_at          timestamptz not null default now(),
  paused_at           timestamptz,
  paused_reason       text,
  ended_at            timestamptz,
  ended_reason        text,
  source_request_id   uuid references public.collab_requests(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (organization_a_id < organization_b_id),
  unique (organization_a_id, organization_b_id)
);

create index if not exists idx_orgcollab_a_status on public.organization_collaborations(organization_a_id, status);
create index if not exists idx_orgcollab_b_status on public.organization_collaborations(organization_b_id, status);

-- Trigger · normaliza el orden a < b automáticamente al insertar.
create or replace function public.normalize_orgcollab_pair()
returns trigger language plpgsql as $$
declare
  a text; b text;
begin
  if new.organization_a_id > new.organization_b_id then
    a := new.organization_b_id; b := new.organization_a_id;
    new.organization_a_id := a;
    new.organization_b_id := b;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_orgcollab on public.organization_collaborations;
create trigger trg_normalize_orgcollab
  before insert or update on public.organization_collaborations
  for each row execute function public.normalize_orgcollab_pair();


-- ─── 3.8 promotion_collaborations ───────────────────────────────────
create table if not exists public.promotion_collaborations (
  id                          uuid primary key default gen_random_uuid(),
  promotion_id                text not null references public.promotions(id) on delete cascade,
  agency_organization_id      text not null references public.organizations(id) on delete cascade,
  developer_organization_id   text not null references public.organizations(id) on delete cascade,
  status                      promo_collab_status not null,
  commission_percentage       numeric(5,2),
  commission_payment_plan     jsonb,
  contract_status             contract_status default 'none',
  started_at                  timestamptz not null default now(),
  paused_at                   timestamptz,
  ended_at                    timestamptz,
  source_request_id           uuid references public.collab_requests(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_promocollab_agency_status on public.promotion_collaborations(agency_organization_id, status);
create index if not exists idx_promocollab_dev_status    on public.promotion_collaborations(developer_organization_id, status);
create index if not exists idx_promocollab_promo         on public.promotion_collaborations(promotion_id, status);
create unique index if not exists uniq_promocollab_active
  on public.promotion_collaborations(promotion_id, agency_organization_id)
  where status in ('pending_contract','active','paused');


-- ─── 3.9 collaboration_documents ────────────────────────────────────
create table if not exists public.collaboration_documents (
  id                          uuid primary key default gen_random_uuid(),
  collaboration_id            uuid references public.organization_collaborations(id) on delete cascade,
  promotion_collaboration_id  uuid references public.promotion_collaborations(id) on delete cascade,
  document_type               document_type not null,
  file_url                    text not null,
  signed_file_url             text,
  audit_file_url              text,
  status                      contract_status not null,
  signed_at                   timestamptz,
  expires_at                  timestamptz,
  provider                    doc_provider not null default 'manual',
  provider_external_id        text,
  signers                     jsonb,
  metadata                    jsonb,
  uploaded_by_user_id         uuid references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (collaboration_id is not null or promotion_collaboration_id is not null)
);

create index if not exists idx_docs_collab on public.collaboration_documents(collaboration_id);
create index if not exists idx_docs_promocollab on public.collaboration_documents(promotion_collaboration_id);


-- ─── 3.10 audit_events ──────────────────────────────────────────────
create table if not exists public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  actor_user_id   uuid references auth.users(id) on delete set null,
  entity_type     text not null,
  entity_id       text not null,
  action          text not null,
  before          jsonb,
  after           jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_org_time on public.audit_events(organization_id, created_at desc);
create index if not exists idx_audit_entity   on public.audit_events(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_actor    on public.audit_events(actor_user_id, created_at desc);


-- ─── updated_at auto-touch trigger ──────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'organizations','organization_profiles','organization_members',
    'offices','promotions','organization_collaborations',
    'promotion_collaborations','collaboration_documents'
  ])
  loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
