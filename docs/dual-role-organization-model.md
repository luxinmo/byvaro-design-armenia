# Modelo dual-role · Promotor · Agencia · Miembros

> **Documento único y definitivo · 2026-04-29.** Cubre la lógica end-to-end
> entre los dos roles principales del producto (developer/promotor y agency/
> inmobiliaria) y sus miembros (admin, member). Preparado para que un
> humano o un AI lo lea y detecte incoherencias con el código actual o
> entre reglas. Si encuentras algo que contradiga este doc, abre Open
> Question en `docs/open-questions.md`.

Lectura previa recomendada:
- `CLAUDE.md` · reglas de oro inline.
- `docs/dual-role-model.md` · doc histórico previo (este lo amplía y
  consolida).
- `docs/backend-integration.md` · contrato UI ↔ API.

---

## 0. Personas y cuentas

| accountType | role | Ejemplo (mock) | Workspace |
|---|---|---|---|
| `developer` | `admin` | arman@byvaro.com | Luxinmo (`developer-default`) |
| `developer` | `member` | laura@byvaro.com | Luxinmo |
| `agency` | `admin` | laura@primeproperties.com | Prime Properties (`ag-1`) |
| `agency` | `member` | tom@primeproperties.com | Prime Properties (`ag-1`) |
| `agency` | `admin` | erik@nordichomefinders.com | Nordic Home Finders (`ag-2`) |
| `agency` | `member` | anna@nordichomefinders.com | Nordic Home Finders (`ag-2`) |

**Resolución del workspace** del usuario actual:
```ts
function currentOrgIdentity(user) {
  return user.accountType === "developer"
    ? { orgId: "developer-default", orgKind: "developer" }
    : { orgId: user.agencyId,       orgKind: "agency" };
}
```
Helper canónico en `src/lib/orgCollabRequests.ts`.

**Account switching** · `accountType` y `agencyId` viven en
`sessionStorage` (per-pestaña) → cada pestaña puede ser un usuario distinto.
`byvaro-empresa` vive en `localStorage` (compartido) → datos del promotor
visibles entre pestañas/cuentas en el mismo navegador. Doc en
`/ajustes/zona-critica/datos-prueba`.

---

## 1. Categorías de empresa (Inmobiliaria · Promotor · Comercializador)

Una empresa puede tener 0..N categorías derivadas:

| Categoría | Significado | Cómo se asigna |
|---|---|---|
| **Inmobiliaria** | Es una agencia | Automático cuando `org.kind === "agency"`. |
| **Promotor** | Construye/desarrolla y es dueño de la obra | ≥1 promoción activa con `ownerRole = "promotor"`. |
| **Comercializador** | Vende en exclusiva por encargo de un tercero | ≥1 promoción activa con `ownerRole = "comercializador"`. |

**Pack de promotor/comercializador** · una agencia puede activar este
pack en `/ajustes/empresa/suscripcion` para ganar capacidad de crear
promociones. Sólo da CAPACIDAD · la categoría aparece cuando hay actividad
real (≥1 promo activa con ownerRole). Storage:
`localStorage["byvaro.workspace.developerPack.v1:<wsKey>"]`.

**Helpers**:
- `src/lib/empresaCategories.ts` · `getEmpresaCategories({accountType})` y
  `useEmpresaCategories({accountType})`.
- Tipo `EmpresaCategory = "inmobiliaria" | "promotor" | "comercializador"`.
- `EMPRESA_CATEGORY_LABELS` para etiquetas en español.

**Render**:
- En el hero (`/empresa`, `/promotor/:id`, `/colaboradores/:id`): texto
  inline en color `text-muted-foreground`, separado por `·`.
- En la card de listado (`AgencyGridCard`): texto inline neutro entre
  nombre y dirección, sin pill ni color.
- Junto a la categoría puede aparecer la licencia inmobiliaria principal
  (RAICV-V-2345, AICAT, etc.) si la empresa la tiene declarada.

**Promotor vs Comercializador** · etiqueta dinámica per-promoción a
través de helpers en `src/lib/promotionRole.ts`. La copy "Promotor" vs
"Comercializador" se resuelve en cada promoción según `Promotion.ownerRole`.

---

## 2. Aislamiento multi-tenant

### 2.1 Datos del workspace · resolución per-tenant

| Dato | Storage / Source | Hook canónico per-tenant |
|---|---|---|
| Empresa (nombre, logo, CIF…) | `byvaro-empresa` localStorage + `LUXINMO_PROFILE` fallback + `agencies.ts` seed + `promotores.ts` seed | `useEmpresa(tenantId)` |
| Oficinas | `byvaro-oficinas` localStorage + per-seed `offices` array | `useOficinas(tenantId)` |
| Equipo | `byvaro.organization.members.v4:<wsKey>` localStorage + `TEAM_MEMBERS` seed + `agencyTeamSeeds` | `useWorkspaceMembers(workspaceKey)` |
| Promociones | `promotions.ts` + `developerOnlyPromotions.ts` + `EXTERNAL_PROMOTOR_PORTFOLIO` | `getPromotionsByOwner(orgId)` |
| Stats (KPIs hero) | derivado | `useEmpresaStats(empresa, oficinasCount, tenantId)` |
| Categorías | derivado | `useEmpresaCategories({ accountType })` |

**Regla** · un componente que renderiza data per-tenant DEBE pasar por
estos helpers · jamás leer storage o seeds directamente. Sin esto hay
fugas (Luxinmo's offices/promotions apareciendo en AEDAS, etc.).

### 2.2 Aislamiento de promociones · `ownerOrganizationId`

Cada `Promotion` tiene `ownerOrganizationId` (FK a `organizations.id`).
TODA query DEBE filtrar por este campo.

```ts
// Mock
"developer-default" → Luxinmo (promotions.ts + developerOnlyPromotions.ts)
"prom-1", "prom-2"… → externos (EXTERNAL_PROMOTOR_PORTFOLIO)
```

Helper canónico: `src/lib/promotionsByOwner.ts::getPromotionsByOwner(orgId)`.

### 2.3 Self-exclusion en listados

Una empresa NUNCA aparece a sí misma en su listado.

```ts
// /colaboradores
agencies.filter((a) => !(user.accountType === "agency" && a.id === user.agencyId))
```

---

## 3. Relaciones entre organizaciones

### 3.1 Tres conceptos · NO son lo mismo

| Concepto | Storage | Doc | Cuándo aplica |
|---|---|---|---|
| **Invitación** | `byvaro-invitaciones` localStorage · `useInvitaciones()` | `src/lib/invitaciones.ts` | El promotor envía invitación formal a una agencia (con/sin promoción asociada). Token + email + Firmafy + aceptación. |
| **Solicitud per-promoción** | `byvaro-solicitudes-colaboracion` localStorage · `useAllSolicitudes()` | `src/lib/solicitudesColaboracion.ts` | Una agencia solicita colaborar en UNA promoción concreta de un promotor. |
| **Solicitud org-level** | `byvaro.org-collab-requests.v1` localStorage · `useOrgCollabRequests()` | `src/lib/orgCollabRequests.ts` | Cualquier org pide colaborar con otra org (peer-to-peer · agency↔agency, agency↔developer, developer↔developer). |

### 3.2 Estados de colaboración (campo `Agency.estadoColaboracion`)

- `activa` · colaboración firmada y operativa.
- `pausada` · colaboración previamente activa, ahora detenida (datos históricos preservados).
- `contrato-pendiente` · enviada solicitud/invitación, esperando contrato.
- (sin estado) · sin vínculo.

### 3.3 Flujo · enviar solicitud org-level

```
visitor (no colab activa)
  → click "Enviar solicitud" en hero de /colaboradores/:id o /promotor/:id
  → validación: hasMinimumIdentityData(myEmpresa)
      ✗ falla → toast "tu admin debe rellenar: razón social, CIF, dirección, contacto"
      ✓ pasa  → crearOrgCollabRequest({fromOrgId, toOrgId, ...})
  → marker en card del receptor: "Colaboración solicitada DD/MM/YYYY" (warning ámbar)
  → marker en card del emisor:   "Solicitado DD/MM/YYYY" (primary azul)
  → receptor abre banner "Solicitudes recibidas · esperando tu respuesta" → drawer → Aceptar/Rechazar
  → al aceptar: ambos se ven como Colaborador en sus listados · TODO: actualizar `agencies.estadoColaboracion`
```

### 3.4 Datos mínimos para enviar solicitud (regla Byvaro)

- Razón social (no vacío).
- CIF/NIF/VAT (no vacío).
- Dirección fiscal (`direccionFiscalCompleta` o `ciudad+país`).
- ≥1 contacto (email o teléfono).

Sin esto NO se puede enviar. El admin debe rellenar en `/empresa`.
Helper: `hasMinimumIdentityData(empresa)` en `orgCollabRequests.ts`.

**Excepción** · invitaciones de promotores prevalecen sobre esta regla ·
una agencia puede aceptar una invitación de promotor aunque su workspace
esté vacío.

---

## 4. Vistas y rutas

### 4.1 Sidebar · grupo "RED"

Mismo sidebar para todos los roles (developer + agency, admin + member),
con dos diferencias:

| Entrada | Ruta | Visible para |
|---|---|---|
| Promotores & comercializadores | `/promotores` | Todos |
| **Inmobiliarias** | `/colaboradores` | Todos (renombrada del antiguo "Colaboradores") |
| Inmobiliarias test | `/colaboradores-test` | Solo developer (PromotorOnly) |
| Contratos | `/contratos` | Solo developer |
| Contactos | `/contactos` | Todos |

### 4.2 `/promotores` · listado de promotores/comercializadores

- **Developer view** (`PromotoresDeveloperView`): lista promotores externos de `promotores` seed (AEDAS, Neinor, Habitat, Metrovacesa) con quien Luxinmo comercializa.
- **Agency view** (`PromotoresAgencyView`): lista `[Luxinmo synthetic, ...promotores]` · agencia ve TODOS los promotores del sistema, no solo los que ya tiene como partners.

Tabs: Todos · Colaboradores · No colaboradores. (Sin "Pendientes" porque promotores externos no tienen marketplace queue.)

### 4.3 `/colaboradores` (Inmobiliarias) · listado unificado

**Misma vista para todos los roles**. Render por `ColaboradoresDeveloperView` (existed before, ahora unificado).

Tabs: Todos · Colaboradores · Pendientes · No colaboradores.
- "Todos" · todas las del sistema (`isPendiente` ya NO se filtra · pendientes-de-alta aparecen con marker "Colaboración solicitada").
- "Colaboradores" · `estadoColaboracion === "activa"`.
- "Pendientes" · `solicitudPendiente || isNewRequest`.
- "No colaboradores" · `pausada`.

Banners arriba (priorizados):
1. **Solicitudes recibidas (org-level)** · animado · click → drawer aceptar/rechazar.
2. **Solicitudes por promoción pendientes** (developer-only) · animado.

Acciones del header:
- **Enviar** · abre `SendEmailDialog` con `defaultAudience="collaborator"` ·
  paso "collab-mode" para elegir Todos / Favoritos / Elegir / Invitar.
- **Invitar agencia**.

ViewToggle · Lista (default) y Mapa (`ColaboradoresMap`).

### 4.4 `/promotor/:id` y `/colaboradores/:id` · ficha pública

Ambas reusan `Empresa.tsx` con `tenantId` poblado:
- `/promotor/developer-default` · ficha pública del developer Luxinmo.
- `/promotor/prom-1` · ficha de promotor externo (AEDAS).
- `/colaboradores/ag-1` · ficha de agencia.

Estructura idéntica · cambia `entityType: "developer" | "agency"` que
condiciona los KPIs del HeroStatsStrip y las categorías.

**Acciones del lado developer** (`/colaboradores/:id`):
- Footer sticky con Aprobar / Pausar / Eliminar / Compartir · solo si
  `currentUser.accountType !== "agency"`.

**Mirror promotor desde agencia** (`/promotor/:id/panel`):
- Mirror exacto de `ColaboracionPanel` con misma estructura · cambia
  el header (datos del promotor) y la tab Datos (`DeveloperDatosTab`).
- Documentación tab `readOnly=true` · agencia NO sube contratos
  (firma vía Firmafy email + SMS OTP).

### 4.5 Visibilidad de datos sensibles ("Detalles" tab)

Sección sensible: razón social, CIF, dirección fiscal, contacto, horario.

```ts
canViewSensitiveDetails =
  !isVisitor                                    // own ficha
  || (hasActiveCollab && currentUser.role === "admin")  // visitor admin colaborador
```

Si `false` → componente `<RestrictedDetailsCard>` con copy:
"Sección restringida · datos fiscales y de contacto solo visibles para
colaboradores activos con rol admin".

---

## 5. Card de empresa · `AgencyGridCard`

### 5.1 Estructura visual

```
┌──────────────────────────────────────────────────┐
│ [☐]                                          [⭐]│  ← checkbox · estrella
│ [LOGO 64px]  Nombre [tick] [★ rating]           │  ← header
│              Inmobiliaria · Promotor             │  ← categorías inline
│              🇸🇪 Stockholm, Sweden               │  ← bandera + ubicación
│                                                   │
│ 🤝 Colaborador 2/4 · 12 agentes · 2 oficinas     │  ← marker · meta
│   o, si hay aviso:                                │
│ 🤝 Colaborador 2/4 · ⚠ Sin contrato · 1 incid.   │
│                                                   │
│ ┌──────┬─────────┬─────────┬──────┬─────────┐   │  ← métricas (4 si Promotor, 3 si no)
│ │PROMOS│ CARTERA │  COLAB. │ VOL. │         │   │
│ │  9   │    7    │    2    │ €6.6M│         │   │
│ └──────┴─────────┴─────────┴──────┴─────────┘   │
└──────────────────────────────────────────────────┘
```

### 5.2 Marker de relación (prioridad)

1. **`inboundRequestAt`** → `📧 Colaboración solicitada DD/MM/YYYY` (warning · pelota en TU tejado).
2. **`requestedAt`** → `✈️ Solicitado DD/MM/YYYY` (primary · pelota en EL OTRO tejado).
3. **`colabActive`** → `🤝 Colaborador X/Y` (success · X = promociones colaboradas, Y = totalPromotionsAvailable).
4. Else → ningún marker.

### 5.3 Aviso (warning) consolidado

Si hay aviso (`Sin contrato`, `Vence en Xd`, `Pausada`, `Contrato pendiente`,
incidencias, `Pendiente`), agentes/oficinas se sustituyen por:

```
⚠ Sin contrato · 1 incidencia
```

El detalle completo vive dentro de la ficha (`/colaboradores/:id`).

### 5.4 Selección + favoritos (regla Byvaro)

Solo se puede seleccionar / marcar favorito a empresas con
`canInteract === true` (definición: `status === "active" && estadoColaboracion === "activa"`).

Si `canInteract === false` · checkbox y estrella visibles pero deshabilitados.
Click → toast informativo:
> "Solo puedes seleccionar empresas con las que ya colaboras · envía una
> invitación y, cuando la acepten, podrás seleccionarlas y enviarles emails."

### 5.5 Métricas (regla Byvaro)

| Métrica | Definición |
|---|---|
| **Cartera** | Suma de `availableUnits` en colaboraciones (vía `getAgencyPortfolioMetrics`). |
| **Colab.** | Nº de promociones activas donde colabora. |
| **Volumen** | Suma `availableUnits × precioMedio` de la cartera (en €). |
| **Promos** | (solo si `isPromotor`) Promociones propias activas. |

---

## 6. Modal `SendEmailDialog`

Cuando se invoca desde `/colaboradores`:
- `defaultAudience="collaborator"` · respetada incluso para agency users
  (override solo aplica si no se pasa o se pasa "client").
- Sin `preselectedAgencyIds` → step inicial **`collab-mode`**:
  "¿A qué colaboradores quieres enviar?" con 3 opciones:
  - **Todos los colaboradores** (`eligibleAgencies.length`)
  - **Colaboradores favoritos** (`eligibleFavoritesCount`)
  - **Elegir entre colaboradores**
  - link: ¿Quieres invitar a un nuevo colaborador?
- Con `preselectedAgencyIds` (de la barra flotante de selección) → salta
  directo a step `template`.

`eligibleAgencies` = colaboradoras activas (status=active + estadoColaboracion=activa)
excluyendo la propia agencia. Counter coherente con el listado.

---

## 7. Banners y avisos visuales

### 7.1 Banner "Solicitudes recibidas" (org-level)

- Filtrado por `to_organization_id === currentOrgId` y `status === "pendiente"`.
- Estilo: rounded-full warning bg + border, animación
  `animate-attention-pulse-loop` (halo expandiendo cada 2.4s, infinito) +
  dot interno con `animate-ping-slow`.
- Click → `OrgCollabRequestsDrawer` con accept/reject por solicitud.

### 7.2 Banner "Solicitudes por promoción pendientes" (developer-only)

- Mismo estilo animado.
- Click → drawer existente de solicitudes por promoción.

### 7.3 Banner "Tu empresa no es visible" (own ficha · datos faltantes)

- Solo si `!isVisitor && !hasMinimumIdentityData(empresa).ok`.
- Bg `warning/10`, lista de campos faltantes.
- Excepción: invitaciones de promotores prevalecen.

### 7.4 Card "Aún no colaboras · Enviar solicitud" (visitor mode)

- En el hero de `/colaboradores/:id` o `/promotor/:id` cuando
  `isVisitor && !hasActiveCollab && effectiveTenantId`.
- CTA primary "Enviar solicitud".
- Si datos mínimos no cumplen → toast con campos a rellenar.
- Si ya hay solicitud pendiente → variant locked con copy
  "esperando respuesta".

---

## 8. Pestañas de filtrado · estado actual

### `/colaboradores` (Inmobiliarias)

- **Todos** → todas las del sistema (excluye self para agency).
- **Colaboradores** → `estadoColaboracion === "activa"`.
- **Pendientes** → `solicitudPendiente || isNewRequest`.
- **No colaboradores** → `estadoColaboracion === "pausada"`.

### `/promotores`

- **Todos** → todos los promotores del sistema (Luxinmo + externos).
- **Colaboradores** → `status === "active" && estadoColaboracion === "activa"`.
- **No colaboradores** → todo lo demás.

---

## 9. Reglas Byvaro consolidadas (referencia rápida)

| Regla | Donde se aplica |
|---|---|
| Categorías son derivadas (no campos manuales) | `empresaCategories.ts` |
| Solo colaboradores activos pueden ser seleccionados/favoritos | `AgencyGridCard.canInteract` |
| Self-exclusion en listados | `Colaboradores.tsx::filtered` |
| Datos sensibles (Detalles) solo a admin colaborador | `Empresa.tsx::canViewSensitiveDetails` |
| Datos mínimos antes de enviar solicitud | `orgCollabRequests.ts::hasMinimumIdentityData` |
| Banner "no visible" si faltan datos · invitaciones de promotor prevalecen | `Empresa.tsx::CompanyVisibilityBanner` |
| Promotor vs Comercializador · label dinámico per-promoción | `promotionRole.ts` |
| Listado per-tenant · sin fuga de datos cross-org | `useEmpresa` `useOficinas` `getPromotionsByOwner` |
| Hub de plantillas en `/ajustes/plantillas` | `registry.ts` |
| `ownerOrganizationId` filtrar siempre | `promotionsByOwner.ts` |

---

## 10. Incoherencias y fugas conocidas

> **Esta sección documenta gaps reales del estado actual del prototipo.
> Pasarla a un AI para validación cruzada.**

### 10.1 🔴 CTA "Enviar solicitud" se muestra al promotor en su PROPIA ficha

**Síntoma**: Arman entra a `/promotor/developer-default` (su propio
perfil). Ve "Aún no colaboras con Luxinmo · Enviar solicitud". No
debería · es su workspace.

**Causa**: `hasActiveCollab` para developer mirando otro developer (incluido
él mismo) llama a `hasActiveDeveloperCollab(currentUser)` que devuelve
`false` siempre para `accountType="developer"`. La condición del CTA
solo chequea `isVisitor && !hasActiveCollab && effectiveTenantId`.

**Fix sugerido**: añadir guard `currentOrgIdentity(user).orgId !== effectiveTenantId`
antes de renderizar la card.

### 10.2 🔴 Validación de datos mínimos asimétrica entre developer y agency

**Síntoma**: Para developer (Arman) la validación `hasMinimumIdentityData`
lee `byvaro-empresa` (storage real) → puede fallar si vacío. Para agency
(Anna) lee `agencies.ts` seed (siempre lleno) → siempre pasa.

**Causa**: `getMyOwnEmpresa(user)` rutea por `accountType`. La agency no
tiene un storage editable equivalente a `byvaro-empresa` en el mock.

**Fix sugerido**: cuando aterrice multi-tenant, cada workspace (incluida
agency) tendrá su propio `empresa` editable. En el mock, alternativa:
permitir que la agency edite un overlay localStorage `byvaro-empresa-agency-<id>`.

### 10.3 🟡 Tres sistemas paralelos para "solicitudes"

**Síntoma**: existen tres conceptos distintos con storage y APIs
separadas: invitaciones (promotor→agencia), solicitudes-per-promoción,
solicitudes-org-level. Confunde.

**Causa**: cada concepto se añadió en una iteración diferente sin
unificar.

**Fix sugerido**: backend debería tener UNA tabla `collab_requests` con
campos `from_org`, `to_org`, `promotion_id?`, `kind` (invitation/request/promo),
`status`. Frontend hooks pueden seguir separados pero apuntando a la
misma fuente.

### 10.4 🟡 `byvaro-oficinas` sigue siendo un único key global

**Síntoma**: `loadOficinas()` lee una sola key `byvaro-oficinas`. El
seed inicial mete las 6 oficinas de Luxinmo. Se mitigó añadiendo
`useOficinas(tenantId)` que rutea a seed por agencia/promotor visitor,
pero la key del LOGUEADO sigue siendo única.

**Causa**: deuda histórica · `useOficinas()` (sin args) lee la key
global pensada para el promotor.

**Fix sugerido**: scoped key `byvaro-oficinas:<workspaceKey>` para que el
own workspace de cada agencia/developer tenga sus propias oficinas
editables. Backend: scoped al `organization_id` del JWT.

### 10.5 🟡 `inboundRequestAt` y `requestedAt` usan `lastActivityAt` como proxy

**Síntoma**: Cards "Solicitado DD/MM" y "Colaboración solicitada DD/MM"
usan `agency.lastActivityAt` como fecha. No es un campo "fecha de
solicitud" real.

**Causa**: el seed `agencies.ts` no tiene un `requestSentAt` ni
`requestReceivedAt` separado.

**Fix sugerido**: añadir `agency.collabRequestSentAt: ISO` (developer→agency
direction) y backend mantendrá la fecha real.

### 10.6 🟡 Dos modelos paralelos de promociones (Luxinmo + EXTERNAL)

**Síntoma**: `promotions.ts + developerOnlyPromotions.ts` (Luxinmo) y
`EXTERNAL_PROMOTOR_PORTFOLIO` (externos) son arrays distintos.
`getPromotionsByOwner()` los unifica en lectura, pero el shape
`ExternalPortfolioEntry` es subset de `Promotion`.

**Causa**: optimización del prototipo · no había `ownerOrganizationId`
desde el principio.

**Fix sugerido**: backend → un único `promotions` table con
`owner_organization_id`. Borrar `EXTERNAL_PROMOTOR_PORTFOLIO`. Mock
update: convertir entries externos a shape full Promotion con campos
default.

### 10.7 🟢 Helpers muertos tras cambios de diseño

**Síntoma**: dead code en componentes:
- `categoryHeroColor()` en `Empresa.tsx:625` · usado para colorear categorías,
  pero pasamos a neutro · ya no se llama.
- `categoryTextColor()` en `AgencyGridCard.tsx:528` · idem.
- `EmpresaCategoryBadges` componente · creado para pills, ahora rendereamos
  texto inline.

**Fix**: borrar funciones no llamadas y posiblemente el componente
`EmpresaCategoryBadges` si nadie lo usa. Verificar grep antes de borrar.

### 10.8 🟢 Anna no puede editar su propia `/empresa`

**Síntoma**: una agencia entra a `/empresa` y ve su ficha en visitor mode
(read-only). No puede cambiar logo, descripción, etc.

**Causa**: `effectiveTenantId = currentUser.agencyId` para agency users
fuerza `isVisitor=true` siempre.

**Fix sugerido**: cuando aterrice multi-tenant, la agency tiene su propio
empresa editable. Mock: overlay localStorage por agency con merge sobre
seed.

### 10.9 🟡 `hasActiveCollab` no contempla agency↔agency

**Síntoma**: Anna visita Prime Properties (`ag-1`). `hasActiveCollab`
devuelve `false` correctamente (Anna no está en `agencies.ts` como
collaborator de Prime). Pero si en el futuro hay un
`OrgCollabRequest` aceptado entre Anna y Prime, ese acuerdo no se
refleja en `agency.estadoColaboracion`.

**Fix sugerido**: backend reconciliar `OrgCollabRequest.status="aceptada"`
con `agency.estadoColaboracion` mediante triggers o vista. Mock:
hooks adicionales que cruzen.

### 10.10 🟡 "Pendientes" tab en `/colaboradores` mezcla semánticas por rol

**Síntoma**: para developer, "Pendientes" = agencias que pidieron entrar
en su red (cola de marketplace). Para agency, esas mismas agencias se
ven · pero no son "pendientes para Anna" · son pendientes para Luxinmo.

**Causa**: filtro `isPendiente(a) = solicitudPendiente || isNewRequest`
es flag del seed que no codifica el destinatario.

**Fix sugerido**: campo `targetOrgId` en la solicitud entrante. Filtro
`isPendiente && to_org === currentOrgId`.

### 10.11 🟢 `unidadesEnColaboracion` calculado solo para agencia visitada

**Síntoma**: La métrica solo se computa cuando `tenantId.startsWith("ag-")`
(rama agency-visitor). Para developer/own y promotores externos queda en 0.

**Causa**: la métrica es semánticamente solo para agencias.

**Fix**: explicitar en doc que es métrica agency-only · ya está
documentado en el código.

### 10.12 🟡 Card de Iberia/Baltic muestra "Contrato pendiente" pero el flujo del marker es ambiguo

**Síntoma**: agencias `pending` con `contrato-pendiente` muestran como
"warning" en card. Pero también podrían interpretarse como "tú les
enviaste invitación" o "ellos te enviaron solicitud" · ambiguo.

**Causa**: el seed no especifica dirección de la solicitud.

**Fix sugerido**: añadir `Agency.requestDirection: "inbound" | "outbound"`
para que el marker sea consistente.

---

## 11. Resumen para AI auditor

> "Lee este documento + el código de `src/lib/orgCollabRequests.ts`,
> `src/components/agencies/AgencyGridCard.tsx`, `src/pages/Colaboradores.tsx`,
> `src/pages/Empresa.tsx`, `src/lib/empresaCategories.ts`,
> `src/lib/promotionsByOwner.ts`. Verifica:
>
> 1. Que `getPromotionsByOwner(orgId)` se use en TODA query per-tenant.
> 2. Que las cards apliquen `canInteract` correctamente (regla Byvaro
>    §9: solo activos pueden seleccionar/favoritar).
> 3. Que `hasMinimumIdentityData` se llame antes de
>    `crearOrgCollabRequest`.
> 4. Que `RestrictedDetailsCard` se renderice cuando
>    `!canViewSensitiveDetails`.
> 5. Que las invitaciones de promotor SIEMPRE puedan aceptarse
>    (excepción de §3.4).
> 6. Que el marker de la card siga la prioridad §5.2.
> 7. Las incoherencias §10 NO han sido resueltas · son backlog conocido.
>
> Si encuentras un componente que lee storage o seeds directamente
> (sin pasar por los hooks/helpers canónicos), márcalo como nueva
> incoherencia y añádela a §10."
