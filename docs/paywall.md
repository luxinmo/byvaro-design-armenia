# Paywall · Vista difuminada para agencia sin plan

Modelo freemium de Byvaro para agencias: pueden usar gratis las promociones
de promotores que las invitan, pero para **descubrir** promotores y pedir
colaboraciones nuevas desde el marketplace deben pagar 99€/mes.

Este documento define **exactamente qué se oculta y qué se muestra** en el
modo "sin plan" para mantener la conversión atractiva sin regalar valor.

## Dónde aparece el paywall

### 1. Marketplace de agencia (`/marketplace` o `/promotores`)

- Listado de **todas las promociones** de todos los promotores de Byvaro
- Una agencia **gratuita** ve el marketplace pero con contenido difuminado
- Una agencia **marketplace** ve todo sin limitaciones

### 2. Intentar pedir colaboración a un promotor desconocido

- Botón "Solicitar colaboración" → modal de upgrade

### 3. Click en detalle de una promoción marketplace

- Si no hay plan → pantalla de upgrade completa
- Si plan → detalle completo

## Qué se OCULTA (paywall activo)

Todo esto se sustituye por placeholders:

| Elemento | Sin plan | Con plan |
|---|---|---|
| Fotos del cover | Placeholder gris con icono de ojo tachado + overlay | Imagen real |
| Nombre de la promoción | "Promoción nº 1247" (solo un número) | "Villa Serena" |
| Nombre del promotor | "—" | "Kronos Homes" |
| Ubicación exacta | "Costa del Sol" (solo provincia/zona) | "Altea, Alicante" |
| Precio mín/máx | Texto "Precio oculto · Upgrade" | "Desde 512K€ — 1,9M€" |
| Unidades disponibles | "—" | "8 / 36" |
| Fecha de entrega | "—" | "Q3 2026" |
| Comisión ofrecida | "—" | "5%" |
| Agencias colaboradoras | "—" | avatars con nombres |
| CTA "Solicitar colaboración" | Deshabilitado con candado 🔒 | Activo |
| CTA "Ver detalle" | Navega a paywall fullscreen | Navega al detalle |

## Qué se MUESTRA (sin plan)

Lo justo para que la agencia vea que Byvaro tiene valor sin regalar
ningún dato:

- **Contador total**: "247 promociones activas en Byvaro"
- **Contador por zona general**: "Costa del Sol: 48 · Costa Blanca: 62 · Baleares: 23..."
- **Filtros funcionales** (aunque filtran datos ocultos): zona, tipo,
  entrega, comisión mínima. Funcionan, actualizan el contador, no revelan
  identidades.
- **Mensaje del paywall en card individual**:
  > Desbloquea este promotor con un plan de 99€/mes. Accede a datos completos,
  > fotos, precios y solicita colaboración.
- **Banner sticky arriba del marketplace**: "Estás viendo el marketplace en
  modo gratuito · [Upgrade 99€/mes]"

## Diseño visual del difuminado

### Card con paywall

```
┌──────────────────────────────────────────┐
│  [░░░░░░░░░░░░░░░░░░░░░░░░░░] 🔒       │ ← cover placeholder gris
│                                          │
│  Promoción #1247                         │ ← número en vez de nombre
│  📍 Costa del Sol  · Plurifamiliar       │
│                                          │
│  —   — / —   —   —                      │ ← métricas ocultas
│                                          │
│  [ Upgrade para acceder → ]              │ ← CTA único
└──────────────────────────────────────────┘
```

### Detalles técnicos

- **Placeholder del cover**: `bg-muted` con icono `EyeOff` centrado, opacidad 40%
- **Números sustituidos**: guión em (`—`) en gris claro
- **Overlay blur real** (opcional): usar `backdrop-blur-md` sobre una card
  normal con datos sintéticos, queda más elegante pero consume más
- **Badge 🔒**: arriba derecha de la card, icono Lock en círculo
  `bg-foreground text-background`

## Flujo de upgrade

1. Click en card con paywall → modal fullscreen
2. Modal muestra:
   - Headline: "Desbloquea el marketplace completo de Byvaro"
   - 3 razones visuales:
     - Acceso a todas las promociones de España
     - Solicita colaboración directa a los promotores
     - Filtros avanzados + notificaciones de promos nuevas
   - **99€ / mes** · "Cancela cuando quieras"
   - CTA "Empezar prueba gratuita 14 días" o "Suscribirse"
3. Pago (Stripe Checkout) → webhook confirma → refresh de perfil → catálogo
   desbloqueado

## Qué NO se aplica el paywall

- **Promociones donde la agencia ya colabora** (invitada por el promotor) —
  acceso completo siempre, aunque no pague los 99€. El promotor la invitó,
  es gratis para esa agencia en ESA promoción específica.
- **Su propia panel**: mis registros, mi agenda, mis contactos. Todo eso es
  de la propia agencia, no se oculta.

## Implementación técnica

```ts
interface AgencySubscription {
  plan: "free" | "marketplace";  // free = 0€, marketplace = 99€/mes
  trialUntil?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// En el componente del marketplace:
function PromotionCard({ promotion, agencySubscription }) {
  const isBlurred = agencySubscription.plan === "free"
    && !promotion.collaboratingWithMe; // solo si NO colabora

  if (isBlurred) return <PaywalledCard promotion={promotion} />;
  return <FullCard promotion={promotion} />;
}
```

El backend debe:
- Filtrar campos sensibles del `PromotionMarketplaceDTO` si la agencia no
  tiene acceso
- **No devolver datos reales** disfrazados con CSS blur (eso se evita con
  devtools)
- Los datos del marketplace los sirve un endpoint dedicado
  `/api/v1/marketplace/promotions` distinto del `/promotions` del
  promotor/agencia con acceso

## Métricas a trackear

Para optimizar conversión:
- `marketplace.view` — agencia free llega al marketplace
- `marketplace.card.click` — click en una card bloqueada
- `marketplace.paywall.shown` — modal de upgrade visible
- `marketplace.paywall.cta` — click en "Upgrade"
- `marketplace.paywall.paid` — pago completado
- Funnel: view → click → paywall → cta → paid

## Casos edge

- **Agencia en trial (14 días)**: se comporta como marketplace, banner
  sutil "Prueba termina en X días"
- **Agencia con plan cancelado pero aún dentro del período pagado**: acceso
  completo hasta fin de período, banner "Tu plan termina el X"
- **Agencia que colabora en 1 promoción pero no paga plan**: ve esa
  promoción completa + el resto difuminadas
