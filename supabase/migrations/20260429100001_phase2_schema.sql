-- =====================================================================
-- Byvaro · Phase 2 schema · CRM + comms + plan/billing + collab advanced
-- ---------------------------------------------------------------------
-- Implementa los §1.6, §1.7, §1.8, §1.10, §3.1, §4.0, §6, §7.1-7.5,
-- §8.2, §12, §15, §16 de docs/backend-integration.md.
--
-- DECISIÓN · IDs en text para casi todas las tablas (matchea los
-- strings que usa el frontend mock: "reg-001", "v-001", "ce-001",
-- "cont-1", etc.). Solo eventos generados runtime usan UUID.
-- =====================================================================

-- ─── Enums ───────────────────────────────────────────────────────────
do $$ begin
  -- Registros
  create type registro_estado as enum ('pendiente','preregistro_activo','aprobado','rechazado','duplicado','caducado');
  create type registro_origen as enum ('direct','collaborator');
  create type registro_tipo   as enum ('registration','registration_visit','visit_only');
  create type visit_outcome   as enum ('realizada','no_show_cliente','cancelada_agencia','cancelada_promotor','reprogramada');

  -- Ventas
  create type venta_estado as enum ('reservada','contratada','escriturada','caida');
  create type venta_metodo as enum ('hipoteca','contado','mixto');

  -- Calendar
  create type calendar_event_type   as enum ('visit','call','meeting','task','block','followup');
  create type calendar_event_status as enum ('scheduled','confirmed','done','cancelled','rescheduled');

  -- Contacts
  create type contact_status        as enum ('lead','registered','client','inactive','blocked');
  create type contact_event_type    as enum (
    'created','updated','deleted','assigned','unassigned',
    'related_linked','related_unlinked',
    'visit_evaluated','document_uploaded','document_deleted',
    'comment_added','email_sent','whatsapp_sent','call_logged',
    'web_activity','status_changed','reassigned'
  );

  -- Notifications
  create type notification_priority as enum ('low','normal','high','urgent');

  -- Email
  create type email_status as enum ('queued','sent','delivered','opened','clicked','bounced','failed');

  -- Plan
  create type plan_tier as enum ('trial','promoter_249','enterprise');

  -- Subscriptions
  create type subscription_status as enum ('active','trialing','past_due','canceled','incomplete','paused');

  -- Incidents
  create type incident_kind  as enum ('duplicate','cancellation','complaint','other');
  create type incident_state as enum ('open','investigating','resolved','dismissed');

  -- Doc requests
  create type doc_request_status as enum ('pending','submitted','approved','rejected');

  -- Invoices/payments
  create type invoice_status as enum ('draft','sent','paid','overdue','void');
  create type agency_payment_state as enum ('pending','on_hold','paid','cancelled');

  -- WhatsApp
  create type whatsapp_message_dir as enum ('inbound','outbound');
  create type whatsapp_message_status as enum ('queued','sent','delivered','read','failed');
exception when duplicate_object then null;
end $$;


-- ═══════════════════════════════════════════════════════════════════
-- §7.4 · contacts
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.contacts (
  id                  text primary key,
  organization_id     text not null references public.organizations(id) on delete cascade,
  full_name           text not null,
  email               text,
  phone               text,
  phone_prefix        text,
  nationality         text,
  nationality_iso     text,
  dni                 text,
  birth_date          date,
  language            text,
  status              contact_status not null default 'lead',
  /* Asignaciones · array de user IDs (members del workspace) que se
   * llevan este contacto. Soft array para evitar tabla pivote en
   * Phase 2 · si crece la complejidad lo movemos. */
  assignee_user_ids   uuid[] default '{}',
  primary_source      text,
  latest_source       text,
  origins             jsonb,
  public_ref          text,
  /* Métrica · `lastActivityAt` adelanta nunca retrocede (lib/contactActivity.ts). */
  last_activity_at    timestamptz,
  notes               text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_contacts_org on public.contacts(organization_id);
create index if not exists idx_contacts_email on public.contacts(organization_id, email) where email is not null;
create index if not exists idx_contacts_phone on public.contacts(organization_id, phone) where phone is not null;
create index if not exists idx_contacts_pubref on public.contacts(public_ref) where public_ref is not null;


-- ═══════════════════════════════════════════════════════════════════
-- §1.7 · contact_events (audit log)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.contact_events (
  id                uuid primary key default gen_random_uuid(),
  contact_id        text not null references public.contacts(id) on delete cascade,
  organization_id   text not null references public.organizations(id) on delete cascade,
  type              contact_event_type not null,
  title             text not null,
  description       text,
  by_user_id        uuid references auth.users(id) on delete set null,
  by_name           text,
  by_email          text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_contactev_contact_time on public.contact_events(contact_id, created_at desc);
create index if not exists idx_contactev_org_time on public.contact_events(organization_id, created_at desc);


-- ═══════════════════════════════════════════════════════════════════
-- §7.1 · leads (bandeja de entrada · sin cualificar)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.leads (
  id                  text primary key,
  organization_id     text not null references public.organizations(id) on delete cascade,
  /* Lead puede venir de un agency (collaborator) o ser direct. */
  agency_organization_id text references public.organizations(id) on delete set null,
  source              text,
  full_name           text,
  email               text,
  phone               text,
  message             text,
  contact_id          text references public.contacts(id) on delete set null,
  promotion_id        text references public.promotions(id) on delete set null,
  status              text default 'new',
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_leads_org_status on public.leads(organization_id, status);


-- ═══════════════════════════════════════════════════════════════════
-- §7.2 · registros (leads cualificados · IA duplicados)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.registros (
  id                  text primary key,
  /* Cuál org RECIBE este registro (siempre el dueño de la promoción). */
  organization_id     text not null references public.organizations(id) on delete cascade,
  /* Cuál org lo APORTA (si origen=collaborator). */
  agency_organization_id text references public.organizations(id) on delete set null,
  promotion_id        text not null references public.promotions(id) on delete restrict,
  contact_id          text references public.contacts(id) on delete set null,
  origen              registro_origen not null,
  tipo                registro_tipo not null default 'registration',
  estado              registro_estado not null default 'pendiente',
  /* Cliente snapshot · denormalizado para audit aunque cambie el contact. */
  cliente_nombre      text not null,
  cliente_email       text,
  cliente_telefono    text,
  cliente_nacionalidad text,
  cliente_nationality_iso text,
  cliente_dni         text,
  /* IA · 0-100 · 70+ bloquea aprobar sin override. */
  match_percentage    int default 0,
  match_with          text,
  match_cliente       jsonb,
  recommendation      text,
  /* Visit related · solo cuando tipo=registration_visit o visit_only. */
  visit_date          date,
  visit_time          text,
  visit_outcome       visit_outcome,
  origin_registro_id  text references public.registros(id) on delete set null,
  /* Decisión */
  decided_at          timestamptz,
  decided_by_user_id  uuid references auth.users(id) on delete set null,
  decided_by_name     text,
  decided_by_role     text,
  /* Misc */
  notas               text,
  consent             boolean default false,
  response_time       text,
  public_ref          text,
  metadata            jsonb,
  fecha               timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_registros_org_estado on public.registros(organization_id, estado);
create index if not exists idx_registros_promo on public.registros(promotion_id, estado);
create index if not exists idx_registros_agency on public.registros(agency_organization_id, estado);
create index if not exists idx_registros_contact on public.registros(contact_id);
create index if not exists idx_registros_pubref on public.registros(public_ref);


-- ═══════════════════════════════════════════════════════════════════
-- registro_events (audit per registro)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.registro_events (
  id                uuid primary key default gen_random_uuid(),
  registro_id       text not null references public.registros(id) on delete cascade,
  organization_id   text not null references public.organizations(id) on delete cascade,
  type              text not null,
  title             text not null,
  description       text,
  by_user_id        uuid references auth.users(id) on delete set null,
  by_name           text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_regev_registro_time on public.registro_events(registro_id, created_at desc);


-- ═══════════════════════════════════════════════════════════════════
-- §7.3 · sales
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.sales (
  id                       text primary key,
  organization_id          text not null references public.organizations(id) on delete cascade,
  agency_organization_id   text references public.organizations(id) on delete set null,
  promotion_id             text not null references public.promotions(id) on delete restrict,
  registro_id              text references public.registros(id) on delete set null,
  contact_id               text references public.contacts(id) on delete set null,
  unit_id                  text,
  unit_label               text,
  cliente_nombre           text not null,
  cliente_email            text,
  cliente_telefono         text,
  cliente_nacionalidad     text,
  agent_name               text,
  estado                   venta_estado not null,
  fecha_reserva            date,
  fecha_contrato           date,
  fecha_escritura          date,
  fecha_caida              date,
  precio_reserva           numeric(12,2),
  precio_final             numeric(12,2),
  precio_listado           numeric(12,2),
  descuento_aplicado       numeric(12,2),
  comision_pct             numeric(5,2),
  comision_pagada          boolean default false,
  metodo_pago              venta_metodo,
  siguiente_paso           text,
  siguiente_paso_fecha     date,
  nota                     text,
  metadata                 jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_sales_org_estado on public.sales(organization_id, estado);
create index if not exists idx_sales_agency on public.sales(agency_organization_id, estado);
create index if not exists idx_sales_promo on public.sales(promotion_id, estado);


-- ═══════════════════════════════════════════════════════════════════
-- sale_payments
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.sale_payments (
  id            uuid primary key default gen_random_uuid(),
  sale_id       text not null references public.sales(id) on delete cascade,
  fecha         date not null,
  concepto      text not null,
  importe       numeric(12,2) not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_salepay_sale on public.sale_payments(sale_id);


-- ═══════════════════════════════════════════════════════════════════
-- §7.5 · calendar_events
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.calendar_events (
  id                  text primary key,
  organization_id     text not null references public.organizations(id) on delete cascade,
  type                calendar_event_type not null,
  status              calendar_event_status not null default 'scheduled',
  title               text not null,
  description         text,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  all_day             boolean default false,
  assignee_user_id    uuid references auth.users(id) on delete set null,
  /* Vínculos opcionales · la visita típica liga registro+contact+promo. */
  contact_id          text references public.contacts(id) on delete set null,
  registro_id         text references public.registros(id) on delete set null,
  promotion_id        text references public.promotions(id) on delete set null,
  lead_id             text references public.leads(id) on delete set null,
  location            text,
  google_event_id     text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_calev_org_time on public.calendar_events(organization_id, starts_at);
create index if not exists idx_calev_assignee_time on public.calendar_events(assignee_user_id, starts_at);
create index if not exists idx_calev_registro on public.calendar_events(registro_id);


-- ═══════════════════════════════════════════════════════════════════
-- visit_evaluations · resultado al cerrar una visita
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.visit_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  calendar_event_id   text not null references public.calendar_events(id) on delete cascade,
  outcome             text not null,
  rating              int,
  notes               text,
  by_user_id          uuid references auth.users(id) on delete set null,
  evaluated_at        timestamptz not null default now()
);
create index if not exists idx_visitev_event on public.visit_evaluations(calendar_event_id);


-- ═══════════════════════════════════════════════════════════════════
-- §1.10 · notifications (bell)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     text not null references public.organizations(id) on delete cascade,
  recipient_user_id   uuid references auth.users(id) on delete cascade,
  type                text not null,
  title               text not null,
  body                text,
  link                text,
  priority            notification_priority default 'normal',
  read_at             timestamptz,
  metadata            jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_notif_user_unread on public.notifications(recipient_user_id, read_at, created_at desc);
create index if not exists idx_notif_org_time on public.notifications(organization_id, created_at desc);


-- ═══════════════════════════════════════════════════════════════════
-- §6 · user_favorites
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.user_favorites (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  organization_id     text not null references public.organizations(id) on delete cascade,
  /* Qué tipo de favorito · 'agency', 'promotion', 'developer'. */
  kind                text not null default 'agency',
  /* Id del recurso favorito (agency_id, promotion_id, developer_id). */
  target_id           text not null,
  created_at          timestamptz not null default now(),
  unique (user_id, kind, target_id)
);
create index if not exists idx_favs_user on public.user_favorites(user_id, kind);


-- ═══════════════════════════════════════════════════════════════════
-- §15 · emails_sent
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.emails_sent (
  id                uuid primary key default gen_random_uuid(),
  organization_id   text not null references public.organizations(id) on delete cascade,
  /* Quién envió. */
  by_user_id        uuid references auth.users(id) on delete set null,
  /* Audience · 'client' | 'collaborator'. */
  audience          text not null,
  template_id       text,
  promotion_id      text references public.promotions(id) on delete set null,
  language          text default 'es',
  subject           text,
  body_html         text,
  recipients        jsonb,                  -- array of {email, name?, kind}
  attachments       jsonb,
  sent_at           timestamptz not null default now(),
  status            email_status default 'sent',
  provider_message_id text,
  metadata          jsonb
);
create index if not exists idx_emails_org_time on public.emails_sent(organization_id, sent_at desc);


-- ═══════════════════════════════════════════════════════════════════
-- §1.8 · email_events (delivery webhooks)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.email_events (
  id                uuid primary key default gen_random_uuid(),
  email_id          uuid references public.emails_sent(id) on delete cascade,
  type              email_status not null,
  recipient_email   text,
  occurred_at       timestamptz not null default now(),
  metadata          jsonb
);
create index if not exists idx_emailev_email on public.email_events(email_id);


-- ═══════════════════════════════════════════════════════════════════
-- §15.4 · email_templates
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.email_templates (
  id                  text not null,
  organization_id     text not null references public.organizations(id) on delete cascade,
  language            text default 'es',
  subject             text,
  body_html           text,
  body_text           text,
  enabled             boolean default true,
  metadata            jsonb,
  updated_at          timestamptz not null default now(),
  primary key (organization_id, id, language)
);


-- ═══════════════════════════════════════════════════════════════════
-- §8.2 · whatsapp_conversations + whatsapp_messages
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.whatsapp_conversations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     text not null references public.organizations(id) on delete cascade,
  contact_id          text references public.contacts(id) on delete set null,
  phone               text not null,
  display_name        text,
  assigned_user_id    uuid references auth.users(id) on delete set null,
  last_message_at     timestamptz,
  unread_count        int default 0,
  archived            boolean default false,
  metadata            jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_wac_org_lastmsg on public.whatsapp_conversations(organization_id, last_message_at desc);
create index if not exists idx_wac_assignee on public.whatsapp_conversations(assigned_user_id);

create table if not exists public.whatsapp_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.whatsapp_conversations(id) on delete cascade,
  organization_id     text not null references public.organizations(id) on delete cascade,
  direction           whatsapp_message_dir not null,
  status              whatsapp_message_status default 'queued',
  body                text,
  attachments         jsonb,
  sent_by_user_id     uuid references auth.users(id) on delete set null,
  sent_at             timestamptz not null default now(),
  metadata            jsonb
);
create index if not exists idx_wam_conv_time on public.whatsapp_messages(conversation_id, sent_at desc);


-- ═══════════════════════════════════════════════════════════════════
-- §4.0 · agency_invoices + agency_payments + doc_requests + incidents
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.agency_invoices (
  id                          text primary key,
  developer_organization_id   text not null references public.organizations(id) on delete cascade,
  agency_organization_id      text not null references public.organizations(id) on delete cascade,
  promotion_id                text references public.promotions(id) on delete set null,
  number                      text,
  status                      invoice_status not null default 'draft',
  issued_at                   date,
  due_at                      date,
  paid_at                     date,
  amount_subtotal             numeric(12,2),
  amount_tax                  numeric(12,2),
  amount_total                numeric(12,2),
  currency                    text default 'EUR',
  pdf_url                     text,
  metadata                    jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_invs_dev_status on public.agency_invoices(developer_organization_id, status);
create index if not exists idx_invs_agency on public.agency_invoices(agency_organization_id, status);

create table if not exists public.agency_payments (
  id                          text primary key,
  developer_organization_id   text not null references public.organizations(id) on delete cascade,
  agency_organization_id      text not null references public.organizations(id) on delete cascade,
  invoice_id                  text references public.agency_invoices(id) on delete set null,
  amount                      numeric(12,2),
  currency                    text default 'EUR',
  state                       agency_payment_state not null default 'pending',
  scheduled_at                date,
  paid_at                     date,
  hold_reason                 text,
  proof_url                   text,
  metadata                    jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_pays_dev_state on public.agency_payments(developer_organization_id, state);
create index if not exists idx_pays_agency on public.agency_payments(agency_organization_id, state);

create table if not exists public.doc_requests (
  id                          text primary key,
  developer_organization_id   text not null references public.organizations(id) on delete cascade,
  agency_organization_id      text not null references public.organizations(id) on delete cascade,
  type                        text not null,
  status                      doc_request_status not null default 'pending',
  due_at                      date,
  submitted_at                timestamptz,
  decided_at                  timestamptz,
  file_url                    text,
  notes                       text,
  metadata                    jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_drq_pair_status on public.doc_requests(developer_organization_id, agency_organization_id, status);

create table if not exists public.incidents (
  id                          uuid primary key default gen_random_uuid(),
  developer_organization_id   text not null references public.organizations(id) on delete cascade,
  agency_organization_id      text references public.organizations(id) on delete set null,
  promotion_id                text references public.promotions(id) on delete set null,
  registro_id                 text references public.registros(id) on delete set null,
  kind                        incident_kind not null,
  state                       incident_state not null default 'open',
  description                 text,
  resolved_at                 timestamptz,
  metadata                    jsonb,
  created_at                  timestamptz not null default now()
);
create index if not exists idx_inc_dev_state on public.incidents(developer_organization_id, state);


-- ═══════════════════════════════════════════════════════════════════
-- §12 · workspace_plans + paywall_events + stripe + subscriptions
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.workspace_plans (
  organization_id   text primary key references public.organizations(id) on delete cascade,
  tier              plan_tier not null default 'trial',
  trial_started_at  timestamptz default now(),
  trial_ends_at     timestamptz,
  activated_at      timestamptz,
  cancelled_at      timestamptz,
  metadata          jsonb,
  updated_at        timestamptz not null default now()
);

create table if not exists public.paywall_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   text not null references public.organizations(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  event             text not null,
  trigger           text,
  tier              plan_tier,
  used              int,
  "limit"           int,
  route             text,
  user_role         text,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_paywall_org_time on public.paywall_events(organization_id, created_at desc);

create table if not exists public.stripe_events_processed (
  event_id        text primary key,
  type            text,
  processed_at    timestamptz not null default now(),
  metadata        jsonb
);

create table if not exists public.subscriptions (
  organization_id        text primary key references public.organizations(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 subscription_status,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  metadata               jsonb,
  updated_at             timestamptz not null default now()
);


-- ═══════════════════════════════════════════════════════════════════
-- §1.5 · permission_grants (overrides finos por miembro)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.permission_grants (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     text not null references public.organizations(id) on delete cascade,
  member_id           uuid not null references public.organization_members(id) on delete cascade,
  permission_key      text not null,
  granted_by_user_id  uuid references auth.users(id) on delete set null,
  granted_at          timestamptz not null default now(),
  unique (member_id, permission_key)
);


-- ═══════════════════════════════════════════════════════════════════
-- §3 · promotion_units · §3.1 · promotion_anejos · gallery · payment_plans
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.promotion_units (
  id                  text primary key,
  promotion_id        text not null references public.promotions(id) on delete cascade,
  label               text not null,
  rooms               int,
  bathrooms           int,
  surface_m2          numeric(7,2),
  terrace_m2          numeric(7,2),
  price               numeric(12,2),
  status              text default 'available',
  floor               text,
  orientation         text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_units_promo_status on public.promotion_units(promotion_id, status);

create table if not exists public.promotion_anejos (
  id                  text primary key,
  promotion_id        text not null references public.promotions(id) on delete cascade,
  kind                text not null,
  label               text,
  price               numeric(12,2),
  status              text default 'available',
  metadata            jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_anejos_promo on public.promotion_anejos(promotion_id, kind);

create table if not exists public.promotion_gallery (
  id                  uuid primary key default gen_random_uuid(),
  promotion_id        text not null references public.promotions(id) on delete cascade,
  url                 text not null,
  alt                 text,
  position            int,
  kind                text default 'photo',
  created_at          timestamptz not null default now()
);
create index if not exists idx_gallery_promo on public.promotion_gallery(promotion_id, position);

create table if not exists public.payment_plans (
  id                  uuid primary key default gen_random_uuid(),
  promotion_id        text not null references public.promotions(id) on delete cascade,
  tramo               int not null,
  label               text,
  pct                 numeric(5,2),
  due_at_event        text,
  metadata            jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_paymentplans_promo on public.payment_plans(promotion_id, tramo);


-- ═══════════════════════════════════════════════════════════════════
-- updated_at touch para nuevas tablas
-- ═══════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  for t in select unnest(array[
    'contacts','leads','registros','sales','calendar_events',
    'agency_invoices','agency_payments','doc_requests',
    'workspace_plans','subscriptions','email_templates',
    'promotion_units','promotion_anejos'
  ])
  loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
