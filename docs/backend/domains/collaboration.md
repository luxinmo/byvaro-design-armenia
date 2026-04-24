# Backend · Dominio "Colaboración" (promotor ↔ agencia)

> El diferencial del producto. Cuando un promotor entra a una agencia
> desde una promoción concreta, aterriza en un **panel operativo**
> con tres tabs: **Resumen · Documentación · Pagos**. Esta doc cubre
> los tres dominios backend que lo alimentan:
>
>   1. Contratos de colaboración (ver `../integrations/firmafy.md`).
>   2. Calendario de pagos a la agencia.
>   3. Solicitudes de documentación.
>
> **Entrada frontend:** `/colaboradores/:id/panel?from=<promoId>`.
> Código: `src/pages/ColaboracionPanel.tsx` + `src/components/collaborators/panel/`.
>
> Sigue la REGLA DE ORO · todo dato sensible (contratos, pagos,
> incidencias) tiene su `PermissionKey` declarada · el backend debe
> enforzar cada endpoint.

---

## 1 · Arquitectura general

```
                  ┌────────────────────────────┐
                  │  Panel de colaboración UI  │
                  │  /colaboradores/:id/panel  │
                  └────────────────────────────┘
                             │
         ┌───────────────────┼──────────────────┐
         │                   │                  │
   ┌─────▼─────┐      ┌──────▼──────┐    ┌──────▼──────┐
   │ Contratos │      │    Pagos    │    │  Documentos │
   │           │      │             │    │ solicitados │
   │ Firmafy   │──────┤ Generados   │────┤  Invoice    │
   │ webhook   │      │ por ventas  │    │  IBAN, etc. │
   └───────────┘      └─────────────┘    └─────────────┘
                             │
                      ┌──────▼──────┐
                      │ Sales module│  (futuro · genera tramos)
                      └─────────────┘
```

Los tres dominios comparten tabla `workspace_id + agency_id` y están
atravesados por eventos cross-empresa (`company_events`) que alimentan
el historial en `/colaboradores/:id/historial`.

---

## 2 · Contratos de colaboración

**Spec detallada:** `../integrations/firmafy.md`.

### Resumen
Promotor sube PDF · Byvaro BE llama a Firmafy (`action=request`) ·
Firmafy envía email + SMS al firmante · firma con OTP · webhook
devuelve PDFs (firmado + auditoría) · BE actualiza estado.

### Tablas
- `collaboration_contracts` (ver Firmafy doc sec. 5)
- `contract_signers`
- `contract_events`

### Endpoints
- `GET    /api/agencias/:id/contracts` → lista
- `POST   /api/agencias/:id/contracts` → subir PDF (multipart)
- `POST   /api/contracts/:id/send-to-sign` → Firmafy `action=request`
- `POST   /api/contracts/:id/revoke` → Firmafy `action=invalidar_documento`
- `GET    /api/contracts/:id/signed-pdf` → URL firmada descarga
- `DELETE /api/contracts/:id` → eliminar borrador (solo si `status=draft`)
- `POST   /api/webhooks/firmafy` → público

### Permisos
- `collaboration.contracts.view`
- `collaboration.contracts.manage`

---

## 3 · Calendario de pagos a agencia

Cuando se cierra una venta con una agencia, Byvaro genera los pagos
según los **tramos de comisión** pactados en el contrato (p.ej. 30%
al firmar arras · 30% al contrato privado · 40% al escriturar).

### 3.1 · Ciclo de vida del pago

```
scheduled ──(venc.)──→ due ──(marcar pagado)──→ paid
    │                   │
    └─────(on-hold)─────┤               ┌──(cancelar venta)──→ cancelled
                        │               │
                        └─(release)─────┘
```

| Estado | Qué significa |
|---|---|
| `scheduled` | Generado por la venta, aún no venció. |
| `due` | Vencimiento alcanzado, listo para ejecutar. |
| `on-hold` | Bloqueado por falta de documentación (factura típicamente). |
| `paid` | Ejecutado · auditado. |
| `cancelled` | Anulado (venta caída, contrato revocado). |

### 3.2 · Tabla `agency_payments`

```sql
CREATE TYPE payment_status AS ENUM (
  'scheduled', 'due', 'on-hold', 'paid', 'cancelled'
);

CREATE TABLE agency_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id),
  agency_id             uuid NOT NULL REFERENCES agencies(id),
  sale_id               uuid REFERENCES sales(id),        -- futuro módulo
  promotion_id          uuid REFERENCES promotions(id),
  promotion_name        text,
  unit_label            text,       -- desc. libre (ej. "Villa 12-B")
  client_name           text,
  concept               text NOT NULL,    -- "Comisión tramo 1 · firma de arras (30%)"
  amount                numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date              timestamptz NOT NULL,
  paid_at               timestamptz,
  status                payment_status NOT NULL DEFAULT 'scheduled',
  on_hold_reason        text,
  required_document_ids uuid[],    -- referencias a agency_doc_requests
  invoice_document_id   uuid REFERENCES agency_doc_requests(id),
  note                  text,                 -- libre del promotor
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON agency_payments (workspace_id, agency_id);
CREATE INDEX ON agency_payments (due_date) WHERE status IN ('scheduled','due');

ALTER TABLE agency_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant ON agency_payments
  USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);
```

### 3.3 · Generación automática desde ventas (futuro)

Cuando el módulo de ventas cierre una venta:

```ts
// En handler de "venta cerrada"
const contract = await getActiveContractForAgency(agencyId);
const tramos = contract.paymentTramos;  // [{ at: "arras", percent: 30 }, ...]

for (const t of tramos) {
  await db.agency_payments.insert({
    workspace_id, agency_id, sale_id: sale.id,
    promotion_id: sale.promotion_id,
    unit_label:   sale.unit_label,
    client_name:  sale.client_name,
    concept:      `Comisión tramo · ${t.at} (${t.percent}%)`,
    amount:       sale.price * (contract.comision/100) * (t.percent/100),
    due_date:     computeDueDate(sale, t),
    status:       'scheduled',
  });
}
```

### 3.4 · Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/api/agencias/:id/payments` | Lista con filtros opcionales (status, date range, promotion_id) |
| `PATCH` | `/api/payments/:id` | Body: `{ action: "mark-paid" \| "hold" \| "release" \| "cancel", reason?, note? }` |
| `GET` | `/api/agencias/:id/payments/summary` | Agregados: `{ paidTotal, pendingTotal, onHoldTotal, overdueCount, nextDue }` |

### 3.5 · Cron · pagos vencidos

Diario:
```sql
UPDATE agency_payments
   SET status = 'due'
 WHERE status = 'scheduled'
   AND due_date <= NOW();
```
Luego notificar al admin del promotor de pagos vencidos sin procesar
(email + evento in-app).

### 3.6 · Permisos
- `collaboration.payments.view`
- `collaboration.payments.manage`

---

## 4 · Solicitudes de documentación

El promotor pide a la agencia documentos necesarios para poder
pagarle (factura, IBAN, certificado fiscal, modelo trimestral,
seguro RC o custom). La agencia los sube desde su portal (cuando se
implemente la parte de agencia). El promotor revisa y aprueba.

### 4.1 · Tipos predefinidos

```ts
type DocRequestType =
  | "invoice"        // factura con IVA desglosado
  | "iban"           // certificado bancario titular+IBAN
  | "fiscal-cert"    // alta actividad económica
  | "tax-quarter"    // modelo 130 / 303 / 115
  | "rc-insurance"   // póliza RC vigente
  | "custom";        // cualquier otro
```

### 4.2 · Estados

```
pending ──(agencia sube)──→ uploaded ──(promotor revisa)──→ approved
                                                         └──→ rejected ──(agencia re-sube)──→ uploaded
```

### 4.3 · Tabla `agency_doc_requests`

```sql
CREATE TYPE doc_request_type AS ENUM (
  'invoice', 'iban', 'fiscal-cert', 'tax-quarter', 'rc-insurance', 'custom'
);
CREATE TYPE doc_request_status AS ENUM (
  'pending', 'uploaded', 'approved', 'rejected'
);

CREATE TABLE agency_doc_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id),
  agency_id        uuid NOT NULL REFERENCES agencies(id),
  type             doc_request_type NOT NULL,
  label            text NOT NULL,
  note             text,
  payment_id       uuid REFERENCES agency_payments(id),  -- si vinculado a pago
  status           doc_request_status NOT NULL DEFAULT 'pending',
  requested_by     uuid REFERENCES users(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_at      timestamptz,
  file_key         text,           -- storage key (privado)
  file_name        text,
  file_size        integer,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES users(id),
  rejection_reason text
);

ALTER TABLE agency_doc_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenant ON agency_doc_requests
  USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);

-- La agencia (cuando tenga workspace propio) accede a sus solicitudes
-- vía otra policy basada en agency_id → ver RLS de agencia.
```

### 4.4 · Endpoints · lado promotor

| Método | Ruta | Propósito |
|---|---|---|
| `GET`    | `/api/agencias/:id/doc-requests` | Listar |
| `POST`   | `/api/agencias/:id/doc-requests` | Crear: `{ type, label, note?, payment_id? }` |
| `PATCH`  | `/api/doc-requests/:id/approve`  | Aprobar |
| `PATCH`  | `/api/doc-requests/:id/reject`   | Rechazar: `{ reason }` |
| `DELETE` | `/api/doc-requests/:id`          | Cancelar solicitud (solo si `pending`) |
| `GET`    | `/api/doc-requests/:id/file`     | URL firmada de descarga (5 min) |

### 4.5 · Endpoints · lado agencia (futuro)

| Método | Ruta | Propósito |
|---|---|---|
| `GET`  | `/api/agency/doc-requests` | Las solicitudes que ha recibido (todos los promotores) |
| `POST` | `/api/doc-requests/:id/upload` | Multipart · sube PDF · status → uploaded |

### 4.6 · Notificaciones

- Al crear solicitud → email a `agency.contactoPrincipal.email`.
- Al subir archivo → email al promotor que solicitó.
- Al rechazar → email a la agencia con motivo.
- Al aprobar → si el doc estaba vinculado a un `agency_payment`
  on-hold, **auto-liberar el pago** (cambiar a `due`).

### 4.7 · Storage

- PDFs en bucket privado `documents/` con sub-carpeta por workspace.
- Nombre: `doc-requests/{id}/{sha256}.pdf`.
- Access: URL firmada temporal (5 min) solo para miembros con
  `collaboration.documents.manage` del promotor, o el workspace
  de la agencia dueña.

### 4.8 · Permisos
- `collaboration.documents.manage`

---

## 5 · Panel de colaboración · GET combinado

El frontend carga varias cosas a la vez al aterrizar en el panel.
Para evitar 5 requests paralelos, exponer un endpoint agregador:

### `GET /api/agencias/:id/collaboration-panel?from=<promoId>`

**Response:**
```jsonc
{
  "agency": { /* Agency shape · parcial, solo lo necesario */ },
  "contract_agreement": {
    "state": "vigente" | "por-expirar" | "expirado" | "sin-contrato",
    "daysLeft": 127
  },
  "funnel": {
    "registros": 12,
    "visitas": 18,
    "ventasCerradas": 3,
    "volumen": 2350000,
    "conversion": 25
  },
  "alerts": {
    "notSharedPromotions": [ /* promociones activas sin compartir */ ],
    "blockedPaymentsCount": 1,
    "blockedPaymentsAmount": 7800,
    "pendingContractsCount": 1
  },
  "upcomingVisits": [ /* next 5 scheduled visits · filtered by promotion if from */ ],
  "recentEvents": [ /* últimos 5 company_events */ ],
  "topAgents": [ /* agentes que han interactuado en from=promoId */ ],
  "incidents": { "duplicados": 0, "cancelaciones": 0, "reclamaciones": 0 }
}
```

**Privacy**: `topAgents` solo devuelve agentes que han creado
registros / visitas / emails EN la promoción de `?from=`. El resto
del equipo de la agencia no se expone (ver `dual-role-model.md`).

---

## 6 · Eventos cross-empresa (recap)

Todo cambio en este dominio registra un evento en `company_events`:

- `contract_sent`, `contract_signed`, `contract_revoked`
- `payment_scheduled`, `payment_paid`, `payment_on_hold`
- `doc_requested`, `doc_uploaded`, `doc_approved`, `doc_rejected`
- `collaboration_paused`, `collaboration_resumed`

Ver `docs/backend-integration.md §4.5` para tabla completa.

---

## 7 · Tests mínimos recomendados

- Subir PDF y enviar a firmar · mockear Firmafy, verificar `csv` guardado y estado `sent`.
- Recibir webhook con `csv` inexistente · responder 404 sin crash.
- Recibir webhook duplicado · idempotente (no re-procesa).
- Marcar pago `paid` sin factura aprobada · si backend enforza, 422; si solo aviso, 200 + warning.
- Rechazar doc con factura vinculada a pago on-hold · pago sigue on-hold.
- Aprobar factura vinculada a pago on-hold · pago auto-transiciona a `due`.
