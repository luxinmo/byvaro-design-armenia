# Pantalla · Promociones (`/promociones`)

> **Última revisión (post-rediseño de filtros · commit pending):**
> - Header con buscador + botón "Filtros" + CTA "Nueva promoción"
> - Toolbar: status tabs + sort + toggle **3 vistas (Lista · Cuadrícula · Mapa)**
> - Filtros viven en un **drawer lateral derecho** que se abre con backdrop
>   borroso (patrón Linear/Airbnb)
> - Filtros: Actividad · Colaboración (+ agencia específica buscable) ·
>   Ubicación (buscable) · Tipología · Edificio · Precio (min/max con
>   separador miles) · Dormitorios (umbral 1+/2+/3+/4+) · Entrega · Comisión
> - Vista **Mapa** real con Leaflet + OpenStreetMap, markers por promoción


## Propósito

Listado completo de promociones del promotor. Filtrable, ordenable,
seleccionable. Punto de partida para editar una promoción existente o crear
una nueva.

**Audiencia**: Promotor (con filtros propios) y Agencia (solo promociones
donde colabora, en modo read-only). La lógica dual-mode usa el prop
`agentMode` o lee el rol del usuario autenticado.

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ Comercial (eyebrow)                                     │
│ Promociones                    │ Buscador │ ⚙ │ + Nueva │
├─────────────────────────────────────────────────────────┤
│ Todas · Activas · Incompletas · Vendidas · | · Tipo ▼   │
│ Edificio ▼ · Precio ▼ · Estilo ▼ · Entrega ▼   │ 13 prom│
├─────────────────────────────────────────────────────────┤
│ ┌──────────────┬──────────────────────────────────────┐ │
│ │              │ MARBELLA · Única vivienda · Activa  │ │
│ │   COVER      │ Villa Serena                        │ │
│ │   550×400    │ Kronos Homes · Entrega Q4 2026      │ │
│ │              │                                      │ │
│ │              │ Disponibles 1/1  Comisión 5%  Obra 70% │
│ │              │                                      │ │
│ │              │ 1.250.000 €                          │ │
│ │              │                                      │ │
│ │              │ · 3 agencias · 70% obra  Compartir → │ │
│ └──────────────┴──────────────────────────────────────┘ │
│ (...más cards...)                                       │
└─────────────────────────────────────────────────────────┘
```

## Componentes en `src/pages/Promociones.tsx`

- Header con título + buscador + filtros panel + CTA "+ Nueva promoción"
- `MultiSelectDropdown` — pill que muestra contador cuando tiene selección
- `FiltersPanel` — panel popover con sliders/grupos (comisión, dormitorios)
- Status tabs (Todas / Activas / Incompletas / Vendidas)
- `PromoCard` (artículo principal) — horizontal en lg, vertical en móvil
- `Metric` — label uppercase + valor tabular
- `Tag` (en `src/components/ui/Tag.tsx`) — variantes success/warning/danger/etc.
- `EmptyState` — cuando no hay resultados

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Escribir en buscador | Filtra por nombre, código (`PRM-xxxx`), ubicación o promotor |
| Click status tab | Filtra por estado |
| Click filter pill | Abre dropdown multi-select |
| Click chip de filtro activo | Quita ese filtro |
| Click "Limpiar" | Reset todos los filtros |
| Click card | Navega a `/promociones/:id` (detalle) |
| Click "+ Nueva promoción" | Abre `/crear-promocion` (wizard) |
| Click "Compartir con agencias" | Abre modal de selección de agencias |
| Hover card | Elevación 2px + shadow más oscuro + arrow corner (ver [pendiente]) |

## Filtros

Todos son multi-select salvo estado que es single-select.

| Filtro | Valores |
|---|---|
| Status (tabs) | Todas, Activas, Incompletas, Vendidas |
| Tipo (pill) | Apartments, Villas, Townhouses, Penthouses |
| Edificio (pill) | All, Unifamiliar, Plurifamiliar |
| Precio mínimo | 200k+, 500k+, 1M+, 2M+ |
| Estilo | Contemporary, Mediterranean, Minimalist, Classic |
| Entrega | Ready now, 2025, 2026, 2027+ |
| Comisión mín (panel) | 3%+, 4%+, 5%+ |
| Dormitorios (panel) | 1, 2, 3, 4+ |

Busqueda: `name` OR `code` OR `location` (case-insensitive).

## Estados especiales por card

### Trending (actividad alta)

Si `activity.trend >= 50`:
- Ring ámbar `ring-1 ring-amber-300/50`
- Tag "Trending" con icono `Flame` gradiente naranja→rosa arriba derecha
- Box amarillo con consultas/reservas/visitas

### Missing steps (pendiente de publicar)

Si `missingSteps.length > 0`:
- Ring destructivo `ring-1 ring-destructive/10`, border `border-destructive/30`
- Warning rojo arriba: "Pasos pendientes para publicar" con lista
- Badge rojo posiblemente (TODO: confirmar)

### Cannot share

Si `canShareWithAgencies === false` y no hay missing steps:
- Warning ámbar: "No se puede compartir con agencias — Configura comisiones"

### Última unidad

Si solo queda 1 unidad disponible:
- Badge overlay "Últimas unidades" arriba izquierda
- Sección destacada con detalle de la única unidad (bedrooms, baños, m²,
  planta, orientación)

### Nueva

Si `badge === "new"`:
- Badge overlay "Nueva" arriba izquierda

## API endpoints esperados

### Listado con filtros

```
GET /api/v1/promotions
  ?search=texto
  &status=active,incomplete
  &type=Apartments,Villas
  &buildingType=plurifamiliar
  &priceMin=500000
  &commissionMin=5
  &bedrooms=3
  &delivery=2026,2027
  &page=1&limit=20

→ {
    data: Promotion[],
    meta: { total, page, limit, pages },
    aggregates: { total: 13, byStatus: { active: 8, incomplete: 3, ... } }
  }
```

### Agregados para status tabs

Los tabs muestran contadores. Se pueden traer en el response inicial
(`aggregates`) o en un endpoint separado para que se actualicen sin refetch:

```
GET /api/v1/promotions/counts
→ { total: 13, active: 8, incomplete: 3, "sold-out": 2, ... }
```

### Datos agregados por promoción

Cada card necesita:
- Campos básicos de `Promotion`
- Agregados calculados: availability, actividad últimos 14d, typologies +
  cheapest units (3 de cada) — precalculados en backend para no hacer N+1

## Permisos

| Elemento | Promotor | Agencia |
|---|---|---|
| Ver listado completo | ✅ todas | ✅ solo colaboradoras |
| Filtros | ✅ todos | ✅ subset (sin Comisión, sin Incompletas) |
| Status tabs | ✅ | ❌ (solo ve Activas) |
| CTA "+ Nueva promoción" | ✅ | ❌ oculto |
| Click en card | ✅ detalle editable | ✅ detalle read-only |
| Compartir con agencias | ✅ | ❌ |
| Badges warning missing/cannot-share | ✅ ve | ❌ no ve (filtrados del backend) |

## Estados

- **Loading** — Skeleton de 3 cards con placeholder del cover + líneas
- **Empty (sin promociones)** — Hero con CTA "Crea tu primera promoción"
- **Empty (filtrados, hay resultados vacíos)** — EmptyState con icono lupa +
  mensaje + "Limpiar filtros"
- **Error** — Banner rojo "Error al cargar · Reintentar"

## Enlaces salientes

| Desde | Hacia |
|---|---|
| Card | `/promociones/:id` |
| CTA "Nueva promoción" | `/crear-promocion` |
| "Compartir con agencias" | Modal en misma página |
| Stats tabs | Mismo endpoint con `?status=` |

## Responsive

- **Móvil**: card vertical (cover arriba, contenido abajo), filtros
  horizontales con scroll (`overflow-x-auto`), header apila título encima
- **Tablet**: card horizontal cuando hay espacio (`sm`), filtros en línea
- **Desktop (lg+)**: card horizontal completa (cover 550×400 izquierda)

## Notas de implementación

- Los filtros se reflejan en la **URL** (query params) para que se puedan
  compartir links con filtros aplicados y que el back button funcione
- Selección múltiple de cards (checkbox overlay en hover) abre una barra
  flotante fija con acciones masivas (Archivar, Compartir, Exportar)
- Los covers se cargan con `loading="lazy"` y debería usarse un wrapper
  `<img>` con placeholder blur (next/image o similar) cuando haya backend

## TODOs al conectar backend

- [ ] `TODO(backend)`: endpoint `/promotions` con todos los filtros
- [ ] `TODO(backend)`: precalcular typologies + cheapest units en cada
      promoción para evitar N+1
- [ ] `TODO(ui)`: reflejar filtros en query string (`useSearchParams`)
- [ ] `TODO(ui)`: selección múltiple + barra flotante masiva
- [ ] `TODO(ui)`: infinite scroll o paginación server-side
- [ ] `TODO(ui)`: skeleton de cards durante load
- [ ] `TODO(realtime)`: suscripción para refrescar si otra sesión edita una promo
