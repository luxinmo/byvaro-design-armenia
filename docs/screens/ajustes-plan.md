# /ajustes/facturacion/plan · Plan & uso (Fase 1)

> **Fase 1 · validación 249€/mes para promotores.** Esta pantalla es el
> centro de control del plan del workspace + el destino del CTA del
> `<UpgradeModal>` y del pill `<UsagePill>` del header.

---

## Propósito

- Mostrar el **plan vigente del workspace** (`trial` o `promoter_249`).
- Mostrar el **uso real** (3 contadores) frente a los límites del plan.
- Permitir suscribirse y cancelar (mock · backend pendiente).
- Comunicar qué desbloquea el plan promotor.

---

## Estados

### Plan `trial` (gratis)
- Card principal con icono `Sparkles` + label "Gratis · con límites para
  validar el producto".
- CTA primario "Suscribirme" (icono `Crown`) abre `<UpgradeModal>` con
  trigger `near_limit`.
- Tres barras de uso (promociones · agencias · registros) con
  threshold visual:
  - `<80%` · barra azul (primary).
  - `≥80%` · barra ámbar (warning).
  - `≥100%` · barra roja (destructive).
- Card "¿Qué desbloquea el plan promotor?" con bullet list de mejoras.

### Plan `promoter_249` (pagado)
- Card principal con icono `Crown` (color primary).
- Subtítulo "249€ / mes + IVA · postpago · sin permanencia".
- CTA "Cancelar suscripción" (variant outline · vuelve a `trial` y
  toast informativo).
- Las barras de agencias/registros desaparecen (límite ∞) y se
  muestran como "Ilimitado" con check verde.

---

## Datos consumidos

- `usePlan()` · `src/lib/plan.ts` · workspace-level vía `byvaro.plan.v1`
  en localStorage. Reactivo via `byvaro:plan-change` event.
- `useUsageCounters()` · `src/lib/usage.ts` · re-deriva de
  `developerOnlyPromotions`, `agencies`, `useCreatedRegistros + seed`.
- `PLAN_LIMITS` · `src/lib/plan.ts` · constante exportada con los topes
  de cada tier.

## Acciones

- **Suscribirse** · `subscribeToPromoter249()` (mock) → toast +
  re-render → CTA cambia a "Cancelar".
- **Cancelar** · `cancelSubscription()` (mock) → toast info → CTA
  vuelve a "Suscribirme". Los datos NO se purgan.

---

## Contrato backend (TODO)

```http
GET /api/workspace/plan
→ 200 { tier: "trial" | "promoter_249", since: ISO, expiresAt: ISO? }

GET /api/workspace/usage
→ 200 { activePromotions: int, invitedAgencies: int, registros: int }

POST /api/workspace/plan/subscribe
  body: { stripePriceId: "price_..." }
→ 200 { tier: "promoter_249", since: ISO }

POST /api/workspace/plan/cancel
→ 200 { tier: "trial", since: ISO }
```

**Backend invariantes:**
- El plan vive en la `organization` (developer org), no en el `user`.
- Endpoints mutantes que tocan los 3 contadores devuelven **402 Payment
  Required** con `{ trigger, used, limit }` cuando se llega al tope.
  La UI lee ese payload con el mismo formato del store local
  `usageGuard.ts::openUpgradeModal`.
- Webhook Stripe `customer.subscription.created/deleted/updated`
  actualiza el `tier` server-side · el cliente solo refleja.

---

## Archivos clave

- `src/lib/plan.ts` · modelo + hook + setters.
- `src/lib/usage.ts` · contadores + hook reactivo.
- `src/lib/usageGuard.ts` · `useUsageGuard()` + store del modal.
- `src/lib/usagePressure.ts` · helper para `<UsagePill>` (≥80%).
- `src/components/paywall/UpgradeModal.tsx` · modal global.
- `src/components/paywall/UsagePill.tsx` · pill ámbar header.
- `src/pages/ajustes/facturacion/plan.tsx` · esta pantalla.
- `src/components/settings/registry.ts:110` · `live: true`.

---

## Tracking

`paywall.shown` event se emite al abrir el modal con
`{ trigger, used, limit }`. Hoy log a `console.info`. En backend lo
toma `analytics.track()` · es la métrica clave de validación de la
Fase 1 (qué % de promotores que ven el modal hacen click en el CTA).
