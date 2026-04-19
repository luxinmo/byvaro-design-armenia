# Pantalla · Inicio (`/inicio`)

## Propósito

Primera pantalla al hacer login. Dashboard ejecutivo del promotor con la
foto del día: KPIs cruzados, actividad reciente, accesos rápidos. Permite
detectar oportunidades o problemas sin navegar a las páginas específicas.

**Audiencia**: Promotor (dueño). La Vista Agencia tendrá una versión
simplificada (pendiente).

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ Saludo + fecha │ Toggle período (Semana/Mes/Trimestre)  │
├──────┬──────┬──────┬──────┐                            │
│ KPI1 │ KPI2 │ KPI3 │ KPI4 │  (sparklines + delta %)    │
├──────┴──────┴──────┴──────┴───────────────────────────┤
│ ✦ Insights IA banner (gradiente primario)              │
├───────────────────────────┬──────────────────────────┤
│ Actividad reciente (2/3)  │ Hoy · agenda (1/3)       │
│ — venta cerrada           │ — 11:00 visita          │
│ — registro pendiente      │ — 12:30 llamada         │
│ — visita confirmada       │ — 16:00 visita          │
│ — solicitud colaboración  │                          │
│                           │ Top colaboradores        │
│ Promociones activas       │ — 1 Engel & Völkers      │
│ — 4 rows con mini KPIs    │ — 2 Nordic Home F.       │
│                           │                          │
│                           │ Acciones rápidas (2×2)   │
└───────────────────────────┴──────────────────────────┘
```

## Componentes en `src/pages/Inicio.tsx`

- `Kpi` — card con icono coloreado + sparkline SVG + label + valor grande +
  delta trend + subtítulo
- `Sparkline` — mini gráfico de tendencia, puro SVG, sin librería
- `ActivityItem` — fila de actividad con icono semántico + texto + meta
- `PromoRow` — resumen compacto de una promoción con 4 KPIs inline
- `AgendaItem` — evento del día con hora + título + detalle
- `CollabRow` — row de colaborador con medalla + avatar + cifra
- `QuickAction` — botón de acción rápida 2×2 grid

## KPIs mostrados

| Tarjeta | Label | Valor | Delta | Sub |
|---|---|---|---|---|
| 1 | Registros | `142` | `+18%` ↗ | `8 pendientes de decisión` |
| 2 | Ventas · volumen | `€3,2M` | `+24%` ↗ | `9 operaciones · ticket medio €355K` |
| 3 | Visitas programadas | `38` | `esta semana` | `12 hoy · 3 sin confirmar` |
| 4 | Colaboradores activos | `17` | `+2 nuevos` | `2 solicitudes pendientes` |

Colores de icono: primary (azul), emerald, violet, amber.

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Click en KPI | Navega a la sección correspondiente (`/registros`, `/ventas`, etc.) |
| Click en banner insights | Abre página `/colaboradores/analitica` con filtros pre-aplicados |
| Click en actividad | Navega al detalle del item (registro, venta, visita, solicitud) |
| Click en "Revisar" / "Aprobar" / "Rechazar" | Acción inline sin salir de `/inicio` |
| Click en promoción activa | Navega a `/promociones/:id` |
| Click en "Agenda" | Navega a `/calendario` con la fecha de hoy |
| Click en item de agenda | Abre detalle de la visita/evento en modal |
| Click en "Top colaboradores" → colab | Navega a `/colaboradores/:id` |
| Click en acción rápida | Lanza el flujo correspondiente (ej. `/crear-promocion`) |
| Toggle período | Refetch KPIs con el rango (semana/mes/trimestre) |

## Validaciones

No hay formulario — es una vista de lectura. Sin validaciones específicas.

## API endpoints esperados

```
GET /api/v1/dashboard/summary?period=week|month|quarter
→ {
    kpis: {
      registros: { value: 142, delta: 18, trend: [22, 26, 24, 30, 28, 36, 42], sub: "..." },
      ventas: { value: 3200000, delta: 24, trend: [1.0, 1.4, ...], sub: "..." },
      visitas: { value: 38, sub: "..." },
      colaboradores: { value: 17, delta: 2, sub: "..." },
    },
    insights: [
      { type: "opportunity", title: "...", description: "...", ctaPath: "..." },
      ...
    ],
    activity: [RecentActivityItem, ...],     // últimos 10
    promotionsActive: [PromoSummary, ...],   // top 4 por actividad
    today: [AgendaItem, ...],                // eventos de hoy
    topCollaborators: [Collab, ...],         // top 3 por ventas del período
  }
```

Refetch periodicity: cada 60s si el usuario mantiene la pestaña abierta
(polling) o vía websocket si hay Supabase Realtime.

## Permisos

| Elemento | Promotor | Agencia |
|---|---|---|
| KPIs globales | ✅ | ❌ (ve KPIs propios) |
| Banner IA | ✅ | ❌ (no insights de la red completa) |
| Actividad reciente | ✅ toda la empresa | ✅ solo propia |
| Promociones activas | ✅ todas | ✅ solo colaboradoras |
| Agenda del día | ✅ asignadas a cualquiera | ✅ solo asignadas a él |
| Top colaboradores | ✅ | ❌ |
| Acciones rápidas | ✅ todas | ✅ subset (sin "Nueva promoción") |

## Estados

- **Loading** — Skeleton con pulse en cada sección (no hay spinner central)
- **Empty** — Si es una empresa recién creada, mostrar onboarding inline con
  "Crea tu primera promoción" CTA
- **Error** — Banner rojo arriba "No se pudieron cargar los datos · Reintentar"
- **Partial** — Si un widget falla pero otros cargan, se muestra estado de
  error solo en ese widget

## Enlaces salientes

| Desde | Hacia |
|---|---|
| KPI Registros | `/registros` |
| KPI Ventas | `/ventas` |
| KPI Visitas | `/calendario` |
| KPI Colaboradores | `/colaboradores` |
| Banner IA | `/colaboradores/analitica?period=week` |
| Actividad · Venta | `/ventas/:id` |
| Actividad · Registro | `/registros/:id` |
| Actividad · Visita | `/calendario?visitId=xxx` |
| Actividad · Solicitud colab | `/colaboradores/:id?request=true` |
| Promoción activa | `/promociones/:id` |
| Agenda · Ver todo | `/calendario` |
| Top colab | `/colaboradores/:id` |
| Quick Action "Nueva" | `/crear-promocion` |
| Quick Action "Registrar" | `/registros?new=true` |
| Quick Action "Programar" | `/calendario?new=true` |
| Quick Action "Campaña" | `/emails?new=true` |

## Responsive

- **Móvil (< 640px)**: KPIs grid 2×2, columna derecha (Hoy + Top + Quick) se
  apila bajo la columna izquierda
- **Tablet (sm-lg)**: KPIs en fila de 4 estrechas, layout 2 columnas
- **Desktop (lg+)**: Layout 3 columnas (main 2/3 + side 1/3)

## Notas de implementación

- El refetch del período (toggle Semana/Mes/Trimestre) debe ser instant:
  prefetch de los 3 períodos al cargar la página
- Los sparklines usan los últimos 7 puntos (día si semana, semana si mes,
  mes si trimestre)
- La actividad reciente debe tener paginación infinita si supera 20 items
- Los insights IA se generan server-side (puede ser un cron diario o
  on-demand)

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoint `/dashboard/summary` con el JSON de arriba
- [ ] `TODO(backend)`: generación de insights IA (modelo a decidir — GPT-4o
      con prompt que recibe agregados de la última semana)
- [ ] `TODO(ui)`: skeletons por widget
- [ ] `TODO(ui)`: refetch automático en foco (window focus event)
- [ ] `TODO(realtime)`: suscripción a `registrations` para actualizar el KPI
      de Registros en tiempo real
