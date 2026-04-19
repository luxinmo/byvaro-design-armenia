# ROADMAP.md · Byvaro v2

Estado del diseño y plan de avance.

Leyenda: ✅ hecho · 🟡 en curso · 🎨 placeholder · ⬜ pendiente

---

## Base

- ✅ Proyecto limpio creado (Vite + React 18 + TS + Tailwind)
- ✅ Tokens HSL v2 en `src/index.css`
- ✅ AppShell (sidebar + headers desktop/mobile + bottom nav + drawer)
- ✅ Nueva IA del menú en 4 grupos
- ✅ Auto-deploy Vercel conectado
- ✅ Documentación completa (`CLAUDE.md`, `docs/`, `DECISIONS.md`)

---

## Pantallas Promotor

| Estado | Pantalla | Ruta | Notas |
|---|---|---|---|
| ✅ | Inicio | `/inicio` | Dashboard ejecutivo completo |
| ✅ | Promociones · listado | `/promociones` | 1:1 con original + diseño nuevo |
| 🟡 | Crear promoción · wizard | `/crear-promocion` | Fase 1 (shell + pasos role/tipo) |
| 🎨 | Registros | `/registros` | Placeholder |
| 🎨 | Ventas | `/ventas` | Placeholder |
| 🎨 | Calendario | `/calendario` | Placeholder |
| 🎨 | Colaboradores | `/colaboradores` | Placeholder · incluirá analítica Agencia×Nacionalidad |
| 🎨 | Contactos | `/contactos` | Placeholder |
| 🎨 | Microsites | `/microsites` | Placeholder |
| 🎨 | Emails | `/emails` | Placeholder |
| 🎨 | Ajustes | `/ajustes` | Placeholder |
| ⬜ | Promoción · detalle | `/promociones/:id` | Pantalla compleja con tabs |

---

## Pantallas Agencia (vista alternativa)

Por diseñar después de clavar la vista Promotor completa.

| Estado | Pantalla | Ruta | Notas |
|---|---|---|---|
| ⬜ | Inicio agencia | `/inicio` | Dashboard simplificado, solo datos propios |
| ⬜ | Promociones colaborables | `/promociones` | Read-only con filtro auto "disponibles" |
| ⬜ | Promotores · directorio | `/promotores` | Browse de promotores |
| ⬜ | Mis registros | `/mis-registros` | Estado de mis solicitudes |
| ⬜ | Agenda | `/agenda` | Mis visitas asignadas |
| ⬜ | Mis contactos | `/mis-contactos` | CRM propio |
| ⬜ | Ajustes | `/ajustes` | Empresa, equipo agencia |

---

## Auth & Onboarding

| Estado | Pantalla | Ruta | Notas |
|---|---|---|---|
| ⬜ | Login | `/login` | Email + password + Google |
| ⬜ | Registro | `/register` | Crear cuenta + empresa |
| ⬜ | Forgot password | `/forgot-password` | Envío de link |
| ⬜ | Reset password | `/reset-password` | Nuevo password con token |
| ⬜ | Verify code | `/verify-code` | 2FA |
| ⬜ | Onboarding | `/onboarding` | Wizard inicial post-registro |

---

## Wizard de crear promoción — desglose por pasos

| Estado | Paso | Notas |
|---|---|---|
| ✅ | Role | Promotor / Comercializador |
| ✅ | Tipo | Unifamiliar / Plurifamiliar / Mixto |
| 🎨 | Sub unifamiliar | Una sola / varias |
| 🎨 | Tipología + estilo | Según sub-uni |
| 🎨 | Config edificio | Bloques, plantas, aptos |
| 🎨 | Extras | Trasteros, parkings, locales |
| 🎨 | Estado | Proyecto / construcción / terminado |
| 🎨 | Detalles finales | Piso piloto, oficinas, entrega |
| 🎨 | Info básica | Nombre, dirección, precios |
| 🎨 | Multimedia | Fotos + videos |
| 🎨 | Descripción | IA o manual |
| 🎨 | Crear unidades | Tabla editable |
| 🎨 | Colaboradores | Comisiones, condiciones |
| 🎨 | Plan de pagos | Hitos del comprador |

---

## Fases del diseño (orden planeado)

### ✅ Fase 0 — Base
- Proyecto limpio + tokens + AppShell + IA + deploy + docs

### ✅ Fase 1 — Pantalla Inicio + Promociones listado + Crear promoción (shell + 2 pasos)

### 🟡 Fase 2 — Wizard Crear promoción (pasos 3-8)
- sub_uni, sub_varias, config_edificio, extras, estado, detalles

### ⬜ Fase 3 — Promoción · detalle completo
- Tabs Overview / Availability / Comisiones / Documents / Agencies
- Heredar el patrón horizontal de la card del listado

### ⬜ Fase 4 — Colaboradores + Analítica
- Red (listado)
- Sub-tab Analítica con heatmap Agencia × Nacionalidad

### ⬜ Fase 5 — Registros
- Master-detail con timeline, aprobación/rechazo, detector duplicados

### ⬜ Fase 6 — Contactos
- Lista + tarjetas + ficha de cliente

### ⬜ Fase 7 — Calendario
- Vista mes/semana/día/lista

### ⬜ Fase 8 — Wizard Crear promoción (pasos 9-14)
- info_basica, multimedia, descripcion, crear_unidades, colaboradores, plan_pagos

### ⬜ Fase 9 — Ventas (pipeline)

### ⬜ Fase 10 — Microsites + Emails

### ⬜ Fase 11 — Ajustes + Integraciones

### ⬜ Fase 12 — Auth + Onboarding

### ⬜ Fase 13 — Vista Agencia completa (adaptación)

### ⬜ Fase 14 — Modo oscuro

---

## Backend / Integraciones (post-diseño)

En orden sugerido — ver `docs/services.md` para detalles:

1. ⬜ Setup Supabase (Postgres + Auth + Storage) **o** alternativa
2. ⬜ Migraciones SQL desde `docs/data-model.md`
3. ⬜ Endpoints `/auth/*` + protección de rutas
4. ⬜ Endpoints `/promotions` (CRUD + listado con filtros)
5. ⬜ Subida de multimedia (presigned URLs)
6. ⬜ Endpoints `/registrations` + detector de duplicados
7. ⬜ Email transaccional (Resend) + plantillas React Email
8. ⬜ Realtime para notificaciones en tiempo real
9. ⬜ Mapas (MapBox) en dirección de promoción + location picker
10. ⬜ SMS Twilio para confirmación de visitas
11. ⬜ Sentry error monitoring
12. ⬜ Plausible analytics
13. ⬜ Stripe Connect para comisiones
14. ⬜ Microsites públicos (SSR opcional o SPA pública)

---

## Deuda técnica conocida

- Chunk del bundle > 500KB (tras añadir framer-motion) — code-splitting por
  ruta pendiente
- Los placeholders usan `alert()` y `confirm()` — sustituir por diálogos
  propios del design system
- Sin tests (Vitest configurado en el original, no se portó aún)
- Sin `eslint.config.js` configurado en el nuevo proyecto

---

## Acumulado de pantallas diseñadas vs total

**Diseñadas:** 2 (Inicio, Promociones listado) + 1 parcial (Crear promoción
Fase 1).

**Placeholders reusables:** 9 (Registros, Ventas, Calendario, Colaboradores,
Contactos, Microsites, Emails, Ajustes).

**Pantallas totales estimadas (Promotor):** 20-25.
**Pantallas totales estimadas (Agencia):** 12-15.
**Gran total con auth/onboarding:** ~40 pantallas.

Progreso aproximado: **~7%** del diseño total completo.
