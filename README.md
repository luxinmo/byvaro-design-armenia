# Byvaro · Diseño v2

Proyecto de diseño limpio de la plataforma Byvaro (para promotores inmobiliarios).
Clickable, navegable, responsive. Punto de partida del rediseño del producto.

## Qué incluye

- **Nueva IA**: menú replanteado en 4 grupos (General · Comercial · Red · Contenido).
- **AppShell completo**: sidebar desktop con 236 px, header desktop, header móvil con drawer, bottom nav móvil con FAB central.
- **Pantalla Inicio** ya diseñada: KPIs con sparklines, banner de insights IA, actividad reciente, promociones activas, agenda de hoy, top colaboradores, acciones rápidas.
- **9 placeholders** para el resto de pantallas (Promociones, Registros, Ventas, Calendario, Colaboradores, Contactos, Microsites, Emails, Ajustes) — cada una documenta los bloques previstos para su diseño futuro.
- **Totalmente mobile-first**: diseñado desde 375 px en adelante.
- **Design tokens HSL** en `src/index.css` — lenguaje visual canónico Byvaro v2.

## Stack

- **Vite 5** + **React 18** + **TypeScript 5**
- **Tailwind CSS 3** con tokens HSL personalizados
- **React Router 6** (navegación client-side)
- **Lucide React** (iconos)
- `clsx` + `tailwind-merge` para componer clases

Sin dependencias innecesarias: no hay shadcn, no hay backend, no hay lógica de estado. Solo diseño enchufable.

## Cómo correrlo

```bash
# requiere Node 18+
npm install
npm run dev
```

Abre http://localhost:8080 — redirige a `/inicio`.

### Comandos

```bash
npm run dev       # servidor de desarrollo con HMR
npm run build     # build de producción en dist/
npm run preview   # sirve dist/ localmente
npm run lint      # eslint
```

## Estructura

```
src/
├── App.tsx                      # rutas (BrowserRouter)
├── main.tsx                     # entry point
├── index.css                    # tokens HSL + base Tailwind
├── lib/
│   └── utils.ts                 # helper cn()
├── components/
│   ├── AppLayout.tsx            # shell (sidebar + header + main)
│   ├── AppSidebar.tsx           # sidebar desktop (4 grupos + admin)
│   ├── AppHeader.tsx            # topbar desktop (search + notif + CTA)
│   ├── MobileHeader.tsx         # header móvil + drawer
│   ├── MobileBottomNav.tsx      # bottom nav móvil (5 tabs + FAB)
│   └── PlaceholderPage.tsx      # plantilla de pantalla "en diseño"
└── pages/
    ├── Inicio.tsx               # ✅ diseñada
    ├── Promociones.tsx          # 🎨 placeholder
    ├── Registros.tsx            # 🎨 placeholder
    ├── Ventas.tsx               # 🎨 placeholder
    ├── Calendario.tsx           # 🎨 placeholder
    ├── Colaboradores.tsx        # 🎨 placeholder
    ├── Contactos.tsx            # 🎨 placeholder
    ├── Microsites.tsx           # 🎨 placeholder
    ├── Emails.tsx               # 🎨 placeholder
    └── Ajustes.tsx              # 🎨 placeholder

design/                          # prototipos HTML standalone
├── byvaro-inicio.html           # Inicio (igual al que ves en /inicio)
├── byvaro-auditoria.html        # auditoría + propuesta de IA
└── byvaro-dashboard.html        # dashboard colaboradores (concepto original)
```

## Principios de diseño

Fijados en CLAUDE.md del proyecto original, reforzados aquí:

- **Minimalismo total**: líneas limpias, sin ruido visual.
- **Botones pill** para acciones primarias; secundarios minimalistas.
- **Tipografía**: escala Tailwind estándar (`text-xs` 12 px, `text-sm` 14 px, `text-base` 16 px).
- **Espaciado generoso**: `p-4` mínimo en tarjetas, `gap-3`+, `space-y-5` entre secciones.
- **Bordes**: `rounded-2xl` paneles, `rounded-xl` cards, `rounded-full` botones.
- **Sombras**: una sola capa suave (`shadow-soft`).
- **Colores**: SIEMPRE tokens HSL semánticos. Nunca hex hardcoded.
- **Mobile-first**: diseño desde 375 px, luego escala.

## Hoja de ruta

- [x] **Fase 1** · Auditoría de la app original + nueva IA del menú
- [x] **Fase 2** · Lenguaje visual + AppShell + Inicio
- [ ] **Fase 3** · Promociones · listado
- [ ] **Fase 4** · Promociones · detalle
- [ ] **Fase 5** · Colaboradores (listado + analítica Agencia×Nacionalidad)
- [ ] **Fase 6** · Registros
- [ ] **Fase 7** · Contactos
- [ ] **Fase 8** · Calendario
- [ ] **Fase 9** · Ventas (pipeline)
- [ ] **Fase 10** · Microsites + Emails
- [ ] **Fase 11** · Ajustes + Auth
- [ ] **Fase 12** · Vista Agencia (adaptación de todo lo anterior)

## Deploy

El proyecto se despliega perfectamente en **Vercel** o **Netlify** sin configuración:

1. Importa el repo en el proveedor
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`

La URL pública es perfecta para enseñar iteraciones a stakeholders.

---

Byvaro · Diseño v2 · abril 2026
