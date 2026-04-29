-- =====================================================================
-- Byvaro · Phase 2 · RLS para todas las tablas nuevas
-- ---------------------------------------------------------------------
-- Aplica el patrón "members of this org pueden leer/escribir"
-- + cross-tenant gates donde aplica (registros visibles a developer
-- + agency que aporta).
-- =====================================================================

-- ─── Activar RLS ────────────────────────────────────────────────────
alter table public.contacts                 enable row level security;
alter table public.contact_events           enable row level security;
alter table public.leads                    enable row level security;
alter table public.registros                enable row level security;
alter table public.registro_events          enable row level security;
alter table public.sales                    enable row level security;
alter table public.sale_payments            enable row level security;
alter table public.calendar_events          enable row level security;
alter table public.visit_evaluations        enable row level security;
alter table public.notifications            enable row level security;
alter table public.user_favorites           enable row level security;
alter table public.emails_sent              enable row level security;
alter table public.email_events             enable row level security;
alter table public.email_templates          enable row level security;
alter table public.whatsapp_conversations   enable row level security;
alter table public.whatsapp_messages        enable row level security;
alter table public.agency_invoices          enable row level security;
alter table public.agency_payments          enable row level security;
alter table public.doc_requests             enable row level security;
alter table public.incidents                enable row level security;
alter table public.workspace_plans          enable row level security;
alter table public.paywall_events           enable row level security;
alter table public.stripe_events_processed  enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.permission_grants        enable row level security;
alter table public.promotion_units          enable row level security;
alter table public.promotion_anejos         enable row level security;
alter table public.promotion_gallery        enable row level security;
alter table public.payment_plans            enable row level security;


-- ═══════════════════════════════════════════════════════════════════
-- contacts · members del org propietario · cross-tenant deny.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists contacts_rw_members on public.contacts;
create policy contacts_rw_members on public.contacts
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- contact_events · audit append-only · members of org pueden leer
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists contactev_select on public.contact_events;
create policy contactev_select on public.contact_events
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists contactev_insert on public.contact_events;
create policy contactev_insert on public.contact_events
  for insert to authenticated with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- leads · members del workspace receptor
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists leads_rw_members on public.leads;
create policy leads_rw_members on public.leads
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  )
  with check (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );


-- ═══════════════════════════════════════════════════════════════════
-- registros · receiver (developer) + sender (agency) ven la fila.
-- Solo el receiver puede aprobar/rechazar (frontend lo enforce ya).
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists registros_select on public.registros;
create policy registros_select on public.registros
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );

drop policy if exists registros_insert on public.registros;
create policy registros_insert on public.registros
  for insert to authenticated
  with check (
    /* Insert · debe ser member de uno de los dos lados. */
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );

drop policy if exists registros_update on public.registros;
create policy registros_update on public.registros
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  )
  with check (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );


-- ═══════════════════════════════════════════════════════════════════
-- registro_events
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists regev_select on public.registro_events;
create policy regev_select on public.registro_events
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists regev_insert on public.registro_events;
create policy regev_insert on public.registro_events
  for insert to authenticated with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- sales · ambos lados (developer + agency) ven la fila.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists sales_rw on public.sales;
create policy sales_rw on public.sales
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  )
  with check (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );


-- ═══════════════════════════════════════════════════════════════════
-- sale_payments · cualquier member que vea la sale.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists salepay_rw on public.sale_payments;
create policy salepay_rw on public.sale_payments
  for all to authenticated
  using (exists (
    select 1 from public.sales s where s.id = sale_payments.sale_id
      and (
        public.is_org_member(s.organization_id)
        or (s.agency_organization_id is not null and public.is_org_member(s.agency_organization_id))
      )
  ))
  with check (exists (
    select 1 from public.sales s where s.id = sale_payments.sale_id
      and (
        public.is_org_member(s.organization_id)
        or (s.agency_organization_id is not null and public.is_org_member(s.agency_organization_id))
      )
  ));


-- ═══════════════════════════════════════════════════════════════════
-- calendar_events · members del org dueño
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists calev_rw on public.calendar_events;
create policy calev_rw on public.calendar_events
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- visit_evaluations
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists visitev_rw on public.visit_evaluations;
create policy visitev_rw on public.visit_evaluations
  for all to authenticated
  using (exists (
    select 1 from public.calendar_events ce
    where ce.id = visit_evaluations.calendar_event_id
      and public.is_org_member(ce.organization_id)
  ))
  with check (exists (
    select 1 from public.calendar_events ce
    where ce.id = visit_evaluations.calendar_event_id
      and public.is_org_member(ce.organization_id)
  ));


-- ═══════════════════════════════════════════════════════════════════
-- notifications · solo el destinatario.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid() or public.is_org_admin(organization_id));

drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications
  for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications
  for insert to authenticated
  with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- user_favorites · solo el dueño del fav.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists favs_rw on public.user_favorites;
create policy favs_rw on public.user_favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════
-- emails_sent · members del org emisor.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists emails_rw on public.emails_sent;
create policy emails_rw on public.emails_sent
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- email_events · cualquier member que pueda ver el email padre.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists emailev_rw on public.email_events;
create policy emailev_rw on public.email_events
  for all to authenticated
  using (
    email_id is null or exists (
      select 1 from public.emails_sent e
      where e.id = email_events.email_id and public.is_org_member(e.organization_id)
    )
  )
  with check (
    email_id is null or exists (
      select 1 from public.emails_sent e
      where e.id = email_events.email_id and public.is_org_member(e.organization_id)
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- email_templates · admin del workspace.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists emailtpl_select on public.email_templates;
create policy emailtpl_select on public.email_templates
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists emailtpl_write on public.email_templates;
create policy emailtpl_write on public.email_templates
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- whatsapp · members del org.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists wac_rw on public.whatsapp_conversations;
create policy wac_rw on public.whatsapp_conversations
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists wam_rw on public.whatsapp_messages;
create policy wam_rw on public.whatsapp_messages
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- agency_invoices · ambos lados (developer + agency)
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists invs_rw on public.agency_invoices;
create policy invs_rw on public.agency_invoices
  for all to authenticated
  using (
    public.is_org_member(developer_organization_id)
    or public.is_org_member(agency_organization_id)
  )
  with check (
    public.is_org_admin(developer_organization_id)
  );


-- ═══════════════════════════════════════════════════════════════════
-- agency_payments · ambos lados leen · solo developer admin escribe
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists pays_select on public.agency_payments;
create policy pays_select on public.agency_payments
  for select to authenticated
  using (
    public.is_org_member(developer_organization_id)
    or public.is_org_member(agency_organization_id)
  );

drop policy if exists pays_write on public.agency_payments;
create policy pays_write on public.agency_payments
  for all to authenticated
  using (public.is_org_admin(developer_organization_id))
  with check (public.is_org_admin(developer_organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- doc_requests · ambos lados.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists drq_rw on public.doc_requests;
create policy drq_rw on public.doc_requests
  for all to authenticated
  using (
    public.is_org_member(developer_organization_id)
    or public.is_org_member(agency_organization_id)
  )
  with check (
    public.is_org_member(developer_organization_id)
    or public.is_org_member(agency_organization_id)
  );


-- ═══════════════════════════════════════════════════════════════════
-- incidents · developer admin · agency lee la suya.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists inc_select on public.incidents;
create policy inc_select on public.incidents
  for select to authenticated
  using (
    public.is_org_member(developer_organization_id)
    or (agency_organization_id is not null and public.is_org_member(agency_organization_id))
  );

drop policy if exists inc_write on public.incidents;
create policy inc_write on public.incidents
  for all to authenticated
  using (public.is_org_admin(developer_organization_id))
  with check (public.is_org_admin(developer_organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- workspace_plans + paywall_events + subscriptions · members del org.
-- stripe_events_processed · solo backend (service role bypass).
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists plans_select on public.workspace_plans;
create policy plans_select on public.workspace_plans
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists plans_write on public.workspace_plans;
create policy plans_write on public.workspace_plans
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists paywall_select on public.paywall_events;
create policy paywall_select on public.paywall_events
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists paywall_insert on public.paywall_events;
create policy paywall_insert on public.paywall_events
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists subs_select on public.subscriptions;
create policy subs_select on public.subscriptions
  for select to authenticated using (public.is_org_member(organization_id));

-- stripe_events_processed · sin policies · solo service_role accede.


-- ═══════════════════════════════════════════════════════════════════
-- permission_grants · solo admin del workspace.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists pg_rw on public.permission_grants;
create policy pg_rw on public.permission_grants
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));


-- ═══════════════════════════════════════════════════════════════════
-- promotion_* · públicos para autenticados (catalog) · escribe owner.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists units_select on public.promotion_units;
create policy units_select on public.promotion_units
  for select to authenticated using (true);
drop policy if exists units_write on public.promotion_units;
create policy units_write on public.promotion_units
  for all to authenticated
  using (exists (
    select 1 from public.promotions p where p.id = promotion_units.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ))
  with check (exists (
    select 1 from public.promotions p where p.id = promotion_units.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ));

drop policy if exists anejos_select on public.promotion_anejos;
create policy anejos_select on public.promotion_anejos
  for select to authenticated using (true);
drop policy if exists anejos_write on public.promotion_anejos;
create policy anejos_write on public.promotion_anejos
  for all to authenticated
  using (exists (
    select 1 from public.promotions p where p.id = promotion_anejos.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ))
  with check (exists (
    select 1 from public.promotions p where p.id = promotion_anejos.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ));

drop policy if exists gallery_select on public.promotion_gallery;
create policy gallery_select on public.promotion_gallery
  for select to authenticated using (true);
drop policy if exists gallery_write on public.promotion_gallery;
create policy gallery_write on public.promotion_gallery
  for all to authenticated
  using (exists (
    select 1 from public.promotions p where p.id = promotion_gallery.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ))
  with check (exists (
    select 1 from public.promotions p where p.id = promotion_gallery.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ));

drop policy if exists ppplans_select on public.payment_plans;
create policy ppplans_select on public.payment_plans
  for select to authenticated using (true);
drop policy if exists ppplans_write on public.payment_plans;
create policy ppplans_write on public.payment_plans
  for all to authenticated
  using (exists (
    select 1 from public.promotions p where p.id = payment_plans.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ))
  with check (exists (
    select 1 from public.promotions p where p.id = payment_plans.promotion_id
      and public.is_org_admin(p.owner_organization_id)
  ));
