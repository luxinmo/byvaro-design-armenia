# Pantalla · Estadísticas de colaboradores (`/colaboradores/estadisticas`)

## Propósito

Análisis del rendimiento comercial de la red de agencias del promotor.
Responde las preguntas reales del negocio:

- ¿Qué agencia trae mejores leads (aprobación · duplicados)?
- ¿Qué agencia domina cada mercado o cada promoción?
- ¿Dónde tengo mercados sub-servidos o fragmentados?
- ¿Dónde concentrar un acuerdo exclusivo o reasignar stock?

**Audiencia:** solo Promotor.

**Entrada:** botón "Estadísticas ↗" en el header de `/colaboradores`.

---

## Qué NO mostramos (decisión explícita)

- ❌ **Volumen € / ticket medio** · el promotor vende sus propias unidades
  a precio conocido; no aporta como señal de agencia. Sustituido por
  **visitas realizadas**.
- ❌ **Trends `▲▼` vs. período anterior** · hasta que haya backend con
  histórico real, los trends serían fabricados. Los escondemos.
- ❌ **Filtro de fechas** · mismo motivo. Las matrices actuales no son
  time-series; mostrar un selector de rango sería mentir.
- ❌ **Gauges por nacionalidad** + **distribución por nación** + **lista
  de dominantes** · toda esa información ya está en el heatmap (columnas,
  ring de borde, fila Total). Eliminadas por duplicación.

---

## Layout

```
┌─ ← Colaboradores ──────────────────────────────────────────────┐
│ Red comercial · Estadísticas (eyebrow)                         │
│ Análisis de colaboradores (H1)                                 │
│ subtítulo                                      [Exportar]      │
│                                                                │
│ [Nacionalidad▾] [Promoción▾] [Colaborador▾]   · Limpiar N     │
│                                                                │
│ ┌ Regs ─┐ ┌ Visitas ┐ ┌ Ventas ┐ ┌ Conv ─┐                    │
│ │ 2.847 │ │  1.124  │ │  184   │ │ 6,5%  │                    │
│ └───────┘ └─────────┘ └────────┘ └───────┘                    │
│                                                                │
│ [ Registros ] [ Ventas ] [ Eficiencia ]  (tabs con badges)     │
├────────────────────────────────────────────────────────────────┤
│ Tab content                                                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Header + filtros + KPIs

- **Eyebrow + H1 + subtítulo** (`text-[22px] sm:text-[28px] font-bold`).
- **Exportar** pill ghost (placeholder hasta backend).
- **FilterSelect** (popover + checkbox list) · los 3 son multi-select y
  **conectados**:
  - `Nacionalidad` → filtra columnas (si dim = nacionalidad) o reduce
    totales KPI.
  - `Promoción` → filtra columnas (si dim = promoción).
  - `Colaborador` → filtra filas del heatmap.
- **4 KPIs** sin trends hasta histórico real:
  Registros · Visitas · Ventas · Conversión.

## Tabs (subrayado primary)

- **Registros** — capta y mide la calidad del lead.
- **Ventas** — embudo cerrado y operaciones firmadas.
- **Eficiencia** — ratio registro→venta + oportunidades derivadas.

---

## Anatomía por tab

### A. Insights automáticos · **derivados del subset visible**

Card con icono `Sparkles` + hasta 3 mini-cards tone `pos` / `neu` / `neg`.
**No son strings fijos** · se recalculan con los filtros. Reglas:

- **Líder absoluto** · agencia con ≥30% del total → `pos`.
- **Dominante por columna** · agencia con ≥45% de una columna → `pos` ·
  sugiere exclusiva.
- **Columna fragmentada** · ninguna agencia supera 35% pero el volumen es
  alto → `neu` · oportunidad de consolidar.
- **Tab eficiencia** · mejor agencia del subset → `pos`; peor con volumen
  alto → `neg` · revisa producto/SLA.
- Fallback `neu` si ningún patrón destaca.

### B. Heatmap agencia × eje

El eje X se conmuta con un segmented **"Por nacionalidad · Por promoción"**
en la header del panel. Un único heatmap sirve los dos ejes — no
multiplicamos superficie.

- **Filas**: agencias.
- **Columnas**: nacionalidades (bandera + ISO2) o promociones (código).
- **Celda**: valor numérico con color escalado según tone:
  - **blue** (registros) · escala `bg-primary/{5..100}` sobre max.
  - **green** (ventas) · escala `bg-emerald-{50..600}`.
  - **diverging** (eficiencia %) · rojo (<3) → ámbar (<7) → verde (≥10).
- **Dominante** por columna: `ring-2 ring-foreground`.
- **Columna Total** por fila en `bg-foreground text-background`. Para el
  tab eficiencia muestra la conversión media ponderada de la fila.
- Scroll horizontal en pantallas pequeñas.

### C. Panel complementario (varía por tab)

**Tab Registros · "Calidad de los registros"**:
- Ranking por registros totales.
- Columnas extra: **% aprobación** (verde ≥90, ámbar ≥80, rojo <80) ·
  **duplicados detectados** por la IA (neutro ≤20, ámbar ≤40, rojo >40)
  · **SLA respuesta** (horas).

**Tab Ventas · "Embudo por agencia"**:
- Registros → visitas → ventas → conversión. Un solo panel, sin gráficos
  redundantes.

**Tab Eficiencia · dos paneles en grid**:
- Ranking por conversión (con pill de color por umbral).
- **Oportunidades de mercado** · lista numerada **derivada** del subset:
  - Columnas con alta captación y conv <5% → `warn` · revisa producto.
  - Agencia × columna con eff ≥9% y pocos registros → `ok` · escala.
  - Columnas fragmentadas con mejor-convertidora ≥7% → `info` · firma
    exclusiva con esa agencia.

---

## Métricas diferenciales de Byvaro

Tres señales por agencia (globales, no por eje) que solo Byvaro puede
reportar y que son el alma del producto:

| Métrica | Fuente | Pill color |
|---|---|---|
| `aprobacionPct` | % registros del promotor con estado = `aprobado` | ≥90 verde · ≥80 ámbar · <80 rojo |
| `duplicados` | registros marcados por la **IA de duplicados** | ≤20 neutro · ≤40 ámbar · >40 rojo |
| `respuestaHoras` | media de horas desde `lead.created_at` hasta 1ª respuesta de agencia | sin umbral; solo valor |

Estas tres viven en el panel "Calidad de los registros" del tab Registros.

---

## Tokens Byvaro usados

- Superficies: `bg-card`, `bg-muted`, `bg-background`.
- Texto: `text-foreground`, `text-muted-foreground`, `text-primary`.
- Acción: `bg-primary`, `text-primary-foreground`, `bg-foreground`.
- Status: `emerald-*` (ok), `amber-*` (warn), `destructive` (bad).
- Radios: `rounded-2xl` paneles, `rounded-xl` cards compactas,
  `rounded-full` pills/chips.
- Sombra: `shadow-soft` panels, `shadow-soft-lg` hover.

---

## Datos

Hoy (MVP): mock inline con 7 agencias × 10 nacionalidades × 5 promociones.
Matrices: `REG_NAT` · `VIS_NAT` · `EFF_NAT` · `REG_PROMO` · `VIS_PROMO` ·
`EFF_PROMO`. Señales por agencia: `AGENCY_META` (aprobación, duplicados,
SLA).

Todos los insights, oportunidades y totales se calculan on-the-fly a
partir del subset filtrado.

Cuando exista backend (ver `docs/backend-integration.md` §7):

```
GET /api/colaboradores/estadisticas
  query: nationality[]=ISO2, promocion[]=id, agency[]=id
  → {
    agencies: [{ id, name, city, meta: { aprobacionPct, duplicados, respuestaHoras } }],
    nations:  [{ id, name, label }],
    promotions: [{ id, code, name, city }],
    matrices: {
      nacionalidad: { REG: {...}, VIS: {...}, EFF: {...} },
      promocion:    { REG: {...}, VIS: {...}, EFF: {...} },
    },
  }
```

Insights y oportunidades **no se piden al backend** · el frontend los
deriva. Regla: lógica de negocio en el cliente mientras los datos sean
un único payload. Si mañana hay datasets por período, migrar a endpoint
dedicado.

---

## Decisiones de producto

- **Nacionalidad y promoción como ejes duales.** Un único heatmap con
  toggle · evita duplicar superficie y enseña al promotor que ambos
  ángulos son relevantes. La nación responde a "quién trae qué comprador",
  la promoción a "quién vende qué stock".
- **Sin volumen € ni ticket.** Un promotor conoce el precio medio de su
  promoción; medirle "ticket medio de la agencia X" es ruido derivado
  del mix de promos asignadas, no una señal de rendimiento de la agencia.
  Sustituido por **visitas**, métrica operativa real.
- **3 diferenciales Byvaro en panel dedicado**: aprobación, duplicados IA,
  SLA de respuesta. No existen en ningún CRM genérico · son el valor
  añadido del producto.
- **Insights derivados** · no texto fijo. El dashboard reacciona a los
  filtros; si no lo hiciera, no serían "insights automáticos".
- **Sin trends inventados.** Mostrar `+18,4%` sin histórico real sería
  mentir. Mejor KPI desnudo hasta tener serie temporal.
- **Tokens puros** · sin hex hardcodeados. Escalas con opacity sobre
  `primary` y `emerald-*` del sistema.

---

## Recomendaciones Byvaro · APARCADO

**Estado (2026-04-22)**: el strip de recomendaciones está diseñado,
mockeado y documentado — pero **no se renderiza en la UI todavía**.

Motivo: no tenemos suficientes datos cross-tenant reales para garantizar
que cada recomendación sea **mejor que lo que ya tiene el promotor en
su red actual**. Mostrar recomendaciones mediocres sería peor que no
mostrarlas — marea al promotor y erosiona la confianza en el motor.

Lo que queda listo para reactivar:

- Componente: `src/components/collaborators/RecomendacionesStrip.tsx`
- Mock: `src/data/agencyRecommendations.ts`
- Contrato backend: `docs/backend-integration.md §4.1`
- Modelo de decisión: `DECISIONS.md · ADR-038` (casos válidos de
  recomendación, reglas de gating, modelo de negocio, popup "ver
  recomendación", coherencia).

Cuando reactivemos: importar el componente en `ColaboradoresEstadisticas.tsx`
y renderizar al cierre de la página (patrón acordado en ADR-038).

---

## TODOs al conectar backend

Marcados como `TODO(backend)` en `src/pages/ColaboradoresEstadisticas.tsx`.
Sustituir:

- `AGENCIES`, `NATIONS`, `PROMOTIONS` → del payload.
- `REG_NAT`, `VIS_NAT`, `EFF_NAT`, `REG_PROMO`, `VIS_PROMO`, `EFF_PROMO`
  → del payload.
- `AGENCY_META` → derivar en servidor desde estado de `lead.approval_status`,
  `lead.duplicate_detected_at` y `lead.first_response_at`.
