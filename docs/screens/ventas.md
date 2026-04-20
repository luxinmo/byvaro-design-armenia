# Pantalla · Ventas (`/ventas`)

> **Estado:** Implementación funcional con mocks (Fase 1). Sin backend.
> **Archivo:** `src/pages/Ventas.tsx`
> **Datos:** `src/data/sales.ts`

## Propósito

Panel donde el **promotor** gestiona el pipeline de formalización de
operaciones — desde la reserva firmada hasta la escritura pública —, con
visibilidad de comisiones pendientes a agencias colaboradoras.

No es un CRM de leads (eso vive en `/registros`) ni un análisis profundo
Agencia×Nacionalidad (eso vive en `/colaboradores`). **Ventas es el
pipeline post-aprobación**: una vez que un registro se aprueba y el cliente
firma reserva, aquí se trackea hasta escriturar.

**Audiencia:** Promotor. Fase 2 puede añadir un `agencyMode` read-only para
que la agencia vea las ventas propias en las promociones donde colabora.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ COMERCIAL                                       [Kanban · Tabla]│
│ Ventas                                                          │
│ 22 operaciones · 890.000€ escrituradas este mes                │
├─────────────────────────────────────────────────────────────────┤
│ [KPI Reservas] [KPI Contratos] [KPI Escrituras] [KPI Comisiones]│
├─────────────────────────────────────────────────────────────────┤
│ [Buscar..] [Promoción▼] [Estado▼] [Fechas▼]    Limpiar  22 res. │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────┬─────────┬─────────┬─────────┐                       │
│ │Reservada│Contratada│Escriturada│ Caída  │                     │
│ │  7 · 4M │ 6 · 4.1M│ 6 · 3.7M │ 3 · 2.2M│                      │
│ │ ─────── │ ─────── │ ─────── │ ─────── │                       │
│ │ [Card]  │ [Card]  │ [Card]  │ [Card]  │                       │
│ │ [Card]  │ [Card]  │ [Card]  │ [Card]  │                       │
│ │ ...     │ ...     │ ...     │ ...     │                       │
│ └─────────┴─────────┴─────────┴─────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

En **móvil** (<1024px) el kanban se convierte en 4 secciones apiladas
colapsables con total de operaciones + valor en cartera al plegarse.

## Elementos

### Header

- Eyebrow `COMERCIAL` + H1 `Ventas`
- Subtítulo tnum: `N operaciones · EUR escrituradas este mes`
- Toggle pill `Kanban / Tabla` (patrón `ViewToggleBtn` — mismo espíritu que
  en `Promociones`).

### 4 KPI cards (`KpiCard`)

| Icono | Label | Valor | Delta | Sub |
|---|---|---|---|---|
| `ClipboardCheck` (primary) | Reservas activas | `nº` | — | `€ en señales` |
| `FileSignature` (violet) | Contratos del mes | `€` | % vs mes anterior | `nº operaciones` |
| `KeyRound` (emerald) | Escrituradas del mes | `€` | % vs mes anterior | `nº entregas` |
| `Wallet` (amber) | Comisiones pendientes | `€` | `X al día` | `nº por liquidar` |

Delta tone positivo/negativo automático según signo. Formato corto
`1.2M€ / 340K€` para ahorrar espacio.

### Filter bar

Pills inline (no drawer, al ser menos filtros que en Promociones):

- **Búsqueda textual**: cliente, unidad, agencia, promoción
- **Promoción** (multi-select) — opciones dinámicas solo con ventas
- **Estado** (multi-select) — `reservada / contratada / escriturada / caida`
- **Rango de fechas** — `desde / hasta`, aplica sobre `getFechaReferencia(v)`
  (la fecha "principal" del estado actual)
- Contador de filtros activos + `Limpiar` inline si hay alguno
- Contador de resultados a la derecha

**Patrón**: los pills cambian a `bg-foreground text-background` cuando hay
selección (mismo patrón que `Promociones` → `MultiSelectDropdown`).

### Kanban (default)

- 4 columnas `rounded-2xl` en grid `lg:grid-cols-4`, cada una con su color
  semántico de fondo sutil (`/0.03 /0.20` border+bg).
- Header de columna: icono + label + contador + total `€` en cartera.
- Scroll vertical interno: `max-h-[calc(100vh-420px)]`.
- Cards compactas con cliente, promoción + unidad, agencia y precio corto.
- `hover:-translate-y-0.5 shadow-soft-lg` + `active:scale-[0.99]` para
  sensación "arrastrable" **sin drag real** (fuera de alcance Fase 1).

### Tabla (vista alternativa)

Columnas sortables (`ChevronDown` activo en la actual):
`Cliente · Promoción · Unidad · Agencia · Estado · Fecha · Precio · Comisión`.

- Click en fila abre el diálogo (como el kanban).
- Estado como chip con dot + color semántico.
- Columna "Precio" muestra descuento debajo si existe.
- Columna "Comisión" muestra `%` + `Pagada/Pendiente`.

### Diálogo de detalle

Abre al hacer click en cualquier card/fila. Secciones:

1. **Header**: icono del estado + cliente + chip estado + promoción/unidad.
2. **Summary boxes**: Precio final (con listado y descuento) / Comisión
   (importe, % y Pagada/Pendiente) / Método pago (con señal).
3. **Timeline**: Reserva → Contrato privado → Escritura pública. Si
   `estado === caida`, se añade un bloque de "Operación caída" al final.
4. **Cliente**: nombre, email, teléfono, nacionalidad.
5. **Unidad**: promoción + ubicación + identificador + código.
6. **Agencia**: si hay agencyId, ficha con logo + ubicación + agente + tipo.
   Si no, mensaje "Venta directa" + responsable.
7. **Historial de pagos**: lista de objetos `{fecha, concepto, importe}`.
   Importes negativos (devoluciones) se pintan en `text-destructive`.
8. **Siguiente paso** (si hay y no está caída): bloque primary con `Hammer`.
9. **Nota** (si existe): bloque muted con `AlertTriangle`.

Footer de acciones (pill buttons):
- `Marcar contrato` (solo si estado actual = reservada)
- `Marcar escritura` (si estado ∈ {reservada, contratada})
- `Marcar caída` (si estado ∈ {reservada, contratada})
- `Comisión pagada` (si `comisionPct > 0` y `!comisionPagada`)

Cada acción dispara `onTransition()` / `onMarkCommissionPaid()` que en el
mock actualizan estado local + toast con sonner.

## Flujo de transiciones

```
         ┌───────────┐
         │ reservada │
         └─────┬─────┘
               │ Marcar contrato
               ▼
         ┌───────────┐      Marcar caída
         │contratada │─────────────┐
         └─────┬─────┘             │
               │ Marcar escritura  │
               ▼                   ▼
        ┌────────────┐      ┌──────────┐
        │escriturada │      │  caida   │  (desde reservada o contratada)
        └────────────┘      └──────────┘
              (final)           (final)
```

Al transicionar:
- `reservada → contratada`: se fija `fechaContrato = today`.
- `contratada → escriturada` (o `reservada → escriturada` atajo): se fija
  `fechaEscritura = today` (y `fechaContrato` si faltaba).
- `X → caida`: se fija `fechaCaida = today`.

Estados finales (`escriturada`, `caida`) no permiten más transiciones en
este mock. En backend podríamos modelar "reabrir una caída" como nueva
venta enlazada, fuera de alcance Fase 1.

## Cálculo de comisión

```
comisionImporte = Math.round(precioFinal * comisionPct / 100)
```

Ver helper `getComisionImporte()` en `src/data/sales.ts`.

> **Pendiente (Qnueva):** queda por decidir si la base es con IVA o sin
> IVA, y si los hitos parciales de `collaboration.hitosComision` afectan al
> flag `comisionPagada` (booleano) o requieren un modelo de `Pago[]` con
> estados independientes. Ver `docs/open-questions.md · Q23`.

## Interacción con otros módulos

- **Registros** (`/registros`): cada venta tiene `registroId` que apunta al
  registro aprobado que la originó. En UI futura, enlace cruzado desde el
  diálogo hacia el registro (una vez la pantalla `Registros` exista con
  routing por id).
- **Promociones** (`/promociones/:id`): las ventas de una promoción
  aparecerán en el tab "Unidades" del detalle (ya existe con otros mocks).
  Consolidar en Fase 2.
- **Colaboradores** (`/colaboradores`): la analítica profunda Agencia ×
  Nacionalidad se alimenta del volumen agregado de `sales.filter(estado ===
  "escriturada")`. En Fase 2 se expone como vista derivada.
- **Contactos** (`/contactos`): cliente de cada venta pasa a contacto
  permanente del promotor tras escriturar (pipeline de post-venta,
  fuera de alcance Fase 1).

## Endpoints esperados (contract-first)

```
GET /api/sales
  query:
    q?: string                     // texto libre: cliente/unidad/agencia/promoción
    promotionId?: string[]         // multi
    status?: VentaEstado[]         // multi
    from?: ISOdate                 // filtro por getFechaReferencia
    to?: ISOdate
    sort?: "fechaReserva" | "precioFinal" | "comision" | "clienteNombre"
    dir?: "asc" | "desc"
  response: { sales: Venta[]; total: number }

GET /api/sales/:id
  response: Venta

PATCH /api/sales/:id/transition
  body: { to: "contratada" | "escriturada" | "caida"; meta?: {
    fechaContrato?: ISOdate; fechaEscritura?: ISOdate; fechaCaida?: ISOdate;
    nota?: string;
  }}
  response: Venta

PATCH /api/sales/:id/commission-paid
  body: { paid: boolean; pagadaAt?: ISOdate }
  response: Venta

POST /api/sales
  (normalmente no se crea manualmente; se origina al aprobar un registro:
   POST /api/registros/:id/approve genera la venta "reservada")
```

Ver `docs/api-contract.md` para el catálogo completo.

## Responsive

- **375px**: filter pills hacen wrap en varias líneas. Kanban → secciones
  colapsables apiladas.
- **640px (sm)**: toggle Kanban/Tabla sube a la derecha del H1.
- **1024px (lg)**: aparece el kanban real en 4 columnas.
- **1400px (2xl)**: max-width del contenedor, sin cambios mayores.

## Tokens y reglas aplicadas

- Cards: `rounded-2xl border border-border shadow-soft`.
- Warnings: `rounded-xl bg-*/5 border border-*/20` (siempre con color
  semántico HSL, nunca hex).
- Botones primarios: `bg-foreground text-background rounded-full h-9 px-4`.
- Chips de estado: `rounded-full h-6 px-2.5 border text-[11px] font-semibold`
  con dot `1.5×1.5` a la izquierda.
- Iconos Lucide: `h-3.5 w-3.5` en botones, `h-4 w-4` en KPIs, `h-5 w-5` en
  el header del diálogo.
- Fechas formateadas con `date-fns` locale `es`.

## Limitaciones conocidas (Fase 1)

- **Sin drag real**. El kanban visualmente insinúa drag pero no reordena —
  la transición ocurre desde el diálogo. Si se quiere DnD en el futuro,
  evaluar `@dnd-kit/core` (ya validado por Linear/Attio).
- **Sin paginación**. 20-25 ventas caben en memoria; con >200 se añade
  virtualización (ver `@tanstack/react-virtual`) o paginación server-side.
- **Sin bulk actions**. Seleccionar varias ventas y marcar transición en
  masa se postpone hasta validar workflow con usuarios reales.
- **Sin export**. Por regla Byvaro (`CLAUDE.md`), no hay botón "Exportar
  Excel" hasta que el promotor lo pida explícitamente.
