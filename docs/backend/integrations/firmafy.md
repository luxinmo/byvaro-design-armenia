# Integración · Firmafy

> Firma digital de contratos de colaboración entre promotor y agencia.
> El frontend ya captura todos los campos que Firmafy necesita · el
> backend solo traduce y reenvía.
>
> **Docu oficial:** https://devgrupo2000.github.io/firmafy_api/

---

## 1 · Qué es Firmafy en Byvaro

El promotor sube un PDF de contrato en el tab Documentación de una
agencia, configura los firmantes, y Byvaro lo manda a firmar
digitalmente. La agencia recibe un email/SMS con enlace · firma con
OTP (código vía SMS) · al completar todos los firmantes, Firmafy
notifica a Byvaro vía webhook con los PDFs finales (firmado + traza
legal). Esa traza es válida legalmente en España.

**Flujo completo:**

```
Promotor         Byvaro FE    Byvaro BE        Firmafy          Agencia
───────          ─────────    ─────────        ───────          ───────
Sube PDF
configura  ───→  Dialog
firmantes        (ya capturado
                 todos los
                 campos Firmafy)
                               POST /api/
                               contracts/
                               :id/send  ───→
                                              action=request
                                              (devuelve csv)
                                                              ←─── email+SMS
                                                                   con link
                                                                   firma
                                                              Agencia firma
                                                              OTP SMS
                               POST /api/        ←───
                               webhooks/              type=1 · docsigned
                               firmafy                docaudit
                               ↓
                               update contract
                               status=signed
                               + guardar PDFs
               ←── push RT
               (UI actualiza)
```

---

## 2 · Autenticación

Firmafy usa **token + id_show**:

1. **Login inicial** (una vez al configurar):
   ```
   POST https://app.firmafy.com/ApplicationProgrammingInterface.php
   {
     action: "login",
     usuario: <FIRMAFY_USER>,
     password: <FIRMAFY_PASSWORD>
   }
   → { error: false, data: "<TOKEN>" }
   ```
   El token **no caduca** (válido mientras no lo regeneres). Guárdalo
   en env var `FIRMAFY_TOKEN`.

2. **`id_show`** es la clave pública del promotor. Sale del panel de
   configuración de Firmafy. Se envía en TODAS las llamadas.

**Env vars:**
```
FIRMAFY_USER=           # para re-login si se revoca el token
FIRMAFY_PASSWORD=
FIRMAFY_TOKEN=          # persistente · se carga en cada request
FIRMAFY_ID_SHOW=        # public key del tenant
FIRMAFY_WEBHOOK_SECRET= # opcional · validar webhook via HMAC custom
```

---

## 3 · Endpoints del backend Byvaro

### 3.1 · `POST /api/contracts/:id/send-to-sign`

Enviar un contrato a firmar. **Input:** ID del contrato ya subido
(status `draft`). **Output:** `csv` + `status: sent`.

**Implementación:**

```ts
// 1. Cargar contrato de BD (tabla collaboration_contracts)
const contract = await db.contracts.findOne({ id, workspaceId });
if (!contract || contract.status !== "draft") throw 400;

// 2. Construir payload Firmafy · los campos coinciden 1:1 con el
//    shape ContractSigner del frontend (sin traducción).
const signers = contract.signers.map(s => ({
  nombre: s.nombre,
  nif: s.nif,
  email: s.email,
  telefono: s.telefono,
  cargo: s.cargo,
  empresa: s.empresa,
  cif: s.cif,
  type_notifications: s.notifications,
  // opcional: signer_priority se setea a nivel contrato
}));

// 3. Descargar el PDF del storage
const pdfBuffer = await storage.download(contract.pdfKey);
const pdfBase64 = pdfBuffer.toString("base64");

// 4. Llamar Firmafy
const body = new FormData();
body.append("action", "request");
body.append("token", process.env.FIRMAFY_TOKEN);
body.append("id_show", process.env.FIRMAFY_ID_SHOW);
body.append("signer1", JSON.stringify(signers));
body.append("pdf_base64", pdfBase64);
body.append("pdf_name", contract.pdfFilename);
if (contract.subject)  body.append("subject", contract.subject);
if (contract.message)  body.append("message", contract.message);
if (contract.language) body.append("language", contract.language);
if (contract.signerPriority) body.append("signer_priority", "true");

const res = await fetch(
  "https://app.firmafy.com/ApplicationProgrammingInterface.php",
  { method: "POST", body }
).then(r => r.json());

if (res.error) throw new Error(res.message);

// 5. Persistir csv y actualizar estado
await db.contracts.update(id, {
  csv: res.data,
  status: "sent",
  sentAt: now(),
});

// 6. Registrar evento en company_events + contract events
await recordContractSent(contract.agencyId, contract.id, actor);

return { csv: res.data, status: "sent" };
```

### 3.2 · `POST /api/webhooks/firmafy`

Recibe callback de Firmafy al firmar. **Público**, validar origen.

**Subscripción inicial** (una vez al desplegar, o vía script de
bootstrap):

```
POST https://app.firmafy.com/ApplicationProgrammingInterface.php
{
  action: "webhook",
  token: <FIRMAFY_TOKEN>,
  id_show: <FIRMAFY_ID_SHOW>,
  type: 1,                                     // 1 = todos firmados
  method: 2,                                    // 2 = JSON body (preferible)
  url_webhook: "https://app.byvaro.com/api/webhooks/firmafy"
}
```

**También subscribir `type=2`** (cada firmante completa) si queremos
estado granular (`viewed/partial`).

**Handler:**

```ts
export async function POST(req: Request) {
  const payload = await req.json();
  // payload: {
  //   type: 1,
  //   csv: "xxxxxxx",
  //   status: "signed",
  //   daterequest, datesign,
  //   subject, filename,
  //   docoriginal: <url>,
  //   docsigned:   <url>,
  //   docaudit:    <url>,
  //   sender: "...",
  //   signers: [{ name, phone, nif, email, status, compliance, datesign }]
  // }

  // 1. Validar origen (opcional · HMAC si Firmafy lo soportara; si no,
  //    allowlist por IP de Firmafy o secret shared en URL).
  if (!isValidFirmafyOrigin(req)) return new Response(null, { status: 403 });

  // 2. Buscar contrato por csv
  const contract = await db.contracts.findOne({ csv: payload.csv });
  if (!contract) return new Response(null, { status: 404 });

  // 3. Descargar PDFs firmados a nuestro storage (no depender de URLs
  //    temporales de Firmafy — pueden caducar)
  const signedKey = `contracts/${contract.id}/signed.pdf`;
  const auditKey  = `contracts/${contract.id}/audit.pdf`;
  await Promise.all([
    storage.uploadFromUrl(payload.docsigned, signedKey),
    storage.uploadFromUrl(payload.docaudit,  auditKey),
  ]);

  // 4. Actualizar contrato
  await db.contracts.update(contract.id, {
    status: "signed",
    signedAt: new Date(payload.datesign),
    docSignedKey: signedKey,
    docAuditKey:  auditKey,
    signers: mergeSigners(contract.signers, payload.signers),
  });

  // 5. Registrar evento cross-empresa
  await recordContractSigned(contract.agencyId, contract.id);

  // 6. Notificar al promotor (email + in-app toast via pusher/realtime)
  await notifyContractSigned(contract);

  return new Response("OK", { status: 200 });
}
```

**Idempotencia obligatoria** · Firmafy reintenta hasta 3 veces cada
30 min si recibe 4xx/5xx. Si el contrato ya estaba `signed`, no hacer
nada (devolver 200).

### 3.3 · `POST /api/contracts/:id/revoke`

Cancelar un contrato que estaba enviado sin firmar.

```ts
const contract = await db.contracts.findOne({ id, workspaceId });
if (!contract?.csv) throw 400;

const body = new FormData();
body.append("action", "invalidar_documento");
body.append("token", process.env.FIRMAFY_TOKEN);
body.append("id_show", process.env.FIRMAFY_ID_SHOW);
body.append("csv", contract.csv);

await fetch(
  "https://app.firmafy.com/ApplicationProgrammingInterface.php",
  { method: "POST", body }
);

await db.contracts.update(id, {
  status: "revoked",
  events: [...contract.events, { type: "revoked", at: now(), by: actor }],
});
```

### 3.4 · `GET /api/contracts/:id/signed-pdf`

Devolver el PDF firmado para descarga del promotor. Leer del storage
privado con URL firmada de corta duración (5 min).

### 3.5 · `GET /api/firmafy/balance`

Panel de administración · muestra créditos disponibles (de Firmafy).

```
action=balance, token, id_show
→ { credits, sms, mb, days }
```

---

## 4 · Shape de `ContractSigner` (alineado con Firmafy)

El frontend YA captura estos campos en `ContractUploadDialog.tsx`:

| Campo frontend | Campo Firmafy | Obligatorio | Validación |
|---|---|---|---|
| `nombre` | `nombre` | ✅ | non-empty |
| `email` | `email` | ✅ | RFC 5321 |
| `nif` | `nif` | ✅ | DNI / NIE / pasaporte |
| `telefono` | `telefono` | ✅ (si SMS) | E.164 básico |
| `cargo` | `cargo` | — | — |
| `empresa` | `empresa` | si persona jurídica | — |
| `cif` | `cif` | si persona jurídica | — |
| `notifications` | `type_notifications` | ✅ | `"email" \| "sms" \| "email,sms"` |

A nivel de contrato:
- `subject` → `subject`
- `message` → `message`
- `language` → `language` (`"es" \| "en" \| "fr" \| "it" \| "ca"`)
- `signerPriority` → `signer_priority: "true"`

---

## 5 · Tabla `collaboration_contracts` (Postgres)

```sql
CREATE TYPE contract_status AS ENUM (
  'draft', 'sent', 'viewed', 'signed', 'expired', 'revoked'
);

CREATE TABLE collaboration_contracts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agency_id          uuid NOT NULL REFERENCES agencies(id)   ON DELETE CASCADE,
  title              text NOT NULL,
  pdf_key            text NOT NULL,      -- key en storage privado
  pdf_filename       text NOT NULL,
  pdf_size           integer,
  status             contract_status NOT NULL DEFAULT 'draft',
  sent_at            timestamptz,
  signed_at          timestamptz,
  expires_at         timestamptz,

  -- Firmafy
  csv                text UNIQUE,        -- identificador de Firmafy
  subject            text,
  message            text,
  language           text DEFAULT 'es',
  signer_priority    boolean DEFAULT false,
  doc_signed_key     text,               -- storage key del PDF firmado
  doc_audit_key      text,               -- storage key del PDF de auditoría

  -- Metadatos de la relación
  comision           numeric(5,2),       -- % pactado
  duracion_meses     integer,            -- 0 = indefinido
  scope_promotion_ids uuid[],            -- vacío = todas

  created_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON collaboration_contracts (workspace_id, agency_id);
CREATE INDEX ON collaboration_contracts (csv) WHERE csv IS NOT NULL;

-- Firmantes normalizados
CREATE TABLE contract_signers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid NOT NULL REFERENCES collaboration_contracts(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  email         text NOT NULL,
  nif           text NOT NULL,
  telefono      text NOT NULL,
  cargo         text,
  empresa       text,
  cif           text,
  notifications text NOT NULL CHECK (notifications IN ('email','sms','email,sms')),
  order_index   integer,
  signed_at     timestamptz
);

-- Historial de eventos
CREATE TYPE contract_event_type AS ENUM (
  'uploaded', 'sent', 'viewed', 'signed', 'expired', 'revoked'
);

CREATE TABLE contract_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES collaboration_contracts(id) ON DELETE CASCADE,
  type         contract_event_type NOT NULL,
  at           timestamptz NOT NULL DEFAULT now(),
  by_user_id   uuid REFERENCES users(id),
  by_name      text,
  note         text
);

CREATE INDEX ON contract_events (contract_id, at);

-- RLS
ALTER TABLE collaboration_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant ON collaboration_contracts
  USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);
```

---

## 6 · Permisos (ya declarados en frontend)

El frontend ya usa estas `PermissionKey`:

- `collaboration.contracts.view` · ver lista de contratos.
- `collaboration.contracts.manage` · subir + enviar + revocar.

El backend debe enforzar a nivel de endpoint:

```ts
// Middleware guard
if (!userHasPermission(req.user, "collaboration.contracts.manage"))
  return 403;
```

---

## 7 · Límites y constraints

- **Tamaño PDF**: sin límite explícito en Firmafy · enforzar 20MB en
  backend (tanto por performance como por coste SMS OTP).
- **Idiomas soportados**: `es` (default), `en`, `it`, `fr`, `ca`.
- **SMS body**: máx 160 chars (no configurable — Firmafy maneja).
- **Página**: A4 recomendado (210×297 mm). Firmafy puede firmar otros
  tamaños, pero la traza visual queda mejor en A4.
- **Webhook retries**: Firmafy reintenta 2 veces cada 30 min ante HTTP
  4xx/5xx. El endpoint **debe ser idempotente**.

---

## 8 · Testing

### Mock desarrollo local

El frontend tiene un mock en `src/lib/collaborationContracts.ts` con
`sendContractToSign` y `markContractSigned` que simulan la ida y
vuelta. Hasta tener credenciales Firmafy, usa ese mock · cuando se
conecte el backend, mantén la misma shape.

### Primer test end-to-end

1. Credenciales de prueba de Firmafy (pídeselas a tu cuenta comercial).
2. Subir contrato con 1 firmante (tu propio email + teléfono).
3. Enviar a firmar · debes recibir email + SMS.
4. Firmar desde el link · verificar webhook disparado.
5. Comprobar PDF firmado + PDF auditoría guardados en storage.

---

## 9 · Preguntas abiertas

- ¿Validar HMAC del webhook? Firmafy no lo soporta nativo · opciones:
  (a) IP allowlist del dominio Firmafy, (b) URL con token secreto,
  (c) verificar `csv` + `datesign` contra estado esperado.
- ¿Qué pasa si un firmante cambia de teléfono antes de firmar?
  Opción: revocar + re-enviar.
- ¿Guardamos el PDF original de subida en storage? Sí, siempre ·
  auditabilidad.
