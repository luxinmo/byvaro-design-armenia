# Backend handoff · Byvaro

> Entrada única para el agente / equipo que construya el backend real
> de Byvaro. El frontend (`src/`) está hecho con mocks en
> `localStorage` y `TODO(backend)` sembrados en el código · esta
> carpeta explica qué hay que sustituir, en qué orden, y cuál es la
> shape exacta de cada endpoint.

---

## 1 · Empieza aquí

1. Lee **`docs/product.md`** — modelo de negocio, personas (promotor,
   agencia invitada, agencia marketplace, agencia sin plan).
2. Lee **`docs/architecture.md`** — arquitectura de información,
   patrones, flujos críticos.
3. Lee **`CLAUDE.md` · secciones "REGLA DE ORO"** — son invariantes
   del producto. Cualquiera de ellas que se rompa es bug.
4. Vuelve aquí para el plan de implementación.

---

## 2 · Stack recomendado (no obligatorio)

La elección final es tuya, pero el frontend funciona sin fricción
con esta combinación:

| Capa | Recomendación | Alternativa |
|---|---|---|
| Hosting + funciones | **Vercel** (ya usamos) | Cloudflare Workers, Fly.io |
| Base de datos | **Supabase Postgres** | Neon, Vercel Postgres |
| Auth | **Supabase Auth** (JWT, row-level security) | Clerk, Auth0 |
| Storage (PDFs, fotos) | **Supabase Storage** o **Vercel Blob** | S3 |
| Email transaccional | **Resend** o **SendGrid** | — |
| Firma digital | **Firmafy** (ver `integrations/firmafy.md`) | — |
| Mapas | **Google Places API** | — |
| WhatsApp | **WhatsApp Business API** (vía Twilio) | MessageBird |
| Crons / jobs | **Vercel Cron** | Supabase scheduled functions |

El repo ya tiene el plugin de Vercel configurado · deploying por
`git push`. Secrets en variables de entorno de Vercel + Supabase.

---

## 3 · Orden sugerido de implementación

El frontend ya usa todo este backend como mock. Implementa en este
orden para que no se te caiga nada:

### Fase 0 · infraestructura base
- Proyecto Supabase (DB + Auth + Storage)
- Deploy Vercel con env vars conectadas
- Tabla `workspaces` (tenant del promotor) + `users` + `memberships`
  (M:N con `role: admin | member`)
- RLS policies que fuerzan `workspace_id = auth.jwt() -> workspace_id`
  en todas las tablas

### Fase 1 · auth + perfiles
- `POST /api/auth/signup` · alta de promotor + workspace
- `POST /api/auth/login` · devuelve JWT con `workspace_id` y `role`
- `GET  /api/me` · usuario actual + permisos
- Envío de emails · "Bienvenida" · "Verificación" · "Reseteo"
  → ver **`docs/backend/integrations/email-templates.md`** (incluye
    plantillas del sistema listadas en `/ajustes/plantillas`)

### Fase 2 · entidades principales
En este orden (las siguientes dependen de las anteriores):

1. **Promociones** (`promotions`) + **Unidades** (`units`) + **Anejos**
   (`parking_storage_units`). Specs: `docs/backend-integration.md §3`.
2. **Agencias** (`agencies`) + **Collaborations** (M:N
   promoción↔agencia). Specs: `§4`.
3. **Invitaciones** a agencias (`invitations` + historial de eventos
   por invitación). Specs: `§5`.
4. **Solicitudes** de la agencia hacia el promotor:
   - **Solicitud agency-level** (alta marketplace, una por agencia).
     Specs: `docs/backend-integration.md §4`.
   - **Solicitud por promoción** (una por par agencia↔promo, mucho más
     granular y reciente). Specs: **`docs/backend/domains/collaboration-requests.md`**.
   Ambas conviven en el mismo drawer de `/colaboradores` con tabs
   Pendientes/Aceptadas/Descartadas. **Son flujos distintos** — no las
   mezcles ni las modeles juntas en la misma tabla.
5. **Registros** de clientes (`registrations`) + detección de
   duplicados con IA. Specs: `§7` + `docs/data-model.md`.
6. **Contactos** (`contacts`) · base de clientes propia del promotor.

### Fase 3 · el pilar (colaboración entre empresas)
Aquí está el diferencial del producto. **Se especifica en
`docs/backend/domains/collaboration.md`**. Cubre:

- Contratos de colaboración + firma con **Firmafy**.
- Calendario de pagos a agencia (generado por las ventas).
- Solicitudes de documentos (factura, IBAN, certificados).
- Panel operativo cuando un promotor entra a una agencia desde una
  promoción concreta.

### Fase 4 · eventos cross-empresa
- Timeline de eventos entre promotor y agencia (ya existe el helper
  `recordCompanyEvent` en frontend · backend lo persiste en
  `company_events`). Specs: `docs/backend-integration.md §4.5`.

### Fase 5 · comunicación
- Email compose + envío (el frontend ya tiene el dialog completo).
- Plantillas del sistema · TODAS listadas en `/ajustes/plantillas`.
  Ver `docs/backend/integrations/email-templates.md`.
- WhatsApp (cuentas vinculadas + conversaciones).

### Fase 6 · analítica + ventas
- Módulo de ventas (aún no construido frontend, pero el panel de
  colaboración muestra el placeholder). Generará los pagos de agencia
  automáticamente al cerrar venta.

---

## 4 · Catálogo de TODO(backend) en el código

Para ver todos los puntos exactos donde el frontend espera un
endpoint:

```bash
grep -rn "TODO(backend)" src/
```

Cada TODO apunta a la sección de `docs/backend-integration.md` donde
está la spec del endpoint. Hay ~60 TODOs · ninguno queda sin documentar.

---

## 5 · Documentación por dominio

Estos docs cubren en profundidad cada dominio. Todos tienen la misma
estructura: **flujo de negocio · modelo de datos · endpoints · webhooks
/ crons · casos edge**.

| Doc | Cubre |
|---|---|
| `docs/backend-integration.md` | Canónico · TODOS los endpoints, por dominio. Ya existe, mantenerlo al día. |
| `docs/data-model.md` | Entidades, tipos TypeScript del frontend (hay que mapear a SQL). |
| `docs/permissions.md` | Catálogo completo de `PermissionKey` + contrato RLS + JWT. |
| `docs/backend/domains/collaboration.md` | Contratos · pagos · solicitudes de documentos. |
| **`docs/backend/domains/collaboration-requests.md`** | **Solicitudes de colaboración por promoción** · agencia → promotor · descarte silencioso · override por invitación · permiso `collaboration.requests.manage`. |
| **`docs/backend/domains/agency-developer-mirror.md`** | **Vista de promotor desde la agencia** · `/promotor/:id` + `/promotor/:id/panel` · mirror del panel de colaborador con `readOnly` para tabs sensibles. |
| **`docs/backend/domains/empresa-stats-and-offices.md`** | **Empresa hero KPIs derivados + oficinas single-source** · sustitución de campos manuales del tipo `Empresa` + unificación `byvaro-oficinas`. |
| `docs/backend/integrations/firmafy.md` | Integración completa con Firmafy · API, webhooks, payload. |

---

## 6 · Variables de entorno mínimas

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo funciones serverless

# Firmafy (ver integrations/firmafy.md)
FIRMAFY_USER=
FIRMAFY_PASSWORD=                 # o directamente FIRMAFY_TOKEN
FIRMAFY_ID_SHOW=                  # public key del promotor
FIRMAFY_WEBHOOK_SECRET=           # opcional, validar origen

# Email (Resend ejemplo)
RESEND_API_KEY=

# Google Places (agencia marketplace ratings)
GOOGLE_PLACES_API_KEY=

# WhatsApp Business (futuro)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Dominios
NEXT_PUBLIC_APP_URL=https://app.byvaro.com
API_PUBLIC_URL=https://app.byvaro.com/api
```

---

## 7 · Webhooks entrantes

El backend debe exponer estos endpoints públicos:

| URL | Origen | Propósito |
|---|---|---|
| `POST /api/webhooks/firmafy` | Firmafy | Notifica firma completa · ver `integrations/firmafy.md` |
| `POST /api/webhooks/email/bounces` | Resend/SendGrid | Bounces y aperturas |
| `POST /api/webhooks/whatsapp` | Meta | Mensajes entrantes de WhatsApp Business |

Cada uno debe validar origen (HMAC o IP allowlist) antes de procesar.

---

## 8 · Crons / jobs programados

| Cron | Frecuencia | Propósito |
|---|---|---|
| Expirar invitaciones pendientes pasado su `expiraEn` | diaria | Actualizar estado → `caducada` |
| Recordatorio de visita 24h antes | cada hora | Enviar email a cliente + agencia |
| Registros expiran pasado el plazo de validez | diaria | Actualizar estado → `expirado` |
| Refrescar rating Google de agencias marketplace | semanal | Re-consultar Places API (ToS ≤30 días) |
| Contratos próximos a expirar (≤30 días) | diaria | Email al admin del promotor |
| Generar recordatorios de pagos vencidos | diaria | Email al admin + webhook interno |

---

## 9 · Multi-tenancy · regla inviolable

Cada fila de cada tabla de negocio lleva `workspace_id`. RLS
policies en Postgres fuerzan `workspace_id = current_setting(
'request.jwt.claims')::json->>'workspace_id'` para `SELECT / INSERT /
UPDATE / DELETE`. El service role bypasea RLS solo para webhooks y
crons.

La vista Agencia colaboradora (cuando se implemente su portal propio)
accede a otro workspace vía tabla `collaborations` que autoriza
ciertos permisos puntuales.

---

## 10 · Checklist final antes de ir a producción

- [ ] Todas las tablas con `workspace_id` + RLS.
- [ ] `PermissionKey` del frontend tienen su contrato en backend
      (enforcement en cada endpoint, no solo UI).
- [ ] Webhooks validados con HMAC.
- [ ] Secrets en env vars, nunca en código.
- [ ] Storage de PDFs firmados conservado por +10 años (obligación
      legal firma digital).
- [ ] Trazabilidad completa: cada mutación genera `company_events` o
      evento de dominio para auditoría.
- [ ] Backups automáticos diarios de la BD.
- [ ] Logs estructurados en todas las funciones serverless.

---

## 11 · Contacto si te atascas

Si llegas a un endpoint sin spec o con ambigüedad:

1. Primero mira `docs/open-questions.md` · puede estar anotado.
2. Si no, **no inventes** · detente y pregunta al equipo de producto.
3. Añade la pregunta a `docs/open-questions.md` con tu PR actual.

---

**Última actualización de esta spec:** 24 abril 2026 · v1
