# Pantalla · Microsites (`/microsites`)

> Centraliza los microsites que Byvaro auto-genera por cada promoción.
> Diferencial P0 del producto (ver `docs/product.md` → "Web de la promoción
> incluida"). Representa **30% del valor percibido** del SaaS: la web lista
> para vender.

## Propósito

El microsite es la landing pública de cada promoción. Esta pantalla permite
al promotor:

1. Ver de un vistazo cuántos microsites tiene activos y su tráfico agregado.
2. Configurar el **branding global** de su empresa (logo, color primario,
   fuente) que se aplica por defecto a todos los microsites.
3. Editar por microsite individual: **tema** (color, fuente, layout del
   hero), **SEO** (title, description, imagen OG), **dominio** (subdominio
   `byvaro.com/<slug>` o dominio propio con CNAME), **analytics**.
4. Abrir la vista pública del microsite (preview externo).

**Audiencia**: Promotor exclusivamente. La Agencia no ve esta pantalla en
su menú (los microsites los gestiona el promotor que crea la promoción).

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ CONTENIDO                                                   │
│ Microsites · 9 activos · 12 totales     [Configurar branding]│
├─────────────────────────────────────────────────────────────┤
│ ┌───── KPI ─────┬───── KPI ─────┬───── KPI ─────┬── KPI ──┐ │
│ │ Activos  9    │ Visitas  84K  │ Conversión 3%│ Dominios│ │
│ │ 3 en pausa    │ +21%          │ +0,4 pts     │ 4 propios│ │
│ └───────────────┴───────────────┴──────────────┴──────────┘ │
│                                                             │
│ [Todos 12] [Activos 9] [Borrador 2] [Offline 1]             │
│                                                             │
│ ┌────── card ────┐ ┌────── card ────┐ ┌────── card ──────┐  │
│ │ screenshot     │ │ screenshot     │ │ screenshot       │  │
│ │ Altea Hills    │ │ Marina Bay     │ │ Serena Golf      │  │
│ │ alteahills.com │ │ marinabay.com  │ │ byvaro.com/…     │  │
│ │ visitas · conv │ │ visitas · conv │ │ visitas · conv   │  │
│ │ [Preview] [Edit]│ │[Preview] [Edit]│ │ [Preview] [Edit] │  │
│ └─────────────────┘ └────────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Componentes en `src/pages/Microsites.tsx`

- `KpiCard` — patrón de KPI copiado de `Inicio` (icono, label, valor, delta,
  sparkline SVG inline). 4 métricas top.
- `StatusPill` — tabs Todos · Activos · Borrador · Offline con contador.
- `MicrositeCard` — card `rounded-2xl` con screenshot simulado 16:9
  (gradient del color del tema + foto del promo), URL con botón copy, 3
  mini-KPIs, botones pill Preview / Editar / kebab, timestamp.
- `MicrositeEditor` — Sheet lateral derecho (fullscreen en móvil) con 4
  tabs: `Tema`, `SEO`, `Dominio`, `Analytics`.
- `BrandingDialog` — modal global con logo, nombre empresa, color primario,
  fuente. Los cambios aplican a todos los microsites nuevos.

## Acciones del usuario

| Acción | Resultado |
|---|---|
| Click "Copiar URL" en card | Copia la URL al clipboard + toast |
| Click "Vista previa" | Abre el microsite público en otra pestaña (mock) |
| Click "Editar" | Abre el Sheet `MicrositeEditor` |
| Click kebab | Desplegable con más opciones (duplicar, desactivar, ver historial) — mock |
| Click "Configurar branding" | Abre `BrandingDialog` global |
| Tabs del editor (Tema) | Cambia color / fuente / layout del hero |
| Tabs del editor (SEO) | Actualiza title, description, imagen OG + preview Google |
| Tabs del editor (Dominio) | Conecta/desconecta dominio propio + instrucciones CNAME |
| Tabs del editor (Analytics) | Lista detallada: visitas, únicos, tiempo medio, rebote, conversión, fuentes, dispositivos |

## Estados del microsite

| Estado | Color badge | Significado |
|---|---|---|
| **Activo** | Verde | Publicado y accesible públicamente |
| **Borrador** | Ámbar | No publicado aún (promoción incompleta o pausado) |
| **Offline** | Gris | Desactivado manualmente o promoción sold-out |

La regla por defecto: `promotion.status === "active"` → microsite "active";
`incomplete` → "draft"; `sold-out` → "offline". Se puede sobrescribir
manualmente.

## Generación de slug

`slugify()` convierte el nombre de la promoción:

```
"Altea Hills Residences" → "altea-hills-residences"
```

Reglas: lowercase, quita tildes (NFD), remueve símbolos no alfanuméricos,
colapsa espacios y guiones múltiples. La URL por defecto es
`byvaro.com/<slug>`. Si hay colisión, el backend añade `-2`, `-3`… (TODO).

## Dominios personalizados

- **Por defecto**: `byvaro.com/<slug>` — siempre disponible, sin setup.
- **Dominio propio**: el promotor introduce `midominio.com` y Byvaro
  muestra las instrucciones CNAME:
  ```
  Tipo:  CNAME
  Host:  @
  Valor: cname.byvaro.com
  ```
- Propagación DNS puede tardar hasta 24h. Verificación automática cada 5
  minutos (poll del backend).
- Estado intermedio "Verificando DNS" mientras valida (mock aún no muestra
  este estado granular — TODO).

## SEO

Por microsite:
- **Title** (60 caracteres recomendados, warning si excede)
- **Meta description** (160 caracteres recomendados)
- **Open Graph image** (1200×630, se muestra al compartir en redes)

En el backend, se generarán automáticamente:
- `<meta>` tags desde `seo.title` y `seo.description`
- `schema.org/RealEstateListing` con precio, ubicación, unidades
- `sitemap.xml` por promotor con todos los microsites activos
- `robots.txt` permisivo en producción

**Pendiente de decisión** (ver Q2, Q13 en `open-questions.md`):
- Framework SSR/SSG para el microsite público (Next.js / Astro / SvelteKit)
- i18n para compradores internacionales (RU/DE/NL/FR/SE/NO/BE)

## Analytics

Datos por microsite (últimos 30 días):
- **Visitas** totales
- **Visitantes únicos** (~62% de las visitas en el mock)
- **Tiempo medio** por sesión
- **Tasa de rebote**
- **Conversión** = `leads / visitas * 100`
- **Fuentes** (top 5): Directo, Google, Instagram, Idealista, Otros
- **Dispositivos**: mobile / desktop / tablet (% sobre total)
- **Leads generados** = `visitas * conversionRate / 100` (calculado)

**Pendiente de decisión**: proveedor analytics (Plausible / GA4 / PostHog)
— ver Q2.

## API endpoints esperados

### Listado

```
GET /api/v1/microsites
  ?companyId=<uuid>                  // tenant implícito por JWT
  ?status=active,draft,offline
  &page=1&limit=50

→ {
    data: Microsite[],
    meta: { total, page, limit },
    aggregates: {
      active: 9,
      visits30d: 84320,
      conversionAvg: 3.1,
      customDomains: 4
    }
  }
```

### Detalle

```
GET /api/v1/microsites/:id
→ Microsite
```

### Actualizar tema

```
PATCH /api/v1/microsites/:id/theme
{
  colorPrimary: "215 72% 55%",
  font: "inter",
  heroLayout: "hero-left"
}
→ { ok: true, microsite: Microsite }
```

### Actualizar SEO

```
PATCH /api/v1/microsites/:id/seo
{ title, description, ogImage }
→ { ok: true, microsite: Microsite }
```

### Conectar dominio propio

```
POST /api/v1/microsites/:id/domain
{ domain: "alteahills.com" }
→ {
    ok: true,
    verification: {
      status: "pending",
      dnsRecord: { type: "CNAME", host: "@", value: "cname.byvaro.com" },
      checkEveryMinutes: 5
    }
  }
```

### Desconectar dominio

```
DELETE /api/v1/microsites/:id/domain
→ { ok: true }
```

### Branding global (singleton por empresa)

```
GET   /api/v1/company/branding
PATCH /api/v1/company/branding
  { logoUrl, companyName, colorPrimary, font }

POST  /api/v1/company/branding/apply-to-all
  → re-sincroniza todos los microsites existentes con el nuevo branding.
```

### Analytics

```
GET /api/v1/microsites/:id/analytics?range=30d
→ {
    visits, uniqueVisitors, avgDuration, bounceRate, conversionRate,
    topSources: [{ name, count }],
    devices: { mobile, desktop, tablet },
    trend30d: number[]
  }
```

Pensado para cachear agresivamente (TTL 5-10 min). El tracking en sí lo
hará el proveedor analytics (ver Q2).

## Permisos

| Elemento | Promotor | Agencia |
|---|---|---|
| Acceder a `/microsites` | ✅ | ❌ (oculto del menú) |
| Editar tema / SEO / dominio | ✅ | N/A |
| Configurar branding global | ✅ | N/A |
| Ver analytics | ✅ | N/A |

La Agencia nunca ve microsites de promotores ajenos ni siquiera en el
marketplace (el microsite es del promotor).

## Responsive

- **Móvil (375px+)**: 1 columna, Sheet de edición fullscreen, KPIs en 2×2.
- **Tablet (sm/md)**: 1 columna, Sheet 520px lateral.
- **Desktop (lg+)**: 2 columnas de cards.
- **Desktop amplio (xl+)**: 3 columnas de cards.

## Estados especiales

- **Loading inicial**: skeleton de 6 cards con placeholder del screenshot.
- **Empty global (sin promociones)**: hero con CTA "Crea tu primera
  promoción y genera tu primer microsite".
- **Empty filtrado**: dashed card "Sin microsites en este estado. Cambia
  el filtro".
- **Error**: banner rojo "Error al cargar · Reintentar".
- **Dominio pendiente de verificación**: warning ámbar con las
  instrucciones DNS + indicador "Verificando cada 5 minutos".

## Preguntas abiertas relacionadas

- **Q2** · Spec completa de microsites (template, editor, i18n, analytics).
- **Q13** · Framework SEO (SSR/SSG).
- **Q11** · i18n para compradores internacionales.

El mock actual implementa la UI de gestión completa, pero el **render
público** del microsite (qué se ve cuando un comprador entra a
`byvaro.com/<slug>`) queda fuera de scope hasta que Q2 se cierre.

## TODOs al conectar backend

- [ ] `TODO(backend)` `/api/v1/microsites` con filtrado y aggregates
- [ ] `TODO(backend)` flujo de verificación DNS + renovación SSL (Let's
      Encrypt automática vía Vercel/Cloudflare)
- [ ] `TODO(backend)` re-sincronizar branding a todos los sites existentes
- [ ] `TODO(ui)` skeleton de cards durante load
- [ ] `TODO(ui)` polling del estado de verificación DNS cuando el dominio
      está en "pending"
- [ ] `TODO(ui)` reflejar filtros de estado en query string
- [ ] `TODO(ui)` vista preview real (iframe del microsite público) en vez
      de abrir en otra pestaña
- [ ] `TODO(analytics)` integrar proveedor decidido en Q2
- [ ] `TODO(seo)` generar OG image automática por promoción (Vercel OG o
      similar) si el promotor no sube una

## Referencias

- Diferencial de producto: `docs/product.md` (sección "Web de la
  promoción incluida")
- Data mock: `src/data/microsites.ts`
- Página: `src/pages/Microsites.tsx`
- Preguntas abiertas: `docs/open-questions.md` Q2, Q11, Q13
