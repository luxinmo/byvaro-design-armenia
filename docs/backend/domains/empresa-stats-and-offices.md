# Empresa · KPIs derivados + oficinas single-source

> Sustituye los campos manuales del shape `Empresa` por derivaciones
> en runtime. Unifica las tres fuentes paralelas de oficinas que
> tenía el frontend en una sola tabla.

## Parte 1 · KPIs del hero · derivados, no manuales

### Antes

El tipo `Empresa` (`src/lib/empresa.ts`) tenía 9 campos string
editables a mano:

```ts
aniosOperando: string;
oficinasCount: string;
agentesCount: string;
promocionesCount: string;
unidadesVendidas: string;
agenciasColaboradoras: string;
ventasAnuales: string;
ingresosAnuales: string;
portfolio: string;
```

El admin debía teclearlos en `/ajustes/empresa/datos`. Si tenía 5
promociones reales y 47 agencias colaborando, los campos podían
mostrar "0" indefinidamente porque nadie actualizaba a mano.

### Ahora

**Eliminados** los 9 campos del tipo. Nuevo hook `useEmpresaStats()`
en `src/lib/empresaStats.ts` los computa en runtime desde los datasets
reales:

```ts
useEmpresaStats(empresa, oficinasCount, tenantId?): EmpresaStats
```

| KPI | Fuente | Filtro |
|---|---|---|
| `aniosOperando` | `empresa.fundadaEn` (string "YYYY") | `currentYear - parseInt(fundadaEn)` |
| `promociones` | `developerOnlyPromotions` | `status === "active"` |
| `unidadesEnVenta` | `unitsByPromotion[promo.id]` cruzado con `activePromos` | `unit.status === "available"` |
| `importeEnVenta` | suma de `unit.price` de unidades disponibles | id |
| `unidadesVendidas` | `sales` | `estado === "escriturada"` |
| `agencias` | `agencies` | `status === "active" && estadoColaboracion === "activa"` |
| `oficinas` | `useOficinas().length` (workspace prop) | id |
| `agentes` | `TEAM_MEMBERS` | `status === "active"` |
| `idiomas` | unión de `member.languages` para members activos | sortLanguagesByImportance |

**Visitor mode** (cuando se mira la ficha pública de OTRO tenant
desde `/colaboradores/:id` o `/promotor/:id`): se pasa `tenantId` al
hook y los conteos se sacan del seed/API del tenant visitado en
lugar del workspace propio.

### Hero strip · diferencia owner vs visitor

`HeroStatsStrip` recibe prop `mode: "owner" | "visitor"`:

| Tile | Owner (developer en su /empresa) | Visitor (agencia desde ficha pública) |
|---|---|---|
| 1 | Años activos | Años activos |
| 2 | Promociones | Oficinas |
| 3 | Unidades en venta | Equipo |
| 4 | Importe en venta | Unidades vendidas |
| 5 | Colaboradores | — (visitor solo tiene 4) |

### Endpoint backend

```
GET /api/me/empresa/stats
    200 → EmpresaStats

GET /api/empresas/:tenantId/stats
    200 → EmpresaStats (visitor mode)
```

El backend debe agregar via SQL views indexadas, NO calcular en cliente:

```sql
CREATE VIEW empresa_stats AS
  SELECT
    o.id AS organization_id,
    EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM o.founded_at) AS anios_operando,
    (SELECT COUNT(*) FROM promotions WHERE org_id = o.id AND status = 'active') AS promociones,
    -- … etc.
  FROM organizations o;
```

### Permisos

Owner mode: todos los miembros del workspace ven todos los KPIs (no es
sensible — son datos públicos del propio workspace).

Visitor mode: misma respuesta para todos · es la información del
perfil público que cualquier visitante puede ver.

---

## Parte 2 · Oficinas · single source of truth

### Antes (3 fuentes paralelas)

1. `src/lib/empresa.ts::useOficinas()` → `byvaro-oficinas` localStorage
   con shape `Oficina[]`.
2. `Promotion.puntosDeVenta?: PuntoDeVenta[]` → array inline en cada
   promo del seed con datos duplicados.
3. `src/data/companyOffices.ts` → array exportado con 6 oficinas mock
   usado por `PickSalesOfficesDialog`.

Las 3 fuentes tenían ids distintos (`pv-1`, `co-1`, etc.) y datos
ligeramente distintos (emails @mycompany.com vs @luxinmo.com). Una
oficina podía aparecer en una promo pero no en `/empresa` →
"oficina fantasma". Inadmisible.

### Ahora (1 fuente)

**Solo `byvaro-oficinas`** (localStorage). Lo demás se borra.

- `companyOffices.ts` → **borrado**.
- `Promotion.puntosDeVenta` (datos inline) → **eliminado**.
- Nuevo campo `puntosDeVentaIds: string[]` en `DevPromotion` que
  referencia oficinas del workspace por id. La promoción NO duplica
  los datos de la oficina · los resuelve en runtime.

### Seed inicial

`src/lib/empresa.ts::OFICINAS_SEED` define 6 oficinas (`of-1` a `of-6`)
que cubren todas las puntos de venta referenciados en seed promos.
Auto-seedea si `byvaro-oficinas` está vacío o no existe (la condición
"empty array" también re-seedea para evitar el caso de oficina
fantasma cuando un user vacía manualmente).

### Resolución en `PromocionDetalle`

```ts
const { oficinas: workspaceOficinas } = useOficinas();
const salesOffices = workspaceOficinas
  .filter((o) => salesOfficeIds.includes(o.id))
  .map(toSalesOfficeShape);
```

El picker `PickSalesOfficesDialog` ahora recibe `pool` desde
`workspaceOficinas` (no de `companyOffices.ts`).

### Regla invariante

> Toda oficina que aparezca en una promoción TIENE que existir en
> `byvaro-oficinas`. Si no existe → bug. Si la oficina se borra del
> workspace, las promociones que la referencian deben:
> a) Quitarla automáticamente de `puntosDeVentaIds`, o
> b) Marcar la promo como "incompleta" hasta que se reasigne.

Backend equivalent: foreign key `promotion_sales_offices.office_id →
offices.id ON DELETE SET NULL` + check de integridad en
`POST /api/promociones/:id/publish`.

### Endpoints

```
GET    /api/me/oficinas               → Oficina[]
POST   /api/me/oficinas               → crea
PATCH  /api/me/oficinas/:id           → edita
DELETE /api/me/oficinas/:id           → borra (cascadas a SET NULL)

GET    /api/promociones/:id/sales-offices  → Oficina[] (resueltas via id)
PATCH  /api/promociones/:id/sales-offices
       body: { officeIds: string[] }  → reemplaza la lista
```

### Migración a backend · checklist

1. Tabla `offices` con shape de `Oficina` (id, nombre, dirección,
   ciudad, provincia, telefono, email, etc.).
2. Tabla pivote `promotion_sales_offices(promotion_id, office_id)` M:N.
3. Mover `OFICINAS_SEED` a un migration SQL del seed inicial del
   workspace al crearlo.
4. `useOficinas()` hook localStorage se reemplaza por
   `useQuery(["me/oficinas"])`. La interfaz pública del hook
   (`oficinas`, `addOficina`, `updateOficina`, `deleteOficina`,
   `setPrincipal`, `oficinaPrincipal`) se mantiene para minimizar
   refactor en componentes.
5. Borrar el auto-seed cuando exista backend.

### TODO(backend) emitidos

- `src/lib/empresa.ts::loadOficinas()` · sustituir auto-seed por fetch.
- `src/pages/PromocionDetalle.tsx::initialized` · `setSalesOfficeIds`
  desde `(p as DevPromotion).puntosDeVentaIds` se reemplaza por fetch
  de `/api/promociones/:id/sales-offices`.
