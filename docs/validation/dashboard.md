# Paywall validation · dashboard interno

> Doc operativo para revisión semanal. Toda la data sale de los 4 eventos
> ya integrados en PostHog (`src/lib/analytics.ts`). No se añade nada
> nuevo · solo se organiza y visualiza.

---

## 1 · Setup en PostHog · una vez

1. Abrir PostHog → **Dashboards** → `+ New dashboard` →
   nombre **"Paywall Validation · Phase 1"**.
2. Añadir las 3 insights de §3 (A, B, C).
3. Compartir el dashboard con el equipo (Settings → Sharing → Get link).
4. **Crear annotations** (Project settings → Annotations) cada vez que
   cambies copy/CTA/límites · permite segmentar antes/después en gráficos.

**Filtros globales del dashboard** (aplican a todas las insights):

| Filtro | Valor |
|---|---|
| `userRole` | `= "developer"` |
| `email` | `NOT contains "@byvaro.com" AND NOT contains "@luxinmo.com"` |
| `organizationId` | `!= "org1"` (excluye seed mock interno) |

PostHog → Dashboard → top-right "Apply filters to all" para que estos
filtros se hereden a las 3 insights sin replicar.

---

## 2 · Eventos disponibles · recordatorio

| Evento | Cuándo dispara | Propiedades clave |
|---|---|---|
| `paywall.shown` | `<UpgradeModal>` se abre | `trigger`, `tier`, `used`, `limit`, `route`, `userRole`, `organizationId` |
| `paywall.subscribe_clicked` | Click en CTA "Suscribirme · 249€" | idem |
| `paywall.dismissed` | Cierre vía X / Más adelante / overlay / ESC | idem |
| `usage_pill.clicked` | Click en pill ámbar header (≥80%) | idem · `trigger` siempre = `"near_limit"` |

---

## 3 · Las 3 vistas del dashboard

### A · Global conversion

**Tipo**: Funnel insight
**Propósito**: la métrica primaria de validación.

Configuración exacta:

| Campo | Valor |
|---|---|
| Step 1 | `paywall.shown` |
| Step 2 | `paywall.subscribe_clicked` |
| Conversion window | `1 hour` |
| Match users by | `distinct_id` (default) |
| Order | `Sequential` |
| Aggregation | `Unique users` (no eventos) |
| Date range | `Last 14 days` |
| Breakdown | (ninguno · global) |

**Output**:
- % conversion (Step 2 / Step 1).
- N usuarios únicos en Step 1 (denominador).
- N usuarios únicos en Step 2 (numerador).

**HogQL alternativo** (si prefieres consulta SQL · PostHog → SQL editor):

```sql
SELECT
  count(distinct case when event = 'paywall.shown' then person_id end)        AS users_shown,
  count(distinct case when event = 'paywall.subscribe_clicked' then person_id end) AS users_subscribed,
  round(
    count(distinct case when event = 'paywall.subscribe_clicked' then person_id end)
    / nullif(count(distinct case when event = 'paywall.shown' then person_id end), 0)
    * 100, 1
  ) AS conversion_pct
FROM events
WHERE event IN ('paywall.shown', 'paywall.subscribe_clicked')
  AND properties.userRole = 'developer'
  AND timestamp > now() - INTERVAL 14 DAY
  AND properties.email NOT LIKE '%@byvaro.com'
  AND properties.email NOT LIKE '%@luxinmo.com'
```

---

### B · Conversion by trigger

**Tipo**: Funnel insight con breakdown
**Propósito**: identificar qué momento del producto convierte mejor.

Configuración exacta:

| Campo | Valor |
|---|---|
| Step 1 | `paywall.shown` |
| Step 2 | `paywall.subscribe_clicked` |
| Conversion window | `1 hour` |
| Aggregation | `Unique users` |
| Date range | `Last 14 days` |
| **Breakdown** | `Event property: trigger` |

**Output esperado** (4 filas, una por trigger):

| Trigger | Users in step 1 | Users in step 2 | Conversion % |
|---|---:|---:|---:|
| `createPromotion` | … | … | …% |
| `inviteAgency` | … | … | …% |
| `acceptRegistro` | … | … | …% |
| `near_limit` | … | … | …% |

**Lectura** (ver §5 para decisión):
- Trigger con conversión más alta = momento de mayor willingness-to-pay.
- Si solo 1 trigger convierte, el valor del producto está concentrado ahí.
- Si todos convierten parejo (rango ±5pp), la oferta es robusta.

**HogQL alternativo**:

```sql
SELECT
  properties.trigger AS trigger,
  count(distinct case when event = 'paywall.shown' then person_id end)        AS shown,
  count(distinct case when event = 'paywall.subscribe_clicked' then person_id end) AS subscribed,
  round(
    count(distinct case when event = 'paywall.subscribe_clicked' then person_id end)
    / nullif(count(distinct case when event = 'paywall.shown' then person_id end), 0)
    * 100, 1
  ) AS conversion_pct
FROM events
WHERE event IN ('paywall.shown', 'paywall.subscribe_clicked')
  AND properties.userRole = 'developer'
  AND timestamp > now() - INTERVAL 14 DAY
GROUP BY properties.trigger
ORDER BY conversion_pct DESC
```

**Bonus · breakdown adicional por route** · misma config con
`Breakdown = Event property: route`:

| Route | Lectura |
|---|---|
| `/registros` | gate `acceptRegistro` activo · usuario en flujo de leads |
| `/promociones`, `/crear-promocion` | gate `createPromotion` |
| `/colaboradores`, `/empresa/*` | gate `inviteAgency` |
| `/inicio`, `/ajustes/*` | click del pill desde nav |

Si la conversión varía mucho por route → contexto importa · iterar copy
específico por trigger (ver `paywall-validation.md §3.5`).

---

### C · Weekly trend

**Tipo**: Trends insight (línea temporal)
**Propósito**: ver evolución y detectar tendencias / efectos de cambios.

Configuración exacta:

| Campo | Valor |
|---|---|
| Series 1 | `paywall.shown` · Aggregation `Unique users` |
| Series 2 | `paywall.subscribe_clicked` · Aggregation `Unique users` |
| Series 3 (formula) | `B / A * 100` (conversion %) |
| Date range | `Last 8 weeks` |
| Interval | `Week` |
| Y-axis | dual: usuarios (left), conversion % (right) |

PostHog soporta "Formulas" en Trends (toggle "Show as formula"). Definir
`A = paywall.shown` y `B = paywall.subscribe_clicked`, formula
`B/A*100` con label "Conversion %".

**Lectura**:
- Línea de `paywall.shown` (volumen) debe crecer o ser estable.
  - Si cae → menos promotores llegan al límite (los límites son demasiado
    generosos o el producto no se usa lo suficiente).
- Línea de conversion % debe ser estable o creciente.
  - Si fluctúa mucho semana a semana → n insuficiente · esperar más volumen
    antes de leer.
  - Si baja tras un cambio anotado → el cambio empeoró las cosas · revertir.

**HogQL alternativo · series temporal por semana**:

```sql
SELECT
  date_trunc('week', timestamp) AS week,
  count(distinct case when event = 'paywall.shown' then person_id end)        AS shown,
  count(distinct case when event = 'paywall.subscribe_clicked' then person_id end) AS subscribed,
  round(
    count(distinct case when event = 'paywall.subscribe_clicked' then person_id end)
    / nullif(count(distinct case when event = 'paywall.shown' then person_id end), 0)
    * 100, 1
  ) AS conversion_pct
FROM events
WHERE event IN ('paywall.shown', 'paywall.subscribe_clicked')
  AND properties.userRole = 'developer'
  AND timestamp > now() - INTERVAL 8 WEEK
GROUP BY week
ORDER BY week DESC
```

---

## 4 · Indicador de decisión · banner principal

PostHog soporta **insights tipo "Big Number"** (Insight → Display →
Number). Crear uno con esta lógica · si HogQL no es práctico, usa la
tabla del paso A y compara mentalmente:

| Conversion rate global (n ≥ 30) | Estado | Acción |
|---|---|---|
| **≥ 30%** | 🟢 Strong signal · build backend | Arrancar Phase 1B inmediatamente. Spec en `docs/backend-integration.md §12`. |
| **20-30%** | 🟢 Valid · proceed to backend | Arrancar Phase 1B. ROI confirmado. |
| **10-20%** | 🟡 Iterate UX/copy | Aplicar UNA optimización de `paywall-validation.md §5`. Anotar fecha en PostHog. Re-medir 14 días. |
| **5-10%** | 🟠 Iterate hard | Revisar copy + entrevistar 5-10 promotores que vieron y no convirtieron. |
| **< 5%** | 🔴 Problem · review model | Revisar ICP / pricing / propuesta de valor antes de seguir. |
| **n < 30** | ⚪ Insufficient data | NO mostrar conversion · esperar más volumen. |

**Cómo crear el banner en PostHog**:

1. New insight → Type "Number".
2. Series: `paywall.subscribe_clicked` / `paywall.shown` (use formula).
3. Conditional formatting (Beta) o simplemente leer el número y aplicar
   la tabla mentalmente cada lunes.
4. Pin al top del dashboard.

**Si quieres automatizar el indicador con HogQL** (PostHog Cloud):

```sql
WITH metrics AS (
  SELECT
    count(distinct case when event = 'paywall.shown' then person_id end) AS users_shown,
    count(distinct case when event = 'paywall.subscribe_clicked' then person_id end) AS users_subscribed
  FROM events
  WHERE event IN ('paywall.shown', 'paywall.subscribe_clicked')
    AND properties.userRole = 'developer'
    AND timestamp > now() - INTERVAL 14 DAY
)
SELECT
  users_shown,
  users_subscribed,
  CASE
    WHEN users_shown < 30 THEN 'Insufficient data'
    WHEN users_subscribed * 100 / users_shown >= 30 THEN 'Strong signal · build backend'
    WHEN users_subscribed * 100 / users_shown >= 20 THEN 'Valid · proceed to backend'
    WHEN users_subscribed * 100 / users_shown >= 10 THEN 'Iterate UX/copy'
    WHEN users_subscribed * 100 / users_shown >= 5  THEN 'Iterate hard'
    ELSE 'Problem · review model'
  END AS verdict,
  round(users_subscribed * 100.0 / nullif(users_shown, 0), 1) AS conversion_pct
FROM metrics
```

---

## 5 · Minimum data requirement

**No tomar decisiones hasta tener n ≥ 30 usuarios únicos en `paywall.shown`**
durante la ventana analizada.

Razón: con n=30 y conversion observada del 25%, el intervalo de
confianza al 95% es ~±15pp · cualquier decisión por debajo es ruido.
Con n=100 baja a ~±9pp · la métrica es estable.

| n | Calidad de la métrica |
|---|---|
| < 30 | Solo orientativa · NO decidir |
| 30-100 | Direccional · decisión preliminar |
| 100+ | Confianza alta para tomar decisión definitiva |

**Si la ventana de 14 días no llega a 30 usuarios**:
- Ampliar la ventana a 30 días.
- Si tampoco llega → el problema es de **adquisición**, no de paywall ·
  prioridad cambia (atraer promotores) y la validación queda en pausa.

---

## 6 · Cómo interpretar · guía rápida del lunes

Cada lunes, 5 minutos:

1. **Abrir el dashboard** "Paywall Validation · Phase 1".
2. **Vista A** · ¿n ≥ 30?
   - **No** → cerrar dashboard. Volver el siguiente lunes.
   - **Sí** → continuar.
3. **Leer conversion %** y aplicar tabla §4.
4. **Vista B** · ¿qué trigger convierte mejor?
   - Si solo `acceptRegistro` convierte → el detector de duplicados es
     el valor real · enfocar copy/CTAs ahí.
   - Si todos parejo → producto sólido en general.
5. **Vista C** · ¿la línea sube, baja o es estable?
   - Subiendo → mantener curso.
   - Bajando tras un cambio (annotation) → revertir el cambio.
   - Estable → si está en rango 🟢, arrancar backend · si está en 🟡,
     aplicar UNA optimización de `paywall-validation.md §5`.
6. **Anotar la decisión** del lunes en el dashboard description o un
   doc compartido. Permite rastrear la evolución del razonamiento.

---

## 7 · Cuándo este dashboard deja de ser útil

Cuando se cumpla la condición de arranque del backend (≥20% sostenido
14 días con n ≥ 30):

- El dashboard sigue activo durante el desarrollo del backend Phase 1B
  como baseline.
- Cuando Stripe esté en vivo, **añadir un nuevo evento** `paywall.payment_completed`
  (no existe hoy) y rehacer el funnel · esa nueva ratio (`completed / clicked`)
  mide la conversión real con tarjeta.
- El gap entre `subscribe_clicked` (mock) y `payment_completed` (Stripe
  real) es la fricción del paso de pago. Industry standard: 30-50% de
  drop-off.

Hasta entonces: este dashboard es la única fuente de verdad para
decidir si construir backend.

---

## Referencias

- `docs/validation/paywall-validation.md` · spec completa de la fase, eventos, umbrales.
- `src/lib/analytics.ts` · API que emite los eventos.
- `src/components/paywall/UpgradeModal.tsx` · `paywall.shown / dismissed / subscribe_clicked`.
- `src/components/paywall/UsagePill.tsx` · `usage_pill.clicked`.
- PostHog dashboard URL: (rellenar tras crearlo).
