# Pantalla · Colaboradores (`/colaboradores`)

## Propósito

Vista del **promotor** sobre su red de agencias colaboradoras. Sustituye
al módulo legacy "Agencies". Cubre dos necesidades:

1. **Operativa diaria** — saber qué agencias están activas, qué KPIs traen
   (registros, ventas, comisión), aprobar/rechazar solicitudes del
   marketplace y pausar colaboraciones problemáticas.
2. **Analítica de red** — entender el rendimiento agregado (top
   performers, heatmap de actividad, conversión global).

**Audiencia**: **solo Promotor**. La vista Agencia no tiene acceso a
este menú (ver `docs/ia-menu.md` → sección "Vista Agencia").

---

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ RED (eyebrow)                                              │
│ Colaboradores    N agencias · X activas · Y pendientes     │
│                                          [+ Invitar agencia]│
├────────────────────────────────────────────────────────────┤
│ Red | Analítica                         (tabs subrayado)   │
├────────────────────────────────────────────────────────────┤
│ [Buscar…]        [Estado ▼] [Origen ▼]  [● Solo pendientes]│
│                                                            │
│ ┌─ N solicitudes pendientes ─────────────────────────────┐ │
│ │  [logo] Iberia Luxury Homes · Lisboa · Marketplace    │ │
│ │  "Nos especializamos en portugueses y brasileños..."  │ │
│ │  [Aprobar]  [Rechazar]                                │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │  Agency A   │ │  Agency B   │ │  Agency C   │            │
│ │ Activa·Invit│ │ Activa·Mkt  │ │ Pausada·Inv │            │
│ │ 2·38·6·4%   │ │ 4·62·11·5%  │ │ 0·12·1·3%   │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
└────────────────────────────────────────────────────────────┘
```

Tab **Analítica**:

```
┌ Agencias | Reg(mes) | Ventas(mes) | Comisión media ┐
├────────────────────────────────────────────────────┤
│  Top 5 agencias (list)      │  Conversión % (bar)  │
├─────────────────────────────┴──────────────────────┤
│  Heatmap 12 meses × N agencias (grid CSS opacity)  │
└────────────────────────────────────────────────────┘
```

---

## Elementos de diseño

- **Tabs** estilo **subrayado** bajo el activo (color `text-primary` + línea
  `after:h-[2px] after:bg-primary`), patrón tomado de `PromocionDetalle.tsx`.
  NO se usan pills para estos tabs.
- **Cards de agencia**: `rounded-2xl border-border shadow-soft` con hover
  `-translate-y-0.5` y `shadow-soft-lg`. Grid responsive
  `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
- **Filter pills**: dropdowns multi-select que cambian a `bg-foreground text-background`
  cuando tienen selección. Mismo patrón que en `Promociones`.
- **Switch** "Solo pendientes" reutiliza `components/ui/Switch`.
- **Modal invitar**: reutiliza `components/empresa/InvitarAgenciaModal.tsx`
  (wizard de 3 pasos: datos → condiciones → preview).
- **Toaster**: `sonner`, `position="top-center" richColors closeButton`
  (siguiendo el patrón del resto de pages).

---

## Estados de una agencia (`estadoColaboracion`)

| Estado | Tag variant | Significado |
|---|---|---|
| `activa` | `success` | Colaboración en marcha, registros/ventas activos |
| `contrato-pendiente` | `warning` | Ha solicitado colaborar, falta aprobación/firma |
| `pausada` | `muted` | Colaboración temporal o definitivamente detenida |

**Origen** (`origen`):

| Origen | Tag icon | Significado |
|---|---|---|
| `invited` | `UserPlus` | El promotor invitó a la agencia (plan 0€) |
| `marketplace` | `Store` | La agencia pagó 99€/mes y solicitó colaborar |

---

## Flujos

### Flujo 1 · Invitar agencia nueva

1. Promotor hace click en **"Invitar agencia"** (header).
2. Se abre `InvitarAgenciaModal` (wizard 3 pasos).
3. Paso 1: email + nombre opcional + mensaje.
4. Paso 2: % comisión + idioma del email.
5. Paso 3: preview del email + opción de copiar link o enviar.
6. Al enviar, toast de éxito y cierra. Se crea una `Invitacion` via
   `lib/invitaciones.ts` (en mock = localStorage, en prod = POST API).

### Flujo 2 · Aprobar / rechazar solicitud marketplace

1. La agencia desde el marketplace solicita colaborar → entra como
   `solicitudPendiente: true, origen: "marketplace"`.
2. Aparece en la bandeja destacada superior (fondo ámbar) con mensaje
   opcional.
3. **Aprobar**: pasa a `estadoColaboracion: "activa"`, deja de ser
   pendiente. Toast éxito.
4. **Rechazar**: se elimina del dataset (en mock se marca `"deleted"`
   en el overlay local).

### Flujo 3 · Pausar / reanudar

1. En el kebab menu de una card → "Pausar".
2. Estado cambia a `pausada`, la agencia no recibe invitaciones nuevas
   a promociones y sus registros quedan congelados.
3. "Reanudar" vuelve a `activa`.

### Flujo 4 · Abrir ficha de agencia

TODO. La ficha detallada se diseñará en una próxima iteración
(`/colaboradores/:id`). Por ahora muestra un toast informativo.

---

## Filtros

| Filtro | Tipo | Valores |
|---|---|---|
| Búsqueda | texto | Por `name` o `location` |
| Estado | multi-select pill | `activa` · `contrato-pendiente` · `pausada` |
| Origen | multi-select pill | `invited` · `marketplace` |
| Solo pendientes | switch | On/Off (muestra solo con `solicitudPendiente`) |

---

## API endpoints esperados

```
GET /api/collaborators
  ?search=texto
  &estado=activa,pausada
  &origen=invited,marketplace
  &soloPendientes=true

→ {
    data: Agency[],
    aggregates: { total, activas, pausadas, pendientes, marketplaceCount }
  }
```

```
POST /api/collaborators/invite
  body: { email, nombreAgencia?, mensaje?, comisionOfrecida, idiomaEmail }
→ { invitacion: Invitacion, urlToken: string }
```

```
POST /api/collaborators/:id/approve   →  { agency: Agency }
POST /api/collaborators/:id/reject    →  { ok: true }
POST /api/collaborators/:id/pause     →  { agency: Agency }
POST /api/collaborators/:id/resume    →  { agency: Agency }
DELETE /api/collaborators/:id         →  { ok: true }
```

```
GET /api/collaborators/activity?range=12m
→ { months: string[], agencies: [{ id, name, values: number[] }] }
```

```
GET /api/collaborators/analytics
→ {
    totals: { agencies, registrosMes, ventasMes, comisionMedia },
    top5: Agency[],  // sorted by ventasCerradas desc
    conversion: { registros: number, ventas: number, pct: number }
  }
```

---

## Diferencias invited vs marketplace

| Aspecto | `invited` | `marketplace` |
|---|---|---|
| Quién inicia | Promotor desde Colaboradores | Agencia con plan 99€ desde marketplace |
| Coste para agencia | 0€ (plan gratis) | 99€/mes |
| Visibilidad inicial | Solo la promoción invitada | Catálogo completo |
| Revisión previa | No (el promotor la trajo) | **Sí** → entra como `contrato-pendiente` y requiere aprobación del promotor |
| Tag en card | `Invitada` (icon UserPlus) | `Marketplace` (icon Store) |

---

## Responsive

- **Mobile (≤ sm)**: grid `grid-cols-1`. Filter bar sticky arriba con
  `backdrop-blur`. El kebab menu se despliega bajo la card.
- **Tablet (md)**: grid `grid-cols-2`.
- **Desktop (xl)**: grid `grid-cols-3`.

El heatmap de Analítica fuerza `min-w-[640px]` y permite scroll horizontal
en móvil (mantiene legibilidad mínima de las celdas).

---

## Permisos

| Elemento | Promotor | Agencia |
|---|---|---|
| Acceso a `/colaboradores` | ✅ | ❌ oculto del menú |
| Invitar agencia | ✅ | — |
| Aprobar / rechazar solicitud marketplace | ✅ | — |
| Pausar / reanudar | ✅ | — |
| Ver KPIs agregados de otras agencias | ✅ | — |

---

## Estados especiales

- **Loading** — TODO: skeleton de 6 cards en grid (implementar al conectar
  backend).
- **Empty (sin agencias + sin pendientes)** — EmptyState con icono
  Handshake + CTA "Invitar agencia".
- **Empty (filtros sin resultados)** — mismo EmptyState.

---

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoints `GET/POST /api/collaborators/*`
- [ ] `TODO(backend)`: endpoint de analítica y heatmap precalculado
- [ ] `TODO(ui)`: ficha detallada de agencia en `/colaboradores/:id`
- [ ] `TODO(ui)`: selección múltiple de cards con barra flotante
      (`bottom-[72px]` en móvil) — no implementada en v1 al ser
      solo-mock
- [ ] `TODO(ui)`: skeletons durante load
- [ ] `TODO(ui)`: envío real del email vía Resend (ya soportado por
      `lib/invitaciones.ts` → POST al backend)
- [ ] `TODO(realtime)`: refresco automático al recibir nueva solicitud
      marketplace (Supabase Realtime o WebSocket)
