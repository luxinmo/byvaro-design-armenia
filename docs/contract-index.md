# Contract index · dominio → tabla DB → helper TS → tipo TS → endpoints

> **Documento canónico · 2026-04-29.** Mapa único e inequívoco para que
> el agente que implemente el backend real (custom o cualquier
> sustituto de Supabase) sepa, sin pensar, qué tiene que devolver y
> qué shape debe tener cada endpoint.
>
> Si te incorporas al proyecto y vas a tocar el backend, **lee este
> archivo entero antes de cualquier otra cosa**. Es la fuente única
> que compatibiliza:
>
> - Las tablas reales en Supabase (`supabase/migrations/*`).
> - Los helpers TS del frontend (`src/lib/*`).
> - Los tipos TypeScript que la UI espera.
> - Los endpoints documentados en
>   `docs/backend-dual-role-architecture.md` y
>   `docs/backend-integration.md`.
> - Las claves localStorage scoped que el cache local consume.
>
> Cuando cambies algo, **actualiza este doc en el mismo commit**.
> Si una columna nueva entra en una tabla, debe aparecer aquí
> inmediatamente.

---

## Cómo leer cada fila

| Columna | Significado |
|---|---|
| **Dominio** | Concepto de negocio. Suele alinearse con una pantalla principal (`/empresa`, `/registros`, `/calendario`…). |
| **Tabla(s) DB** | Tablas Postgres reales en `public.*`. Bridge views en `api.*` espejean automáticamente. |
| **Helper TS** | Archivo en `src/lib/*` (o `src/components/*`) que la UI consume. Único punto autorizado para hablar con Supabase. |
| **Tipo TS** | Interface principal que la API debe devolver. La UI confía 100% en este shape. Mappers `rowToX(...)` viven en el helper. |
| **localStorage key** | Cache local scoped que el helper escribe al hidratar. Útil para entender qué espera el frontend al primer render. |
| **Write-through** | ✅ implementado · ⚠️ parcial · ❌ pendiente. |
| **Endpoints futuros** | Rutas REST (inglés canónico) que el backend custom debe servir cuando Supabase se reemplace. |

---

## §1 · Identidad de la organización

### 1.1 · Empresa (perfil del workspace)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organizations` + `public.organization_profiles` (1:1) |
| **Helper TS** | `src/lib/empresa.ts` · `loadEmpresaForOrg(orgId)`, `saveEmpresaForOrg(orgId, e)`, `useEmpresa(tenantId?)` |
| **Tipo TS** | `Empresa` (definido en `src/lib/empresa.ts`) |
| **localStorage key** | `byvaro-empresa:<orgId>` · plus legacy `byvaro-empresa` para `developer-default` |
| **Write-through** | ✅ |
| **Endpoints futuros** | `GET /organizations/:id/public` · `GET /organizations/:id/sensitive` (admin colab) · `GET /organizations/me` · `PATCH /organizations/me` |
| **Notas** | El mapper `rowToEmpresa(o, p)` divide la respuesta en dos tablas (`organizations` core + `organization_profiles` rico). Sensitive fields (`tax_id`, `main_contact_*`, `schedule`) viven en `organization_profiles` y solo se devuelven en `/sensitive`. |

### 1.2 · Oficinas

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.offices` |
| **Helper TS** | `src/lib/empresa.ts` · `loadOficinasForOrg(orgId)`, `saveOficinasForOrg(orgId, list)`, `useOficinas(tenantId?)` |
| **Tipo TS** | `Oficina` |
| **localStorage key** | `byvaro-oficinas:<orgId>` · plus legacy `byvaro-oficinas` |
| **Write-through** | ✅ (delete-all + reinsert · simplificación Phase 2) |
| **Endpoints futuros** | `GET /organizations/me/offices` · `GET /organizations/:id/offices` · `POST/PATCH/DELETE /organizations/me/offices` |
| **Notas** | Constraint partial unique: una oficina con `is_main=true` por org. Backend valida promote-another-first si se borra la principal. |

### 1.3 · Equipo / Members

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organization_members` |
| **Helper TS** | `src/lib/team.ts` (registry) + `src/lib/useWorkspaceMembers.ts` + `src/lib/agencyTeamSeeds.ts` (builder mock) |
| **Tipo TS** | `TeamMember` (`src/lib/team.ts`) |
| **localStorage key** | `byvaro.organization.members.v4:<workspaceKey>` (legacy) |
| **Write-through** | ❌ pendiente · seed determinista |
| **Endpoints futuros** | `GET /organizations/me/members` · `POST /organizations/me/members` · `PATCH /members/:id` · `POST /members/:id/handover` · `DELETE /members/:id` |
| **Notas** | Auth users viven en `auth.users`. Membership tiene trigger `enforce_at_least_one_admin` que impide quedarse sin admin. Migrar Phase 3. |

### 1.4 · Auth / cuenta actual

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `auth.users` (gestionado por Supabase Auth) + `organization_members` (resolver workspace) |
| **Helper TS** | `src/lib/supabaseClient.ts` · `src/lib/accountType.ts` (`loginAs`, `logout`) · `src/lib/currentUser.ts` (`useCurrentUser`) |
| **Tipo TS** | `CurrentUser` |
| **localStorage key** | `byvaro.supabase.auth.v1` (sesión Supabase) · `byvaro.accountType.*` (tipo + agencyId resuelto) · `byvaro.user.profile.v1` (perfil editable) |
| **Write-through** | ✅ Auth real · sessionStorage solo cachea el accountType resuelto |
| **Endpoints futuros** | Supabase Auth (`/auth/v1/token`, `/auth/v1/user`) · `GET /me` para resolver workspace |
| **Notas** | Login en `src/pages/Login.tsx` es el ÚNICO lugar fuera de `src/lib/*` que llama a `supabase.auth.signInWithPassword`. Excepción documentada. |

---

## §2 · Catálogo

### 2.1 · Promociones

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.promotions` |
| **Helper TS** | `src/lib/promotionsByOwner.ts` · `getPromotionsByOwner(orgId)`, `getActivePromotionsByOwner(orgId)` · plus `src/data/promotions.ts` y `src/data/developerPromotions.ts` (seeds estáticos) |
| **Tipo TS** | `Promotion` (`src/data/promotions.ts`) · `DevPromotion` (`src/data/developerPromotions.ts`) |
| **localStorage key** | (none · seed estático) |
| **Write-through** | ❌ pendiente · seed estático lectura-only |
| **Endpoints futuros** | `GET /promotions` (own) · `GET /promotions/marketplace` (public subset) · `GET /promotions/:id` · `POST /promotions` · `PATCH /promotions/:id` · `DELETE /promotions/:id` |
| **Notas** | Mock single-tenant: TODAS las promotions tienen `owner_organization_id = 'developer-default'` salvo `EXTERNAL_PROMOTOR_PORTFOLIO[orgId]` (promotores externos). Phase 3: unificar en una sola tabla. |

### 2.2 · Promotion units / anejos / gallery / payment plans

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.promotion_units` · `public.promotion_anejos` · `public.promotion_gallery` · `public.payment_plans` |
| **Helper TS** | `src/lib/anejosStorage.ts` (parcial) · resto sin helper dedicado · datos viven en `Promotion.metadata` |
| **Tipo TS** | (sin tipos canónicos aún) |
| **localStorage key** | `byvaro.anejos.v1` (anejos) · resto en seed |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /promotions/:id/units` · `GET /promotions/:id/anejos` · `GET /promotions/:id/gallery` · `GET /promotions/:id/payment-plans` |
| **Notas** | Tablas creadas en migración 100001, listas para que un Phase 3 wireara los CRUDs. |

### 2.3 · Promotores externos

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organizations` (kind=developer) |
| **Helper TS** | `src/lib/useResolvedAgencies.ts` · `useResolvedPromotores()` |
| **Tipo TS** | `Agency` (mismo shape que agencias · convención de mock single-tenant) |
| **localStorage key** | `byvaro-empresa:prom-*` (vía hydrator) |
| **Write-through** | ✅ via empresa.ts (mismo helper que agencies) |
| **Endpoints futuros** | `GET /promoters` (lista externa para agency view) · `GET /organizations/:id/public` |
| **Notas** | En el mock se importan estáticamente desde `src/data/promotores.ts`. El hydrator escribe `byvaro-empresa:prom-1...prom-4` para que las pantallas vean datos coherentes. Phase 3: deprecar `data/promotores.ts`. |

---

## §3 · Colaboración B2B

### 3.1 · Solicitudes (3 kinds)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.collab_requests` (única tabla con `kind` discriminante) |
| **Helper TS** | `src/lib/orgCollabRequests.ts` (kind=org_request) · `src/lib/solicitudesColaboracion.ts` (kind=promotion_request) · `src/lib/invitaciones.ts` (kind=invitation) · `src/lib/collabRequests.ts` (adapter unificado read-only) |
| **Tipo TS** | `OrgCollabRequest` · `SolicitudColaboracion` · `Invitacion` · `CollabRequest` (unificado) |
| **localStorage key** | `byvaro.org-collab-requests.v1` · `byvaro.agency.collab-requests.v1` · `byvaro-invitaciones` |
| **Write-through** | ✅ (las 3 cara) |
| **Endpoints futuros** | `GET /collab-requests?direction=&status=&kind=` · `POST /collab-requests` · `POST /collab-requests/:id/{accept,reject,cancel,restore}` |
| **Notas** | **REGLA CRÍTICA**: cuando `kind='promotion_request'` y `status='rejected'` y el caller es el sender (`fromOrgId === currentOrg`), backend debe enmascarar status como `'pending'` (descarte silencioso · `docs/backend-dual-role-architecture.md §5.5`). |

### 3.2 · Colaboraciones materializadas

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organization_collaborations` (org↔org) · `public.promotion_collaborations` (per-promo) |
| **Helper TS** | (read implícito en `useResolvedAgencies` · sin helper dedicado aún) · `src/lib/promoCollabStatus.ts` para pause/resume |
| **Tipo TS** | (no canónico TS aún · backend devuelve raw rows) |
| **localStorage key** | `byvaro.promoCollabStatus.v1` |
| **Write-through** | ⚠️ parcial · pause/resume sí · creación al accept de request es server-side via accept transaction |
| **Endpoints futuros** | `GET /collaborations` · `PATCH /collaborations/:id/{pause,resume,end}` · `GET /promotion-collaborations` · `POST /promotion-collaborations/:id/{approve,reject}` · `PATCH /promotion-collaborations/:id/{pause,resume,end}` |
| **Notas** | Constraint `organization_a_id < organization_b_id` (par conmutativo · trigger lo normaliza). |

### 3.3 · Documentos de colaboración (contratos Firmafy)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.collaboration_documents` |
| **Helper TS** | `src/lib/collaborationContracts.ts` |
| **Tipo TS** | `CollaborationContract` |
| **localStorage key** | `byvaro.collaborationContracts.v1` |
| **Write-through** | ❌ pendiente · seed mock |
| **Endpoints futuros** | `GET /promotion-collaborations/:id/documents` · `POST /promotion-collaborations/:id/documents` · `POST /documents/:id/send-to-sign` · `POST /documents/:id/revoke` |
| **Notas** | Solo developer-side admin puede uploadear (regla §11 #10). Agencias firman vía email + SMS OTP (Firmafy webhook actualiza `signed_file_url` y `audit_file_url`). Pendiente integración Firmafy real (Phase 3). |

### 3.4 · Promo collab status pause/resume per-promo

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.promotion_collaborations.status` |
| **Helper TS** | `src/lib/promoCollabStatus.ts` |
| **Tipo TS** | `PromoCollabStatus = "activa" \| "pausada" \| "anulada"` |
| **localStorage key** | `byvaro.promoCollabStatus.v1` |
| **Write-through** | ❌ pendiente · solo localStorage |
| **Endpoints futuros** | `PATCH /agencias/:agencyId/promotions/:promoId/collab-status` |
| **Notas** | Mantener datos históricos: `pausada` y `anulada` solo afectan visibilidad/operativa futura · ventas/registros pasados se preservan (regla CLAUDE.md "Ciclo de vida de la colaboración por promoción"). |

### 3.5 · Favoritos de agencias / promotores

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.user_favorites` (user_id + kind + target_id) |
| **Helper TS** | `src/lib/favoriteAgencies.ts` |
| **Tipo TS** | (Set<string> de IDs) |
| **localStorage key** | `byvaro-favoritos-agencias` |
| **Write-through** | ✅ |
| **Endpoints futuros** | `GET /favorites?kind=agency` · `POST /favorites` · `DELETE /favorites/:target_id` |
| **Notas** | Per-USER (no per-org). RLS: `user_id = auth.uid()`. |

### 3.6 · Track record / domain match notify

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | (parte de `audit_events` cuando aterrice) |
| **Helper TS** | `src/lib/agencyTrackRecord.ts` · `src/lib/agencyDomainLookup.ts` · `src/lib/domainMatchNotifyEmail.ts` |
| **Tipo TS** | varios (TrackRecordEntry, DomainMatch) |
| **localStorage key** | (varios) |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /agencies/:id/track-record` · `POST /agencies/:id/domain-match-notify` |
| **Notas** | Phase 3 lo gestiona como audit log. |

---

## §4 · CRM core (registros, ventas, calendario, contactos)

### 4.1 · Registros (leads cualificados con IA duplicados)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.registros` + `public.registro_events` |
| **Helper TS** | `src/lib/registrosStorage.ts` · `addCreatedRegistro`, `updateRegistroState`, `useCreatedRegistros` |
| **Tipo TS** | `Registro` (`src/data/records.ts`) |
| **localStorage key** | `byvaro.registros.created.v1` |
| **Write-through** | ✅ create + update |
| **Endpoints futuros** | `GET /registros` · `POST /promotions/:id/registros` · `PATCH /registros/:id/{aprobar,rechazar,cancelar}` · `GET /registros/:id/match` (IA duplicados) |
| **Notas** | Regla "first-come silent" intra-promoción · backend valida antes de aprobar. Cross-promo conflict: warning UI, no bloqueo. IA de duplicados: `match_percentage` 0-100 (≥70 sugiere rechazo). |

### 4.2 · Leads (bandeja de entrada sin cualificar)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.leads` |
| **Helper TS** | `src/components/leads/leadAssigneeStorage.ts` (parcial · solo asignaciones) |
| **Tipo TS** | (no canónico TS aún) |
| **localStorage key** | (varios mock-only) |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /leads` · `POST /leads/:id/qualify` (convierte a registro) |
| **Notas** | Phase 3 wirea full CRUD. Hoy mock-only. |

### 4.3 · Ventas

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.sales` + `public.sale_payments` |
| **Helper TS** | (sin helper dedicado · `src/data/sales.ts` seed estático) |
| **Tipo TS** | `Venta` (`src/data/sales.ts`) |
| **localStorage key** | (none · in-memory state en `/ventas`) |
| **Write-through** | ❌ pendiente · refactor a `salesStorage.ts` necesario |
| **Endpoints futuros** | `GET /sales` · `POST /promotions/:id/sales` · `PATCH /sales/:id` (status transitions: reservada→contratada→escriturada) · `GET /sales/:id/payments` |
| **Notas** | Distinguir "venta cerrada" (contratada+escriturada) vs "venta terminada" (escriturada). Comisiones devengan al cerrar, se pagan al terminar. CLAUDE.md regla "Venta cerrada vs venta terminada". |

### 4.4 · Calendario / visitas

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.calendar_events` + `public.visit_evaluations` |
| **Helper TS** | `src/lib/calendarStorage.ts` · `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, `useCalendarEvents` |
| **Tipo TS** | `CalendarEvent` (`src/data/calendarEvents.ts`) |
| **localStorage key** | `byvaro.calendar.overrides.v1` · `byvaro.calendar.deleted.v1` · `byvaro.calendar.created.v1` (cache hidratado) |
| **Write-through** | ✅ (create/update/delete) |
| **Endpoints futuros** | `GET /calendar/events` · `POST /calendar/events` · `PATCH /calendar/events/:id` · `DELETE /calendar/events/:id` · `GET /calendar/events/conflicts` |
| **Notas** | Conflict check (solapamiento) PRE-validation server-side · ADR-056. Visit evaluation triggers transición de registro pre→aprobado. |

### 4.5 · Contactos

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.contacts` + `public.contact_events` |
| **Helper TS** | `src/components/contacts/createdContactsStorage.ts`, `contactEventsStorage.ts`, `contactDocumentsStorage.ts`, `contactRelationsStorage.ts`, `contactCommentsStorage.ts`, `contactTagsStorage.ts`, `contactLanguagesStorage.ts`, `contactEditsStorage.ts`, `contactAvatarStorage.ts`, `tagsStorage.ts`, `relationTypesStorage.ts`, `sourcesStorage.ts`, `importedStorage.ts`, `visitEvaluationsStorage.ts` |
| **Tipo TS** | `Contact`, `ContactEvent` (`src/components/contacts/types.ts`) |
| **localStorage key** | (varios) |
| **Write-through** | ❌ pendiente · DEUDA TÉCNICA · 14 archivos a migrar al patrón canónico |
| **Endpoints futuros** | `GET /contacts` · `POST /contacts` · `PATCH /contacts/:id` · `POST /contacts/:id/events` · `GET /contacts/:id/events` |
| **Notas** | Phase 3 prioritario. Cuando se migre, todos estos sub-stores se concentran en `src/lib/contactsStorage.ts` siguiendo el patrón canónico. |

### 4.6 · Match score / IA duplicados

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | (computed · no tabla) |
| **Helper TS** | `src/lib/matchScore.ts` · `src/lib/registrationMatcher.ts` · `src/lib/registroContactLink.ts` |
| **Tipo TS** | varios (MatchResult, etc.) |
| **localStorage key** | (none · pure compute) |
| **Write-through** | (no aplica) |
| **Endpoints futuros** | `POST /match/score` (IA real Anthropic Haiku · futuro) |
| **Notas** | Hoy lógica heurística cliente · Phase 4: backend IA real con Claude. |

---

## §5 · Comunicación

### 5.1 · Notificaciones in-app (bell)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.notifications` |
| **Helper TS** | `src/lib/notifications.ts` · `recordNotification`, `markRead`, `markAllRead`, `useNotifications` |
| **Tipo TS** | `Notification` |
| **localStorage key** | `byvaro.notifications.v1` |
| **Write-through** | ⚠️ parcial · `markRead` ✅ · `recordNotification` (creación) ❌ |
| **Endpoints futuros** | `GET /notifications` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` |
| **Notas** | Phase 3: backend genera notificaciones (no el cliente). Hoy las dispara el frontend mock. |

### 5.2 · Emails enviados / templates / webhooks

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.emails_sent` + `public.email_events` + `public.email_templates` |
| **Helper TS** | `src/lib/sentEmails.ts` · `src/components/email/SendEmailDialog.tsx` (UI) · `src/components/email/emailTemplates.ts` (catálogo cliente) |
| **Tipo TS** | (no canónico TS aún) |
| **localStorage key** | `byvaro.sent-emails.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `POST /emails/send` · `POST /emails/send-to-collaborators` (bulk) · `GET /emails/sent` · `GET /email-templates` · `PATCH /email-templates/:id` · webhook entrante: `POST /webhooks/email/{delivered,opened,bounced}` |
| **Notas** | Templates registrados en `/ajustes/plantillas`. Phase 3 conecta Resend o SMTP. |

### 5.3 · WhatsApp

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.whatsapp_conversations` + `public.whatsapp_messages` |
| **Helper TS** | `src/lib/whatsappStorage.ts` · `src/components/contacts/whatsappMessagesMock.ts` |
| **Tipo TS** | (no canónico TS aún) |
| **localStorage key** | (varios mock-only) |
| **Write-through** | ❌ pendiente · sin integración Baileys/Meta |
| **Endpoints futuros** | `POST /whatsapp/messages/send` · webhook entrante: `POST /webhooks/whatsapp/inbound` |
| **Notas** | Phase 4 grande · Baileys (Web) o Meta Business API (oficial). |

### 5.4 · Invitaciones a miembros

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | (parte de `collab_requests` con kind especial · O tabla nueva) |
| **Helper TS** | `src/lib/responsibleInvitations.ts` · `src/lib/responsibleInviteEmail.ts` · `src/lib/teamInvitationEmail.ts` |
| **Tipo TS** | varios |
| **localStorage key** | `byvaro.responsible-invitations.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `POST /organizations/me/members/invitations` · `POST /invitations/:token/accept` |
| **Notas** | Diferente de invitaciones DE colaboración (`invitaciones.ts` cubre ese flujo). Aquí es invitar a un MIEMBRO al workspace propio. |

---

## §6 · Plan & billing

### 6.1 · Plan / tier del workspace

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.workspace_plans` |
| **Helper TS** | `src/lib/plan.ts` (read mock) · `src/lib/usage.ts` (counters mock) · `src/lib/usageGuard.ts` (gate UI) · `src/lib/usagePressure.ts` (UpgradeReason) |
| **Tipo TS** | `Plan` (mock) |
| **localStorage key** | `byvaro.plan.v1` (mock advisory · NO confiable) |
| **Write-through** | ❌ por diseño · CLAUDE.md regla §1 dice "Stripe es la única autoridad" |
| **Endpoints futuros** | `GET /plan` · webhook Stripe activa el tier (`POST /webhooks/stripe`) |
| **Notas** | El cliente NO puede mutar `workspace_plans.tier`. Solo el webhook de Stripe lo hace via service_role. Frontend solo LEE. |

### 6.2 · Paywall events / subscriptions / Stripe

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.paywall_events` · `public.subscriptions` · `public.stripe_events_processed` |
| **Helper TS** | `src/lib/analytics.ts` (tracking eventos paywall · console + posthog) |
| **Tipo TS** | (no canónico TS aún) |
| **localStorage key** | (none) |
| **Write-through** | ❌ pendiente integración Stripe |
| **Endpoints futuros** | `POST /paywall/events` (track) · `POST /webhooks/stripe` (idempotency via `stripe_events_processed.event_id`) · `GET /subscriptions/me` · `POST /checkout/session` |
| **Notas** | Webhook idempotente OBLIGATORIO. Activar `tier=promoter_249` SOLO desde el webhook (regla CLAUDE.md §1). |

### 6.3 · Facturas a agencias / pagos

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.agency_invoices` · `public.agency_payments` |
| **Helper TS** | `src/lib/agencyInvoices.ts` · `src/lib/agencyPayments.ts` |
| **Tipo TS** | varios |
| **localStorage key** | `byvaro.agencyInvoices.v1` · `byvaro.agencyPayments.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /agencias/:id/invoices` · `POST /agencias/:id/invoices/generate` · `GET /agencias/:id/payments` · `POST /agencias/:id/payments/:id/pay` |
| **Notas** | Comisiones devengadas vs pagadas distintas (`docs/backend-integration.md §4.0`). |

---

## §7 · Permisos & auditoría

### 7.1 · Permission grants

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.permission_grants` |
| **Helper TS** | `src/lib/permissions.ts` · `useHasPermission(key)` |
| **Tipo TS** | `PermissionKey` (union literal) |
| **localStorage key** | `byvaro.workspace.rolePermissions.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /permissions/me` · `POST /members/:id/permissions/:key` (grant) · `DELETE /members/:id/permissions/:key` (revoke) |
| **Notas** | Default por rol (admin/member) en `DEFAULT_ROLE_PERMISSIONS`. Override fino vía `permission_grants` cuando aterrice. |

### 7.2 · Audit log cross-empresa (historial colaborador)

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.audit_events` (ya existe) |
| **Helper TS** | `src/lib/companyEvents.ts` · `recordCompanyEvent(...)` |
| **Tipo TS** | `CompanyEvent` |
| **localStorage key** | `byvaro.companyEvents.v1` · `byvaro.companyEvents.seeded.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `GET /organizations/:id/audit` (cross-org · admin only) · `POST /audit/events` (write append-only) |
| **Notas** | CLAUDE.md regla "Historial entre empresas" · solo admin ve cross-tenant. |

### 7.3 · Audit log per-contacto

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.contact_events` (ya existe) |
| **Helper TS** | `src/components/contacts/contactEventsStorage.ts` |
| **Tipo TS** | `ContactEvent` |
| **localStorage key** | (mock) |
| **Write-through** | ❌ pendiente · DEUDA TÉCNICA |
| **Endpoints futuros** | `GET /contacts/:id/events` · `POST /contacts/:id/events` |
| **Notas** | Migrar junto con el resto de contacts (§4.5). |

---

## §8 · Marketing / canales

### 8.1 · Reglas de marketing por promoción

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.promotions.marketing_prohibitions text[]` (ya existe) |
| **Helper TS** | `src/lib/marketingRulesStorage.ts` · `useMarketingProhibitions(promotionId)` |
| **Tipo TS** | (Set<string> de channel IDs) |
| **localStorage key** | `byvaro.marketingRules.v1` |
| **Write-through** | ❌ pendiente |
| **Endpoints futuros** | `PATCH /promotions/:id { marketing_prohibitions }` · webhook portal externo: `POST /webhooks/portal/violation` |
| **Notas** | Catálogo canónico `MARKETING_CHANNELS` en `src/lib/marketingChannels.ts`. |

### 8.2 · Marketing snapshot del workspace

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organization_profiles.marketing_*` (ya existe) |
| **Helper TS** | `src/lib/empresa.ts` (vía Empresa fields) · `src/lib/marketingCatalog.ts` (catálogos) |
| **Tipo TS** | parte de `Empresa` |
| **localStorage key** | `byvaro-empresa:<orgId>` |
| **Write-through** | ✅ (parte del save de empresa) |
| **Endpoints futuros** | parte de `PATCH /organizations/me` |

---

## §9 · UI metadata / borradores

### 9.1 · Drafts de wizards

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | (no aplica · client-only) |
| **Helper TS** | `src/lib/promotionDrafts.ts` · `src/lib/pendingAttachments.ts` · `src/lib/unsavedGuard.ts` |
| **Tipo TS** | varios |
| **localStorage key** | `byvaro-crear-promocion-draft` · `byvaro-promotion-drafts` |
| **Write-through** | (no aplica · datos efímeros del wizard) |
| **Notas** | NO migrar · son drafts client-side por diseño. |

### 9.2 · Onboarding state

| Campo | Valor |
|---|---|
| **Tabla(s) DB** | `public.organization_profiles.visibility_status` (ya existe) |
| **Helper TS** | `src/lib/empresaOnboarding.ts` · `src/lib/agencyOnboarding.ts` |
| **Tipo TS** | varios |
| **localStorage key** | `byvaro.empresa.onboarding.v1` · `byvaro.agencies.onboarding.v1` |
| **Write-through** | ⚠️ parcial · estado deriva de campos de empresa |
| **Endpoints futuros** | derivado de `GET /organizations/me` |

---

## §10 · Tabla rápida de estado por dominio

| Dominio | Tablas creadas | Helper canónico | Write-through | Hidratación al login |
|---|:-:|:-:|:-:|:-:|
| Empresa (org + profile) | ✅ | ✅ | ✅ | ✅ |
| Oficinas | ✅ | ✅ | ✅ | ✅ |
| Members | ✅ | ⚠️ seed | ❌ | ⚠️ derivado |
| Auth | ✅ | ✅ | ✅ | ✅ |
| Promotions | ✅ | ⚠️ read-only | ❌ | ❌ |
| Promo units/anejos/gallery | ✅ | ❌ | ❌ | ❌ |
| Solicitudes (3 kinds) | ✅ | ✅ | ✅ | ✅ |
| Org collaborations | ✅ | ⚠️ read | ⚠️ | ⚠️ |
| Promo collaborations | ✅ | ⚠️ read | ❌ | ❌ |
| Collaboration documents | ✅ | ⚠️ mock | ❌ | ❌ |
| User favorites | ✅ | ✅ | ✅ | ✅ |
| Registros | ✅ | ✅ | ✅ create/update | ✅ |
| Leads | ✅ | ❌ mock | ❌ | ❌ |
| Sales | ✅ | ❌ seed | ❌ | ✅ read-hydrate |
| Sale payments | ✅ | ❌ seed | ❌ | ✅ via sales |
| Calendar events | ✅ | ✅ | ✅ | ✅ |
| Visit evaluations | ✅ | ⚠️ via calendar | ❌ | ❌ |
| Contacts (todo) | ✅ | ❌ mock 14 archivos | ❌ | ❌ |
| Notifications | ✅ | ✅ | ⚠️ markRead solo | ✅ |
| Emails sent | ✅ | ❌ mock | ❌ | ❌ |
| Email templates | ✅ | ❌ | ❌ | ❌ |
| WhatsApp | ✅ | ❌ mock | ❌ | ❌ |
| Workspace plans | ✅ | ❌ mock | ❌ (Stripe) | ❌ |
| Subscriptions | ✅ | ❌ | ❌ | ❌ |
| Paywall events | ✅ | ⚠️ tracking | ❌ | ❌ |
| Permission grants | ✅ | ⚠️ defaults | ❌ | ❌ |
| Audit events | ✅ | ⚠️ | ❌ | ❌ |
| Marketing rules | ✅ (column) | ⚠️ mock | ❌ | ❌ |

Leyenda · ✅ implementado · ⚠️ parcial · ❌ pendiente.

---

## §11 · Cómo usa este doc el backender que llegue mañana

1. **Localiza el dominio** que vas a tocar en §1-§9.
2. **Lee la tabla** de ese dominio · te dice exactamente:
   - Qué columnas DB tiene la tabla.
   - Qué shape devuelve el helper TS al frontend.
   - Qué localStorage key usa el cache.
   - Qué endpoints REST tienes que construir.
3. **Si vas a cambiar el shape de respuesta** del backend, debes a la
   vez actualizar el tipo TS del helper · cero divergencia.
4. **Si vas a añadir una columna**, añádela también al mapper TS y al
   tipo TS · cero divergencia.
5. **Si vas a sustituir Supabase por backend custom**:
   - Mantén el mismo shape de respuesta de los endpoints (los listados
     en cada `Endpoints futuros`).
   - Solo cambia la implementación interna de cada helper de
     `supabase.from(...)` a `fetch(...)`.
   - Componentes de la UI no se tocan.
   - RLS de Supabase se traduce a guards server-side · misma lógica.

---

## §12 · Convenciones inflexibles · resumen para AI

> "Cada dominio tiene UN helper canónico en `src/lib/*` (con suffix
> `Storage.ts` o sin él, da igual el nombre). El helper conoce la
> tabla DB Y la cache localStorage. Componentes solo hablan con el
> helper · NUNCA con Supabase ni localStorage directamente.
>
> El tipo TS del helper es el contrato del backend · cualquier
> endpoint que vaya a alimentar ese helper DEBE devolver
> exactamente ese shape.
>
> El mapper `dbRowToShape(...)` vive en el helper · es el único
> lugar que sabe traducir snake_case (DB) a camelCase (TS).
>
> Cuando cambies algo en este doc o en el código, actualiza ambos
> en el mismo commit."
