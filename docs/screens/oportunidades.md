# oportunidades.md · pipeline comercial activo

> Ruta: `/oportunidades` (listado) + `/oportunidades/:id` (ficha detalle).
> Rol: solo Promotor. Agencias tienen la ruta oculta en sidebar.

## Propósito

Pantalla de **pipeline comercial**: agrupa todos los clientes
cualificados (oportunidades) que el equipo está trabajando activamente.
Cada oportunidad tiene un cliente (contacto), un interés estructurado,
cero o más registros asociados y un estado dentro del embudo.

La diferencia con **Leads** y con **Registros** es clara:

| Entidad | Qué es | Pantalla |
|---|---|---|
| **Lead** | Entrada cruda de un potencial comprador · sin cualificar | `/leads` |
| **Oportunidad** | Cliente cualificado en pipeline comercial | `/oportunidades` |
| **Registro** | Alta del cliente ante el promotor vía agencia | `/registros` |

Una oportunidad puede tener **0..N registros** (un mismo cliente se
puede registrar en varias promociones). Los registros viven dentro de
la oportunidad como bloque colapsable.

## Layout

Mismo patrón que `/leads`: KPIs + toolbar + tabla. No se introduce un
nuevo idioma visual.

```
┌─────────────────────────────────────────────────────────────────┐
│  Comercial                                                      │
│  Oportunidades                                                  │
│  Pipeline de clientes comercialmente activos…                   │
├─────────────────────────────────────────────────────────────────┤
│  [Activas][Visita][Negociación][Ganadas][Registro pendiente]    │  ← KPIs
├─────────────────────────────────────────────────────────────────┤
│  🔍 Buscar…   [Segmented: Activas·Interés·Visita…]  [Más filtros]│
│  Panel "Más filtros" (colapsable): Responsable · Promoción ·     │
│     Con registro pendiente · Sin actividad +14 días              │
├─────────────────────────────────────────────────────────────────┤
│  Cliente | Interés | Promoción | Etapa | Temp | Resp. | Actividad│
│  …                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### KPIs (5)

| Chip | Cuenta |
|---|---|
| Activas | `stage !== "ganada" && stage !== "perdida"` |
| Visita | `stage === "visita"` |
| Negociación | `stage === "negociacion"` |
| Ganadas | `stage === "ganada"` |
| Registro pendiente | `hasPendingRegistration(o)` |

### Fila de la tabla

Cada fila muestra **exactamente** lo que pide el spec:

- Avatar + nombre + bandera ISO del país (vía `<Flag iso>`) +
  badge `REG` si tiene registro pendiente.
- **Interés resumen**: tipo de propiedad · dormitorios · rango presupuesto.
- **Promoción origen** (si el interés tiene `originPromotionName`).
- **Etapa** (badge con color semántico).
- **Temperatura** (caliente 🔥 · tibio · frío ❄️).
- **Responsable** (avatar mini + nombre vía `findTeamMember()`).
- **Última actividad** (`relativeTime(lastActivityAt)`).
- Kebab con 6 acciones (email / comentar / abrir / reasignar /
  mover etapa / archivar).

**Regla UI**: acciones primarias quedan en la cabecera de la ficha,
no en la fila del listado. La fila es para escanear.

## Filtros

### Compactos arriba (siempre visibles)

- Segmented por etapa: `Activas · Interés · Visita · Evaluación ·
  Negociación · Ganadas · Todas`.
- Buscador (nombre · zona · promoción).

### "Más filtros" (panel colapsable)

- **Responsable** (dropdown con miembros que tengan oportunidades).
- **Promoción origen**.
- **Con registro pendiente** (toggle).
- **Sin actividad hace +14 días** (toggle).

**Pendientes backend** (no UI hoy, solo listados en el panel como
`TODO(backend)`):
- Nacionalidad, rango de presupuesto, con visita, con email abierto,
  con email rebotado, tipo de propiedad, zona.

## Badges

Los badges `Nuevo`, `Contactado`, `Convertido`, `Email rebotado`… del
spec viven en la ficha como eventos de timeline, no como columna de la
lista. La lista muestra **etapa + temperatura + REG pendiente** · con
eso es suficiente para escanear.

## Estados a diseñar (cubiertos en el mock)

| Estado | En el seed |
|---|---|
| Con registro pendiente | `opp-1` (Ahmed · Villa Serena) |
| Con registro aceptado | `opp-3` (Lars) |
| Sin registros | `opp-2`, `opp-4`, `opp-6`, `opp-7` |
| En visita | `opp-2` |
| En negociación | `opp-1` |
| En evaluación | `opp-3` |
| Ganada | `opp-5` |
| Perdida | `opp-7` (con `lostReason`) |
| Oportunidad caliente | `opp-1`, `opp-3`, `opp-5` |
| Oportunidad fría | `opp-4`, `opp-7` |
| Con matching IA | `opp-1`, `opp-2`, `opp-6` |
| Sin matching | `opp-3`, `opp-4`, `opp-5`, `opp-7` |
| Sin actividad reciente | `opp-4` (14 días) |
| Recién convertida desde lead | `opp-6` |

## Ficha detalle · `/oportunidades/:id`

Ver `docs/screens/oportunidad-detalle.md`.

## Vista de agencia

Las oportunidades son **internas del promotor** (pipeline comercial
propio). Las agencias no ven esta pantalla — la ruta está en
`agencyHiddenRoutes` de `AppSidebar.tsx`. Si una agencia entra
manualmente a `/oportunidades`, ve la página pero los datos se filtran
a `[]` en backend (regla de visibilidad).

## TODOs al conectar backend

Endpoints canónicos en `docs/backend-integration.md §7.3`:

```
GET    /api/opportunities                  (filtros como query params)
GET    /api/opportunities/:id
POST   /api/opportunities
PATCH  /api/opportunities/:id
DELETE /api/opportunities/:id              (archive)

POST   /api/opportunities/:id/stage        { stage }
POST   /api/opportunities/:id/comments     { body }
POST   /api/opportunities/:id/emails       { … }
POST   /api/opportunities/:id/visits
GET    /api/opportunities/:id/matches
POST   /api/opportunities/:id/registrations    (alta vía agencia)
PATCH  /api/opportunities/:id/registrations/:rid  { status }

POST   /api/leads/:id/convert-to-opportunity
```

Regla de oro: cada mutación emite evento en el `timeline` de la
oportunidad **y** en el `history` del contacto (§🥇 en `CLAUDE.md`).
