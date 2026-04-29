# Backend development rules · regla de oro permanente

> **Documento canónico · 2026-04-29.** A partir de aquí, cada cambio
> que toque datos del producto se hace **frontend + backend a la vez**.
> Los helpers son la frontera estable: cuando este Supabase salga de
> producción y se sustituya por backend custom, **lo único que cambia
> es la implementación interna de los helpers**. Componentes y rutas
> siguen iguales. Por eso los helpers SIEMPRE existen y SIEMPRE son la
> única forma de tocar datos.

Este doc se complementa con:
- `CLAUDE.md` · regla de oro inline (siempre en contexto).
- `docs/backend-dual-role-architecture.md` · spec del schema y endpoints.
- `docs/backend-integration.md` · contrato UI ↔ API por dominio.

---

## 0 · Por qué existe esta regla

Antes de Phase 2 el frontend era un prototipo en `localStorage`.
Cuando montamos Supabase nos encontramos con que muchos componentes
leían directamente del seed estático o de claves localStorage globales
sin pasar por una capa intermedia. Resultado: cada nueva tabla
requería tocar 5-10 archivos, y al primer fallo de RLS la pantalla se
quedaba vacía sin error visible.

La regla de oro es la solución: **una pantalla nunca habla con la
fuente de datos directamente**. Habla con un helper de `src/lib/*`.
El helper decide si los datos vienen de Supabase, de localStorage, de
una API custom mañana, o de un mock para tests. Cualquier cambio de
backend pasa por reescribir los helpers · cero cambios en componentes.

---

## 1 · Arquitectura · 3 capas

```
┌─────────────────────────────────────────────────────┐
│  Componentes React  (src/pages/*, src/components/*) │
│  ─────────────────────                              │
│  Solo leen/escriben vía hooks o funciones de lib/*  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Helpers / Service layer  (src/lib/*.ts)            │
│  ────────────────────────                           │
│  · useEmpresa, useOficinas, useRegistros…           │
│  · loadEmpresaForOrg, saveOficinasForOrg…           │
│  · crearOrgCollabRequest, updateRegistroState…      │
│  ÚNICO punto que conoce supabaseClient + localStorage│
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴─────────┐
        ▼                  ▼
┌──────────────┐    ┌─────────────────┐
│  Supabase    │    │  localStorage    │
│  (prod data) │    │  (cache + UX)    │
└──────────────┘    └─────────────────┘
```

### El patrón híbrido write-through

Para mantener los componentes síncronos (sin loading states ramificados),
los helpers usan write-through:

1. **Mutación** · UI llama `helper.update(...)`.
2. **Optimistic local** · helper escribe localStorage scoped key + dispatch event → UI se refresca instantánea.
3. **Async backend** · helper hace `void (async () => supabase.from(...).upsert(...))()` sin bloquear.
4. **Si falla server-side** · log de warning. Phase 3 añadirá retry+queue+conflict resolution.

Para lecturas:
1. **Hidratación al login** · `<SupabaseHydrator>` pulla bulk de Supabase y rellena las claves localStorage scoped.
2. **Componentes leen de cache local** · sync, instantáneo.
3. **Re-hidratación** · al volver del logout/login, evento auth.

---

## 2 · LA REGLA DE ORO

> **Nunca llames a `supabase.from(...)` ni a `localStorage.*` desde un
> componente o desde una página.** Esa interacción siempre pasa por un
> helper de `src/lib/*`. El helper sabe si los datos están en Supabase,
> en mock, en cache, o en otra cosa el día de mañana. Esta capa es lo
> único que cambia cuando el backend evoluciona.

Excepciones documentadas:
- `src/lib/supabaseClient.ts` · es el cliente singleton, OK que llame.
- `src/components/SupabaseHydrator.tsx` · usa `supabase.auth.onAuthStateChange` para reaccionar al login. Es el detonador del hydrator. OK.
- `src/pages/Login.tsx` · llama a `supabase.auth.signInWithPassword` directamente. Es el único punto que negocia auth. OK.

Cualquier otro archivo que llame a Supabase o `localStorage` directamente está **violando la regla** y debe refactorizarse.

---

## 3 · Cuándo añades una FEATURE NUEVA

Pongamos que producto pide "etiquetas en contactos" o "comentarios en
promociones" o lo que sea. Sigue este orden EXACTO:

### Paso 1 · Schema en Supabase
Crea migración `supabase/migrations/<timestamp>_<feature>_schema.sql`:
- Tabla(s) en schema `public` con columnas, FKs, índices.
- Enums si aplica.
- `updated_at` trigger.
- **Siempre** incluye `organization_id` (multi-tenant) salvo casos
  específicos (e.g. `user_favorites`, `audit_events` cross-org).

### Paso 2 · RLS en migración separada
`supabase/migrations/<timestamp>_<feature>_rls.sql`:
- `alter table public.<tabla> enable row level security;`
- Policy SELECT para members del org.
- Policy INSERT/UPDATE/DELETE para admins (o members según sensitivity).
- Si es catálogo público, `to anon, authenticated` para SELECT.
- Reusa los helpers existentes: `is_org_member`, `is_org_admin`,
  `has_active_collab_with`, `has_live_promotion_collab_with`.

### Paso 3 · Bridge view en `api` schema
Re-ejecuta `supabase/migrations/20260429120000_api_schema_views.sql`
para regenerar las views. O añade manualmente:
```sql
create view api.<tabla> with (security_invoker = on)
  as select * from public.<tabla>;
grant select on api.<tabla> to anon, authenticated;
grant insert, update, delete on api.<tabla> to authenticated;
```

### Paso 4 · Aplicar migraciones
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/<timestamp>_<feature>_schema.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/<timestamp>_<feature>_rls.sql
```

### Paso 5 · Helper en `src/lib/<feature>Storage.ts`
Crea el archivo con:
- Tipos TS (mapean snake_case DB → camelCase TS).
- `loadXForOrg(orgId)` · lee localStorage scoped `byvaro.<x>:<orgId>`.
- `saveXForOrg(orgId, value)` · write-through (optimistic local + Supabase async).
- Hook `useX(orgId)` · sync API que reacciona a eventos.
- Funciones de mutación (`createX`, `updateX`, `deleteX`).

### Paso 6 · Hidratación
Añade fetch en `src/lib/supabaseHydrate.ts` que pulle la nueva tabla
y rellene su clave localStorage scoped al login.

### Paso 7 · Componentes
Las pantallas usan SOLO `useX()` y los helpers. **Cero `supabase.from`,
cero `localStorage.getItem`** en componentes.

### Paso 8 · Tipos en backend doc
Si la tabla no existía en `docs/backend-dual-role-architecture.md` o
`docs/backend-integration.md`, añade su contrato.

### Paso 9 · Test E2E
Añade un test corto en `scripts/e2e-*.mjs` que verifique:
- Hidratación llena el cache.
- Mutación persiste cross-device (login en otro contexto, ver el dato).

### Paso 10 · Commit + push + deploy
```bash
git add ...
git commit -m "feat(<feature>): schema + RLS + helper + UI"
git push
vercel --prod --yes
```

---

## 4 · Cuándo añades un CAMPO a una tabla existente

### Paso 1 · Migración ALTER
```sql
-- supabase/migrations/<timestamp>_<feature>_<campo>.sql
alter table public.<tabla> add column if not exists <campo> <type>;
notify pgrst, 'reload schema';
```

### Paso 2 · Aplicar
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <archivo>
```

### Paso 3 · Mapper TS
Actualiza el helper que lee/escribe la tabla:
- Añade el campo en el tipo TS.
- Añade el campo en el mapper `dbRowToShape`.
- Añade el campo en el `upsert` del write-through.

### Paso 4 · Hydrator
Si el campo se renderiza tras login, asegura que el SELECT del hydrator
incluye el campo nuevo (suele ser `select("*")` así que no hay que tocar).

### Paso 5 · UI
Componente lee el campo del helper. Cero acceso directo a la BD.

---

## 5 · Patrón canónico de helper · template

```ts
/**
 * src/lib/<feature>Storage.ts · ejemplo de helper canónico.
 * Sigue este patrón al pie de la letra.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const KEY_PREFIX = "byvaro.<feature>";  // p.ej. "byvaro.tags"
const EVENT = "byvaro:<feature>-changed";

function keyFor(orgId: string): string {
  return `${KEY_PREFIX}:${orgId}`;
}

export interface MyEntity {
  id: string;
  organizationId: string;
  /* ... más campos camelCase ... */
}

/* ─── Mappers DB ↔ TS ─── */
type DBRow = {
  id: string;
  organization_id: string;
  // ... snake_case
};

function rowToEntity(r: DBRow): MyEntity {
  return {
    id: r.id,
    organizationId: r.organization_id,
    // ...
  };
}

/* ─── Lectura sync (de cache localStorage) ─── */
export function loadEntitiesForOrg(orgId: string): MyEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(orgId));
    if (!raw) return [];
    return JSON.parse(raw) as MyEntity[];
  } catch { return []; }
}

/* ─── Escritura write-through ─── */
export function saveEntity(orgId: string, e: MyEntity) {
  /* Optimistic local · UI refresca instant. */
  const list = loadEntitiesForOrg(orgId);
  const idx = list.findIndex((x) => x.id === e.id);
  const next = idx >= 0
    ? [...list.slice(0, idx), e, ...list.slice(idx + 1)]
    : [...list, e];
  window.localStorage.setItem(keyFor(orgId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { orgId } }));

  /* Async write-through a Supabase. */
  void (async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("<tabla>").upsert({
      id: e.id,
      organization_id: orgId,
      // ... campos snake_case
    });
    if (error) console.warn("[<feature>] upsert failed:", error.message);
  })();
}

/* ─── Hook reactivo ─── */
export function useEntities(orgId: string): MyEntity[] {
  const [list, setList] = useState<MyEntity[]>(() => loadEntitiesForOrg(orgId));
  useEffect(() => {
    const refresh = () => setList(loadEntitiesForOrg(orgId));
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [orgId]);
  return list;
}

/* ─── Hidratación bulk · llamado por SupabaseHydrator ─── */
export async function hydrateEntitiesFromSupabase() {
  if (!isSupabaseConfigured) return;
  const { data, error } = await supabase.from("<tabla>").select("*");
  if (error || !data) return;
  /* Agrupa por org y escribe cache scoped. */
  const byOrg: Record<string, MyEntity[]> = {};
  for (const r of data as DBRow[]) {
    const e = rowToEntity(r);
    (byOrg[e.organizationId] ??= []).push(e);
  }
  for (const [orgId, list] of Object.entries(byOrg)) {
    try {
      window.localStorage.setItem(keyFor(orgId), JSON.stringify(list));
    } catch { /* QuotaExceeded · skip */ }
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}
```

Y al `SupabaseHydrator` se le añade una llamada a `hydrateEntitiesFromSupabase()`.

---

## 6 · Naming conventions

| Capa | Convención | Ejemplo |
|---|---|---|
| Tabla DB | `snake_case` plural | `organization_members`, `collab_requests` |
| Columna DB | `snake_case` | `from_organization_id`, `created_at` |
| Enum DB | `snake_case` | `request_status`, `member_role` |
| Tipo TS | `PascalCase` | `OrganizationMember`, `CollabRequest` |
| Campo TS | `camelCase` | `fromOrganizationId`, `createdAt` |
| Hook | `useFooBar` | `useEmpresa`, `useOficinas` |
| Helper sync | `loadXFor*` / `saveXFor*` | `loadEmpresaForOrg`, `saveOficinasForOrg` |
| Helper async | `crearX` / `aceptarX` (verbos en español, decisión consciente) | `crearOrgCollabRequest` |
| Storage key | `byvaro.<dominio>.<entidad>:<orgId>` | `byvaro.registros.created.v1`, `byvaro-empresa:ag-1` |
| Event | `byvaro:<dominio>-changed` | `byvaro:empresa-changed`, `byvaro:registros-change` |

**Mappers** · siempre escritos · no asumas que TS y DB tienen el mismo
shape. Aunque hoy lo hagan, mañana puede divergir.

---

## 7 · RLS · plantillas

### Tabla con organización dueña (multi-tenant)
```sql
alter table public.<tabla> enable row level security;

drop policy if exists <tabla>_rw on public.<tabla>;
create policy <tabla>_rw on public.<tabla>
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
```

### Tabla con par de orgs (collab between dos)
```sql
drop policy if exists <tabla>_rw on public.<tabla>;
create policy <tabla>_rw on public.<tabla>
  for all to authenticated
  using (
    public.is_org_member(developer_organization_id)
    or public.is_org_member(agency_organization_id)
  )
  with check (
    public.is_org_admin(developer_organization_id)
    or public.is_org_admin(agency_organization_id)
  );
```

### Tabla catálogo público (lectura abierta)
```sql
drop policy if exists <tabla>_select_public on public.<tabla>;
create policy <tabla>_select_public on public.<tabla>
  for select to anon, authenticated
  using (true);

drop policy if exists <tabla>_write_admin on public.<tabla>;
create policy <tabla>_write_admin on public.<tabla>
  for all to authenticated
  using (public.is_org_admin(<owner_org_column>))
  with check (public.is_org_admin(<owner_org_column>));
```

### Tabla per-user (e.g. favoritos)
```sql
drop policy if exists <tabla>_rw_owner on public.<tabla>;
create policy <tabla>_rw_owner on public.<tabla>
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

---

## 8 · Anti-patterns prohibidos

| Anti-pattern | Por qué prohibido | Qué hacer |
|---|---|---|
| Llamar `supabase.from(...)` desde un componente | Acopla el componente al backend · cuando cambies de backend tienes que tocar todos los componentes | Crear helper en `src/lib/*` |
| Llamar `localStorage.getItem("byvaro-...")` desde un componente | Mismo problema · acopla a la implementación de cache | Helper |
| Importar `agencies` o `promotores` directamente del seed `data/*.ts` para CRUD | El seed es estático · cualquier cambio en BD no se refleja | Usar `useResolvedAgencies()` o helper canónico |
| Crear un nuevo store sin migración SQL | Se queda como mock-only · no persiste cross-device | Migration → helper → hydrator |
| Hacer una tabla sin RLS | Cualquier autenticado lee/escribe TODO · fuga de datos cross-tenant | RLS obligatoria desde día 1 |
| Mutaciones SOLO en localStorage sin write-through | El cambio no persiste cross-device · no es real | Write-through obligatorio |
| Componente con loading state propio para data que ya existe en cache | Duplicación · el cache scoped sirve al primer render | Leer del cache, hidratar en background |
| Mezclar varios dominios en un mismo helper | El día que se reemplaza un endpoint hay que tocar mil cosas | Un helper por dominio (empresa, oficinas, registros, ventas…) |
| Schema de tabla sin `organization_id` cuando es multi-tenant | RLS no puede filtrar · privacy gap | Siempre `organization_id` o equivalente |

---

## 9 · Checklist al cerrar cualquier PR · CRÍTICO

Antes de hacer merge, marca explícitamente:

- [ ] **Migración SQL aplicada** · `psql "$SUPABASE_DB_URL" -f migration.sql` ejecutado y commiteado en `supabase/migrations/`.
- [ ] **RLS** · cada tabla nueva tiene `enable row level security` + al menos una policy.
- [ ] **Bridge view en `api`** · si se añadió tabla nueva, regenerar views (o añadir a mano).
- [ ] **Helper TS** · existe `src/lib/<feature>Storage.ts` con load + save + use.
- [ ] **Mapper DB ↔ TS** · explícito · no asumas mismo shape.
- [ ] **Hidratación** · si el componente espera ver datos al login, el hydrator pulla la tabla y rellena el cache.
- [ ] **Cero `supabase.from(...)` en componentes** · `grep -rE "supabase\.from\(" src/components src/pages` debe devolver SOLO el Login.tsx + SupabaseHydrator (excepciones documentadas).
- [ ] **Cero `localStorage.(get|set)Item` en componentes nuevos** · solo en helpers.
- [ ] **Test E2E** · al menos un script en `scripts/e2e-*.mjs` que verifique persistencia cross-device.
- [ ] **Doc** · `docs/backend-dual-role-architecture.md` o `docs/backend-integration.md` actualizados con la tabla nueva.
- [ ] **Build** · `npx tsc --noEmit && npx vite build` pasa.
- [ ] **Deploy** · `vercel --prod --yes` y `node scripts/e2e-prod.mjs` confirma producción OK.

---

## 10 · Migration workflow · cómo aplicar cambios sin romper nada

1. **Nunca edites una migración ya aplicada.** Crea una nueva.
   Convención de nombre: `<YYYYMMDDHHMMSS>_<dominio>_<accion>.sql`.
2. **Hazlas idempotentes** · `create table if not exists`, `drop policy if exists`, `add column if not exists`. Permite re-ejecutar sin errores.
3. **Aplica con `ON_ERROR_STOP`** · `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f migration.sql`. Si falla, no se queda a medias.
4. **`notify pgrst, 'reload schema';`** al final de migraciones que añaden tablas/columnas · PostgREST recarga su cache sin reiniciar.
5. **Bridge views auto** · ejecuta `supabase/migrations/20260429120000_api_schema_views.sql` después de cada migración con tabla nueva · regenera views.
6. **Backup mental antes de DROP** · si una migración elimina datos, copia primero a una tabla `_backup`. Supabase tiene PITR pero mejor prevenir.
7. **Test en local antes de prod** · si tienes Supabase CLI con local stack, prueba ahí primero.

---

## 11 · Estado actual · helpers existentes

Estos helpers ya existen y son la fuente de verdad para sus dominios.
Cualquier feature nueva debe AÑADIR al helper correspondiente, no
crear uno paralelo.

| Helper | Dominio | Tabla(s) backend |
|---|---|---|
| `src/lib/empresa.ts` | Identidad de la org + oficinas | `organizations`, `organization_profiles`, `offices` |
| `src/lib/orgCollabRequests.ts` | Solicitudes org-level | `collab_requests` (kind=org_request) |
| `src/lib/solicitudesColaboracion.ts` | Solicitudes per-promo | `collab_requests` (kind=promotion_request) |
| `src/lib/invitaciones.ts` | Invitaciones promotor → agencia | `collab_requests` (kind=invitation) |
| `src/lib/collabRequests.ts` | Adapter unificado de los 3 anteriores | (no escribe · solo lee y unifica) |
| `src/lib/registrosStorage.ts` | Registros (leads cualificados) | `registros`, `registro_events` |
| `src/lib/calendarStorage.ts` | Eventos de calendario | `calendar_events`, `visit_evaluations` |
| `src/lib/notifications.ts` | Notificaciones in-app | `notifications` |
| `src/lib/favoriteAgencies.ts` | Favoritos del usuario | `user_favorites` |
| `src/lib/permissions.ts` | Permission keys + grants | (futuro: `permission_grants`) |
| `src/lib/agencyMetrics.ts` | Métricas derivadas | (computed) |
| `src/lib/promotionsByOwner.ts` | Promociones por owner | `promotions` |
| `src/lib/useResolvedAgencies.ts` | Lista agencies con cache merge | `organizations` |
| `src/lib/supabaseClient.ts` | Singleton del cliente Supabase | (todas) |
| `src/lib/supabaseHydrate.ts` | Hidratación bulk al login | (todas las que necesitan cache) |

### Helpers PENDIENTES de migrar a backend (deuda técnica)

Estos archivos siguen 100% en localStorage. Cuando se les ponga mano,
se migran al patrón canónico (schema + RLS + write-through).

- `src/components/contacts/contactDocumentsStorage.ts`
- `src/components/contacts/relationTypesStorage.ts`
- `src/components/contacts/visitEvaluationsStorage.ts`
- `src/components/contacts/tagsStorage.ts`
- `src/components/contacts/importedStorage.ts`
- `src/components/contacts/contactLanguagesStorage.ts`
- `src/components/contacts/contactEditsStorage.ts`
- `src/components/leads/leadAssigneeStorage.ts`
- `src/components/contacts/whatsappMessagesMock.ts`
- (más que aparezcan vía `grep -rln "localStorage" src/components`)

Sales mutations en `/ventas` también pendientes (necesita un
`salesStorage.ts` con write-through · seed estático en `data/sales.ts`
sigue sirviendo lecturas).

---

## 12 · Cómo el día que cambiemos de Supabase a backend custom

Cuando ese día llegue (improbable a corto plazo, pero el doc lo cubre):

1. Cada helper de `src/lib/*` cambia su implementación interna · de
   `supabase.from(...)` a `fetch("/api/...")`.
2. **Componentes no se tocan**. Hooks no se tocan. Pages no se tocan.
3. Las claves localStorage scoped pueden mantenerse como cache, o
   borrarse si SWR/TanStack Query pasa a gestionar el cache.
4. RLS de Supabase se traduce a guards server-side en el nuevo backend
   · misma lógica, distinto runtime.
5. El bridge `api.*` views desaparece · no aplica fuera de Supabase.

Estimación honesta del refactor: **1-2 semanas**. La gran ventaja del
patrón actual: el día del cambio, sabes EXACTAMENTE qué tocar (los
~15 helpers) y qué no (cientos de componentes).

---

## 13 · Resumen para AI / dev nuevo

> "Si vas a tocar datos del producto:
> 1. Crea o amplía un helper en `src/lib/*`.
> 2. El helper habla con Supabase + localStorage.
> 3. Componentes hablan SOLO con el helper.
> 4. Toda tabla nueva: migración SQL + RLS + bridge view + helper +
>    hidratación + test E2E + doc.
> 5. Si te pillas escribiendo `supabase.from(...)` o
>    `localStorage.getItem(...)` en un componente, **párate** y muévelo
>    al helper.
>
> Esta regla protege el día que el backend cambie · solo se tocan los
> ~15 archivos de `src/lib/*`, no los cientos de componentes."
