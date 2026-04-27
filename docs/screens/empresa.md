# /empresa · Ficha de empresa

Pantalla canónica del **perfil de empresa** del workspace. Sirve a la
vez como (a) editor para el promotor/agencia que la administra y
(b) ficha pública vista por colaboradores externos. La misma URL
adapta su comportamiento según `tenantId` y rol del usuario logueado.

---

## Variantes y rutas que la consumen

| Ruta | Quién mira | Quién se muestra | Modo |
|---|---|---|---|
| `/empresa` (sin tenantId) | Owner (developer admin o agency admin) | Su propio workspace | Edit + preview toggle |
| `/promotor/:id` | Agencia | Promotor `developer-default` (ficha pública) | Visitor read-only |
| `/colaboradores/:id` | Promotor | Agencia mostrada (ficha pública) | Visitor read-only |

El componente raíz es `src/pages/Empresa.tsx`. Los tabs se encapsulan
en sub-componentes:

- `EmpresaHomeTab.tsx` · Inicio
- `EmpresaAboutTab.tsx` · Sobre nosotros (incluye verificación legal)
- `EmpresaAgentsTab.tsx` · Equipo
- `EmpresaSidebar.tsx` · Sidebar derecha (sólo owner edit mode)

---

## Modelo de "dos fichas"

Cada empresa tiene **dos vistas** independientes:

1. **Ficha pública** (`/empresa` para owner, `/promotor/:id` o
   `/colaboradores/:id` para visitor) — marketing, accesible a
   cualquier visitante. Muestra: hero + KPIs + portfolio destacado +
   equipo + zonas + oficinas + testimonios.
2. **Panel avanzado / operativo** (`/promotor/:id/panel` o
   `/colaboradores/:id/panel`) — gestión del día a día: registros,
   visitas, ventas, comisiones, contratos. Solo accesible a
   colaboradores con vínculo activo.

En la ficha pública (modo visitor) hay un **StatsTeaserCard** que
sustituye al "Lema" y comunica la existencia del panel avanzado.
Si el visitor tiene colaboración activa con la empresa, el CTA "Ver
panel operativo" navega al panel; si no, se muestra como locked
("Disponible cuando colaboréis"). Lógica en `Empresa.tsx::hasActiveCollab`
y `useWorkspaceMembers.tenantToWorkspaceKey`. Ver "REGLA DE ORO ·
Mirror del panel del promotor desde la agencia" en `CLAUDE.md`.

---

## Hero · KPIs y avatares

El strip `<HeroStatsStrip>` decide los KPIs según `entityType`:

- `developer` → 5 tiles: **Años · Promociones · Unidades en venta ·
  Importe en venta · Colaboradores**.
- `agency` → 4 tiles: **Años · Oficinas · Equipo · Unidades vendidas**.

El KPI "Equipo" / contador de "agentes" se computa en
`useEmpresaStats` con la fuente única `members.filter(m =>
m.status === "active" && m.visibleOnProfile)` — el mismo conjunto
que pinta los avatares. Antes había desfase ("5 agentes" vs 4
avatares); ahora coinciden.

Logo + cover de empresa se editan vía `<ImageCropModal>` que persiste
**imagen original sin recortar** en `logoSourceUrl` / `coverSourceUrl`
y los parámetros de crop en `logoCrop` / `coverCrop`. Al reabrir el
editor, restaura el encuadre exacto · permite reajustar sin perder
material. Aspect ratio del cover = 1168.67/224 ≈ 5.214 (alineado con
el render real). Si no hay cover, se renderiza `<DefaultCoverPattern>`
(gradiente diagonal sobrio) + un degradado bottom→top sobre el área
inferior para contraste con UI flotante.

---

## Tab "Inicio"

Estructura de arriba abajo:

1. `<HeroStatsStrip>` (5 ó 4 tiles según `entityType`).
2. Resumen breve (`empresa.overview`).
3. Datos de la empresa (oficinas / equipo / idiomas).
4. Agencias colaboradoras *(solo owner edit mode)* — lista de
   activas + CTA "Ver todos los colaboradores" → `/colaboradores?tab=colaboran`
   (segmented "Colaboradores" pre-aplicado para que coincida con el
   contador "N colaboraciones activas").
5. Equipo del workspace — hasta 5 avatares + "+N" si hay más + CTA
   "Ver todos los miembros" que cambia al tab Equipo (`?tab=agents`)
   en la misma URL · NO navega a `/equipo`.
6. **StatsTeaserCard** *(solo modo visitor)* o nada *(modo owner ·
   sin lema)*.
7. PortfolioShowcase (3 promociones destacadas) + "Ver todas" →
   `/promociones` (owner) o `/promociones?developer=<tenantId>`
   (visitor).
8. Zonas y especialidades.
9. OfficesSection (3 oficinas + "Ver todas las oficinas (N)").
10. Testimonios.

> El **Lema** se eliminó del modo owner; en modo visitor lo sustituye
> el StatsTeaserCard. El Imagen-de-portada / Historia ampliada /
> Testimonios **ya no puntúan** en la "Fuerza del perfil".

---

## Tab "Sobre nosotros"

Orden:

1. **Verificación de empresa** *(arriba del todo, solo owner ·
   desaparece para siempre cuando `verificada=true`)*.
2. Historia (`aboutOverview`).
3. Detalles (razón social · CIF · fundación · contacto · horario).
   El CIF lo ven sólo admins (`isAdmin && !isVisitor`).
4. Reseñas Google · `<GoogleRatingCard>` con configuración
   (input para URL Maps + "Conectar"). Datos persisten en
   `googlePlaceId / googleRating / googleRatingsTotal /
   googleFetchedAt / googleMapsUrl` (ver `docs/backend-integration.md
   §8.1`).
5. Redes sociales y web.

### Verificación legal de empresa

> Card colapsable con CTA "Iniciar verificación". Una vez expandida,
> el promotor adjunta documentos + datos del representante + lista de
> firmantes y solicita la verificación. La sección **permanece visible
> hasta aprobación manual del superadmin Byvaro** — los estados
> intermedios (`firmafy-pendiente`, `revision-byvaro`, `rechazada`) se
> renderizan con UI distinta para cada uno.

**Documentos requeridos**:

- **CIF de la empresa** · multi-archivo · acepta PDF + imagen.
- **DNI/NIE del representante** · multi-archivo · ambas caras o
  documento único.

Ambos uploaders soportan **drag & drop** y `<input multiple>`. Tope
5MB por archivo. Cada doc se guarda como array
(`verificacionDocs.cifEmpresa: Array<{name, dataUrl, uploadedAt, mime}>`).

**Datos del representante** vía `<RepresentativePicker>`:

- Buscador de miembros del workspace (consume `useWorkspaceMembers()`).
- Click en un miembro → arrastra `nombre / email / phone` al rep y
  guarda `memberId` para auditoría.
- Si no hay coincidencias → CTA "+ Crear nuevo: '<query>'" abre un
  mini-form. Al confirmar, se añade un `TeamMember` con
  `role: "admin"`, `status: "active"`, `visibleOnProfile: true`,
  `canSign: true` al store del workspace (queda como propietario
  legal).
- En estado seleccionado: card con avatar + datos + teléfono editable
  (por si el contacto legal difiere del operativo).

**Firmantes**:

- Toggle "¿Es X el único firmante en nombre de la empresa?"
  (`verificacionFirmaUnica: boolean`).
- Si `false`, lista de `verificacionAutorizados` con nombre / email /
  teléfono + "+ Añadir persona autorizada" + delete por entrada.
- Más adelante (al lanzar cada flujo Firmafy) se decide quién firma
  qué documento.

**Estados** (`verificacionEstado`):

| Estado | Cuándo | UI |
|---|---|---|
| `no-iniciada` | default | Card colapsado con CTA "Iniciar" |
| `datos-pendientes` | abierto, no enviado | Form expandido |
| `firmafy-pendiente` | enviado · esperando firma | Estado primary "Esperando firma" |
| `revision-byvaro` | firmado · esperando superadmin | Estado primary "En revisión" |
| `verificada` | aprobado por superadmin | Sección oculta · sello en hero |
| `rechazada` | superadmin rechaza | Estado destructive con motivo + "Volver a intentar" |

**Mock controls** (sólo en prototipo, detrás de `<details>`):
"Simular firma del representante", "Aprobar como superadmin",
"Rechazar como superadmin". En producción los cambios de estado los
disparan webhook Firmafy + acciones del superadmin Byvaro.

Spec del flujo superadmin: ver `docs/screens/admin-verificaciones.md`.

---

## Tab "Equipo"

`<EmpresaAgentsTab>` consume `useWorkspaceMembers(workspaceKey)` con
`workspaceKey = tenantToWorkspaceKey(tenantId)`:

- Sin `tenantId` → workspace del usuario.
- `developer-default` → equipo del promotor.
- `agency-XX` → equipo de la agencia.

Antes leía la lista global → fugaba el equipo del promotor a las
agencias. Ahora cada vista muestra el equipo correcto del tenant
mostrado. Ver "REGLA DE ORO · Datos del workspace son por tenant" en
`CLAUDE.md` y `src/lib/useWorkspaceMembers.ts`.

---

## Sidebar derecha · Fuerza del perfil

Se muestra solo en `viewMode=edit` y `tab=home` (owner). Computa el
% del perfil con peso ponderado:

| Item | Weight |
|---|---:|
| Nombre comercial | 10 |
| Razón social y CIF | 10 |
| Logo subido | 10 |
| Resumen de empresa | 10 |
| Zonas de operación | 10 |
| Al menos 1 oficina | 10 |
| Comisión por defecto | 10 |
| **Verificación de empresa** | **30** |
| **Total** | **100** |

> **No puntúan**: imagen de portada, historia ampliada, testimonios.
> Son nice-to-have, no requisito.

**Una vez al 100%**, el sidebar entero se oculta (`return null`-ish)
para no ocupar espacio · cuando todo está hecho, el card no aporta.

---

## Persistencia (mock)

- Workspace empresa principal: `byvaro-empresa` (single-tenant en mock,
  por `organization_id` en backend).
- Oficinas: `byvaro-oficinas` (única fuente de verdad · ver REGLA DE
  ORO en `CLAUDE.md`).
- Equipo del workspace: `byvaro.organization.members.v4:${workspaceKey}`
  (clave por tenant · ver `useWorkspaceMembers.ts`).

Eventos:

- `byvaro:empresa-changed` · disparado por `update()` en
  `useEmpresa()`.
- `byvaro:members-change` · disparado por `setWorkspaceMembers()` y
  por `meStorage.emitMembersChange()`.

---

## Backend

Resumen de endpoints (spec completa: `docs/backend-integration.md`):

```http
GET    /api/empresa                         # workspace propio
PATCH  /api/empresa
GET    /api/empresa/:tenantId/public        # ficha pública (visitor)

GET    /api/workspace/members
PATCH  /api/workspace/members/:id
POST   /api/workspace/members               # crear (used by RepresentativePicker)

POST   /api/empresa/google-place            # KYC Google Places
GET    /api/empresa/google-refresh          # cron semanal

POST   /api/empresa/verification            # iniciar
PATCH  /api/empresa/verification            # actualizar datos en curso
GET    /api/empresa/verification

# Superadmin
GET    /api/admin/verifications?status=...
POST   /api/admin/verifications/:id/approve
POST   /api/admin/verifications/:id/reject

# Webhooks
POST   /webhooks/firmafy
```

---

## Reglas de oro relacionadas (en CLAUDE.md)

- Datos del workspace son por tenant.
- Mirror del panel del promotor desde la agencia.
- KPIs de empresa derivados, NO manuales.
- Oficinas single source of truth.
- Tick azul de verificación junto al nombre.
- Estado navegable en la URL (tabs).

---

## Última actualización

2026-04-27. Última iteración: verificación legal con multi-archivo +
RepresentativePicker (search workspace member o crear nuevo) +
estados persistentes hasta aprobación manual del superadmin.
