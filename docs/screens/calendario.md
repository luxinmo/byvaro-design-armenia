# calendario.md · agenda unificada del equipo

> Ruta: `/calendario`.
> Archivo principal: `src/pages/Calendario.tsx`.
> Dialog: `src/components/calendar/CreateCalendarEventDialog.tsx`.
> Modelo: `src/data/calendarEvents.ts` · Store: `src/lib/calendarStorage.ts` · Helpers: `src/lib/calendarHelpers.ts`.
> Decisión: ADR-056 · entidad única, conflicto duro, multi-calendario.

## Propósito

Una sola pantalla donde conviven **todos los tipos** de evento del
equipo: visitas, llamadas, reuniones, bloqueos y recordatorios. Cada
evento pertenece a un único agente (no multi-assignee) y el
multi-calendario de la sidebar deja encender/apagar el carril de
cada miembro independientemente.

## Modelo

`CalendarEvent` es una **union discriminada** por `type`:

```ts
type CalendarEventType = "visit" | "call" | "meeting" | "block" | "reminder";

type CalendarEventStatus =
  | "pending-confirmation"  // p. ej. visita desde registro, sin confirmar
  | "confirmed"
  | "done"
  | "cancelled"
  | "noshow";
```

Campos comunes: `id · title · start · end · assigneeUserId ·
status · contactId? · leadId? · registroId? · location? · notes? ·
reminder? · createdAt · source?`.

Extensiones por tipo:
- **visit** · `promotionId? · unitId? · unitLabel? · evaluation?`
- **call** · `phone?`
- **meeting** · `teamAttendees?`
- **block** · `blockReason?`
- **reminder** · sin campos extra

## Vistas

| Vista | Uso | Detalle |
|---|---|---|
| **Semana** (default desktop) | Vista principal del comercial | 8 cols (franja horaria + 7 días) · resolución 1h · rango 8-20h · click en slot vacío = crear |
| **Mes** (default mobile) | Planificación | Grid 7×6 · máx 3 eventos + "+N más" en desktop · dots por tipo en mobile |
| **Día** | Detalle de un día | Resolución 30 min · eventos con título, contacto, ubicación |
| **Agenda** | Lista cronológica | Agrupada por día con "Hoy"/"Mañana" · click en evento de oportunidad navega a `/oportunidades/:id` |

## Layout desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│ Comercial                                    [+ Crear evento]       │
│ Calendario                                                          │
│ Agenda del equipo · conecta tu Google Calendar.                     │
├─────────────────────────────────────────────────────────────────────┤
│ [Hoy][‹][›]  abril 2026     [Semana·Mes·Día·Agenda] [Filtros (N)] │
│ Panel Filtros colapsable (tipo · estado)                            │
├────────────────────┬────────────────────────────────────────────────┤
│ MIS CALENDARIOS    │  Vista activa                                  │
│  □ u1 Arman (●)    │                                                │
│  ☑ u2 Laura (●)    │                                                │
│  ☑ u3 Pedro (●)    │                                                │
│  ☑ u4 Ana (●)      │                                                │
│  [Conectar Google] │                                                │
│                    │                                                │
│  TIPOS (leyenda)   │                                                │
│  ● Visita          │                                                │
│  ● Llamada         │                                                │
│  ...               │                                                │
└────────────────────┴────────────────────────────────────────────────┘
```

## Layout mobile (Apple Calendar-like)

- Sidebar de calendarios → escondido (`hidden lg:block`).
- Segmented sólo con **Mes · Agenda** (Semana/Día son densas, no leen bien en 375px).
- En **Mes** mobile cada día = número + dots de color por tipo (máx 4) · al tap se marca y aparece la lista cronológica del día justo debajo.
- **FAB** flotante abajo-derecha (56×56 · `bg-foreground`) para crear evento.

## Multi-calendario

- La sidebar muestra un row por miembro **activo** del equipo
  (`getAllTeamMembers()` filtrado por `status !== "deactive"`).
- Un checkbox coloreado (square del color del miembro · ver
  `getMemberCalendarColor(userId)`) enciende/apaga su carril.
- Todos encendidos por defecto · admin puede ver todos.
- En el futuro un permiso `calendar.viewAll` puede limitar qué
  agentes ve cada miembro (hoy admin ve todo · member ve todo).

## Crear / editar evento

Dialog: `CreateCalendarEventDialog`. Se abre:
- Click en **+ Crear evento** (header desktop o FAB mobile).
- Click en slot vacío de la vista Semana/Día → pre-fill con fecha y hora.
- Click en evento existente → modo edición.
- CTA **"Programar visita"** en la ficha de oportunidad → pre-fill con
  `type="visit" · leadId · promotionId`.

Campos:
1. **Tipo** · segmented 5 opciones (Visita/Llamada/Reunión/Bloqueo/Recordatorio) con icono + color.
2. **Título** · obligatorio.
3. **Fecha · Hora · Duración** · presets 30/45/60/90/120 min. Default 60.
4. **Responsable** · `<UserSelect onlyActive>` · único.
5. **Cliente · ubicación** · libre (ubicación cambia a "Número" si type=call).
6. **Notas** · textarea.
7. **Recordatorio · Estado**.
8. **Preview** al final con `formatTimeRange`.

### Detección de conflicto (dura · ADR-056)

Cada cambio de fecha/hora/agente/duración llama a `findConflict()`.
Si el agente ya tiene un evento del mismo intervalo (excluyendo
`cancelled` y `noshow`), se pinta un **banner rojo** con el evento
en conflicto y un CTA "Ir al evento en conflicto" que navega a
`/oportunidades/:leadId` o al calendario. El botón **Guardar** queda
deshabilitado hasta resolver el conflicto.

## Integraciones cross-pantalla

- **Ficha de oportunidad** (`/oportunidades/:id`): CTA "Programar
  visita" en el header abre el dialog con lead + promoción prefilleados.
- **Inicio** (`/inicio`): widget "Hoy" alimentado por
  `useCalendarEvents()` + `eventsInDay(today)` · muestra hasta 5
  eventos ordenados por hora · línea "AHORA" para el evento en curso
  · click abre la oportunidad o el calendario.
- **Ajustes → Calendario → Sincronizar** (`/ajustes/calendario/sync`):
  CRUD visual de conexiones Google Calendar por miembro (mock en
  localStorage · ver §Backend).

## Colores

Cada **tipo** y cada **agente** tienen colores asignados:

- Tipos · `eventTypeConfig[type]` en `calendarEvents.ts`
  (visit=primary · call=sky · meeting=indigo · block=muted · reminder=warning).
- Agentes · `getMemberCalendarColor(userId)` en
  `calendarEvents.ts` · paleta de 8 colores + hash fallback.

## Estados a diseñar (cubiertos en mock)

| Estado | Evento del seed |
|---|---|
| Visita confirmada hoy | `ev-1` Villa Serena · Ahmed |
| Visita pendiente de confirmación | `ev-7` · viene del registro de Klaus |
| Llamada corta | `ev-2` |
| Bloqueo de tiempo | `ev-3` (almuerzo) · `ev-23` (vacaciones día completo) |
| Reunión | `ev-6` (reunión semanal) · `ev-21` (firma reserva) |
| Recordatorio puntual | `ev-9` (enviar dossier) |
| Visita done · pendiente de evaluar | `ev-16` (ayer · Klaus) |
| Visita cancelada | `ev-18` |
| Visita noshow | `ev-19` |

## Permisos

- `calendar.viewOwn` · ver mi propio calendario (todos los miembros por defecto).
- `calendar.viewAll` · ver calendario de todo el equipo (admin · puede delegarse a "administrativa" desde `/ajustes/usuarios/roles`).
- `calendar.manage` · crear/editar/borrar eventos de cualquier miembro (admin).

## TODOs al conectar backend

Ver `docs/backend-integration.md §Calendar`.

```
GET    /api/calendar/events?from&to&assigneeUserId&types=&statuses=
GET    /api/calendar/events/:id
POST   /api/calendar/events                    { CalendarEventInput }
PATCH  /api/calendar/events/:id                { Partial<CalendarEvent> }
DELETE /api/calendar/events/:id
GET    /api/calendar/events/conflicts?assigneeUserId&start&end&ignoreId

# Google Calendar
POST   /api/me/integrations/google-calendar/connect     → URL OAuth
GET    /api/me/integrations/google-calendar/status      → { connected, email, lastSyncAt }
POST   /api/me/integrations/google-calendar/disconnect
# Cron bidireccional cada 5 min.

# Envío al cliente
POST   /api/calendar/events/:id/ics                      → .ics attachment
POST   /api/calendar/events/:id/send                     { channels: ["email"|"whatsapp"] }
```

Regla de oro: cada mutación (crear/editar/cancelar) emite evento en
el timeline de la oportunidad/contacto linkado (`§🥇` en CLAUDE.md).
