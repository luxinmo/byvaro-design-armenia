# Arquitectura · Tenant Isolation

> **Una empresa NUNCA debe acceder a datos sensibles de otra
> empresa** · ni desde la UI, ni desde devtools, ni con queries
> directas a Supabase. Este documento describe las 4 capas de defensa
> que lo garantizan.

## 1 · Modelo de amenazas

Atacante = miembro de la organización A intentando ver datos de la
organización B.

Vectores posibles:

1. **Frontend tampering** · modificar JWT, suplantar org
2. **Devtools console** · ejecutar queries Supabase directamente
3. **Bundle inspection** · localizar el cliente Supabase y abusar
4. **Memory dump** · leer `memCache` desde devtools
5. **API REST directa** · `fetch('https://<ref>.supabase.co/rest/v1/<tabla>')`
   con anon key (visible en bundle) y JWT propio
6. **RPC abuse** · llamar a funciones SECURITY DEFINER con args manipulados

Datos sensibles a proteger:

- **Fiscales** · tax_id (CIF/NIF), email/teléfono interno, dirección
  fiscal completa (calle, código postal, dirección legal)
- **Comerciales** · comisiones por defecto (nacional/internacional),
  plazos de pago, comisiones específicas por colaboración
- **Inteligencia competitiva** · marketing_top_nationalities (qué
  cliente busca cada agencia), marketing_portals (qué portales usa),
  marketing_product_types, marketing_client_sources
- **Contactos internos** · main_contact_email/phone/name (responsable
  de billing/firma)
- **Operación interna** · equipo del promotor (`comerciales` array
  con emails), oficinas internas (`puntosDeVentaIds`), red comercial
  (`agencies` count + `agencyAvatars`)
- **Negocio** · ventas, registros, leads, contactos, emails enviados,
  WhatsApp messages, audit log, contratos firmados, facturas, pagos

## 2 · Las 4 capas de defensa

### Capa 1 · RLS por fila

Toda tabla con `organization_id` tiene RLS habilitada y al menos una
policy que filtra por `is_org_member()`:

```sql
create policy "table_member_only"
  on public.foo for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
```

Tablas dual-tenant (sales, registros, leads) filtran por ambos lados:

```sql
create policy "sales_rw"
  on public.sales for all
  using (
    public.is_org_member(organization_id)
    or (agency_organization_id is not null
        and public.is_org_member(agency_organization_id))
  );
```

Helpers SECURITY DEFINER:

```sql
create function public.is_org_member(target_org text)
returns boolean language sql stable security definer
as $$
  select exists(
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = target_org
      and status = 'active'
  );
$$;
```

`is_org_admin()` análogo pero filtra `role = 'admin'`.

### Capa 2 · Column-level grants

Para columnas sensibles que NO se pueden filtrar con RLS (p.ej.
`promotions.private_metadata`), usamos `REVOKE` + `GRANT (cols)`:

```sql
revoke select on public.promotions from authenticated, anon;
grant select (
  id, owner_organization_id, owner_role, name, reference,
  description, address, city, province, country, status,
  total_units, available_units, price_from, price_to,
  delivery, image_url, can_share_with_agencies, metadata,
  created_at, updated_at
) on public.promotions to authenticated, anon;
-- private_metadata · sin grant · permission denied al intentar leer
```

Test:
```sql
SET ROLE anon;
SELECT private_metadata FROM public.promotions LIMIT 1;
-- ERROR: permission denied for table promotions
```

### Capa 3 · Tablas privadas dedicadas

Datos hipersensibles van a tablas dedicadas con RLS member-only:

#### `organization_private_data` (1:1 con organizations)

```sql
create table public.organization_private_data (
  organization_id text primary key references public.organizations(id),
  -- Fiscales
  tax_id text,
  internal_email text,
  internal_phone text,
  internal_phone_prefix text,
  fiscal_street text,
  fiscal_postal_code text,
  fiscal_address_line text,
  -- Comerciales sensibles
  commission_national_default numeric(5,2),
  commission_international_default numeric(5,2),
  commission_payment_term_days integer,
  -- Inteligencia de marketing
  marketing_top_nationalities jsonb,
  marketing_product_types jsonb,
  marketing_client_sources jsonb,
  marketing_portals text[],
  -- Contacto interno
  main_contact_name text,
  main_contact_email text,
  main_contact_phone text,
  -- Escape hatch
  private_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.organization_private_data enable row level security;
create policy "private_select_members"
  on public.organization_private_data for select
  using (public.is_org_member(organization_id));
create policy "private_write_admins"
  on public.organization_private_data for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
```

**Test**:
```sql
SET ROLE anon;
SELECT count(*) FROM public.organization_private_data;
-- 0 (RLS bloquea sin auth.uid())
```

Las columnas duplicadas en `organizations` y `organization_profiles`
fueron **NULIFICADAS** post migración. Por compat se mantiene la
columna pero sin valor · canonicidad vive en `organization_private_data`.

### Capa 4 · RPCs SECURITY DEFINER con check de membership

Para datos privados que requieren lógica de "owner OR colaborador
activo" (caso de `promotions.private_metadata`), usamos RPC:

```sql
create function api.list_promotion_private_metadata()
returns table(promotion_id text, private_metadata jsonb)
language sql security definer
set search_path = public
as $$
  select pm.id, pm.private_metadata
  from public.promotions pm
  where
    public.is_org_member(pm.owner_organization_id)
    or exists (
      select 1 from public.promotion_collaborations pc
      where pc.promotion_id = pm.id
        and pc.status in ('active', 'paused', 'pending_contract')
        and public.is_org_member(pc.agency_organization_id)
    );
$$;
revoke all on function api.list_promotion_private_metadata() from public;
grant execute on function api.list_promotion_private_metadata() to authenticated;
```

El frontend llama:

```ts
const { data } = await supabase.rpc("list_promotion_private_metadata");
// data = [{ promotion_id, private_metadata }] solo de las promos donde
// el caller es owner o colaborador activo. Cross-tenant queries
// devuelven array vacío (no expone existencia siquiera).
```

## 3 · Vistas públicas (directorio)

Para listar otras empresas (directorio /colaboradores, /promotores) el
frontend lee de **vistas** que solo exponen columnas safe:

```sql
create view api.organizations_directory with (security_invoker = on) as
  select
    id, public_ref, kind,
    legal_name, display_name,
    website, logo_url, cover_url,
    address_city, address_province, country,
    status, verified, verified_at,
    created_at
  from public.organizations
  where status = 'active';
grant select on api.organizations_directory to authenticated, anon;
```

Equivalente para profiles (`organization_profiles_public`) y promociones (`promotions_public`).

`security_invoker = on` significa que el SELECT respeta los permisos
del usuario que llama (no del owner de la vista). Esto es crítico
para que la vista no escale privilegios.

## 4 · Auditoría · funciones SECURITY DEFINER existentes

| Función | Risk | Check |
|---|---|---|
| `is_org_member(target_org)` | LOW · helper | ✅ usa `auth.uid()` |
| `is_org_admin(target_org)` | LOW · helper | ✅ usa `auth.uid()` |
| `merge_org_metadata(p_org_id, p_patch)` | HIGH · escribe org ajena | ✅ chequea `is_org_member(p_org_id)` · raise forbidden |
| `find_org_by_ref(p_ref)` | LOW · directorio público | ✅ solo expone columnas safe (id, public_ref, kind, display_name, legal_name, logo_url, verified) |
| `find_responsible_invitation(p_token)` | LOW · token-based | ✅ solo devuelve si el token coincide |
| `has_active_collab_with(target_org)` | LOW · solo true/false | ✅ usa `auth.uid()` para resolver el caller |
| `has_live_promotion_collab_with(target_org)` | LOW · idem | ✅ idem |
| `get_promotion_private_metadata(p_id)` | HIGH · datos sensibles | ✅ chequea owner OR colaborador activo |
| `list_promotion_private_metadata()` | HIGH · datos sensibles | ✅ chequea membership por fila |

Toda función SECURITY DEFINER nueva DEBE:

1. Tener `set search_path = public, pg_catalog` (anti-shadowing)
2. Comprobar `is_org_member()` o `is_org_admin()` antes de devolver
   o mutar
3. `revoke all on function ... from public; grant execute to authenticated`
4. Documentarse en este archivo

## 5 · Verificación end-to-end

### Test 1 · Anon NO ve nada sensible

```bash
psql "$SUPABASE_DB_URL" <<'SQL'
SET ROLE anon;
-- Esperamos NULL en columnas sensibles
SELECT count(tax_id), count(email), count(phone) FROM public.organizations;
SELECT count(commission_national_default) FROM public.organization_profiles;
-- Esperamos 0 rows
SELECT count(*) FROM public.organization_private_data;
SELECT count(*) FROM public.sales;
SELECT count(*) FROM public.registros;
SELECT count(*) FROM public.contacts;
-- Esperamos permission denied
SELECT private_metadata FROM public.promotions LIMIT 1;
SELECT * FROM api.list_promotion_private_metadata();
RESET ROLE;
SQL
```

Resultado esperado · todos 0 / NULL / permission denied.

### Test 2 · UPDATE/DELETE bloqueados

```sql
SET ROLE anon;
WITH r AS (
  UPDATE public.organizations SET tax_id = 'HACKED' WHERE true RETURNING id
)
SELECT count(*) FROM r;  -- 0 (RLS filtra)
SELECT count(*) FROM public.organizations WHERE tax_id = 'HACKED';  -- 0
RESET ROLE;
```

### Test 3 · Authenticated cross-tenant (requiere JWT real)

Setup · login como user de org A. Después en devtools:

```js
const { supabase } = await import("/src/lib/supabaseClient.ts");
const { data: A } = await supabase.from("organization_private_data").select("*");
console.log(A);
// Esperamos: solo 1 row con organization_id de la org A
// Las orgs B, C, D etc. NO aparecen
```

```js
const { data: B } = await supabase.rpc("list_promotion_private_metadata");
console.log(B);
// Esperamos: solo promociones donde A es owner o colaborador activo
// Resto NO aparecen (no expone ni la existencia)
```

## 6 · Anti-patterns prohibidos

- ❌ Crear tabla nueva con `organization_id` SIN RLS · default deny
  no aplica si no hay RLS habilitada
- ❌ Crear policy con `qual = true` y luego intentar filtrar columnas
  · RLS opera por fila, no por columna · usa column grants o tabla
  privada
- ❌ Función SECURITY DEFINER sin `set search_path` · vulnerable a
  schema shadowing attack
- ❌ Función SECURITY DEFINER que devuelve datos sin chequear
  membership · escala privilegios
- ❌ View en `api.*` SIN `security_invoker = on` · escala privilegios
  del owner
- ❌ GRANT `all on function ... to public` · siempre `revoke all` +
  `grant execute to authenticated`
- ❌ Pasar `service_role_key` al frontend · solo en scripts/server
  side
- ❌ Hidratar `organization_private_data` cross-tenant en frontend ·
  RLS solo devuelve la propia · OK, pero NO mergear esa data al
  shape de otras orgs · se quedaría en undefined

## 7 · Cuando añadir un campo · ¿es sensible?

Pregúntate:

| Pregunta | Si SÍ → |
|---|---|
| ¿Es dato fiscal/legal (tax_id, NIF, datos bancarios)? | `organization_private_data` o tabla dedicada con RLS member-only |
| ¿Es dato comercial que afecta negociación (comisión, descuento, margen)? | `organization_private_data` o `private_metadata` jsonb |
| ¿Revela inteligencia competitiva (clientes, portales, segmentos)? | `organization_private_data` |
| ¿Es contacto interno (no público)? | `organization_private_data` |
| ¿Es info operativa interna (equipo, oficinas no comerciales)? | `private_metadata` o tabla dedicada |
| ¿Es info de business (ventas, registros, contactos, contratos)? | Tabla dedicada con RLS · multi-tenant si dual-side |
| ¿Es display público (nombre, logo, web, ciudad, redes)? | `organizations` / `organization_profiles` con SELECT public |
| ¿Es contenido de microsite (foto, plano, tipología)? | `promotions` columnas safe + tablas asociadas (units, gallery, anejos) public |

## 8 · Migration checklist

Cuando añadas un campo sensible nuevo:

- [ ] ¿Lo metí en `organization_private_data` o tabla privada nueva?
- [ ] ¿Tiene RLS member-only o equivalente?
- [ ] ¿Hay bridge view en `api.*` con `security_invoker = on`?
- [ ] ¿El helper TS escribe en la tabla privada (no en la pública)?
- [ ] ¿`hydrateXFromSupabase` solo pulla datos del propio org (RLS
  lo garantiza, pero verifica que no asume datos cross)?
- [ ] ¿Test SQL como anon · 0 rows / NULL / permission denied?
- [ ] ¿Test SQL como user de org B · 0 rows del org A?
- [ ] Documenté el campo en este archivo
