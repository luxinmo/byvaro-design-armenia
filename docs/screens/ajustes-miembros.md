# Pantalla · Miembros del equipo (`/ajustes/usuarios/miembros`)

> Gestión completa del equipo de la organización: quién puede acceder,
> con qué rol, qué permisos granulares tiene y su visibilidad en el
> perfil público del microsite.

## Propósito

- Mostrar a todos los miembros separados por estado (activos, invitados,
  pendientes de aprobación, desactivados).
- Permitir al admin invitar, aprobar solicitudes entrantes, desactivar y
  eliminar miembros.
- Editar inline el cargo, departamento y tres permisos granulares por
  miembro (ADR-048): aprobar registros, firmar contratos, visibilidad en
  microsite.

## Audiencia

| Persona | Vista | Puede |
|---|---|---|
| **Admin** | Completa | Invitar, aprobar, editar, desactivar, eliminar |
| **Member** | Completa · read-only | Ver pero no modificar |
| **Agencia** | N/A (no accede a la ruta) | — |

## Estados del miembro (`TeamMemberStatus`)

| Status | Sección | UI | Acción principal |
|---|---|---|---|
| `pending` | 🔔 Solicitudes pendientes | Badge ámbar "Pendiente" | Aprobar · Rechazar |
| `invited` | Invitaciones enviadas | Badge azul "Invitado" | Revocar |
| `active` | Equipo · N | Badge verde "Activo" | Editar · Desactivar |
| `deactive` | Inactivos · N | Opacidad 70 % · badge gris | Reactivar |

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Miembros del equipo                                          │
│ 4 activos · 1 invitado · 1 solicitud pendiente               │
├──────────────────────────────────────────────────────────────┤
│ [ Invitar miembro ]                                          │
│   email@empresa.com                   [Enviar invitación]    │
├──────────────────────────────────────────────────────────────┤
│ 🔔 Solicitudes pendientes  (visible solo si hay)             │
│   ● thomas.weber@weberpromo.com   Solicitud por dominio      │
│     [ Rechazar ] [ Aprobar ]                                 │
├──────────────────────────────────────────────────────────────┤
│ Equipo · 4                                                   │
│   [AV] Arman Rahmanov (tú)     Activo · Admin        ▽       │
│     arman@byvaro.com · Director comercial                    │
│                                                              │
│   [LG] Laura Gómez             Activo · Miembro      ▽       │
│     laura@byvaro.com · Comercial senior                      │
│     ┌──────── Expandido ────────┐                            │
│     │ Cargo: [Comercial senior]                              │
│     │ Departamento: [Comercial]                              │
│     │ Idiomas: [Español] [English] [Français]                │
│     │                                                        │
│     │ Permisos                                               │
│     │ ☑ Puede aprobar registros                              │
│     │ ☐ Puede firmar contratos                               │
│     │ ☑ Visible en el perfil público                         │
│     │                    [Desactivar]  [Eliminar]            │
│     └──────────────────────────┘                             │
├──────────────────────────────────────────────────────────────┤
│ Invitaciones enviadas · 1                                    │
│   [✉] sophie.martin@byvaro.com         [ Revocar ]           │
├──────────────────────────────────────────────────────────────┤
│ Inactivos · 0                                                │
└──────────────────────────────────────────────────────────────┘
```

## Permisos granulares (ADR-048)

Cada miembro tiene tres toggles independientes del `role`:

| Toggle | Efecto | Dónde se usa |
|---|---|---|
| `canAcceptRegistrations` | Puede aprobar/rechazar registros entrantes de agencias | Gate en los botones Aprobar/Rechazar de `/registros` |
| `canSign` | Puede firmar contratos con agencias en nombre de la empresa | Gate en el flujo de cierre de colaboraciones |
| `visibleOnProfile` | Aparece en el perfil público (microsite, ficha empresa) | Filtro en `src/pages/Empresa.tsx` y templates de microsite |

Un `admin` no implica los tres — puede ser un admin técnico sin
capacidad de firma. Un `member` puede tener `canAcceptRegistrations`
sin ser admin (perfil "gestor comercial").

## Solicitudes pendientes por dominio

Cuando alguien con email `@{tu-dominio}` intenta registrarse desde
`/register`, entra como `pending` en vez de crear una cuenta nueva
independiente. El admin ve la solicitud aquí y puede aprobar (pasa a
`active`) o rechazar (se elimina + cooldown 30 días contra abuse).

## Dependencias de datos

| Dato | Fuente |
|---|---|
| Seed | `src/lib/team.ts` → `TEAM_MEMBERS` |
| Tipo | `src/lib/team.ts` → `TeamMember`, `TeamMemberStatus` |
| Persistencia local | `byvaro.organization.members.v2` |
| Usuario actual (para `isMe`) | `src/lib/currentUser.ts` → `useCurrentUser()` |

## Endpoints esperados

Ver `docs/backend-integration.md §1` (Auth & usuarios):

```http
GET    /api/organization/members                  → TeamMember[]
PATCH  /api/organization/members/:id              → TeamMember
POST   /api/organization/members/:id/deactivate
POST   /api/organization/members/:id/reactivate
DELETE /api/organization/members/:id

POST   /api/organization/invitations { email, role }
DELETE /api/organization/invitations/:id

GET    /api/organization/join-requests            → JoinRequest[]
POST   /api/organization/join-requests/:id/approve
POST   /api/organization/join-requests/:id/reject
```

## Reglas de visibilidad (backend)

- Solo `admin` o miembros con permiso `members.manage` (ver
  `docs/permissions.md`) pueden modificar.
- La lista `GET` devuelve siempre todos los miembros; filtrar en el
  frontend por rol si se quiere ocultar algo (hoy no).
- Al desactivar un miembro, su JWT debe invalidarse en el siguiente
  request (`isActive` check en middleware).

## Historial

- **2026-04-23** · Primera implementación con mocks. Estados y permisos
  granulares basados en Lovable `byvaro-ref-figgy`. Ver ADR-048.
