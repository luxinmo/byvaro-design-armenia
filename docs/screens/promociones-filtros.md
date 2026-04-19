# Sistema de filtros · Promociones

Spec funcional detallado del sistema de filtros de `/promociones`. Sirve
como contrato para que cualquier dev (humano o IA) pueda implementar el
backend y replicar la lógica sin ambigüedad.

## Layout general

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
│  Comercial                                                      │
│  Promociones                   [🔍 Buscador ] [⚙ Filtros (N)] [+ Nueva]
├─────────────────────────────────────────────────────────────────┤
│ TOOLBAR                                                         │
│  Todas · Activas · Incompletas · Vendidas                       │
│                        13 res. · Ordenar por Recientes ↓ · [Lista│Cuad│Mapa]
├─────────────────────────────────────────────────────────────────┤
│ CONTENIDO (según viewMode)                                      │
│  Lista: cards horizontales 550×400                              │
│  Cuadrícula: grid 1/2/3 cols con PromoCardCompact               │
│  Mapa: Leaflet + sidebar con lista                              │
└─────────────────────────────────────────────────────────────────┘

DRAWER DE FILTROS (slide desde derecha al pulsar "Filtros")
  Backdrop blur + black/25%
  ├ Gestión
  │   ├ Actividad       (multi)   Nueva · Últimas unidades · Demanda alta · Sin actividad
  │   ├ Colaboración    (multi)   Con agencias · Sin agencias
  │   └ Agencia esp.    [search]  solo si "Con agencias" seleccionado
  ├────────────────────────────────
  └ Búsqueda avanzada
      ├ Ubicación       [search]  lista buscable (zonas derivadas de los datos)
      ├ Tipología       (multi)   Apartamentos · Villas · Adosados · Áticos…
      ├ Edificio        (single)  Unifamiliar · Plurifamiliar · Mixto
      ├ Precio          [min/max] inputs numéricos formato 500.000 €
      ├ Dormitorios     (radio)   1+ · 2+ · 3+ · 4+ hab (umbral mínimo)
      ├ Entrega         (multi)   Inmediata · 2025 · 2026 · 2027…
      └ Comisión        (multi)   3%+ · 4%+ · 5%+
```

## Reglas semánticas de cada filtro

### Actividad

Multi-select. Una promoción pasa si cumple **al menos uno** de los
seleccionados:

| value | Predicado |
|---|---|
| `new` | `promo.badge === "new"` |
| `last-units` | `promo.badge === "last-units"` |
| `high-demand` | `promo.activity.inquiries >= 20` |
| `inactive` | `promo.activity.inquiries === 0 && promo.activity.visits === 0` |

### Colaboración

Multi-select. `n = promo.agencies`:

| value | Predicado |
|---|---|
| `with-agencies` | `n >= 1` |
| `without` | `n === 0` |

### Agencia específica

Single-select. **Solo se muestra si `collabFilter.includes("with-agencies")`**.
Buscador sobre `agencies[]` (nombre y ubicación). Al seleccionar, fija
`agencyFilter = agencyId`.

Predicado:
```
const ag = agencies.find(a => a.id === agencyFilter);
return ag.promotionsCollaborating.includes(promo.id);
```

En producción:
- `GET /api/v1/promotions/:id/collaborating-agencies` — agencias que
  colaboran en esa promoción
- `GET /api/v1/agencies?search=...` — buscador en el drawer

### Ubicación

Multi-select buscable. Las opciones se derivan dinámicamente de
`allPromotions.map(p => getZone(p.location))`. `getZone` extrae la parte
después de la coma (ej. `"Marbella, Costa del Sol"` → `"Costa del Sol"`).

Predicado:
```
selectedLocations.includes(getZone(promo.location))
```

En producción: el backend debería normalizar zonas (Costa del Sol,
Costa Blanca, Baleares…) y devolver el listado en `GET /api/v1/promotions/zones`.

### Tipología (property types)

Multi-select. Opciones dinámicas desde `propertyTypes[]` de cada promoción
(traducidas al español: `Apartments → Apartamentos`, etc.).

Predicado: `selectedTypes.some(t => promo.propertyTypes.includes(t))`.

### Edificio

Single-select (no multi). Valores `"Unifamiliar" | "Plurifamiliar" | "Mixto"`.
El state interno es `"All"` cuando no hay filtro.

Predicado (`matchesBuildingType` helper):
- `Unifamiliar`: `buildingType === "unifamiliar-single" || "unifamiliar-multiple"`
- `Plurifamiliar`: `buildingType === "plurifamiliar"`
- `Mixto`: `buildingType === "mixto"`

### Precio

**Inputs numéricos min/max**. Formato español con separador de miles
(`500.000`). Al escribir, se parsea como número. Símbolo `€` fijo a la
derecha.

State: `priceMin: number | null`, `priceMax: number | null`.

Predicados (ambos se aplican si están presentes):
- Si `priceMin !== null`: `promo.priceMax >= priceMin` (la promo debe
  tener al menos 1 unidad por encima del mínimo del usuario)
- Si `priceMax !== null`: `promo.priceMin <= priceMax` (la promo debe
  tener al menos 1 unidad por debajo del máximo del usuario)

Formato de entrada/salida:
```ts
const fmt = (v: number | null) => v === null ? "" : v.toLocaleString("es-ES");
const parse = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || null;
```

### Dormitorios

**Radio-style** con umbrales: 1+ / 2+ / 3+ / 4+. Seleccionar `2+` significa
"al menos 2 dormitorios" e incluye promociones con unidades de 2, 3, 4+.

State: `minBedrooms: number | null` (1 | 2 | 3 | 4 | null).

Predicado:
```
const units = unitsByPromotion[promo.id] ?? [];
return units.some(u => u.bedrooms >= minBedrooms);
```

En producción: el backend puede precalcular `promo.minBedroomsAvailable` y
`promo.maxBedroomsAvailable` para evitar joins por unit.

### Entrega

Multi-select. Opciones dinámicas: `ready` (entrega inmediata, año
actual o anterior) + años únicos derivados de los datos.

Predicado:
```
const year = getDeliveryYear(promo.delivery);  // "Q3 2026" → 2026
selectedDelivery.some(d => d === "ready" ? year <= currentYear : String(year) === d)
```

### Comisión

Multi-select con umbrales 3%+ / 4%+ / 5%+. Al seleccionar varios, se toma
el **mínimo** umbral.

Predicado:
```
const minCom = Math.min(...selectedCommissions.map(v => parseInt(v)));
return promo.commission >= minCom;
```

## Búsqueda textual

Input en el header, siempre visible. Busca en:
- `promo.name`
- `promo.location`
- `promo.code`
- `promo.developer`

Case-insensitive. En producción, el backend puede usar full-text search
(Postgres ts_vector, Elastic, Meilisearch).

## Orden (Sort)

Dropdown minimalista (solo texto + chevron) a la izquierda del toggle
de vistas:

| value | Implementación |
|---|---|
| `recent` | badge `new` primero, luego por `activity.inquiries` desc |
| `trending` | `activity.trend` desc |
| `priceAsc` | `priceMin` asc |
| `priceDesc` | `priceMax` desc |
| `deliveryAsc` | `getDeliveryYear(delivery)` asc |
| `availability` | `availableUnits` desc |

## Vistas (viewMode)

Toggle segmentado de 3 opciones a la derecha de Ordenar. Componente
`ViewToggleBtn`. State: `"list" | "grid" | "map"`.

### Lista

Cards horizontales full-width con imagen 550×400 a la izquierda y
contenido a la derecha. Componente inline en `Promociones.tsx` (no
extraído).

### Cuadrícula

Grid 1 col móvil / 2 cols tablet / 3 cols desktop. Componente
`PromoCardCompact` — imagen 16:10 arriba, contenido abajo. Footer con
Disp./Com./Agencias.

### Mapa

Componente `PromocionesMap` en `src/components/promociones/PromocionesMap.tsx`.
Usa **Leaflet + OpenStreetMap**. Layout:
- Mapa 2/3 izquierda con markers por promoción (ícono personalizado
  pin invertido azul, naranja si trending)
- Sidebar 1/3 derecha con lista compacta de las mismas promociones
- Popup al click sobre marker: nombre, promotor, precio, disp./com./obra
- Auto-fit bounds a los markers visibles (useMap + fitBounds)
- Contador overlay "N en el mapa" arriba izquierda

**Geocoder mock:** el data model actual no tiene `lat`/`lng`. Para el
prototipo hay un diccionario `cityCoords: { ciudad → [lat, lng] }` en
`PromocionesMap.tsx` con las principales ciudades españolas. `resolveCoords`
intenta matching por substring.

**TODO(backend):** añadir `lat` y `lng` a la entidad `Promotion` (o tabla
separada `promotion_geo`). Al guardar dirección en el wizard, geocodificar
con MapBox Places API o Google Geocoding API.

**TODO(ui):** al hacer click en una card del sidebar, centrar el mapa en
ese marker y abrir su popup (pendiente de implementar).

## Estado React (resumen)

```ts
// Búsqueda
const [search, setSearch] = useState<string>("");

// Gestión
const [activityFilter, setActivityFilter] = useState<string[]>([]);
const [collabFilter, setCollabFilter] = useState<string[]>([]);
const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

// Búsqueda avanzada
const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>("All");
const [priceMin, setPriceMin] = useState<number | null>(null);
const [priceMax, setPriceMax] = useState<number | null>(null);
const [minBedrooms, setMinBedrooms] = useState<number | null>(null);
const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);

// Estado, orden, vista
const [statusFilter, setStatusFilter] = useState<string>("all");
const [sort, setSort] = useState<string>("recent");
const [viewMode, setViewMode] = useState<"list" | "grid" | "map">("list");

// UI
const [filtersOpen, setFiltersOpen] = useState(false);
```

## API contract esperado (cuando haya backend)

```
GET /api/v1/promotions
  ?search=texto
  &status=active,incomplete
  &activity=new,high-demand
  &collab=with-agencies,without
  &agencyId=ag-1                         # solo si collab=with-agencies
  &zones=Costa%20del%20Sol,Alicante
  &types=Apartments,Villas
  &buildingType=Plurifamiliar
  &priceMin=500000&priceMax=1500000
  &minBedrooms=3
  &delivery=ready,2026,2027
  &commissionMin=4
  &sort=recent
  &page=1&limit=20

→ {
    data: Promotion[],
    meta: { total, page, limit, pages },
    aggregates: { total, byStatus: {...}, byZone: {...} }
  }
```

Para la vista Mapa el backend devuelve también `lat` y `lng` dentro de
cada Promoción.

## Componentes utilizados

Todos viven en `src/pages/Promociones.tsx` al final del archivo como
sub-componentes, excepto `PromocionesMap` que está en
`src/components/promociones/PromocionesMap.tsx`.

| Componente | Responsabilidad |
|---|---|
| `MinimalSort` | Dropdown minimal para ordenación (solo texto + chevron) |
| `ViewToggleBtn` | Botón del toggle 3 vistas |
| `SectionTitle` | Eyebrow de sección dentro del drawer |
| `FilterGroup` | Grupo de chips seleccionables genérico |
| `SearchableFilterGroup` | Como FilterGroup pero con input de búsqueda arriba |
| `PriceRangeFilter` | Dos inputs numéricos min/max con formato 500.000 |
| `BedroomsThresholdFilter` | 4 botones radio-style (1+/2+/3+/4+) |
| `AgencySearcher` | Buscador + lista de agencias para filtro específico |
| `PromoCardCompact` | Card vertical para vista Cuadrícula |
| `PromocionesMap` | Vista mapa completa con Leaflet (archivo separado) |

## Reset de filtros

Botón "Limpiar todo" en el footer sticky del drawer. Resetea TODOS los
states a sus valores iniciales (incluyendo `search` y `statusFilter`).

También cada sección tiene su propio "Limpiar" que aparece si hay valor
seleccionado en ese grupo específicamente.

## Responsive

- **Mobile (< 640px)**:
  - Header: título arriba, buscador + Filtros + Nueva debajo
  - Toolbar: status tabs con scroll horizontal, toggle vistas icono-only
  - Drawer: full-width
  - Mapa: sidebar abajo (no a la derecha)
- **Tablet+**: como se describe arriba

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoint `/promotions` con los query params listados
- [ ] `TODO(backend)`: campos `lat`, `lng` en Promotion para el mapa real
- [ ] `TODO(backend)`: endpoint `/agencies?search=` para el selector de
      agencia
- [ ] `TODO(backend)`: normalización de zonas (mapa zona → cities)
- [ ] `TODO(backend)`: endpoint `/promotions/zones` con contadores por zona
- [ ] `TODO(ui)`: reflejar filtros en URL (`useSearchParams`) para
      compartir/back-button
- [ ] `TODO(ui)`: al click en card del sidebar del mapa, centrar y abrir
      popup del marker
- [ ] `TODO(ui)`: infinite scroll o paginación server-side
- [ ] `TODO(ui)`: custom cluster de markers cuando hay muchos en la misma
      zona
