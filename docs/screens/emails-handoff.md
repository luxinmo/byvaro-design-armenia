# Emails · Guía de handoff al proyecto real

> Este documento se escribe para un **Claude Code que trabaje en el
> proyecto de producción Byvaro** (con backend real, Postgres, OAuth
> providers, IMAP/SMTP). Explica qué es mock, qué hay que cambiar y
> en qué orden. La spec funcional del módulo vive en
> [`emails.md`](./emails.md) — este documento es el "puente" entre
> el diseño y la implementación real.
>
> **Contexto**: el repo actual (`byvaro-design-armenia`) es un proyecto
> de diseño 100% frontend sin backend. Todos los flujos de correo son
> mock en memoria o localStorage. El código UI es **portable tal cual**
> al proyecto real: sólo hay que sustituir las fuentes de datos mock
> por llamadas al backend.

---

## 1. Arquitectura de componentes

```
src/pages/Emails.tsx                    · Wrapper que decide setup vs cliente
  │
  ├── EmailSetup                        · Onboarding (si no hay cuentas o addingAccount=true)
  │    └── Provider cards + IMAP form
  │
  └── GmailInterface                    · Cliente completo
       ├── Header
       │    ├── "← Inicio" link
       │    ├── Search input
       │    │    └── FiltersPopover     · De/Para/Asunto/Contiene/Adjunto/NoLeídos
       │    └── AccountSwitcher         · popover bandeja unificada + add account
       │
       ├── Sidebar (folders + labels)
       │    ├── Compose button
       │    ├── Folder list             · inbox/starred/sent/drafts/trash
       │    └── Labels section          · creación inline + filter
       │
       ├── Main panel
       │    ├── List (cuando !openEmail)
       │    │    ├── Toolbar            · selection ↔ read states
       │    │    └── Rows               · desktop inline / mobile stacked
       │    │
       │    └── EmailDetail (cuando openEmail)
       │         ├── Toolbar            · Volver/Archive/Delete/MarkUnread/…(menu)
       │         ├── Subject + labels (con X y popover "añadir")
       │         ├── Sender card        · avatar + reply/forward shortcuts
       │         ├── Body               · whitespace-pre-wrap
       │         ├── TrackingCard       · sólo en emails enviados del sistema
       │         ├── Attachments
       │         └── InlineReply        · editor Gmail-style (condicional)
       │
       ├── Dialogs (lazy)
       │    ├── ManageAccountsDialog    · tabs cuentas + delegación + editor IMAP
       │    └── SignatureManagerDialog  · CRUD firmas HTML
       │
       └── Compose flotante             · Nuevo mensaje (Min/Max/Restaurar)
            ├── Selector "De"
            ├── Chips destinatarios
            ├── Subject
            ├── Body (contentEditable)
            ├── Confidential banner
            ├── Toolbar formato (pill)
            └── Footer (split-button Enviar + iconos + signature picker)
```

**Integración AppShell**: `AppSidebar` (navbar principal) auto-colapsa
a iconos cuando la ruta empieza por `/emails` (ver `COLLAPSED_ROUTES`
en `src/components/AppSidebar.tsx`). Es un patrón que conviene
replicar en producción.

---

## 2. Mapa del estado (qué vive dónde)

| Concepto | Ubicación actual | Dónde DEBE vivir en producción |
|---|---|---|
| Cuentas (`EmailAccount[]`) | `useState` en `Emails.tsx` inicializado con `INITIAL_ACCOUNTS` mock | Tabla `email_accounts` + fetch al montar |
| Delegados (`Delegate[]`) | `useState` + `INITIAL_DELEGATES` | Tabla `email_delegates` |
| Cuenta activa (`activeId`) | `useState` en `Emails.tsx` | URL param `?account=xxx` o estado global |
| Emails (`EmailItem[]`) | `useState` en `GmailInterface` con `MOCK_EMAILS` | Endpoint paginado; virtualización para listas largas |
| Etiquetas creadas | localStorage `byvaro.emailLabels.v1` | Tabla `email_labels` por usuario |
| Etiquetas asignadas | dentro de cada `EmailItem.labels` en memoria | Tabla `email_label_assignments` (N:M) |
| Firmas | localStorage `byvaro.emailSignatures.v1` + `defaultId` | Tabla `email_signatures` con `is_default` + `account_id` nullable |
| Borrador Compose | localStorage `byvaro.emailComposeDraft.v1` | Tabla `drafts` con `{id, to, subject, body, attachments, updated_at}` |
| Tracking de enviados | dentro de `EmailItem.tracking` mock con `setTimeout` | Webhook handlers SMTP (Resend/SendGrid/Postal) → `email_tracking_events` |
| Aviso sistema oculto | localStorage `byvaro.emailSystemNoticeHidden.v1` | `user_preferences` |

**Regla de oro**: todo `localStorage.getItem("byvaro.*")` debe sustituirse
por una llamada al backend. Los helpers ya están centralizados en:

- `src/components/emails/accounts.ts`
- `src/components/emails/signatures.ts`
- `src/components/emails/drafts.ts`
- `src/components/emails/labels.ts`

Basta con reescribir esas 4 funciones y el resto del código no cambia.

---

## 3. Contrato backend esperado

### 3.1 Cuentas

```typescript
// GET /api/email-accounts
Response: EmailAccount[]

// POST /api/email-accounts/oauth/start?provider=gmail|microsoft
Response: { authUrl: string }   // redirect al provider

// GET /api/email-accounts/oauth/callback?code=…&state=…
Response: EmailAccount          // cuenta recién conectada

// POST /api/email-accounts/imap
Body: {
  email: string;
  name: string;
  password: string;
  imapHost: string; imapPort: string;
  smtpHost: string; smtpPort: string;
  useSsl: boolean;
}
Response: EmailAccount

// PATCH /api/email-accounts/:id
Body: Partial<EmailAccount>     // rename, toggle push, set default
Response: EmailAccount

// DELETE /api/email-accounts/:id
Response: { ok: true }
```

### 3.2 Emails

```typescript
// GET /api/emails?accountId=…&folder=inbox|sent|trash|drafts&cursor=…&q=…
//   Si accountId === "all" → bandeja unificada
//   q soporta: from:… to:… subject:… has:attachment is:unread
Response: {
  items: EmailItem[];
  nextCursor: string | null;
}

// POST /api/emails/send
Body: {
  fromAccountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  attachments?: Array<{ name: string; url: string; size: number }>;
  scheduleAt?: string;           // ISO — si es futuro, agendar
}
Response: EmailItem             // el mensaje tal como se guardó en Sent

// PATCH /api/emails/:id
Body: Partial<{ folder, starred, important, unread, labels }>
Response: EmailItem

// DELETE /api/emails/:id
// En folder=trash → borra permanentemente. En otro folder → mueve a trash.
Response: { ok: true }

// POST /api/emails/:id/report-open    (pixel webhook → tracking)
// POST /api/emails/:id/report-click   (click tracking)
// Webhook entrante: POST /api/webhooks/smtp  → actualiza tracking
```

### 3.3 Etiquetas

```typescript
// GET /api/email-labels
Response: Label[]

// POST /api/email-labels
Body: { name: string; color: string }
Response: Label

// DELETE /api/email-labels/:name
Response: { ok: true }

// POST /api/emails/:id/labels
Body: { labelName: string }     // toggle
Response: EmailItem
```

### 3.4 Firmas

```typescript
// GET /api/email-signatures
Response: EmailSignature[]

// POST /api/email-signatures
Body: Omit<EmailSignature, "id">
Response: EmailSignature

// PATCH /api/email-signatures/:id
// PATCH /api/email-signatures/default  { id: string }
```

### 3.5 Borradores

```typescript
// GET /api/drafts
Response: Draft[]               // el de Compose es el más reciente

// POST /api/drafts
Body: { to, subject, body }
Response: Draft                 // upsert si hay uno del mismo user

// DELETE /api/drafts/:id
```

---

## 4. Variables de entorno necesarias

```bash
# OAuth providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://api.byvaro.com/api/email-accounts/oauth/callback?provider=gmail

MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_OAUTH_REDIRECT_URI=...

# SMTP provider (para emails vía sistema Byvaro con tracking)
RESEND_API_KEY=...              # o SENDGRID_API_KEY
SMTP_DOMAIN=mail.byvaro.com     # dominio del remitente autenticado DKIM

# Storage de adjuntos
S3_BUCKET=byvaro-email-attachments
S3_REGION=eu-west-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Webhook secrets (para verificar webhooks SMTP entrantes)
RESEND_WEBHOOK_SECRET=...
```

---

## 5. Guía de migración mock → real

Orden recomendado (paralelizable entre frontend/backend):

### Fase 1 · Read-only (sin enviar)

1. Backend: crear tablas `email_accounts`, `emails`, migrar seeds
2. Frontend: sustituir `INITIAL_ACCOUNTS` en `Emails.tsx` por `useEffect(fetch)` contra `GET /api/email-accounts`
3. Frontend: sustituir `MOCK_EMAILS` en `GmailInterface.tsx` por `useEffect(fetch)` contra `GET /api/emails?accountId=…&folder=…`
4. Validar: el cliente muestra emails reales de Postgres

### Fase 2 · Envío básico

5. Backend: integrar Resend/SendGrid. Implementar `POST /api/emails/send` con validación básica.
6. Frontend: en `commitSentEmail()` (dentro de `GmailInterface.tsx`) sustituir el `setEmails(prev => [newEmail, ...prev])` por una llamada al endpoint, y al recibir la response añadirla.
7. Validar: pulsar "Enviar" manda email real y aparece en la Sent folder tras refresh.

### Fase 3 · OAuth

8. Backend: implementar flow OAuth Gmail (`google-auth-library`) y Microsoft (`@azure/msal-node`).
9. Frontend: en `EmailSetup.tsx` sustituir el `setTimeout(onConfigured)` por `window.location = authUrl`. Al volver del callback, el backend redirige a `/emails` con la cuenta ya creada.
10. Validar: conectar una cuenta Gmail personal funciona end-to-end.

### Fase 4 · IMAP

11. Backend: implementar `imapflow` para sync. Polling o IDLE.
12. Frontend: formulario IMAP en `EmailSetup.tsx` ya está listo, sólo cambiar el POST destination.

### Fase 5 · Webhooks (tracking + push)

13. Configurar webhooks Resend (delivered/opened/clicked/bounced).
14. Endpoint `/api/webhooks/smtp` que actualiza `email_tracking_events` y pushea via Server-Sent Events o WebSocket al cliente.
15. Frontend: reemplazar el `setTimeout` mock en `commitSentEmail` por una subscription.

### Fase 6 · Push real-time (Gmail push + Graph subscriptions)

16. Gmail: configurar Pub/Sub → webhook → invalidar query `emails`
17. Microsoft Graph: subscriptions con renewal automático

### Fase 7 · Persistencia completa

18. Firmas, etiquetas, borradores → sustituir localStorage por endpoints
19. Los helpers de `signatures.ts`, `drafts.ts`, `labels.ts` ya están aislados — basta reescribir sus 4 funciones

---

## 6. Consideraciones de seguridad

1. **Sanitización HTML** (crítico): el cuerpo de emails recibidos, las firmas HTML editables y el content de InlineReply son HTML **ejecutable** en el DOM. Usa **DOMPurify** antes de renderizar cualquier HTML que venga de fuera o del usuario. Ver `src/components/emails/signatures.ts:escapeHtml` — sólo escapa entidades, NO sanitiza tags peligrosos.

2. **XSS en búsqueda**: los filtros (`searchFilters.contains`, etc.) se comparan con `toLowerCase().includes(q)` — seguro. Si alguna vez se reflejan en el DOM, sanear primero.

3. **OAuth tokens**: nunca llegan al frontend. Se guardan cifrados en `email_accounts.encrypted_refresh_token` en Postgres. El frontend sólo ve `{id, email, provider, isDefault, …}`.

4. **IMAP password**: cifrar con `AES-256-GCM` + clave rotable. Nunca logear.

5. **Delegación**: verificar que el delegado tiene sesión activa + la cuenta delegada no ha sido revocada antes de permitir leer/enviar.

6. **DKIM/SPF/DMARC**: el dominio del sistema Byvaro (`mail.byvaro.com`) debe tener los 3 configurados antes de enviar desde cuentas IMAP (si no → spam).

7. **Rate limiting**: `POST /api/emails/send` debe tener límite por usuario (ej. 100/hora) para evitar abuso de cuentas comprometidas.

---

## 7. Checklist pre-producción

Antes de mergear a `main` del proyecto real:

- [ ] `/emails` carga con cuentas del backend (no mock)
- [ ] Lista paginada con cursor funciona (scroll infinito o botón "cargar más")
- [ ] Filtros de búsqueda se traducen a query string y el backend los interpreta
- [ ] Enviar email va a Resend/SMTP y llega al destinatario real
- [ ] Tracking (delivered/opened) actualiza el EmailItem tras webhook
- [ ] OAuth Gmail: conectar cuenta personal + Google Workspace funciona
- [ ] OAuth Microsoft: conectar cuenta personal + 365 funciona
- [ ] IMAP: conectar cuenta (ej. iCloud) sincroniza los emails
- [ ] Adjuntos: subir archivo >5MB usa pre-signed S3 URL
- [ ] Firmas persisten entre dispositivos (no más localStorage)
- [ ] Borradores persisten entre dispositivos
- [ ] Delegación: dar acceso a otro usuario + ese usuario ve la cuenta en su switcher
- [ ] Rate limiting en `/api/emails/send` activo
- [ ] DOMPurify sanitiza HTML recibido en EmailDetail
- [ ] DKIM/SPF/DMARC del dominio de sistema verificados
- [ ] Monitorización: Sentry captura errores del módulo; alerta en bounce rate >5%
- [ ] Backup: `email_accounts`, `emails`, `email_signatures` en backup diario
- [ ] GDPR: endpoint `DELETE /api/user` borra todo lo del usuario

---

## 8. Qué NO hay que cambiar (código portable)

Todo el código UI es portable tal cual. En concreto:

- `src/components/emails/*.tsx` — componentes con lógica de presentación
- `src/components/emails/labels.ts` — tipo `Label` (útil en el proyecto real)
- `src/components/emails/accounts.ts` — tipos `EmailAccount`, `ImapConfig`, `Delegate`
- `src/components/emails/signatures.ts` — helpers HTML (`applySignature`, `buildQuoteHtml`, `stripSignature`, `escapeHtml`, `textToHtml`) son puros, reutilizables
- `src/components/emails/drafts.ts` — tipo `PersistedComposeDraft` + `isDraftEmpty` (el resto hay que reescribir)
- `src/pages/ajustes/email/*` — placeholders; en producción rellenar con contenido real

Lo que cambia:

- Los 4 puntos donde se llama `loadX` / `saveX` al localStorage → fetch/mutate al backend
- `INITIAL_ACCOUNTS` / `INITIAL_DELEGATES` / `MOCK_EMAILS` → borrar
- `setTimeout` del tracking (`commitSentEmail`) → subscription al webhook real
- OAuth simulado (`setTimeout` en `EmailSetup.handleProvider`) → `window.location = authUrl`

---

## 9. Gotchas conocidos (cosas que engañan)

1. **La firma se inyecta entre marcadores HTML invisibles**
   (`<!--byvaro-signature--> … <!--/byvaro-signature-->`) para poder
   reemplazarla sin tocar el resto del body. Si procesas el body en
   backend, **conserva los comentarios** o pierdes la capacidad de
   swap de firma.

2. **El caret del contentEditable** cae dentro del bloque de firma si
   no fuerzas `range.setStart(editor, 0)` tras setear `innerHTML`. Ver
   `GmailInterface.tsx:Compose.useEffect` y `InlineReply.tsx`.

3. **Responder a un email enviado** (`folder === "sent"`) usa
   `email.toEmail` como destinatario, no `fromEmail`. Si no, te
   respondes a ti mismo. Ver `startCompose()` en `GmailInterface.tsx`.

4. **La bandeja unificada** (`activeId === "all"`) desactiva el filtro
   `accountId` pero mantiene los filtros de búsqueda. Al añadir
   paginación, ten en cuenta que el backend debe devolver emails de
   todas las cuentas del usuario unidos y ordenados por fecha.

5. **El draft guardado en localStorage** es un SOLO draft por usuario.
   Si un usuario abre Compose en dos pestañas, se pisan. En producción
   usar una tabla con `id` por draft.

6. **Los chips amber para destinatarios externos** se detectan
   comparando dominios (heurística). En producción valida contra
   la lista de contactos + dominio de la organización.

7. **El tracking mock** simula `delivered: true` tras 1.2s. En
   producción el webhook puede tardar minutos o no llegar nunca
   (dominio bloqueado, DKIM fail). UI debe tolerar el estado
   intermedio `{ sent: true, delivered: false }` indefinidamente.

8. **`scripts/*.mjs`** del repo de diseño son **scripts de test con
   Playwright** generados durante el desarrollo. NO portar a producción
   — reescribir con Vitest + Playwright apuntando al backend real.

---

## 10. Contacto / archivos clave

| Archivo | Qué es |
|---|---|
| `docs/screens/emails.md` | Spec funcional (23 reglas, 15 escenarios, modelo datos) |
| `docs/screens/emails-handoff.md` | Este documento |
| `DOC_TEMPLATE.md` | Plantilla canónica para documentar módulos |
| `src/components/emails/` | 10 componentes + 4 helpers |
| `src/pages/Emails.tsx` | Entry point de la ruta `/emails` |
| `src/pages/ajustes/email/*` | 4 sub-páginas de Ajustes (placeholders) |

Cualquier cambio de diseño en este repo → tiene su equivalente a portar
al proyecto real. Mantener sincronización revisando el commit que
introdujo el cambio (git blame sobre el archivo afectado).
