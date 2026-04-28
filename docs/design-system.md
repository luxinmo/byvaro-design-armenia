# Sistema de diseño · Byvaro v2

Fuente canónica de tokens y patrones visuales. Consultar antes de añadir
cualquier estilo. Cualquier cambio se anota aquí + en `DECISIONS.md`.

## Tokens (HSL — `src/index.css`)

### Base

```css
--background: 210 14% 98%;         /* off-white cálido */
--foreground: 220 15% 20%;         /* tinta principal */
--card: 0 0% 100%;                 /* cartas blancas puras */
--popover: 0 0% 100%;

--primary: 215 72% 55%;            /* azul Byvaro */
--primary-foreground: 0 0% 100%;

--secondary: 220 14% 96%;
--muted: 220 14% 96%;
--muted-foreground: 220 8% 52%;
--accent: 215 72% 55%;

--destructive: 0 70% 56%;          /* rojo destructivo */
--border: 220 13% 91%;
--input: 220 13% 91%;
--ring: 215 72% 55%;

--radius: 1rem;
```

### Sidebar

```css
--sidebar-background: 0 0% 100%;
--sidebar-foreground: 220 10% 40%;
--sidebar-primary: 215 72% 55%;     /* barra indicador activo */
--sidebar-accent: 215 72% 97%;      /* fondo item activo */
--sidebar-accent-foreground: 215 72% 50%;
--sidebar-border: 220 13% 93%;
```

### Semánticos por contexto (Tailwind class names)

| Uso | Clase | Color resultante |
|---|---|---|
| Positivo, ventas, éxito | `text-emerald-600` / `bg-emerald-500/10` | Verde |
| Visitas, visual | `text-violet-600` / `bg-violet-500/10` | Violeta |
| Colaboradores, red, advertencia suave | `text-amber-600` / `bg-amber-500/10` | Ámbar |
| Destructivo, errores | `text-destructive` / `bg-destructive/5` | Rojo |
| Brand, registros, CTA secundario | `text-primary` / `bg-primary/10` | Azul |

**Regla:** nunca hex literal, siempre token HSL o utility Tailwind.

## Tipografía

Fuente: **Inter** (Google Fonts, pesos 400-800). Carga en `index.html`.

| Uso | Clase | Tamaño |
|---|---|---|
| Eyebrow / label uppercase | `text-[10px] uppercase tracking-[0.14em] font-semibold` | 10px |
| Metadata, counters, badges | `text-xs` | 12px |
| Body, UI principal | `text-sm` | 14px |
| Títulos sección | `text-base` | 16px |
| H2 / títulos panel | `text-lg` | 18px |
| H1 página | `text-[22px] sm:text-[28px] font-bold tracking-tight` | 22/28px |

Cifras: **siempre** `tabular-nums` o `.tnum` (utility definida en index.css).

## Radios

| Elemento | Radio |
|---|---|
| Paneles, cards grandes | `rounded-2xl` |
| Cards pequeñas, warnings, box secundarios | `rounded-xl` |
| Botones cuadrados, icon containers | `rounded-lg` |
| Botones principales (pill) | `rounded-full` |
| Avatars, chips | `rounded-full` |

## Sombras

```ts
// tailwind.config.ts
boxShadow: {
  soft: '0 2px 16px -6px rgba(0,0,0,0.06)',       // reposo
  'soft-lg': '0 4px 24px -8px rgba(0,0,0,0.1)',   // hover
}
```

**Una sola capa**, nunca sombras duras. Para cards interactivas:

```tsx
className="shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
```

## Espaciado

| Contexto | Padding / gap |
|---|---|
| Page container horizontal | `px-4 sm:px-6 lg:px-8` |
| Page container vertical | `pt-6 sm:pt-8 pb-8` |
| Max-width contenedor | `max-w-content` (1400px) o `max-w-reading` (1250px) — ver siguiente sección |
| Cards | `p-4 sm:p-5` (hero: `p-5 sm:p-6`) |
| Gap items de lista | `gap-3` |
| Space entre secciones | `space-y-5` o `gap-4 sm:gap-5` |

## Anchos de página (canónicos · 2 valores)

> Regla canónica en CLAUDE.md → "REGLA DE ORO · Anchos del contenedor de
> página". Resumen:

Tokens en `tailwind.config.ts`:

```ts
maxWidth: {
  content: "1400px",   // listados, dashboards, master-detail
  reading: "1250px",   // perfiles, ajustes, lectura larga
}
```

| Token | Tamaño | Cuándo |
|---|---:|---|
| `max-w-content` | 1400px | Listados con grids de cards (Promociones, Colaboradores, Contactos, Equipo, Registros, Ventas, Microsites, Emails, Leads). Dashboards (Inicio, Estadísticas, Calendario). Master-detail (Registros, ContactoDetalle, LeadDetalle). Wizard largo (CrearPromocion). |
| `max-w-reading` | 1250px | Perfil / ficha pública (Empresa · `/empresa`, `/promotor/:id`, `/colaboradores/:id`). Settings (AjustesHome y sub-páginas). Footer sticky de AgenciaDetalle. |

**Por qué dos**: a 1400 las pantallas de perfil/ajustes producen líneas
de texto de 100+ chars (rompe legibilidad · Bringhurst recomienda
60-75 chars/línea). A 1250 los listados pierden una columna de cards
en pantallas grandes.

**No inventar otros valores**: 1100, 1200, 1300, 1500 son `bug del
diseño`. Para wizards y dialogs internos hay otros tokens (`max-w-md`,
`max-w-2xl`, etc. — pero NO para el contenedor de página).

## Componentes base

### Botones

**Primario (CTA):**
```tsx
<button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft">
  <Plus className="h-3.5 w-3.5" /> Texto
</button>
```

**Secundario:**
```tsx
<button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
  Texto
</button>
```

**Ghost:**
```tsx
<button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 h-8 rounded-full hover:bg-muted">
  Texto
</button>
```

**Icónico:**
```tsx
<button className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
  <Icon className="h-[18px] w-[18px]" />
</button>
```

### KPI card (patrón base)

Ver `src/pages/Inicio.tsx` → componente `Kpi`. Incluye icono coloreado,
sparkline a la derecha, label uppercase, valor grande tabular, delta con
trend y subtítulo.

### Filter pill (dropdown)

Ver `src/pages/Promociones.tsx` → `MultiSelectDropdown`. Fondo `bg-card`
cuando vacío, `bg-foreground text-background` cuando tiene selección.

### Card horizontal (lista densa)

Cover a la izquierda 550×400, contenido a la derecha con padding
`p-4 sm:p-5`, borde `border-border`, radio `rounded-2xl`. Ver PromoCard
en `src/pages/Promociones.tsx`.

### Warning / alert box

```tsx
<div className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
  <div>
    <p className="text-sm lg:text-xs font-semibold text-destructive">Título</p>
    <p className="text-sm lg:text-xs text-muted-foreground">Descripción</p>
  </div>
</div>
```

Variantes: `destructive`, `amber`, `primary`, `muted`.

### Sparkline

Ver `src/pages/Inicio.tsx` → componente `Sparkline`. SVG inline sin librería,
64×22, área rellena con `opacity-0.12` y línea `stroke-1.5`.

## Iconografía

**Solo Lucide React.** Tamaños estándar:

| Contexto | Tamaño |
|---|---|
| Chips / badges | `h-3 w-3` |
| Botones | `h-3.5 w-3.5` |
| Headers, KPIs, inputs | `h-4 w-4` |
| Destacados | `h-5 w-5` |
| Bottom nav mobile | `h-[20px] w-[20px]` |

Strokes: **no tocar `strokeWidth` prop**. El default 2 de Lucide es lo correcto.

## Responsive

**Mobile-first estricto.** Se diseña desde **375px** (iPhone SE) y se escala
arriba. Breakpoints Tailwind:

| Breakpoint | Ancho | Uso típico |
|---|---|---|
| `default` | 375px+ | Mobile base |
| `sm` | 640px+ | Mobile grande / tablet vertical |
| `md` | 768px+ | Tablet horizontal |
| `lg` | 1024px+ | Desktop mínimo — aparece sidebar |
| `xl` | 1280px+ | Desktop cómodo |
| `2xl` | 1400px+ | Desktop amplio (container max-width) |

**Patrón común:** esconder/mostrar por breakpoint.
```tsx
<div className="hidden lg:block">Solo desktop</div>
<div className="lg:hidden">Solo móvil/tablet</div>
```

## Animaciones

**Framer Motion** solo para transiciones significativas (cambio de paso de
wizard, abrir drawer). Para hover y micro-interacciones, **CSS transitions**.

```tsx
// Transición de entrada (fade + slide sutil)
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.18 }}
/>
```

Duración estándar: **200ms** para hovers, **180ms** para cambios de pantalla.

## Modo oscuro

**Pospuesto a Fase 3** (después de pulir la vista clara). Los tokens ya están
definidos en el `.dark` de index.css pero no se activa automáticamente aún.

## Accesibilidad

- `aria-label` en todos los botones icónicos
- `:focus-visible` con outline respetado (no `outline-none` sin alternativa)
- Contraste mínimo AA (los tokens `muted-foreground` sobre `background`
  cumplen 4.5:1)
- Targets táctiles mínimo 44×44px en móvil (botones h-9 + padding lo cumplen)

## Inspiraciones

Referencias visuales que calibran el carácter:
- **Linear** — precisión, monocromía controlada, densidad
- **Attio** — calidez comercial, KPIs premium
- **Stripe Dashboard** — tablas impecables, jerarquía clara

Personalidad: **"sofisticado + eficiente"**. Ni frío como Linear, ni colorido
como Pipedrive. Un término medio profesional con toques humanos.
