-- =====================================================================
-- Byvaro · Row Level Security
-- ---------------------------------------------------------------------
-- Implementa §6 (permission rules) y §8 (data access validation) de
-- docs/backend-dual-role-architecture.md.
--
-- ESTRATEGIA · cada usuario autenticado tiene una o más memberships
-- (filas en `organization_members`). Las policies miran si el `auth.uid()`
-- del JWT actual tiene una membership en la organization_id en cuestión,
-- y/o si la otra org tiene una colaboración activa.
--
-- HELPER FUNCTIONS · centralizan los predicados para evitar repetición
-- y permitir auditarlos en un solo punto. Marcadas SECURITY DEFINER
-- con search_path explícito.
-- =====================================================================

-- ─── Helpers ────────────────────────────────────────────────────────

-- ¿El usuario actual es member (cualquier rol) de esta organización?
create or replace function public.is_org_member(target_org text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ¿El usuario actual es admin activo de esta organización?
create or replace function public.is_org_admin(target_org text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

-- ¿Existe una colaboración org-level ACTIVE entre mi org y la target?
-- Acepta cualquiera de mis orgs · útil cuando el user es member de
-- varias agencias (poco común pero supported).
create or replace function public.has_active_collab_with(target_org text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.organization_collaborations c
    join public.organization_members m
      on m.user_id = auth.uid() and m.status = 'active'
    where c.status = 'active'
      and (
        (c.organization_a_id = m.organization_id and c.organization_b_id = target_org)
        or
        (c.organization_b_id = m.organization_id and c.organization_a_id = target_org)
      )
  );
$$;

-- ¿Hay al menos un promotion_collab vivo entre mi org y la target?
-- "Vivo" = active o pending_contract (§6.2 sensitive access).
create or replace function public.has_live_promotion_collab_with(target_org text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.promotion_collaborations pc
    join public.organization_members m
      on m.user_id = auth.uid() and m.status = 'active'
    where pc.status in ('active','pending_contract')
      and (
        (pc.agency_organization_id = m.organization_id and pc.developer_organization_id = target_org)
        or
        (pc.developer_organization_id = m.organization_id and pc.agency_organization_id = target_org)
      )
  );
$$;


-- ─── Activar RLS en todas las tablas ────────────────────────────────
alter table public.organizations              enable row level security;
alter table public.organization_profiles      enable row level security;
alter table public.organization_members       enable row level security;
alter table public.offices                    enable row level security;
alter table public.promotions                 enable row level security;
alter table public.collab_requests            enable row level security;
alter table public.organization_collaborations enable row level security;
alter table public.promotion_collaborations   enable row level security;
alter table public.collaboration_documents    enable row level security;
alter table public.audit_events               enable row level security;


-- ─── organizations ──────────────────────────────────────────────────
-- SELECT · cualquier autenticado lee la fila base (info pública).
-- Los campos sensibles viven en organization_profiles con RLS más estricta.
drop policy if exists orgs_select_authenticated on public.organizations;
create policy orgs_select_authenticated on public.organizations
  for select to authenticated
  using (true);

-- UPDATE · solo admin de la org puede editar.
drop policy if exists orgs_update_admin on public.organizations;
create policy orgs_update_admin on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- INSERT · prohibido vía API (solo seed/migration con service_role).
-- DELETE · idem.


-- ─── organization_profiles ──────────────────────────────────────────
-- SELECT public · cualquier autenticado lee los campos no-sensibles.
-- Campos sensibles (main_contact_*, schedule) se filtran en el client
-- via SELECT explícito · OR el frontend consume `/sensitive` que es
-- una RPC restringida (a implementar en migration posterior).
drop policy if exists profiles_select_authenticated on public.organization_profiles;
create policy profiles_select_authenticated on public.organization_profiles
  for select to authenticated
  using (true);

-- UPDATE · solo admin de la org.
drop policy if exists profiles_update_admin on public.organization_profiles;
create policy profiles_update_admin on public.organization_profiles
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- INSERT · solo admin (al crear org via signup flow).
drop policy if exists profiles_insert_admin on public.organization_profiles;
create policy profiles_insert_admin on public.organization_profiles
  for insert to authenticated
  with check (public.is_org_admin(organization_id));


-- ─── organization_members ───────────────────────────────────────────
-- SELECT · members de la org se ven entre sí. Cross-org no.
drop policy if exists members_select_same_org on public.organization_members;
create policy members_select_same_org on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

-- INSERT/UPDATE/DELETE · solo admin de la org.
drop policy if exists members_write_admin on public.organization_members;
create policy members_write_admin on public.organization_members
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));


-- ─── offices ────────────────────────────────────────────────────────
-- SELECT · public · cualquier autenticado puede ver oficinas (datos
-- de marketing). Si producto decide ocultar phone/email a no-collabs,
-- se hace en el SELECT del cliente o en una RPC.
drop policy if exists offices_select_authenticated on public.offices;
create policy offices_select_authenticated on public.offices
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE · solo admin de la org dueña.
drop policy if exists offices_write_admin on public.offices;
create policy offices_write_admin on public.offices
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));


-- ─── promotions ─────────────────────────────────────────────────────
-- SELECT · marketplace público · cualquier autenticado puede ver
-- promociones activas (subset de fields se gestiona en el cliente).
drop policy if exists promotions_select_authenticated on public.promotions;
create policy promotions_select_authenticated on public.promotions
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE · solo admin de la org dueña.
drop policy if exists promotions_write_owner_admin on public.promotions;
create policy promotions_write_owner_admin on public.promotions
  for all to authenticated
  using (public.is_org_admin(owner_organization_id))
  with check (public.is_org_admin(owner_organization_id));


-- ─── collab_requests ────────────────────────────────────────────────
-- SELECT · solo si mi org es from_ o to_.
drop policy if exists requests_select_participant on public.collab_requests;
create policy requests_select_participant on public.collab_requests
  for select to authenticated
  using (
    public.is_org_member(from_organization_id)
    or public.is_org_member(to_organization_id)
  );

-- INSERT · solo admin del fromOrgId. El campo `from_organization_id`
-- y `created_by_user_id` deben matchear el caller (el cliente lo pasa,
-- la policy verifica).
drop policy if exists requests_insert_admin on public.collab_requests;
create policy requests_insert_admin on public.collab_requests
  for insert to authenticated
  with check (
    public.is_org_admin(from_organization_id)
    and created_by_user_id = auth.uid()
  );

-- UPDATE · solo el receiver puede acept/reject (modifica status,
-- responded_*). El sender puede cancel (sub-action via función).
-- Para simplicidad Phase 2 · permitir UPDATE a admin de cualquiera de
-- las dos partes; el frontend valida la transición concreta antes de
-- enviar.
drop policy if exists requests_update_participant_admin on public.collab_requests;
create policy requests_update_participant_admin on public.collab_requests
  for update to authenticated
  using (
    public.is_org_admin(from_organization_id)
    or public.is_org_admin(to_organization_id)
  )
  with check (
    public.is_org_admin(from_organization_id)
    or public.is_org_admin(to_organization_id)
  );

-- DELETE · prohibido. Audit-trail · solo updates al status.


-- ─── organization_collaborations ────────────────────────────────────
-- SELECT · solo participantes de la pareja.
drop policy if exists orgcollab_select_participants on public.organization_collaborations;
create policy orgcollab_select_participants on public.organization_collaborations
  for select to authenticated
  using (
    public.is_org_member(organization_a_id)
    or public.is_org_member(organization_b_id)
  );

-- INSERT/UPDATE/DELETE · admin de cualquiera de las dos partes.
drop policy if exists orgcollab_write_admins on public.organization_collaborations;
create policy orgcollab_write_admins on public.organization_collaborations
  for all to authenticated
  using (
    public.is_org_admin(organization_a_id)
    or public.is_org_admin(organization_b_id)
  )
  with check (
    public.is_org_admin(organization_a_id)
    or public.is_org_admin(organization_b_id)
  );


-- ─── promotion_collaborations ───────────────────────────────────────
drop policy if exists promocollab_select_participants on public.promotion_collaborations;
create policy promocollab_select_participants on public.promotion_collaborations
  for select to authenticated
  using (
    public.is_org_member(agency_organization_id)
    or public.is_org_member(developer_organization_id)
  );

-- INSERT · solo admin del developer (el dueño de la promoción).
-- UPDATE · ambos pueden, pero las transiciones críticas (pause/end)
-- las gestiona el developer per §6.4.
drop policy if exists promocollab_write_admins on public.promotion_collaborations;
create policy promocollab_write_admins on public.promotion_collaborations
  for all to authenticated
  using (
    public.is_org_admin(agency_organization_id)
    or public.is_org_admin(developer_organization_id)
  )
  with check (
    public.is_org_admin(agency_organization_id)
    or public.is_org_admin(developer_organization_id)
  );


-- ─── collaboration_documents ────────────────────────────────────────
-- SELECT · admin de cualquiera de las dos partes (la collaboration
-- vinculada). Para Phase 2 · simplificación: members de cualquiera de
-- las orgs pueden ver el doc · una iteración futura restringe a admin.
drop policy if exists docs_select_participants on public.collaboration_documents;
create policy docs_select_participants on public.collaboration_documents
  for select to authenticated
  using (
    case
      when collaboration_id is not null then exists (
        select 1 from public.organization_collaborations c
        where c.id = collaboration_documents.collaboration_id
          and (public.is_org_member(c.organization_a_id) or public.is_org_member(c.organization_b_id))
      )
      when promotion_collaboration_id is not null then exists (
        select 1 from public.promotion_collaborations pc
        where pc.id = collaboration_documents.promotion_collaboration_id
          and (public.is_org_member(pc.agency_organization_id) or public.is_org_member(pc.developer_organization_id))
      )
      else false
    end
  );

-- INSERT/UPDATE · solo developer-side admin (regla §11 #10).
drop policy if exists docs_write_developer_admin on public.collaboration_documents;
create policy docs_write_developer_admin on public.collaboration_documents
  for all to authenticated
  using (
    case
      when promotion_collaboration_id is not null then exists (
        select 1 from public.promotion_collaborations pc
        where pc.id = collaboration_documents.promotion_collaboration_id
          and public.is_org_admin(pc.developer_organization_id)
      )
      when collaboration_id is not null then exists (
        select 1 from public.organization_collaborations c
        where c.id = collaboration_documents.collaboration_id
          and (public.is_org_admin(c.organization_a_id) or public.is_org_admin(c.organization_b_id))
      )
      else false
    end
  )
  with check (true);


-- ─── audit_events ───────────────────────────────────────────────────
-- SELECT · members de la org. El cross-tenant audit (ver historial de
-- una agencia colaboradora) lo gestiona una RPC dedicada en una
-- migration posterior · para Phase 2 cada workspace ve su propio log.
drop policy if exists audit_select_org_member on public.audit_events;
create policy audit_select_org_member on public.audit_events
  for select to authenticated
  using (public.is_org_member(organization_id));

-- INSERT · cualquier autenticado puede insertar PARA una org de la
-- que es member (write-your-own-history). Nota: en producción el
-- backend writes audit · aquí permisivo para Phase 2 mientras los
-- helpers lo emiten desde el cliente.
drop policy if exists audit_insert_member on public.audit_events;
create policy audit_insert_member on public.audit_events
  for insert to authenticated
  with check (public.is_org_member(organization_id));

-- UPDATE/DELETE · prohibido (append-only).
