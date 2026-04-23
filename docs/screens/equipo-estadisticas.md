# Pantalla · Dashboard del miembro (`/equipo/:id/estadisticas`)

> Dashboard completo de rendimiento de un miembro del equipo. Pensado
> para que el dueño de la agencia abra la pantalla y en <30 segundos
> sepa si el miembro produce, si tiene pipeline sano, si comunica bien
> y si su patrón de actividad está en verde.
>
> Es el destino del link "Ver estadísticas completas →" del
> `MemberFormDialog` (ver `equipo.md`) y **la fuente única de verdad**
> que alimentará el futuro análisis IA (`POST /api/ai/analyze-member/:id`).

## Propósito

- Presentar los 4 bloques canónicos de KPIs (Resultados · Pipeline ·
  Comunicación · Actividad CRM).
- Comparar contra la **media del equipo** con deltas visibles (↑34% /
  ↓12%) para que el admin sepa si un miembro está por encima/debajo.
- Detectar señales de alerta (días sin conectarse, tareas vencidas,
  visitas sin evaluar…) antes de que el admin las tenga que buscar.
- Mostrar el patrón temporal con un **heatmap día×hora** para entender
  cuándo trabaja el miembro y si hay ausencias extrañas.

## Cumple la Regla de oro de CLAUDE.md

> §📊 **KPIs en el dashboard del miembro** · "Todo dato de actividad
> del trabajador con valor para valorar desempeño debe reflejarse en
> `/equipo/:id/estadisticas`. Si una métrica no aparece allí, no
> existe para el negocio ni para la IA."

## Audiencia

| Persona | Acceso |
|---|---|
| **Admin (promotor)** | Completo · ve stats de cualquier miembro |
| **Member** | Solo sus propias stats (TODO · por ahora ve todas) |
| **Agency** | N/A (`PromotorOnly`) |

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Volver al equipo                                          │
│                                                             │
│ 📷 Arman Rahmanov          [20% capt · 40% venta] [IA]     │
│    Founder & Co-Founder · Dirección                         │
│    🇪🇸 ES  🇬🇧 EN  🇷🇺 RU                                   │
│                                                             │
│ Ventana: [7d · 30d · 90d · 1 año]                           │
├─────────────────────────────────────────────────────────────┤
│ RESULTADOS · últimos 30 días                                │
│ ┌─ 💶 Ventas €  ↑45% ─┐ ┌─ Comisión  ─┐ ┌─ Registros ↑22%┐ │
│ │ 3.85 M€             │ │ 115.5 k€   │ │ 34  (81% approv)│ │
│ │ 8 ops               │ │ generada   │ │ de 42           │ │
│ └─────────────────────┘ └────────────┘ └─────────────────┘ │
│ ┌─ Visitas  ↑38% ─────┐ ┌─ Conversión┐ ┌─ Respuesta ↓33%─┐ │
│ │ 22                  │ │ 36%        │ │ 18 min          │ │
│ │ 5 próx 7d           │ │ v→v        │ │ a lead          │ │
│ └─────────────────────┘ └────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ FUNNEL DE CONVERSIÓN       Lead → Venta · 44%               │
│  Leads asignados         ████████░░░░░░░░░░░  18            │
│  Registros creados       ████████████████░░░  42            │
│  Registros aprobados     ██████████░░░░░░░░░  34            │
│  Visitas realizadas      █████░░░░░░░░░░░░░░  22            │
│  Ventas cerradas         ██░░░░░░░░░░░░░░░░░  8             │
├─────────────────────────────────────────────────────────────┤
│ COMUNICACIÓN        │      SEÑALES A REVISAR                │
│ 📧 142 (68% open)   │      ✓ Racha activa 22 días           │
│ 💬 89 WhatsApp      │                                       │
│ 📞 34 llamadas      │                                       │
│ ⏱ 18 min respuesta  │                                       │
├─────────────────────────────────────────────────────────────┤
│ PATRÓN · día × hora     Hora pico · 11:00                   │
│      00 03 06 09 12 15 18 21                                │
│ L    ░░░░░░░░░▓▓▓▓░░▓▓▓░░                                   │
│ M    ░░░░░░░░░▓▓▓▓░░▓▓▓░░                                   │
│ X    ...                                                    │
│                       Menos ░ ▒ ▓ █ Más                    │
└─────────────────────────────────────────────────────────────┘
```

## Componentes internos

- **Header** · foto (avatar SVG o iniciales), nombre + cargo +
  departamento, chips de idiomas con bandera, pill de comisiones (si
  las hay), botón "Análisis IA" (placeholder por ahora).
- **Filtro temporal** · `<ViewToggle>` con 7d / 30d / 90d / año. Cambia
  la ventana y re-query stats (mock: no hay endpoint real).
- **HeroKpis** · grid responsive (2→3→6 cols) de 6 tiles con delta vs
  equipo. Para `avgLeadResponseMin` el delta se invierte (menos
  tiempo = mejor).
- **Funnel** · 5 etapas visualizadas con barras proporcionales al máx.
  Título muestra conversión global lead→venta.
- **CommunicationPanel** · 4 stats (emails + % apertura, WhatsApp,
  llamadas, respuesta media).
- **AlertsPanel** · semáforo. Reglas:
  - `red` · ≥3 días sin login.
  - `amber` · ≥5 tareas vencidas, ≥3 visitas sin evaluar, ≥2
    duplicados creados, respuesta a lead >1h.
  - `green` · racha activa ≥15 días, o "sin señales" si no hay
    ninguna alerta roja/amber.
- **Heatmap** · grid 7 filas (días L-D) × 24 cols (horas) con intensidad
  HSL variable sobre `hsl(var(--primary))`. `overflow-x-auto` para
  que scrollee horizontal en móvil. Tooltip con valor por celda.
- **EmptyStats** · estado placeholder para miembros sin actividad
  (recién invitados).

## Mapa de datos → UI

| Panel | Campo de `MemberStats` |
|---|---|
| Hero · Ventas € | `salesValue` + `salesCount` |
| Hero · Comisión | `commissionValue` |
| Hero · Registros aprobados | `recordsApproved` + `recordsTotal` |
| Hero · Visitas realizadas | `visitsDone` + `visitsUpcoming` |
| Hero · Conversión | `conversionRate` |
| Hero · Respuesta a lead | `avgLeadResponseMin` |
| Funnel | `assignedLeads`, `recordsTotal`, `recordsApproved`, `visitsDone`, `salesCount` |
| Comunicación | `emailsSent`, `emailsOpenRate`, `whatsappSent`, `callsLogged`, `avgLeadResponseMin` |
| Alertas | `daysWithoutLogin`, `overduePendingTasks`, `visitsUnevaluated`, `duplicatesCreated`, `activeStreakDays` |
| Heatmap | `hourlyHeatmap` (168 celdas) + `peakHour` |

## Endpoints esperados

```http
GET /api/members/:id/stats?window=7d|30d|90d|year
  → MemberStats   (ver docs/data-model.md §MemberStats)
  200 · shape exacto del mock en src/data/memberStats.ts

GET /api/members/:id/stats/averages?window=30d
  → Partial<MemberStats>   (agregado del equipo para benchmarks)

POST /api/ai/analyze-member/:id?window=30d   [futuro]
  → AIMemberReport   (ver docs/plan-equipo-estadisticas.md §3)
```

## Ventana temporal

Default `"30d"`. Al cambiar, **todo el dashboard** se re-renderiza
(hero, funnel, alertas, heatmap). No hay loading state visible por ahora
(mock síncrono) — cuando se conecte backend, añadir skeleton.

## Regla de negocio · benchmark

`HeroKpis` compara cada tile contra la media del equipo (excepto
`Comisión` que es informativa). El delta se calcula como:

```ts
const delta = (value - avg) / avg;
```

- Delta positivo → verde con ↑.
- Delta negativo → rojo con ↓.
- `|delta| < 2%` se considera sin variación y no se muestra.

Para `avgLeadResponseMin` se invierte porque tiempos bajos son mejores.

## Comisiones del miembro

Si `member.commissionCapturePct` o `member.commissionSalePct` están
definidos, se muestran en un pill del header. El pill solo aparece
si al menos uno de los dos tiene valor.

Formato: `20% capt · 40% venta`. Valores undefined se omiten.

## Responsive

- Mobile (375-640px): hero KPIs en 2 cols, funnel con labels
  truncados (110px), heatmap scrollea horizontal.
- Tablet (640-1024px): hero 3 cols.
- Desktop (≥1024px): hero 6 cols, Communication+Alerts en 2+1 layout.

## Dependencias de datos

| Dato | Fuente |
|---|---|
| Miembro | `TEAM_MEMBERS` + localStorage `byvaro.organization.members.v4` |
| Stats | `getMemberStats(id, window)` · `src/data/memberStats.ts` |
| Medias del equipo | `getTeamAverages(window)` |

## Componente

- `src/pages/EquipoMiembroEstadisticas.tsx` — 500 líneas, todos los
  subcomponentes en el mismo archivo (HeroKpis, HeroTile, Funnel,
  CommunicationPanel, CommStat, AlertsPanel, Heatmap, EmptyStats).

## TODOs

- `TODO(backend)`: GET `/api/members/:id/stats` con query `window`.
- `TODO(ai)`: enganchar `POST /api/ai/analyze-member/:id` al botón
  "Análisis IA" · modal con `AIMemberReport`.
- `TODO(ui)`: skeleton state cuando haya loading real del endpoint.
- `TODO(privacy)`: si el miembro logueado no es admin, solo ver sus
  propias stats.

## Historial

- **2026-04-23** · Primera implementación completa con mocks.
  - 6 KPIs hero con benchmarks, funnel de 5 etapas, panel de
    comunicación, alertas semáforo, heatmap 168 celdas, ventanas
    temporales, comisiones en header. Ver ADR-049.
