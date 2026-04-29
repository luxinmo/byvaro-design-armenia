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

## 1.5.2 · Auditoría dual-role · checklist anti-fugas (vinculante backend)

> Esta sección es **el mapa que el backend tiene que aplicar** para
> que la separación de datos entre promotor y agencia colaboradora sea
> hermética. La UI ya filtra · pero la UI nunca es la única defensa.
> Cada bullet aquí debe traducirse a una RLS policy o un check en
> middleware.

### Tabla maestra · qué ve cada rol

| Pantalla | Promotor admin | Promotor agente | Agencia (admin/agente) |
|---|---|---|---|
| `/inicio` | dashboard global | dashboard scoped a su ownership | home agencia simplificado |
| `/actividad` | KPIs financieros + rankings | ❌ (sin permission `activity.dashboard.view`) | ❌ ruta protegida `<PromotorOnly>` |
| `/promociones` | todas las del tenant | todas las del tenant (read filtrado por viewOwn) | solo donde colabora · filtro por `Collaboration.estadoColaboracion = 'activa'` |
| `/promociones/:id` (Overview) | datos completos | datos completos | datos REDACTED · sin `commission`, sin `comerciales[]`, sin `agencias[]`, sin `marketingProhibitions` (gating UI ya existe, falta backend) |
| `/promociones/:id` (tab Agencies) | listado completo | listado completo | ❌ tab oculto |
| `/promociones/:id` (tab Comisiones) | datos completos | datos completos | redacted (su % comisión solo, no las del resto) |
| `/registros` | todos del tenant | filtrado por `assigned_to.includes(user.id)` (TODO) | solo `agency_id = me.agency_id` |
| `/registros/:id` (deep-link) | OK si pertenece al tenant | OK si es suyo | rechazo 403 si `agency_id !== me.agency_id` |
| `/ventas` | todas | filtrado viewOwn | solo donde la agencia es interviniente |
| `/contactos` | todos | viewOwn | **NUNCA** ve los del promotor · cada tenant tiene los suyos |
| `/calendario` | todo el equipo | viewOwn (eventos donde es asignado) | solo eventos con `assignee_user_id = me.id` o `agency_id = me.agency_id` |
| `/colaboradores` (listado · panel · estadísticas · ficha · contratos · historial) | todo | todo | ❌ rutas con `<PromotorOnly>` |
| `/oportunidades` (Leads) | todo | viewOwn | ❌ ruta promotor-only |
| `/microsites` | edición | edición | ❌ ruta promotor-only |
| `/emails` | bandeja del workspace | sus cuentas | ❌ ruta promotor-only · agencia tiene su propio cliente cuando exista |
| `/empresa` | edita su empresa | edita su empresa | edita SU agencia (visitor mode con tenantId distinto) |
| `/equipo` | gestiona equipo | ve equipo | ❌ ruta promotor-only |
| `/contratos` | todos cross-empresa | gateado por permission | ❌ ruta promotor-only |
| `/sugerencias` | todo | todo | ❌ ruta promotor-only |
| `/ajustes/*` | todo el workspace | parcial | mismo árbol pero scoped al tenant agencia |

### Reglas RLS canónicas (PostgreSQL)

```sql
-- Multi-tenant primero · cada tabla lleva tenant_id
CREATE POLICY tenant_isolation ON <tabla>
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Promociones · scope por colaboración para agencias
CREATE POLICY promociones_agency_view ON promociones FOR SELECT USING (
  current_setting('app.account_type') = 'developer'
  OR EXISTS (
    SELECT 1 FROM collaborations c
    WHERE c.promotion_id = promociones.id
      AND c.agency_id = current_setting('app.tenant_id')::uuid
      AND c.estado = 'activa'
  )
);

-- Calendario · agencia solo ve sus propios eventos
CREATE POLICY calendar_agency_view ON calendar_events FOR SELECT USING (
  current_setting('app.account_type') = 'developer'
    AND tenant_id = current_setting('app.tenant_id')::uuid
  OR (
    current_setting('app.account_type') = 'agency'
    AND (
      assignee_user_id = current_setting('app.user_id')::uuid
      OR agency_id = current_setting('app.tenant_id')::uuid
    )
  )
);

-- Registros · agencia ve solo los que aportó ella
CREATE POLICY registros_agency_view ON registros FOR SELECT USING (
  current_setting('app.account_type') = 'developer'
    AND EXISTS (SELECT 1 FROM promociones p WHERE p.id = registros.promotion_id AND p.tenant_id = current_setting('app.tenant_id')::uuid)
  OR (
    current_setting('app.account_type') = 'agency'
    AND agency_id = current_setting('app.tenant_id')::uuid
  )
);

-- Contactos · NUNCA cross-tenant
CREATE POLICY contactos_strict_tenant ON contactos FOR ALL USING (
  tenant_id = current_setting('app.tenant_id')::uuid
);
```

### Endpoints redacted · campos que NO viajan al cliente cuando rol = agency

```ts
// GET /api/promociones/:id  ·  resp con shape Promotion
// Si JWT.accountType === "agency" Y la agencia NO está activa en esa promo,
//   → 404 Not Found (no se filtra · se rechaza entero).
// Si la agencia está activa, redactar:
omitForAgency = [
  "commission",                  // % de comisión del promotor (puede ser distinto al pactado con esta agencia)
  "collaboration.comisionInternacional",
  "collaboration.comisionNacional",
  "collaboration.diferenciarComisiones",
  "collaboration.hitosComision",  // se sustituye por los de SU contrato
  "comerciales",                  // agentes del promotor
  "puntosDeVentaIds",             // refs a `byvaro-oficinas` · NO inline data
                                  // (ver docs/backend/domains/empresa-stats-and-offices.md)
                                  // El campo legacy `puntosDeVenta` (inline) NO existe ya.
  "agencias",                     // listado de agencias rivales en la misma promo
  "marketingProhibitions",        // SE ENVIA · necesita conocerlo (regla a respetar)
  "missingSteps",                 // info interna del promotor
];

// El backend devuelve además los campos PROPIOS de SU contrato:
addForAgency = {
  myCommission: number,            // su % pactado
  myMilestones: HitoComision[],    // sus hitos de pago
  myDocuments: [...],              // contratos firmados con ella
}
```

### Validación server-side · checks de middleware

1. **Toda ruta `/api/developer/*`** rechaza con 403 si `JWT.accountType !== "developer"`.
2. **Toda ruta `/api/agency/*`** rechaza con 403 si `JWT.accountType !== "agency"`.
3. **Rutas compartidas**: el handler aplica RLS · NUNCA confía en query params para scope.
4. **Deep-links** (`/api/X/:id`): validar que `:id` pertenece al scope antes de devolver el shape · si no, 404 (no 403, para no leak existencia).

### Hooks/utilidades del frontend ya cableados

- `useCurrentUser()` → `{ id, accountType, agencyId, ... }` desde `sessionStorage` (mock) · futuro: del JWT decodificado.
- `<PromotorOnly>` (`src/App.tsx:95`) · wrapper de ruta · redirige a `/inicio` si agencia.
- `viewAsCollaborator` · pattern usado en pantallas mixtas para esconder controles del promotor.
- `useHasPermission(key)` · gates de feature dentro del rol.
- Filtros locales canónicos:
  - `Calendario.tsx:72` · agencia solo ve sus eventos
  - `Registros.tsx:143` · agencia solo ve sus registros
  - `Ventas.tsx:122` · agencia solo ve sus ventas
  - `Contactos.tsx:119` · agencia solo ve sus contactos
  - `Promociones.tsx` · `useFilteredPromotions()` por rol

### Checklist al añadir una pantalla nueva

- [ ] ¿La pantalla muestra datos de OTRO tenant en algún caso?
- [ ] ¿Está la ruta detrás de `<PromotorOnly>` o tiene filtro `accountType` interno?
- [ ] ¿Cada llamada al backend especifica el scope esperado?
- [ ] ¿La RLS de las tablas que toca contempla este nuevo flujo?
- [ ] ¿La sección de la tabla maestra de arriba se ha actualizado con el nuevo screen?

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

## 1.10 · Dashboard de actividad (`/actividad` · admin-only)

**Pantalla**: `src/pages/Actividad.tsx` (1564 líneas). Se consume
cuando el admin entra a `/actividad`. Gate por
`useHasPermission("activity.dashboard.view")` — ver
`docs/permissions.md §Dashboard de actividad`. Agentes no ven el
link en sidebar ni la ruta responde con datos.

**Regla dura**: toda KPI que hable de "ventas" debe declarar en UI si
cuenta **cerradas** (`contratada ∨ escriturada`) o **terminadas**
(solo `escriturada`). Es la regla de oro "venta cerrada vs
terminada" (CLAUDE.md). El backend aplica el mismo filtrado.

### Endpoint único

```
GET /api/activity/dashboard
  ?window=7d|30d|90d|year|custom
  &from=YYYY-MM-DD               (solo custom)
  &to=YYYY-MM-DD                 (solo custom)
  &userId=<memberId>             (opcional · filtra a 1 miembro)
```

### Shape de respuesta

```ts
{
  window: { from: string; to: string };   // ISO dates del rango resuelto
  previous: { from: string; to: string }; // rango previo para deltas

  kpis: {
    pipelineCierreEur: number;       // reservadas vivas (stock €)
    pipelineCobroEur: number;        // contratadas vivas (stock €)
    ventasCerradasCount: number;     // sales con fechaContrato en rango
    ventasCerradasEur: number;
    ventasTerminadasCount: number;   // sales con fechaEscritura en rango
    ventasTerminadasEur: number;
    visitas: number;                 // calendar events type=visit + done
    avgResponseMin: number | null;   // ms entre registro.fecha y .decidedAt
    conversionPct: number;           // visitas / nuevosLeads · 0-100
    nuevosLeads: number;             // registros con .fecha en rango
  };
  kpisPrevious: typeof kpis;         // MISMO shape · rango previo para delta

  funnel: {
    leads: number;
    aprobados: number;
    visitas: number;
    reservas: number;
    cerradas: number;                // contratada + escriturada
    terminadas: number;              // solo escriturada
  };

  velocity: {
    leadToApproved: number | null;   // días medios
    approvedToVisit: number | null;
    visitToReserva: number | null;
    reservaToContrato: number | null;
    contratoToEscritura: number | null;
  };

  mix: {
    byOrigin: Array<{ key: "direct" | "collaborator"; count: number; pct: number }>;
    byAgencia: Array<{ agencyId: string; name: string; count: number }>;
    byPromocion: Array<{ promotionId: string; name: string; count: number }>;
  };

  heatmap: number[][];               // 7×24 · [dow][hour] · eventos del rango

  team: {
    members: Array<{
      userId: string;
      name: string;
      avatarUrl?: string;
      score: number;                 // 0-100 · composite health
      signals: {
        leadsDecididos: number;
        visitasCumplidas: number;
        avgResponseMin: number | null;
        conversionPct: number;
        lastActivityAt: string | null;
      };
    }>;
  };

  rankings: {
    topAgenciasByRegistros: Array<{ agencyId: string; name: string; count: number }>;
    topAgenciasByVentas: Array<{ agencyId: string; name: string; count: number; volumenEur: number }>;
    topMiembrosByClosed: Array<{ userId: string; name: string; count: number; volumenEur: number }>;
  };
}
```

### Reglas server-side (vinculantes)

1. **Gate**: el handler rechaza con 403 si el JWT no trae
   `activity.dashboard.view` (no depender solo de la UI).
2. **Ventas cerradas** = `status IN ('contratada', 'escriturada')` ·
   nunca solo `escriturada`.
3. **Ventas terminadas** = `status = 'escriturada'` exclusivo.
4. **Rango previo** = mismo tamaño que `window` justo antes (ej.
   ventana 30d → 30 días anteriores). Para `custom`, el backend
   calcula `to_previous = from - 1 día; from_previous = to_previous
   - (to - from)`.
5. **`userId` filter**: cuando se filtra por miembro, TODOS los
   arrays (`funnel`, `mix`, `rankings.topMiembrosByClosed`,
   `heatmap`) se recalculan contra ese miembro. El backend NO
   devuelve otras personas del equipo.
6. **Caché**: resultado cacheable 60 segundos por `(tenantId,
   window, userId)`. Los movimientos de negocio son "near-real-time"
   pero no hace falta sub-minuto.

### Mock actual

El frontend calcula todo client-side desde:
- `src/data/records.ts` (registros)
- `src/data/sales.ts` (ventas)
- `src/lib/calendarStorage.ts` (visitas)
- `src/lib/team.ts` (miembros)
- `src/data/agencies.ts` (agencias)

Al conectar backend, el computo server-side debe coincidir con las
fórmulas de `computeKpis()`, `computeFunnel()`, `computeVelocity()`,
`computeHeatmap()`, `computeTeamHealth()` del archivo `Actividad.tsx`.
Idealmente: tests E2E que comparen `mock vs backend` para una ventana
fija antes de quitar los mocks.

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
| `GET /api/workspace/departments` | lista de departamentos del workspace (array de strings). Mock hoy: `src/lib/departmentsStorage.ts` + UI en `/ajustes/empresa/departamentos`. |
| `POST /api/workspace/departments { name }` | crear departamento (unique case-insensitive) |
| `PATCH /api/workspace/departments/:id { name }` | renombrar (propaga a miembros con ese depto) |
| `DELETE /api/workspace/departments/:id` | eliminar de la lista (miembros conservan su valor actual hasta edición manual) |

### Google Places API (rating público)

Ver detalle en sección **#8 · Integraciones externas**.

Endpoints dedicados:
- `POST /api/empresa/google-place { mapsUrl }` → resuelve `place_id` y dispara primer fetch.
- Cron interno semanal que llama a Places Details y actualiza `googleRating`, `googleRatingsTotal`, `googleFetchedAt`.

TODOs: `src/components/empresa/GoogleRatingCard.tsx:16`.

---

## 3 · Promociones

**Tipo**: `src/data/promotions.ts` (`Promotion`) + `src/data/developerPromotions.ts` (`DevPromotion` extiende `Promotion`).

### 3.0 · Aislamiento multi-tenant · `ownerOrganizationId`

**REGLA BACKEND** (consensuada con producto · 2026-04-29):

Toda promoción tiene un único dueño identificado por
`Promotion.ownerOrganizationId` (FK a `organizations.id`). Es la
columna de aislamiento multi-tenant. **TODA query de promociones
DEBE filtrar por este campo** · sin él hay fuga de datos
cross-tenant.

```sql
ALTER TABLE promotions
  ADD COLUMN owner_organization_id uuid NOT NULL
  REFERENCES organizations(id);

CREATE INDEX idx_promotions_owner ON promotions(owner_organization_id);

-- Política RLS de aislamiento
CREATE POLICY promotions_isolation ON promotions
  USING (owner_organization_id = current_setting('app.current_org')::uuid);
```

**Endpoint público para portfolios cross-tenant** (cuando una
agencia visita la ficha de un promotor):

```
GET /api/promotor/:id/portfolio?status=active

200 OK
{
  promociones: Promotion[]   -- todas con owner_organization_id = :id
}
```

El endpoint NO requiere ser dueño · es público dentro de Byvaro
porque el portfolio es información comercial. Pero el filtro por
`owner_organization_id = :id` es obligatorio para garantizar que
no se devuelvan promociones de otros workspaces.

**Frontend mock single-tenant**:

- Helper canónico `getPromotionsByOwner(orgId)` en
  `src/lib/promotionsByOwner.ts` · única forma legítima de
  resolver promociones per-tenant en componentes que renderizan
  fichas o listados scoped.
- Mock data:
  - `"developer-default"` → `[...promotions, ...developerOnlyPromotions]`
    (ambos arrays tienen `ownerOrganizationId: "developer-default"`
    explícito en cada entry).
  - `"prom-1"`, `"prom-2"`, `"prom-3"`, `"prom-4"` →
    `EXTERNAL_PROMOTOR_PORTFOLIO` con su `ownerOrganizationId`
    correspondiente.
- Consumers que YA usan el helper:
  - `src/components/empresa/PortfolioShowcase.tsx` · ficha pública.
- Consumers legacy que aún leen `promotions` directamente (válido
  porque su scope es el workspace logueado, NO per-tenant):
  - `src/pages/Promociones.tsx` · listado del workspace propio.
  - `src/components/AppSidebar.tsx` · contador de promos.
  - calendar / registros / ResumenTab · entidades del workspace.

**Migración a backend**:
  1. Reemplazar `getPromotionsByOwner(orgId)` por fetch a
     `/api/promotor/:id/portfolio`.
  2. Retirar el fallback `?? "developer-default"` en lecturas del
     campo · backend escribe en TODAS las filas.
  3. Borrar `EXTERNAL_PROMOTOR_PORTFOLIO` mock.
  4. Auditar consumers legacy y cambiar a fetch scoped al JWT
     organization_id.

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
| `POST /api/collaborators/:id/approve` | aprobar solicitud pendiente **agency-level** (alta marketplace) | `src/pages/Colaboradores.tsx:179` |
| `POST /api/collaborators/:id/reject` | rechazar solicitud agency-level | `src/pages/Colaboradores.tsx:184` |
| `POST /api/colaboraciones-solicitadas` | crear solicitud **por promoción** (lado agencia) | doc canónico: `docs/backend/domains/collaboration-requests.md` |
| `GET /api/me/colaboraciones-solicitadas?status=...` | lista de solicitudes por promoción del agencia logueada | idem |
| `GET /api/colaboraciones-solicitadas?status=...` | lista de solicitudes por promoción dirigidas a las promos del promotor | idem |
| `POST /api/colaboraciones-solicitadas/:id/accept` | aceptar (atómico con invitación) | requiere `collaboration.requests.manage` |
| `POST /api/colaboraciones-solicitadas/:id/reject` | descartar (silencioso para la agencia) | idem |
| `POST /api/colaboraciones-solicitadas/:id/restore` | recuperar de descartada → pendiente | idem |
| `POST /api/collaborators/:id/pause` | pausar colaboración | `src/pages/Colaboradores.tsx:200` |
| `POST /api/collaborators/:id/resume` | reanudar colaboración | idem |
| `GET /api/agencias/:id/email-contacto` | email de contacto para invitaciones | `src/components/promotions/SharePromotionDialog.tsx:203` |

### 4.0 · Panel operativo del colaborador (ADR-057)

Endpoints que consumen los 9 tabs de `/colaboradores/:id/panel`
(`src/pages/ColaboracionPanel.tsx`). Todos tras gate
`collaboration.panel.view` (ver `docs/permissions.md §Colaboradores`).
El backend **debe** devolver 403 si el caller no tiene la key, no
depender solo del hide-on-UI.

| Tab | Endpoint | Permiso | Fuente en UI |
|---|---|---|---|
| Resumen | `GET /api/agencias/:id/panel/summary` | `collaboration.panel.view` | `ResumenTab.tsx` |
| Datos | `GET /api/empresas/:id/public` | `collaboration.panel.view` | `DatosTab.tsx` vía `useEmpresa(id)` |
| Visitas | `GET /api/agencias/:id/visits?status=...` | `collaboration.panel.view` | `VisitasTab.tsx` |
| Registros | `GET /api/agencias/:id/registrations?status=...` | `collaboration.panel.view` | `RegistrosTab.tsx` |
| Ventas | `GET /api/agencias/:id/sales?stage=...` | `collaboration.panel.view` | `VentasTab.tsx` |
| Documentación · contratos | `GET /api/agencias/:id/contracts` | `collaboration.contracts.view` | `DocumentacionTab.tsx` bloque 1 |
| Documentación · requests | `GET /api/agencias/:id/doc-requests` | `collaboration.documents.manage` | `DocumentacionTab.tsx` bloque 2 |
| Pagos | `GET /api/agencias/:id/payments` | `collaboration.payments.view` | `PagosTab.tsx` |
| Facturas | `GET /api/agencias/:id/invoices` | `collaboration.payments.view` | `FacturasTab.tsx` |
| Historial | `GET /api/agencias/:id/company-events` | `collaboration.panel.view` · admin | `HistorialTab.tsx` |

#### Resumen · shape

```ts
GET /api/agencias/:id/panel/summary → {
  status: "activa" | "contrato-pendiente" | "pausada";
  enColaboracion: Array<{
    promotionId: string;
    promotionName: string;
    coverUrl?: string;
    contratoEnVigor: boolean;   // true si hay contrato firmado con
                                // este promotionId en scopePromotionIds
    docsPendientes: number;     // doc-requests abiertos
    registros30d: number;
    visitasProximas: number;
  }>;
  sinCompartir: Array<{         // promos activas + canShareWithAgencies
    promotionId: string;
    promotionName: string;
    coverUrl?: string;
  }>;
  proximasVisitas: Array<{
    visitId: string;
    clientName: string;
    promotionName: string;
    scheduledAt: string;
    agentName: string;
  }>;
  incidencias: { duplicados: number; cancelaciones: number; reclamaciones: number };
}
```

#### Contratos per-promoción (Firmafy-style)

`POST /api/contracts` — subir PDF + enviar a firmar.

```ts
{
  agencyId: string;
  scopePromotionIds: string[];   // OBLIGATORIO · contratos per-promoción
  signers: Array<{ email: string; name: string; role: "promotor"|"agencia" }>;
  file: File;                    // PDF · multipart
  expiresAt?: string;            // caducidad del contrato firmado
}
→ { contractId: string; firmafySessionUrl: string }
```

`PATCH /api/contracts/:id` — actualizar scope, marcar firmado
manualmente, revocar. Ver `docs/backend/integrations/firmafy.md` para
el webhook de confirmación de firma.

**Regla crítica**: al firmarse, emitir `CollaborationContractSigned`
+ marcar `contratoEnVigor: true` en cada `promotionId` de
`scopePromotionIds`. La UI lee ese flag para pintar el badge
"Contrato en vigor" en `AgenciasTabStats` y `ResumenTab`.

#### Pagos · mutaciones

```
POST /api/agencias/:id/payments/:paymentId/mark-paid
POST /api/agencias/:id/payments/:paymentId/hold
POST /api/agencias/:id/payments/:paymentId/release
POST /api/agencias/:id/payments/:paymentId/cancel
POST /api/agencias/:id/payments/:paymentId/proof    (multipart)
```

Todas requieren `collaboration.payments.manage` y emiten
`recordCompanyEvent({ type: "payment.*" })` para el historial.

#### Doc requests

```
POST /api/agencias/:id/doc-requests
  → { type: "invoice"|"iban"|"tax-cert"|"quarterly"|"insurance"|"custom", title, dueDate? }
POST /api/agencias/:id/doc-requests/:rid/approve
POST /api/agencias/:id/doc-requests/:rid/reject   { reason }
```

La agencia sube los PDFs desde su workspace (fase futura); el promotor
aprueba/rechaza desde aquí.

#### Invitaciones (Fase 11)

```
POST /api/invitations                     { promotionId, agencyId, message? }
POST /api/invitations/:id/accept          → genera Collaboration activa
POST /api/invitations/:id/reject          { reason? }
GET  /api/invitations?scope=agency|promotor
```

**Gate server-side obligatorio**: rechazar (`422`) si la promo no es
`status === "active" && canShareWithAgencies !== false`. El frontend
ya filtra pero el backend **debe** replicar la regla — es la única
defensa contra datos corruptos que el self-heal del cliente no puede
resolver.

Al aceptar, emitir `CollaborationStarted` y registrar entrada en el
historial cross-empresa (`recordCompanyEvent` del lado promotor y del
lado agencia cuando exista `workspaceId` de agencia).

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

### 4.2.1 · Métricas de la card de agencia (Inmobiliarias)

Las cards del listado `/colaboradores` (lado promotor) y `/promotores`
(lado agencia · simétrico) muestran 5 métricas operativas con
**semántica fija** consensuada con producto (2026-04-29). El backend
debe devolver estos contadores ya computados para evitar N consultas
desde el cliente.

**Endpoint propuesto:**

```
GET /api/agencias/:id/card-metrics

200 OK
{
  visitasRealizadas:    number,   // ver §a
  registrosAprobados:   number,   // ver §b
  ventasIniciadas:      number,   // ver §c
  conversion:           number,   // ver §d  (0-100, entero)
  unidadesCompartidas:  number,   // ver §e
}
```

Versión bulk para listados:

```
POST /api/agencias/card-metrics
Body: { agencyIds: string[] }

200 OK
{ [agencyId]: AgencyCardMetrics }
```

**Definiciones (§a-§e):**

§a · **Visitas realizadas** · `count` de visitas (`calendar_events.type =
'visit'`) atribuibles a la agencia donde:
  - `status = 'done'` AND
  - `evaluation.outcome = 'completed'`
  - Atribución vía `registroId → registro.agency_id`. Si más adelante
    `lead.agency_id` se persiste, también vía `leadId → lead.agency_id`.

§b · **Registros aprobados** · `count(*) FROM registros WHERE agency_id
= :id AND estado = 'aprobado'`. Solo aprobados · pendientes /
rechazados / caducados / duplicados NO cuentan.

§c · **Ventas iniciadas** · `count(*) FROM sales WHERE agency_id = :id
AND estado <> 'caida'`. Incluye `reservada`, `contratada` y
`escriturada`. NO solo cerradas (regla "venta cerrada" requiere
contrato firmado y eso se mide en otra parte).

§d · **Conversión** · `(ventasIniciadas / registrosAprobados) * 100`,
redondeado a entero. Si `registrosAprobados = 0`, devolver `0` (no
NaN, no null). El cliente pinta este valor en verde si `>= 15`.

§e · **Unidades compartidas** · suma de `availableUnits` de las
promociones donde la agencia colabora:
```sql
SELECT COALESCE(SUM(p.available_units), 0)
FROM promotion_collaborations pc
JOIN promotions p ON p.id = pc.promotion_id
WHERE pc.agency_id = :id
  AND pc.status = 'active'  -- pausada/anulada NO cuentan
```
Importante: suma `availableUnits` (lo disponible HOY), NO `totalUnits`.
Si el promotor pausa la colaboración por promoción
(`promotion_collab_status.status = 'pausada'`), las unidades de esa
promo siguen contando · solo se excluyen las ANULADAS (regla "datos
históricos NUNCA se borran" pero "compartido" se entiende como
relación viva con capacidad de operar).

**Frontend mock actual** · `src/lib/agencyMetrics.ts` deriva las 5
métricas de los seeds globales (`registros`, `sales`, `calendarEvents`,
`promotions`, `developerOnlyPromotions`). Cuando se conecte el backend,
sustituir el helper por un fetch al endpoint `/card-metrics`. El
shape `AgencyCardMetrics` ya es el contrato.

**Caching** · razonable cachear ~30s por agency. Las métricas cambian
con cada nueva visita evaluada / registro aprobado / venta iniciada,
pero el listado las consume en bulk · no hace falta tiempo real.

### 4.2.2 · Invitaciones · regla de visibilidad en el listado

**REGLA BYVARO** (consensuada con producto · 2026-04-29):

1. Cuando se invita a una agencia que **NO está en el sistema** (no
   tiene workspace en Byvaro · solo conocemos su email), la invitación
   **NO** aparece en el listado `/colaboradores`. La invitación vive
   en su propia tabla pero el listado de agencias solo muestra
   workspaces reales · ese email no es un colaborador todavía.

2. Cuando se invita a una agencia que **SÍ está en el sistema**
   (existe `agency` con `agencyId` referenciable), la card de esa
   agencia aparece en el listado y, si la invitación está en estado
   `pendiente`, **se decora con el chip "Invitada DD/MM/YYYY"** en
   lugar del chip de contrato. Significa: la agencia ha recibido la
   invitación pero todavía no ha añadido la promoción a su cartera.

**Modelo backend:**

```sql
CREATE TABLE invitations (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL,                       -- promotor que invita
  agency_id       uuid REFERENCES organizations(id),   -- NULL si email externo
  email           text NOT NULL,                       -- email destino
  status          text NOT NULL CHECK (status IN
                  ('pendiente','aceptada','rechazada','caducada')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  promotion_id    uuid REFERENCES promotions(id),
  ...
);
```

**Endpoint que sirve el listado:**

```
GET /api/agencias

200 OK
{
  agencies: Agency[],
  invitedAtByAgency: { [agency_id]: ISO_DATE },  -- regla §2
}
```

`invitedAtByAgency` SOLO incluye entradas para invitaciones donde
`agency_id IS NOT NULL` y `status = 'pendiente'`. Si hay varias
invitaciones pendientes para la misma agencia, devuelve la **más
reciente** (`MAX(invited_at)`).

Las invitaciones a emails externos (sin `agency_id`) NO contaminan el
listado, pero siguen siendo accesibles via:

```
GET /api/invitations?status=pendiente
```

para que el promotor pueda gestionarlas (reenviar, cancelar) desde
una sección dedicada (típicamente `/ajustes/invitaciones` o un drawer
en `/colaboradores`).

**Frontend mock actual** · `src/pages/Colaboradores.tsx` construye
`invitedAtByAgency` filtrando `useInvitaciones().pendientes` por
`inv.agencyId !== undefined && inv.estado === "pendiente"`. Pasa el
timestamp a `AgencyGridCard` via prop `invitedAt`. El componente
prioriza ese chip sobre cualquier estado de contrato.

**Por qué esta regla** · "Sin contrato" como chip por defecto a
agencias recién invitadas era engañoso · suena a problema. "Invitada
DD/MM/YYYY" es informativo · indica al admin promotor que la pelota
está en el tejado de la agencia. Si han pasado >7 días, el promotor
puede reenviar desde la card.

### 4.2.3 · Categorías de empresa (Inmobiliaria · Promotor · Comercializador)

**REGLA BYVARO** (consensuada con producto · 2026-04-29):

El sistema clasifica cada workspace con 0..N categorías canónicas:

| Categoría | Significa | Cómo se asigna |
|---|---|---|
| `inmobiliaria` | Es una agencia · vende viviendas en nombre de promotores | Automático cuando `org.kind = 'agency'`. |
| `promotor` | Construye/desarrolla y es dueño de la obra | Tiene ≥1 promoción activa con `ownerRole = 'promotor'`. |
| `comercializador` | Vende en exclusiva por encargo de un tercero | Tiene ≥1 promoción activa con `ownerRole = 'comercializador'`. |

**Una empresa puede tener varias categorías a la vez.** Ejemplo: una
agencia que activa el pack y publica una promoción como promotor +
otra como comercializador → categorías `[inmobiliaria, promotor,
comercializador]`.

**Pack de promotor/comercializador (lado agencia):**

Para que una agencia pueda CREAR promociones (y por tanto ganar las
categorías Promotor/Comercializador), debe activar un pack opcional.
El pack es solo CAPACIDAD · no añade categoría por sí mismo. La
categoría aparece cuando hay actividad real (≥1 promo publicada con
ese rol).

```sql
CREATE TABLE workspace_features (
  organization_id   uuid PRIMARY KEY REFERENCES organizations(id),
  developer_pack    boolean NOT NULL DEFAULT false,
  pack_activated_at timestamptz,
  ...
);
```

Activación · `POST /api/empresas/:id/features/developer-pack`
con `{ enabled: true }` · billing real va aparte (Stripe). Mock actual
persiste en localStorage `byvaro.workspace.developerPack.v1:<wsKey>`
(eliminar al conectar backend).

**Endpoint canónico:**

```
GET /api/empresas/:id/categorias

200 OK
{
  categories: ("inmobiliaria"|"promotor"|"comercializador")[],
}
```

Vista SQL recomendada:

```sql
CREATE VIEW v_empresa_categorias AS
SELECT
  o.id AS organization_id,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN o.kind = 'agency' THEN 'inmobiliaria' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM promotions p
      WHERE p.organization_id = o.id
        AND p.status = 'active'
        AND COALESCE(p.owner_role, 'promotor') = 'promotor'
    ) THEN 'promotor' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM promotions p
      WHERE p.organization_id = o.id
        AND p.status = 'active'
        AND p.owner_role = 'comercializador'
    ) THEN 'comercializador' END
  ], NULL) AS categories
FROM organizations o;
```

Nota: `owner_role` se setea per-promotion en el wizard de creación
(ver `WizardState.role` en `src/components/crear-promocion/types.ts`
y la regla CLAUDE.md "Promotor vs Comercializador · label dinámico").
Default `'promotor'` por compatibilidad.

**Dónde se renderizan las categorías** (consumidores actuales):

| Sitio | Componente | Tamaño |
|---|---|---|
| `/empresa` hero (own + visitor) | `Empresa.tsx` | sm |
| `/colaboradores/:id/panel` header | `ColaboracionPanel.tsx` | xs |
| `/promotor/:id/panel` header | `PromotorPanel.tsx` | xs |
| `/colaboradores` listing card | `AgencyGridCard.tsx` | xs |
| `/promotores` listing card | `Promotores.tsx` | xs |

Componente canónico para pintarlos: `<EmpresaCategoryBadges
categories={...} size="xs|sm|md" />` en
`src/components/empresa/EmpresaCategoryBadges.tsx`.

**Frontend mock actual** · helper `getEmpresaCategories()` y hook
reactivo `useEmpresaCategories()` en `src/lib/empresaCategories.ts`
derivan las categorías:
- accountType="agency" → `["inmobiliaria"]` (siempre).
- accountType="developer" → deriva de `[...promotions,
  ...developerOnlyPromotions]` filtrando por `status="active"` y
  agrupando por `ownerRole`.

Cuando aterrice el backend, sustituir el branch developer por un
fetch a `/categorias`. El shape `EmpresaCategory[]` ya es el contrato.

### 4.3 · Reglas de marketing por promoción

El promotor define, por promoción, qué canales (portales inmobiliarios,
redes sociales, ads) quedan PROHIBIDOS para las agencias
colaboradoras. La agencia ve la misma regla en la ficha y debe
respetarla — violarla puede llevar a extinción del contrato.

**Tipo** · `Promotion.marketingProhibitions?: string[]` (ids del
catálogo). Ausencia = "todo permitido".

**Catálogo** · `src/lib/marketingChannels.ts` (15 canales agrupados
en 3 categorías · portales · redes · publicidad). Los ids son
estables — nunca renombrar.

**Storage actual** · localStorage clave
`byvaro.promotion.marketingProhibitions.v1:<id>`
(`src/lib/marketingRulesStorage.ts`).

**Endpoints esperados**:

| Endpoint | Propósito |
|---|---|
| `GET /api/promociones/:id` | respuesta ya trae `marketingProhibitions: string[]` |
| `PATCH /api/promociones/:id` | body incluye `marketingProhibitions?: string[]` |
| `GET /api/marketing/channels` | catálogo del backend (sobrescribe al mock cliente; incluirá qué integraciones están activas en el tenant para UI) |

**Integración con conectores de portales** (fase futura ·
`src/lib/portalIntegrations/*`):

1. **Gate duro en dispatcher** · al publicar desde la agencia, el
   dispatcher de portal DEBE leer `marketingProhibitions` antes de
   hacer push. Si el canal está prohibido → 422
   `channel_prohibited` + UI de la agencia muestra botón bloqueado
   con tooltip "El promotor ha prohibido este canal".
2. **Detección post-hoc** · si un portal notifica (webhook) una
   publicación fuera del flujo (agencia publicó a mano), el sistema
   registra incidencia en historial cross-empresa:
   `recordCompanyEvent({ type: "marketing.violation", channelId,
   promotionId })` + notifica al admin del promotor por email +
   push.
3. **Contrato** · la cláusula de marketing del contrato de
   colaboración debe referenciar esta regla textualmente (plantilla
   en `/ajustes/plantillas` categoría "Documentos → contratos").

**Visibilidad** · admin y agente del promotor la editan (no hay gate
de permiso específico por ahora · la edita quien edita la promoción);
la agencia la ve read-only en su vista de ficha.

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

## 7.5 · Calendar (agenda unificada · ADR-056)

**Tipo**: `src/data/calendarEvents.ts` → `CalendarEvent` (union
discriminada). **Consumidores**: `src/pages/Calendario.tsx`,
`CreateCalendarEventDialog`, widget "Hoy" de `/inicio`, CTA "Programar
visita" en `/oportunidades/:id`. Spec UI en `docs/screens/calendario.md`.

### CRUD

```
GET    /api/calendar/events?from=ISO&to=ISO&assigneeUserId=&types=&statuses=
GET    /api/calendar/events/:id                                 → CalendarEvent
POST   /api/calendar/events                                     body: CalendarEventInput
PATCH  /api/calendar/events/:id                                 body: Partial<CalendarEvent>
DELETE /api/calendar/events/:id
```

### Conflict check (pre-validación server-side)

```
GET /api/calendar/events/conflicts
    ?assigneeUserId=u1&start=ISO&end=ISO&ignoreId=ev-abc
    → { conflict: CalendarEvent | null }
```

Debe replicar lo que hace `findConflict()` del mock: excluye eventos
`cancelled` y `noshow`, coincidencia exacta de `assigneeUserId`, borde
tocándose NO es conflicto. La UI hace la validación en vivo; el
backend valida de nuevo al POST/PATCH para evitar race conditions.

### Reglas de negocio

- **Un único agente** por evento (`assigneeUserId`). Multi-asignee
  queda para iteración futura.
- **Visita desde registro** llega con `status="pending-confirmation"`.
  La confirmación cambia el status a `confirmed` y actualiza el
  `lead.status` a `"visita"`.
- **Evaluación** post-visita se guarda como `evaluation` dentro del
  `CalendarVisitEvent` (mismo shape que `ContactVisitEntry.evaluation`
  — portable entre modelos).

### Google Calendar sync (bidireccional)

```
POST   /api/me/integrations/google-calendar/connect
    → { oauthUrl }                    # redirect al OAuth consent de Google

GET    /api/me/integrations/google-calendar/status
    → { connected: boolean, email?: string, lastSyncAt?: ISO }

POST   /api/me/integrations/google-calendar/disconnect
    → { ok: true }
```

Flujo:
1. Al conectar, el token OAuth (refresh) se guarda cifrado.
2. Cron `calendar-sync` cada 5 min:
   - **Pull** de eventos nuevos/modificados de Google → insertar/
     actualizar `CalendarEvent` con `source="google-calendar"` y
     `externalId`.
   - **Push** de eventos Byvaro creados por ese agente → a Google
     Calendar API. Cada evento lleva el `externalId` devuelto por
     Google para detectar duplicados en próximos pulls.
3. Al desconectar, **no** se borran los eventos importados · se mantienen
   pero pierden el sync.

### Envío de la visita al cliente

```
POST /api/calendar/events/:id/ics                → ICS attachment (text/calendar)
POST /api/calendar/events/:id/send               body: { channels: ("email"|"whatsapp")[] }
```

Envío por email lleva `.ics` adjunto para que el cliente la añada a su
agenda; envío por WhatsApp usa link corto al ICS.

### Emisión de eventos en timelines

Cada mutación emite evento en el historial del contacto y/o de la
oportunidad (regla 🥇 `CLAUDE.md`):

- Crear visita vinculada a oportunidad → `visit_scheduled` en ambos.
- Confirmación de `pending-confirmation` → `visit_confirmed`.
- Mover fecha → `visit_rescheduled` con rango antiguo y nuevo.
- Cancelar → `visit_cancelled`.
- Noshow → `visit_noshow`.
- Evaluar → `visit_evaluated` con `rating` + `clientInterest`.

### Mock actual

- `src/data/calendarEvents.ts` · 24 eventos seed distribuidos en la
  semana actual (pasado + presente + futuro) cubriendo todos los
  tipos y estados.
- `src/lib/calendarStorage.ts` · CRUD en `localStorage` con
  `byvaro.calendar.overrides.v1` + `byvaro.calendar.deleted.v1`.
- `src/pages/ajustes/calendario/sync.tsx` · mock de estado Google por
  miembro en `byvaro.calendar.googleSync.v1`.

---


## 8 · Integraciones externas

### 8.1 · Google Places API (rating público)

**Usado por**: empresa del promotor / comercializador / agencia
(`GoogleRatingCard` en `/empresa?tab=about` modo edición · pill compacta
`HeroGoogleRating` en el hero).

**Por qué existe**: el rating + nº de reseñas reales de Google se
muestran al lado del nombre de la empresa, en emails a colaboradores y
en los microsites · aumenta confianza sin que el admin tenga que
mantener nada.

#### Endpoints

```
POST   /api/empresa/google-place
       headers: Authorization (JWT con workspace_id, role=admin)
       body: { mapsUrl: string }
       200 → {
         placeId: string,
         googleMapsUrl: string,           // URL canónica resuelta
         googleRating: number,            // 0-5 (1 decimal)
         googleRatingsTotal: number,
         googleFetchedAt: string,         // ISO 8601
       }
       400 → { code: "invalid_url" }       // no es URL de Google Maps
       404 → { code: "place_not_found" }   // place_id no resuelve
       402 → { code: "quota_exceeded" }    // Places API quota agotada
       requires: role === "admin" del workspace propietario.

DELETE /api/empresa/google-place
       headers: Authorization (admin)
       204 No Content
       Limpia placeId, googleMapsUrl, googleRating, googleRatingsTotal,
       googleFetchedAt en `organizations`. Idempotente.

GET    /api/empresa/google-refresh
       cron-only · interno · refresca rating de TODOS los workspaces
       con place_id. NO se llama desde cliente.
       Schedule: weekly (lun 03:00 UTC). TTL Places ToS ≤ 30 días.
```

#### Flujo end-to-end

1. **Admin pega URL de Maps** en `/empresa?tab=about` → modo edición →
   sección "Reseñas de Google". Click "Conectar".
2. **Cliente** hace `POST /api/empresa/google-place { mapsUrl }`.
3. **Backend** parsea la URL para extraer `place_id`:
   - `maps.app.goo.gl/...` → seguir redirect 302 hasta resolver canonical.
   - `google.com/maps/place/.../!1s<placeid>!...` → extraer del path con regex
     (CID o `0x...:0x...` formato).
   - Si solo hay nombre + lat/lng → llamar a Places **Find Place From Text**.
4. **Primer fetch** Places Details (`fields: rating,user_ratings_total,
   url,name`). Persistir en `organizations.google_*`.
5. Devolver el shape completo al cliente (200). Cliente actualiza
   `useEmpresa` → la pill `<HeroGoogleRating>` aparece automáticamente.
6. **Cron semanal** repite paso 4 para todos los workspaces · si rating
   cambia, dispara webhook interno `google.rating.changed` para invalidar
   caches downstream (microsites estáticos, emails programados).

#### Mock actual (frontend sin backend)

- `src/components/empresa/GoogleRatingCard.tsx` · click "Conectar"
  ejecuta inline una simulación: hash determinístico de la URL para
  generar `placeId` sintético + setea rating fijo `4.7` y total `312`
  (matching el seed de `defaultEmpresa`). Solo para que el demo se
  vea poblado.
- Cuando exista el backend real, sustituir el `onClick` por
  `await fetch("/api/empresa/google-place", ...)` y aplicar el
  response al hook `useEmpresa.update()`.
- TODOs en código: `GoogleRatingCard.tsx` (busca `TODO(backend):`).

#### Restricciones Google Places ToS (obligatorias · NO opcionales)

- Refresco máximo cada **30 días** · NO cachear más allá. Cron semanal
  cumple sobradamente.
- **Atribución visible** al mostrar rating: "Basado en reseñas de
  Google" o variante equivalente. Frontend ya lo cumple en
  `GoogleRatingCard.tsx:139`.
- NO modificar el rating ni las reseñas (UI debe mostrar tal cual).
- **Link a la ficha pública de Maps** cuando se muestre el rating
  (botón "Ver en Google Maps"). Frontend ya lo cumple.
- Si el usuario desactiva (`DELETE /api/empresa/google-place`),
  borrar el rating del display dentro de 24h.

#### Coste estimado

- $200/mes de free tier de Google Maps Platform (cubre la mayoría).
- Places Details (Atmosphere data) = $0.005/call.
  - 500 workspaces × 1 refresh/semana × 4 semanas = 2.000 calls/mes ≈ $10/mes.
  - Bien dentro del free tier.

#### Permisos

- Solo `admin` del workspace puede conectar/desconectar.
- `member` → 403 en `POST` y `DELETE`. Frontend ya gatea con
  `isAdmin` en `EmpresaAboutTab`.
- Cualquier rol/visitor LEE el rating cuando consulta la empresa
  (`GET /api/empresas/:id/public`).

#### UI que ya cumple ToS

- `GoogleRatingCard` en `src/components/empresa/` (modal grande de config).
- `HeroGoogleRating` en `src/components/empresa/` (pill compacta del hero).
- `GoogleRatingBadge` en `src/components/empresa/` (badge inline en
  cards de agencia).

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

## 12 · Plan & paywall (Fase 1 · validación 249€/mes)

**Objetivo de fase**: monetizar promotores. Las agencias permanecen
gratis. El backend solo necesita 4 endpoints + 1 webhook + validación
en endpoints mutantes existentes.

### 12.1 · Modelo

```sql
-- Tabla en la organización (workspace). Una fila por developer org.
create table workspace_plan (
  workspace_id  uuid primary key,
  tier          text not null check (tier in ('trial','promoter_249')),
  since         timestamptz not null default now(),
  stripe_subscription_id text,
  stripe_customer_id     text,
  cancel_at_period_end   boolean default false
);
```

### 12.2 · Endpoints

```http
GET /api/workspace/plan
→ 200 { tier, since, expiresAt? }

GET /api/workspace/usage
→ 200 { activePromotions, invitedAgencies, registros }

POST /api/workspace/plan/subscribe
  body: { stripePriceId: "price_..." }
→ 200 { tier: "promoter_249", since }   ← idempotente

POST /api/workspace/plan/cancel
→ 200 { tier: "trial", since }          ← cancela al final del período
```

### 12.3 · Enforcement en endpoints mutantes

Los 3 endpoints siguientes **deben** validar el tier vigente y
devolver **402 Payment Required** con `{ trigger, used, limit }`
cuando se llegue al tope del plan trial:

| Endpoint | Trigger | Límite trial | Límite promoter_249 |
|---|---|---|---|
| `POST /api/promociones` | `createPromotion` | 2 activas | 5 activas |
| `POST /api/agencies/invite` | `inviteAgency` | 5 invitaciones | ∞ |
| `POST /api/registros/:id/approve` | `acceptRegistro` | 40 registros | ∞ |

**Nota crítica del counter `acceptRegistro`** · cuenta SOLO registros con `origen = 'collaborator'` (de agencias). Walk-ins del promotor (`origen = 'direct'`), portales (Idealista, Fotocasa…) y otras fuentes propias del promotor NO consumen cupo. SQL del counter:

```sql
select count(*)::int from registrations
  where developer_organization_id = p_org
    and origen = 'collaborator'
```

Ver `docs/portal-leads-integration.md` para detalle completo.

El cliente lee el payload 402 y abre el `<UpgradeModal>` con la copy
correspondiente al `trigger` (ya implementado en mock ·
`src/lib/usageGuard.ts::openUpgradeModal`).

### 12.4 · Webhooks Stripe

- `customer.subscription.created` → escribe `tier="promoter_249"`.
- `customer.subscription.deleted` → escribe `tier="trial"`.
- `customer.subscription.updated` con `cancel_at_period_end=true` →
  flag para banner "tu suscripción expira el {date}".
- `invoice.payment_failed` → email al admin + paywall hard al día +3.

### 12.5 · Tracking (analytics)

Evento `paywall.shown` al abrir el modal. Payload:
```json
{ "trigger": "createPromotion|inviteAgency|acceptRegistro|near_limit",
  "used": 40, "limit": 40, "tier": "trial",
  "workspace_id": "...", "user_id": "..." }
```

Es la **métrica clave de validación** Fase 1. Rastrear también
`paywall.subscribed` (CTA primario) y `paywall.dismissed` (CTA "Más
adelante").

### 12.6 · Referencias frontend

- `src/lib/plan.ts` · `usePlan()`, `setPlan()`, `PLAN_LIMITS`.
- `src/lib/usage.ts` · `useUsageCounters()`.
- `src/lib/usageGuard.ts` · `useUsageGuard()`, `openUpgradeModal()`.
- `src/lib/usagePressure.ts` · helper del pill ámbar (≥80%).
- `src/components/paywall/UpgradeModal.tsx`, `UsagePill.tsx`.
- `src/pages/CrearPromocion.tsx:393` · gate al publicar.
- `src/components/empresa/InvitarAgenciaModal.tsx:65` · gate al invitar.
- `src/pages/Registros.tsx:355` · gate al aprobar.
- `docs/screens/ajustes-plan.md` · spec de la pantalla.

---

## 13 · Visita · reprogramar / cancelar / completar (Phase 2 frontend mock)

Spec del flujo para gestionar la visita asociada a un Registro en
estado `preregistro_activo`. El frontend ya implementa la UI completa
con mocks · este bloque define los endpoints reales.

### 13.1 · Modelo extendido

```sql
alter type registro_estado add value 'caducado';
-- preregistro_activo cuya visita fue cancelada o cuyo plazo expiró.

create type visit_outcome as enum (
  'realizada',
  'no_show_cliente',
  'cancelada_agencia',
  'cancelada_promotor',
  'reprogramada'
);

alter table registrations add column visit_outcome visit_outcome;
alter table registrations add column visit_outcome_at timestamptz;
alter table registrations add column visit_note text;
alter table registrations add column reprogramaciones_count int not null default 0;
```

### 13.2 · Endpoints

```http
POST /api/registrations/:id/visit/reschedule
  body: { newDate, newTime, note? }
  → 200 { reprogramacionesCount, visitDate, visitTime }
  → 422 { code: "max_reprogramaciones_exceeded", limit: 2 }
  Permission: agencyId del registro O developerId de la promo · admin role.
  Side effects:
    · UPDATE registrations SET visit_date, visit_time,
      reprogramaciones_count = reprogramaciones_count + 1,
      visit_outcome = 'reprogramada', visit_outcome_at = now()
      WHERE id = $1 AND reprogramaciones_count < 2
    · INSERT calendar_event update + companyEvent log

POST /api/registrations/:id/visit/cancel
  body: { outcome: "no_show_cliente"|"cancelada_agencia"|"cancelada_promotor", note? }
  → 200 { estado: "caducado", visitOutcome, visitOutcomeAt }
  → 403 si el outcome no es permitido para el rol del caller
       (agency: solo no_show_cliente | cancelada_agencia)
       (developer: solo cancelada_promotor)
  Side effects:
    · UPDATE registrations SET estado = 'caducado',
      visit_outcome = $2, visit_outcome_at = now(), visit_note = $3
    · UPDATE calendar_events SET status = 'cancelled' WHERE registro_id = $1
    · INSERT companyEvent (cross-empresa log)
    · Si outcome === 'cancelada_agencia' · increment penalty counter
      en agency_track_record (track quality del promotor)
    · Notificar al lado opuesto (in-app + email)

POST /api/registrations/:id/visit/complete
  body: { rating?, feedback? }
  → 200 { estado: "aprobado", visitOutcome: "realizada" }
  Permission: agencyId del registro (es quien marca la visita).
  Side effects:
    · UPDATE registrations SET estado = 'aprobado',
      visit_outcome = 'realizada', visit_outcome_at = now()
      WHERE id = $1 AND estado = 'preregistro_activo'
    · UPDATE calendar_events SET status = 'completed'
    · upsertContactFromRegistro (formaliza el contacto en CRM)
    · Notificar al promotor: "Visita realizada · cliente registrado"
```

### 13.3 · Reglas de prioridad afectadas

Al transitar a `caducado`, el cliente queda libre y puede ser registrado
de nuevo. `findPendingDuplicate` server-side debe excluir `caducado` del
filtro (igual que el frontend mock ya hace · `registrosStorage.ts:69`).

```sql
-- Cuando una agencia intenta registrar a un cliente, bloquear con
-- duplicado solo si hay match en estos estados:
select id from registrations
  where promotion_id = $1
    and estado in ('pendiente', 'preregistro_activo')
    and (normalize_email(cliente_email) = normalize_email($2)
         or normalize_phone(cliente_phone) = normalize_phone($3))
  limit 1;
```

### 13.4 · Track record agencia

El outcome `cancelada_agencia` impacta en la métrica de calidad de
cancelaciones que el promotor ve junto al nombre de la agencia
(`<AgencyTrackPill>` en lista de registros). Phase 2 backend:

```sql
create or replace view agency_track_record as
select
  agency_id,
  count(*) filter (where estado = 'aprobado')             as aprobados,
  count(*) filter (where estado = 'rechazado')            as rechazados,
  count(*) filter (where estado = 'duplicado')            as duplicados,
  count(*) filter (where visit_outcome = 'cancelada_agencia') as cancelaciones,
  count(*) as total
from registrations
group by agency_id;
```

### 13.5 · Notificaciones cross-empresa

Eventos a emitir en cada acción · siguiendo la matriz de
`docs/registration-system.md §5`:

| Acción | Recipient | Evento | Canal |
|---|---|---|---|
| Reprograma agencia | promotor | `visit.rescheduled_by_agency` | in-app |
| Reprograma promotor | agencia | `visit.rescheduled_by_developer` | in-app + email |
| Cancela agencia | promotor | `visit.cancelled_by_agency` | in-app |
| Cancela promotor | agencia | `visit.cancelled_by_developer` | in-app + email (con motivo) |
| Visita realizada | promotor | `visit.completed` | in-app + digest |

### 13.6 · Referencias frontend

- `src/components/registros/VisitActionDialogs.tsx` · 3 dialogs.
- `src/pages/Registros.tsx::rescheduleVisit/cancelVisit` · handlers locales.
- `src/data/records.ts` · `RegistroEstado += "caducado"`, `VisitOutcome` enum.
- Banner preregistro con botones "Cambiar fecha" / "Cancelar visita".

---

## 14 · Auth gate · login obligatorio (Phase 2 frontend mock)

Spec del gate de autenticación a nivel de ruta. El frontend ya
implementa el wrapper completo · este bloque define qué necesita el
backend real para sustituir el mock.

### 14.1 · Comportamiento actual (mock · `src/components/RequireAuth.tsx`)

- Cualquier ruta excepto `/login` y `/register` está envuelta en
  `<RequireAuth>`.
- El gate llama a `isAuthenticated()` (lib/accountType.ts) que solo
  comprueba si hay valor en `sessionStorage`.
- Si no autenticado, redirige a `/login?next={original_url}`.
- Login válida contra `mockUsers.ts` (lista hardcoded) y persiste en
  sessionStorage.
- Tras login, redirige al `next=` original o a `/inicio` por defecto.

### 14.2 · Endpoints backend necesarios

```http
POST /api/auth/login
  body: { email, password }
  → 200 { token | session_cookie }   ← cookie httpOnly preferida
  → 401 { code: "invalid_credentials" }
  → 429 { code: "rate_limited" }     ← brute force protection

POST /api/auth/logout
  → 204 (cookie cleared / token revoked)

GET /api/auth/me
  → 200 { user: { id, email, name, accountType, role, agencyId? } }
  → 401 { code: "unauthenticated" }
  Cliente lo usa en lugar de mirar sessionStorage para saber si hay sesión.

POST /api/auth/refresh        (opcional · si JWTs cortos)
  → 200 { token }
  → 401 si refresh expirado
```

### 14.3 · Cambios en frontend cuando exista backend

- `isAuthenticated()` en `accountType.ts` pasa de mirar sessionStorage
  a hacer fetch a `GET /api/auth/me` (con loading state).
- `RequireAuth` se vuelve async · muestra spinner hasta resolver.
- `loginAs()` deja de mutar sessionStorage · el cookie httpOnly del
  servidor es la fuente de sesión.
- `mockUsers.ts` y `findMockUser()` se eliminan.
- `AccountSwitcher` (cambio rápido entre developer/agency en demo)
  desaparece o queda solo para superadmins.

### 14.4 · Seguridad mínima en producción

- Cookie httpOnly + Secure + SameSite=Lax
- CSRF token en mutaciones (header `X-CSRF-Token`)
- Rate limit en `/auth/login` (5 intentos / IP / 15min)
- Bcrypt o Argon2id para passwords
- Email verification para nuevos signups
- 2FA opcional (TOTP · `/ajustes/seguridad/2fa` ya tiene UI placeholder)

### 14.5 · Multi-tenant boundaries

Cada endpoint protegido lee `req.user.organizationId` y filtra por ahí
con RLS. Ningún query frontend debe poder devolver datos de otra org.
Ver §11 (Permisos) y §12 (Plan & paywall) para reglas específicas.

### 14.6 · Acceso de demo en producción Phase 1A

Mientras se valida el paywall sin backend, la app DEBE estar online
pero NO accesible al público. Soluciones:

1. **Recommended** · password basic auth a nivel CDN/Vercel
   (`vercel.json` con `headers` y middleware) por encima del Login mock.
2. Alternativa · solo el Login mock con `mockUsers.ts` como ACL ·
   pero la app sigue siendo accesible si alguien adivina la URL del
   asset (low-risk en SPA porque las APIs no existen aún).

Para Phase 1B (post-validation) cuando exista backend real, el auth
es server-side y este apartado deja de aplicar.

---

## 15 · Envío de emails (Resend / SMTP) y plantilla de invitación

> **Decisión.** Toda comunicación que sale al exterior (invitaciones,
> bienvenida, reseteo, transaccionales) la envía el **sistema de Byvaro**
> con su propia configuración (FROM, DKIM, SPF, return-path). El
> promotor NO usa su SMTP propio para esto · es Byvaro hablando "en
> nombre de" cada promotor (`from: noreply@byvaro.com` con
> `replyTo: <promotor>@<dominio>` y `From-Name: "{promotor} via
> Byvaro"`).

### 15.1 · Estado actual (mock)

- Generador HTML canónico · `getInvitacionHtml()` en
  `src/lib/invitaciones.ts:436`. Devuelve `{ asunto, html }` con
  HTML email-safe (tablas + estilos inline) y media queries para
  cliente móvil.
- Persistencia local del envío · `recordSentInvitationEmail()` en
  `src/lib/sentEmails.ts`. Cap a 100 entradas. Visible en el botón
  "Ver email completo (HTML)" del modal `InvitarAgenciaModal`.
- **No existe envío real** · al pulsar "Enviar por email" se abre el
  HTML renderizado en una pestaña nueva como demo visual.
- El snapshot estático `email-previews/invitacion-agencia.html`
  fue eliminado el 2026-04-25 porque drifteaba con la función real.
  El preview canónico es el botón "Ver email completo (HTML)" en el
  modal de invitación.

### 15.2 · Endpoints backend necesarios

```http
POST /api/emails/send                          (interno · usado por handlers)
  body: {
    to:       string,             # destino
    from:     string,             # "noreply@byvaro.com" o dominio del tenant
    fromName: string,             # "{promotor} via Byvaro"
    replyTo?: string,             # email del promotor para respuestas
    subject:  string,
    html:     string,             # generado por la plantilla del kind
    kind:     "invitation" | "registration_approved" | ...
    refId?:   string              # invitacionId, registroId
  }
  → 200 { messageId }             # id del proveedor (Resend / SES / SendGrid)
  → 4xx { code: "invalid_recipient" | "rate_limited" | "blocked" }

GET /api/emails/sent                           (admin · futuro)
  → 200 { items: SentEmail[] }    # log auditable, ver §1.8 webhooks
```

### 15.3 · Configuración del proveedor

| Variable | Valor recomendado | Por qué |
|---|---|---|
| Proveedor | **Resend** (primero) · SES como fallback | Resend tiene API limpia + DKIM asistido + buenos logs. SES como backup multirregión. |
| FROM canónico | `noreply@byvaro.com` | Single-source de reputación de envío. |
| DKIM | sí, gestionado por proveedor | Sin DKIM los emails caen en spam (Gmail/Outlook 2024+). |
| SPF | `v=spf1 include:_spf.resend.com -all` | Autoriza al proveedor. |
| DMARC | `v=DMARC1; p=quarantine; rua=mailto:dmarc@byvaro.com` | Protege la marca. |
| Return-path | `bounces@byvaro.com` (gestionado por proveedor) | Bounces gestionados sin contaminar inbox real. |
| List-Unsubscribe | header obligatorio para envíos masivos | Cumple RFC 8058 + Gmail/Yahoo 2024 bulk sender. |
| Subdomain | `mail.byvaro.com` opcional para warmup | Aísla la reputación de envío del dominio comercial. |

### 15.4 · Plantillas registradas

Catálogo único en `/ajustes/plantillas`
(`src/pages/ajustes/plantillas/index.tsx`) — REGLA DE ORO `CLAUDE.md`.
Hoy `live`:

- `auth-agency-invitation` · invitación a agencia colaboradora ·
  generada por `getInvitacionHtml()` · disparada desde
  `InvitarAgenciaModal` y `SharePromotionDialog`.

Pendientes de implementar (`status: "planned"`):

- `auth-welcome`, `auth-password-reset`, `auth-email-verification`,
  `auth-member-invitation`, todas las `tx-*` (registration approved/
  rejected, visit scheduled/reminder, contract sent/signed, sale
  closed). Ver hub para detalle.

### 15.5 · Webhooks (delivered / bounced / opened)

Ver §1.8 · cada email tracked debe registrar `delivered_at`,
`opened_at`, `bounced_at` en la fila correspondiente del
`sent_emails`. La invitación además marca `invitations.delivered_at`
para que la UI muestre "Entregado · hace 2 min".

### 15.6 · Referencias frontend

- `src/lib/invitaciones.ts:436` · `getInvitacionHtml()` (HTML canónico).
- `src/lib/sentEmails.ts` · log local mock.
- `src/components/empresa/InvitarAgenciaModal.tsx:98` · `handleSend` ·
  contiene `TODO(backend)` para el POST real.
- `src/pages/ajustes/plantillas/index.tsx` · catálogo de plantillas.

---

## 16 · Contactos bidireccionales en colaboración promotor ↔ agencia

> **Regla.** Cuando se establece una relación promotor ↔ agencia (vía
> invitación), CADA lado tiene en su CRM un Contact `kind: "company"`
> que representa al otro. El admin abre el contacto y ve actividad,
> registros aportados, ventas cerradas, etc., como si fuese cualquier
> otra empresa relacionada.

### 16.1 · Cuándo se crean

| Evento | Lado promotor | Lado agencia |
|---|---|---|
| Promotor envía invitación | **Crea Contact de la agencia** (`status: pending`) | nada |
| Agencia acepta invitación | (sin cambio · ya existía) | **Crea Contact del promotor** (`status: active`) |
| Agencia rechaza invitación | actualiza el `latestSource` con label "Rechazada" (futuro) | nada |
| Caducidad sin respuesta | actualiza el `status` del Contact a `cold` (futuro) | nada |

Idempotencia · si el Contact ya existe (mismo `email` o
`companyTaxId` o referencia a la misma `invitacionId`), se reutiliza.

### 16.2 · Shape del Contact creado

**Lado promotor (agencia como contacto):**

```ts
{
  kind: "company",
  companyName: agency.name,
  tradeName: agency.name,
  email: invitation.emailAgencia,
  avatarUrl: agency.logo,
  primarySource: {
    source: "agency",
    label: "Invitación enviada · {agency.name}",
    occurredAt: invitation.createdAt,
    agencyId: agency.id,
    refId: invitation.id,
    refType: "manual",
    promotionId: invitation.promocionId,
    meta: { invitacionId: invitation.id }
  },
  status: "pending",
  ownerAgencyId: undefined  // pertenece al tenant del promotor
}
```

**Lado agencia (promotor como contacto):**

```ts
{
  kind: "company",
  companyName: empresa.nombreComercial,
  tradeName: empresa.nombreComercial,
  companyTaxId: empresa.cif,
  email: empresa.email,
  phone: empresa.telefono,
  avatarUrl: empresa.logoUrl,
  primarySource: {
    source: "referral",
    label: "Promotor · invitación aceptada",
    occurredAt: acceptedAt,
    refId: invitation.id,
    refType: "manual",
    meta: { invitacionId: invitation.id, promotor: empresa.nombreComercial }
  },
  status: "active",
  ownerAgencyId: agency.id  // RLS · solo visible dentro de la agencia
}
```

### 16.3 · Endpoints backend (transaccional)

```http
POST /api/agencies/invite                      (promotor)
  body: { agencyId? | emailAgencia, nombreAgencia, comision, ... }
  → 200 {
      invitation: Invitation,
      promoterContact: Contact   # creado/encontrado lado promotor
    }
  Lado server: TRANSACCIÓN · upsert(invitation) + upsert(promoter_contact).
  Si falla cualquiera, rollback ambos.

POST /api/invitations/:id/accept               (agencia)
  → 200 {
      invitation: Invitation,        # estado=aceptada
      agencyContact: Contact,        # creado lado agencia (promotor como company)
      collaboration: Collaboration   # registro en agency.promotionsCollaborating
    }
  Lado server: TRANSACCIÓN · UPDATE invitation + INSERT agency_contact +
  INSERT collaboration. Idempotente: si agency_contact ya existe (por CIF
  + ownerAgencyId), se reutiliza.
```

### 16.4 · RLS · multi-tenant boundaries

- Lado promotor: el Contact creado tiene `owner_agency_id = NULL` y
  `organization_id = promoter_org_id`. Solo visible dentro del tenant
  del promotor.
- Lado agencia: el Contact creado tiene `owner_agency_id = agency.id`
  y `organization_id = agency.id`. Solo visible dentro de la agencia ·
  el promotor NO ve este contacto cross-tenant.
- Nunca se replica el shape entero del otro lado · cada tenant tiene
  SU contacto, con SUS notas, SUS tags, SU timeline · son entidades
  separadas que apuntan a la misma `invitacionId`.

### 16.5 · Estado actual (mock)

- Helper canónico · `src/lib/invitationContacts.ts`:
  - `ensurePromoterContactForAgency()` · idempotente por
    `email + invitacionId`.
  - `ensureAgencyContactForPromoter()` · idempotente por
    `cif + invitacionId + ownerAgencyId`.
- Disparadores hoy:
  - `InvitarAgenciaModal.handleSend()` (linea ~135) · llama
    a `ensurePromoterContactForAgency()`.
  - `PromocionDetalle.AgencyInvitationBanner.handleAccept()`
    (linea ~3735) · llama a `ensureAgencyContactForPromoter()`.
- Persistencia · `byvaro.contacts.created.v1` (localStorage,
  compartido entre roles en demo single-tenant). En backend cada
  tenant tendrá su tabla aislada.

### 16.6 · Eventos cross-empresa relacionados (§4)

Cuando exista el log cross-empresa real, AL ENVIAR la invitación se
debe disparar también:

```ts
recordCompanyEvent(agencyId, {
  type: "invitation_sent",
  by: { name: promoter.name },
  promotionId,
  meta: { invitacionId, comision }
});
```

Y al aceptar:

```ts
recordCompanyEvent(agencyId, {
  type: "invitation_accepted",
  by: { name: agency.contactoPrincipal.nombre }
});
```

Ambos lados (Contact + CompanyEvent) son COMPLEMENTARIOS · el Contact
es la representación del partner como entidad CRM, el CompanyEvent es
el log de auditoría de la relación.

---

## 17 · Detección por dominio · invitaciones cross-domain

> **Caso 2c.** Un promotor invita a `juan@primeproperties.com`. El email
> exacto NO está registrado, pero `primeproperties.com` SÍ pertenece a
> una agencia existente en Byvaro (Prime Properties). En lugar de
> tratar a Juan como alta nueva (caso 1) y duplicar la agencia, se
> detecta el match por dominio y se redirige el flujo:

### 17.1 · Reglas de detección

- Dominio público (gmail, outlook, yahoo, etc.) NUNCA cuenta · evitar
  falsos positivos. Catálogo canónico en
  **`src/data/emailDomains.ts`** · ~80 dominios agrupados por región
  (Microsoft localizados, ISPs ES/FR/DE/IT/UK/RU, Asia, LATAM,
  privacidad). Reutilizable desde frontend y backend.
- Subdominios distintos NO matchean · `juan@dev.primeproperties.com` ≠
  `primeproperties.com` (evita lookups laxos a costa de algún falso
  negativo).
- Match se busca en 3 fuentes:
  1. `agencies[].contactoPrincipal.email` (seed).
  2. `mockUsers[]` con `accountType="agency"` y mismo dominio.
  3. `byvaro.users.created.v1` localStorage (signup posterior).

### 17.2 · Comportamiento del flujo

| Paso | Acción |
|---|---|
| 1 | Promotor envía invitación normal (template `auth-agency-invitation`) al email de Juan. |
| 2 | Juan abre el link → `/invite/:token` detecta el match por dominio. |
| 3 | Juan ve landing **caso 2c · "Tu empresa ya está en Byvaro"** con instrucciones · pedir al admin de su agencia que lo invite al equipo. |
| 4 | El sistema dispara automáticamente un email al admin de la agencia (template `auth-domain-match-notify-admin`) con CTA al panel `/ajustes/usuarios/miembros` para invitarle. |
| 5 | El admin invita formalmente a Juan → Juan recibe el email canónico de invitación a miembro · al aceptar, queda dado de alta como member. |
| 6 | Una vez registrado, Juan vuelve a abrir el link de invitación original → flujo continúa como caso 2b (login normal) → puede añadir la promoción a la cartera. |

### 17.3 · Plantillas implicadas

| Plantilla | Destinatario | Cuándo |
|---|---|---|
| `auth-agency-invitation` | Email externo (Juan) | Promotor envía la invitación · siempre. |
| `auth-domain-match-notify-admin` | Admin agencia (Laura) | Sistema detecta caso 2c al abrir Juan el link. |
| `auth-team-member-invitation` | Email externo (Juan) | Admin invita formalmente al miembro. |

### 17.4 · Endpoints backend

```http
GET  /api/agencies/by-domain?email=juan@primeproperties.com
  → 200 { agency: AgencyPublic, adminContact: { email, name } } | 404

POST /api/agencies/:id/domain-match-notify
  body: { invitedEmail, originalInvitationId, promotionName? }
  → 204
  Lado server: idempotente por (agencyId, invitedEmail) · no spamea
  si ya se envió esta misma combinación recientemente.
```

### 17.5 · Notificación in-app (TODO)

Además del email a Laura, el admin debería ver una notificación en el
`<NotificationsBell>` del header. El payload sería:
```ts
{
  kind: "domain_match_invitation_received",
  invitedEmail: "juan@primeproperties.com",
  fromInviter: "Luxinmo · Marina Heights",
  ctaUrl: "/ajustes/usuarios/miembros?invite=juan@primeproperties.com",
}
```

### 17.6 · Estado actual (mock)

- Helper canónico · `src/lib/agencyDomainLookup.ts` con
  `findAgencyByEmailDomain(email)`.
- Email generador · `src/lib/domainMatchNotifyEmail.ts ::
  getDomainMatchNotifyHtml()`.
- Plantilla registrada en `/ajustes/plantillas` como
  `auth-domain-match-notify-admin` (status `live`).
- Disparador · effect detector de `InviteAccept.tsx` añade caso
  `case2c-domain-match` entre 2b y 1 · al detectar match emite
  `recordSentEmail` con el HTML del notify-admin.
- Notificación in-app · pendiente.

### 17.7 · Catálogo canónico de dominios · `src/data/emailDomains.ts`

> **Fuente única de verdad** para clasificar un dominio de email
> como público (gmail, outlook…), temporal (mailinator…) o
> corporativo. Reutilizable desde frontend Y backend para mantener
> consistencia entre ambos lados.

**Exports:**

| Símbolo | Tipo | Descripción |
|---|---|---|
| `PUBLIC_EMAIL_DOMAINS` | `ReadonlySet<string>` | ~80 dominios públicos · Google, Microsoft (TLDs localizados), Apple, AOL, Privacy (Proton, Tutanota), GMX, FastMail, ISPs de ES/FR/DE/IT/UK/RU/Asia/LATAM. |
| `DISPOSABLE_EMAIL_DOMAINS` | `ReadonlySet<string>` | ~70 dominios temporales · Mailinator, Guerrillamail, 10MinuteMail, Yopmail, Throwaway/Trashmail, etc. |
| `getEmailDomain(email)` | helper | Extrae el dominio normalizado en minúscula · null si email inválido. |
| `isPublicEmailDomain(email)` | helper | true si gmail/outlook/etc. |
| `isDisposableEmailDomain(email)` | helper | true si email temporal · recomendado RECHAZAR alta. |
| `isCorporateEmailDomain(email)` | helper | true si NO es público ni temporal. |

**Regiones cubiertas (PUBLIC):**

- **Google** · gmail.com, googlemail.com.
- **Microsoft** · outlook.{com,es,fr,de,it,com.br,com.ar,com.mx,com.au},
  hotmail.{com,es,fr,de,it,co.uk,com.ar,com.mx,com.br},
  live.{com,es,fr,de,it,co.uk,com.mx,com.ar}, msn.com.
- **Yahoo** · yahoo.{com,es,fr,de,it,co.uk,com.mx,com.ar,com.br},
  ymail.com, rocketmail.com.
- **Apple** · icloud.com, me.com, mac.com.
- **AOL** · aol.com, aim.com.
- **Privacidad** · proton.me, protonmail.com, pm.me, tutanota.com,
  tutamail.com, tuta.io, hushmail.com, mailbox.org.
- **GMX** · gmx.{com,net,de,es,fr,it,co.uk,us,at}.
- **Otros globales** · fastmail.com, fastmail.fm, mail.com, zoho.com.
- **España (ISPs)** · terra.es, ya.com, telefonica.net, ono.com,
  jazztel.es.
- **Francia (ISPs)** · orange.fr, wanadoo.fr, free.fr, sfr.fr,
  laposte.net, numericable.fr, neuf.fr, club-internet.fr, bbox.fr.
- **Alemania** · web.de, t-online.de, freenet.de, arcor.de.
- **Italia** · libero.it, tin.it, alice.it, virgilio.it, tiscali.it,
  email.it.
- **Reino Unido (ISPs)** · btinternet.com, sky.com, talktalk.net,
  virginmedia.com, ntlworld.com, blueyonder.co.uk.
- **Rusia / CIS** · mail.ru, list.ru, bk.ru, inbox.ru, rambler.ru,
  yandex.com, yandex.ru, ukr.net.
- **Asia** · qq.com, 163.com, 126.com, sina.com, sohu.com, naver.com,
  daum.net, hanmail.net.
- **Brasil / LATAM** · uol.com.br, terra.com.br, bol.com.br,
  ig.com.br.

**Mantenimiento.**

- Añadir nuevos dominios en orden alfabético dentro del bloque
  regional. Sources oficiales o Wikipedia para confirmar antes de
  meter.
- Para `DISPOSABLE_EMAIL_DOMAINS`, sincronizar con el dataset
  comunitario · ej. https://github.com/disposable/disposable-email-domains
  · ~3000 dominios. Si se quiere lista completa, importar el JSON y
  mergear con el subset hardcoded (que cubre los 50 más comunes).

**Backend producción.** Mover este catálogo a una tabla
`email_domain_classifications(domain text PK, kind enum
('public', 'disposable', 'corporate'), source, updated_at)` que se
pueda actualizar sin redeploy. Endpoint público
`GET /api/email-domains/check?email=foo@bar.com` →
`{ kind, isPublic, isDisposable }` para reutilización. Mientras tanto,
**copiar el archivo `src/data/emailDomains.ts` directamente al backend**
manteniendo la misma fuente de verdad (recomendado · evita drift).

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-04-22 | Documento creado — consolida todos los `TODO(backend)` existentes. |
| 2026-04-25 | §12 · Plan & paywall Fase 1 (validación promotor 249€/mes). |
| 2026-04-27 | §13 · Visita reprogramar/cancelar/completar + estado `caducado` (Phase 2 frontend mock implementado · backend pendiente). |
| 2026-04-27 | Phase 2 frontend bloques A-G implementados: visit cancellation, expiry client-side, match score, T&C dialog, Party model, per-party activity, in-app notifications. Backend pendiente para todos. |
| 2026-04-27 | Phase 2 frontend Bloque H: Conflict resolution UI enriquecido (DuplicateContext + OverrideConfirmDialog). `Registro.overrideNote/At/ByUserId` campos nuevos. Backend pendiente: persistir en companyEvent log cross-empresa para auditar disputas de comisión. |
| 2026-04-27 | §14 · Auth gate `<RequireAuth>` · login obligatorio en todas las rutas excepto `/login` y `/register`. Soporte `?next=` para redirect post-login. Backend pendiente: 4 endpoints + cookie httpOnly + RLS server-side. |
| 2026-04-27 | Auth · password común para todas las cuentas demo (`Luxinmo2026Byvaro`). 12 cuentas total (2 promoters + 10 agencies = 5 admin + 5 member). Click en card de demo NO auto-loguea · solo pre-rellena email y focusea el campo password. Phase 1A privacy gate. |
| 2026-04-25 | §15 · Envío de emails (Resend / SMTP, FROM canónico, DKIM, SPF, DMARC) y plantilla `auth-agency-invitation` registrada como `live` en `/ajustes/plantillas`. §16 · Contactos bidireccionales en colaboración promotor ↔ agencia · helpers `ensurePromoterContactForAgency` / `ensureAgencyContactForPromoter` en `src/lib/invitationContacts.ts`. Disparados en `InvitarAgenciaModal.handleSend` (lado promotor) y `PromocionDetalle.AgencyInvitationBanner.handleAccept` (lado agencia). Idempotente. |
