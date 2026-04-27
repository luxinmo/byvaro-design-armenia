# Solicitudes de colaboración por promoción

> **Documento canónico.** Cualquier divergencia entre código y este
> documento se resuelve actualizando el código primero y este doc
> después en el mismo PR. Si en el momento de leer este doc ves algo
> en el código que no encaja, asume que el doc está desactualizado y
> avisa antes de implementar backend basándose en él.

## Resumen

Este flujo permite a una **agencia** solicitar colaborar con un
**promotor** en una **promoción concreta**, y al promotor aceptar /
descartar / recuperar la solicitud. Sustituye al modelo
agency-level "darme de alta como colaborador" (que sigue existiendo
en paralelo y es otro flujo).

**Diferencias clave con el flujo agency-level (alta marketplace):**

| | Solicitud por promoción | Alta de agencia |
|---|---|---|
| Granularidad | Una solicitud por (agencia, promoción) | Una solicitud por agencia |
| Origen | CTA "Solicitar colaboración" en `/promotor/:id/panel` (ResumenTab) | Alta desde marketplace o invitación cancelada |
| Estado en seed | Tabla nueva `byvaro.agency.collab-requests.v1` | Campo `Agency.solicitudPendiente` |
| Aceptación | Abre `SharePromotionDialog` paso conditions con preselección | Mark `solicitudPendiente: false`, `status: "active"` |

Ambos tipos se renderizan en el mismo drawer de `/colaboradores` con
tabs **Pendientes / Aceptadas / Descartadas** y la misma estética
de card compacta.

## Endpoints esperados

```
POST   /api/colaboraciones-solicitadas
       body: { promotionId, message? }
       headers: Authorization (JWT con agencyId del usuario)
       201 → SolicitudColaboracion
       409 → ya existe una pendiente (idempotencia)

GET    /api/me/colaboraciones-solicitadas?status=pendiente|aceptada|rechazada
       lado AGENCIA · solo las suyas
       200 → SolicitudColaboracion[]

GET    /api/colaboraciones-solicitadas?status=...
       lado PROMOTOR · todas las dirigidas a sus promociones
       200 → SolicitudColaboracion[]
       requiere permiso `collaboration.requests.manage` o lectura
       (el lectura no escribe, ver permisos abajo)

POST   /api/colaboraciones-solicitadas/:id/accept
       body opcional con condiciones de invitación (si se acepta
       directamente sin pasar por SharePromotionDialog)
       200 → SolicitudColaboracion (status: "aceptada")
       requiere `collaboration.requests.manage`
       side-effect: dispara también la invitación formal al lado
       agencia (POST /api/promociones/:id/invitaciones)

POST   /api/colaboraciones-solicitadas/:id/reject
       body: { reason? }
       200 → SolicitudColaboracion (status: "rechazada")
       requiere `collaboration.requests.manage`
       NO notifica a la agencia · descarte SILENCIOSO

POST   /api/colaboraciones-solicitadas/:id/restore
       200 → SolicitudColaboracion (status: "pendiente",
                                    decidedAt/decidedBy: null)
       requiere `collaboration.requests.manage`
       solo válido si status actual === "rechazada"
```

## Shape

```ts
interface SolicitudColaboracion {
  id: string;
  agencyId: string;
  promotionId: string;
  message?: string;
  status: "pendiente" | "aceptada" | "rechazada";
  createdAt: number;        // ms epoch · cuándo la envió la agencia
  requestedBy?: {           // snapshot del actor agencia
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  decidedAt?: number;       // ms epoch · cuándo decidió el promotor
  decidedBy?: {             // snapshot del actor promotor
    name: string;
    email?: string;
    avatarUrl?: string;
  };
}
```

`requestedBy` y `decidedBy` son **snapshots** del actor en el momento
de la acción · NO se actualizan si la persona cambia su perfil después.
El backend debe persistir todos los campos en una tabla relacional con
foreign keys a `users` para auditoría completa, pero la respuesta de
la API debe traer los snapshots embebidos para evitar joins en cliente.

## Reglas de negocio

### 1. Idempotencia
Si la agencia envía dos solicitudes para la misma promoción mientras
hay una pendiente, **no se crea una segunda** · el endpoint devuelve
la existente. La función mock `crearSolicitud()` lo refleja.

### 2. Descarte silencioso
**La agencia NUNCA se entera del descarte.** Desde su lado, una
solicitud rechazada se muestra exactamente igual que una pendiente
(chip "Colaboración solicitada · fecha · usuario"). No hay
notificación, no se puede reenviar, no aparece copy "rechazada".

Esto es deliberado: el promotor puede descartar por mil razones
(tema legal, conflicto con otra agencia, decisión interna) sin que
la agencia se ofenda o se enzarce en un re-pitch indeseado. La
agencia simplemente piensa "está pendiente, aún no me responden".

Implementación:
- En `ResumenTab.tsx` el bloque "Promociones que aún no colaboras"
  llama a `findSolicitudVivaParaAgencia(agencyId, promotionId, list)`
  que busca solicitudes `status === "pendiente" || status === "rechazada"`.
  Las dos pintan el mismo chip.
- La agencia NO ve los campos `decidedAt` / `decidedBy` ni en UI ni
  (idealmente) en la respuesta API. Backend debe stripear esos
  campos cuando el caller es el agencyId del solicitante.

### 3. Override por invitación
Si el promotor descartó una solicitud y luego cambia de idea, **NO
necesita restaurarla manualmente**. Puede simplemente **enviar una
invitación** estándar (vía `SharePromotionDialog`). El sistema:

1. Detecta que existe una solicitud rechazada para (agencyId, promotionId).
2. Muestra al promotor un banner "Esta agencia tenía una solicitud
   descartada · enviar la invitación reactivará la relación", con
   detalles de quién y cuándo descartó.
3. Al confirmar, llama a `acceptInvitationOverride(agencyId, promotionId)`
   que flipa el status a "aceptada" + setea `decidedAt: Date.now()`.
4. La invitación se procesa normalmente (crea registro en `invitaciones`).

**Backend equivalent:** el endpoint `POST /api/promociones/:id/invitaciones`
debe internamente buscar y reactivar cualquier solicitud rechazada
matcheando `(agencyId, promotionId)` antes de crear la invitación.
Es atómico (misma transacción).

### 4. Recuperar (manual restore)
Si el promotor descartó por error y quiere reconsiderar **sin enviar
invitación**, puede pulsar **Recuperar** en la tab Descartadas. La
solicitud vuelve a `pendiente` y sus campos `decidedAt` / `decidedBy`
se limpian (la decisión se "deshace" — no se preserva trazabilidad
de la decisión revertida porque ya no aplica).

### 5. Aceptación con condiciones
Aceptar abre `SharePromotionDialog` directamente en el paso
"Condiciones de colaboración" con la agencia preseleccionada (mismo
flujo que invitar a una agencia ya en Byvaro). La agencia se añade
formalmente vía `useInvitaciones()` y la promo entra a su
`promotionsCollaborating`.

**Importante:** el evento de aceptación queda en la solicitud
(`status: "aceptada"`, `decidedAt`, `decidedBy`) PERO la relación
formal de colaboración se materializa vía `Invitacion`. Backend:
crear ambos registros en una sola transacción.

## Permisos

Nueva key en `src/lib/permissions.ts`:

```ts
| "collaboration.requests.manage"
```

| Acción | Sin permiso | Con permiso |
|---|---|---|
| Ver solicitudes (drawer + tabs) | ✅ visible (read-only) | ✅ visible |
| Aceptar | ❌ botón disabled | ✅ habilitado |
| Descartar | ❌ botón disabled | ✅ habilitado |
| Recuperar | ❌ botón disabled | ✅ habilitado |

Default: `admin` lo tiene · `member` no.

UI muestra aviso lock-icon cuando un member entra al drawer y NO tiene
el permiso: _"Solo lectura · necesitas el permiso `collaboration.requests.manage`"_.

Backend debe validar en cada endpoint mutante (`POST /accept`,
`POST /reject`, `POST /restore`) que el JWT del caller tenga la
permission flag activa.

## Eventos cross-empresa

Toda creación / decisión emite un evento en `recordCompanyEvent`
(ver `src/lib/companyEvents.ts`) para que aparezca en el historial
del lado promotor (`/colaboradores/:id?tab=historial`):

| Acción | Helper | type |
|---|---|---|
| Agencia envía solicitud | `recordRequestReceived(agencyId, message, { promotionId, promotionName })` | `request_received` |
| Promotor acepta | `recordRequestApproved(agencyId, by)` | `request_approved` |
| Promotor descarta | `recordRequestRejected(agencyId, by, reason?)` | `request_rejected` |
| Promotor restaura | `recordCompanyEvent(agencyId, "request_restored", ...)` | `request_restored` (TODO) |

**Importante:** el descarte SILENCIOSO se refiere al lado AGENCIA · el
historial del lado promotor SÍ ve el evento `request_rejected` con
quién y cuándo. Si el modelo cross-empresa se vuelve bidireccional
(la agencia tiene su propio historial cross-empresa con el
promotor), el evento `request_rejected` NO debe propagarse al lado
agencia · solo `request_received` y `request_approved` lo hacen.

## UI · puntos de entrada

### Lado agencia
- `/promotor/:id/panel` → tab Resumen → bloque "Promociones que aún
  no colaboras" → CTA "Solicitar colaboración" en cada card.
- Al clicar, abre `<RequestCollaborationDialog>` con resumen visual
  de la promo + textarea (texto por defecto incluido) + 240 chars
  max + botón Enviar solicitud.
- Tras enviar:
  - Persiste en `byvaro.agency.collab-requests.v1` localStorage.
  - Toast "Solicitud enviada".
  - La card cambia a chip pasivo "Colaboración solicitada · fecha · avatar+nombre".
  - Card no clicable (cursor-default).

### Lado promotor
- `/colaboradores` → banner "N solicitudes pendientes" si totalPending > 0.
- Click → drawer derecho con tabs **Pendientes / Aceptadas / Descartadas**.
- Cada tab muestra cards compactas (`SolicitudPromoCard`) con:
  - Avatar agencia + nombre + verificado + chip de estado.
  - Sub-card con thumb + nombre + ubicación + comisión de la promo.
  - Chip "Ya colabora · N promos" / "Sin colaboración previa".
  - Fecha + avatar+nombre del usuario que envió.
  - Mensaje italic.
  - Bloque "Aceptada/Descartada · fecha · avatar+nombre del decisor"
    (solo si status !== "pendiente").
  - Botones según status:
    - `pendiente` → Ver ficha · Descartar · Aceptar
    - `aceptada` → Ver ficha (read-only)
    - `rechazada` → Ver ficha · Recuperar

### Override desde SharePromotionDialog
- Si las agencias destino tienen solicitudes rechazadas para esta
  promoción, el paso "Conditions" muestra `<RejectedSolicitudBanner>`
  arriba con icono warning amarillo y lista por agencia: nombre + "Descartada por X · fecha".
- Al confirmar la invitación, `acceptInvitationOverride()` se llama por cada agencia.
- No hay opción de "no override" — la invitación SIEMPRE prevalece.

## Storage local (mock)

Key: `byvaro.agency.collab-requests.v1`
Shape: `SolicitudColaboracion[]`
Eventos cross-tab: `byvaro:collab-requests-changed` (custom event) +
`storage` (browser standard).

## Migración a backend · checklist

Cuando se implemente backend, sustituir:

1. **Helpers de mutación** (`src/lib/solicitudesColaboracion.ts`):
   - `crearSolicitud()` → `POST /api/colaboraciones-solicitadas`
   - `aceptarSolicitud()` → `POST /:id/accept`
   - `rechazarSolicitud()` → `POST /:id/reject`
   - `restaurarSolicitud()` → `POST /:id/restore`
   - `acceptInvitationOverride()` → server-side dentro de
     `POST /api/promociones/:id/invitaciones`

2. **Hooks de lectura**:
   - `useSolicitudesPendientes(agencyId)` → React Query con
     `GET /api/me/colaboraciones-solicitadas?status=pendiente`
   - `useAllSolicitudes()` → `GET /api/colaboraciones-solicitadas`
     (con paginación cuando crezca)
   - `useAllSolicitudesPendientes()` → equivalent con filtro

3. **Backfill** (`backfillRequestedBy`):
   Eliminar · solo era una migración temporal para datos creados
   antes del campo `requestedBy`.

4. **Permisos**:
   - Cliente: `useHasPermission("collaboration.requests.manage")` ya
     está conectado a la matriz de permisos canónica.
   - Servidor: cada endpoint mutante valida el JWT y la permission flag.
     El campo `requestedBy` y `decidedBy` se rellenan automáticamente
     desde el JWT (no confiar en lo que mande el cliente).

5. **Field stripping en respuesta**:
   - Cuando la agencia consulta sus solicitudes
     (`GET /api/me/colaboraciones-solicitadas`), el backend STRIPEA
     `decidedAt` y `decidedBy` para mantener el descarte silencioso.
   - Cuando el promotor consulta, ambos campos vienen completos.

## TODO(backend) emitidos por código

Listado de los `TODO(backend)` actuales en código que deben atender la
implementación:

- `src/lib/solicitudesColaboracion.ts` · backend mapping comentado
  arriba en cada función exportada.
- `src/components/collaborators/RequestCollaborationDialog.tsx:88` ·
  `POST /api/agencias/me/colaboraciones-solicitadas` con shape
  `{ promotionId, message? }`.
- `src/pages/Colaboradores.tsx::handleAceptarSolicitud` · `POST
  /api/colaboraciones-solicitadas/:id/accept` debe ser atómico con la
  invitación.
- `src/components/promotions/SharePromotionDialog.tsx` ·
  `acceptInvitationOverride` debe vivir server-side dentro del
  endpoint de crear invitación.

## Diagrama de estados

```
                 ┌─────────────┐
                 │ pendiente   │ ◄── crearSolicitud()
                 └──────┬──────┘
                        │
        ┌───────────────┼───────────────────────────┐
        │ aceptarSolicitud()                        │
        │                                           │
        ▼                                           ▼
┌─────────────┐                            ┌─────────────┐
│ aceptada    │                            │ rechazada   │
└─────────────┘                            └──────┬──────┘
       ▲                                          │
       │ acceptInvitationOverride()              │
       │ (al enviar SharePromotionDialog)        │
       └──────────────────────────────────────────┘
                                                 │
                                                 │ restaurarSolicitud()
                                                 ▼
                                          ┌─────────────┐
                                          │ pendiente   │
                                          └─────────────┘
```

## Tests recomendados

Cuando se monte backend:

1. **Idempotencia**: dos POST seguidos para la misma (agencyId,
   promotionId) en pendiente devuelven la misma fila.
2. **Silent rejection**: agencia NO ve `decidedAt`/`decidedBy` en la
   respuesta de su `GET /me/...`.
3. **Override**: enviar invitación a (agencyId, promoId) con solicitud
   en `rechazada` flipa el status a `aceptada` y crea la invitación
   en una sola transacción · si la transacción falla, ninguna de las
   dos persiste.
4. **Permisos**: member sin `collaboration.requests.manage` recibe
   403 en `POST /:id/accept|reject|restore`.
5. **Eventos**: cada decisión emite el evento cross-empresa
   correspondiente atomicamente.
