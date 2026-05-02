/* ════════════════════════════════════════════════════════════════════
 * 20260502 · "No more localStorage" migration
 *
 * Objetivo: eliminar localStorage como source-of-truth de la app.
 * Crea las tablas restantes que aún viven solo en cliente y las cubre
 * con RLS multi-tenant + bridge views en `api` schema.
 *
 * Tablas creadas:
 *   · invitations               · invitaciones cross-tenant
 *   · favorite_agencies         · favoritas por workspace
 *   · sent_emails               · log de emails enviados
 *   · whatsapp_quick_replies    · respuestas rápidas por org
 *   · agency_licenses           · licencias colegiales
 *   · agency_doc_requests       · solicitudes de documentación
 *   · agency_onboarding_state   · estado onboarding agencia
 *   · promotion_collab_status   · estado per (agencia, promo)
 *   · company_events            · timeline cross-empresa
 *   · marketing_rules           · prohibiciones por canal x promo
 *   · org_email_domains         · dominios de email del workspace
 *   · user_2fa                  · estado 2FA por user
 *   · empresa_onboarding_state  · estado onboarding promotor
 *   · microsite_templates       · plantillas de microsite por org
 *
 * Cada tabla:
 *   1. organization_id PK/FK
 *   2. RLS habilitada
 *   3. Policies de read/write por miembro/admin
 *   4. Bridge view en api.* con security_invoker=on
 * ════════════════════════════════════════════════════════════════════ */

/* ══════ 1. invitations ═══════════════════════════════════════════════
 * Invitaciones cross-tenant. Ej. promotor invita a agencia X a
 * colaborar en promoción Y. Cubre el flujo `/invite/:token`.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  /* Org que envía (developer normalmente) */
  from_organization_id text not null references public.organizations(id) on delete cascade,
  /* Org destinataria (agencia normalmente) · puede ser NULL si la
   *  invitación es por email a una agencia que aún no existe */
  to_organization_id text references public.organizations(id) on delete set null,
  to_email text,
  to_phone text,
  to_agency_name text,
  /* Promoción a la que se refiere la invitación · NULL = invitación
   *  general al workspace */
  promotion_id text references public.promotions(id) on delete set null,
  /* Token público URL-safe para `/invite/:token` */
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','expired','cancelled')),
  /* Términos económicos de la invitación */
  comision_pct numeric(5,2),
  duracion_meses integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz
);
alter table public.invitations enable row level security;
create policy "invitations_select"
  on public.invitations for select
  using (
    public.is_org_member(from_organization_id)
    or (to_organization_id is not null and public.is_org_member(to_organization_id))
  );
create policy "invitations_insert"
  on public.invitations for insert
  with check (public.is_org_member(from_organization_id));
create policy "invitations_update"
  on public.invitations for update
  using (
    public.is_org_member(from_organization_id)
    or (to_organization_id is not null and public.is_org_member(to_organization_id))
  );
create index if not exists invitations_from_idx on public.invitations(from_organization_id);
create index if not exists invitations_to_idx on public.invitations(to_organization_id);
create index if not exists invitations_token_idx on public.invitations(token);

/* ══════ 2. favorite_agencies ═════════════════════════════════════════
 * Favoritos del promotor sobre agencias colaboradoras.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.favorite_agencies (
  organization_id text not null references public.organizations(id) on delete cascade,
  agency_organization_id text not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, agency_organization_id)
);
alter table public.favorite_agencies enable row level security;
create policy "favorite_agencies_member_all"
  on public.favorite_agencies for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

/* ══════ 3. sent_emails ═══════════════════════════════════════════════
 * Log de emails enviados desde la app. No incluye drafts (esos van a
 * `email_drafts`).
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  /* Sender · auth.uid del miembro que envió */
  from_user_id uuid references auth.users(id) on delete set null,
  from_email text,
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  bcc_emails text[] not null default '{}',
  subject text not null,
  body_html text,
  body_text text,
  attachments jsonb not null default '[]'::jsonb,
  /* Referencias opcionales · contexto (registro, lead, agencia, promo) */
  related_promotion_id text references public.promotions(id) on delete set null,
  related_agency_id text references public.organizations(id) on delete set null,
  related_lead_id text references public.leads(id) on delete set null,
  template_id text,
  status text not null default 'sent'
    check (status in ('sent','delivered','opened','bounced','failed')),
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);
alter table public.sent_emails enable row level security;
create policy "sent_emails_member_select"
  on public.sent_emails for select
  using (public.is_org_member(organization_id));
create policy "sent_emails_member_insert"
  on public.sent_emails for insert
  with check (public.is_org_member(organization_id));
create index if not exists sent_emails_org_idx on public.sent_emails(organization_id);
create index if not exists sent_emails_at_idx on public.sent_emails(sent_at desc);

/* ══════ 4. whatsapp_quick_replies ════════════════════════════════════
 * Respuestas rápidas configurables por org. Las settings globales (auto
 * responder, business profile) viven en `whatsapp_settings`.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.whatsapp_quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  shortcut text not null,
  content text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_quick_replies enable row level security;
create policy "whatsapp_quick_replies_member_all"
  on public.whatsapp_quick_replies for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create index if not exists wqr_org_idx on public.whatsapp_quick_replies(organization_id, position);

/* ══════ 5. agency_licenses ═══════════════════════════════════════════
 * Licencias colegiales (API, COAPI, AICAT…) por agencia.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.agency_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  type text not null,                        -- "API", "COAPI", "AICAT", "RICS", "FIABCI", "custom"
  registry_label text,                       -- "API Madrid", "AICAT Cataluña"...
  number text not null,
  issued_date date,
  expires_date date,
  document_url text,
  verified boolean not null default false,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.agency_licenses enable row level security;
create policy "agency_licenses_member_select"
  on public.agency_licenses for select
  using (public.is_org_member(organization_id));
create policy "agency_licenses_admin_write"
  on public.agency_licenses for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create index if not exists agency_licenses_org_idx on public.agency_licenses(organization_id);

/* ══════ 6. agency_doc_requests ═══════════════════════════════════════
 * Solicitudes de documentación del promotor a la agencia (DNI,
 * licencia, RC, etc.). Cada request agrupa varios items.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.agency_doc_requests (
  id uuid primary key default gen_random_uuid(),
  /* Promotor que pide */
  from_organization_id text not null references public.organizations(id) on delete cascade,
  /* Agencia destinataria */
  to_organization_id text not null references public.organizations(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','partial','completed','cancelled')),
  message text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.agency_doc_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.agency_doc_requests(id) on delete cascade,
  doc_type text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending','uploaded','approved','rejected')),
  document_url text,
  uploaded_at timestamptz,
  approved_at timestamptz,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.agency_doc_requests enable row level security;
alter table public.agency_doc_request_items enable row level security;
create policy "agency_doc_requests_visible_to_both"
  on public.agency_doc_requests for select
  using (
    public.is_org_member(from_organization_id)
    or public.is_org_member(to_organization_id)
  );
create policy "agency_doc_requests_promoter_writes"
  on public.agency_doc_requests for insert
  with check (public.is_org_member(from_organization_id));
create policy "agency_doc_requests_both_update"
  on public.agency_doc_requests for update
  using (
    public.is_org_member(from_organization_id)
    or public.is_org_member(to_organization_id)
  );
create policy "agency_doc_request_items_visible"
  on public.agency_doc_request_items for select
  using (
    exists (select 1 from public.agency_doc_requests r
            where r.id = request_id
              and (public.is_org_member(r.from_organization_id)
                   or public.is_org_member(r.to_organization_id)))
  );
create policy "agency_doc_request_items_writable"
  on public.agency_doc_request_items for all
  using (
    exists (select 1 from public.agency_doc_requests r
            where r.id = request_id
              and (public.is_org_member(r.from_organization_id)
                   or public.is_org_member(r.to_organization_id)))
  )
  with check (
    exists (select 1 from public.agency_doc_requests r
            where r.id = request_id
              and (public.is_org_member(r.from_organization_id)
                   or public.is_org_member(r.to_organization_id)))
  );

/* ══════ 7. agency_onboarding_state · empresa_onboarding_state ══════════
 * Estado del onboarding por workspace. Se guarda en JSONB en
 * `org_settings.value` con key `onboarding`. NO es tabla nueva · ya
 * tenemos org_settings. Documentación.
 * ──────────────────────────────────────────────────────────────────── */

/* ══════ 8. promotion_collab_status ═══════════════════════════════════
 * Estado per (agencia, promoción): activa | pausada | anulada.
 * Default = activa (no se persiste fila).
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.promotion_collab_status (
  promotion_id text not null references public.promotions(id) on delete cascade,
  agency_organization_id text not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('activa','pausada','anulada')),
  reason text,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  primary key (promotion_id, agency_organization_id)
);
alter table public.promotion_collab_status enable row level security;
create policy "pcs_visible_to_both_orgs"
  on public.promotion_collab_status for select
  using (
    exists (
      select 1 from public.promotions p
      where p.id = promotion_id
        and (public.is_org_member(p.owner_organization_id)
             or public.is_org_member(agency_organization_id))
    )
  );
create policy "pcs_owner_writes"
  on public.promotion_collab_status for all
  using (
    exists (
      select 1 from public.promotions p
      where p.id = promotion_id
        and public.is_org_member(p.owner_organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.promotions p
      where p.id = promotion_id
        and public.is_org_member(p.owner_organization_id)
    )
  );

/* ══════ 9. company_events ════════════════════════════════════════════
 * Timeline cross-empresa (auditoría · solo admin lo ve). Promotor ↔
 * agencia: invitations, registros, ventas, contratos, incidencias.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  /* Org del lado promotor (donde vive el panel del colaborador) */
  organization_id text not null references public.organizations(id) on delete cascade,
  /* Org del otro lado (la agencia colaboradora) */
  counterparty_organization_id text not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  /* Quién dispara · NULL si es Sistema */
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  /* Referencias opcionales del contexto */
  promotion_id text references public.promotions(id) on delete set null,
  registro_id text references public.registros(id) on delete set null,
  sale_id text references public.sales(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
alter table public.company_events enable row level security;
create policy "company_events_admin_select"
  on public.company_events for select
  using (
    public.is_org_admin(organization_id)
    or public.is_org_admin(counterparty_organization_id)
  );
create policy "company_events_member_insert"
  on public.company_events for insert
  with check (
    public.is_org_member(organization_id)
    or public.is_org_member(counterparty_organization_id)
  );
create index if not exists company_events_org_idx on public.company_events(organization_id, occurred_at desc);
create index if not exists company_events_cp_idx on public.company_events(counterparty_organization_id, occurred_at desc);

/* ══════ 10. marketing_rules ══════════════════════════════════════════
 * Prohibiciones de marketing por canal × promoción.
 * Convertido en metadata.marketingProhibitions[] en promotion ·
 * NO necesita tabla separada. Documentación.
 * ──────────────────────────────────────────────────────────────────── */

/* ══════ 11. org_email_domains ════════════════════════════════════════
 * Dominios de email asociados al workspace · usado por `Register.tsx`
 * para auto-detectar la empresa al introducir email.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.org_email_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  domain text not null unique,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.org_email_domains enable row level security;
create policy "oed_member_select"
  on public.org_email_domains for select
  using (true);  /* Lookup público · necesario para Register.tsx auto-detect */
create policy "oed_admin_write"
  on public.org_email_domains for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

/* ══════ 12. user_2fa ═════════════════════════════════════════════════
 * Estado del 2FA por user. Si no hay row · 2FA desactivado.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.user_2fa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  method text check (method in ('totp','sms','email')) default 'totp',
  secret_encrypted text,
  phone text,
  recovery_codes_hashed text[],
  enrolled_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.user_2fa enable row level security;
create policy "user_2fa_self"
  on public.user_2fa for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* ══════ 13. microsite_templates ══════════════════════════════════════
 * Templates de microsite por org. Cada promoción puede tener un
 * microsite asociado · template + overrides en metadata.
 * ──────────────────────────────────────────────────────────────────── */
create table if not exists public.microsite_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id text references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  preview_url text,
  is_global boolean not null default false,  /* Templates oficiales Byvaro */
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.microsite_templates enable row level security;
create policy "mt_select_visible"
  on public.microsite_templates for select
  using (
    is_global = true
    or (organization_id is not null and public.is_org_member(organization_id))
  );
create policy "mt_admin_write"
  on public.microsite_templates for all
  using (
    organization_id is not null and public.is_org_admin(organization_id)
  )
  with check (
    organization_id is not null and public.is_org_admin(organization_id)
  );

/* ══════ 14. Bridge views en api schema ═══════════════════════════════ */
drop view if exists api.invitations cascade;
create view api.invitations with (security_invoker = on) as
  select * from public.invitations;
grant select, insert, update on api.invitations to authenticated;

drop view if exists api.favorite_agencies cascade;
create view api.favorite_agencies with (security_invoker = on) as
  select * from public.favorite_agencies;
grant select, insert, delete on api.favorite_agencies to authenticated;

drop view if exists api.sent_emails cascade;
create view api.sent_emails with (security_invoker = on) as
  select * from public.sent_emails;
grant select, insert on api.sent_emails to authenticated;

drop view if exists api.whatsapp_quick_replies cascade;
create view api.whatsapp_quick_replies with (security_invoker = on) as
  select * from public.whatsapp_quick_replies;
grant select, insert, update, delete on api.whatsapp_quick_replies to authenticated;

drop view if exists api.agency_licenses cascade;
create view api.agency_licenses with (security_invoker = on) as
  select * from public.agency_licenses;
grant select, insert, update, delete on api.agency_licenses to authenticated;

drop view if exists api.agency_doc_requests cascade;
create view api.agency_doc_requests with (security_invoker = on) as
  select * from public.agency_doc_requests;
grant select, insert, update on api.agency_doc_requests to authenticated;

drop view if exists api.agency_doc_request_items cascade;
create view api.agency_doc_request_items with (security_invoker = on) as
  select * from public.agency_doc_request_items;
grant select, insert, update, delete on api.agency_doc_request_items to authenticated;

drop view if exists api.promotion_collab_status cascade;
create view api.promotion_collab_status with (security_invoker = on) as
  select * from public.promotion_collab_status;
grant select, insert, update, delete on api.promotion_collab_status to authenticated;

drop view if exists api.company_events cascade;
create view api.company_events with (security_invoker = on) as
  select * from public.company_events;
grant select, insert on api.company_events to authenticated;

drop view if exists api.org_email_domains cascade;
create view api.org_email_domains with (security_invoker = on) as
  select * from public.org_email_domains;
grant select, insert, update, delete on api.org_email_domains to authenticated;
grant select on api.org_email_domains to anon;  /* Lookup público */

drop view if exists api.user_2fa cascade;
create view api.user_2fa with (security_invoker = on) as
  select * from public.user_2fa;
grant select, insert, update, delete on api.user_2fa to authenticated;

drop view if exists api.microsite_templates cascade;
create view api.microsite_templates with (security_invoker = on) as
  select * from public.microsite_templates;
grant select, insert, update, delete on api.microsite_templates to authenticated;

/* ══════ 15. Notificaciones de cambios · keepalive ════════════════════
 * Las tablas siguen evolucionando · este migration cierra los
 * source-of-truth pendientes. Próximas evoluciones añadirán columnas
 * via ALTER en migraciones nuevas, NUNCA recreando tablas.
 * ──────────────────────────────────────────────────────────────────── */
