# Pantalla · Ficha de contacto (`/contactos/:id`)

> Spec funcional completa de la ficha de un contacto. Página fullscreen
> dentro del `AppLayout`, sin master-detail (tras decisión del usuario).
> Implementada en `src/pages/ContactoDetalle.tsx` con sub-componentes
> en `src/components/contacts/detail/*`.

## Propósito

Vista 360° de un cliente / lead del workspace. Reúne en un solo lugar:
identidad, actividad histórica, leads y oportunidades, visitas,
documentos, emails, WhatsApp. Es el lugar donde el agente trabaja a
diario: lee, anota, programa, responde, evalúa.

Las acciones críticas (eliminar, asignar miembros, vincular a otro
contacto, evaluar visita, subir doc, enviar WhatsApp / email) viven
inline en sus respectivos tabs o en el sidebar del Resumen — no en una
toolbar global.

## Layout general

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Contactos                                                      │ ← back
├──────────────────────────────────────────────────────────────────┤
│ [🇦🇪] Ahmed Al-Rashid · Activo                                   │
│       CON-0001 · Score 87 · ahmed.alrashid@gulf.ae · Hace 2h    │ ← header
│                                          [Editar] [⋯]           │
├──────────────────────────────────────────────────────────────────┤
│ Resumen │ Historial │ Registros │ Operaciones │ Visitas │       │ ← tabs
│ Documentos │ Emails │ WhatsApp                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   { contenido del tab activo }                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Max-width `1400px`. Padding `px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8`.

## Header

- **Avatar**: bandera del país si existe (`detail.flag`), si no
  iniciales sobre `bg-foreground/5 rounded-xl`. Badge ámbar 🔥 si
  `leadScore >= 75` (lead caliente).
- **Línea 1**: nombre + status pill (Activo / Pendiente / Cliente / Frío).
  Si es lead caliente, el status pill se oculta (la 🔥 ya comunica).
- **Línea 2 (meta inline)**: chip de referencia (`CON-XXXX`) clickable
  para copiar al portapapeles · `Score N` · email principal (link a
  `/emails?compose=1&to=...`) · "última actividad".
- **Acciones**:
  - "Editar" (solo en tab Resumen) → abre `EditContactDialog`.
  - Menú "⋯" siempre visible → "Eliminar contacto" (requiere
    `contacts.delete`, ver `docs/permissions.md`).

## Tabs

URL: `?tab=<id>` (deep-linkable). `resumen` se omite del query param.

| id | Label | Componente | Estado |
|---|---|---|---|
| `resumen` | Resumen | `ContactSummaryTab` | ✅ |
| `historial` | Historial | `ContactHistoryTab` | ✅ |
| `registros` | Registros | `ContactRecordsTab` | ✅ |
| `operaciones` | Operaciones | `ContactOperacionesTab` | ✅ |
| `visitas` | Visitas | `ContactVisitsTab` | ✅ |
| `documentos` | Documentos | `ContactDocumentsTab` | ✅ |
| `emails` | Emails | `ContactEmailsTab` | ✅ |
| `whatsapp` | WhatsApp | **modal** (`ContactWhatsAppDialog`) | ✅ |

> El tab "WhatsApp" intercepta el click → abre el modal lateral, NO
> cambia `activeTab`. Ver ADR-043.

### Tab · Resumen

Layout 2 columnas en desktop, 1 en mobile. Datos del contacto +
sidebar de gestión.

**Columna principal** (más ancha):
- Card **Información personal** (nombre, NIF, fecha nac., nacionalidad).
- Card **Datos de contacto** (teléfonos múltiples + emails múltiples
  con marca "Principal" y verified). Cada teléfono tiene icono
  WhatsApp que **abre el modal** lateral.
- Card **Idiomas** (chips).
- Card **Origen** (sourceType + source label).
- Card **Etiquetas** (org + personales del usuario).

**Sidebar** (~300px):
- **Banner Tareas pendientes** (visitas done sin evaluar, fecha en
  rojo si pasó, CTA "Evaluar →" → abre `EvaluateVisitDialog`).
- Card **Asignados** (avatares + nombre + permisos can/canEdit; CTA
  "Asignar miembros" → `AssignMembersDialog` requiere
  `contacts.assign`).
- Card **Contactos relacionados** (nombre + tipo de relación
  resuelto vía `getRelationLabel(id)`; CTA "Vincular contacto" →
  `LinkContactDialog`).
- Card **Estado** (métricas + consentimientos GDPR / newsletter /
  comercial).
- Card **Próxima acción** y **Operación en curso** (si aplican,
  derivadas de `nextVisit` y `activeDeal`).

### Tab · Historial

Audit log unificado del contacto. Toda acción que pase sobre el
contacto deja un evento aquí (regla de oro CLAUDE.md, ADR-040).

**Sub-pills** (filtros por categoría):
- Todo · Comentarios · Emails · WhatsApp · Web · Sistema (con
  contadores).

**Editor de comentarios inline** — visible cuando sub-pill activo es
"Todo" o "Comentarios". Textarea + Enter para enviar / Shift+Enter
salto de línea. Llama a `addComment()` + `recordCommentAdded()`.
**No hay tab Comentarios separado** (ADR-041).

**Timeline vertical** con línea continua + burbujas de iconos por
tipo de evento + cards a la derecha agrupadas por día (Hoy / Ayer /
"lunes 22 abril"). Cada card muestra título + descripción + actor
(avatar pravatar + nombre) + hora.

Tipos de evento soportados (~25):
- Identidad: `contact_created` · `contact_edited` (con diff) ·
  `contact_deleted`.
- Asignación / vinculación: `assignee_added/removed` ·
  `relation_linked/unlinked` (bidireccional).
- Etiquetas / status: `tag_added/removed` · `status_changed`.
- Visitas: `visit_scheduled/done/cancelled/evaluated`.
- Comunicación: `email_sent/received/delivered/opened` ·
  `whatsapp_sent/received` · `call`.
- Comentarios: `comment` (kind `user` | `system`).
- Negocio: `registration` (alta de lead) · `web_activity`.
- Documentos: `document_uploaded/deleted`.
- Sistema: `system_change` · `lead_entry`.

**Eventos de email son CLICKABLES** → llevan a `/emails?contact=<id>`.
**Nunca** al `?tab=emails` de la ficha (ADR-045).

Eventos del sistema (actor `Sistema`) renderizan con borde dashed +
fondo `bg-muted/30` + avatar de bot.

### Tab · Registros

Bandeja cronológica de leads/registros del contacto. Vista de log,
distinta de Operaciones (que es vista de pipeline).

**KPIs arriba**: Total · Pendientes · Convertidos · Cancelados.

**Lista de cards** ordenadas desc por timestamp. Cada card:
- Pill estado (Pendiente / Aprobado / Cancelado / Convertido).
- Título promoción · unidad (link a `/promociones/:id`).
- "De: [origen]" (Idealista / Fotocasa / agencia / microsite / manual).
- "Asignado a: [agente]".
- Bloque finalidad si Convertido (link "Ver operación →" a
  `/ventas?id=...`) o Cancelado (motivo).
- Nota del agente opcional (italic).
- Footer: hash blockchain (mono) + CTA "Ver registro completo →" a
  `/registros?id=...`.

### Tab · Operaciones

Vista de pipeline operacional con 3 zonas (ADR-042, replicado de
Lovable):

**Zona 1 · Botón "+ Añadir oportunidad"** — pill negro arriba derecha
(stub, abre `AddOpportunityDialog` cuando esté cableado).

**Zona 2 · Banner verde "Compra en curso"** — visible si hay un lead
convertido con `convertedSaleId`. Estructura:
- Icono briefcase + título "Compra en curso" + unidad/promoción.
- Pill "En curso" arriba derecha.
- 3 KPIs en fila: Precio · Señal · Fecha de inicio.
- CTA "Ver venta →" → `/ventas/:id`.

**Zona 3 · Card "Oportunidades (N)"** — `ContactOpportunityEntry[]`.
Cada row:
- Thumbnail del inmueble (~80x60).
- Título: unidad · promoción.
- Subtítulo: agencia · agente.
- Pill estado (Activa / Ganada / Archivada).
- Bloque **CLIENT INTERESTS**: Tipo · Zona · Presupuesto · Dormitorios
  (con iconos `Home / MapPin / Tag / Eye`).
- Chips de tags ("Vistas al mar", "Inversión"…).
- CTA "Ver oportunidad →" → `/oportunidades/:id`.

**Zona 4 · Card "Leads (N)"** — `ContactRecordEntry[]`. Cada row:
- Thumbnail del inmueble.
- Título: unidad · promoción.
- "Desde [origen] · [fecha]".
- Ref + landing.
- Pill estado (Convertido / Abierto / Pendiente / Cancelado).

> Tab Registros y card Leads de Operaciones muestran datos parecidos
> pero con propósito distinto: Registros = log cronológico con KPIs;
> Operaciones · Leads = vista compacta junto a las oportunidades.

### Tab · Visitas

Lista de visitas del contacto con su estado (programada / realizada /
cancelada / reprogramada). Visitas done sin evaluation aparecen como
**tareas pendientes** del agente (regla de negocio del producto).

CTA por visita: "Evaluar →" abre `EvaluateVisitDialog`.

### Tab · Documentos

Lista por categoría (Identidad / Legal / Comercial / Otros). Acciones:
- Subir archivo real (FileReader → dataUrl, max 1.5 MB).
- Vista previa inline (img / pdf / fallback).
- Descarga (dataUrl).
- Selección múltiple → enviar por email o WhatsApp.
- Eliminar (solo locales, registra `recordDocumentDeleted`).

Envío por WhatsApp al propio contacto **abre el modal lateral**
(no navega).

### Tab · Emails

Vista de RESUMEN, nunca cliente de email (ADR-045). Estructura:

1. **Banner azul "N emails nuevos sin leer"** si hay `email_received`
   reciente sin respuesta — link a `/emails?contact=<id>`.
2. **Card "Actividad de email"** con stats: Enviados · Recibidos ·
   Entregados · Abiertos. Click en cualquier sitio → `/emails?contact=<id>`.
3. **Card "Enviados por usuario"** — lista de agentes que han enviado
   emails con count y último envío. Click → `/emails?contact=<id>`.
4. **CTA grande final** "Ver todos los emails con este contacto" →
   `/emails?contact=<id>`.

Empty state: CTA "Enviar primer email" → `/emails?compose=1&to=`.

### Modal · WhatsApp

ADR-043. Modal lateral (`ContactWhatsAppDialog`) que envuelve
`ContactWhatsAppTab` en `mode="modal"`:

- Backdrop `bg-foreground/10 backdrop-blur-md` desenfoca la ficha.
- Panel anclado a la derecha, slide-in.
- `h-[100dvh]` · 920px ancho en md+ · fullscreen en mobile.
- Botón cerrar (X) arriba derecha.
- Contenido = chat (~620px) + sidebar de agentes (300px) en md+;
  solo chat en mobile.

Entry points que abren el modal:
1. Click en el tab "WhatsApp" (intercepta antes de cambiar tab).
2. Icono WhatsApp del bloque "Teléfonos" en Resumen.
3. Tras enviar documentos por WhatsApp al propio contacto desde
   Documentos.

## Datos

Los datos vienen de `buildContactDetail(base, allContacts)` en
`src/components/contacts/contactDetailMock.ts` — generador determinista
por seed (mismo `contact.id` → mismo `ContactDetail`).

Tipos canónicos en `src/components/contacts/types.ts`:
- `Contact` (base del listado)
- `ContactDetail` (extiende Contact con campos de la ficha)
- `ContactPhone` · `ContactEmailAddress`
- `ContactRecordEntry` (lead/registro)
- `ContactOpportunityEntry` (oportunidad)
- `ContactActiveOperation` (banner "Compra en curso")
- `ContactVisitEntry` · `VisitEvaluation`
- `ContactDocumentEntry`
- `ContactCommentEntry`
- `ContactTimelineEvent` (audit log)
- `ContactAssignedUser`
- `ContactRelation`
- `ContactConsent`

Storages locales (mock backend):
- `byvaro.contact.<id>.events.v1` — audit log (cap 500).
- `byvaro.contact.<id>.comments.v1` — comentarios añadidos.
- `byvaro.contact.<id>.documents.v1` — documentos subidos.
- `byvaro.contact.<id>.related.v1` — vínculos override.
- `byvaro.contact.<id>.assigned.v1` — asignados override.
- `byvaro.contacts.relationTypes.v1` — catálogo de tipos de relación
  (ver ADR-044).

## Permisos requeridos por acción

(Catálogo completo en `docs/permissions.md`.)

| Acción | Permiso |
|---|---|
| Ver la ficha | `contacts.viewOwn` (en assigned) o `contacts.viewAll` |
| Editar campos | `contacts.edit` |
| Eliminar contacto | `contacts.delete` |
| Asignar miembros | `contacts.assign` |
| Vincular a otro contacto | `contacts.edit` |
| Subir documento | `documents.upload` |
| Eliminar documento | `documents.delete` |
| Compartir doc por email | `emails.send` + `documents.share` |
| Compartir doc por WhatsApp | `whatsapp.viewOwn` + `documents.share` |
| Evaluar visita | `visits.evaluate` |
| Programar visita | `visits.schedule` |
| Aprobar/rechazar registro | `records.approve` / `records.reject` |
| Crear oportunidad | `opportunities.create` |
| Archivar oportunidad | `opportunities.archive` |

> **Estado actual**: Solo WhatsApp + delete de contacto respetan
> permisos. El resto está abierto. Migración en
> `docs/permissions.md` §6.

## API endpoints esperados (resumen)

> Contrato completo en `docs/backend-integration.md`. Aquí el resumen
> específico de la ficha:

```
GET    /api/contacts/:id                  → ContactDetail
PATCH  /api/contacts/:id                  → ContactDetail
DELETE /api/contacts/:id

GET    /api/contacts/:id/events           → ContactTimelineEvent[] (paginado)
POST   /api/contacts/:id/events           → ContactTimelineEvent
GET    /api/contacts/:id/comments
POST   /api/contacts/:id/comments
PATCH  /api/contacts/:id/comments/:cid
DELETE /api/contacts/:id/comments/:cid

GET    /api/contacts/:id/records          → ContactRecordEntry[]
GET    /api/contacts/:id/opportunities    → ContactOpportunityEntry[]
GET    /api/contacts/:id/operations       → { activeOperation, ... }
GET    /api/contacts/:id/visits           → ContactVisitEntry[]
POST   /api/contacts/:id/visits/:vid/evaluate

GET    /api/contacts/:id/documents
POST   /api/contacts/:id/documents        → multipart upload (S3 presigned)
DELETE /api/contacts/:id/documents/:did

GET    /api/contacts/:id/assigned
POST   /api/contacts/:id/assigned         { userIds: [...] }
GET    /api/contacts/:id/related
POST   /api/contacts/:id/related          { contactId, relationType }   ← bidireccional

GET    /api/contacts/:id/email-stats      → { sent, received, delivered, opened, byUser[], unreadCount }
```

Webhooks/cron-driven que el backend debe emitir como eventos:
- SMTP delivered → `recordEmailDelivered(contactId, ...)`.
- Pixel tracking opened → `recordEmailOpened(contactId, ...)`.
- IMAP entrante matcheado → `recordEmailReceived(contactId, ...)`.

## Estados (loading, empty, error)

- **Loading**: skeletons en cada card del Resumen.
- **Contacto no existe** o eliminado → `<Navigate to="/contactos" />`.
- **Sin permiso de viewOwn**: pantalla `<NoAccessView feature="..." />`.
  Hoy solo WhatsApp lo aplica (`ContactWhatsAppTab.tsx`); patrón a
  replicar en otros tabs cuando se cablee la migración.
- **Empty states** por tab: cada tab tiene un empty state con icono +
  CTA contextual ("Subir primer documento", "Enviar primer email"…).

## Enlaces salientes

| Desde | A | Cuándo |
|---|---|---|
| Header → email principal | `/emails?compose=1&to=...` | click |
| Resumen → icono WhatsApp en teléfono | **modal WhatsApp** | click |
| Cualquier evento email del Historial | `/emails?contact=<id>` | click |
| Cualquier card del tab Emails | `/emails?contact=<id>` | click |
| Card record convertido del tab Registros | `/ventas?id=<saleId>` | click |
| Card oportunidad del tab Operaciones | `/oportunidades/:id` | click ("Ver oportunidad →") |
| Banner "Compra en curso" | `/ventas/:id` | click ("Ver venta →") |
| Promoción name (todos los tabs) | `/promociones/:id` | click |
| Tab Operaciones → "Añadir oportunidad" | `AddOpportunityDialog` (stub) | click |

## Responsive

- **375px**: tabs en `overflow-x-auto`, sidebar del Resumen colapsa
  abajo, modal WhatsApp = fullscreen.
- **768px (md)**: sidebar de agentes del modal WhatsApp aparece.
- **1024px (lg)**: sidebar del Resumen al lado, sidebar de agentes en
  modo página aparece.

## Notas de implementación

- `setTab(t)` intercepta `whatsapp` para abrir el modal sin cambiar la
  URL — ver `ContactoDetalle.tsx` líneas ~109-114.
- `ContactWhatsAppTab` tiene prop `mode: "page" | "modal"` que ajusta
  layout (chrome, sidebar visibility, alto). Ver ADR-043.
- Eliminar contacto registra `recordTypeAny(id, "contact_deleted", ...)`
  ANTES de borrar (para que el evento quede en localStorage aunque el
  contacto se quite de los listados).
- `LinkContactDialog` carga catálogo dinámico de relaciones — ver
  ADR-044.

## TODOs al conectar backend

Marcadas en código como `TODO(backend)` y referenciadas a
`docs/backend-integration.md`:

- `GET /api/contacts/:id/events` (audit log paginado).
- `POST /api/contacts/:id/comments` y siblings.
- `POST /api/contacts/:id/documents` con upload S3 presigned.
- `PATCH /api/contacts/:id { relatedContacts: [...] }`.
- `GET/POST /api/contacts/relation-types` (catálogo dinámico).
- Webhooks de email (delivered, opened, received).
- `GET /api/contacts/:id/email-stats`.
- Validación server-side de permisos en cada endpoint (ver
  `docs/permissions.md` §4.5).

## Open questions

- ¿`/emails?contact=<id>` filtra cliente-side o se le pasa al backend?
  Recomendación: backend (`GET /api/emails?contactId=<id>`) para
  paginación correcta.
- ¿Vista de detalle de oportunidad en `/oportunidades/:id` es página
  completa o modal lateral como WhatsApp?
- Cuando un member sin `contacts.viewAll` entra a una ficha donde
  NO está asignado, ¿404 silencioso o `<NoAccessView />` explícito?
