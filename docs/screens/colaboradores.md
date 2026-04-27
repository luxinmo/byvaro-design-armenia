# Pantalla · Colaboradores (`/colaboradores`)

## Propósito

Vista del **promotor** sobre su red de agencias colaboradoras. Cubre:

1. **Operativa diaria** — saber qué agencias están activas, qué señales
   comerciales traen, revisar solicitudes pendientes y compartir nuevas
   promociones.
2. **Evaluación** — poder entrar a la ficha de cada agencia para decidir
   (aprobar, pausar, eliminar, compartir).

**Audiencia**: solo Promotor. La vista Agencia no tiene acceso a este menú.

---

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Red comercial (eyebrow)                                        │
│ Tus colaboradores                [Estadísticas ↗] [+ Invitar]  │
│ subtítulo                                                      │
│                                                                │
│ [🔍 Buscar agencia o ciudad...........................] [☰ Filtros] │
├────────────────────────────────────────────────────────────────┤
│ ● N solicitudes pendientes · agencias esperando ...  Ver ↗     │
├────────────────────────────────────────────────────────────────┤
│ Tu red                                          Ordenar por …│
│ N agencias                                                     │
│                                                                │
│ ┌────────┐ ┌────────┐ ┌────────┐                               │
│ │  Card  │ │  Card  │ │  Card  │  (1 col → sm:2 → lg:3)        │
│ └────────┘ └────────┘ └────────┘                               │
└────────────────────────────────────────────────────────────────┘
```

> **Nota:** las recomendaciones Byvaro (strip "agencias que no
> colaboran contigo") viven en `/colaboradores/estadisticas` — ver
> `docs/screens/colaboradores-estadisticas.md`. Son el cierre natural
> del análisis de red, no del listado operativo.

---

## Header

- Eyebrow `RED COMERCIAL` + H1 "Tus colaboradores" (`text-[22px]
  sm:text-[28px] font-bold`) + subtítulo.
- CTAs a la derecha:
  - **Estadísticas ↗** · placeholder que toast "próximamente" hasta que
    se construya la sección de analítica agregada.
  - **+ Invitar agencia** (pill negro) · abre `InvitarAgenciaModal`.

Debajo · row 2:

- **Buscador** full-width (`h-10 rounded-full`).
- **Filtros** (icono deslizadores + "Filtros" + badge contador).

---

## Banner de solicitudes pendientes

Si hay agencias con `solicitudPendiente || isNewRequest`, pill
horizontal clickable:

```
● N solicitudes pendientes · agencias esperando tu respuesta   Ver solicitudes ↗
```

Al clicar abre el **drawer lateral** con las solicitudes.

---

## Drawer · Solicitudes (3 tabs)

Drawer lateral derecho (full-screen en mobile) con tabs:
**Pendientes / Aceptadas / Descartadas**. Cada tab muestra cuenta en
pill al lado del label. Pintamos dos tipos de solicitud con estética
unificada (mismo padding `p-3.5`, mismas alturas, mismos botones):

### Tipo 1 · Solicitud por promoción (`SolicitudPromoCard`)

Origen: agencia clica "Solicitar colaboración" en `/promotor/:id/panel`
(tab Resumen). Shape canónico en
`docs/backend/domains/collaboration-requests.md`.

Estructura compacta de la card:
- **Top**: avatar agencia (h-9) + nombre + verified badge + chip de
  estado (Pendiente ámbar / Aceptada verde / Descartada destructive).
- **Sub-card**: thumb 14×10 promo + nombre + ubicación · comisión
  (botón completo, click = ir a la promoción).
- **Meta row**: chip "Ya colabora · N promos" o "Sin colaboración previa"
  + fecha compacta + avatar+nombre del usuario que envió.
- **Mensaje** (italic, line-clamp-3) si existe.
- **Bloque "decisión"** (solo si status !== "pendiente"): "Aceptada/
  Descartada · fecha · avatar+nombre" del usuario del promotor que decidió.
- **Acciones** (grid responsive según status):
  - `pendiente` → Ver ficha · Descartar · Aceptar (gate
    `collaboration.requests.manage`).
  - `aceptada` → Ver ficha (read-only).
  - `rechazada` → Ver ficha · Recuperar.

### Tipo 2 · Solicitud agency-level (`SolicitudAgencyCard`)

Origen: agencia se da de alta vía marketplace o respuesta a invitación
cancelada (`Agency.solicitudPendiente`). Solo aparece en tab
**Pendientes** bajo header "Alta de agencia · N".

Misma estética compacta:
- Top: avatar + nombre + verified + chip "Pendiente".
- Sub-row con chip Marketplace/Invitada + "Alta de agencia · sin
  colaboración previa".
- Meta: mercados + teamSize + oficinas + GoogleRatingBadge.
- Descripción + mensaje italic.
- Botones: Ver ficha · Descartar · Aceptar.

### Permisos

Sin `collaboration.requests.manage`: aviso lock-icon arriba "Solo
lectura · necesitas el permiso `collaboration.requests.manage` para
aceptar, descartar o restaurar". Botones quedan `disabled:opacity-40`.

---

## Grid principal · "Tu red"

Header:

- Eyebrow `RED COMPLETA` + H2 "N agencias".
- `MinimalSort` a la derecha con opciones:
  - Volumen de ventas (mayor) · default
  - Ventas cerradas (más)
  - Registros (más)
  - Rating Google (mejor)
  - Actividad reciente (`lastActivityAt`)
  - Más antiguas (`collaboratingSince`)
  - Nombre A-Z / Z-A

Grid `1 → sm:2 → lg:3` de **FeatureCard** por agencia. Cada card:

- **Cover** (con fallback `DEFAULT_COVER`).
- **Logo circular** overlapping (con fallback `DEFAULT_LOGO`).
- **Nombre** con `<Highlight>` amarillo si coincide con la búsqueda.
- **`GoogleRatingBadge`** inline junto al nombre (si `googleRating`).
- **Ubicación** con highlight.
- **Banderas de mercados**.
- **Chips estado**: `N/M compartidos` + `ContractChip` + `IncidenciasChip`.
- **Stats grid** (3 cols): Visitas · Registros · Ventas.
- **Meta row**: `Desde {collaboratingSince}` · `{teamSize} agentes`.
- **CTA** "Ver ficha" (navega a `/colaboradores/:id`) + kebab (pausar,
  email, eliminar).

---

## Drawer · Filtros

Abre con el botón "Filtros". Secciones:

- **Estado** (single) — Activas / Contrato pendiente / Pausadas
- **Origen** (multi) — Invitada / Marketplace
- **Tipo** (multi) — Agencia / Broker / Network
- **Contrato** (multi) — Vigente / Por expirar / Expirado / Sin contrato
- **Mercados que atiende** (multi, banderas dinámicas)
- **Rating de Google mínimo** (single) — ≥4★ / ≥3★
- **Otros** — Solo favoritos (toggle)

Footer con "Limpiar todo" + pill "Ver N resultados".

---

## Subcomponentes internos (card-internal)

| Componente | Propósito |
|---|---|
| `ContractChip` | Estado contrato (vigente/por-expirar/expirado) |
| `GoogleRatingBadge` | Pill con "G" Google + rating + estrella + reseñas |
| `MercadosFlags` | Stack de banderas con `+N` overflow |
| `IncidenciasChip` | Rojo si `duplicados + cancelaciones + reclamaciones > 0` |
| `Highlight` | Resalta query en texto con `<mark class="bg-amber-200">` |
| `ChipGroup` | Chips multiselect en el drawer de filtros |
| `MetricBlock` | Stat block dentro del card |
| `KebabMenu` | Menu contextual pausar/email/eliminar |

Documentados en `docs/ui-helpers.md`.

---

## Flujos

### Flujo 1 · Invitar agencia nueva (desde header)

1. Botón "+ Invitar agencia" → abre `InvitarAgenciaModal` (wizard 3 pasos).
2. Paso 1: email + nombre opcional + mensaje.
3. Paso 2: comisión + idioma.
4. Paso 3: preview del email + copiar link / enviar.
5. Se crea una `Invitacion` en `useInvitaciones()` (localStorage mock).

### Flujo 1-bis · Invitar desde una promoción

Ver `docs/screens/compartir-promocion.md`. La invitación creada se
inyecta en este listado como fila sintética
`invitacionToSyntheticAgency()`.

### Flujo 2 · Revisar y aprobar solicitud entrante

1. Banner pill "N solicitudes pendientes" → Ver solicitudes.
2. Drawer lateral con tarjetas informativas.
3. CTA "Ver ficha y decidir ↗" por cada → navega a `/colaboradores/:id`.
4. En la ficha, el promotor revisa toda la info (ver `agencia-detalle.md`).
5. Footer sticky con Aprobar / Descartar.

### Flujo 3 · Pausar / reanudar / eliminar colaboración

1. Se accede a la ficha desde "Ver ficha" en cualquier card.
2. Footer sticky con Pausar / Reanudar / Eliminar (con `useConfirm`).

### Flujo 4 · Marcar favorita

Toggle estrella en la cabecera del card (o en la ficha, en el hero).
Integrado con `useFavoriteAgencies()` (store central, sincronización
cross-tab).

---

## Endpoints esperados

Ver `docs/backend-integration.md` §4 (Colaboradores), §5 (Invitaciones)
y §6 (Favoritos). Todas las mutations llevan `TODO(backend)` en el código.

---

## Decisiones de producto

- **Solo una versión** (la V3 comercial). Las variantes V1 y V2 se
  eliminaron el 2026-04-22 tras iteración.
- **Top performers fuera** — todas las agencias en una sola rejilla con
  cards grandes. Destacar top-3 separadamente era ruido.
- **Google rating inline con el nombre** — solo aparece si existe; no
  crea hueco fantasma en agencias sin rating.
- **Logos en círculo completo** (`rounded-full`) para diferenciar
  claramente de las cards de promoción.
- **Terminología "Compartidos"** en vez de "Promos" (más profesional).
- **Aprobar/descartar/pausar/eliminar viven solo en la ficha**
  (`/colaboradores/:id`) — forzar evaluación completa antes de decidir.
  Los listados y drawers no tienen acciones destructivas.
