---
name: byvaro-design
description: Reglas, patrones y procedimiento canónico para diseñar una pantalla o componente del proyecto Byvaro (SaaS inmobiliario, React+Tailwind, solo diseño). Úsalo CADA VEZ que el usuario pida "diseña", "crea la pantalla", "rediseña", "añade un componente", "maqueta", "monta la vista de X", o cualquier trabajo de diseño UI en este repo. También cuando revises o audites una pantalla existente para decidir si cumple el sistema visual.
---

# Byvaro · Guía de diseño

Este proyecto es un **prototipo de diseño clickable**, no producción. No hay backend, no hay auth real, no hay lógica de negocio. Todo es React estático con datos mock. Cuando trabajes aquí, **optimiza para el diseño visual y la navegación**, nunca para robustez funcional (try/catch de localStorage, error handlers de imagen, sync multi-tab, etc. son irrelevantes — no los sugieras).

## Procedimiento para una pantalla nueva

1. **Lee la spec funcional primero** en `docs/screens/<nombre>.md`. Si no existe, créala antes de codear (o pide al usuario la spec si es ambigua).
2. **Compara con `src/pages/Inicio.tsx`** — es la pantalla de referencia. Mismo espaciado, misma jerarquía tipográfica, mismos radios, mismas sombras.
3. **Reutiliza componentes existentes** antes de crear nuevos. Zonas a mirar:
   - `src/components/ui/*` — FilterBar, Tag, Switch, Checkbox
   - `src/components/crear-promocion/*` — widgets del wizard
   - `src/components/empresa/*` — EditableSection, HeroStatsStrip
   - `src/components/PlaceholderPage.tsx` — plantilla "en diseño"
4. **Usa tokens HSL siempre** (`bg-card`, `text-foreground`, `border-border`, `bg-primary`…). Nunca hex. Nunca `bg-red-500` crudo.
5. **Mobile-first desde 375 px**. Diseña el layout móvil, luego añade breakpoints `sm:`, `lg:`, `xl:`.
6. **Registra la decisión** en `DECISIONS.md` si hiciste una elección no obvia, y marca la fase en `ROADMAP.md`.

## Reglas duras del sistema visual

(Fuente canónica: `CLAUDE.md` en la raíz — léelo si dudas.)

- **Radios**: `rounded-2xl` paneles · `rounded-xl` cards · `rounded-lg` botones cuadrados · `rounded-full` pills y avatares.
- **Sombras**: `shadow-soft` en reposo, `shadow-soft-lg` en hover. Nada más.
- **Botón primario**: `bg-foreground text-background rounded-full h-9 px-4 shadow-soft`.
- **Botón secundario**: `border border-border bg-card rounded-full h-9 px-4`.
- **Iconos**: solo Lucide. `h-3.5 w-3.5` en botones, `h-4 w-4` en KPIs, `h-5 w-5` en destacados.
- **Espaciado**: `p-4 sm:p-5` mínimo en cards, `gap-3` entre items, `space-y-5` entre secciones. Max-width `max-w-[1400px]`.
- **Tipografía**: Inter. Eyebrows con `text-[10px] uppercase tracking-wider text-muted-foreground`. H1 página `text-[22px] sm:text-[28px] font-bold tracking-tight`.

## Prohibiciones

- ❌ Hex o Tailwind crudos (`#fff`, `bg-red-500`, `text-blue-600`).
- ❌ Mezclar español e inglés en UI — todo en español.
- ❌ Duplicar pantallas V1/V2 en producción. Iteraciones viejas van a `src/pages/design-previews/`.
- ❌ Botones "Exportar Excel" salvo petición explícita.
- ❌ Sugerir mejoras funcionales (validación, try/catch, A11Y focus-trap, sync) — es diseño, no producción.
- ❌ Pegar bordes a texto sin padding.

## Patrones recurrentes (reutilizar, no reinventar)

- **Master-detail** (lista ~420px izquierda + detalle derecha): Registros, Contactos, Promoción-detalle.
- **Dual-mode pages** (Promotor vs Agencia): una pantalla, props `agentMode` / `agencyMode`.
- **Selección múltiple**: barra flotante abajo `N seleccionadas · Acción · Cancelar`; en móvil a `bottom-[72px]`.
- **Tabs internos**: subrayado bajo el activo (no pills). Ver `Empresa.tsx` o `Promociones.tsx`.
- **Filter pills con selección**: cambian a `bg-foreground text-background`. Ver `MultiSelectDropdown` en `Promociones.tsx`.
- **Wizard multi-paso**: sidebar timeline izquierda + contenido + footer Atrás/Borrador/Siguiente, fade+slide 12 px entre pasos, auto-save localStorage. Ver `CrearPromocion.tsx`.

## Personas (para decidir qué mostrar)

| Persona | Ve | No ve |
|---|---|---|
| Promotor (249€) | Todo lo suyo | — |
| Agencia invitada (0€) | Promociones donde colabora | Datos de otras agencias |
| Agencia marketplace (99€) | Catálogo completo + colaboraciones | — |
| Agencia sin plan | Marketplace difuminado | Solo contadores agregados |

## Verificación antes de dar por terminado

1. Correr `npm run dev` (ya suele estar en `:8080`) y navegar a la pantalla.
2. Probar a 1600 px (desktop) y 390 px (móvil).
3. Si hay tabs/modales/interacciones, hacer click en cada una.
4. `npx tsc --noEmit` debe pasar limpio.
5. `scripts/visual-check.mjs` (Playwright) para capturas si el cambio es visual significativo.

## Qué archivos tocar típicamente

```
src/pages/<Pantalla>.tsx           ← punto de entrada, rutas en App.tsx
src/components/<pantalla>/*.tsx    ← sub-componentes propios
src/components/ui/*.tsx            ← si añades primitive reutilizable
src/data/<nombre>.ts               ← mocks (promotions, agencies, units, …)
src/lib/<nombre>.ts                ← hooks o helpers puros
docs/screens/<nombre>.md           ← spec funcional
DECISIONS.md + ROADMAP.md          ← log de cambios
```

## Cuándo preguntar en vez de inventar

Si una decisión visual/funcional no tiene precedente claro en el código ni en `docs/`, **para y pregunta**. No inventes convenciones nuevas en silencio. Si la pregunta es recurrente, añádela como `Qnueva` a `docs/open-questions.md`.
