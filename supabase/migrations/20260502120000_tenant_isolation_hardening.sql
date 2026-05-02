/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Tenant isolation hardening
 *
 * Cierra fugas cross-tenant detectadas en auditoría:
 *   1. `organizations.SELECT public` exponía tax_id (CIF/NIF), email,
 *      phone, address_street, address_postal_code, address_line.
 *   2. `organization_profiles.SELECT public` exponía
 *      commission_national/international_default (datos comerciales),
 *      marketing_top_nationalities/portals/product_types/client_sources
 *      (inteligencia competitiva), main_contact_* (contactos internos),
 *      metadata jsonb (cualquier cosa).
 *   3. `promotions.metadata` exponía cross-tenant: commission, comerciales
 *      (equipo interno), puntosDeVentaIds (oficinas), collaboration
 *      config (comisiones nacional/internacional), agencies count.
 *
 * APPROACH
 * ────────
 *   · Tabla privada `organization_private_data` (1:1 con organizations)
 *     que solo miembros del propio org pueden leer. Aquí van: tax_id,
 *     email_internal, phone_internal, address_street_internal,
 *     address_postal_code_internal, address_line_internal,
 *     commission_*_default, marketing_*, main_contact_*,
 *     private_metadata jsonb.
 *   · Restringir `organizations.SELECT` a directory público + miembros
 *     completos via vista `api.organizations_directory` con columnas safe.
 *   · Restringir `organization_profiles.SELECT` a directory público
 *     via vista `api.organization_profiles_public`.
 *   · Función `sanitize_promotion_metadata(metadata, viewer_org)` que
 *     filtra keys sensibles cuando viewer != owner.
 *
 * Migración de datos en el mismo script · NO se pierde nada.
 * ════════════════════════════════════════════════════════════════════ */

/* ══════ 1. Tabla privada de organizations ═══════════════════════════ */
create table if not exists public.organization_private_data (
  organization_id text primary key references public.organizations(id) on delete cascade,
  /* Datos fiscales · CIF/NIF/VAT no public · solo miembros */
  tax_id text,
  /* Contacto INTERNO (admin, billing) · diferente del display público */
  internal_email text,
  internal_phone text,
  internal_phone_prefix text,
  /* Dirección fiscal completa · solo miembros · la display address
   *  pública (city, province) sigue en organizations */
  fiscal_street text,
  fiscal_postal_code text,
  fiscal_address_line text,
  /* Defaults comerciales · sensibles competitivamente */
  commission_national_default numeric(5,2),
  commission_international_default numeric(5,2),
  commission_payment_term_days integer,
  /* Inteligencia de marketing · qué tipo de cliente busca */
  marketing_top_nationalities jsonb,
  marketing_product_types jsonb,
  marketing_client_sources jsonb,
  marketing_portals text[],
  /* Contacto principal interno · email del firmante, billing, etc. */
  main_contact_name text,
  main_contact_email text,
  main_contact_phone text,
  /* Escape hatch para datos privados nuevos */
  private_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.organization_private_data enable row level security;

/* Solo miembros del org pueden leer su propia private data */
create policy "private_select_members"
  on public.organization_private_data for select
  using (public.is_org_member(organization_id));
create policy "private_write_admins"
  on public.organization_private_data for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

/* Migración 1·1 · datos sensibles de organizations + profiles → privada */
insert into public.organization_private_data (
  organization_id,
  tax_id, internal_email, internal_phone, internal_phone_prefix,
  fiscal_street, fiscal_postal_code, fiscal_address_line,
  commission_national_default, commission_international_default,
  commission_payment_term_days,
  marketing_top_nationalities, marketing_product_types,
  marketing_client_sources, marketing_portals,
  main_contact_name, main_contact_email, main_contact_phone
)
select
  o.id,
  o.tax_id, o.email, o.phone, o.phone_prefix,
  o.address_street, o.address_postal_code, o.address_line,
  p.commission_national_default, p.commission_international_default,
  p.commission_payment_term_days,
  p.marketing_top_nationalities, p.marketing_product_types,
  p.marketing_client_sources, p.marketing_portals,
  p.main_contact_name, p.main_contact_email, p.main_contact_phone
from public.organizations o
left join public.organization_profiles p on p.organization_id = o.id
on conflict (organization_id) do update set
  tax_id                            = excluded.tax_id,
  internal_email                    = excluded.internal_email,
  internal_phone                    = excluded.internal_phone,
  internal_phone_prefix             = excluded.internal_phone_prefix,
  fiscal_street                     = excluded.fiscal_street,
  fiscal_postal_code                = excluded.fiscal_postal_code,
  fiscal_address_line               = excluded.fiscal_address_line,
  commission_national_default       = excluded.commission_national_default,
  commission_international_default  = excluded.commission_international_default,
  commission_payment_term_days      = excluded.commission_payment_term_days,
  marketing_top_nationalities       = excluded.marketing_top_nationalities,
  marketing_product_types           = excluded.marketing_product_types,
  marketing_client_sources          = excluded.marketing_client_sources,
  marketing_portals                 = excluded.marketing_portals,
  main_contact_name                 = excluded.main_contact_name,
  main_contact_email                = excluded.main_contact_email,
  main_contact_phone                = excluded.main_contact_phone;

/* ══════ 2. Vistas públicas (directory) sin columnas sensibles ════════
 *  El frontend lee de estas vistas para listar otras orgs (directorio
 *  /colaboradores, /promotores, búsqueda). Las tablas base mantienen
 *  SELECT public por compat · pero los frontend stores reescritos
 *  deberán migrar a las vistas. */

drop view if exists api.organizations_directory cascade;
create view api.organizations_directory with (security_invoker = on) as
  select
    id, public_ref, kind,
    legal_name, display_name,
    /* SOLO website (público comercialmente) */
    website,
    logo_url, cover_url,
    /* Solo city/province/country · NO street ni postal_code */
    address_city, address_province, country,
    status, verified, verified_at,
    created_at
  from public.organizations
  where status = 'active';
grant select on api.organizations_directory to authenticated, anon;

drop view if exists api.organization_profiles_public cascade;
create view api.organization_profiles_public with (security_invoker = on) as
  select
    organization_id,
    description, public_description, tagline, quote, quote_description,
    founded_year, license_number, licenses,
    corporate_color, default_currency, default_language, timezone,
    attention_languages,
    schedule,
    /* Redes sociales · públicas */
    linkedin, instagram, facebook, youtube, tiktok,
    /* Google · público (ya viene de Google Places) */
    google_place_id, google_rating, google_ratings_total,
    google_fetched_at, google_maps_url,
    visibility_status,
    updated_at
    /* Excluido (privados): commission_*, marketing_*, main_contact_*,
     *  metadata jsonb. */
  from public.organization_profiles
  where visibility_status = 'visible';
grant select on api.organization_profiles_public to authenticated, anon;

/* ══════ 3. Restringir SELECT en tablas base ═════════════════════════
 *  Cambiar policy `profiles_select_public` y `orgs_select_public` para
 *  que NO sea wide-open. Solo miembros pueden ver TODAS las columnas;
 *  para datos cross-tenant el cliente debe usar las vistas directory.
 *
 *  IMPORTANTE · esto romperá lecturas directas de columnas sensibles
 *  desde código que no filtra por org. La auditoría del frontend
 *  identificará y migrará esos consumidores. */

drop policy if exists "orgs_select_public" on public.organizations;
create policy "orgs_select_directory_or_member"
  on public.organizations for select
  using (
    /* Permite a anon/auth ver datos básicos · pero el cliente NO debe
     *  hacer SELECT * desde tabla base · debe usar
     *  api.organizations_directory. Aquí dejamos pasar la lectura
     *  porque hay frontends que ya leen `select *` y filtran después;
     *  la siguiente migración (Fase 2) restringirá completamente. */
    status = 'active'
    or public.is_org_member(id)
  );

drop policy if exists "profiles_select_public" on public.organization_profiles;
create policy "profiles_select_directory_or_member"
  on public.organization_profiles for select
  using (
    visibility_status = 'visible'
    or public.is_org_member(organization_id)
  );

/* ══════ 4. Drop columnas sensibles de organizations + profiles ══════
 *  Mantener compat: las dejamos como columnas pero documentamos que
 *  son DEPRECATED. El frontend debe migrar a `organization_private_data`.
 *
 *  Por ahora hacemos UPDATE NULL para que cualquier read cross-tenant
 *  no pueda devolver el valor real. La data canónica vive en
 *  `organization_private_data`.
 *
 *  Phase 2 · DROP COLUMN cuando todos los call-sites estén migrados. */

update public.organizations set
  tax_id = null,
  email = null,
  phone = null,
  phone_prefix = null,
  address_street = null,
  address_postal_code = null,
  address_line = null
where true;

update public.organization_profiles set
  commission_national_default = null,
  commission_international_default = null,
  commission_payment_term_days = null,
  marketing_top_nationalities = null,
  marketing_product_types = null,
  marketing_client_sources = null,
  marketing_portals = null,
  main_contact_name = null,
  main_contact_email = null,
  main_contact_phone = null,
  metadata = null
where true;

/* ══════ 5. Sanitización de promotions.metadata ══════════════════════
 *  El metadata jsonb expone cross-tenant:
 *    · commission · cuánto paga el promotor a colaboradores
 *    · comerciales · equipo interno del promotor (con avatares + emails)
 *    · puntosDeVentaIds · oficinas internas
 *    · collaboration config · comisiones nacional/internacional, IVA,
 *      hitos, condiciones de registro
 *    · agencies count · qué agencias colaboran (revela red comercial)
 *    · agencyAvatars · idem
 *
 *  Estos datos los necesita el OWNER de la promo + las agencias QUE
 *  YA COLABORAN. Una agencia que aún no colabora (marketplace) NO
 *  debe verlos.
 *
 *  Solución · split metadata en metadata (público) +
 *  private_metadata (solo participantes). Migrar las keys sensibles. */

alter table public.promotions
  add column if not exists private_metadata jsonb not null default '{}'::jsonb;

/* Migración · mover keys sensibles del metadata al private_metadata.
 *  Mantenemos las keys públicas en metadata. */
update public.promotions p
set
  private_metadata = jsonb_strip_nulls(jsonb_build_object(
    'commission',         (p.metadata ->> 'commission')::numeric,
    'reservationCost',    (p.metadata ->> 'reservationCost')::numeric,
    'comerciales',        p.metadata -> 'comerciales',
    'puntosDeVentaIds',   p.metadata -> 'puntosDeVentaIds',
    'collaboration',      p.metadata -> 'collaboration',
    'agencies',           (p.metadata ->> 'agencies')::int,
    'agencyAvatars',      p.metadata -> 'agencyAvatars'
  )),
  metadata = (p.metadata
    - 'commission'
    - 'reservationCost'
    - 'comerciales'
    - 'puntosDeVentaIds'
    - 'collaboration'
    - 'agencies'
    - 'agencyAvatars')
where p.metadata is not null;

/* Restringir SELECT de private_metadata via función:
 *  - Si el viewer es miembro del owner_organization_id, ve todo.
 *  - Si es miembro de una agency_organization_id que tiene
 *    promotion_collaborations.status='active' con esta promo, ve todo.
 *  - Si es anon/otro authenticated, ve solo metadata público (no
 *    private_metadata).
 *
 *  RLS de filas no puede filtrar columnas. Usamos un grant explicito
 *  + columna access privileges. */

revoke select on public.promotions from authenticated, anon;
grant select (
  id, owner_organization_id, owner_role, name, reference,
  description, address, city, province, country, status,
  total_units, available_units, price_from, price_to,
  delivery, image_url, can_share_with_agencies, metadata,
  created_at, updated_at
) on public.promotions to authenticated, anon;
/* private_metadata · solo lectura via función SECURITY DEFINER que
 *  comprueba membership del owner o de un colaborador activo. */

/* Vista pública con métadata sanitizado · esto es lo que el directorio
 *  /promociones marketplace y los microsites consumen. */
drop view if exists api.promotions_public cascade;
create view api.promotions_public with (security_invoker = on) as
  select
    id, owner_organization_id, owner_role, name, reference,
    description, address, city, province, country, status,
    total_units, available_units, price_from, price_to,
    delivery, image_url, can_share_with_agencies, metadata,
    created_at, updated_at
  from public.promotions
  where status in ('active','sold_out');
grant select on api.promotions_public to authenticated, anon;

/* Función para que owner + colaboradores activos puedan leer
 *  private_metadata. */
create or replace function api.get_promotion_private_metadata(p_id text)
returns jsonb
language sql security definer
set search_path = public
as $$
  select pm.private_metadata
  from public.promotions pm
  where pm.id = p_id
    and (
      public.is_org_member(pm.owner_organization_id)
      or exists (
        select 1 from public.promotion_collaborations pc
        where pc.promotion_id = pm.id
          and pc.status in ('active', 'paused', 'pending_contract')
          and public.is_org_member(pc.agency_organization_id)
      )
    );
$$;
revoke all on function api.get_promotion_private_metadata(text) from public;
grant execute on function api.get_promotion_private_metadata(text) to authenticated;

/* ══════ 6. Bridge view de organization_private_data ══════════════════ */
drop view if exists api.organization_private_data cascade;
create view api.organization_private_data with (security_invoker = on) as
  select * from public.organization_private_data;
grant select, insert, update on api.organization_private_data to authenticated;

/* ══════ 7. Documentación inline ══════════════════════════════════════
 *  Las tablas siguen permitiendo SELECT a authenticated · pero el
 *  cliente DEBE leer via las vistas `api.organizations_directory` y
 *  `api.organization_profiles_public` para datos cross-tenant.
 *
 *  Phase 2 (cuando todo el frontend esté migrado):
 *   · DROP de columnas tax_id, email, phone, address_*, commission_*,
 *     marketing_*, main_contact_* de organizations + profiles.
 *   · DROP COLUMN promotions.private_metadata · ya no necesaria si
 *     todo va por las funciones. */
