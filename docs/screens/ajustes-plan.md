# /ajustes/facturacion/plan · Plan & uso

> **Filosofía Plan Básico permanente.** Plan Básico es la base perpetua
> del workspace · acceso a sus datos siempre. El "trial" NO es un plan
> distinto · es una ventana de **180 días** encima del Básico donde el
> promotor recién registrado tiene acceso completo (mismas capacidades
> que el plan de pago) para arrancar sin fricción. Cuando se acaba la
> ventana, sigue en Básico (sin crear promociones nuevas) hasta que
> activa el plan de pago.
>
> Esta pantalla es el centro de control del plan + destino del CTA del
> `<UpgradeModal>` y del pill `<UsagePill>` del header.

---

## Naming canónico

| Tier interno (`PlanTier`) | Label visible (`PLAN_LABEL`) | Audiencia |
|---|---|---|
| `trial` | **Básico** (con ventana 180 días activa) | Promotor / Comercializador |
| `promoter_249` | **Plus · 249€/mes** | Promotor / Comercializador |
| `promoter_329` | **Ultra · 329€/mes** | Promotor / Comercializador |
| `agency_free` | **Inmobiliaria · Básico** | Inmobiliaria |
| `agency_marketplace` | **Inmobiliaria · Plus · 99€/mes** | Inmobiliaria |
| `enterprise` | Enterprise | Bajo demanda |

Constante canónica · `TRIAL_DURATION_DAYS = 180` en `src/lib/plan.ts`.
Cambiar ese número refleja en el counter, en la copy de la pantalla y
en el trigger DB que rellena `workspace_plans.trial_ends_at` al crear
el workspace.

---

## Estados de la pantalla

### Promotor en Básico (con o sin trial activo) · 3 cajas

Layout de 3 cajas siempre en línea desde `sm` · es el **estado por
defecto** del promotor recién registrado y también del que sigue en
Básico tras agotar el trial.

**Caja 1 · Tu plan (Básico)**
- Icono `Check` verde · "Básico" en bold + descripción "Tu plan
  permanente · acceso a tus datos siempre · sin tarjeta requerida".
- Footer · `Database` icon + "Conservas tus datos".

**Caja 2 · Prueba gratuita**
- Icono `Clock` · estado dinámico:
  - **Trial activo** (`isInTrialWindow(state) === true`) · muestra `N
    días` restantes + "Acceso completo hasta el {fecha}" + barra de
    progreso `(180 - daysRemaining) / 180`.
  - **Trial finalizado** · muestra "Finalizada" + copy "Sigues en el
    plan Básico · activa el plan de pago para crear promociones
    nuevas".

**Caja 3 · Cuando lo necesites (plan de pago)**
- Icono `Crown` · "249€/mes" + "Plan Plus · IVA excl. · sin
  permanencia".
- CTA escala según urgencia · `trialUrgent = inTrial && daysRemaining
  ≤ 30`:
  - Urgente · botón sólido "Suscribirme" + `ArrowRight`.
  - No urgente · botón ghost "Ver detalles" + `ArrowRight`.

**Bloque "Cómo funciona tu plan Básico"** · 3 columnas:
1. `Sparkles` · "Empiezas con prueba completa · 180 días con acceso
   pleno · sin tarjeta".
2. `Database` · "Conservas tus datos siempre · contactos, ventas y
   microsites accesibles entre proyectos".
3. `Crown` · "Pagas solo cuando produces · activa el plan de pago
   cuando vuelvas a tener una promoción que vender · cancela al
   terminar".

**Bloque "Uso del workspace"** · solo si `inTrial === true` · barras
de uso real con el threshold visual:
- `<80%` · barra azul (primary).
- `≥80%` · barra ámbar (warning).
- `≥100%` · barra roja (destructive).

**Card "Tu prueba ha terminado"** · solo si trial expirado · icono
`Lock` ámbar + CTA "Activar plan".

**Card "Comparar todos los planes"** · link a `/planes` · siempre
visible.

### Plan `promoter_249` / `promoter_329` (pagado) · card único

Layout legacy single-card · más adelante uniformamos.

- Card principal con icono `Crown` (color primary).
- Subtítulo · "249€/mes (IVA excl.) · postpago · sin permanencia" /
  "329€/mes (IVA excl.) · hasta 10 promociones".
- CTA "Cancelar suscripción" (variant outline · vuelve a Básico
  manteniendo los datos).
- Bloque uso · "En el plan actual todas las métricas son ilimitadas".

### Plan `agency_free` (inmobiliaria) · card único

- Icono `Handshake` · "Inmobiliaria · Básico".
- Subtitle · "Gratis para siempre si te invitan · 10 solicitudes
  propias en tu provincia".
- CTA "Activar Plus" · pasa a marketplace 99€/mes.
- Counter "Solicitudes de colaboración enviadas · X / 10".

### Plan `agency_marketplace` (inmobiliaria pagada)

- Icono `Crown` · "Inmobiliaria · Plus · 99€/mes".
- Subtitle · "directorio nacional · sin permanencia".
- CTA "Cancelar suscripción".
- Counter ilimitado.

---

## Datos consumidos

- `usePlan()` · legacy single-tier · derivado del pack principal.
- `usePlanState()` · `PlanState` completo (signupKind + agencyPack +
  promoterPack + trialStartedAt + trialEndsAt). **Preferir este** en
  features nuevas.
- `usePlanLimits()` · derivado de `deriveLimits(state)`.
- `useUsageCounters()` · `src/lib/usage.ts` · contadores reales.
- Helpers de trial · `trialDaysRemaining()`, `trialDaysConsumed()`,
  `isInTrialWindow()`, `formatTrialEndDate()`.

## Acciones

- **Activar plan Plus** · `setPromoterPack(user, "promoter_249")` ·
  upserta `workspace_plans` server-side.
- **Cancelar** · `cancelSubscription(user)` · vuelve a Básico (trial
  para promotor / agency_free para inmobiliaria) · datos preservados.

---

## Contrato backend (parcialmente implementado)

```http
GET /api/workspace/plan
→ 200 {
  signup_kind: "promoter" | "agency",
  agency_pack: "none" | "free" | "marketplace",
  promoter_pack: "none" | "trial" | "promoter_249" | "promoter_329",
  trial_started_at: ISO?,
  trial_ends_at: ISO?
}

GET /api/workspace/usage
→ 200 { activePromotions: int, invitedAgencies: int, registros: int }

POST /api/workspace/plan/subscribe (TODO Stripe)
  body: { stripePriceId: "price_..." }
→ 200 { promoter_pack: "promoter_249", activated_at: ISO }

POST /api/workspace/plan/cancel (TODO Stripe)
→ 200 { promoter_pack: "trial" | "none", cancelled_at: ISO }
```

**Estado actual**: `workspace_plans` (Supabase) ya existe con los
campos del shape arriba. `trial_ends_at` lo rellena el trigger DB que
crea el workspace al signup (`now() + interval '180 days'`).
Subscribe/Cancel son mocks en frontend hasta que aterrice Stripe.

**Backend invariantes:**
- El plan vive en la `organization` (workspace), no en el `user`.
- Endpoints mutantes que tocan los 3 contadores devuelven **402
  Payment Required** con `{ trigger, used, limit }` cuando se llega al
  tope. La UI lee ese payload con el mismo formato del store local
  `usageGuard.ts::openUpgradeModal`.
- Webhook Stripe `customer.subscription.created/deleted/updated`
  actualiza `promoter_pack` server-side · el cliente solo refleja.
- Cancelar a Básico **NO purga datos** · el promotor conserva
  contactos, ventas, microsites accesibles en lectura.

---

## Archivos clave

- `src/lib/plan.ts` · modelo (`PlanState`, packs, helpers de trial,
  `TRIAL_DURATION_DAYS = 180`).
- `src/lib/usage.ts` · contadores + hook reactivo.
- `src/lib/usageGuard.ts` · `useUsageGuard()` + store del modal.
- `src/lib/usagePressure.ts` · helper para `<UsagePill>` (≥80%).
- `src/components/paywall/UpgradeModal.tsx` · modal global.
- `src/components/paywall/UsagePill.tsx` · pill ámbar header.
- `src/pages/ajustes/facturacion/plan.tsx` · esta pantalla.
- `src/pages/Planes.tsx` · página comercial · 2 secciones por
  audiencia (promotor/agencia).
- `src/components/settings/registry.ts` · `live: true`.

---

## Tracking

`paywall.shown` event se emite al abrir el modal con
`{ trigger, used, limit }`. Hoy log a `console.info`. En backend lo
toma `analytics.track()` · es la métrica clave de validación de la
Fase 1 (qué % de promotores que ven el modal hacen click en el CTA).
