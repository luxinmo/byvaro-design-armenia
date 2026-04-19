# Byvaro · Diseño v2

Plataforma SaaS para promotores inmobiliarios. Este repositorio contiene el
**diseño v2** (prototipo interactivo en React + Tailwind) listo para
servir de base a la aplicación real.

**Online:** https://byvaro-design-armenia.vercel.app

---

## Qué es esto

Un proyecto React completo, navegable y responsive con:

- ✅ Nueva arquitectura de información del menú (4 grupos + Admin)
- ✅ `AppShell` completo (sidebar desktop + headers + bottom nav móvil con FAB)
- ✅ Pantalla **Inicio** con KPIs, actividad, agenda, top colaboradores
- ✅ Pantalla **Promociones** con listado + filtros + cards horizontales
- 🟡 Wizard **Crear promoción** con shell + 2 pasos implementados
- 🎨 9 pantallas en modo placeholder con su especificación de bloques
- ✅ Mobile-first desde 375px
- ✅ Auto-deploy a Vercel en cada push a main

Stack: Vite 5 · React 18 · TypeScript 5 · Tailwind 3 · React Router 6 ·
Lucide · Framer Motion · Sonner · date-fns.

---

## 🚀 Correr en local

```bash
# requiere Node 18+
npm install
npm run dev       # http://localhost:8080
```

Scripts:
- `npm run dev` — dev server con HMR
- `npm run build` — build de producción en `dist/`
- `npm run preview` — sirve `dist/` localmente

---

## 📚 Dónde buscar qué

### Para empezar a leer

1. **`CLAUDE.md`** — reglas operativas y convenciones. **Empieza aquí** si
   vas a tocar código.
2. **`docs/architecture.md`** — qué es Byvaro, personas, flujos principales
3. **`docs/ia-menu.md`** — estructura del menú y decisiones de IA
4. **`docs/design-system.md`** — tokens, componentes, patrones visuales

### Para entender los datos

5. **`docs/data-model.md`** — entidades, tipos, relaciones, reglas de
   negocio, schema SQL sugerido

### Para conectar backend (CUANDO toque)

6. **`docs/services.md`** — servicios externos a instalar (DB, auth,
   storage, email, SMS, mapas, pagos…), con recomendaciones y costes
7. **`docs/api-contract.md`** — endpoints esperados por el frontend

### Por pantalla

8. **`docs/screens/*.md`** — una ficha por pantalla con spec funcional
   completa: qué hace, qué valida, qué endpoints espera, qué permisos,
   qué estados, cross-links

### Historia y estado

9. **`DECISIONS.md`** — log cronológico de decisiones de diseño
10. **`ROADMAP.md`** — qué está hecho, qué falta, prioridades

### Prototipos HTML originales

La carpeta **`design/`** contiene los tres prototipos HTML autocontenidos
que se diseñaron al inicio (dashboard colaboradores, auditoría de la app
original, pantalla Inicio v1). Se abren sin dependencias, útiles como
material de referencia/pitch.

---

## 🧭 Estructura del repositorio

```
byvaro-design-armenia/
├── CLAUDE.md                 ← reglas operativas
├── DECISIONS.md              ← log de decisiones
├── ROADMAP.md                ← plan de avance
├── README.md                 ← este archivo
│
├── docs/                     ← documentación funcional
│   ├── README.md
│   ├── architecture.md
│   ├── ia-menu.md
│   ├── design-system.md
│   ├── data-model.md
│   ├── services.md           ← servicios a instalar para producción
│   ├── api-contract.md       ← endpoints esperados
│   └── screens/
│       ├── inicio.md
│       ├── promociones.md
│       └── crear-promocion.md
│
├── design/                   ← prototipos HTML standalone
│   ├── byvaro-inicio.html
│   ├── byvaro-auditoria.html
│   └── byvaro-dashboard.html
│
├── src/
│   ├── App.tsx               ← rutas
│   ├── main.tsx
│   ├── index.css             ← tokens HSL
│   ├── lib/utils.ts          ← cn() helper
│   │
│   ├── components/
│   │   ├── AppLayout.tsx     ← shell (sidebar + headers + main)
│   │   ├── AppSidebar.tsx    ← sidebar desktop (nueva IA)
│   │   ├── AppHeader.tsx     ← topbar fina (breadcrumb + ⌘K + notif)
│   │   ├── MobileHeader.tsx  ← header móvil + drawer
│   │   ├── MobileBottomNav.tsx ← bottom nav con FAB central
│   │   ├── PlaceholderPage.tsx ← plantilla "próximamente"
│   │   │
│   │   ├── ui/
│   │   │   └── Tag.tsx       ← componente Tag con variantes
│   │   │
│   │   └── crear-promocion/
│   │       ├── types.ts      ← WizardState (copiado 1:1)
│   │       ├── options.ts    ← opciones de cada paso
│   │       ├── SharedWidgets.tsx ← OptionCard + steppers + summary
│   │       └── StepTimeline.tsx  ← timeline lateral del wizard
│   │
│   ├── pages/
│   │   ├── Inicio.tsx             ✅
│   │   ├── Promociones.tsx        ✅
│   │   ├── CrearPromocion.tsx     🟡 Fase 1
│   │   ├── Registros.tsx          🎨 placeholder
│   │   ├── Ventas.tsx             🎨 placeholder
│   │   ├── Calendario.tsx         🎨 placeholder
│   │   ├── Colaboradores.tsx      🎨 placeholder
│   │   ├── Contactos.tsx          🎨 placeholder
│   │   ├── Microsites.tsx         🎨 placeholder
│   │   ├── Emails.tsx             🎨 placeholder
│   │   ├── Ajustes.tsx            🎨 placeholder
│   │   └── design-previews/
│   │       └── PromocionesCardsV1.tsx ← versión anterior guardada
│   │
│   ├── data/
│   │   ├── promotions.ts           ← 6 promos mock (copiado 1:1)
│   │   ├── developerPromotions.ts  ← 5 promos developer-only
│   │   └── units.ts                ← unidades por promoción
│   │
│   └── types/
│       └── promotion-config.ts     ← tipos extraídos del original
│
├── public/
│   └── 404.html              ← SPA fallback (por si se despliega a Pages)
│
├── vercel.json               ← rewrites SPA para Vercel
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.*.json
└── package.json
```

---

## 🧩 Para montar la aplicación real a partir de este diseño

Orden sugerido — pasos detallados en `docs/services.md`:

1. **Elegir stack de backend**: Supabase (recomendado) o Neon + Vercel
   Functions
2. **Migraciones SQL** desde `docs/data-model.md` (schema de `companies`,
   `users`, `promotions`, `units`, `agencies`, `registrations`, `contacts`,
   `visits`, `sales`)
3. **Implementar auth** (`docs/api-contract.md` → sección Auth)
4. **Conectar cada pantalla uno a uno** siguiendo las specs en
   `docs/screens/*.md`. Cada spec incluye los endpoints esperados
5. **Completar el wizard** de crear promoción (pasos 3-14, ver fases en
   `ROADMAP.md`)
6. **Diseñar vista Agencia** como adaptación con permisos reducidos
7. **Añadir módulos pendientes**: Registros, Contactos, Calendario, Ventas,
   Microsites, Emails, Ajustes

---

## 🤝 Convenciones para contribuir

- Toda la documentación en **español**
- El código sigue las reglas de `CLAUDE.md`
- Antes de diseñar una pantalla nueva, revisar `docs/screens/` y añadir una
  `docs/screens/<nombre>.md` con la spec funcional en el mismo commit
- Cada decisión no trivial se añade a `DECISIONS.md`
- Se actualiza `ROADMAP.md` al completar o planear fases

---

Byvaro · Diseño v2 · abril 2026
