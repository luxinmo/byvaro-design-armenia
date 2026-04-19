# Contrato de API · Byvaro v2

Endpoints que el frontend espera cuando se monte el backend. Este documento
es **contract-first**: define lo que el backend debe entregar.

> Si usas Supabase, muchos endpoints se convierten en consultas directas vía
> el SDK con RLS. Esta spec sigue siendo útil para entender qué datos pide
> cada pantalla.

## Base

- **URL base**: `/api/v1`
- **Auth**: JWT en header `Authorization: Bearer <token>` (salvo endpoints
  públicos)
- **Content-Type**: `application/json` (salvo uploads `multipart/form-data`)
- **Errores**: formato estándar
  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "..." } }
  ```

## Auth

| Método | Endpoint | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, refreshToken, user }` |
| POST | `/auth/register` | `{ email, password, companyName }` | `{ token, user, companyId }` |
| POST | `/auth/forgot-password` | `{ email }` | `{ ok: true }` |
| POST | `/auth/reset-password` | `{ token, newPassword }` | `{ ok: true }` |
| POST | `/auth/verify-2fa` | `{ code }` | `{ token }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ token }` |
| POST | `/auth/logout` | — | `{ ok: true }` |
| GET | `/auth/me` | — | `{ user, company, permissions }` |

## Promociones

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/promotions` | Lista paginada, soporta filtros query |
| GET | `/promotions/:id` | Detalle + units + colaboraciones |
| POST | `/promotions` | Crear (body = WizardState) |
| PATCH | `/promotions/:id` | Editar |
| DELETE | `/promotions/:id` | Archivar (no eliminar físicamente) |
| POST | `/promotions/:id/publish` | Validar y publicar |
| POST | `/promotions/:id/duplicate` | Clonar como borrador |

**Query params del listado** (`GET /promotions`):
```
?search=texto&status=active,incomplete&type=Villas,Apartments
&priceMin=500000&commissionMin=5&delivery=2026,2027&page=1&limit=20
```

**Response**:
```ts
{
  data: Promotion[];
  meta: { total: number; page: number; limit: number; pages: number };
  aggregates: { active: 8, incomplete: 3, "sold-out": 2, draft: 1 };
}
```

## Unidades

| Método | Endpoint |
|---|---|
| GET | `/promotions/:id/units` — lista completa de unidades |
| GET | `/units/:id` — detalle |
| PATCH | `/units/:id` — editar (promotor only) |
| POST | `/units/bulk-update` — edición masiva `{ ids: [], changes: {} }` |
| POST | `/units/:id/reserve` — reservar (agency only, si available) |

## Colaboradores (agencias)

| Método | Endpoint |
|---|---|
| GET | `/agencies` — lista con filtros |
| GET | `/agencies/:id` — detalle |
| POST | `/agencies/:id/invite` — invitar a colaborar en una promo |
| POST | `/agencies/:id/approve` — aceptar solicitud nueva |
| POST | `/agencies/:id/revoke` — quitar acceso |
| GET | `/analytics/agency-nationality` — matriz Agencia × Nacionalidad |

**Analytics response** (usado por el dashboard):
```ts
{
  registros: { [agencyId]: { [nationalityCode]: number } };
  ventas: { [agencyId]: { [nationalityCode]: number } };  // volumen €
  eficiencia: { [agencyId]: { [nationalityCode]: number } };  // %
  insights: Array<{ type, title, description, priority }>;
}
```

## Registros

| Método | Endpoint |
|---|---|
| GET | `/registrations` — lista (con filtros) |
| GET | `/registrations/:id` — detalle + timeline completo |
| POST | `/registrations` — crear (agency only) |
| POST | `/registrations/:id/approve` | `{ note? }` |
| POST | `/registrations/:id/decline` | `{ reason }` |
| POST | `/registrations/:id/request-info` | `{ message }` |
| GET | `/registrations/duplicate-check?phoneLast4=1234&promotionId=xxx` — pre-check antes de crear |

## Contactos (CRM)

| Método | Endpoint |
|---|---|
| GET | `/contacts` — listado con filtros + scoring |
| GET | `/contacts/:id` — ficha completa + timeline |
| POST | `/contacts` — crear manualmente |
| PATCH | `/contacts/:id` — editar |
| POST | `/contacts/import` — import masivo CSV/Excel |

## Visitas / Calendario

| Método | Endpoint |
|---|---|
| GET | `/visits?from=2026-04-01&to=2026-04-30&assignedTo=userId` |
| POST | `/visits` — programar nueva |
| PATCH | `/visits/:id` — confirmar / reprogramar |
| POST | `/visits/:id/cancel` | `{ reason }` |
| POST | `/visits/:id/complete` | `{ outcome, notes }` |

## Ventas / Pipeline

| Método | Endpoint |
|---|---|
| GET | `/sales?stage=lead,visit,reservation,contract` — pipeline kanban |
| GET | `/sales/:id` |
| POST | `/sales` — crear reserva |
| PATCH | `/sales/:id/stage` | `{ newStage }` — mover en pipeline |
| POST | `/sales/:id/commission/pay` — marcar pagada (via Stripe Connect) |

## Multimedia / Storage

Uploads directos al storage (Supabase / R2 / S3) con URLs pre-firmadas.

| Método | Endpoint |
|---|---|
| POST | `/uploads/presign` — devuelve URL pre-firmada `{ url, fields, key }` |
| POST | `/uploads/confirm` — confirma subida y registra en DB |

## Microsites

| Método | Endpoint |
|---|---|
| GET | `/microsites/:promotionId` |
| PATCH | `/microsites/:promotionId` — editar landing |
| POST | `/microsites/:promotionId/publish` |
| GET | `/public/p/:slug` — endpoint público del microsite |
| POST | `/public/p/:slug/lead` — formulario captación → crea registro |

## Emails

| Método | Endpoint |
|---|---|
| GET | `/email-templates` — lista plantillas del sistema + custom |
| GET | `/email-templates/:id` |
| PATCH | `/email-templates/:id` — editar |
| POST | `/email-campaigns` — enviar campaña a segmento |

## Webhooks (entrantes)

Endpoints que Byvaro expone para servicios externos:

| Endpoint | De quién | Qué hace |
|---|---|---|
| POST `/webhooks/stripe` | Stripe | Eventos de pagos de comisiones |
| POST `/webhooks/twilio` | Twilio | Respuestas de SMS (confirmación visita) |
| POST `/webhooks/email-bounce` | Resend | Bounces + quejas |

## Realtime (si usas Supabase)

Suscripciones esperadas por la UI:

- `registrations` (filtro: company_id) → notificaciones cuando llega un
  registro nuevo
- `visits` (filtro: assignedTo) → visita reprogramada o confirmada
- `sales` (filtro: agencyId) → nueva venta asignada a la agencia

## Versionado

`/api/v1` como prefijo. Breaking changes incrementan versión. No romper v1
sin deprecation plan de 90 días.

## Rate limiting

Sugerido (defensa contra abuso de la API pública de microsites):

| Endpoint | Límite |
|---|---|
| `/auth/login` | 10/min por IP |
| `/auth/register` | 3/hora por IP |
| `/public/p/:slug/lead` | 5/min por IP |
| Resto autenticados | 120/min por usuario |

## Errores estándar

```ts
enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",        // 401
  FORBIDDEN = "FORBIDDEN",              // 403
  NOT_FOUND = "NOT_FOUND",              // 404
  VALIDATION = "VALIDATION",            // 422 — { error, fields: {...} }
  CONFLICT = "CONFLICT",                // 409 — e.g. duplicate registration
  RATE_LIMITED = "RATE_LIMITED",        // 429
  INTERNAL = "INTERNAL",                // 500
}
```

## Pagination

Cursor-based para listas largas, offset-based para listas cortas. El
listado de promociones usa offset (rara vez hay más de 50 por empresa).
Registros y contactos usan cursor (pueden ser miles).

```
GET /registrations?limit=20&cursor=eyJpZCI6IjEyMyJ9
→ { data: [...], nextCursor: "eyJpZCI6IjE0MyJ9" | null }
```
