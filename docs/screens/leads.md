# Pantalla · Leads (`/leads`)

## Propósito

Bandeja de entrada de potenciales compradores **sin cualificar** que
llegan al promotor desde cualquier canal (portales inmobiliarios,
microsite auto-generado, agencias colaboradoras, WhatsApp, walk-in en
oficina, llamadas). Aquí el promotor y su equipo **triagean** antes de
promover cada lead a Registro o descartarlo.

**Diferencia clave con Registros**:
- `Lead` = entrada cruda, sin cualificar. La IA de duplicados corre aquí.
- `Registro` = lead ya cualificado y ligado a cliente + promoción.

**Audiencia**: Promotor y miembros de su equipo con permiso. Agencia no
tiene `/leads` propia — las agencias generan leads al registrar clientes.

---

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Comercial (eyebrow)                                         │
│ Leads                                                       │
│ Bandeja de entrada con todos los potenciales...             │
│                                                             │
│ ┌ Total ─┐ ┌ Nuevos ┐ ┌ Cualif ┐ ┌ Dup ┐ ┌ Conv ┐         │
│ │   12   │ │   6    │ │   2    │ │  1  │ │  1  │         │
│ └────────┘ └────────┘ └────────┘ └─────┘ └─────┘         │
│                                                             │
│ [🔍 Buscar...]  [Todos][Nuevos][Cualif][Dup][Conv] [Filtros]│
├─────────────────────────────────────────────────────────────┤
│ 12 leads                      Ordenados por más reciente   │
│                                                             │
│ ┌ Lead ── Interés ── Origen ── Recibido ── Estado ── ⋮ ┐   │
│ │ 🇷🇺 Ivan Petrov · Villa Serena · Idealista · 30min ·   │   │
│ │  Nuevo · kebab                                          │   │
│ │ ...                                                     │   │
│ └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Header

- Eyebrow `COMERCIAL` · H1 "Leads" · subtítulo explicativo.
- Sin CTA primario: los leads no se crean desde aquí (llegan por
  webhooks/formularios).

---

## KPIs (5 chips)

Grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`:

| Chip | Fuente | Tono |
|---|---|---|
| Total | `leads.length` | neutral |
| Nuevos | `status === "new"` | primary |
| Cualificados | `status === "qualified"` | sky |
| Duplicados | `status === "duplicate"` | destructive |
| Convertidos | `status === "converted"` | emerald |

Cada chip: label + icono lucide + valor tabular-nums.

---

## Toolbar

- **Buscador full-width** (`h-10 rounded-full`): matchea en `fullName`,
  `email`, `phone`, `interest.promotionName`, `interest.zona`.
- **Segmentado rápido por estado** (7 opciones: Todos · Nuevos ·
  Cualificados · Contactados · Duplicados · Convertidos). Contador en
  cada pill.
- **Botón "Filtros"** (placeholder) → para filtros avanzados futuros
  (origen, nacionalidad, presupuesto, asignado, rango fechas).

---

## Tabla

Columnas (izq→der):

1. **Lead** · avatar con iniciales + bandera de nacionalidad · nombre
   · email · teléfono tabular. Si `status === "duplicate"` o
   `duplicateScore ≥ 70`, añade chip rojo **"DUP"** al lado del nombre
   con tooltip del score.
2. **Interés** · nombre de promoción + tipología/dormitorios +
   presupuesto + zona. Truncado a 240px.
3. **Origen** · pill con label (`leadSourceLabel[source]`).
4. **Recibido** · tiempo relativo (`hace 30 min`, `hace 2h`, `hace 3d`).
   Si hay `assignedTo`, línea secundaria `→ Nombre`.
5. **Estado** · chip coloreado (`leadStatusConfig[status].badgeClass`).
6. **Kebab** (3 puntos verticales) con:
   - Llamar (telemetría + `tel:` link futuro)
   - Enviar email
   - Abrir WhatsApp
   - ─────
   - Convertir a registro (deshabilitado si ya `converted`/`rejected`)
   - Descartar (destructive, deshabilitado si ya `rejected`)

Ordenación: por `createdAt` DESC (más reciente arriba). Sin paginación
en MVP (el backend la traerá con cursor).

---

## Estados

| Estado | Cuándo | Qué aparece |
|---|---|---|
| Loading | al montar (TODO) | skeleton de tabla |
| Empty · sin datos | `leads.length === 0` | icono `Inbox` + copy "Cuando lleguen leads desde portales, microsite o agencias, aparecerán aquí." |
| Empty · con filtro | `filtered.length === 0` con search o quickFilter | "Prueba con otro filtro." |
| Duplicate alert | `status === "duplicate"` | chip rojo DUP + tooltip |

---

## Datos

Mock: `src/data/leads.ts` → array `leads: Lead[]` con 12 entradas
realistas (mix de nacionalidades, orígenes, estados, promociones
`dev-1..dev-5`).

Contrato backend: `docs/backend-integration.md §7.1`.

Tipo `Lead` completo: `docs/data-model.md § Lead`.

---

## Decisiones de producto

- **Separar Leads de Registros**. Un Lead es señal, un Registro es
  cualificación. Mezclarlos confunde el triaje y oculta la métrica real
  de calidad de cada fuente.
- **IA de duplicados al entrar**, no al convertir. Detectar duplicados
  en el momento de alta del lead ahorra al equipo trabajo sobre
  contactos ya conocidos. El badge DUP es explícito para que el
  operador decida (ver ficha existente o tratar como distinto).
- **Convertir es irreversible**. Una vez `converted`, el lead queda
  archivado como traza — el `Registro` nace con referencia al `leadId`
  original para auditoría de origen.
- **Tabla antes que cards**. El caso de uso principal es triaje rápido
  por fila — la tabla da mayor densidad de info a la vista.
- **Badge "Leads" accent en sidebar**. El promotor tiene que saber
  cuántos leads nuevos esperan su revisión al entrar.

---

## TODOs al conectar backend

Todos marcados como `TODO(backend)` en `src/pages/Leads.tsx` y
`src/data/leads.ts`:

- Sustituir `import { leads }` por `useQuery(["leads", filters], ...)`.
- Handlers del kebab (hoy `toast`) deben llamar a los endpoints de §7.1.
- Botón "Filtros" debe abrir un drawer con filtros avanzados (origen,
  nacionalidad, presupuesto, asignado, rango fechas).
- Conectar el `badge` del sidebar (`AppSidebar.tsx` `badge: 24`) al
  contador real de `status="new"`.
