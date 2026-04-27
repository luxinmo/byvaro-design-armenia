# Vista del promotor desde la agencia

> Mirror invertido de `/colaboradores/:id` (que el promotor usa para
> ver agencias). Ahora la AGENCIA accede a un perfil del promotor
> con dos pantallas: ficha pública y panel operativo. Sustituye al
> texto plano "Desarrollado por X" que la agencia veía antes.

## Motivación

El producto es **dual-role** (CLAUDE.md §"REGLA DE ORO · Vista de
Agencia colaboradora"). El promotor tiene `/colaboradores/:id` para
ver agencias. La agencia necesita la simétrica para ver promotores —
hasta ahora solo tenía nombre + texto plano. Estas pantallas
completan la simetría.

## Rutas

```
/promotor/:id           → ficha pública (sin colaboración activa)
/promotor/:id/panel     → panel operativo (colaboración activa)
```

`:id` es un identificador del promotor. En single-tenant mock se usa
el sentinel **`developer-default`**. En producción será el
`organization.id` real. **Importante:** el frontend ya soporta `:id`
parametrizado · el sentinel es solo un placeholder de la maqueta.

## Helper de navegación

`src/lib/developerNavigation.ts` exporta:

```ts
hasActiveDeveloperCollab(user): boolean
developerHref(user, opts?): string
```

`developerHref()` decide a cuál de las dos rutas mandar según haya
colaboración activa. **Nunca hardcodees `/promotor/:id` o
`/promotor/:id/panel` en un click handler** — usa siempre el helper.
Mirror exacto de `agencyHref()` (`src/lib/agencyNavigation.ts`).

## Resolución de datos

`useEmpresa(tenantId)` extendido para reconocer el prefijo
**`developer-`** y resolver vía `loadEmpresa()` (workspace real)
en lugar de `agencies.find()`:

```ts
useEmpresa(tenantId)
  · tenantId === undefined        → loadEmpresa()        // own workspace (developer ve su empresa)
  · tenantId.startsWith("developer-")  → loadEmpresa()  // visitor mirando promotor
  · else                          → agencies.find(id)    // visitor mirando agencia
```

Backend equivalent: cuando se monten endpoints, `/api/empresas/:id/public`
recibirá un `organization.id` y devolverá los datos públicos del
workspace. La distinción frontend mock vs backend es transparente.

## Ficha pública (`/promotor/:id`)

Reusa **`Empresa.tsx`** en modo visitor. Misma estructura que
`/empresa` viewMode=preview. Se accede cuando la agencia NO tiene
colaboración activa con el promotor.

**Invariante visual** · `/promotor/:id` (agencia visitor) y
`/empresa` viewMode=preview (promotor previewing como usuario)
muestran **exactamente los mismos KPIs y secciones**. Para
mantenerlo, separamos los conceptos:

- `isVisitor` (boolean) → afecta solo a (a) eyebrow del header,
  (b) toggle de preview, (c) modales de edición y secciones
  internas que el visitor NO debe ver (Agencias colaboradoras,
  banner perfil incompleto). NO afecta a los KPIs.
- `entityType: "developer" | "agency"` → decide los KPIs del
  `HeroStatsStrip`. Promotor → portfolio (Años · Promociones ·
  Unidades en venta · Importe en venta · Colaboradores). Agencia
  → operativos (Años · Oficinas · Equipo · Unidades vendidas).
  Lo deriva `Empresa.tsx` desde el tenantId con esta heurística:
    · sin tenantId · usuario agency → "agency" (su propia ficha)
    · sin tenantId · usuario developer → "developer" (su propia ficha)
    · tenantId con prefijo "developer-" → "developer"
    · cualquier otro tenantId → "agency"

**Stats** · `useEmpresaStats(empresa, oficinasCount, tenantId)`:
- Si `tenantId` empieza con `developer-` o no hay tenantId → branch
  workspace (cuenta promociones, unidades, sales, agencies del seed
  global). Cuando exista backend, ambos llaman a
  `GET /api/promotor/:id/stats` (que en single-tenant mock devuelve
  los datos del único developer).
- Si `tenantId` es un id de agencia → branch agency-visitor (lee
  del seed `agencies.find(...)`, devuelve oficinas/teamSize/
  ventasCerradas/idiomasAtencion).

## Panel operativo (`/promotor/:id/panel`)

Mirror 1:1 de `ColaboracionPanel` (`/colaboradores/:id/panel`):
- Mismas 9 tabs: Resumen, Datos, Visitas, Registros, Ventas,
  Documentación, Pagos, Facturas, Historial.
- Mismo header (logo + nombre + verified + chips + botones de acción).
- Reusa los componentes existentes pasando la agencia logueada.

**Diferencias vs `/colaboradores/:id/panel`:**

1. **Header** muestra los datos del PROMOTOR (no de la agencia).
   Botón "Compartir promoción" se oculta — la agencia no comparte.

2. **Tab Documentación** se renderiza con prop `readOnly=true`:
   - `DocumentacionTab.tsx` recibe `readOnly?: boolean`. Cuando true,
     fuerza `canManageContracts` y `canManageDocs` a false.
   - Botones "Nuevo contrato" y "Solicitar documento" desaparecen.
   - Empty state cambia copy: "Solo el promotor o comercializador
     puede subir el contrato. Cuando lo envíe a firmar, recibirás un
     email de Firmafy con el link."
   - Backend equivalente: el endpoint de upload (`POST /api/contracts`)
     debe rechazar con 403 cuando el JWT del caller es de la agencia.
     La agencia firma vía link de Firmafy que llega por email · NUNCA
     sube contratos.

3. **Tab Resumen** se renderiza con `readOnly=true`:
   - Banner "X promociones sin contrato firmado" pasa de botón
     `<button onClick={openScopePicker}>` con CTA "Subir contrato ahora"
     a un aviso pasivo: "Solo el promotor o comercializador puede subir
     el contrato. Cuando lo envíe a firmar, recibirás un email de Firmafy."
   - Bloque "Aún sin compartir" (developer mode) se renombra a
     "Promociones que aún no colaboras" con CTA "Solicitar colaboración"
     (ver `docs/backend/domains/collaboration-requests.md`).
   - Métricas de cada card promo cambian:
     - Modo developer: Visitas · Ventas · Conversión.
     - Modo agency: Disponibles · Precio · Entrega · Obra.

4. **Tab Datos** se sustituye por `DeveloperDatosTab` (nuevo
   componente) que muestra los datos del PROMOTOR (logo, razón social,
   CIF, sitio web, dirección fiscal) en vez de los de la agencia.
   Reusa los primitives `Section`, `DataGrid`, `DataField` exportados
   desde `DatosTab.tsx`.

## Permisos

A diferencia del lado promotor (`/colaboradores/:id/panel` requiere
`collaboration.panel.view`), el lado agencia NO tiene gate global:
**cualquier miembro de la agencia (admin o member) puede ver el panel
del promotor**. La razón: es información de la propia empresa (los
registros, visitas, ventas con el promotor son trabajo del día a día
del agente), no datos sensibles cross-tenant.

Si en el futuro se quiere restringir tabs específicas (Pagos, Facturas)
a admin de la agencia, se añade una key específica tipo
`agency.payments.view`. Hoy no aplica.

## Endpoints esperados

```
GET /api/promotor/:id/profile
    → Empresa shape (público) · agencia sin colaboración usa esto.

GET /api/promotor/:id/panel
    → datos consolidados para el panel: oficinas, comerciales,
      promociones compartidas, contratos firmados, etc.
    requiere: la agencia logueada DEBE tener relación activa con
      el promotor (sea via promotionsCollaborating o invitación).

GET /api/promotor/:id/promotions/shared
    → promociones donde la agencia colabora.

GET /api/promotor/:id/promotions/available
    → promociones publicadas donde aún no colabora · usadas para
      "Promociones que aún no colaboras" + CTA Solicitar.
    excluye: promos donde ya hay invitación pendiente o solicitud viva.
```

## Cómo se llega

- **Click en el nombre del promotor** desde `/promociones/:id` (header
  · icono Building2). Solo es link cuando `viewAsCollaborator=true`
  (la agencia mira). El destino lo decide `developerHref()`.
- **`PromotionHero.tsx`** tiene la misma lógica para cuando se use ese
  hero (`getPromoterDisplayName(p)` envuelto en `<Link>` si
  `isAgencyUser`).

## Migración a backend · checklist

- `useEmpresa()` con prefijo `developer-` se reemplaza por
  `useQuery(["promotor", id], () => fetchPromotorProfile(id))`.
- El sentinel `DEFAULT_DEVELOPER_ID` desaparece — usa el id real del
  promotor desde la promoción.
- `loadEmpresa()` localStorage solo aplica al own workspace · cuando
  el caller es agencia visitando promotor, hace fetch real.
- Backend valida que el `:id` de la URL corresponde a un promotor con
  el que la agencia tiene relación (collaboration o invitación).
