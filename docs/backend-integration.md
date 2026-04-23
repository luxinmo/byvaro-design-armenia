# backend-integration.md · contrato de integración backend

> **Regla de oro**: cualquier feature nueva en frontend debe registrar
> aquí sus puntos de integración backend y dejar un `TODO(backend)` en
> el código apuntando a la sección correspondiente de este documento.
>
> **Audiencia**: agente/desarrollador backend que levante la API real
> para Byvaro. Este documento es la fuente única de verdad de:
>
> 1. Qué endpoints espera el frontend.
> 2. Qué forma tienen los modelos (multi-tenant).
> 3. Qué campos se persisten y cuáles son derivados.
> 4. Qué datos hoy viven en `localStorage` y deben migrarse.
> 5. Qué crons / jobs periódicos hacen falta.
> 6. Qué integraciones externas consumir (Google, SMTP, WhatsApp, …).

Última actualización: 2026-04-22.

---

## 0 · Arquitectura multi-tenant

Byvaro es multi-tenant. Cada **cuenta** (promotor o agencia) es una
`Empresa` (tenant) con sus usuarios, promociones, contratos y assets
públicos (logo, cover, web, etc.).

```
┌────────────────┐          ┌────────────────┐
│ Empresa        │          │ Empresa        │
│ id=t1          │          │ id=t2          │
│ (Promotor)     │          │ (Agencia)      │
│                │          │                │
│ logoUrl        │          │ logoUrl        │
│ coverUrl       │          │ coverUrl       │
│ promociones[]  │          │ mercados[]     │
└────────┬───────┘          └────────┬───────┘
         │                           │
         └────── Collaboration ──────┘
                 (id, estado, comisión,
                  contractSignedAt, …)
```

La entidad `Agency` que ve el promotor en su `/colaboradores` es una
**vista/join** sobre:

- La tabla `Empresa` (del tenant agencia) → `name, logo, cover, location, type, mercados, teamSize, googlePlaceId, …`
- La tabla `Collaboration` (relación con el promotor) → `estadoColaboracion, origen, contractSignedAt, contractExpiresAt, comisionMedia, registrosAportados, ventasCerradas, salesVolume, visitsCount, solicitudPendiente, …`

**⚠️ Implementación actual (mock)** — `src/data/agencies.ts` mezcla
ambas cosas en un único tipo `Agency`. Al implementar backend, separar:

- `GET /api/empresas/:id/public` → datos públicos del tenant.
- `GET /api/colaboradores` → array de collaborations enriquecidas con el
  bloque público de cada empresa.

---

## 1 · Auth & usuarios

| Endpoint | Propósito | TODO en código |
|---|---|---|
| `POST /api/v1/auth/register` | alta de cuenta (promotor / agencia) | `src/pages/Register.tsx:50,195,211` |
| `POST /api/v1/auth/login` | login email+password | `src/pages/Login.tsx:32,86` |
| `POST /api/v1/companies/join-request` | usuario se une a empresa ya existente | `src/pages/Register.tsx:52,195` |
| `GET  /api/v1/companies/lookup?domain=x` | resolver empresa por dominio email | `src/pages/Register.tsx:54` |
| `POST /api/auth/logout` | cerrar sesión actual (invalida cookie) | `src/lib/accountType.ts:75` (`logout()`), `src/components/AccountSwitcher.tsx:155`, `src/components/MobileHeader.tsx` |
| `POST /api/auth/sign-out-everywhere` | cerrar sesión global | `src/pages/ajustes/zona-critica/cerrar-sesion.tsx:23` |
| `GET /api/me` → `UserProfile` | leer perfil del usuario actual | `src/lib/profileStorage.ts` (`getStoredProfile()` / `usePersistedProfile()`), `src/lib/currentUser.ts:58` |
| `PATCH /api/me { fullName, email, jobTitle, bio, avatar }` | actualizar perfil | `src/pages/ajustes/perfil/personal.tsx:save()`, `src/lib/profileStorage.ts` (`saveStoredProfile()`) |
| `GET/PUT /api/me/phones` | CRUD de teléfonos del usuario | `src/pages/ajustes/perfil/contacto.tsx:15` (`byvaro.user.phones.v1`) |
| `POST /api/me/change-password/request` | pedir código 2FA para cambio password | `src/pages/ajustes/seguridad/contrasena.tsx:176` |
| `POST /api/me/change-password/verify` | confirmar cambio password | `src/pages/ajustes/seguridad/contrasena.tsx:323` |
| `POST /api/me/2fa/setup` | generar secret TOTP + QR | `src/pages/ajustes/seguridad/dos-fa.tsx:102` |
| `POST /api/me/2fa/activate` | activar 2FA con código | `src/pages/ajustes/seguridad/dos-fa.tsx:130` |
| `POST /api/me/2fa/verify` | validar código 2FA en login | `src/lib/twoFactor.ts:87` |
| `POST /api/me/2fa/disable` | desactivar 2FA | `src/pages/ajustes/seguridad/dos-fa.tsx:166` |
| `POST /api/me/2fa/backup-codes/regenerate` | regenerar backup codes | `src/pages/ajustes/seguridad/dos-fa.tsx:182` |
| `GET /api/organization/members` → `TeamMember[]` | listado del equipo (reemplaza `TEAM_MEMBERS`) | `src/lib/team.ts:23`, `src/pages/ajustes/usuarios/miembros.tsx:36`, `src/pages/Equipo.tsx` |
| `PATCH /api/organization/members/:id` | editar campos del miembro (role, jobTitle, department, permisos granulares, commissionCapturePct, commissionSalePct, avatarUrl) | `src/pages/ajustes/usuarios/miembros.tsx`, `src/components/team/MemberFormDialog.tsx:handleSave` |
| `POST /api/organization/members` body: `{ email, fullName, jobTitle?, department?, languages?, role, phone?, commissionCapturePct?, commissionSalePct?, generateTempPassword?: boolean }` → `201 { member, tempPassword? }` · `409 EMAIL_TAKEN { existingWorkspace: string }` | crear miembro **directamente** (flow B · onboarding presencial con contraseña temporal) | `src/components/team/InviteMemberDialog.tsx:handleCreate`, `src/pages/Equipo.tsx:onCreate` |
| `POST /api/organization/members/:id/handover` body: `{ reassignments: { contacts?, opportunities?, records?, visits?, promotions?, email?: string /* newMemberId */ }, reason?: string, deactivate: true }` | **Desactivación con reasignación forzada** (ver ADR-051 + CLAUDE.md §🔄). El backend ejecuta en la misma transacción: reasignar cada categoría, configurar forward de email 6m, añadir evento `reassigned` con nota "Heredado de <nombre>" al historial de cada entidad, y cambiar `status: "deactive"`. | `src/components/team/DeactivateUserDialog.tsx`, `src/lib/assetOwnership.ts`, `src/pages/Equipo.tsx:handleDeactivateConfirm` |
| `POST /api/organization/members/:id/reactivate` | reactivar sin borrar datos | `src/pages/Equipo.tsx:toggleActive` |
| `DELETE /api/organization/members/:id` | eliminar miembro del workspace | `src/pages/ajustes/usuarios/miembros.tsx:removeMember` |
| `POST /api/organization/invitations` body: `{ email, role, personalMessage? }` | invitar miembro (flow A · email con token 7d). **El backend genera el email** con `renderTeamInvitation()` de `src/lib/teamInvitationEmail.ts` (plantilla ya diseñada · es/en). Responde `409 EMAIL_TAKEN` si el email pertenece a otra org. | `src/components/team/InviteMemberDialog.tsx:handleInvite`, `src/pages/Equipo.tsx:onInvite` |
| `DELETE /api/organization/invitations/:id` | revocar invitación enviada | `src/pages/ajustes/usuarios/miembros.tsx:revokeInvite`, `src/pages/Equipo.tsx:revokeInvite` |
| `GET /api/members/:id/stats?window=7d\|30d\|90d\|year` → `MemberStats` (shape en `src/data/memberStats.ts`) | dashboard de rendimiento del miembro · 4 bloques (resultados / pipeline / comunicación / actividad CRM con heatmap 168 celdas) | `src/data/memberStats.ts:getMemberStats`, `src/pages/EquipoMiembroEstadisticas.tsx` |
| `GET /api/members/:id/stats/averages?window=30d` → `Partial<MemberStats>` | media del equipo para benchmarks `↑34% vs equipo` | `src/data/memberStats.ts:getTeamAverages`, `src/pages/EquipoMiembroEstadisticas.tsx:HeroKpis` |
| `POST /api/ai/analyze-member/:id?window=30d` → `AIMemberReport` (ver `docs/plan-equipo-estadisticas.md §3`) | informe IA con score efectividad, fortalezas, áreas de mejora, patrones | `src/pages/EquipoMiembroEstadisticas.tsx` (botón "Análisis IA" · TODO) |
| `GET /api/organization/join-requests` | solicitudes entrantes por dominio | `src/pages/ajustes/usuarios/miembros.tsx:pendingReqs` |
| `POST /api/organization/join-requests/:id/approve` | aprobar solicitud pendiente | idem:approveRequest |
| `POST /api/organization/join-requests/:id/reject` | rechazar solicitud (cooldown 30 días) | idem:rejectRequest |
| `POST /api/workspace/roles/:role/permissions` | editar permisos de rol | `src/pages/ajustes/usuarios/roles.tsx:13` |
| `DELETE /api/me` | eliminar cuenta propia (anonimizar) | `src/pages/ajustes/zona-critica/eliminar-cuenta.tsx:32` |
| `DELETE /api/organization` | borrar workspace completo | `src/pages/ajustes/zona-critica/eliminar-workspace.tsx:48` |
| `POST /api/organization/transfer` | transferir ownership | `src/pages/ajustes/zona-critica/transferir.tsx:45` |
| `PATCH /api/me { locale }` | cambiar idioma | `src/pages/ajustes/idioma-region/idioma.tsx:114` |
| `PATCH /api/me { dateFormat }` body: `"DD/MM/YYYY" \| "MM/DD/YYYY" \| "YYYY-MM-DD" \| "DD MMM YYYY" \| "DD MMMM YYYY"` | preferencia global de formato de fecha · consumida por **toda** la app vía `formatDate()` de `src/lib/dateFormat.ts` (ficha contacto, historial, emails, documentos). Mock localStorage: `byvaro.userDateFormat.v1`. | `src/pages/ajustes/idioma-region/formato-fecha.tsx`, `src/lib/dateFormat.ts` |
| `PATCH /api/organization { currency }` | cambiar moneda | `src/pages/ajustes/idioma-region/moneda.tsx:211` |

**Nota TOTP**: el secret NO debe vivir nunca en el cliente (`src/lib/totp.ts:35`, `src/lib/twoFactor.ts:21`). Actualmente es mock localStorage.

**Nota permisos**: hoy todos los permisos son lado cliente (`src/lib/permissions.ts:8`). En backend, cada endpoint valida server-side por rol (owner/admin/manager/agent/viewer).

---

## 1.5 · Permisos y visibilidad

> 🛡️ **El contrato completo de permisos vive en `docs/permissions.md`.**
> Esta sección solo enumera los endpoints; el catálogo de keys, los
> defaults por rol, las RLS policies y el esquema SQL están allí.

**Endpoints**:
- `GET    /api/permissions/roles` → matriz `{ admin: [...], member: [...], <custom>: [...] }`
- `PATCH  /api/permissions/roles/:role` (`settings.manageRoles`) — invalida tokens del workspace.
- `POST   /api/permissions/roles` (`settings.manageRoles`) — crear rol custom.
- `DELETE /api/permissions/roles/:role` (`settings.manageRoles`) — falla si hay miembros activos.
- `GET    /api/me` → `{ user, workspace, role, permissions[] }`.

**JWT claims** (cada token de `/auth/login` debe incluir):
```json
{
  "sub": "<userId>", "workspace_id": "<wsId>",
  "role": "admin|member|<custom>",
  "permissions": ["whatsapp.viewOwn", "contacts.viewAll", ...]
}
```

**Validación server-side**: cada endpoint del API valida (a) JWT, (b)
`permission` requerido para la acción, (c) RLS aplicada vía
`current_setting('app.user_id')`, `app.workspace_id` y
`app.permissions`. Detalles en `docs/permissions.md` §4.

**Multi-tenant + ownership**: además de `workspace_id`, las entidades
contactos/registros/oportunidades/ventas/visitas/documentos/emails
llevan un campo `assigned_to UUID[]` (índice GIN) sobre el que se
hace el filtro de `viewOwn`. Migration en `docs/permissions.md` §4.1.

---

## 1.5.1 · Dual-role (promotor ↔ agencia)

> 🤝 **El contrato completo del modelo dual vive en
> `docs/dual-role-model.md`.** Esta sección resume solo lo que el
> backend debe implementar — flujos, UX y matriz de features están en
> ese documento.

**Principio**: una sola plataforma, dos tipos de tenant (`developer`,
`agency`). El JWT lleva `accountType`, y cada endpoint decide qué
datos devolver según ese campo.

**JWT claims adicionales** (extiende los de §1.5):
```json
{
  "sub": "<userId>",
  "workspace_id": "<empresaId>",
  "accountType": "developer" | "agency",
  "agencyId": "<agencyId>",   // solo si accountType === "agency"
  "role": "admin|member|<custom>",
  "permissions": [...]
}
```

**RLS por rol** (tabla por tabla):

| Tabla | Promotor (`developer`) | Agencia (`agency`) |
|---|---|---|
| `promociones` | `empresa_id = me.workspace_id` | `id IN (SELECT promotion_id FROM collaborations WHERE agency_id = me.workspace_id AND estado = 'activa')` |
| `registros` | `promocion.empresa_id = me.workspace_id` | `agency_id = me.workspace_id` |
| `contactos` | `empresa_id = me.workspace_id` | `empresa_id = me.workspace_id` (cada tenant tiene los suyos, **nunca se comparten**) |
| `collaborations` | `promotor_id = me.workspace_id` | `agency_id = me.workspace_id` |
| `emails_sent` | `empresa_id = me.workspace_id` | `empresa_id = me.workspace_id` |
| `empresas` (perfil público) | read-only para todos | idem |

**Endpoints exclusivos por rol**:

Solo `developer`:
- `POST   /api/promociones`
- `PATCH  /api/promociones/:id`
- `POST   /api/promociones/:id/invitar-agencia`
- `POST   /api/registros/:id/aprobar` (+ `/rechazar`)
- `GET    /api/microsites/*`
- `PATCH  /api/empresa`
- `GET    /api/colaboradores/estadisticas`

Solo `agency`:
- `POST   /api/promociones/:id/registros`      — registrar cliente
- `GET    /api/marketplace/*`
- `POST   /api/marketplace/:promotorId/solicitar-colaboracion`

Simétricos (mismo path, scope por JWT):
- `GET    /api/promociones`        — el backend filtra por rol.
- `GET    /api/registros`          — idem.
- `GET/POST /api/contactos`, `/api/ventas`, `/api/emails/*`,
  `/api/calendario/*`.

**Validación server-side**: antes de acceder a un endpoint exclusivo,
validar `JWT.accountType` matchea lo esperado. Sugerencia: prefijar las
rutas (`/api/developer/*`, `/api/agency/*`, `/api/shared/*`) y validar
en middleware. Ver `docs/dual-role-model.md` §3.5.

**Emails comerciales de agencia**: el backend debe aceptar una flag
`agencyMode: true` en el payload de `POST /api/emails/send` para que
las plantillas renderizadas omitan bloques identificativos de la
promoción (showroom, ubicación exacta, plan de pagos). La generación
del HTML puede seguir siendo cliente-side mientras no exista
plantillas server-side — cuando migre, replicar la lógica de
`opts.agencyMode` en `emailTemplates.ts`.

---

## 1.6 · Contactos (ficha completa)

> Spec UI canónica: `docs/screens/contactos-ficha.md`. Tipos en
> `src/components/contacts/types.ts`.

**Endpoints CRUD principales**:
```
GET    /api/contacts                       → Contact[] (paginado)
GET    /api/contacts/:id                   → ContactDetail
POST   /api/contacts                       → ContactDetail
PATCH  /api/contacts/:id                   → ContactDetail
DELETE /api/contacts/:id                   (contacts.delete)
```

**Sub-recursos** (toda mutación sobre un sub-recurso emite evento en
el audit log — ver §1.7):

```
GET    /api/contacts/:id/records           → ContactRecordEntry[]
GET    /api/contacts/:id/opportunities     → ContactOpportunityEntry[]
POST   /api/contacts/:id/opportunities     (opportunities.create)
PATCH  /api/contacts/:id/opportunities/:oid
GET    /api/contacts/:id/operations        → { activeOperation, recentSales[] }

GET    /api/contacts/:id/visits            → ContactVisitEntry[]
POST   /api/contacts/:id/visits            (visits.schedule)
POST   /api/contacts/:id/visits/:vid/evaluate    (visits.evaluate)

GET    /api/contacts/:id/documents         → ContactDocumentEntry[]
POST   /api/contacts/:id/documents         (documents.upload, S3 presigned)
DELETE /api/contacts/:id/documents/:did    (documents.delete)

GET    /api/contacts/:id/comments          → ContactCommentEntry[]
POST   /api/contacts/:id/comments          (cualquier viewOwn del contacto)
PATCH  /api/contacts/:id/comments/:cid     (solo autor)
DELETE /api/contacts/:id/comments/:cid     (solo autor)

GET    /api/contacts/:id/assigned          → ContactAssignedUser[]
PUT    /api/contacts/:id/assigned          { userIds: [...] }   (contacts.assign)

PATCH  /api/contacts/:id/languages         { languages: string[] }   (contacts.edit)
                                           → `ContactDetail` con `languages` actualizado.
                                           Códigos ISO 639 + región (ES, EN, FR, DE…).
                                           Canónico en `src/lib/languages.ts`.
                                           UI inline: chips + popover dentro de la card
                                           "Datos" (sin abrir "Editar contacto"). Actualmente
                                           mockeado en `src/components/contacts/contactLanguagesStorage.ts`
                                           (clave `byvaro.contact.<id>.languages.v1`, evento
                                           `byvaro:contact-languages-change`).

GET    /api/contacts/:id/related           → ContactRelation[]
POST   /api/contacts/:id/related           { contactId, relationType }
                                           (bidireccional · escribe en ambos)
DELETE /api/contacts/:id/related/:cid      (también borra el inverso)

GET    /api/contacts/:id/email-stats       → { sent, received, delivered,
                                                opened, byUser[],
                                                unreadCount }
```

**Catálogo de tipos de relación** (ver `docs/screens/ajustes-contactos-relaciones.md`):

```
GET  /api/contacts/relation-types          → { types: RelationType[] }
PUT  /api/contacts/relation-types          { types: [...] }
                                           (settings.manageRoles o
                                            contacts.manageRelationTypes)
```

**Filtros del listado `/api/contacts`** (parámetros de query):
- `status`, `tags[]`, `assignedTo[]`, `source`, `nationality`,
  `cursor`, `limit`, `q` (busca en nombre, email, ref, NIF, teléfono
  por últimos 8 dígitos).
- Server respeta visibilidad: si el usuario solo tiene
  `contacts.viewOwn`, fuerza `assignedTo CONTAINS user.id`.

**Deduplicación al ingreso** (regla del producto):
- Email match exacto case-insensitive → mismo contacto.
- Teléfono: comparar **últimos 8 dígitos** (`+34 600123456` ≡
  `600123456` ≡ `0034600123456`).
- Si match → MERGE en lugar de crear nuevo (registra
  `contact_edited` con campos cambiados).

**Sanitización de inputs**:
- Email: strip espacios, lowercase server-side.
- Teléfono: strip espacios + caracteres no-dígito (excepto `+` inicial)
  antes de persistir; mantener formato display separado.

---

## 1.7 · Audit log de contactos

> Regla de oro: ver `CLAUDE.md` §🥇 Historial + ADR-040.
> Spec frontend: `src/components/contacts/contactEventsStorage.ts`.

El backend genera el evento server-side en cada mutación
(POST/PATCH/DELETE) sobre cualquier sub-recurso de un contacto. El
frontend NO debería poder llamar directamente a `POST /events` salvo
para `comment` (acción explícita del usuario).

**Endpoints**:
```
GET  /api/contacts/:id/events              → ContactTimelineEvent[] (paginado, desc)
                                             Query: ?type=&category=&from=&to=
                                             Permiso: audit.viewOwn (en assigned)
                                                      o audit.viewAll
POST /api/contacts/:id/events              → ContactTimelineEvent
                                             Body: { type, title, description?, meta? }
                                             Solo para `type === "comment"` desde el
                                             cliente (resto los emite el sistema).
```

**Tipos de evento que el backend debe emitir** (catálogo completo en
`data-model.md`):
- En `PATCH /api/contacts/:id` con campos cambiados → `contact_edited`
  con `description: "Cambios en: nombre, email, ..."`.
- En `DELETE /api/contacts/:id` → `contact_deleted` (antes del delete
  para que persista).
- En `PUT /api/contacts/:id/assigned` → diff → emitir
  `assignee_added` / `assignee_removed` por miembro afectado.
- En `POST /api/contacts/:id/related` → `relation_linked`
  **bidireccional** (en ambos contactos).
- En `POST /api/contacts/:id/visits/:vid/evaluate` → `visit_evaluated`
  + el outcome correspondiente (`visit_done` / `visit_cancelled`).
- En `POST /documents` / `DELETE /documents/:did` → `document_uploaded`
  / `document_deleted`.
- Webhook SMTP delivered → `email_delivered` (system actor).
- Webhook pixel opened → `email_opened` (system actor).
- IMAP / Gmail entrante matcheado → `email_received` (system actor).
- Envío saliente desde GmailInterface → `email_sent` (con actor =
  usuario que envía).
- WhatsApp saliente → `whatsapp_sent`.
- WhatsApp entrante → `whatsapp_received`.
- Pixel de microsite o brochure → `web_activity`.

**Storage backend**: tabla `contact_events` con `(contact_id,
created_at DESC)` index. Append-only. Retención mínima 2 años. Cap
opcional 10k eventos por contacto (paginar más allá vía cursor).

**RLS**: solo usuarios con `audit.viewAll` ven eventos donde no son
actor o el contacto no está asignado a ellos.

---

## 1.8 · Webhooks de email (delivered / opened / received)

Para que el ciclo de email del Historial funcione (ADR-045) el backend
necesita 3 fuentes de eventos:

1. **Delivered** — callback del proveedor SMTP (Resend, Postmark,
   SendGrid). Cada vez que un email sale entregado:
   ```
   POST /webhooks/email/delivered  (firmado)
   { messageId, to, subject, deliveredAt }
   ```
   Lookup del `contactId` por email destinatario → emitir
   `email_delivered`.

2. **Opened** — pixel de tracking 1x1 inline en el email saliente.
   Endpoint público:
   ```
   GET /api/email-pixel/:trackingId.gif
   ```
   El backend resuelve `trackingId → messageId → contactId`, registra
   `email_opened` (si no estaba ya), responde el GIF.

3. **Received** — IMAP poll o webhook Gmail/Microsoft Graph. Cuando
   llega un email entrante:
   - Match `from` con tabla de contactos (case-insensitive).
   - Si match → `email_received`.
   - Si no match → opcional: crear contacto fantasma o ignorar.

**Plantillas (envío saliente)**:
- Inline pixel: `<img src="https://api.byvaro.com/api/email-pixel/{trackingId}.gif" width="1" height="1" />`.
- Headers: `X-Byvaro-MessageId: <uuid>` para correlacionar con webhooks.

---

## 1.9 · Equipo · flujos de alta y stats

**Ver también**:
- `docs/plan-equipo-estadisticas.md` — plan comercial + KPIs + IA.
- `docs/screens/equipo.md` — spec pantalla `/equipo`.
- `docs/screens/equipo-estadisticas.md` — spec dashboard del miembro.
- **ADR-049** — rationale de los 2 flows + dashboard + plan de comisiones.

### Regla fuerte · unicidad de email

> **Un email solo puede pertenecer a una única organización.** El backend
> valida y responde `409 EMAIL_TAKEN` con el nombre del workspace origen
> para que el frontend muestre aviso descriptivo al admin que intenta
> invitar/crear.

```json
// 409 EMAIL_TAKEN
{
  "error": "EMAIL_TAKEN",
  "existingWorkspace": "Prime Properties"
}
```

### Flow A · Invitar por email (`POST /api/organization/invitations`)

- Payload: `{ email, role: "admin"|"member", personalMessage?: string }`.
- El backend persiste la invitación con token único (expira 7 días).
- Envía el email usando `renderTeamInvitation()` de
  `src/lib/teamInvitationEmail.ts`. La plantilla devuelve
  `{ subject, plainText, html }` en es/en con botón CTA al link
  `https://app.byvaro.com/activate?token=<TOKEN>`.
- El frontend ya **previsualiza** el HTML antes de enviar (iframe en
  el dialog). El backend y el frontend usan la MISMA función para que
  el preview coincida con lo que recibe el destinatario.

### Flow B · Crear con contraseña temporal (`POST /api/organization/members`)

- Payload completo de `TeamMember` (sin `id`) + flag `generateTempPassword: true`.
- El backend genera contraseña 12 chars alfanuméricos + símbolo (sin
  ambiguos `0O1lI`) o acepta la que venga del frontend (el form genera
  en cliente para mostrar al admin antes).
- Respuesta `201`: `{ member, tempPassword: string }`.
- Al guardar el miembro, `member.mustChangePassword = true` se establece
  automáticamente (forzar cambio al primer login).

### Plan de comisiones

Campos opcionales `commissionCapturePct` y `commissionSalePct` (0-100).
`undefined` = hereda plan por defecto del workspace (futuro endpoint
`GET /api/organization/commission-defaults`). `0` es valor válido
explícito (no hay comisión).

### Dashboard de stats · `GET /api/members/:id/stats`

Query: `?window=7d|30d|90d|year` (default `30d`).

Respuesta: `MemberStats` (shape canónico en `src/data/memberStats.ts`).
Ver `docs/data-model.md §MemberStats` para el tipo completo.

**Caching sugerido:**
- Resultados comerciales · 5 min (cambian al cerrar venta).
- Actividad CRM · 15 min (heatmap, tiempo activo).
- Invalidación inmediata al insertar venta/registro/visita.

**Rate limiting sugerido:**
- 60 req/min por admin.
- 10 req/min por miembro que consulta sus propias stats.

### `GET /api/members/:id/stats/averages?window=30d`

Medias del equipo para los campos numéricos principales (`salesValue`,
`recordsApproved`, `visitsDone`, `conversionRate`, `emailsSent`,
`avgDailyActiveMin`, `avgLeadResponseMin`). El frontend calcula deltas
`↑34% vs equipo` en las hero cards.

### `POST /api/ai/analyze-member/:id?window=30d` (futuro)

Ver `docs/plan-equipo-estadisticas.md §3`:
- Modelo: Claude Haiku 4.5 o GPT-4o-mini (decisión pendiente).
- Input: `MemberStats` + `getTeamAverages()`.
- Output: `AIMemberReport` con `effectivenessScore`, `status`,
  `strengths`, `areasForImprovement`, `patterns`, `adminActions`.
- Caché 24h + rate limit 5 informes/día/admin.

---

## 2 · Empresa (perfil del tenant)

**Tipo completo**: `src/lib/empresa.ts:32` (interface `Empresa`).

**Storage actual**: localStorage bajo clave `byvaro-empresa`.

### Endpoints esperados

| Endpoint | Propósito |
|---|---|
| `GET /api/empresa` | perfil completo del tenant logueado |
| `PATCH /api/empresa` | update parcial del perfil |
| `GET /api/empresas/:id/public` | perfil público (para enriquecer cards de colaborador en OTRO promotor) |
| `POST /api/empresa/logo` | upload de logo (circular, ≥256×256) → devuelve `logoUrl` |
| `POST /api/empresa/logo-rect` | upload de wordmark rectangular (~250×100) → `logoRectUrl` |
| `POST /api/empresa/cover` | upload de cover (portada) → `coverUrl` |
| `GET /api/empresa/oficinas` | lista de oficinas del tenant |
| `POST /api/empresa/oficinas` | crear oficina |
| `PATCH /api/empresa/oficinas/:id` | editar oficina |
| `DELETE /api/empresa/oficinas/:id` | borrar oficina (regla: si es `esPrincipal`, promover otra automáticamente) |

### Google Places API (rating público)

Ver detalle en sección **#8 · Integraciones externas**.

Endpoints dedicados:
- `POST /api/empresa/google-place { mapsUrl }` → resuelve `place_id` y dispara primer fetch.
- Cron interno semanal que llama a Places Details y actualiza `googleRating`, `googleRatingsTotal`, `googleFetchedAt`.

TODOs: `src/components/empresa/GoogleRatingCard.tsx:16`.

---

## 3 · Promociones

**Tipo**: `src/data/promotions.ts` (`Promotion`) + `src/data/developerPromotions.ts` (`DevPromotion` extiende `Promotion`).

### Endpoints

| Endpoint | Propósito | TODO |
|---|---|---|
| `GET /api/promociones` | listar con filtros | — |
| `GET /api/promociones/:id` | detalle | — |
| `POST /api/promociones` | crear (con `WizardState`) | `src/pages/CrearPromocion.tsx` |
| `PATCH /api/promociones/:id` | actualizar | — |
| `POST /api/promociones/:id/publish` | publicar (requiere `missingSteps.length === 0`) | `src/pages/PromocionDetalle.tsx:537,563` |
| `GET /api/promociones?estado=borrador` | listar borradores del user | `src/lib/promotionDrafts.ts:12` |
| `POST /api/promociones/borradores` | guardar borrador | idem |
| `DELETE /api/promociones/borradores/:id` | eliminar borrador | idem |
| `GET /api/promociones/:id/units` | listar unidades (paginado) | `src/components/promotions/detail/PromotionAvailabilityFull.tsx:59` |
| `PATCH /api/units/bulk` | edición masiva atómica | idem:60 |
| `PATCH /api/units/:id` | editar unidad | `src/components/promotions/detail/UnitDetailPanel.tsx:49` |
| `POST /api/units/:id/reservations` | crear reserva | idem:50 |
| `GET /api/units/:id/media` | media (planos, fotos, tour) | idem:52 |
| `PATCH /api/promociones/:id/blocks/:block` | renombrar bloque | `PromotionAvailabilityFull.tsx:65` |
| `GET /api/promociones/:id/gallery` | galería (5+ imágenes) consumida por el mosaic + `ImageLightbox` en `PromocionDetalle.tsx:368` | — |
| `GET /api/promociones/:id/brochure` | URL del PDF oficial · 404 si no existe (la acción rápida "Brochure" queda deshabilitada) | `PromocionDetalle.tsx` (state `brochureRemoved`) |
| `POST /api/promociones/:id/brochure` | subir/reemplazar brochure | `EditDocumentDialog` con key `"brochure"` |
| `DELETE /api/promociones/:id/brochure` | eliminar brochure | kebab de la card Brochure · debe dejar la promo sin brochure (UI oculta la sección y deshabilita la acción rápida) |
| `GET /api/promociones/:id/availability-summary` | resumen de disponibilidad | `PromotionAvailabilitySummary.tsx:32` |
| `GET /api/promociones/:id/export` | descarga ficha PDF | `PromotionAvailabilityFull.tsx:66` |
| `POST /api/promociones/:id/notify-collaborators` | aviso masivo nuevas unidades | idem:61 |
| `POST /api/promociones/:id/share-clients` | aviso a clientes registrados | idem:63 |
| `POST /api/promociones/:id/units/:ref/drive-folder` | crear carpeta Drive | `src/components/crear-promocion/UnitSimpleEditDialog.tsx:171` |
| `GET /api/promociones/:id/anejos` | listado de anejos sueltos (parkings/trasteros) · consumido por el segmento "Anejos" de Disponibilidad | `src/data/anejos.ts` · `PromotionAnejosTable.tsx` |
| `PATCH /api/anejos/:id` | editar anejo (precio, estado, cliente) | idem |
| `POST /api/anejos/:id/reservations` | iniciar compra / reservar anejo | idem |
| `POST /api/anejos/:id/email` | enviar ficha de anejo por email | idem |

**Campos derivados a calcular en backend** (no duplicar en DB):
- `priceMin/Max` → `MIN/MAX(units.price)`.
- `availableUnits` → `COUNT(units WHERE status='available')`.
- `constructionProgress` → desde `faseConstruccion`.

### 3.1 · Anejos sueltos

Entidad paralela a `Unit` para parkings y trasteros que se venden **por
separado** (no incluidos en el precio de la vivienda). Modelo en
`src/data/anejos.ts`:

```ts
type Anejo = {
  id: string;                  // interno
  promotionId: string;
  publicId: string;            // "P1", "T3"
  tipo: "parking" | "trastero";
  precio: number;              // EUR
  status: "available" | "reserved" | "sold" | "withdrawn";
  clientName?: string;
  agencyName?: string;
  reservedAt?: string;         // ISO
  soldAt?: string;             // ISO
};
```

Origen de los datos: los crea el wizard `CrearUnidadesStep` en el
campo "Anejos sueltos" cuando `trasterosAdicionales > 0` o
`parkingsAdicionales > 0` (calculado como `total - (units ×
incluidosPorVivienda)` cuando `incluidosPrecio === true`).

**Persistencia backend**: al publicar la promoción, generar N filas en
la tabla `anejos` a partir de `state.parkings` / `state.trasteros` y
los arrays `parkingPrecios` / `trasteroPrecios`. Los estados arrancan
todos como `available`. `publicId` se autogenera (P1..Pn, T1..Tn).

**UI consumidora**: `PromotionAnejosTable.tsx`. Solo se muestra si la
promoción tiene anejos (el segmento "Anejos" en la toolbar de
Disponibilidad aparece condicionalmente).

---

## 4 · Colaboradores (agencias)

**Tipo**: `src/data/agencies.ts` (`Agency`). Helper `getContractStatus()`.

### Endpoints

| Endpoint | Propósito | Notas |
|---|---|---|
| `GET /api/colaboradores` | lista de agencias del promotor enriquecida con su `Empresa.public` | ver #0 sobre el join |
| `GET /api/colaboradores/:id` | ficha detalle · `/colaboradores/:id` | `src/pages/AgenciaDetalle.tsx` |
| `GET /api/promociones?collaboratingAgencyId=:id` | promos donde colabora una agencia | idem (bloque "Promociones compartidas") |
| `GET /api/colaboradores/estadisticas` | analítica agencia × {nacionalidad, promoción} · ver sub-sección 4.1 | `src/pages/ColaboradoresEstadisticas.tsx` · hoy mock inline |
| `POST /api/collaborators/:id/approve` | aprobar solicitud pendiente | `src/pages/Colaboradores.tsx:179` |
| `POST /api/collaborators/:id/reject` | rechazar solicitud | `src/pages/Colaboradores.tsx:184` |
| `POST /api/collaborators/:id/pause` | pausar colaboración | `src/pages/Colaboradores.tsx:200` |
| `POST /api/collaborators/:id/resume` | reanudar colaboración | idem |
| `GET /api/agencias/:id/email-contacto` | email de contacto para invitaciones | `src/components/promotions/SharePromotionDialog.tsx:203` |

### Campos clave del `Agency`

**Identidad (vienen del Empresa de la agencia):**
- `logo` (circular) → `Empresa.logoUrl`
- `logoRect` (wordmark) → `Empresa.logoRectUrl`
- `cover` → `Empresa.coverUrl`
- `name`, `location`, `type`, `description`, `offices[]`
- `teamSize` → calculado (COUNT users de ese tenant)

**Métricas operativas (calculadas por backend):**
- `visitsCount`, `registrations`, `salesVolume`, `ventasCerradas`, `registrosAportados`
- `conversionRate` = `ventasCerradas / registrosAportados * 100`
- `ticketMedio` = `salesVolume / ventasCerradas`
- `lastActivityAt` = MAX(fecha de último registro/visita/login)

**Relación con el promotor (`Collaboration` entity):**
- `estadoColaboracion`: `"activa" | "contrato-pendiente" | "pausada"`
- `origen`: `"invited" | "marketplace"`
- `comisionMedia`
- `promotionsCollaborating[]` (ids de promociones donde esa agencia está activa)
- `solicitudPendiente`, `mensajeSolicitud`

**Contrato:**
- `contractSignedAt` (ISO date)
- `contractExpiresAt` (ISO date, null = sin caducidad)
- `contractDocUrl` (PDF firmado)

Estado computed en frontend vía `getContractStatus(a)`:
- `"vigente"` · `"por-expirar"` (≤30 días) · `"expirado"` · `"sin-contrato"`

**Google Places (público, refrescado semanalmente por cron):**
- `googlePlaceId`, `googleRating`, `googleRatingsTotal`, `googleFetchedAt`, `googleMapsUrl`
- Ver #8 para detalles de integración.

**Evaluación interna del promotor:**
- `ratingPromotor` (1-5, subjetivo, no mostrado públicamente)
- `incidencias: { duplicados, cancelaciones, reclamaciones }` (counts)

### 4.1 · Recomendaciones de agencias

Endpoint `GET /api/colaboradores/recomendaciones`. Consumidor:
`src/pages/Colaboradores.tsx` vía `useAgencyRecommendations()` en
`src/data/agencyRecommendations.ts`. Hoy mock inline (sustituir entero).

**Propósito**: motor que sugiere al promotor agencias fuera de su red
con las que podría colaborar. Explota señal cross-tenant agregada
(actividad en sus zonas, nacionalidades complementarias, aprobación
histórica con promotores similares).

**Query params**:

```
?limit=8              // nº máximo de recomendaciones (default 8)
?zone[]=city          // opcional · fuerza zonas (default: zonas de sus promociones)
?nationality[]=ISO2   // opcional · fuerza mercados de interés
```

**Respuesta**:

```ts
Array<{
  id:         string;
  name:       string;
  logo:       string;
  location:   string;
  type:       "Agency" | "Broker" | "Network";
  mercados:   string[];       // ISO2 · nacionalidades que atiende
  zonasActivas: string[];     // ciudades donde es activa
  signal: {
    aprobacionPct:    number; // 0-100 · con promotores similares
    conversionPct:    number; // 0-100
    promotoresActivos:number; // agregado · NUNCA identifica quiénes
  };
  googleRating?: number;
  razon:    string;           // frase principal generada por el motor
  razones:  string[];         // razones secundarias (pills)
}>
```

**Criterios de matching** (a implementar en backend):

1. **Exclusión**: agencias ya colaborando con el promotor o con
   invitación pendiente.
2. **Solape de zonas**: al menos 1 `zonasActivas` coincide con una
   ciudad/provincia donde el promotor tiene promoción activa.
3. **Scoring** (composite 0-100):
   - Solape de nacionalidades en los mercados del promotor (peso 0.35).
   - Aprobación con promotores similares (obra nueva en España) (0.25).
   - Conversión histórica normalizada (0.2).
   - SLA respuesta (0.1).
   - Actividad reciente (último 30d) (0.1).
4. **Ranking**: top N por score.

**Reglas de privacidad (vinculantes)**:

- **Nunca exponer identidad de otros promotores.** `promotoresActivos`
  es un contador agregado — no devuelve lista de empresas.
- **"Promotores similares"** se define como: misma categoría (obra
  nueva), solape geográfico ≥1 provincia, tamaño similar (±50% en nº
  unidades activas). El frontend nunca ve este grupo.
- **Auditoría**: cada invocación del motor queda logueada con `promotor_id
  + agencias_devueltas` para auditar filtraciones.

**Fase 2 · email digest semanal** (pendiente, no en este endpoint):
cron semanal que, si hay ≥3 nuevas recomendaciones con score alto para
un promotor, envía email "Byvaro te sugiere 3 agencias esta semana" con
link a `/colaboradores`. Infra: misma SMTP que invitaciones (ver §5).
Opt-out por defecto activo, desde `/ajustes/notificaciones`.

---

### 4.2 · Estadísticas de colaboradores

Endpoint `GET /api/colaboradores/estadisticas`. Consumidor:
`src/pages/ColaboradoresEstadisticas.tsx`. Hoy mock inline (sustituir
todas las matrices y `AGENCY_META`).

**Query params** (todos multi-valor opcionales):

```
?nationality[]=ISO2       // filtra a ciertas nacionalidades
?promocion[]=promotionId  // filtra a ciertas promociones
?agency[]=agencyId        // filtra a ciertas agencias
```

**Nota**: sin `from/to` de fechas. El frontend no muestra trend histórico
todavía — cuando exista histórico real, ampliar contrato con rango.

**Respuesta**:

```ts
{
  agencies: Array<{
    id: string;
    name: string;
    city: string;
    meta: {
      aprobacionPct: number;   // 0-100 · % registros aprobados por promotor
      duplicados:    number;   // count absoluto detectados por la IA
      respuestaHoras:number;   // SLA medio 1ª respuesta
    };
  }>;
  nations: Array<{ id: string; name: string; label: string }>;     // ISO2 + español
  promotions: Array<{ id: string; code: string; name: string; city: string }>;

  matrices: {
    nacionalidad: {
      REG: Record<AgencyId, Record<NationId, number>>;  // registros
      VIS: Record<AgencyId, Record<NationId, number>>;  // visitas realizadas
      EFF: Record<AgencyId, Record<NationId, number>>;  // conversion % (0-100)
    };
    promocion: {
      REG: Record<AgencyId, Record<PromoId, number>>;
      VIS: Record<AgencyId, Record<PromoId, number>>;
      EFF: Record<AgencyId, Record<PromoId, number>>;
    };
  };
}
```

**Cómo calcular cada métrica (backend)**:

| Campo | Cálculo |
|---|---|
| `REG` | `COUNT(lead) WHERE agency_id=A AND <eje>=X` |
| `VIS` | `COUNT(visit) WHERE agency_id=A AND lead.<eje>=X AND visit.status='done'` |
| `EFF` | `COUNT(sale) / COUNT(lead) * 100` por cada celda (A × eje) |
| `meta.aprobacionPct` | `COUNT(lead WHERE approval_status='approved') / COUNT(lead) * 100` |
| `meta.duplicados` | `COUNT(lead WHERE duplicate_detected_at IS NOT NULL)` |
| `meta.respuestaHoras` | `AVG(first_response_at - created_at)` en horas |

**Lo que NO pide el endpoint** (derivado en cliente):
- `KPIs` totales (suma de matrices visibles).
- `insights` automáticos (3 mini-cards por tab).
- `oportunidades` (lista numerada en tab Eficiencia).

Las tres se derivan con reglas deterministas en
`ColaboradoresEstadisticas.tsx` (`deriveInsights` y `deriveOportunidades`).
Cuando el dataset crezca y las reglas se compliquen, mover al servidor
con endpoint dedicado `GET .../estadisticas/insights`.

---

## 5 · Compartir promoción · invitaciones

**Flujo completo en**: `docs/screens/compartir-promocion.md`.

**Tipo**: `src/lib/invitaciones.ts:21` (interface `Invitacion`). Ampliado con campos de share: `promocionId`, `promocionNombre`, `duracionMeses`, `formaPago[]`, `datosRequeridos[]`.

**Storage actual**: localStorage (`byvaro-invitaciones`). Sincronización cross-tab por storage event + CustomEvent.

### Endpoints

| Endpoint | Body / Query | Respuesta / Efectos |
|---|---|---|
| `POST /api/promociones/:id/share/check` | `{ email }` | `{ exists: boolean, agencyId?: string, agency?: AgencyPublic }` — resuelve si el dominio del email coincide con una agencia ya en Byvaro |
| `POST /api/promociones/:id/invitaciones` | ver body abajo | `{ invitacionId, token, acceptUrl, asunto, html }` — backend envía el email |
| `GET /api/promociones/:id/invitaciones?estado=pendiente` | — | `Invitacion[]` |
| `POST /api/invitaciones/:id/revocar` | — | marca como `rechazada` |
| `POST /api/invitaciones/:id/reenviar` | — | extiende `expiraEn` 30 días |
| `DELETE /api/invitaciones/:id` | — | hard delete |
| `GET /api/invitaciones?token=X` | — | resolver invitación por token (para landing de aceptación) |
| `POST /api/invitaciones/:id/aceptar` | — | agency crea cuenta y acepta → `Collaboration` activa |
| `POST /api/promociones/:id/compartir/activar` | `{ comision, duracionMeses }` | sube `canShareWithAgencies=true` + condiciones default |

**Body de invitación:**
```ts
{
  email: string,
  agencyId?: string,              // si existe ya en sistema
  agencyName?: string,            // nombre a mostrar si se teclea
  mensajePersonalizado?: string,
  comisionOfrecida: number,
  idiomaEmail: "es"|"en"|"fr"|"de"|"pt"|"it",
  promocionId: string,
  promocionNombre: string,
  duracionMeses: number,
  formaPago: PagoTramo[],         // [{tramo, completado, colaborador}]
  datosRequeridos: string[],      // ["Nombre completo", "Las 4 últimas cifras del teléfono", "Nacionalidad"]
}
```

**Reglas de negocio:**
- El token de aceptación expira a los 30 días (`VALIDEZ_DIAS`).
- La suma de `formaPago[].colaborador` debe ser 100%.
- Rechazo inline de dominios públicos (`gmail.com`, `hotmail.com`, …). Lista completa en `SharePromotionDialog.tsx:PUBLIC_EMAIL_DOMAINS`.
- Match por dominio: `Empresa.domain === email.split("@")[1]`.
- Cuando la agencia está "activada" para compartir (`canShareWithAgencies=true`), el frontend permite enviar invitaciones. Si no, los botones se deshabilitan (gate definido en ADR-033).

**Cross-sell** (paso posterior a enviar una invitación):
- Frontend sugiere otras promociones del promotor donde esa agencia aún no colabora.
- Backend recibe múltiples `POST /api/promociones/:id/invitaciones` con mismas condiciones.

### Plantilla HTML del email

Función actual: `getInvitacionHtml(data)` en `src/lib/invitaciones.ts`. Devuelve `{ asunto, html }` responsive (media queries inline). Preview estático: `email-previews/invitacion-agencia.html`.

**En producción**, el backend puede:
1. **Usar la misma plantilla** (llamar a la función desde Node), o
2. **Implementar plantilla propia** en su template engine y solo consumir los datos.

Datos necesarios para el render: ver `InvitacionEmailData` en `invitaciones.ts:280`.

Campos clave pasados al template:
- `promotorNombre`, `promotorLogo`
- `nombreAgencia`, `emailAgencia`
- `promocionNombre`, `promocionFoto`, `precioDesde`, `precioHasta`, `entrega`, `unidadesDisponibles`, `unidadesTotales`
- `comisionOfrecida`, `duracionMeses`, `formaPago[]`, `datosRequeridos[]`
- `mensajePersonalizado`
- `acceptUrl`, `expiraEnDias`

### Vistas que dependen

- **Promociones listado** → botón "Compartir" en cada card (`Promociones.tsx:967`).
- **Ficha de promoción** → 4 puntos de entrada: dock derecho, KPI Agencias, tab Agencias (header, empty state, sidebar).
- **Colaboradores** → las invitaciones pendientes se inyectan como filas sintéticas en la lista (helper `invitacionToSyntheticAgency` en `invitaciones.ts`).

---

## 6 · Favoritos de agencias

**Tipo**: `Set<string>` de `Agency.id`.

**Storage actual**: localStorage (`byvaro-favoritos-agencias`).

**Hook**: `useFavoriteAgencies()` en `src/lib/favoriteAgencies.ts`.

### Endpoints

| Endpoint | Propósito |
|---|---|
| `GET /api/promotor/favoritos` | lista de IDs de agencias marcadas como favoritas |
| `POST /api/promotor/favoritos/:id` | marcar favorita |
| `DELETE /api/promotor/favoritos/:id` | desmarcar |

Consumidores: `Colaboradores.tsx`, `ColaboradoresV2.tsx`, `ColaboradoresV3.tsx`, `SharePromotionDialog.tsx`, `SendEmailDialog.tsx`, `PromotionAgenciesV2.tsx`.

---

## 7 · Leads, registros, ventas, contactos

### 7.1 · Leads (bandeja de entrada · sin cualificar)

**Tipo**: `src/data/leads.ts` → `Lead`. Consumidor: `src/pages/Leads.tsx`.

**Origen**: webhooks de portales (Idealista, Fotocasa, Habitaclia),
submits del microsite, WhatsApp Business, invitaciones de agencias,
walk-ins manuales en oficina.

| Endpoint | Propósito | Notas |
|---|---|---|
| `GET /api/leads?status=&source=&from=&to=` | lista paginada | `src/pages/Leads.tsx` |
| `GET /api/leads/:id` | detalle de un lead | futuro `/leads/:id` |
| `POST /api/leads` | alta (recibe webhook del portal o submit del microsite) | backend crea `status="new"` + lanza job de IA duplicados |
| `PATCH /api/leads/:id { status }` | cambiar estado (cualificar, contactar, descartar) | idem |
| `PATCH /api/leads/:id/assign { userId }` | asignar a comercial del equipo | actualiza `assignedTo` |
| `POST /api/leads/:id/convert` | promover lead → `Registro` (ver §7.2) | crea Registro, marca lead `status="converted"`, retorna `{ registroId }` |
| `POST /api/leads/:id/detect-duplicates` | re-ejecuta IA de duplicados (cron o on-demand) | actualiza `duplicateScore` y `duplicateOfContactId` |

**Shape del Lead** (resumen — ver tipo TS completo):

```ts
interface Lead {
  id, fullName, email, phone;
  nationality?: string;        // ISO2
  idioma?: string;             // ISO2
  source: "idealista" | "fotocasa" | "habitaclia"
        | "microsite" | "referral" | "agency"
        | "whatsapp" | "walkin" | "call";
  status: "new" | "qualified" | "contacted"
        | "duplicate" | "rejected" | "converted";
  interest: { promotionId?, promotionName?, tipologia?,
              dormitorios?, presupuestoMax?, zona? };
  createdAt: string;           // ISO
  firstResponseAt?: string;    // ISO · se graba al primer contacto del equipo
  assignedTo?: { name, email };
  duplicateScore?: number;     // 0-100 · null si aún no evaluado
  duplicateOfContactId?: string;
  tags?: string[];
  message?: string;
}
```

**Reglas de negocio**:

- Al crear un lead (`POST /api/leads`), el servidor encola un job de IA
  que calcula `duplicateScore` y `duplicateOfContactId`. Si el score
  ≥ 70, el lead pasa automáticamente a `status="duplicate"`.
- `firstResponseAt` se graba en la primera acción que dispare el
  equipo (email, llamada, WhatsApp). No se edita a mano.
- La conversión lead → registro es **irreversible**: el lead queda
  en `status="converted"` y el registro creado referencia al
  `leadId` original (traza de origen).
- SLA medio de respuesta = `AVG(firstResponseAt - createdAt)` por
  agencia — alimenta la métrica `respuestaHoras` de §4.2
  (estadísticas de colaboradores).

**TODO(backend)**: actualmente todos los `Lead[]` viven en el mock
`anejosByPromotion` alternativo (`src/data/leads.ts`). Al levantar
backend, sustituir el import por `useQuery(["leads", filters], ...)`.

### 7.2 · Registros (leads ya cualificados)

| Endpoint | TODO |
|---|---|
| `GET /api/records?status=&promotion=&agency=&origen=` | `src/pages/Registros.tsx:25` |
| `POST /api/records { origen, promotionId, agencyId?, cliente }` | `src/components/promotions/detail/ClientRegistrationDialog.tsx:260` |
| `POST /api/records/:id/approve` | `Registros.tsx:26` |
| `POST /api/records/:id/reject` | idem |
| `POST /api/records/:id/revert` (**grace period 5 min**) | `Registros.tsx:185`, `src/components/registros/GracePeriodBanner.tsx` |
| `POST /api/records/bulk-approve { ids:[] }` | `Registros.tsx:27` |
| `POST /api/records/bulk-reject { ids:[] }` | idem |
| `GET /api/records` paginado server-side | `src/data/records.ts:25` |

**Diferencia con Lead**: un Registro es un lead **ya cualificado** y
vinculado a un cliente + promoción concreta. Se crea desde el flujo
`POST /api/leads/:id/convert` o directamente por una agencia al
registrar un cliente sobre una promoción.

**Campos canónicos en `POST /api/records` (ver ADR-046):**

- `origen: "direct" | "collaborator"` — eje crítico que decide el flujo
  y los campos obligatorios.
- `agencyId?` — **obligatorio** si `origen === "collaborator"`,
  **prohibido** si `origen === "direct"` (backend debe rechazar 400).
- `cliente` — para `collaborator` solo se aceptan 3 campos (`nombre`,
  `nacionalidad`, `phoneLast4`); cualquier email/DNI/phone completo del
  payload debe ser ignorado silenciosamente o rechazado. Para `direct`
  se acepta el perfil completo.
- `decidedAt` — lo pone el backend al ejecutar `/approve` o `/reject`.
- El job de notificación a la agencia se **programa con 5 min de delay**
  y debe cancelarse si llega un `/revert` antes del disparo.

**Reglas de visibilidad (vista promotor):**

- Los registros con `origen === "direct"` **no se muestran** al
  destinatario agencia (su RLS debe filtrarlos por `agencyId`).
- Los campos adicionales del cliente (`email`, `telefono` completo,
  `dni`) de un `collaborator` solo son visibles al promotor tras
  aprobar — antes devuelve `null`/`masked` o simplemente se excluye.

### 7.3 · Ventas

| Endpoint | TODO |
|---|---|
| `GET /api/sales?promotionId=&status=&from=&to=` | `src/pages/Ventas.tsx:13`, `src/data/sales.ts:15` |
| `PATCH /api/sales/:id/transition { to, meta? }` | `Ventas.tsx:14`, `sales.ts:16` |

### 7.4 · Contactos

| Endpoint | TODO |
|---|---|
| `GET /api/contacts/:id` → `ContactDetail` | `src/components/contacts/contactDetailMock.ts:9` |
| `PATCH /api/contacts/:id { tags }` | `src/components/contacts/contactTagsStorage.ts:9` |
| `POST /api/contacts/bulk` | `src/pages/ajustes/contactos/importar.tsx:14` |
| `GET /api/contacts/:id/whatsapp/messages` | `src/components/contacts/whatsappMessagesMock.ts:11` |
| `UPDATE contacts SET source=target WHERE source=deleted` | `src/pages/ajustes/contactos/origenes.tsx:104,109` |
| Autogen `ref` del contacto | `src/components/contacts/types.ts:42` |

---


## 8 · Integraciones externas

### 8.1 · Google Places API (rating público)

**Usado por**: empresa del promotor (`GoogleRatingCard`) y cada agencia.

**Flujo:**

1. Usuario pega URL de Google Maps en su perfil → `POST /api/empresa/google-place { mapsUrl }`.
2. Backend extrae `place_id` vía Places **Find Place / Text Search**.
3. Primer fetch con Places **Details (Atmosphere data)** → rating, ratingsTotal, photos, opening_hours.
4. **Cron semanal** refresca cada `place_id` (Places ToS: ≤30 días de cache).
5. Al refrescar actualiza `googleRating`, `googleRatingsTotal`, `googleFetchedAt`.

**Coste**:
- $200/mes de free tier Google Maps Platform.
- Places Details (Atmosphere) = $0.005/call. Con 500 agencias ≈ $10/mes.

**Restricciones ToS** (obligatorias):
- Refresco al menos cada 30 días (no cachear más).
- Atribución visible al mostrar rating: "Basado en reseñas de Google".
- No modificar el rating ni las reseñas.
- Link a la ficha pública de Maps cuando se muestre el rating.

**UI que ya cumple ToS**: `GoogleRatingBadge` en `ColaboradoresV3.tsx`, `GoogleRatingCard` en `empresa/`.

### 8.2 · WhatsApp Business (Baileys / Meta OAuth)

Ver `src/pages/ajustes/whatsapp/numero.tsx:10` + `src/lib/whatsappStorage.ts:10`.

Endpoints esperados:
- `POST /api/whatsapp/connect { mode: "oauth" | "qr" }` → URL OAuth o stream de QR.
- `POST /api/whatsapp/disconnect`.
- `GET /api/whatsapp/status` → `{ connected, number, lastSeen }`.
- `POST /api/contacts/:id/whatsapp/messages` → envío.

Generación de QR real va contra Baileys o WPPConnect (`ContactWhatsAppTab.tsx:284`).

### 8.3 · Email transaccional

Plantillas HTML actuales que el backend debe renderizar o reemplazar:

- `getInvitacionHtml()` — invitaciones a agencia (detallado en #5).
- `getEmailPreview()` — versión texto plano (legacy, 6 idiomas) — `invitaciones.ts:137`.
- `src/components/email/emailTemplates.ts` — plantillas del Compose (last-unit, new-launch, new-availability, blank).

Endpoint:
- `POST /api/emails/send { to, subject, html, templateId?, variables? }` → cola SendGrid/Resend/Postmark/SMTP.
- Webhook de entrega → `GmailInterface.tsx:81` mock.

### 8.4 · Storage (logos, covers, PDFs)

Hoy: los uploads son `data:` URLs en localStorage (`ImageCropModal.tsx`).

En prod: S3 / Cloudflare R2 / Vercel Blob.

Endpoints:
- `POST /api/upload { file, kind: "logo" | "cover" | "contract" | "unit-media" }` → devuelve `{ url, size, mime }`.

### 8.5 · Google Drive (carpetas de unidad)

`UnitSimpleEditDialog.tsx:171`: `POST /api/promociones/:id/units/:ref/drive-folder` crea carpeta Drive con el `ref` de la unidad como nombre.

### 8.6 · Microsites

`src/pages/Microsites.tsx` + `src/data/microsites.ts`.

- `GET /api/v1/microsites` (por `companyId`).
- `PATCH /api/v1/microsites/:id` (patch).
- `PATCH /api/v1/microsites/:id/theme`.
- `POST /api/v1/microsites/:id/domain` (custom domain).

---

## 9 · Crons / jobs periódicos

| Job | Frecuencia | Propósito |
|---|---|---|
| `refresh-google-places` | semanal | actualiza rating/reseñas de cada `googlePlaceId` |
| `expire-invitations` | diario | marca invitaciones pendientes con `expiraEn < now()` como `caducada` |
| `expire-contracts` | diario | notifica a promotor 30/7/0 días antes de `contractExpiresAt`; pasa a `expirado` al vencer |
| `recompute-agency-metrics` | horario / diario | calcula `conversionRate`, `ticketMedio`, `lastActivityAt` |
| `drafts-cleanup` | mensual | borra borradores abandonados >6 meses |

---

## 10 · Estándares del contrato

### Nomenclatura
- Rutas REST en **kebab-case** plural: `/api/promociones`, `/api/colaboradores`, `/api/invitaciones`.
- IDs: string, formato libre pero único (`dev-1`, `ag-3`, `inv-xxx`).

### Formatos
- Fechas ISO 8601 (`"2026-04-22"` o `"2026-04-22T14:30:00Z"`).
- Dinero: número entero en céntimos, o float EUR (consistente por endpoint). Actualmente frontend usa EUR float (`Intl.NumberFormat`).
- Porcentajes: número 0-100 (no 0-1).

### Errores
- `400` validation con `{ error, field?, message }`.
- `403` cuando falta permiso (rol insuficiente).
- `409` conflict en invariantes (p.ej. `canShareWithAgencies=false` al intentar invitar).
- `422` para fallos de dominio específicos (`LOCKED_CONTRACT`, `PROMOTION_NOT_PUBLISHED`).

### Paginación
- Query `?page=1&pageSize=20`.
- Respuesta `{ data: [], page, pageSize, total }`.

### Permisos
Ya documentado conceptualmente en `src/lib/permissions.ts:8`. Cuando exista backend:
- Middleware por endpoint que verifica `req.user.role` vs `required_permissions`.
- Owner / Admin / Manager / Agent / Viewer.

---

## 11 · Checklist para nuevas features

Cuando se añade una feature en frontend que requiera backend:

- [ ] Añadir bloque `TODO(backend): ...` en los archivos que tocan storage local o mock data.
- [ ] Registrar los nuevos endpoints en este documento bajo la sección adecuada.
- [ ] Si la feature introduce un modelo nuevo, describirlo en `docs/data-model.md`.
- [ ] Si altera una relación entre entidades (p.ej. una tabla de join como `Collaboration`), documentar aquí en la sección #0.
- [ ] Si añade integración externa, registrarla en #8.
- [ ] Si requiere job periódico, añadir a la tabla de #9.
- [ ] Si cambia el contrato UI↔API de una feature existente, actualizar `docs/api-contract.md` Y este doc.
- [ ] Añadir ADR en `DECISIONS.md` para decisiones no triviales.

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-04-22 | Documento creado — consolida todos los `TODO(backend)` existentes. |
