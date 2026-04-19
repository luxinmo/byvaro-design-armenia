# Dependencias del proyecto

Inventario completo de dependencias de `package.json` (versión actual en
el momento de escribir este doc). Cada fila explica para qué sirve el
paquete y dónde se usa dentro del repo, para que un tercero pueda
entender el porqué de cada dependencia sin leer el código.

> Mantener sincronizado con `package.json`. Si añades o quitas deps,
> actualiza este archivo en el mismo commit.

## Core

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `react` | `^18.3.1` | Librería base de UI. | Todo el código `.tsx`. |
| `react-dom` | `^18.3.1` | Render de React en DOM (cliente). | `src/main.tsx`. |
| `typescript` | `^5.8.3` | Tipado estático. | Todo el proyecto (`tsconfig.*`). |
| `vite` | `^5.4.19` | Dev server + bundler. | `vite.config.ts`, scripts `dev`/`build`. |
| `@vitejs/plugin-react-swc` | `^3.11.0` | Plugin Vite que usa SWC (más rápido que Babel) para JSX. | `vite.config.ts`. |

## Routing

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `react-router-dom` | `^6.30.1` | Enrutado SPA (Routes, Link, useNavigate, useParams). | `src/App.tsx` y todas las pantallas que navegan (`Login`, `Register`, `CrearPromocion`, `Promociones`, `PromocionDetalle`, etc.). |

## Estilo

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `tailwindcss` | `^3.4.17` | Utility-first CSS. Base del sistema de diseño. | `tailwind.config.ts`, `src/index.css`, todas las clases `className` del proyecto. |
| `tailwindcss-animate` | `^1.0.7` | Plugin con utilidades de animación (`animate-in`, `fade-in`, etc.). | `tailwind.config.ts` (plugin). |
| `autoprefixer` | `^10.4.21` | Añade prefixes CSS según `browserslist`. | `postcss.config.js`. |
| `postcss` | `^8.5.6` | Pipeline CSS que usa Tailwind + Autoprefixer. | `postcss.config.js`. |
| `clsx` | `^2.1.1` | Composición condicional de clases CSS. | `src/lib/utils.ts` (`cn()`), usado en casi todos los componentes. |
| `tailwind-merge` | `^2.6.0` | Resuelve conflictos de clases Tailwind (gana la última). | `src/lib/utils.ts` (`cn()`). |
| `class-variance-authority` | `^0.7.1` | Definir variantes tipadas de clases. | Componentes UI que tienen `variant`/`size` (preparado para badges/botones variant-based). |

## UI primitives (Radix)

Usados principalmente por los componentes UI compartidos (`src/components/ui/*`)
y puntualmente por formularios/modales.

| Paquete | Versión | ¿Para qué sirve? |
|---|---|---|
| `@radix-ui/react-avatar` | `^1.1.11` | Avatar con fallback accesible. |
| `@radix-ui/react-checkbox` | `^1.3.3` | Checkbox accesible. |
| `@radix-ui/react-dialog` | `^1.1.15` | Modal / Dialog con focus trap. |
| `@radix-ui/react-dropdown-menu` | `^2.1.16` | Menú desplegable con navegación por teclado. |
| `@radix-ui/react-label` | `^2.1.8` | `<label>` ligado correctamente a controles. |
| `@radix-ui/react-popover` | `^1.1.15` | Popovers anclados con posicionamiento. |
| `@radix-ui/react-progress` | `^1.1.8` | Barra de progreso accesible. |
| `@radix-ui/react-scroll-area` | `^1.2.10` | Scroll area estilizable. |
| `@radix-ui/react-select` | `^2.2.6` | Select custom accesible. |
| `@radix-ui/react-separator` | `^1.1.8` | Divisor semántico. |
| `@radix-ui/react-slot` | `^1.2.4` | `asChild` pattern para composición. |
| `@radix-ui/react-switch` | `^1.2.6` | Toggle switch. |
| `@radix-ui/react-tabs` | `^1.1.13` | Tabs accesibles. |
| `@radix-ui/react-tooltip` | `^1.2.8` | Tooltips con delay y colisión. |

> Las pantallas `Login` y `Register` **no** usan Radix: sus controles
> son `<input>` / `<button>` nativos por requisito del sistema
> (ver `docs/screens/auth.md`).

## Iconos

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `lucide-react` | `^0.462.0` | Librería oficial de iconos del sistema. **Único pack permitido.** | Todas las pantallas y componentes. En `Login.tsx` (`Mail`, `Lock`, `Eye`, etc.) y `Register.tsx` (`User`, `Building2`, `Check`…). |

## Feedback / utilidades UI

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `sonner` | `^2.0.7` | Toasts no bloqueantes. | `Login.tsx`, `Register.tsx`, `CrearPromocion.tsx`, `Empresa.tsx`, etc. Cada pantalla fullscreen monta su propio `<Toaster>`. |
| `framer-motion` | `^12.38.0` | Animaciones declarativas. | `CrearPromocion.tsx` (transiciones de paso del wizard), micro-animaciones de UI. |
| `date-fns` | `^4.1.0` | Utilidades de fechas sin pesar lo que un `moment`. | `Calendario`, formateo de fechas en `Inicio`, `PromocionDetalle`. |
| `zod` | `^4.3.6` | Validación de schemas. | Preparado para validación de formularios server-side; aún poco usado. |

## Mapas

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `leaflet` | `^1.9.4` | Motor de mapas ligero (OSM). | Pantallas con mapa (Promoción detalle, microsite). |
| `react-leaflet` | `^4.2.1` | Bindings de Leaflet para React. | Lo mismo que `leaflet`. |
| `@types/leaflet` | `^1.9.21` | Tipos TS para Leaflet. | Solo dev-time. |

## Varias

| Paquete | Versión | ¿Para qué sirve? | Dónde se usa |
|---|---|---|---|
| `qrcode` | `^1.5.4` | Generación de QR (PNG/SVG/DataURL). | Microsite / invitaciones con QR. |

## Dev-only

| Paquete | Versión | ¿Para qué sirve? |
|---|---|---|
| `@types/node` | `^22.16.5` | Tipos de Node para `vite.config.ts`, `path`, etc. |
| `@types/react` | `^18.3.23` | Tipos de React. |
| `@types/react-dom` | `^18.3.7` | Tipos de ReactDOM. |
| `playwright` | `^1.59.1` | E2E/visual testing. Aún pendiente de wiring en CI. |

## Reglas implícitas

1. **Iconos**: solo `lucide-react`. No añadir `@heroicons/*` ni
   `react-icons`.
2. **Colores**: solo tokens HSL declarados en `src/index.css`. Nunca
   hex literal ni clases `bg-red-500` (salvo excepciones justificadas
   en este doc).
3. **shadcn**: prohibido añadir nuevos componentes shadcn. Las pantallas
   nuevas usan HTML nativo + Tailwind.
4. **Añadir dep nueva**: requiere justificación en PR y entrada en
   esta tabla.
