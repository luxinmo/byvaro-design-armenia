# Pantalla · Equipo (`/equipo`)

> Hub central del equipo del promotor. Muestra a todos los miembros
> (activos, invitados, solicitudes pendientes, inactivos) con dos vistas
> intercambiables y permite al admin dar de alta, editar y gestionar sus
> permisos, roles, cargos, idiomas y planes de comisión.

## Propósito

- Visualizar al equipo con foto y metadatos ricos (idiomas, cargo,
  contacto, estado de salud).
- Dar de alta nuevos miembros con dos flows: invitación por email o
  creación directa con contraseña temporal.
- Editar el perfil de cualquier miembro al clicar su card / fila.
- Ver un **resumen de rendimiento** sin salir del popup · click en
  "Ver estadísticas completas →" lleva al dashboard detallado
  (`/equipo/:id/estadisticas` · ver `equipo-estadisticas.md`).

## Audiencia

| Persona | Vista | Puede |
|---|---|---|
| **Admin (promotor)** | Completa | Invitar, crear, editar todos los campos, cambiar rol, desactivar, eliminar |
| **Member (promotor)** | Completa read-only | Ver al equipo y sus idiomas/cargos, nada más |
| **Agency** | N/A | Ruta no visible ni accesible (`PromotorOnly`) |

## Layout · dos vistas intercambiables

### Vista **Galería** (default)

Grid 2-col (mobile: 1-col) de cards ricas · 120-140px foto + metadatos:

```
┌────────────────────────────────────────────────────────────┐
│ Red                                                        │
│ Equipo           [Galería · Lista]      [+ Añadir miembro] │
│ 5 activos · 1 invitado · 0 pendientes · 1 inactivo         │
│ [ Buscar por nombre, email, cargo…     ]                   │
├────────────────────────────────────────────────────────────┤
│ SOLICITUDES E INVITACIONES                                 │
│ ┌─ Sophie Martin ────── Invitado ──┐                       │
│ │ 📷 Agente · Comercial            │                       │
│ │ 🇫🇷 FR 🇬🇧 EN 🇪🇸 ES             │                       │
│ │  email · teléfono     [Revocar]  │                       │
│ └──────────────────────────────────┘                       │
│                                                            │
│ EQUIPO DE DIRECCIÓN                                        │
│ ┌─ Arman Rahmanov ──── Visible ────┐  ┌─ …                │
│ │ 📷 Founder & Co-Founder          │                       │
│ │    · Dirección                   │                       │
│ │ 🇪🇸 🇬🇧 🇷🇺                      │                       │
│ │  phone · email      Admin · ✓ ✓ │                       │
│ └──────────────────────────────────┘                       │
│                                                            │
│ COMERCIAL   (grid 2-col)                                   │
│ INACTIVOS   (opacidad 70 · foto grayscale)                 │
└────────────────────────────────────────────────────────────┘
```

### Vista **Lista**

Filas compactas agrupadas en Cards (patrón idéntico a
`/ajustes/usuarios/miembros`):

- **Solicitudes e invitaciones** (botones Aprobar/Rechazar/Revocar).
- **Equipo · N** (filas clicables · abren dialog).
- **Inactivos · N** (botón Reactivar inline).

Cada fila muestra: avatar · nombre + email + cargo · iconos de señales
(2FA, email, WhatsApp) · badge estado · pill de rol.

El toggle Galería/Lista vive **en la misma línea del buscador** y usa
`<ViewToggle>` (ver `src/components/ui/ViewToggle.tsx`). Persiste en
`byvaro.equipo.view.v1`.

## Grupos y estados

```ts
type Grouping = {
  requests: TeamMember[];   // status = pending | invited
  direction: TeamMember[];  // role=admin o dept Dirección/Administración
  commercial: TeamMember[]; // resto activos
  deactive: TeamMember[];   // status = deactive
};
```

Un miembro se clasifica en **Dirección** si `role==="admin"` o su
`department` está en `["Dirección", "Administración"]`. El resto de
activos van a **Comercial**.

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Click en card / fila | Abre `MemberFormDialog` (ver abajo) |
| Click en bandera de idioma | Tooltip con nombre completo |
| `+ Añadir miembro` | Abre `InviteMemberDialog` con dos tabs |
| `Aprobar` (en pending) | `status → active` · toast success |
| `Rechazar` (en pending) | Confirm dialog · elimina · cooldown 30d |
| `Revocar` (en invited) | Confirm · elimina invitación |
| `Reactivar` (en deactive) | `status → active` |
| Toggle rol (solo en vista lista) | Cambia `role` admin/member |

## MemberFormDialog · editar un miembro

**Popup 760px · scrollable · responsive**. Secciones (top-to-bottom):

1. **Estado de cuenta** (solo miembros activos/inactivos · no pending)
   - Semáforo global (verde / amber / rojo).
   - 4 chips: Email, WhatsApp, 2FA, Última conexión.
   - Métricas 30d: emails enviados, registros decididos.
2. **Rendimiento · últimos 30 días** (si el miembro tiene stats)
   - 6 KPI tiles (Ventas €, Registros aprobados, Visitas, Conversión,
     Tiempo en CRM, Racha activa).
   - Link "Ver estadísticas completas →" a `/equipo/:id/estadisticas`.
3. **Foto de perfil** (PhotoCropModal integrado).
4. **Identidad** · nombre, email, teléfono (PhoneInput), cargo
   (`JobTitlePicker` máx 2), departamento (auto-derivado del cargo).
5. **Idiomas** · chips con bandera SVG · popover multiselect.
6. **Rol + permisos granulares** (canAcceptRegistrations, canSign,
   visibleOnProfile).
7. **Plan de comisiones · opcional** · `% por captación` y `% por venta`.
   Cuando vacíos → hereda plan por defecto del workspace.
8. **Zona destructiva** (solo miembros existentes activos/inactivos) ·
   Desactivar / Reactivar / Eliminar.

## InviteMemberDialog · alta de un nuevo miembro

**Popup 560px**. Toggle superior con `<ViewToggle>` entre dos modos:

### Modo **Invitar por email** (recomendado)

- Campos: email, rol.
- Valida formato email + comprueba si el email ya pertenece a otra
  organización (409 `EMAIL_TAKEN` · aviso inline con nombre de empresa).
- Backend: `POST /api/organization/invitations { email, role }` · envía
  email con token 7d.
- Status inicial: `invited`.

### Modo **Crear cuenta** (onboarding rápido · presencial)

- Formulario completo: email, rol, nombre, cargo (picker), departamento
  (auto), teléfono, comisiones (opc), contraseña temporal.
- **Generador de password**: 12 chars alfanuméricos + símbolo · excluye
  caracteres ambiguos (`0O1lI`) · botón regenerar + copiar + show/hide.
- Backend: `POST /api/organization/members { ..., generateTempPassword: true }`
  devuelve `{ member, tempPassword }` · admin la comparte por canal seguro.
- Status inicial: `active` · `mustChangePassword: true` al primer login.

## Dependencias de datos

| Dato | Fuente |
|---|---|
| Miembros (seed) | `src/lib/team.ts` → `TEAM_MEMBERS` |
| Miembros (persistencia mock) | `byvaro.organization.members.v4` |
| Tipo `TeamMember` | `src/lib/team.ts` |
| Stats del miembro | `src/data/memberStats.ts` → `getMemberStats()` |
| Catálogo de cargos | `src/data/jobTitles.ts` |
| Catálogo de idiomas | `src/lib/languages.ts` |
| Banderas SVG | `public/flags/{iso}.svg` |

## Componentes clave

- `src/pages/Equipo.tsx` — página principal.
- `src/components/team/MemberFormDialog.tsx` — dialog de edición.
- `src/components/team/InviteMemberDialog.tsx` — dialog de alta.
- `src/components/team/JobTitlePicker.tsx` — multiselect de cargos.
- `src/components/settings/PhotoCropModal.tsx` — recorte de avatar.
- `src/components/ui/Flag.tsx` — bandera SVG con fallback globo.
- `src/components/ui/PhoneInput.tsx` — teléfono unificado con prefijo.
- `src/components/ui/ViewToggle.tsx` — toggle Galería/Lista.

## Endpoints esperados (backend)

Ver `docs/backend-integration.md §1` para detalle completo:

```http
GET    /api/organization/members                  → TeamMember[]
PATCH  /api/organization/members/:id              → TeamMember
POST   /api/organization/members/:id/deactivate
POST   /api/organization/members/:id/reactivate
DELETE /api/organization/members/:id

POST   /api/organization/members  body: { ..., generateTempPassword: true }
                                  409 EMAIL_TAKEN { existingWorkspace }
                                  201 { member, tempPassword? }
POST   /api/organization/invitations { email, role }
DELETE /api/organization/invitations/:id

GET    /api/organization/join-requests            → JoinRequest[]
POST   /api/organization/join-requests/:id/approve
POST   /api/organization/join-requests/:id/reject

GET    /api/members/:id/stats?window=30d          → MemberStats
```

## Reglas de negocio

1. **Un email = una sola organización** (409 si intenta añadir un email
   que ya existe en otro workspace).
2. **Storage key `v4`** tras introducir jobTitles canónicos y avatares.
   Bump de versión pierde los cambios mock anteriores.
3. **Comisiones opcionales** · `commissionCapturePct` y
   `commissionSalePct` son `undefined` por defecto → hereda plan
   del workspace. 0 es un valor válido (0% explícito).
4. **Department auto-derivado del jobTitle** (ver
   `derivedDepartment()` en `src/data/jobTitles.ts`). El admin puede
   override manualmente · si lo toca, `departmentTouched=true` y deja
   de autoderivar.

## Historial

- **2026-04-23** · Primera implementación.
  - Dos vistas galería/lista con `<ViewToggle>`.
  - `MemberFormDialog` con Estado de cuenta + Rendimiento + edición
    completa + comisiones opcionales.
  - `InviteMemberDialog` con dos flows (invitar / crear).
  - Banderas SVG locales reemplazan emojis.
  - Link al dashboard `/equipo/:id/estadisticas`.
  - Ver ADR-049 para el rationale.
