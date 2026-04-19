# Marca Byvaro · guía de uso de los logos

## Assets

Los archivos SVG originales viven en `src/assets/`:

| Archivo | Dimensiones nativas | Uso recomendado |
|---|---|---|
| `byvaro-icon.svg` | 360 × 360 (viewBox) | isotipo cuadrado · avatares, favicons, esquinas pequeñas |
| `byvaro-logo.svg` | 935 × 243 (viewBox) | wordmark horizontal · headers, splash, footers |

Ambos usan color sólido `#1D74E7` (azul Byvaro) hardcoded en el SVG.

## Componente `<BrandLogo>`

`src/components/BrandLogo.tsx` unifica el uso de los dos SVG.

```tsx
import { BrandLogo } from "@/components/BrandLogo";

// Isotipo solo (ej. avatar pequeño)
<BrandLogo variant="icon" iconSize={32} />

// Wordmark solo (ej. hero de auth)
<BrandLogo variant="wordmark" wordmarkHeight={24} />

// Lockup (isotipo + wordmark alineados) — default
<BrandLogo variant="lockup" iconSize={32} wordmarkHeight={18} />
```

Props:

| Prop | Tipo | Default | Descripción |
|---|---|---|---|
| `variant` | `"icon" \| "wordmark" \| "lockup"` | `"lockup"` | qué renderizar |
| `iconSize` | number (px) | `32` | lado del cuadrado del icono |
| `wordmarkHeight` | number (px) | `18` | alto del wordmark |
| `className` | string | — | clases Tailwind extra para el contenedor |

## Dónde está integrado

| Componente | Variante | Tamaños |
|---|---|---|
| `src/components/AppSidebar.tsx` | lockup | icon 32 · wordmark 16 |
| `src/components/MobileHeader.tsx` (drawer) | lockup | icon 32 · wordmark 16 |
| `src/pages/Login.tsx` | lockup | icon 36 · wordmark 18 |
| `src/pages/Register.tsx` | lockup | icon 36 · wordmark 18 |

## Reglas de uso

- **Nunca** embebas el SVG directamente en otro componente — pasa por
  `<BrandLogo>` para mantener consistencia.
- **Nunca** edites los SVG manualmente con cambios visuales —si la marca
  evoluciona, reemplaza el archivo entero.
- El color actual `#1D74E7` hardcoded funciona contra fondos claros. Si
  necesitas una variante sobre fondo oscuro, añade al SVG un atributo
  `fill="currentColor"` en el `<path>` relevante y crea una variante
  `variant="icon-light"`.
- El área de respiro (clearspace) mínimo alrededor del logo es igual al
  ancho del isotipo.
- Tamaño mínimo legible: **icono 24 px · wordmark 16 px de alto**.

## Colores de marca

- Primario (logo, CTAs): `hsl(var(--primary))` → `215 72% 55%` → `#1D74E7`
- Foreground (texto principal): `hsl(var(--foreground))` → `220 15% 20%`
- Background (superficies): `hsl(var(--background))` → `210 14% 98%`

Ver `src/index.css` para la tabla completa de tokens HSL.

## Assets no incluidos (pendientes)

- Favicon `.ico` y `.png` para `public/` (TODO)
- Apple touch icon 180 × 180 (TODO)
- OG image 1200 × 630 para social preview (TODO)
- Versión del isotipo sobre fondo oscuro (TODO)
