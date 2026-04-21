# Módulo · Emails (`/emails`)

Cliente de correo integrado tipo Gmail con bandeja unificada multi-cuenta,
edición inline (Reply / Reply all / Forward), compose flotante, firmas HTML
enriquecidas y delegación de acceso.

**Origen:** portado desde el módulo Emails del repo de referencia
(`figgy-friend-forge` → `ARCHITECTURE_EMAILS.md`). Se mantiene el modelo de
datos exacto pero se adapta la UI al sistema visual Byvaro v2 (tokens HSL,
radios, sombras).

**Estado:** 🟢 funcional (mock). 8 pasos del plan original completados.
Último update: 2026-04-21.

**Novedades post-port**:
- Sidebar Byvaro colapsa a iconos en `/emails` (patrón Lovable · `COLLAPSED_ROUTES` en `AppSidebar.tsx`).
- Botón "← Inicio" en el header del cliente de correo.
- Tracking de emails enviados por sistema Byvaro (entregado/abierto/rebotado).
- Chips estilo Gmail para destinatarios (con underline en externos).
- Banner amarillo "Ten cuidado · información confidencial" al detectar dominio externo.
- Filtros Gmail en el buscador (De/Para/Asunto/Contiene/Adjunto/No leídos).
- Creación inline de etiquetas; asignación desde la barra de selección.
- Folders limpios: sólo Bandeja · Destacados · Enviados · Papelera.
- Menú 3 puntos del detalle con acciones reales (no placeholders).
- Autosave del Compose a localStorage al cerrar con contenido.
- Signature picker operativo tanto en Compose como InlineReply.

---

## Rutas

| Ruta | Vista | Descripción |
|---|---|---|
| `/emails` | Promotor / Agencia | Cliente completo. Si no hay cuentas conectadas → `EmailSetup`. Si hay ≥1 → `GmailInterface`. |
| `/ajustes/email/firma` | Promotor / Agencia | Configuración legacy de firma basada en tokens (`{name}`, `{role}`…). |
| `/ajustes/email/plantillas` | Promotor / Agencia | Plantillas reutilizables para emails comunes. |
| `/ajustes/email/auto-respuesta` | Promotor / Agencia | Respuesta automática fuera de horario. |
| `/ajustes/email/smtp` | Promotor / Agencia | Dominio de envío (SPF / DKIM / DMARC) + identidad. |

> **Nota:** la gestión operativa de firmas (las que se inyectan al redactar)
> vive en `SignatureManagerDialog`, **no** en `/ajustes/email/firma`. La
> página de ajustes conserva el editor legacy basado en tokens.

---

## Modelo de datos

> Tipos copiados tal cual de `src/components/emails/accounts.ts` y
> `src/components/emails/signatures.ts`.

### `EmailAccount`

```typescript
type EmailProvider = "gmail" | "microsoft" | "imap";

type ImapConfig = {
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  username?: string;
  useSsl?: boolean;
};

type EmailAccount = {
  id: string;
  provider: EmailProvider;
  email: string;
  name: string;
  unread: number;
  isDefault: boolean;
  pushEnabled: boolean;
  connectedAt?: string;    // fecha legible de conexión
  delegated?: boolean;     // true = cuenta de otra persona delegada a mí
  delegatedFrom?: string;  // email del propietario cuando delegated
  imap?: ImapConfig;       // solo cuando provider === "imap"
};
```

### `Delegate`

```typescript
type Delegate = {
  id: string;
  email: string;
  name: string;
  grantedAt: string;
};
```

Representa a un usuario al que **yo** he cedido acceso a mis cuentas.

### `EmailItem` (uso interno de `GmailInterface`)

```typescript
type EmailFolder = "inbox" | "sent" | "trash";

type EmailTracking = {
  sent: boolean;
  delivered: boolean;
  openedAt?: string;       // ISO — primera apertura (pixel)
  openCount?: number;
  clickCount?: number;
  bounced?: boolean;
  bounceReason?: string;
};

type EmailItem = {
  id: string;
  accountId: string;
  folder: EmailFolder;
  from: string;
  fromEmail: string;
  toEmail?: string;        // destinatario principal (para folder=sent)
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  category?: "primary" | "promotions" | "social" | "updates";
  labels?: string[];
  attachments?: { name: string; size: string }[];
  tracking?: EmailTracking; // sólo en emails enviados vía sistema Byvaro
};
```

### `EmailSignature`

```typescript
type EmailSignature = {
  id: string;
  name: string;
  html: string;                 // contenido HTML enriquecido
  isDefault?: boolean;
  accountId?: string | null;    // si está bound a una cuenta
};
```

Persistido en `localStorage` bajo:

- `byvaro.emailSignatures.v1` → array de firmas
- `byvaro.emailSignatures.defaultId.v1` → id de la firma por defecto global

### Drafts

```typescript
// Floating Compose ("New message")
type ComposeDraft = { to: string; subject: string; body: string };

// Inline Reply / Forward (estilo Gmail)
type InlineDraft  = { to: string; subject: string; bodyHtml: string };

type ComposeMode  = "new" | "reply" | "replyAll" | "forward";
```

### Estados de cuenta

| Estado | Indicador visual | Descripción |
|---|---|---|
| Conectada (OAuth) | Logo Google/Microsoft | `provider: "gmail"` o `"microsoft"` |
| Conectada (IMAP) | Avatar `@` | `provider: "imap"`, requiere `ImapConfig` |
| Por defecto | Badge `Default` en switcher | `isDefault: true` |
| Delegada | Sufijo "(delegada)" | `delegated: true` |
| Push activo / silenciada | Icono Bell / BellOff | `pushEnabled: true/false` |

---

## Flujo del proceso

### 1. Primera conexión (`EmailSetup`)

1. Usuario aterriza en `/emails` sin cuentas → se monta `EmailSetup`.
2. Pantalla "choose": elige Google, Microsoft o IMAP.
3. Google / Microsoft → callback simulado → cuenta creada en memoria.
4. IMAP → formulario manual (email, password, hosts, puertos) →
   `onConfigured("imap", email)`.
5. La nueva cuenta se inserta. Si es la primera → `isDefault = true`.

### 2. Cambio de cuenta / bandeja unificada

`AccountSwitcher` permite seleccionar:

- Una cuenta concreta → filtra `EmailItem.accountId`.
- **All inboxes** (`activeId === "all"`) → muestra todos los emails con un
  dot de color por cuenta.

El switcher muestra el contador de no leídos del resto de cuentas.

### 3. Lectura de email

1. Click en email → `setOpenEmail(item)` y se marca como leído
   (`unread: false`).
2. Cualquier draft inline previo se descarta (`closeInline()`).
3. Se renderiza `EmailDetail`.

### 4. Reply / Reply all / Forward (inline, estilo Gmail)

1. Click en `Reply` / `Reply all` / `Forward` dentro del detalle.
2. `startCompose(mode, src)`:
   - Calcula la firma por defecto vía
     `getDefaultSignature(signatures, accountId)`.
   - Construye el body HTML con
     `buildQuoteHtml({ fromName, fromEmail, date, bodyText })` (bloque
     citado con borde izquierdo gris).
   - Aplica la firma con `applySignature(...)` entre marcadores
     `<!--byvaro-signature-->`.
   - Para `forward` deja `to` vacío y muestra el campo Subject.
   - Para reply oculta el Subject.
3. El editor `InlineReply` se renderiza al final del email
   (sustituye los botones Reply/Forward).
4. Caret se sitúa al inicio del body, sobre el bloque citado.

### 5. Compose nuevo (floating)

1. Botón `Compose` del sidebar o FAB móvil → `startCompose("new")`.
2. Se renderiza `Compose` flotante anclado abajo-derecha (en móvil ocupa
   pantalla completa).
3. La firma por defecto se inserta vacía como
   `applySignature("", sigHtml)`.

### 6. Envío

- Validación única: `to.trim() !== ""`. Si vacío → toast
  `"Añade al menos un destinatario"`.
- Si OK → toast `"Mensaje enviado"` y se cierra el draft.

---

## Vista Promotor — Detalle (`GmailInterface`)

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ Header (h-14/16): Menu · Byvaro · Search · AccountSwitcher │
├─────────┬──────────────────────────────────────────────────┤
│         │ Toolbar (h-12)                                   │
│ Sidebar │ ┌──────────────────────────────────────────────┐ │
│ w-60    │ │ Lista de emails  ó  EmailDetail              │ │
│ (md+)   │ │                                              │ │
│         │ └──────────────────────────────────────────────┘ │
└─────────┴──────────────────────────────────────────────────┘
                                              ┌───────────┐
                                              │ Compose   │ (flotante)
                                              └───────────┘
```

### Componentes/secciones en orden

1. **Sidebar (desktop) / Sheet (mobile)**
   - Botón **Compose** (pill primary con icono `Pencil`).
   - Folders: Inbox, Starred, Snoozed, Sent, Drafts, Spam, Trash.
   - Sección **Labels** con dot de color.
   - En `<md`: sidebar se abre desde un `Sheet` lateral.
2. **Lista de emails**
   - **Desktop**: fila `h-11` con checkbox · star · important · sender ·
     subject+snippet · attachment · fecha.
   - **Mobile**: tarjeta vertical con avatar circular `h-11 w-11` (color
     generado por iniciales) que actúa como toggle de selección.
   - En **bandeja unificada** (`isAll`): dot de color
     (`ACCOUNT_DOT_COLORS`) junto al sender + email de la cuenta en el
     snippet.
   - Selección múltiple → toolbar con `Archive`, `Delete`, `Mark as read`,
     `Select all`.
3. **EmailDetail**
   1. Toolbar de acciones (Archive, Spam, Delete, Mark unread, Snooze, More).
   2. Subject + labels (badges `bg-primary/10 text-primary`).
   3. Sender card: avatar coloreado + nombre + email + "to me · fecha" +
      Star, Reply, Forward.
   4. Body en `whitespace-pre-wrap` con padding izquierdo.
   5. Bloque de adjuntos (`FileText` destructive).
   6. **Slot inline**: si hay `inlineReply` activo → `InlineReply`; si no,
      botones outline `Reply / Reply all / Forward`.

### Compose flotante (`Compose`)

| Aspecto | Valor |
|---|---|
| Posición desktop | `fixed bottom-0 right-8`, `w-[540px] h-[560px]` |
| Posición mobile | `fixed inset-0` (full-screen) |
| Header | Title (`Nuevo mensaje` / `Reply` / `Forward`), Min, Max, Close |
| Campos | `To`, `Subject`, `body` (textarea plano) |
| Adjuntos | Chips con nombre, tamaño, botón remove |
| Toolbar | Send · Attach (Paperclip) · Insert link · Emoji · Image · Discard |
| Límite adjuntos | 25 MB por archivo (toast error si excede) |

> El Compose flotante usa **textarea plano** y se reserva para "Nuevo
> mensaje". Reply y Forward usan siempre `InlineReply` con editor
> enriquecido.

### InlineReply (editor enriquecido)

Editor `contentEditable` que vive **dentro** de `EmailDetail`.

1. Header `h-10`: título (Reply / Reply all / Forward) + close.
2. Fila **To**: input + botón "Cc/Bcc" (si está oculto).
3. Fila **Subject** (solo en `forward`).
4. Editor `contentEditable` (min `160px`, max `420px`, scroll interno) con
   clase `prose prose-sm`.
5. Lista de adjuntos (chips).
6. Toolbar (h-12):
   - **Send** (pill primary)
   - Bold · Italic · Underline · Insert link
   - Attach file · Insert image · Emoji
   - **Signature picker** (popover ✍️)
   - Discard

**Signature picker** (popover):

- Lista de firmas (la activa con badge `ACTIVE`).
- Opción **No signature** (elimina el bloque).
- Acceso directo **Manage signatures…** (abre `SignatureManagerDialog`).

Al cambiar firma, `swapSignature(id)` reemplaza solo el bloque marcado
entre `<!--byvaro-signature-->` y `<!--/byvaro-signature-->` sin tocar el
resto del cuerpo ni la cita.

**Inserción del cuerpo inicial** — cita HTML construida por
`buildQuoteHtml`:

```html
<div class="byvaro-quote" style="border-left:2px solid #cbd5e1;…">
  <div>On {date}, {from} &lt;{email}&gt; wrote:</div>
  {textToHtml(body)}
</div>
```

La firma por defecto se añade tras la cita con `applySignature(...)`.

---

## Vista Agencia — Detalle

### Diferencias con vista Promotor

El módulo Emails **no diferencia Promotor/Agencia**. Ambas vistas comparten
exactamente la misma interfaz, datos mock y permisos. La única
diferenciación posible es por cuenta conectada — cada usuario ve solo sus
propias cuentas y sus delegaciones.

| Característica | Promotor | Agencia |
|---|---|---|
| GmailInterface | ✅ | ✅ |
| Compose flotante | ✅ | ✅ |
| InlineReply | ✅ | ✅ |
| SignatureManager | ✅ | ✅ |
| ManageAccounts + delegación | ✅ | ✅ |

---

## Acciones

### Añadir cuenta (desde `AccountSwitcher` → "Add account")

1. Abre `EmailSetup` en modo `addingAccount`.
2. Elige provider: Google / Microsoft / IMAP.
3. OAuth simulado para Google/Microsoft; formulario para IMAP.
4. Se añade al array de `accounts`. La nueva cuenta **no** se marca como
   default salvo que sea la primera.

### Gestionar cuentas (`ManageAccountsDialog`)

Diálogo con 2 tabs:

1. **Cuentas conectadas** — lista todas las cuentas del usuario.
2. **Delegación de acceso** — usuarios a los que el usuario ha cedido
   acceso.

Botón **Firmas** (pill outline) en la cabecera → abre
`SignatureManagerDialog`.

| Acción por fila | Aplicable a | Resultado |
|---|---|---|
| Set as default | Todas no delegadas | `isDefault` se mueve a esa cuenta |
| Toggle push | Todas | `pushEnabled: true/false` |
| Editar configuración | Solo IMAP | Abre editor inline con `imapHost`, `imapPort`, `smtpHost`, `smtpPort`, `username`, `useSsl` |
| Reconectar | Gmail / Microsoft | Re-autenticación OAuth (placeholder) |
| Delete | Todas | Toast confirmación + elimina de la lista |

**Editor IMAP**:

- Usuario (default = email)
- Servidor IMAP / Puerto IMAP
- Servidor SMTP / Puerto SMTP
- Toggle SSL/TLS
- Botón **Probar conexión** → toast OK
- Botón **Guardar** → valida que `imapHost` y `smtpHost` no estén vacíos

**Delegación** — formulario:

- Nombre + email del delegado
- Checkbox de aviso obligatorio (`acknowledged`)
- Botón **Añadir** → solo activo si los 3 campos están rellenos
- Lista de delegados existentes con botón Revocar

### Gestionar firmas (`SignatureManagerDialog`)

Diálogo `max-w-3xl` con:

- **Sidebar izquierdo (`220px`)**: lista de firmas + botón "New signature".
  La firma por defecto muestra badge `Default` en `emerald`.
- **Panel derecho**: editor.

Editor:

1. Campo **Name** (`h-9 rounded-full`).
2. Toggle **Visual / HTML** (icono `Code`).
3. Modo **Visual**: barra de herramientas (Bold, Italic, Underline, Link,
   Clear formatting) + área `contentEditable`.
4. Modo **HTML**: textarea monoespaciada para editar el markup.
5. Acciones inferiores:
   - **Set as default** (deshabilitado si ya lo es)
   - **Delete** (texto destructive)
   - **Close** / **Save** (pills)

Reglas:

- Al guardar, se persiste todo el array en `localStorage`
  (`byvaro.emailSignatures.v1`).
- `setDefaultSignatureId(id)` actualiza también
  `byvaro.emailSignatures.defaultId.v1` y marca `isDefault` solo en esa
  firma.
- Si se borra la firma por defecto → se limpia el id global.

### Helpers API (`signatures.ts`)

| Función | Uso |
|---|---|
| `loadSignatures()` | Carga desde localStorage (fallback a defaults) |
| `saveSignatures(list)` | Persiste el array |
| `getDefaultSignatureId()` | Lee el id global por defecto |
| `setDefaultSignatureId(id)` | Persiste el id global por defecto |
| `getDefaultSignature(list, accountId?)` | Busca: (1) default por cuenta, (2) id global, (3) `isDefault`, (4) primera |
| `applySignature(bodyHtml, sigHtml)` | Inserta o reemplaza el bloque marcado |
| `stripSignature(bodyHtml)` | Elimina el bloque entre marcadores |
| `wrapSignature(html)` | Envuelve en `<div class="byvaro-signature">` con marcadores |
| `buildQuoteHtml({fromName, fromEmail, date, bodyText})` | Construye bloque citado HTML |
| `textToHtml(text)` | Convierte texto plano (con `\n`) a HTML escapado |
| `escapeHtml(s)` | Escape XSS estándar |

---

## Reglas de negocio clave

1. **Reply y Forward son siempre inline** — nunca abren el Compose
   flotante.
2. **Compose flotante solo para "Nuevo mensaje"** — en móvil ocupa pantalla
   completa.
3. **La firma por defecto se inyecta automáticamente** al iniciar cualquier
   draft (new, reply, forward). Editable en caliente desde el picker ✍️
   tanto en Compose como en InlineReply.
4. **Una sola firma activa por draft** — el `swapSignature` reemplaza el
   bloque marcado, no acumula.
5. **Bandeja unificada** muestra dot de color por cuenta y desactiva el
   filtro `accountId`.
6. **Selección múltiple** desactiva la apertura del email al click — el
   click pasa a togglear selección. La barra de selección ofrece
   Archivar · Eliminar · Marcar leído · Asignar etiqueta.
7. **Marcar como leído** ocurre al abrir el email (no requiere acción
   explícita).
8. **Adjuntos**: límite por archivo de **25 MB**, validado al añadir, no al
   enviar.
9. **Cuentas delegadas** se identifican con sufijo "(delegada)" y
   `delegated: true` — no pueden marcarse como default.
10. **Persistencia local**: firmas y último borrador del Compose en
    `localStorage`. Cuentas, emails y etiquetas creadas son mock en memoria
    (se resetean al recargar).
11. **OAuth simulado**: Gmail y Microsoft no tienen flujo real; el callback
    se simula tras el click en el botón del provider.
12. **Folders funcionales**: `inbox` · `starred` · `sent` · `trash`. Los
    folders antiguos (Snoozed, Drafts, Spam) se quitaron por no tener
    implementación real — se reintroducirán cuando tengan backend.
13. **Archivar y Eliminar** mueven a Papelera. En Papelera, Eliminar
    borra definitivamente.
14. **Responder a un email enviado** pre-rellena el destinatario con
    `email.toEmail` (no con `fromEmail`, que sería el usuario mismo).
15. **Chips destinatarios estilo Gmail**: cada `to` es una pill con X.
    Si el dominio difiere del remitente → pill amber + `underline
    decoration-dotted` + banner confidencial.
16. **Chrome Byvaro colapsa a iconos** automáticamente al entrar en
    `/emails` (ver `COLLAPSED_ROUTES` en `src/components/AppSidebar.tsx`).
    AppHeader sigue visible. Ancho 56px con tooltips `title=` en cada
    icono. Al salir a otra ruta vuelve a 236px.
17. **Botón "← Inicio"** en el header del cliente de correo da vía
    rápida para salir sin pasar por el sidebar.
18. **Autosave de Compose**: al cerrar con contenido (no vacío) se guarda
    en `localStorage` y se muestra toast "Borrador guardado". Al volver a
    pulsar "Redactar" se restaura y se avisa con "Borrador recuperado". El
    botón 🗑 descarta explícitamente (no guarda).
19. **Emails enviados se añaden al folder Sent** con tracking inicial
    `{ sent: true, delivered: false }` y se marca `delivered: true`
    tras 1.2s (simulación webhook SMTP).
20. **Tracking sólo en emails enviados vía sistema Byvaro**: UI muestra
    badge inline (`Abierto`/`Rebotado`/`Entregado`) + TrackingCard en el
    detalle con 4 stats (Enviado, Entregado, Aperturas, Clicks).
21. **Búsqueda**: texto libre empareja contra from, fromEmail, subject,
    snippet y body. Los filtros avanzados (De/Para/Asunto/Contiene/
    Adjunto/No leídos) se combinan con AND.
22. **Aviso confidencial**: se puede cerrar con X dentro de la misma
    sesión (no persiste entre recargas).
23. **Etiquetas**: creación inline desde el sidebar (+ al lado de
    "Etiquetas"), asignación desde la barra de selección. Click en una
    etiqueta filtra emails no-trash con esa etiqueta.

---

## Escenarios que deben cubrirse

| Escenario | Condición que lo activa |
|---|---|
| Primera conexión | `accounts.length === 0` |
| Añadir cuenta extra | Click en "Add account" del switcher → `addingAccount = true` |
| Bandeja unificada | `activeId === "all"` |
| Cuenta única seleccionada | `activeId === account.id` |
| Editar IMAP | Click en "Editar configuración" en cuenta con `provider === "imap"` |
| Re-autenticar OAuth | Click en "Reconectar" en cuenta `gmail` / `microsoft` no delegada |
| Reply con firma por defecto | Existe firma con `isDefault: true` |
| Reply sin firma | No hay firmas o todas eliminadas → body solo lleva la cita |
| Cambiar firma en draft | Popover ✍️ → seleccionar otra firma |
| Eliminar firma del draft | Popover ✍️ → "No signature" |
| Forward sin destinatario | Campo `to` queda vacío para que el usuario lo rellene |
| Adjunto > 25 MB | Toast error y archivo no se añade |
| Selección múltiple en lista | Click en checkbox o avatar mobile |
| Cuenta delegada | `delegated: true` → sufijo "(delegada)", oculta acciones de gestión |
| Push silenciado | `pushEnabled: false` → icono `BellOff` |

---

## Archivos del módulo

### Páginas

| Archivo | Descripción |
|---|---|
| `src/pages/Emails.tsx` | Wrapper de ruta. Decide entre `EmailSetup` y `GmailInterface` según haya cuentas. Mantiene los estados `accounts`, `delegates`, `activeId`, `addingAccount`. |
| `src/pages/ajustes/email.tsx` *(pendiente)* | Sub-páginas de ajustes: firma, plantillas, auto-respuesta, SMTP. |

### Componentes

| Archivo | Descripción |
|---|---|
| `src/components/emails/EmailSetup.tsx` ✅ | Onboarding inicial: providers (Gmail/Microsoft OAuth mock, IMAP form) + nombre visible + aviso sistema deshabilitable + botón Cancelar/Volver. |
| `src/components/emails/GmailInterface.tsx` ✅ | Cliente principal: sidebar con folders+etiquetas, lista, detalle con menú 3 puntos funcional, Compose flotante con autosave + signature picker. ~2150 líneas. |
| `src/components/emails/AccountSwitcher.tsx` ✅ | Popover de cuentas en el header. Soporta "Todas las cuentas". Sin "Desconectar" (vive en ManageAccounts). |
| `src/components/emails/ManageAccountsDialog.tsx` ✅ | Diálogo de gestión: cuentas con rename inline del nombre visible, delegación, editor IMAP con campo Nombre visible. |
| `src/components/emails/SignatureManagerDialog.tsx` ✅ | CRUD de firmas con editor visual + HTML. |
| `src/components/emails/InlineReply.tsx` ✅ | Editor enriquecido estilo Gmail: avatar externo, chips destinatarios, dropdown Reply/Forward, quote plegable, toolbar pill centrada, banner confidencial, split-button Enviar. |
| `src/components/email/SendEmailDialog.tsx` *(legacy existente)* | Diálogo legacy basado en plantillas. No es parte del cliente principal. Queda intacto hasta que se decida portar. |

### Datos / Tipos / Helpers

| Archivo | Descripción |
|---|---|
| `src/components/emails/accounts.ts` ✅ | Tipos `EmailProvider`, `ImapConfig`, `EmailAccount`, `Delegate` + mocks `INITIAL_ACCOUNTS`, `INITIAL_DELEGATES`. |
| `src/components/emails/signatures.ts` ✅ | Tipo `EmailSignature` + helpers de persistencia. Constantes `SIGNATURE_MARKER_OPEN/CLOSE`. |
| `src/components/emails/drafts.ts` ✅ | Persistencia del borrador del Compose en localStorage (`byvaro.emailComposeDraft.v1`) + helper `isDraftEmpty`. |
| `src/components/email/emailTemplates.ts` *(legacy existente)* | Plantillas usadas por `SendEmailDialog`. |

---

## Dependencias

### Internas (UI / hooks)

| Dependencia | Uso |
|---|---|
| `@/components/ui/button` | Botones primarios (Send, Save) y outline (Reply, Forward). |
| `@/components/ui/input`, `textarea`, `label` | Campos de formularios IMAP, signature manager, settings. |
| `@/components/ui/dialog` | `ManageAccountsDialog`, `SignatureManagerDialog`. |
| `@/components/ui/sheet` | Sidebar lateral en mobile. |
| `@/components/ui/popover` | `AccountSwitcher`, signature picker. |
| `@/components/ui/switch`, `checkbox` | Toggles de push, SSL, acknowledged. |
| `@/components/ui/badge` | Badges de estado (Verified, Default). |
| `@/lib/utils` (`cn`) | Composición de clases tailwind. |
| `react-router-dom` | `Link` al dashboard desde el header. |

### Externas

| Paquete | Uso |
|---|---|
| `lucide-react` | Iconografía completa. |
| `sonner` | Toasts (mensaje enviado, errores de adjunto, errores IMAP, etc.). |
| `react` | Hooks `useState`, `useEffect`, `useRef`. |

### APIs del navegador

| API | Uso |
|---|---|
| `window.localStorage` | Persistencia de firmas (`byvaro.emailSignatures.v1`, `byvaro.emailSignatures.defaultId.v1`). |
| `document.execCommand` | Comandos de formato del editor enriquecido. |
| `contentEditable` | Editor de firmas y editor de respuesta inline. |
| `navigator.clipboard` | Copiar email del sistema en `EmailSetup`. |
| `window.getSelection` / `Range` | Posicionar el caret al inicio del editor inline. |
| `window.prompt` | Captura de URL al insertar links. |

### Sin dependencias externas de email

> El módulo es **100% mock**: no consume ningún proveedor IMAP / SMTP /
> OAuth real. Toda la lógica de envío y push se simula con toasts y
> mutación de estado en memoria.

---

## TODOs al conectar backend

- `TODO(backend)` — Flujo OAuth real Google/Microsoft (Gmail API, Graph
  API) con refresh tokens persistidos en backend.
- `TODO(backend)` — Conexión IMAP/SMTP real con validación de credenciales
  (librería `imapflow` o similar en Node).
- `TODO(backend)` — Endpoint `GET /api/emails?accountId=&folder=` paginado.
- `TODO(backend)` — Endpoint `POST /api/emails/send` con soporte adjuntos
  multipart (S3 pre-signed para >5MB).
- `TODO(backend)` — Webhooks de push (Gmail push, Microsoft Graph
  subscriptions) → notificaciones en tiempo real.
- `TODO(backend)` — Persistencia de firmas y cuentas en Postgres
  (migración desde localStorage).
- `TODO(backend)` — Endpoints de delegación con invitación por email y
  confirmación del delegado.
- `TODO(security)` — Sanitización HTML en signatures (DOMPurify server-side)
  antes de renderizar.
