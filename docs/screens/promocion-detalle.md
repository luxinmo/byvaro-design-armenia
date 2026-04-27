# Pantalla · Promoción · detalle (`/promociones/:id`)

## Propósito

Ficha completa de una promoción desde la perspectiva del **promotor** (vista
por defecto) con un toggle "Vista colaborador" para previsualizar lo que
ven las agencias. Centralizada: todo lo que se necesita para gestionar la
promoción vive aquí — KPIs, galería, info básica, estructura, unidades,
plan de pagos, comisiones, colaboradores, registros, documentos y equipo.

**Audiencia**: Promotor (dueño) con acceso total. Agencia verá una
versión recortada (ocultas secciones internas de comisiones/registros de
otras agencias) al cambiar a modo "Vista colaborador".

## Rutas

- `/promociones/:id` — entry point, carga la promoción.
- Links salientes:
  - Botón "Ver microsite" → `https://byvaro.com/<slug>` (externo).
  - "Invitar agencia" → `/colaboradores` (listado global).
  - "Crear mi landing" → futura `/landings/crear` (TODO).

## Layout (desktop ≥ 1024 px)

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb: Promociones > Altea Hills                    │
│ Hero: nombre + código + ubicación + promotor + acciones  │
│   ↳ "promotor" → CLICABLE solo si la mira una agencia ↑   │
│      destino: developerHref(user) → ficha o panel mirror  │
│ Galería 2×2 (img principal + 4 thumbs + "+N fotos")      │
├──────────────────────────────────────────────────────────┤
│ 5 KPIs: precio · disp · comisión · entrega · reserva     │
├──────────────────────────────────────────────────────────┤
│ Tabs: Vista general · Disponibilidad · Agencias ·        │
│       Comisiones · Registros · Documentos                │
├──────────────────────────────────────────────────────────┤
│ Contenido del tab activo (2 col: principal + sidebar)    │
│                                                          │
│   Vista general:                                         │
│     Col izq (2/3)   Col der (1/3)                        │
│     - Estructura    - Datos comerciales                  │
│     - Info básica   - Contacto promotor                  │
│     - Piso piloto   - Piso piloto share                  │
│     - Docs cards                                         │
│     - Unidades      - Plan de pagos                      │
│     - Descripción                                        │
│     - Ubicación                                          │
│     - Equipo                                             │
└──────────────────────────────────────────────────────────┘
```

En móvil (< 640 px) todo pasa a 1 columna apilada. Las tabs son
scrollables horizontalmente.

## Tabs y subcomponentes

| Tab | Componente | Qué muestra |
|---|---|---|
| Vista general | inline en `PromocionDetalle.tsx` | resumen de estructura + info + unidades summary + docs + plan pagos + descripción + ubicación + equipo |
| Disponibilidad | `PromotionAvailabilityFull` | tabla/grid de unidades con filtros, selección múltiple y `UnitDetailPanel` lateral |
| Agencias | grid inline de `FeatureCardV3` (importado de `Colaboradores.tsx`) | Mismo lenguaje visual que `/colaboradores` · grid 3-col con cover + logo + mercados + stats. Filtra por `promotionsCollaborating.includes(promotionId)`. Empty state con CTA "Invitar agencia". Header con 3 CTAs: **Estadísticas** (abre overlay fullscreen · ver más abajo) · **Estadísticas generales ↗** (navega a `/colaboradores/estadisticas`) · **Invitar agencia**. |
| Comisiones | inline | desglose de comisiones nacional/internacional y hitos |
| Registros | `PromotionRecords` | lista de registros de clientes con aprobar/rechazar + motivo |
| Documentos | `PromotionMultimedia` + `EditSectionDialogs` | fotos, vídeos, planos, brochure, memoria |

## Subcomponentes internos (detalle)

- `PromotionHero` · cabecera con galería + código + acciones.
- `PromotionKPIs` · 5 KPIs resumen.
- `PromotionInfoTab` · tarjetas de info básica.
- `PromotionDescription` · bloques ES/EN con edición inline.
- `PromotionLocation` · mapa + tabla de puntos cercanos.
- `PromotionPaymentPlan` · plan de pagos (contrato/manual/certificaciones) + reserva.
- `PromotionCommissions` · comisiones + hitos.
- `PromotionContacts` · equipo comercial asignado.
- `PromotionRecords` · registros de clientes.
- `PromotionMultimedia` · galería y documentos.
- `PromotionAvailabilityFull` · grid/tabla de unidades. Si la promoción
  tiene anejos sueltos, muestra un segmentado al principio del contenido
  con los tipos que existan: **Viviendas | Parkings | Trasteros**.
  Parkings y trasteros comparten el mismo componente de tabla —
  `PromotionAnejosTable` recibe el `tipo` fijo como prop, así la tabla
  queda limpia (columna "Tipo" fuera, el icono por fila marca la
  tipología).
- `PromotionAnejosTable` · tabla de parkings o trasteros sueltos (ID
  con icono de tipo · Precio · Cliente · Estado · kebab con las mismas
  4 acciones que la fila de unidad: Ver · Editar · Enviar por email ·
  Iniciar compra). KPIs arriba: Total · Disponibles · Reservados ·
  Vendidos · Retirados.
- `PromotionAvailabilitySummary` · mini-preview de disponibilidad.
- `UnitDetailPanel` · panel lateral con detalle de unidad.
- `ClientRegistrationDialog` · modal para registrar cliente nuevo.
- `ImageLightbox` · visor fullscreen reutilizable (top bar · nav arrows ·
  strip de thumbnails · teclado ← → y Escape). Reutilizado también por
  la ficha de unidad.

### Overlay · Estadísticas de esta promoción

Desde el tab Agencias, el CTA **"Estadísticas"** abre un overlay
fullscreen (`fixed inset-0 z-50`) con la pantalla
`ColaboradoresEstadisticas` en modo embebido y bloqueada a la promoción
actual (`lockedPromotionId={p.id}`).

- **Top bar sticky** con eyebrow "Estadísticas · {nombre}" + subtítulo
  aclarativo + botón X (top-right, `h-10 w-10 rounded-full`) para
  cerrar.
- **Banner de contexto** dentro del contenido (pill primary/10 con
  icono `Target`): "Estadísticas filtradas · Solo datos de {nombre}".
  Siempre visible para que no se pierda la referencia de qué subset
  se está analizando.
- **Filtro Promoción oculto** en la toolbar — la promoción está
  bloqueada y no se puede cambiar desde este overlay.
- `Limpiar filtros` respeta el lock: al limpiar, `fPromos` vuelve a
  contener solo el `lockedPromotionId`.

El CTA paralelo **"Estadísticas generales ↗"** navega a
`/colaboradores/estadisticas` para la vista global de la red.
- `EditSectionDialogs` · 11 diálogos de edición inline (multimedia, info,
  estructura, descripción, ubicación, plan de pagos, piso piloto, doc,
  contactos, inventario, oficinas de venta).

### Visor de galería

El mosaico de la sección **Multimedia** (hero + 3 thumbs + "+N fotos")
abre `ImageLightbox` al índice clicado. También hay un CTA flotante
**"Ver todas las fotos (N)"** abajo-derecha del mosaic en desktop que
abre al índice 0. En móvil la foto principal también dispara el visor.
El lightbox es el mismo componente usado en la ficha de unidad para
mantener UX consistente.

### Patrón de acciones por sección (`SectionCard`)

Todas las secciones usan el wrapper `SectionCard` con el mismo
affordance: pill "✎ Editar" que aparece en hover (esquina superior
derecha) y llama `onEdit` (abre el `EditSectionDialog` correspondiente).

Excepciones que usan kebab propio (no vía SectionCard):

- **Brochure**: card con dropdown de 3-puntos · Reemplazar archivo ·
  Descargar · Eliminar (la última marca `brochureRemoved` y desactiva
  la acción rápida del dock).
- **Filas de unidad en Disponibilidad**: cada unidad tiene un kebab
  (`MoreVertical`) al final de la fila (después del precio/estado) con
  4 acciones: **Ver** (`Eye`) · **Editar** (`Pencil`, deshabilitado si
  no disponible) · **Enviar por email** (`Send`, deshabilitado si no
  disponible) · **Iniciar compra** (`ShoppingCart`, deshabilitado si no
  disponible). Aplica tanto en la vista tabla como en la vista catálogo.

## Acciones principales

| Acción | Botón | Qué hace (prototipo) | TODO backend |
|---|---|---|---|
| Registrar cliente | "Registrar cliente" (pill primario) | abre `ClientRegistrationDialog` | `POST /api/promociones/:id/registros` |
| Invitar agencias | dock "Invitar agencias" (antes duplicado con "Compartir") | abre `SharePromotionDialog` | ver §5 de backend-integration |
| Imprimir | "Imprimir" | `window.print()` | PDF server-side |
| Crear landing | "Crear mi landing" | nav placeholder | pantalla aparte |
| Descargar brochure | dock "Brochure" · deshabilitado si `brochureRemoved` | descarga (hoy toast) | `GET /api/promociones/:id/brochure` |
| Eliminar brochure | kebab de la card Brochure · "Eliminar" | `setBrochureRemoved(true)` + toast | `DELETE /api/promociones/:id/brochure` |
| Editar sección | lápiz en hover (o kebab "Editar" en Unidades) | abre el `EditSectionDialog` correspondiente | `PATCH /api/promociones/:id` |
| Acciones por unidad | kebab (3-puntos verticales) al final de cada fila de Disponibilidad | Ver (expande panel/abre dialog) · Editar · Enviar por email · Iniciar compra | `PATCH /api/units/:id` · `POST /api/units/:id/email` · `POST /api/units/:id/reservations` |
| Cambiar tipo de inventario | segmentado **Viviendas / Parkings / Trasteros** arriba del contenido de la tab Disponibilidad · cada tipo aparece solo si existe en la promoción | cambia `segment` entre `"viviendas"`, `"parkings"` y `"trasteros"` | — (contenido de `GET /api/promociones/:id/units` y `GET /api/promociones/:id/anejos`) |
| Acciones por anejo | kebab (3-puntos verticales) al final de cada fila de la tabla de Anejos | Ver · Editar (oculto a agencia) · Enviar por email · Iniciar compra | `PATCH /api/anejos/:id` · `POST /api/anejos/:id/email` · `POST /api/anejos/:id/reservations` |
| Acciones rápidas (rail derecho) | dock sticky en `lg+`, compartido entre Vista general y Disponibilidad | Invitar agencias · Brochure (disabled si removido) · Listado de precios · Datos en vivo (info) | ver §3 y §5 de backend-integration |

**Regla de consistencia**: el dock de acciones rápidas está centralizado
en la función local `renderQuickActionsRail()` de `PromocionDetalle.tsx`.
Las tabs Vista general y Disponibilidad lo invocan igual — mismos items,
misma estética (compact md/lg con tooltips · labeled card en 2xl),
mismos handlers. Si se añade una acción, aparece automáticamente en las
dos pantallas.
| Abrir galería fullscreen | click en cualquier foto del mosaic o CTA "Ver todas las fotos (N)" | abre `ImageLightbox` al índice clicado | `GET /api/promociones/:id/gallery` |
| Invitar agencia | desde tab Agencias | navega a `/colaboradores` | `POST /api/promociones/:id/agencies/invite` |
| Aprobar/Rechazar registro | desde tab Registros | toast placeholder | `PATCH /api/registros/:id` |
| Toggle Vista colaborador | switch en hero | cambia `viewAsCollaborator` state | — (solo UI) |
| Vista Red / Lista (Agencias) | pills en tab Agencias | cambia `agenciesView` state | — (solo UI) |

Nota: la antigua entrada "Compartir" del dock de acciones rápidas se
eliminó (era duplicada — abría el mismo `SharePromotionDialog` que
"Invitar agencias").

## Estados visuales

| Estado | Cuándo | Qué aparece |
|---|---|---|
| Cargando | al montar (no implementado, mock síncrono) | TODO(ui): skeleton de KPIs + hero |
| Sin unidades | `units.length === 0` | empty state en tabla de disponibilidad |
| Sin agencias | `agencies.length === 0` en V2 | empty state con CTA "Invitar la primera agencia" |
| Vista colaborador | `viewAsCollaborator === true` | oculta KPIs internos + tabs Comisiones/Registros + masking de datos |
| Badge "Alta demanda" | `promotion.badge === "hot"` | chip destructive en hero |
| Badge "Exclusiva" | `promotion.badge === "exclusive"` | chip accent en hero |
| Badge "Nueva" | `promotion.badge === "new"` | chip primary en hero |

## Datos y origen

Mock estático en:
- `src/data/promotions.ts` — lista de `Promotion`.
- `src/data/developerPromotions.ts` — shape extendido con datos internos.
- `src/data/units.ts` — `unitsByPromotion[promotionId]` → `Unit[]`.
- `src/data/agencies.ts` — `Agency[]` con colaboraciones cruzadas.
- `src/data/teamMembers.ts` — `activeTeamMembers` para el equipo comercial.
- ~~`src/data/companyOffices.ts`~~ **borrado** · oficinas viven ahora en
  `byvaro-oficinas` (workspace single-source · ver
  `docs/backend/domains/empresa-stats-and-offices.md`). Las
  promociones referencian por `puntosDeVentaIds: string[]` en lugar
  de inline data; `PromocionDetalle.tsx` resuelve vía `useOficinas()`.

## Endpoints esperados (contract-first)

```
GET    /api/promociones/:id                → DevPromotion (shape completo)
PATCH  /api/promociones/:id                → DevPromotion (update parcial por sección)
GET    /api/promociones/:id/units          → Unit[]
PATCH  /api/promociones/:id/units/:unitId  → Unit (cambiar estado, precio, etc.)
GET    /api/promociones/:id/agencies       → Agency[]
POST   /api/promociones/:id/agencies/invite → { agencyId }
GET    /api/promociones/:id/records        → Record[]
PATCH  /api/registros/:id                  → Record (approve/reject + reason)
POST   /api/promociones/:id/registros      → Record (nuevo cliente)
GET    /api/promociones/:id/gallery        → { fotos: FotoItem[], videos: VideoItem[] }
POST   /api/promociones/:id/gallery/upload → { id, url }
GET    /api/promociones/:id/brochure       → { url, fileName, sizeBytes } | 404 si no hay
POST   /api/promociones/:id/brochure       → { url, fileName, sizeBytes } (upload/replace)
DELETE /api/promociones/:id/brochure       → 204 (deja la promoción sin brochure)
POST   /api/emails/send                    → { id, status } (ver SendEmailDialog)
```

## Consideraciones

- **Permisos**: el toggle "Vista colaborador" es solo visual; en producción
  el backend debe devolver el shape recortado según el rol del JWT.
- **Galería**: las URLs de Unsplash son mock; sustituir por CDN propio con
  signed URLs para fotos bloqueadas (`FotoItem.bloqueada === true`).
- **IA de duplicados**: cuando un registro entrante coincida con otro
  existente > 70%, mostrar warning en `ClientRegistrationDialog` antes
  de permitir crearlo (pendiente de backend).

## Screens relacionadas

- `/promociones` → listado que navega a esta ficha.
- `/crear-promocion` → wizard que produce una promoción publicable y
  termina redirigiendo a `/promociones/:id` (pendiente el wire).
- `/colaboradores` → detalle de una agencia colaboradora específica.
- `/registros` → vista global de registros (filtra por promoción).
- `/microsites` → editor del microsite público.

## Archivos implicados

```
src/pages/PromocionDetalle.tsx                                 (2.349 L — port de figgy)
src/components/promotions/detail/
  ├── PromotionHero.tsx                   ← adaptado Byvaro fase 2
  ├── PromotionKPIs.tsx                   ← adaptado Byvaro fase 2
  ├── PromotionInfoTab.tsx
  ├── PromotionDescription.tsx
  ├── PromotionLocation.tsx
  ├── PromotionContacts.tsx
  ├── PromotionMultimedia.tsx
  ├── PromotionPaymentPlan.tsx
  ├── PromotionCommissions.tsx
  ├── PromotionRecords.tsx
  ├── PromotionAvailabilityFull.tsx
  ├── PromotionAvailabilityFullV2.tsx
  ├── PromotionAvailabilityNew.tsx
  ├── PromotionAvailabilitySummary.tsx
  ├── PromotionAgenciesV2.tsx             ← diseño alternativo (default)
  ├── UnitDetailPanel.tsx
  ├── EditSectionDialogs.tsx              (11 modales de edición)
  └── ClientRegistrationDialog.tsx
src/components/email/
  ├── SendEmailDialog.tsx
  └── emailTemplates.ts
```

## Historial

- Abril 2026 · port literal desde figgy-friend-forge (`DeveloperPromotionDetail.tsx`)
- Abril 2026 · fase 2 · adaptación de Hero + KPIs a tokens Byvaro
- Abril 2026 · fase 2 · resto de subcomponentes adaptados (ver commits)
- Abril 2026 · `PromotionAgenciesV2` añadido como vista alternativa
- Tag de rollback antes de la fase 2 real: `v-pre-fase2-real`
