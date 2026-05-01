-- ═══════════════════════════════════════════════════════════════════
-- Migration · 20260501 · Eliminar localStorage como source of truth
-- ═══════════════════════════════════════════════════════════════════
--
-- QUÉ
-- ----
-- El frontend tenía ~15 helpers + ~21 páginas /ajustes/* guardando
-- datos SOLO en localStorage. Esta migración añade el schema necesario
-- para que TODO lo que el usuario edita persista en Supabase.
--
-- ESTRATEGIA
-- ----------
-- 1. Extender enum `plan_tier` (frontend usa 6 tiers, DB tenía 3).
-- 2. Tabla `user_settings` · single JSONB row por user · contiene los
--    21 settings de /ajustes/* sin necesidad de 21 tablas.
-- 3. Tabla `org_settings` · single JSONB row por org · settings de
--    workspace que comparten todos los miembros (oficinas defaults,
--    notificaciones globales, retención, etc.).
-- 4. Tablas catalog org-scoped: `relation_types`, `contact_sources`,
--    `org_tags` (tags de contacto por org), `email_labels`,
--    `email_signatures`, `departments`.
-- 5. Tabla `email_drafts` · borradores en curso por usuario.
-- 6. Tabla `whatsapp_settings` · config de la integración por org
--    (token guardado encriptado server-side, cliente solo lee flags).
-- 7. Tabla `dismissed_invitations` · invitaciones que el usuario ha
--    descartado · per-user.
-- 8. RLS en cada tabla nueva.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Extender enum plan_tier ─────────────────────────────────────
-- `ALTER TYPE ... ADD VALUE` NO se puede ejecutar dentro de un
-- bloque DO/transaction · usamos `IF NOT EXISTS` (PG 12+) y cada
-- ALTER queda como statement top-level.
alter type plan_tier add value if not exists 'promoter_329';
alter type plan_tier add value if not exists 'agency_free';
alter type plan_tier add value if not exists 'agency_marketplace';

-- ─── 2. user_settings · JSONB blob por usuario ───────────────────────
-- Sustituye 14+ keys localStorage del usuario:
--   byvaro.user.phones.v1, byvaro.googleCalendar.sync.v1,
--   byvaro.notifications.weekly.v1, byvaro.idioma.v1, etc.
create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ─── 3. org_settings · JSONB blob por organización ───────────────────
-- Settings del workspace que comparten todos: oficinas defaults,
-- notificaciones org-wide, retención de datos, custom fields,
-- lead score config, validez de promociones, etc.
create table if not exists public.org_settings (
  organization_id text primary key references public.organizations(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ─── 4. Catálogos org-scoped ─────────────────────────────────────────

-- 4.1 relation_types · tipos de relación entre contactos
create table if not exists public.relation_types (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  label           text not null,
  inverse_label   text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, label)
);
create index if not exists idx_relation_types_org on public.relation_types(organization_id);

-- 4.2 contact_sources · fuentes de captación
create table if not exists public.contact_sources (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  label           text not null,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, label)
);
create index if not exists idx_contact_sources_org on public.contact_sources(organization_id);

-- 4.3 org_tags · catálogo de tags de contacto
create table if not exists public.org_tags (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  label           text not null,
  color           text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, label)
);
create index if not exists idx_org_tags_org on public.org_tags(organization_id);

-- 4.4 departments · departamentos del workspace
create table if not exists public.departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists idx_departments_org on public.departments(organization_id);

-- 4.5 email_labels · etiquetas de correo (categorías)
create table if not exists public.email_labels (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  label           text not null,
  color           text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  unique (organization_id, label)
);
create index if not exists idx_email_labels_org on public.email_labels(organization_id);

-- 4.6 email_signatures · firmas (per-user dentro de org)
create table if not exists public.email_signatures (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  body            text not null,
  is_default      boolean not null default false,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_email_signatures_user on public.email_signatures(user_id);
create unique index if not exists uniq_email_signature_default
  on public.email_signatures(user_id) where is_default;

-- ─── 5. email_drafts · borradores de email por usuario ───────────────
create table if not exists public.email_drafts (
  id              uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  subject         text,
  body            text,
  to_emails       text[],
  cc_emails       text[],
  bcc_emails      text[],
  in_reply_to     text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_email_drafts_user on public.email_drafts(user_id, updated_at desc);

-- ─── 6. whatsapp_settings · setup de la integración por org ──────────
-- El token de Meta NO se guarda aquí · se guarda server-side en una
-- tabla con encryption-at-rest (cuando se implemente backend). Esta
-- tabla solo expone los flags y configuración no sensible.
create table if not exists public.whatsapp_settings (
  organization_id     text primary key references public.organizations(id) on delete cascade,
  is_connected        boolean not null default false,
  phone_number_id     text,
  business_account_id text,
  display_phone       text,
  webhook_verified    boolean not null default false,
  metadata            jsonb,
  updated_at          timestamptz not null default now()
);

-- ─── 7. dismissed_invitations · descartes per-user ───────────────────
create table if not exists public.dismissed_invitations (
  user_id         uuid not null references auth.users(id) on delete cascade,
  invitation_id   text not null,
  dismissed_at    timestamptz not null default now(),
  primary key (user_id, invitation_id)
);

-- ─── 8. agency_cartera · promociones aceptadas por agencia ───────────
-- Hoy `agencyCartera.ts` lo guarda en localStorage. Tabla acopla con
-- `organization_collaborations` pero a nivel promoción (M:N).
create table if not exists public.agency_cartera (
  id              uuid primary key default gen_random_uuid(),
  agency_org_id   text not null references public.organizations(id) on delete cascade,
  promotion_id    text not null references public.promotions(id) on delete cascade,
  added_at        timestamptz not null default now(),
  added_by_user_id uuid references auth.users(id) on delete set null,
  unique (agency_org_id, promotion_id)
);
create index if not exists idx_agency_cartera_agency on public.agency_cartera(agency_org_id);
create index if not exists idx_agency_cartera_promo  on public.agency_cartera(promotion_id);

-- ─── 9. RLS · habilitar en todas las tablas nuevas ───────────────────
alter table public.user_settings           enable row level security;
alter table public.org_settings            enable row level security;
alter table public.relation_types          enable row level security;
alter table public.contact_sources         enable row level security;
alter table public.org_tags                enable row level security;
alter table public.departments             enable row level security;
alter table public.email_labels            enable row level security;
alter table public.email_signatures        enable row level security;
alter table public.email_drafts            enable row level security;
alter table public.whatsapp_settings       enable row level security;
alter table public.dismissed_invitations   enable row level security;
alter table public.agency_cartera          enable row level security;

-- ─── 10. Policies ────────────────────────────────────────────────────

-- user_settings · solo el propio user
drop policy if exists user_settings_self on public.user_settings;
create policy user_settings_self on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- org_settings · solo miembros de la org
drop policy if exists org_settings_member_read on public.org_settings;
create policy org_settings_member_read on public.org_settings
  for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists org_settings_admin_write on public.org_settings;
create policy org_settings_admin_write on public.org_settings
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Helper genérico · catálogos org-scoped (member read · admin write)
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'relation_types', 'contact_sources', 'org_tags',
      'departments', 'email_labels'
    ])
  loop
    execute format('drop policy if exists %1$s_member_read on public.%1$s', t);
    execute format(
      'create policy %1$s_member_read on public.%1$s
       for select to authenticated
       using (public.is_org_member(organization_id))', t);
    execute format('drop policy if exists %1$s_admin_write on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_write on public.%1$s
       for all to authenticated
       using (public.is_org_admin(organization_id))
       with check (public.is_org_admin(organization_id))', t);
  end loop;
end $$;

-- email_signatures · self read, self write
drop policy if exists email_signatures_self on public.email_signatures;
create policy email_signatures_self on public.email_signatures
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- email_drafts · self read, self write
drop policy if exists email_drafts_self on public.email_drafts;
create policy email_drafts_self on public.email_drafts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- whatsapp_settings · member read, admin write
drop policy if exists whatsapp_settings_member_read on public.whatsapp_settings;
create policy whatsapp_settings_member_read on public.whatsapp_settings
  for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists whatsapp_settings_admin_write on public.whatsapp_settings;
create policy whatsapp_settings_admin_write on public.whatsapp_settings
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- dismissed_invitations · self read, self write
drop policy if exists dismissed_invitations_self on public.dismissed_invitations;
create policy dismissed_invitations_self on public.dismissed_invitations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- agency_cartera · admin de la agencia puede gestionar · cualquier
-- miembro de la agencia puede leer.
drop policy if exists agency_cartera_member_read on public.agency_cartera;
create policy agency_cartera_member_read on public.agency_cartera
  for select to authenticated
  using (public.is_org_member(agency_org_id));
drop policy if exists agency_cartera_admin_write on public.agency_cartera;
create policy agency_cartera_admin_write on public.agency_cartera
  for all to authenticated
  using (public.is_org_admin(agency_org_id))
  with check (public.is_org_admin(agency_org_id));

-- ─── 11. Bridge views en `api` schema (security_invoker) ─────────────
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'api') then
    execute 'create or replace view api.user_settings    with (security_invoker = on) as select * from public.user_settings';
    execute 'create or replace view api.org_settings     with (security_invoker = on) as select * from public.org_settings';
    execute 'create or replace view api.relation_types   with (security_invoker = on) as select * from public.relation_types';
    execute 'create or replace view api.contact_sources  with (security_invoker = on) as select * from public.contact_sources';
    execute 'create or replace view api.org_tags         with (security_invoker = on) as select * from public.org_tags';
    execute 'create or replace view api.departments      with (security_invoker = on) as select * from public.departments';
    execute 'create or replace view api.email_labels     with (security_invoker = on) as select * from public.email_labels';
    execute 'create or replace view api.email_signatures with (security_invoker = on) as select * from public.email_signatures';
    execute 'create or replace view api.email_drafts     with (security_invoker = on) as select * from public.email_drafts';
    execute 'create or replace view api.whatsapp_settings with (security_invoker = on) as select * from public.whatsapp_settings';
    execute 'create or replace view api.dismissed_invitations with (security_invoker = on) as select * from public.dismissed_invitations';
    execute 'create or replace view api.agency_cartera   with (security_invoker = on) as select * from public.agency_cartera';
  end if;
end $$;
