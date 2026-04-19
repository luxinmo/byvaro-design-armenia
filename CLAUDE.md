# CLAUDE.md — Reglas del sistema Byvaro v2

> Consulta este archivo **antes** de cada implementación. Es la fuente canónica
> de reglas y convenciones del proyecto. Si cambian, actualiza este archivo
> en el mismo commit.

---

## 🎯 Qué es Byvaro

SaaS para **promotores inmobiliarios** que gestionan obra nueva y colaboran
con **agencias** externas para vender unidades. El promotor carga su cartera
de promociones, comparte unidades con agencias seleccionadas, controla los
registros de clientes que vienen de esas agencias, la agenda de visitas, las
ventas y las comisiones.

Existen **dos personas** que comparten muchas pantallas en modo "dual":

| Persona | Ve | Puede |
|---|---|---|
| **Promotor** (dueño del proyecto) | Todo | Editar todo, aprobar registros, compartir con agencias |
| **Agencia** (colaborador externo) | Solo unidades Disponibles | Registrar clientes, programar visitas, enviar fichas a cliente |

---

## 🧭 Arquitectura de información (menú)

Cuatro grupos en el sidebar, ordenados por actividad:

```
GENERAL
  Inicio

COMERCIAL
  Promociones
  Registros
  Ventas
  Calendario

RED
  Colaboradores   (antes "Agencies")
  Contactos

CONTENIDO
  Microsites      (antes "Websites")
  Emails

ADMIN (pie del sidebar)
  Ajustes
```

Detalles: ver `docs/ia-menu.md`.

---

## 🎨 Sistema de diseño (reglas duras)

**Tokens.** Todos los colores son HSL en `src/index.css`. Nunca hardcodees
hex ni colores literales en componentes. Usa siempre los tokens semánticos:
`text-foreground`, `bg-card`, `bg-primary`, `border-border`, etc.

**Tipografía.** Escala Tailwind estándar:
- `text-[10px]` para labels/eyebrows uppercase con `tracking-wider`
- `text-xs` (12px) para metadata, counters, badges
- `text-sm` (14px) para UI principal, body
- `text-base` (16px) para títulos de sección
- `text-[22px] sm:text-[28px]` para H1 de página
- Fuente: **Inter**, cargada desde Google Fonts

**Radios.**
- `rounded-2xl` — paneles, cards grandes
- `rounded-xl` — cards pequeñas, inputs, warnings, boxes secundarios
- `rounded-lg` — botones cuadrados, iconos en contenedor
- `rounded-full` — botones pill (todos los botones principales), avatars

**Sombras.**
- Reposo: `shadow-soft` = `0 2px 16px -6px rgba(0,0,0,0.06)`
- Hover: `shadow-soft-lg` = `0 4px 24px -8px rgba(0,0,0,0.1)`
- Las cards interactivas suman `hover:-translate-y-0.5 transition-all duration-200`

**Espaciado.**
- Page header: `px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8`
- Cards: `p-4 sm:p-5` (nunca menos que p-4)
- Gap entre items de lista: `gap-3`
- Space entre secciones: `space-y-5` o `gap-4 sm:gap-5`
- Max-width del contenedor: `max-w-[1400px]`

**Botones.**
- Primario: `bg-foreground text-background rounded-full h-9 px-4 shadow-soft`
- Secundario: `border border-border bg-card rounded-full h-9 px-4`
- Ghost: `text-muted-foreground hover:text-foreground hover:bg-muted rounded-full`
- Icónico: `h-8 w-8 rounded-full` o `p-2 rounded-full`

**Iconos.** Solo **Lucide React**. Tamaños:
- `h-3 w-3` en chips/badges
- `h-3.5 w-3.5` en botones
- `h-4 w-4` en headers/KPIs
- `h-5 w-5` en destacados

**Responsive.** Mobile-first desde **375px**. Breakpoints:
- `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px

---

## 🔄 Patrones recurrentes

1. **Dual-mode pages**: mismas pantallas sirven a Promotor y Agencia con
   props `agentMode` / `agencyMode`. La lógica permisos vive en la pantalla,
   no duplicamos código.

2. **Master-detail**: listas maestras (~420px) a la izquierda, detalle a la
   derecha. Usado en Registros, Contactos, Promoción-detalle.

3. **Selección múltiple**: cualquier lista seleccionable muestra una barra
   flotante abajo con "N seleccionadas · Acción · Cancelar". En móvil, la
   barra sube a `bottom-[72px]` para no chocar con el `MobileBottomNav`.

4. **Tabs internos**: en páginas con sub-secciones (ej. Colaboradores tiene
   Red / Analítica), usar Radix Tabs o replicar patrón del
   `DeveloperPromotionDetail.tsx` original (subrayado bajo el activo, no pills).

5. **Filter pills**: dropdowns que cambian a fondo negro cuando tienen
   selección (`bg-foreground text-background`). Patrón:
   `src/pages/Promociones.tsx` → `MultiSelectDropdown`.

6. **AppShell**: sidebar desktop (`AppSidebar.tsx`) + topbar fina
   (`AppHeader.tsx`) + contenido. En móvil: `MobileHeader.tsx` con drawer
   + `MobileBottomNav.tsx` con FAB central.

7. **Wizards multi-paso**: sidebar timeline izquierdo + contenido central +
   footer con Atrás/Borrador/Siguiente. Animación `fade + slide 12px` entre
   pasos. Auto-save a localStorage. Ver `src/pages/CrearPromocion.tsx`.

---

## 🚫 No hacer

- ❌ **No usar `localStorage` para roles o autenticación** (solo para drafts
  de formulario).
- ❌ **No mostrar información de compartición entre agencias** a la vista de
  Agencia.
- ❌ **No pegar bordes a texto** — siempre generoso padding.
- ❌ **No colores hardcoded**, siempre tokens HSL.
- ❌ **No botones "Exportar Excel"** salvo petición explícita.
- ❌ **No mezclar español e inglés** en UI — todo en español.
- ❌ **No duplicar pantallas V1/V2/V3** — si hay que iterar, se reemplaza, no
  se añade al lado. Las versiones antiguas viven en `src/pages/design-previews/`.
- ❌ **No saltarse la auditoría**: antes de tocar una pantalla, se compara
  con el estándar (Inicio) y se documenta qué cambios se hacen.

---

## 🛠️ Stack y convenciones de código

- **Build**: Vite 5 + React 18 + TypeScript 5.
- **Estilos**: Tailwind 3 con tokens HSL custom.
- **Routing**: React Router 6 (`BrowserRouter`).
- **Icons**: Lucide React.
- **Animación**: Framer Motion (solo para transiciones significativas).
- **Notificaciones**: Sonner.
- **Fechas**: date-fns.
- **Utilidad clases**: `cn()` en `src/lib/utils.ts` (clsx + tailwind-merge).

**Naming:**
- Archivos de páginas: `PascalCase.tsx` en `src/pages/`
- Componentes: `PascalCase.tsx` en `src/components/`
- Tipos + lógica pura: `camelCase.ts` en `src/data/`, `src/types/`, `src/lib/`
- Rutas: `kebab-case` en español (`/crear-promocion`, `/colaboradores`)

**Comentarios:** docstring al principio de cada archivo explicando QUÉ hace
y CÓMO se usa. Bloques de sección con `/* ══════ SECCIÓN ══════ */`.

**TODOs estructurados:**
```ts
// TODO(backend): POST /api/promociones con WizardState -> { id }
// TODO(ui): redirigir a /promociones/:id al recibir respuesta
// TODO(logic): implementar detector de duplicados cuando matchPercentage >= 70
```

---

## 📚 Documentación del proyecto

Carpeta `docs/` — cada archivo cubre un área:

| Archivo | Contenido |
|---|---|
| `docs/architecture.md` | Visión general, personas, flujos principales |
| `docs/ia-menu.md` | Estructura del menú nuevo vs original |
| `docs/design-system.md` | Tokens, componentes, patrones visuales |
| `docs/data-model.md` | Entidades, tipos, relaciones, reglas de negocio |
| `docs/services.md` | **Servicios externos a instalar** para producción |
| `docs/api-contract.md` | Endpoints API esperados (contract-first) |
| `docs/screens/*.md` | Spec funcional por pantalla |
| `DECISIONS.md` (raíz) | Log de decisiones de diseño/arquitectura |
| `ROADMAP.md` (raíz) | Qué está hecho, qué falta |

Cada vez que se diseña una pantalla nueva:
1. Se crea `docs/screens/<nombre>.md` con la spec funcional
2. Se añade la decisión importante a `DECISIONS.md`
3. Se actualiza `ROADMAP.md`

---

## 🚀 Cómo arrancar desarrollo

```bash
npm install
npm run dev     # http://localhost:8080
npm run build   # build de producción en dist/
```

**Requiere Node 18+**. Auto-deploy configurado a Vercel en cada push a main.

---

## 🧩 Si vas a conectar backend

Lee `docs/services.md` — lista completa de servicios necesarios (base de
datos, auth, storage, email, SMS, mapas, pagos…) con recomendaciones
concretas y orden sugerido de instalación.

Lee `docs/api-contract.md` — endpoints esperados por el frontend. Cada
página documenta sus fetches esperados en su propio archivo de
`docs/screens/`.

---

**Última actualización de estas reglas:** 19 abril 2026 · v2 (tras Fase 1 del
rediseño). Si añades una regla, anótala aquí y en `DECISIONS.md`.
