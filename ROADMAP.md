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
| 🟢 | Calendario | `/calendario` | 4 vistas + multi-calendario + conflicto duro + Google sync (mock) · ADR-056 |
| ✅ | Colaboradores | `/colaboradores` | Red + Analítica (KPIs · Top 5 · Heatmap · Conversión) |
| 🎨 | Contactos | `/contactos` | Placeholder |
| 🎨 | Microsites | `/microsites` | Placeholder |
| 🟡 | Emails | `/emails` | Paso 1 hecho (doc + tipos + data). Falta UI |
| 🎨 | Ajustes | `/ajustes` | Placeholder |
| ✅ | Promoción · detalle | `/promociones/:id` | Ficha con 6 tabs (Información · Disponibilidad · Multimedia · Docs · Colaboradores · Registros) |

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
| ✅ | Multimedia | Fotos drag&drop + videos (YouTube / upload / 360°) |
| ✅ | Descripción | IA o manual · traducciones en 8 idiomas |
| ✅ | Crear unidades | Lista editable con multimedia por unidad |
| ✅ | Colaboradores | Comisiones nac/intl · condiciones · forma de pago |
| ✅ | Plan de pagos | Contrato · manual con % · certificaciones por fase · reserva |
| ✅ | Revisión | Resumen por fase + publicación |

---

## Fases del diseño (orden replanteado por valor de negocio)

> **Criterio de priorización:** primero lo que diferencia Byvaro de
> competidores (microsites + IA duplicados + marketplace). Después la
> operativa. Analítica al final.

### ✅ Fase 0 — Base
Proyecto limpio + tokens + AppShell + IA del menú + deploy + docs completa.

### ✅ Fase 1 — Pantalla Inicio + Promociones listado + Crear promoción (shell + 2 pasos)

### 🟡 Fase 2 — Wizard Crear promoción completo
Todos los pasos restantes del wizard:
  - sub_uni, sub_varias, config_edificio, extras
  - estado, detalles
  - info_basica (con dirección + MapBox), multimedia (drag&drop), descripcion
  - crear_unidades, colaboradores, plan_pagos

Sin completar este wizard no se puede ni probar el flujo principal.

### ⬜ Fase 3 — Registros (con IA de duplicados · núcleo del valor)
Master-detail. Listado a la izquierda, timeline a la derecha. Modal de
decisión con recomendación IA pre-cargada. **40% del valor del producto.**

### ⬜ Fase 4 — Microsites públicos (núcleo del valor)
- Microsite auto-generado al activarse una promoción
- Plantilla con branding del promotor
- Formulario de captación → crea registro automático
- Configuración de dominio custom

**30% del valor del producto.** No puede faltar.

### ⬜ Fase 5 — Onboarding de agencia con magic link
- Template de email de invitación
- Pantalla de crear contraseña post-link
- Vista agencia-invitada con la promoción

### ⬜ Fase 6 — Marketplace con paywall
- Listado de promociones para agencia con plan (catálogo completo)
- Misma listado **difuminado** para agencia sin plan
- Modal de upgrade (Stripe Checkout)
- Banner sticky "modo gratuito"

### ⬜ Fase 7 — Promoción · detalle completo (Promotor + Agencia)
Tabs Overview / Availability / Comisiones / Documents / Agencies.

### ⬜ Fase 8 — Vista Agencia completa (adaptación de pantallas)
- Inicio agencia · Promociones colaborables · Mis registros · Agenda · Mis contactos

### 🟢 Fase 9 — Contactos (CRM)

Ficha de contacto completa con 8 tabs operativos. Spec en
[`docs/screens/contactos-ficha.md`](docs/screens/contactos-ficha.md).

- ✅ Resumen (info personal · datos de contacto · idiomas · tags · sidebar)
- ✅ Historial (audit log con sub-pills + editor de comentarios inline · ADR-040 + ADR-041)
- ✅ Registros (bandeja cronológica con KPIs)
- ✅ Operaciones (banner activa + Oportunidades + Leads · estilo Lovable · ADR-042)
- ✅ Visitas (con evaluación y tareas pendientes)
- ✅ Documentos (subir, preview, share por email/WhatsApp)
- ✅ Emails (vista resumen · siempre deep-link a /emails · ADR-045)
- ✅ WhatsApp (modal lateral · backdrop blur · 920px · ADR-043)
- ✅ Catálogo dinámico de tipos de relación (`/ajustes/contactos/relaciones` · ADR-044)
- ✅ Documentación canónica de permisos ([`docs/permissions.md`](docs/permissions.md))
- ⬜ Listado `/contactos` con filtros + visibilidad por ownership
- ✅ Pipeline unificado dentro de Lead · sin entidad Oportunidad separada (ADR-053 · revierte ADR-052)
- ✅ UI renombrada a "Oportunidades" · ruta `/oportunidades` · Lead ya no existe como concepto (ADR-053)
- ✅ Listado `/oportunidades` con KPIs clickeables por etapa · segmented · thumbnail promoción · responsable único · referencia `OPP-XXXX`
- ✅ Ficha interior `/oportunidades/:id` con tabs (Actividad/Emails/Docs/Registros) + LeadEntryEvent con foto 125×85 + 3 botones No/Sí/Interés · pipeline bar queda como mejora futura
- ✅ Email + WhatsApp del header replican ContactSummaryTab (Link a /emails + ContactWhatsAppDialog modal)
- ✅ Departamentos gestionables en `/ajustes/empresa/departamentos` + hook canónico `useDepartments()` (ADR-054)
- ✅ Catálogo ISO 3166-1 completo (245 países) en `phoneCountries.ts` (ADR-054)
- ✅ Fix global del scroll en Popover/Dropdown/Select dentro de Dialogs · 3 wrappers canónicos (ADR-055)
- ✅ JobTitlePicker bloquea 3º selección con banner + Limpiar (ADR-055)
- ⬜ Pipeline bar visual + selector de etapa en la ficha de oportunidad
- ⬜ Implementar gating de permisos por ownership en todos los listados (deuda en `docs/permissions.md` §6)

### 🟢 Fase 10 — Calendario · agenda unificada (ADR-056)

Una sola pantalla donde conviven **todos los tipos** de evento del
equipo: visitas, llamadas, reuniones, bloqueos y recordatorios. Spec
en [`docs/screens/calendario.md`](docs/screens/calendario.md).

- ✅ Modelo único `CalendarEvent` con union discriminada por tipo + seed
  con 24 eventos mock (`src/data/calendarEvents.ts`)
- ✅ Helpers de fecha/hora (`src/lib/calendarHelpers.ts`)
- ✅ Store reactivo con CRUD + `findConflict()` (`src/lib/calendarStorage.ts`)
- ✅ Página `/calendario` con 4 vistas: Semana (default desktop) · Mes ·
  Día · Agenda
- ✅ Multi-calendario · sidebar con carriles por agente toggleables + color
- ✅ `CreateCalendarEventDialog` con **detección de conflicto dura**
  (banner rojo + CTA "Ir al evento en conflicto" + botón disabled)
- ✅ CTA "Programar visita" en ficha de oportunidad → dialog con preset
- ✅ Widget "Hoy" en Inicio alimentado por el calendario real
- ✅ `/ajustes/calendario/sync` con mock Google Calendar por miembro
- ✅ Mobile Apple Calendar-like: grid del mes con dots + lista del día
  seleccionado + FAB
- ⬜ Google Calendar OAuth + cron bidireccional (TODO backend)
- ⬜ Export `.ics` + envío al cliente por email/WhatsApp (TODO backend)
- ⬜ Ajustes secundarios (`/ajustes/calendario/horario`, `duracion`,
  `recordatorios`) quedan como placeholder

### ⬜ Fase 11 — Ventas (pipeline)

### ⬜ Fase 12 — Colaboradores + Analítica Agencia × Nacionalidad

### 🟡 Fase 13 — Emails · cliente Gmail + plantillas + campañas

Cliente de correo completo portado del ref (`figgy-friend-forge`).
Dependencias y plan detallado en [`docs/screens/emails.md`](docs/screens/emails.md).

- ✅ Paso 1 — Doc + tipos + mocks (`accounts.ts`, `signatures.ts`, `emails.md`)
- ⬜ Paso 2 — `EmailSetup` + wrapper `Emails.tsx` (onboarding con providers)
- ⬜ Paso 3 — `GmailInterface` layout (sidebar + lista + detalle)
- ⬜ Paso 4 — `AccountSwitcher` + bandeja unificada
- ⬜ Paso 5 — `InlineReply` (editor enriquecido Reply/Forward)
- ⬜ Paso 6 — `SignatureManagerDialog`
- ⬜ Paso 7 — `ManageAccountsDialog` (cuentas + delegación + IMAP)
- ⬜ Paso 8 — Sub-rutas de `/ajustes/email/*` (firma, plantillas, auto-respuesta, SMTP)

### ⬜ Fase 14 — Ajustes · Empresa, Equipo, Facturación

### ⬜ Fase 15 — Auth completo (Login, Register, Forgot, Verify, Reset, Onboarding promotor)

### ⬜ Fase 16 — Integraciones (WhatsApp, n8n, S3, portales)
Definidas con el promotor en una fase posterior.

### ⬜ Fase 17 — Modo oscuro

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
