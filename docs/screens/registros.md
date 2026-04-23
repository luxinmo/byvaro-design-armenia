# Pantalla · Registros (`/registros`)

> Bandeja de entrada de leads (registros) enviados por agencias colaboradoras.
> Es una de las dos piezas que constituyen el **40 % del valor del producto**
> (ver `docs/product.md` · IA de duplicados). El promotor aprueba o rechaza
> cada registro; la IA le ayuda a detectar duplicados contra contactos
> propios o registros previos de otras agencias a la misma promoción.

## Propósito

- Centralizar todos los registros entrantes (pendientes, aprobados,
  rechazados, duplicados) en una única vista.
- Permitir revisión individual lado-a-lado con el posible duplicado.
- Permitir acciones en lote (aprobar / rechazar masivo).
- Respetar RGPD: el consentimiento del cliente es visible por registro.

## Audiencia

| Persona | Vista | Puede |
|---|---|---|
| **Promotor** | Completa | Ver todos, aprobar, rechazar, ver duplicados |
| **Agencia invitada** | Read-only, solo sus propios registros | No decide; ver estado y fechas |
| **Agencia marketplace / sin plan** | N/A (no accede a la ruta) | — |

> La lógica dual-mode se implementará con la prop `agencyMode` (patrón
> `docs/architecture.md` §Dual-mode). Ahora mismo el mock pinta la vista
> Promotor. `TODO(ui-agency): vista read-only con filtro automático por
> agencyId logueada y sin botones de decisión.`

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Comercial (eyebrow)                                          │
│ Registros   7 pendientes                   │ Buscador │      │
├──────────────────────────────────────────────────────────────┤
│ Todos · Pendientes · Aprobados · Rechazados · Duplicados │   │
│ [Promoción ▼] [Agencia ▼]  [☐ Solo duplicados]  · 18 result. │
├──────────────────────┬───────────────────────────────────────┤
│ ☐ [EM] Émilie R.     │ [EM] Émilie Rousseau          Pendie. │
│     Altea Hills · PP │ Enviado hace 14 min                   │
│     hace 14 min   ✅ │                                       │
│                      │ Coincidencia baja · 0 %               │
│ ☐ [LB] Lars B.   ⚠78 │                                       │
│     Marina · Nordic  │ Cliente         Promoción objetivo    │
│     hace 1 h     ⏳  │ ───────────     ────────────────      │
│                      │ Nombre          Altea Hills           │
│ ...                  │ Email           Agencia origen        │
│                      │ Teléfono        ────────────────      │
│                      │ DNI             Prime Properties      │
│                      │ Nacionalidad    Consent RGPD ✔        │
│                      │                                       │
│                      │ [Comparación lado-a-lado si match]    │
│                      │                                       │
│                      │  Ver cliente existente · Rechazar · A │
└──────────────────────┴───────────────────────────────────────┘
                       ┌───────────────────────────┐
  (selección múltiple) │ 3 seleccionados · Aprob. · Rechaz · ✕ │
                       └───────────────────────────┘
```

### Responsive (<1024 px)

- **Móvil / tablet**: la lista ocupa la pantalla completa. Al tocar un
  registro, el detalle reemplaza la lista (vista modal-like con botón
  "Volver").
- La barra flotante de selección múltiple sube a `bottom-[72px]` para no
  colisionar con el `MobileBottomNav`.

## Dependencias de datos

| Dato | Fuente |
|---|---|
| Registros mock | `src/data/records.ts` → `registros: Registro[]` |
| Tipo del registro | `src/data/records.ts` → `Registro` |
| Promoción asociada | `src/data/promotions.ts` (`promotionId` FK) |
| Agencia origen | `src/data/agencies.ts` (`agencyId` FK) |
| Fecha relativa | `date-fns/formatDistanceToNow` + locale `es` |

Helpers exportados por `records.ts`:
- `getMatchLevel(pct)` — `none | low | medium | high`.
- `estadoLabel` — mapa `RegistroEstado → "Pendiente" | "Aprobado" | …`.

## Componentes en `src/pages/Registros.tsx`

- `Registros` (default export) — página principal.
- `RegistroDetail` — panel derecho de detalle.
- `DetailRow` — fila label/valor con icono y resaltado.
- `CompareCard` — una de las dos tarjetas de comparación lado-a-lado;
  resalta en ámbar los campos que coinciden con la contraparte.
- `MultiSelectPill` — filtro pill que cambia a fondo negro cuando tiene
  selección (patrón idéntico al de `Promociones.tsx`).
- `EmptyState` — estado vacío.

## Filtros

Todos combinables. Se aplican en cascada.

| Filtro | Tipo | Valores |
|---|---|---|
| Búsqueda texto | input | Nombre, email, teléfono, DNI, nacionalidad, promoción, agencia |
| Estado | tabs single-select | `todos`, `pendiente`, `aprobado`, `rechazado`, `duplicado` |
| Promoción | multi-select pill | Todas las promociones del promotor |
| **Origen** | multi-select pill | `direct` (registro propio del promotor) / `collaborator` (enviado por agencia) — ver ADR-046 |
| Agencia | multi-select pill | Todas las agencias conocidas · **excluye los directos** automáticamente cuando hay selección |
| Solo duplicados | switch | Solo registros con `matchPercentage >= 30` |

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Click item en lista | Selecciona el registro → detalle a la derecha |
| Click checkbox de un item | Entra en modo selección múltiple |
| Click **Aprobar** en detalle | `POST /api/records/:id/approve`; toast success; estado ← `aprobado` |
| Click **Rechazar** en detalle | `POST /api/records/:id/reject`; toast error; estado ← `rechazado` |
| Click **Ver cliente existente** | Abre ficha del contacto duplicado (TODO: navegación a `/contactos/:id`) |
| Barra flotante · **Aprobar todos** | `POST /api/records/bulk-approve { ids }` |
| Barra flotante · **Rechazar todos** | `POST /api/records/bulk-reject { ids }` |
| Switch Solo duplicados | Filtra `matchPercentage >= 30` |

## Reglas del detector de duplicados (UI)

Visual semántico homogéneo con `docs/data-model.md §Detector`:

| Rango `matchPercentage` | Nivel | Color | Badge UI | Recomendación |
|---|---|---|---|---|
| `= 0` | `none` | gris | ninguno | — |
| `1-29` | `low` | esmeralda | `0-30 %` | aprobación fluida |
| `30-69` | `medium` | ámbar | `30-70 %` | revisar comparación |
| `>= 70` | `high` | destructive | `≥70 %` | rechazar (warning en detalle) |

El componente `CompareCard` resalta en ámbar los campos **iguales** entre
registro entrante y candidato duplicado. La ponderación de campos (40 %
teléfono, 30 % nombre, 20 % email, 10 % nacionalidad) vive del lado
backend y no se recalcula en el cliente.

## Origen del registro (ADR-046)

Todo `Registro` tiene un campo `origen: "direct" | "collaborator"` que
decide el flujo, la visibilidad de datos y la presentación:

| Aspecto | `collaborator` | `direct` |
|---|---|---|
| Quién lo crea | Agencia colaboradora | El propio promotor desde su CRM |
| `agencyId` | Obligatorio | Undefined |
| Campos del cliente | Solo 3 canónicos (nombre, nacionalidad, últimos 4 del teléfono) | Perfil completo (email, tel, DNI, etc.) |
| Flujo de aprobación | `pendiente` → promotor decide | Puede arrancar directamente en `aprobado` |
| IA de duplicados | Siempre corre | Siempre corre |

**UI:**

- **List card**: badge `Directo` (verde, icono `UserCheck`) vs `Colab.`
  (gris, icono `Handshake`). Si es directo no se pinta el nombre de
  agencia (no hay).
- **Detalle · bloque "Origen"**: tarjeta distinta según `origen`.
  Directo → card verde "Registro directo · captado por el promotor".
  Colaborador → card con nombre + localización de la agencia.
- **CompareCard** del lado-a-lado muestra "Registro directo · promotor"
  en lugar del nombre de agencia cuando aplica.
- **ActivityTimeline**: el primer evento (`submitted`) cambia a
  "Registro creado por el promotor" con `actor = Promotor` en directos.

## Grace period de decisión

Al aprobar o rechazar se marca `decidedAt` (ISO). Durante los 5 min
siguientes se muestra el `GracePeriodBanner` con countdown MM:SS y un
botón "Revertir" que devuelve el registro a `pendiente`. Una vez
expirado el banner desaparece y la notificación a la agencia se envía.

- `POST /api/records/:id/approve|reject` programa la notificación con
  delay 5 min.
- `POST /api/records/:id/revert` cancela el job si llega antes del
  disparo.

## Endpoints esperados (contract-first)

```http
# Lista
GET /api/records?status=&promotion=&agency=&origen=&onlyDuplicates=&q=
  → Registro[]

# Detalle (si se quiere fetch lazy al abrir)
GET /api/records/:id
  → Registro

# Alta (desde ClientRegistrationDialog)
POST /api/records
  body: {
    origen: "direct" | "collaborator",
    promotionId, agencyId?, cliente, tipo?, visitDate?, visitTime?
  }

# Decisiones individuales
POST /api/records/:id/approve
POST /api/records/:id/reject   body: { reason?: string }
POST /api/records/:id/revert   // solo dentro del grace period

# Decisiones en lote
POST /api/records/bulk-approve  body: { ids: string[] }
POST /api/records/bulk-reject   body: { ids: string[], reason?: string }

# Relación (para "Ver cliente existente")
GET /api/contacts/:id
```

Todas las respuestas deben incluir `matchPercentage` y `matchWith` pre-
calculados por el servicio de IA (ver `docs/open-questions.md#Q1`).

## TODOs

- `TODO(backend)`: conectar endpoints listados arriba.
- `TODO(ui)`: modo lectura para la vista Agencia (`agencyMode=true`).
- `TODO(ui)`: navegar a `/contactos/:id` desde "Ver cliente existente"
  cuando exista la pantalla.
- `TODO(logic)`: mostrar timeline del registro (submitted → auto-check IA
  → decisión) — queda pendiente para v2 de la pantalla.
- `TODO(logic)`: modal de decisión con nota opcional (hoy la decisión es
  inmediata; `docs/data-model.md` contempla `decisionNote`).
- `TODO(analytics)`: track events `record_approved`, `record_rejected`,
  `bulk_decision`.

## Historial

- **2026-04-20** · Primera implementación funcional con mocks. Reemplaza
  el `PlaceholderPage` original. Componentes, filtros, selección múltiple,
  comparación lado-a-lado y toasts listos.
- **2026-04-23** · Añadido `origen` (direct / collaborator) en el modelo
  + badge en la lista + filtro pill + card en el detalle. `agencyId`
  pasa a ser opcional. Añadido `GracePeriodBanner` de 5 min sobre
  `decidedAt` y `ActivityTimeline` en el detalle (colapsado en v2).
  Ver ADR-046.
