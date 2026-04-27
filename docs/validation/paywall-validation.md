# Paywall validation · Phase 1A

> **Estado**: prototype frontend en producción · backend NO implementado.
> Estamos midiendo si los promotores muestran disposición a pagar 249€/mes
> antes de invertir ~6 días de trabajo backend.

---

## 1 · Qué se valida

**Hipótesis**: los promotores que llegan al límite del plan trial harán click
en el CTA "Suscribirme · 249€/mes" en una proporción suficiente para
justificar la implementación del backend Phase 1B (Stripe + enforcement
real).

**Lo que NO se valida en esta fase**:
- Procesamiento real de pagos (sigue mockeado vía `subscribeToPromoter249()`).
- Enforcement server-side (los gates son cliente · advisory).
- Multi-org real (todos los promotores comparten el seed mock).

---

## 2 · Eventos tracked

Los 4 eventos canónicos viven en `src/lib/analytics.ts` y se emiten desde:

| Evento | Origen | Cuándo |
|---|---|---|
| `paywall.shown` | `<UpgradeModal>` `useEffect` | El modal pasa a `open=true`. |
| `paywall.subscribe_clicked` | `<UpgradeModal>::handleSubscribe` | Click en "Suscribirme · 249€/mes". |
| `paywall.dismissed` | `<UpgradeModal>::handleDismiss` | Cierre vía X, "Más adelante", overlay click, ESC. |
| `usage_pill.clicked` | `<UsagePill>::handleClick` | Click en el pill ámbar del header. |

### Payload

Cada evento carga el siguiente shape:

```ts
{
  trigger: "createPromotion" | "inviteAgency" | "acceptRegistro" | "near_limit",
  tier: "trial" | "promoter_249",
  used: number,
  limit: number,
  route: string,           // window.location.pathname al disparar
  userRole: string,        // "developer" | "agency" | "viewer"
  organizationId: string,  // currentUser.organizationId (mock hoy)
  timestamp: string,       // ISO 8601
}
```

### Despacho

`src/lib/analytics.ts::track()` envía el evento a:

1. **`console.info`** · siempre · útil en dev y para verificación rápida en
   producción sin abrir un dashboard externo.
2. **`window.posthog.capture()`** · solo si el snippet de PostHog está
   cargado. Si la app no inicializa PostHog, esta llamada se omite
   silenciosamente.

**TODO(backend/analytics)**: cuando se decida proveedor (PostHog,
Plausible o endpoint propio), conectar en `track()`. La firma pública
(`track()`, `usePaywallAnalytics()`) NO debe cambiar para no tocar los
call sites.

---

## 3 · Cómo cablear PostHog (snippet ya integrado)

El snippet **ya está integrado** en `index.html` con la API key como
placeholder. Solo falta sustituir la key:

1. Crear proyecto en posthog.com (free tier basta para Phase 1A).
2. Copiar el "Project API Key" desde
   `https://app.posthog.com/project/settings`.
   ⚠️ NO la personal API key · es la del proyecto.
3. En `index.html`, sustituir literal `POSTHOG_API_KEY_PLACEHOLDER` por la
   key real (típicamente `phc_...`).
4. Recargar la app · `track()` ya envía a PostHog automáticamente · sin
   tocar `src/lib/analytics.ts`.
5. En PostHog · crear funnel:
   - Step 1 · `paywall.shown`
   - Step 2 · `paywall.subscribe_clicked`

   El % entre steps = conversion rate del paywall.

**Verificar que funciona:**
- DevTools → Console → `window.posthog` debe existir.
- DevTools → Network → filtrar por `posthog.com` · al disparar un evento
  ves un POST a `/e/` (con la key real) o un 401 (con el placeholder).
- En PostHog · Activity feed muestra eventos al minuto.

**Configuración aplicada en el snippet:**
- `api_host: "https://app.posthog.com"` (US cloud).
- `capture_pageview: true` · cambios de ruta como evento estándar.
- `disable_session_recording: true` · privacidad por defecto en validación.
- `respect_dnt: true` · ignora usuarios con Do-Not-Track activo.

---

## 4 · Métricas de éxito

### Métrica primaria

**`% subscribe_clicked / paywall.shown`** segmentado por:
- `trigger` (qué gate convierte mejor: createPromotion vs inviteAgency vs acceptRegistro vs near_limit)
- `userRole` (filtrar `userRole = "developer"` · solo promotores cuentan en Fase 1)
- Tiempo (ventana 14-30 días para tener volumen)

### Umbrales de decisión

| Conversion rate | Decisión |
|---|---|
| **≥ 30%** | Señal fuerte · arrancar backend Phase 1B inmediatamente. |
| **20-30%** | Señal positiva · arrancar backend Phase 1B. La oferta funciona. |
| **10-20%** | Señal débil · iterar copy del modal, ajustar límites (ej. 1/3/25 más restrictivo, o 3/10/60 más generoso) y volver a medir. NO arrancar backend aún. |
| **< 10%** | Hipótesis no validada · revisar ICP, propuesta de valor o pricing antes de seguir. |

### Métricas secundarias

- **Time-to-paywall** · tiempo desde signup hasta primer `paywall.shown`.
  Si es muy bajo (<1 día) los límites son demasiado restrictivos · el
  promotor no llega a sentir valor. Si es muy alto (>14 días) puede que
  no esté usando el producto.
- **Trigger más eficaz** · qué `trigger` correlaciona con más
  `subscribe_clicked`. Si solo `acceptRegistro` convierte, el valor está
  en el flujo de leads · doblar ahí.
- **Bounce rate del pill** · `usage_pill.clicked` que NO acaban en
  `subscribe_clicked` · si es alto, el modal no convence · iterar copy.

---

## 5 · Cómo leer los resultados

### En console (verificación local)

Abre DevTools → Console → filtra por `[analytics]`. Verás líneas como:

```
[analytics] paywall.shown { trigger: "acceptRegistro", tier: "trial", used: 40, limit: 40, route: "/registros", userRole: "developer", organizationId: "org1", timestamp: "..." }
```

Útil para verificar que los eventos se disparan correctamente y el payload
es completo. No sirve para tomar decisiones de producto · solo dev.

### En PostHog (producción)

1. **Insights → Funnels** · crear funnel `paywall.shown → subscribe_clicked`.
   Filter `userRole = "developer"`. Step gap 1 hora máximo.
2. **Insights → Trends** · gráfico diario de `paywall.shown` count para
   ver volumen y detectar cambios bruscos.
3. **Insights → Breakdown** · `paywall.shown` agrupado por `trigger` para
   ver qué gate dispara más.
4. **Recordings** (opcional) · grabar sesiones que hagan
   `paywall.subscribe_clicked` para entender el flujo cualitativo.

---

## 6 · Cuándo empezar el backend

Arranca **Phase 1B (backend real)** cuando se cumplan AMBAS condiciones:

1. **Conversion ≥ 20%** sostenido durante al menos 14 días con un mínimo
   de 30 `paywall.shown` (volumen mínimo para que la métrica sea estable).
2. **Al menos un `subscribe_clicked` por trigger** distinto · si solo
   convierte un trigger, podríamos enfocarnos en ese sin necesidad de
   los otros gates.

Cuando empieces el backend, sigue:
- `docs/backend-integration.md §12` · contrato completo (DDL, endpoints,
  Stripe, webhooks).
- Migration plan A→E · 5 fases incrementales sin romper el frontend.

**No arranques antes** aunque tengas tiempo · es prematuro y desperdicia
trabajo si la hipótesis falla.

---

## 7 · Qué NO hacer durante la validación

- ❌ Modificar los límites trial sin documentarlo · falsea la métrica.
- ❌ Cambiar el copy del `<UpgradeModal>` sin marcarlo como cohorte
  separada en PostHog · pierdes comparabilidad.
- ❌ Bypass del paywall para "tests internos" sin filtrar por email
  interno en analytics · contamina la métrica.
- ❌ Confundir `paywall.dismissed` con "no le interesa" · dismiss puede
  ser "ahora no, mañana sí". El que cuenta es la **ratio shown→clicked**.
- ❌ Empezar a desarrollar Stripe en paralelo "por si acaso" · trabajo
  perdido si la conversión es baja.

---

## 8 · Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| `console.info` no llega a producto en producción · solo PostHog | Asegurar que el snippet PostHog está cargado antes de hacer release. Verificar con `console.info` local. |
| Usuarios internos disparan eventos y falsean la métrica | Filtrar en PostHog por `email NOT LIKE '%@byvaro.com'` y `email NOT LIKE '%@luxinmo.com'`. |
| Volúmenes bajos (< 30 events) → métrica ruidosa | Esperar a tener volumen antes de tomar decisiones. 14 días mínimo. |
| `paywall.dismissed` se dispara doble (X + ESC + overlay click) | El singleton store cierra una vez · pero el effect del modal podría re-emitir. Verificar que solo un `dismissed` por sesión modal. |
| Cliente bloquea analytics (adblock, DNT) | Aceptarlo · es ruido sistemático que no afecta la ratio relativa. |
| Usuario manipula `localStorage.byvaro.plan.v1='promoter_249'` para saltarse el modal | No corrompe la validación · si nunca lo ven, no aparecen en la cohorte. Es un edge case marginal en Fase 1A. |

---

## 9 · Referencias

- `src/lib/analytics.ts` · API pública del tracking.
- `src/components/paywall/UpgradeModal.tsx` · 3 eventos.
- `src/components/paywall/UsagePill.tsx` · `usage_pill.clicked`.
- `src/lib/usageGuard.ts` · setter del modal (sin tracking · lo hace el modal).
- `docs/backend-integration.md §12` · spec del backend Phase 1B.
- `DECISIONS.md` ADR-058 · paywall Phase 1.
