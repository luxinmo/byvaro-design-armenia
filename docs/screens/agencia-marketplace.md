# Pantalla · Marketplace (Vista Agencia) · `/promotores` o `/marketplace`

## Propósito

Descubrimiento de promotores y promociones para agencias. Es el **gancho
comercial** del plan de 99€/mes: lo que la agencia ve aquí (difuminado si
no paga) la convence de suscribirse.

**Audiencia**: Solo Agencia. El Promotor no accede.

## Dos modos

### Agencia sin plan (freemium)

Ve el marketplace pero **todo el contenido está oculto** (ver
`../paywall.md` para detalle exacto). Muestra contadores y filtros
funcionales pero sin revelar identidades ni datos de las promociones.

### Agencia con plan 99€/mes

Ve todo sin limitaciones. Puede solicitar colaboración a cualquier promotor.

## Layout (modo con plan)

```
┌─────────────────────────────────────────────────────────┐
│ Marketplace                                             │
│ Descubre nuevos promotores y sus promociones           │
│                                                         │
│ [Buscar promotor, promoción, zona...]    [Ordenar: Recientes ↓]
│                                                         │
│ [Zona ▼] [Tipología ▼] [Precio ▼] [Comisión ▼] [Entrega ▼]
├─────────────────────────────────────────────────────────┤
│ 247 promociones de 89 promotores · 32 añadidas esta semana
├─────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────────────────────────────────┐    │
│ │  COVER   │ Kronos Homes · 5% comisión          │    │
│ │  16:9    │ Villa Serena                        │    │
│ │          │ 📍 Altea, Alicante                  │    │
│ │          │ Desde 512K€ · Entrega Q3 2026       │    │
│ │          │ 8/36 unidades                       │    │
│ │          │ [Solicitar colaboración →]          │    │
│ └──────────┴──────────────────────────────────────┘    │
│ (...más cards...)                                       │
└─────────────────────────────────────────────────────────┘
```

## Layout (modo sin plan)

```
┌─────────────────────────────────────────────────────────┐
│ 🌟 Estás viendo el marketplace en modo gratuito         │
│    [Upgrade 99€/mes para desbloquear todo →]           │
├─────────────────────────────────────────────────────────┤
│ Marketplace                                             │
│ 247 promociones disponibles                             │
│                                                         │
│ (buscador + filtros iguales)                            │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────────────────────────────────┐    │
│ │  ░░░░░░  │ Promoción #1247  🔒                 │    │
│ │  ░░░░░░  │ 📍 Costa del Sol · Plurifamiliar    │    │
│ │          │                                      │    │
│ │          │ —   — / —   —                        │    │
│ │          │                                      │    │
│ │          │ [ Upgrade para acceder → ]           │    │
│ └──────────┴──────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Componentes necesarios

- `<MarketplacePromoCard>` — variante de PromoCard con props `blurred:boolean`
- `<PaywallBanner>` — banner sticky arriba para agencias free
- `<UpgradeModal>` — modal fullscreen de upgrade al clickar card bloqueada
- Reutiliza `FilterPill`, `SortPill`, `Tag` del design system

## Acciones del usuario

### Agencia con plan

| Acción | Resultado |
|---|---|
| Click card | Navega a `/marketplace/:promotionId` (detalle completo read-only) |
| Click "Solicitar colaboración" | Modal con mensaje personalizable → envía al promotor |
| Filtros + búsqueda | Refresca resultados |

### Agencia sin plan

| Acción | Resultado |
|---|---|
| Click card | Abre `<UpgradeModal>` |
| Click "Upgrade..." | Stripe Checkout |
| Filtros + búsqueda | Funcionan, actualizan contador, siguen bloqueadas |

## Filtros

| Filtro | Valores |
|---|---|
| Zona | Costa del Sol, Costa Blanca, Baleares, Madrid... |
| Tipología | Villas, Apartamentos, Áticos, Adosados |
| Precio | Desde 200K€ / 500K€ / 1M€ / 2M€ |
| Comisión mín | 3%+, 4%+, 5%+ |
| Entrega | Inmediata, 2025, 2026, 2027+ |

## API endpoints esperados

```
GET /api/v1/marketplace/promotions
  ?search=&zona=&tipo=&precioMin=&comisionMin=&entrega=
  &page=1&limit=20

→ Si agency.plan === "marketplace":
  { data: FullPromotion[], meta: { total, page, pages },
    aggregates: { total: 247, nuevas: 32, porZona: {...} } }

→ Si agency.plan === "free":
  { data: BlurredPromotion[], ... }
  donde BlurredPromotion solo incluye: id, zonaGeneral, tipologiaGenerica
```

**Importante**: el backend DEBE filtrar los campos sensibles en la
respuesta. NO enviarlos para ocultarlos con CSS — un usuario técnico lo
saltaría con devtools.

```
POST /api/v1/marketplace/promotions/:id/request-collaboration
body: { message: string }
→ Si free: 402 Payment Required, response con info del paywall
→ Si marketplace: notificación al promotor, response ok
```

```
POST /api/v1/billing/agency-plan/checkout
body: { plan: "marketplace" }
→ { checkoutUrl: "https://checkout.stripe.com/..." }
```

## Permisos

| Elemento | Agencia free | Agencia plan |
|---|---|---|
| Ver contador total | ✅ | ✅ |
| Ver filtros | ✅ | ✅ |
| Ver cards detalladas | ❌ (blur) | ✅ |
| Click en card | → Paywall | → Detalle |
| Solicitar colaboración | ❌ → Paywall | ✅ |
| Ordenar resultados | ✅ (aunque oculto) | ✅ |

## Estados

- **Loading**: skeleton de 6 cards
- **Empty (con plan, sin resultados)**: "Sin resultados para los filtros
  aplicados"
- **Empty (sin plan, sin resultados)**: (raro, imposible porque siempre hay
  marketplace si hay promotores)
- **Error**: banner rojo reintentar

## Enlaces salientes

| Desde | Hacia |
|---|---|
| Card (con plan) | `/marketplace/:id` |
| Card (sin plan) | Modal de upgrade |
| Banner "Upgrade" | Modal de upgrade |
| "Solicitar colaboración" | Modal de solicitud (con plan) o paywall |

## Responsive

- **Móvil**: cards verticales 1 col, banner paywall sticky top
- **Tablet+**: cards horizontales ancho completo, 1 por fila (como
  `/promociones`)

## Notas de implementación

- El scroll del listado debe ser infinite scroll o paginado server-side
- Los agregados (contador por zona) se calculan server-side y se cachean
- El blur debe ser **lógico, no cosmético**: datos nunca se envían al frontend
- El banner de paywall es sticky y sigue visible durante el scroll
- La URL admite filtros (`?zona=altea&comision=5`) para que se puedan
  compartir

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoint `/marketplace/promotions` con RLS para
      filtrar campos según plan de la agencia
- [ ] `TODO(backend)`: endpoint `/marketplace/promotions/:id/request-collaboration`
- [ ] `TODO(backend)`: Stripe Checkout para plan marketplace 99€/mes
- [ ] `TODO(ui)`: componente BlurredCard con placeholders
- [ ] `TODO(ui)`: UpgradeModal con comparativa features + Stripe Checkout
- [ ] `TODO(ui)`: banner sticky "modo gratuito"
- [ ] `TODO(analytics)`: eventos marketplace.view / click / paywall / paid
