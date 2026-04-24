# oportunidades.md · pipeline comercial unificado

> Ruta: `/oportunidades` (listado) + `/oportunidades/:id` (ficha detalle).
> Rol: solo Promotor. Agencias tienen la ruta oculta en sidebar.
> Spec de la ficha: `docs/screens/oportunidades-ficha.md`.
> Decisión: ADR-053 (revierte ADR-052) · entidad única, sin Lead separado.

## Propósito

**Una sola entidad** para todo el embudo comercial. En Byvaro no hay
distinción Lead/Oportunidad: cada contacto potencial entra, recorre el
pipeline y termina en Ganada/Perdida dentro de la misma pantalla.

Pipeline fijo (V1):

```
solicitud → contactado → visita → evaluación → negociando → ganada | perdida
                                                            + duplicate (IA)
```

Cada etapa es un valor de `LeadStatus` (`src/data/leads.ts`). El nombre
del archivo/tipo se mantiene por historia del repo — el concepto que
maneja es "oportunidad".

## Layout

KPIs + toolbar + tabla · mismo idioma visual que el resto del producto.

```
┌──────────────────────────────────────────────────────────────────┐
│ Comercial                                                        │
│ Oportunidades   [📧 leads@luxinmo.byvaro.app · copy]             │ ← pill email
│ Pipeline comercial · desde que entra el cliente hasta el cierre. │
├──────────────────────────────────────────────────────────────────┤
│ [Solicitudes][Contactado][En visita][Evaluación][Negociando]     │ ← KPIs clickeables
├──────────────────────────────────────────────────────────────────┤
│ 🔍 Buscar…  [Todos·Solicitudes·Contactado·…·Duplicados]  [Filtros]│
├──────────────────────────────────────────────────────────────────┤
│ Cliente | Interés | Recibido | Estado | Responsable              │
│ (thumb 80×54 de la promoción + nombre + email + OPP-0001 · tlf)  │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

### Pill del email del workspace

Al lado del H1 aparece un pill clickable:

> Añade este email a los portales para recibir los leads automáticamente · `leads@luxinmo.byvaro.app` [copy]

Click → copia el email al portapapeles (toast). Se usará en portales
(Idealista, Fotocasa, Habitaclia…) como email-forward para ingestar
leads automáticamente. `TODO(backend): GET /api/workspace/leads-inbox`.

### KPIs (5 tarjetas clickeables)

Cada tarjeta filtra el listado (toggle: volver a clicar limpia el
filtro). Se marca con `ring-2 ring-foreground` cuando está activa.

| Chip         | Cuenta                              |
|--------------|-------------------------------------|
| Solicitudes  | `status === "solicitud"`            |
| Contactado   | `status === "contactado"`           |
| En visita    | `status === "visita"`               |
| Evaluación   | `status === "evaluacion"`           |
| Negociando   | `status === "negociando"`           |

Los estados terminales (**Ganadas · Perdidas · Duplicados**) se ven
vía segmented filter arriba del listado (no como KPI — no son pipeline
sano).

### Fila de la tabla

Cada fila (`LeadRow` en `src/pages/Leads.tsx`):

- **Cliente**: avatar con iniciales · bandera nacional (emoji) ·
  nombre · chip `DUP` si `duplicateScore ≥ 70` · email · referencia
  `OPP-XXXX` (mono) + teléfono tabular en línea 3.
- **Interés**: thumbnail 80×54 de la promoción referenciada (lee de
  `developerOnlyPromotions`) + nombre · tipología · dormitorios ·
  presupuesto · zona.
- **Recibido**: hora relativa arriba + fuente (Idealista, Fotocasa…)
  debajo.
- **Estado**: pill con color semántico + dot.
- **Responsable**: único (no multi). Si no hay asignado → botón
  **"+ Asignar responsable"** que abre `<UserSelect>` canónico
  (`onlyActive`). Si hay → avatar + nombre + cargo + kebab para
  cambiar/quitar. Storage: `src/components/leads/leadAssigneeStorage.ts`
  (hook `useLeadAssignee(leadId)`).

Click en fila → `/oportunidades/:id`.

## Ficha detalle

`/oportunidades/:id` · ver **`docs/screens/oportunidades-ficha.md`**.

## Vista de agencia

Las oportunidades son **internas del promotor** (pipeline comercial
propio). Las agencias tienen la ruta oculta en el sidebar
(`agencyHiddenRoutes` de `AppSidebar.tsx`). Si una agencia entra
manualmente a `/oportunidades`, el `<PromotorOnly>` la redirige a
`/inicio`.

## TODOs al conectar backend

Ver `docs/backend-integration.md §7.1 Leads`:

```
GET    /api/opportunities                  → Opportunity[] (paginado, filtros)
GET    /api/opportunities/:id              → full
PATCH  /api/opportunities/:id              { status }          ← avanzar/retroceder etapa
PATCH  /api/opportunities/:id/assignee     { userId | null }   ← responsable único
POST   /api/opportunities/:id/comments     { body }
POST   /api/opportunities/:id/emails       { to, subject, body, attachments[] }
POST   /api/opportunities/:id/visits       { scheduledAt, … }

GET    /api/workspace/leads-inbox          → { address, portalsConnected[] }
```

Regla de oro: cada mutación emite evento en el timeline de la
oportunidad **y** en el historial del contacto (§🥇 `CLAUDE.md`).
