# CLAUDE.md — Reglas del sistema Byvaro v2

> Consulta este archivo **antes** de cada implementación. Es la fuente canónica
> de reglas y convenciones del proyecto. Si cambian, actualiza este archivo
> en el mismo commit.
>
> 🛑 **IMPORTANTE**: si al implementar una pantalla/feature te encuentras con
> una decisión ambigua, **NO inventes**. Revisa primero `docs/open-questions.md`
> — si la pregunta está listada ahí, detente y pregunta a Arman. Si no está,
> añádela como `Qnueva` en ese mismo documento en el PR actual.

---

## 🥇 REGLA DE ORO · Backend acoplado · helpers permanentes

> **Desde 2026-04-29 · cada cambio en el producto que toque datos se
> hace frontend + backend a la vez. Los helpers de `src/lib/*` son la
> frontera estable: cuando este Supabase cambie por backend custom o
> por cualquier otra cosa, lo único que cambia es la implementación
> interna de los helpers · componentes y páginas siguen iguales.**

### Las 5 leyes

1. **Cero `supabase.from(...)` en componentes / páginas.** Toda
   interacción con Supabase pasa por un helper de `src/lib/*`.
   Excepciones documentadas: `supabaseClient.ts` (cliente singleton),
   `supabaseHydrate.ts` (hidratador), `Login.tsx` (auth boundary),
   `SupabaseHydrator.tsx` (event subscription).
2. **Cero `localStorage.(get|set)Item("byvaro-...")` en componentes.**
   localStorage es un detalle de implementación del helper, no del UI.
3. **Toda tabla nueva → migración SQL + RLS + bridge view en `api`
   schema + helper TS + hidratación + test E2E + doc backend.**
   Sin uno de estos pasos, la feature no está completa.
4. **Toda mutación es write-through · optimistic local + Supabase
   async.** UI refresca instantáneo, backend recibe la escritura,
   si falla se loggea (no silencioso para siempre · phase 3 añade
   retry/queue).
5. **Multi-tenant por defecto · `organization_id` en cada tabla
   business · RLS desde día 1.** Sin `organization_id` no hay
   aislamiento posible y el privacy gap es seguro.

### Antes de cerrar cualquier PR que toque datos

- [ ] ¿La tabla existe en Supabase? · `psql "$SUPABASE_DB_URL" -c "\dt public.*"`.
- [ ] ¿Tiene RLS habilitada y al menos una policy?
- [ ] ¿Tiene su bridge view en `api.*` con `security_invoker = on`?
- [ ] ¿Existe el helper en `src/lib/<feature>Storage.ts`?
- [ ] ¿El helper tiene write-through a Supabase + dispatch event?
- [ ] ¿El componente USA solo el helper · sin tocar Supabase ni localStorage?
- [ ] ¿El hydrator pulla la tabla al login si los datos se renderizan tras login?
- [ ] ¿`grep -rE "supabase\.from\(" src/components src/pages` devuelve 0 resultados (excluyendo Login.tsx)?
- [ ] ¿`npx tsc --noEmit && npx vite build` pasa?
- [ ] ¿Test E2E que verifica persistencia cross-device?

### Patrón canónico · merge en JSONB metadata

Sub-documentos del frontend que extienden una entidad sin justificar
columnas dedicadas (avatar, idiomas, tags, relations, documentos no
binarios, ajustes workspace-scoped) se mergean en el campo `metadata`
JSONB de la tabla padre. **Nunca tocar la columna directamente desde
componentes** · usar siempre los helpers canónicos:

- **`mergeContactMetadata(contactId, patch)`** · `src/lib/contactMetadataSync.ts`
  · Merge atómico en `contacts.metadata` (RLS por org). Pre-auth skip.
- **`mergeOrgMetadata(patch)`** · `src/lib/orgMetadataSync.ts` · Merge
  atómico en `organization_profiles.metadata` via RPC SECURITY DEFINER
  `merge_org_metadata(p_org_id, p_patch)`. La RPC permite a cualquier
  miembro mergear `metadata` SIN tocar columnas admin-only (license,
  founded_year, etc.) que siguen protegidas por la policy
  `profiles_update_admin`.

Cuándo NO usar este patrón · datos relacionales con queries propias
(JOIN, WHERE), payloads >1MB, cualquier cosa que requiera índices.
Esos van a tabla dedicada con FK.

### Doc canónico completo

**`docs/backend-development-rules.md`** — patrones, plantillas de
helper, plantillas de RLS, naming conventions, migration workflow,
checklists, anti-patterns prohibidos, estado actual de helpers.

**Léelo entero la primera vez · revisa la sección relevante en cada
PR.**

---

## 🚀 FASE 1 · Backend real · Single Source of Truth

> Bloque obligatorio para cualquier agente que toque plan, paywall, billing,
> contadores de uso, mutaciones de promociones/agencias/registros, o
> endpoints del backend. Si tu tarea no aplica, sáltalo · pero léelo igual
> para no romper invariantes.

### 1 · Project context · prototipo vs producción

Byvaro **comenzó como un prototipo frontend** (Vite + React + TypeScript)
sobre mocks en `localStorage` y archivos seed `.ts`. Esa capa es útil para
iterar UX y validar el modelo, pero **NO es producción** y **NO es la fuente
de verdad** del paywall.

- ❌ `localStorage.byvaro.plan.v1` → mock de prototipo · no confiable.
- ❌ Counters de `src/lib/usage.ts` derivados de seeds → no representan
  estado real.
- ❌ `useUsageGuard()` cliente → solo advisory · **un cliente puede mentir**.
- ❌ `subscribeToPromoter249()` mock que muta localStorage → no procesa pago.
- ✅ **El backend es la única fuente de verdad** del plan, los counters y los
  gates. Valida siempre en servidor; asume que el cliente puede haber sido
  manipulado (`devtools`, `localStorage.setItem('byvaro.plan.v1', 'promoter_249')`).

El backend **no está implementado todavía**. El contrato completo vive en
`docs/backend-integration.md §12` y debe seguirse al pie de la letra cuando
se implemente.

### 2 · Modelo de negocio · SOURCE OF TRUTH

- **Promotores (developers) pagan 249€/mes + IVA** · postpago · sin permanencia.
- **Agencias gratis en Fase 1** · ningún gate aplica a `kind='agency'`.
- **Plan vive a nivel `organization` (workspace)** · nunca por `user`.
- **Solo developers se monetizan** en Fase 1.
- **El counter `acceptRegistro` cuenta SOLO registros con `origen: "collaborator"`** (de agencias). Walk-ins del promotor, portales (Idealista, Fotocasa…) y registros directos NO consumen cupo · son leads del propio promotor. Ver `docs/portal-leads-integration.md`.

| Tier | Promociones activas | Agencias invitadas | Registros recibidos |
|---|---:|---:|---:|
| `trial` | 2 | 5 | 40 |
| `promoter_249` | 5 (cap producto) | ∞ | ∞ |

**Stripe es la única autoridad que activa `promoter_249`** (vía webhook
`customer.subscription.created`). Ningún path de aplicación lo activa.

### 3 · Frontend vs Backend · responsabilidades

| Lógica | Vive en |
|---|---|
| Renderizar `<UpgradeModal>` con `{ trigger, used, limit }` | Frontend |
| Pintar `<UsagePill>` ámbar al ≥80% | Frontend |
| Hint `useUsageGuard()` para deshabilitar UI | **Frontend (advisory)** |
| **Decidir si una mutación se permite** | **Backend** |
| **Contar promociones / agencias / registros** | **Backend** (`workspace_usage()`) |
| **Tier vigente del workspace** | **Backend** (`workspace_plans`) |
| **Cobrar 249€** | **Stripe Checkout + webhook backend** |
| Persistir `paywall_events` (tracking) | Backend |
| Idempotencia de webhooks Stripe | Backend (`stripe_events_processed`) |

**Regla**: la lógica del cliente NO es de confianza.

### 4 · Paywall enforcement · NON-NEGOTIABLE

Cada endpoint mutante que consume cuota debe:
1. Resolver `(orgId, userId)` desde auth.
2. Si `org.kind !== 'developer'` → skip gate (agencias gratis).
3. Else: leer tier de `workspace_plans` y counters de `workspace_usage(orgId)`.
4. Si `used >= limit` → responder con HTTP 402 en el shape canónico:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```
```json
{
  "code": "limit_exceeded",
  "trigger": "createPromotion" | "inviteAgency" | "acceptRegistro",
  "tier": "trial" | "promoter_249",
  "used": 2,
  "limit": 2
}
```

5. Else: continuar con la acción.

El cliente lee el 402 y abre `<UpgradeModal>` con `{ trigger, used, limit }`.
**El shape es fijo** · no inventes campos.

#### Endpoints con gate

| Endpoint | Trigger | Trial | Pagado |
|---|---|---:|---:|
| `POST /api/promotions` (status=active) o `PATCH /api/promotions/:id` (transición a active) | `createPromotion` | 2 | 5 |
| `POST /api/agency-invitations` | `inviteAgency` | 5 | ∞ |
| `POST /api/registrations` | `acceptRegistro` | 40 | ∞ |

`createPromotion` es race-sensitive (margen 0 entre 2 y 3) · usar
`SERIALIZABLE` o `pg_advisory_xact_lock`. Los otros dos toleran `read
committed` con check pre-insert.

### 5 · Architecture principles

- **Multi-tenancy vía `organizations`.** Cada fila tiene `organization_id` ·
  RLS Postgres + `app.current_org` per request.
- **Plan en `organizations`, nunca en `users`.** Un usuario con 2
  memberships tiene 2 planes independientes.
- **Stripe = única fuente de verdad de billing.** Solo el webhook muta `tier`.
  Webhook idempotente con `stripe_events_processed`.
- **Counters server-side on-demand.** `count(*)` desde tablas reales con
  índices · jamás cachear en cliente. No materializar en Fase 1.
- **Solo developers gated.** `kind='agency'` early-return en
  `assertWithinLimit`.
- **Backend es la única autoridad.** Frontend mirror, nunca al revés.
- **Plan downgrade · grandfather.** Cancelar `promoter_249` con 4 promos
  activas mantiene las 4. Solo se bloquea la siguiente.

### 6 · Implementation protocol · MANDATORY

Antes de escribir código para una feature nueva:

1. **Validar contra el modelo de negocio.** ¿Sirve a "promotores pagan
   249€/mes"? Si no, stop.
2. **Verificar scope Fase 1.** Si pertenece a Phase 2+, deferir.
3. **Decidir si necesita enforcement backend.** Toda acción que consuma
   cuota requiere `assertWithinLimit()` server-side.
4. **Asegurar que el paywall no se puede bypassear.** Gate en endpoint
   mutante, no solo en UI.
5. **Mantener implementación mínima.** Cero abstracciones nuevas, cero
   optimización prematura, cero limpieza no relacionada.

Si una decisión es ambigua, stop y pregunta. Añádela a
`docs/open-questions.md` en el mismo PR.

### 7 · DO NOT · reglas estrictas

- ❌ Replicar lógica de localStorage en el backend.
- ❌ Confiar en counters/plan que vengan del cliente.
- ❌ Añadir nuevos pricing models (anuales, descuentos, proration,
  multi-currency).
- ❌ Añadir personas nuevas (property owners, marketplace, commercializers).
- ❌ Expandir más allá de Fase 1 (AI, contratos firmados, advanced
  analytics).
- ❌ Sobre-ingeniería (counters materializados prematuros, microservicios,
  CQRS, event sourcing en Fase 1).
- ❌ Activar `tier='promoter_249'` desde cualquier sitio que no sea el
  webhook Stripe.
- ❌ Aplicar gates a agencias.

### 8 · Backend status

**El backend NO está implementado.** Solo existe el prototipo frontend.

La spec completa está en:
- `docs/backend-integration.md §12` — DDL, endpoints, webhooks, enforcement,
  migration plan.
- `docs/screens/ajustes-plan.md` — contrato UI de `/ajustes/facturacion/plan`.
- `DECISIONS.md` ADR-058 — razones del diseño.

El backend debe incluir:

| Componente | Propósito |
|---|---|
| `organizations`, `users`, `memberships` | Multi-tenancy + auth |
| `workspace_plans` | Estado del plan |
| `promotions`, `agency_invitations`, `registrations` | Entidades counted |
| `workspace_usage()` SQL function | Única fuente de los counters |
| `assertWithinLimit()` middleware | Enforcement en los 3 mutantes |
| Stripe Checkout + Customer Portal + webhook | Billing |
| `paywall_events` | Tracking de validación |
| `stripe_events_processed` | Webhook idempotency |
| RLS en cada tabla multi-tenant | Aislamiento de datos |

Estimado: ~6 días de un backend engineer hasta production-ready.

### 9 · Validation first · IMPORTANT

Antes de invertir en backend, **validar willingness-to-pay** con el
prototipo frontend. **Tracking ya implementado** en
`src/lib/analytics.ts` con 4 eventos:

| Evento | Origen |
|---|---|
| `paywall.shown` | `<UpgradeModal>` al abrir |
| `paywall.subscribe_clicked` | CTA "Suscribirme · 249€/mes" |
| `paywall.dismissed` | X / "Más adelante" / overlay / ESC |
| `usage_pill.clicked` | `<UsagePill>` ámbar del header |

Cada evento incluye `{ trigger, tier, used, limit, route, userRole,
organizationId, timestamp }`.

Despacho actual: `console.info` siempre + `window.posthog.capture()` si
el snippet está cargado. Para activar PostHog en producción ver
**`docs/validation/paywall-validation.md`** (instrucciones de cableado +
métricas + umbrales de decisión).

**Umbrales de decisión** (resumen · spec completa en el doc):
- Conversion `subscribe_clicked / shown` ≥ **20-30%** sostenido 14 días →
  arrancar Phase 1B (backend real + Stripe).
- < 20% → iterar copy/límites/oferta antes de escribir backend.

El CTA del prototipo hoy mockea `setPlan('promoter_249')` · mantenerlo
así durante validación. Billing real es Phase 1B.

### 10 · Final goal · qué define éxito en Fase 1

El sistema debe:

→ **Enforce el paywall correctamente** (servidor = única fuente de verdad)
→ **Permitir que los promotores paguen** (Stripe + 249€/mes funcional)
→ **Garantizar la integridad de datos** (RLS + transacciones + multi-tenancy)

**Nada más importa en Fase 1.** Cualquier propuesta que no contribuya
directamente a uno de estos 3 puntos queda fuera de scope.

### Referencias canónicas

- `docs/backend-integration.md §12` · contrato backend completo.
- `docs/screens/ajustes-plan.md` · spec de la pantalla.
- `DECISIONS.md` ADR-058 · paywall Phase 1.
- Prototipo frontend (NO replicar lógica al backend):
  - `src/lib/plan.ts`, `src/lib/usage.ts`, `src/lib/usageGuard.ts`,
    `src/lib/usagePressure.ts`
  - `src/components/paywall/{UpgradeModal,UsagePill}.tsx`
  - `src/pages/ajustes/facturacion/plan.tsx`
  - `src/pages/CrearPromocion.tsx` · gate `createPromotion`
  - `src/components/empresa/InvitarAgenciaModal.tsx` · gate `inviteAgency`
  - `src/pages/Registros.tsx` · gate `acceptRegistro`

---

## 🎯 Qué es Byvaro

SaaS para promotores inmobiliarios de obra nueva. Dos problemas clave que
resuelve:

1. **Web de la promoción incluida** → microsite auto-generado por promoción
2. **IA de duplicados** → analiza si un registro entrante ya existe en
   contactos del promotor o en registros previos al mismo promotor

**Modelo**: promotor paga 249€/mes · agencia invitada 0€ · agencia que
accede al marketplace 99€/mes. Sin fees por venta.

**Tres personas**:

| Persona | Paga | Ve | Puede |
|---|---|---|---|
| **Promotor** | 249€/mes | Todo lo suyo | Crear promociones, invitar agencias, aprobar/rechazar registros, microsite, analítica |
| **Agencia invitada** | 0€ | Promociones donde colabora | Registrar clientes, visitas, fichas. NO datos sensibles de otras agencias |
| **Agencia marketplace** | 99€/mes | Catálogo completo + las promociones donde colabora | Solicitar colaboración a promotores nuevos |
| **Agencia sin plan** | 0€ | Marketplace con todo difuminado | Solo contadores agregados, filtros funcionales, nada más |

Lectura obligatoria: **`docs/product.md`** (modelo de negocio, diferencial,
flujos críticos).

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
  Colaboradores       (antes "Agencies")
  Contratos           (contratos de colaboración · globales · cruzando agencias)
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
- `text-[19px] sm:text-[22px]` para H1 de página (escala restrained estilo Linear/Stripe)
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

## 📱 REGLA DE ORO · Responsive móvil sin popovers

> **En móvil (<lg, <1024px) NO usamos popovers ni dropdowns flotantes
> para nada que tenga más de un par de items.** Cualquier interacción
> que en desktop se haría con un popover (filtros, selectores, listas
> largas, formularios) se convierte en **pantalla completa** o
> **bottom-sheet** (sube de abajo arriba). Las pantallas mobile son
> compactas y limpias precisamente porque la complejidad se mueve a
> capas superiores en pleno fullscreen, no flotando sobre la pantalla.

**Por qué.**

- Los popovers en móvil tapan parcialmente la pantalla, dificultan el
  scroll dentro y se cierran al primer toque mal-puesto. Pantalla
  completa o bottom-sheet siguen el mental model nativo (iOS/Android).
- Permite que la pantalla principal sea **densa de contenido** sin
  preocuparse de "no hay sitio para el popover".
- Patrón homogéneo · el usuario siempre sabe cómo cerrar (botón X
  arriba o swipe-down).

**Cómo se aplica.**

- **Filtros de listado** (`/registros`, `/promociones`, `/contactos`,
  `/colaboradores`, etc.): drawer lateral derecho en desktop ≥lg ·
  full-screen overlay en móvil. Siempre header con título + cerrar +
  contador de filtros, body scroll-able, footer sticky con "Limpiar
  todo" + "Ver N resultados".
- **Selectores con búsqueda** (UserSelect, AgencyPicker, locations,
  etc.): popover en desktop · bottom-sheet en móvil con altura
  ajustada al contenido (max ~85vh).
- **Wizards / dialogs largos**: full-screen siempre, también en
  desktop si tienen más de 4 secciones (ej. crear promoción).
- **Confirmaciones simples** (sí/no, snooze): popover/dialog está bien
  en ambos · no merecen pantalla completa.

**Implementación recomendada.**

```tsx
// Pattern · drawer responsive con framer-motion
<AnimatePresence>
  {open && (
    <>
      <motion.div /* backdrop */ className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm" />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 bg-card border-l border-border flex flex-col",
          // Desktop: panel lateral 440px · Mobile: full-screen
          "w-full lg:w-[440px]",
        )}
      >
        <header /> <main /> <footer />
      </motion.aside>
    </>
  )}
</AnimatePresence>
```

Para bottom-sheet en móvil, alternativa con `initial={{ y: "100%" }}`
y `bottom-0 inset-x-0 max-h-[85vh] rounded-t-2xl`.

**Checklist al añadir un selector/filtro nuevo:**

- [ ] ¿En móvil ocupa pantalla completa o sube de abajo?
- [ ] ¿Tiene header con título + botón cerrar + contador?
- [ ] ¿El body es scroll-able con `overflow-y-auto overscroll-contain`?
- [ ] ¿El footer sticky con la acción primaria queda siempre visible?
- [ ] ¿Funciona el back gesture / swipe-down en mobile?

**Ejemplo de referencia:** `src/pages/Promociones.tsx` · drawer de
filtros con motion + Filter primitives. Reusable kit pendiente de
extraer a `src/components/ui/FilterDrawer.tsx` cuando haya 3
implementaciones.

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

## 🧱 Componentes canónicos · obligatorios

> Antes de escribir un `<select>`, `<input>` o "chip con bandera" desde
> cero, **comprueba si ya existe el componente del sistema**. Si no,
> amplía el existente (p. ej. añadiendo `excludeIds` a `UserSelect`)
> antes de crear uno nuevo.

| Caso de uso | Usa | Dónde vive |
|---|---|---|
| Elegir un miembro del equipo | `<UserSelect>` con avatar + buscador | `src/components/ui/UserSelect.tsx` |
| Teléfono internacional (prefijo + número) | `<PhoneInput>` unificado | `src/components/ui/PhoneInput.tsx` |
| Bandera de país / idioma | `<Flag iso="es" size={16}>` | `src/components/ui/Flag.tsx` |
| Toggle de vista (lista / grid / mapa) | `<ViewToggle>` segmented control | `src/components/ui/ViewToggle.tsx` |
| Cargo del miembro (multiselect máx 2) | `<JobTitlePicker>` agrupado | `src/components/team/JobTitlePicker.tsx` |
| Foto con recorte circular | `<PhotoCropModal>` | `src/components/settings/PhotoCropModal.tsx` |
| Multi-select con buscador | `<MultiSelectFilter>` | `src/components/ui/MultiSelectFilter.tsx` |
| Confirmación destructiva | `useConfirm()` | `src/components/ui/ConfirmDialog.tsx` |
| Dialog base | `<Dialog>` + `<DialogContent>` de Radix wrap | `src/components/ui/dialog.tsx` |
| Tag/badge con variante semántica | `<Tag variant="success" size="sm">` | `src/components/ui/Tag.tsx` |

**Catálogos canónicos** (los componentes anteriores los consumen):

- `TEAM_MEMBERS` · `src/lib/team.ts`
- `LANGUAGES` · `src/lib/languages.ts` (ISO + nombre + `countryIso`)
- `PHONE_COUNTRIES` · `src/lib/phoneCountries.ts`
- `JOB_TITLES` (agrupados) · `src/data/jobTitles.ts`
- `public/flags/{iso}.svg` · 250 SVGs locales

Cualquier lista de países, idiomas o cargos **en un componente**
es un code-smell. Se extrae al catálogo canónico.

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
- ❌ **No usar `<select>` nativo para elegir un miembro del equipo.** Usa
  siempre `<UserSelect>` (`src/components/ui/UserSelect.tsx`). El select
  nativo no muestra avatar, no busca por cargo/email y no respeta los
  tokens del sistema. Para excluir al propio miembro (p. ej. en un
  handover) usa `excludeIds`; para filtrar solo activos, `onlyActive`.
- ❌ **No construir dropdowns de países/prefijos/idiomas ad-hoc.** Usa
  `<PhoneInput>` (prefijo + número), `<Flag iso>` (bandera SVG desde
  `/flags/`) y los catálogos canónicos `src/lib/phoneCountries.ts` /
  `src/lib/languages.ts`.
- ❌ **No hardcodear listas de miembros / idiomas / cargos / prefijos** en
  un componente. Siempre desde el catálogo canónico del módulo correspondiente.

---

## 🛡️ REGLA DE ORO · Acciones bulk solo sobre colaboradores

> **En `/colaboradores` (Inmobiliarias) y `/promotores` solo se puede
> seleccionar ni marcar como favorito a empresas con las que YA
> colaboras.** Una empresa "es colaboradora" cuando se ha enviado
> una invitación Y la empresa la ha aceptado (es decir,
> `agency.status === "active" && agency.estadoColaboracion === "activa"`).
> Las empresas en cualquier otro estado (pausada, contrato pendiente,
> pendiente, sin colaboración, marketplace) NO permiten estas
> acciones · al hacer click se muestra un toast informativo y se
> aborta.

**Por qué.** Las acciones bulk de la card (selección + envío de
emails masivos, marcar como favorito para listados rápidos) son
operativas internas dirigidas a la red real. Permitirlas sobre
empresas ajenas o pausadas:

1. **Privacidad** · enviar un email masivo a una empresa con la que
   no se ha establecido relación = spam comercial.
2. **Coherencia de datos** · el favorito se usa como acceso rápido
   en otras pantallas (filtros, recipient picker del email modal).
   Marcar a una "no colaboradora" rompe la semántica.
3. **Onboarding del producto** · el flujo correcto es invitar →
   esperar aceptación → entonces interactuar.

**Cómo se aplica.**

`AgencyGridCard` (`src/components/agencies/AgencyGridCard.tsx`) recibe
prop `canInteract: boolean` (default `true`). Cuando `false`:

- Checkbox `<RowCheckbox>` se renderiza con `disabled` visual
  (border muted, color gris claro, cursor not-allowed).
- Estrella `<Star>` igual · color muted, cursor not-allowed.
- Click en cualquiera muestra un toast Sonner explícito:
  - "Solo puedes seleccionar empresas con las que ya colaboras ·
    Envía una invitación y, cuando la acepten, podrás
    seleccionarlas y enviarles emails."
  - "Solo puedes marcar como favorito a empresas con las que ya
    colaboras · Envía una invitación y, cuando la acepten, podrás
    guardarlas en favoritos."
- El handler original (`onToggleSelect` / `onToggleFavorite`) NO
  se ejecuta.

**Consumers** que pasan correctamente `canInteract`:

- `src/pages/Colaboradores.tsx` · listado developer.
- `src/pages/Promotores.tsx` · agency view + developer view.

**Definición de "colaborador" en el modelo:**

```ts
const canInteract = a.status === "active"
  && a.estadoColaboracion === "activa";
```

**Excepciones intencionales** que SÍ permiten interacción:
- Ningún caso · es regla dura. Si un caso futuro requiere
  permitirlo, declararlo aquí explícitamente con motivo.

**TODO(backend).** Cuando el backend valide envíos masivos por
endpoint, repetir el check server-side con un 403:
```json
{
  "code": "not_a_collaborator",
  "agency_id": "ag-X",
  "current_status": "pausada"
}
```
El frontend vuelve a renderizar la card como `canInteract=false` si
el estado cambia · listener de `byvaro:agency-status-changed`.

---

## 🤝 REGLA DE ORO · Solicitud de colaboración por promoción

> **Las solicitudes de colaboración por promoción son distintas de las
> altas agency-level (marketplace).** No las mezcles. La agencia envía
> una solicitud para colaborar en UNA promoción concreta · el promotor
> decide pendiente / aceptada / descartada con tabs en
> `/colaboradores`. Doc canónico:
> **`docs/backend/domains/collaboration-requests.md`**.

**Reglas duras del flujo:**

1. **Descarte silencioso** · cuando el promotor descarta una solicitud,
   la agencia NO se entera. Su chip "Colaboración solicitada" se muestra
   exactamente igual que cuando estaba pendiente. La función
   `findSolicitudVivaParaAgencia()` agrupa pendiente + rechazada para
   que la UI agencia pinte ambos estados como "enviada".

2. **Override por invitación** · si el promotor envía una invitación
   formal a una agencia que tenía solicitud descartada para esa misma
   promoción, `acceptInvitationOverride()` flipa la solicitud a
   `aceptada`. La invitación PREVALECE. El `SharePromotionDialog`
   muestra un banner explícito ("Esta agencia tenía solicitud descartada
   · descartada por X · fecha") con quién y cuándo.

3. **Agencia NO puede reenviar** · descartada → no hay botón "Solicitar
   de nuevo" desde la agencia. Solo el promotor decide: recuperar
   manualmente desde tab Descartadas o reactivar automáticamente al
   invitar.

4. **Permiso** · `collaboration.requests.manage` es nuevo
   (`src/lib/permissions.ts`). Default solo admin. Sin él el drawer de
   `/colaboradores` muestra las solicitudes en read-only con aviso
   lock-icon. Aceptar / Descartar / Recuperar quedan
   `disabled:opacity-40 cursor-not-allowed`.

5. **Trazabilidad obligatoria** · cada solicitud guarda
   `requestedBy: { name, email?, avatarUrl? }` (snapshot del actor
   agencia) y `decidedBy: { ... }` (snapshot del actor promotor que
   aceptó/descartó/recuperó). Se muestran ambos en el drawer del
   promotor.

6. **Eventos cross-empresa** · `recordRequestReceived` al crear,
   `recordRequestApproved` al aceptar, `recordRequestRejected` al
   descartar. Aparecen en `/colaboradores/:id?tab=historial`.

---

## 📐 REGLA DE ORO · Anchos del contenedor de página

> **El sistema tiene EXACTAMENTE dos anchos de contenedor de página:
> `max-w-content` (1400px) y `max-w-reading` (1250px). Toda pantalla
> nueva debe usar uno de los dos · cualquier otro valor (1200, 1300,
> 1500…) es un bug del diseño y se rechaza en review.**

### Tokens

Declarados en `tailwind.config.ts`:

```ts
maxWidth: {
  content: "1400px",   // listados, dashboards, master-detail
  reading: "1250px",   // perfiles, ajustes, lectura larga
}
```

### Cuál usar

| Tipo de pantalla | Token | Razón |
|---|---|---|
| Listado con grid de cards (Promociones, Colaboradores, Contactos…) | `max-w-content` | A 1280px+ caben 4 cards/fila · a 1250 pierdes 1 columna. |
| Master-detail (Registros, ContactoDetalle, LeadDetalle…) | `max-w-content` | Lista (~420px) + detalle (≥800px) + gaps + márgenes ≈ 1300+. |
| Dashboard con KPI strip (Inicio, Estadísticas, Equipo) | `max-w-content` | 4-5 tiles + gráficas necesitan ese ancho sin comprimir. |
| Wizard largo (CrearPromocion) | `max-w-content` | Pasos con grids de unidades / tablas anchas. |
| **Perfil / ficha pública** (Empresa, AgenciaDetalle, ColaboracionPanel) | `max-w-reading` | Hero + secciones one-column · texto cómodo a 75 chars/línea. |
| **Settings / Ajustes** (AjustesHome y todas las sub-páginas) | `max-w-reading` | Forms + listas one-column · inputs no se ven grotescos. |
| Banner global (`PendingResponsibleBanner`, `RecomendacionesStrip`) | `max-w-content` | Banner cubre el ancho de la página debajo. |

### Padding lateral

Junto al ancho, padding canónico (NO inventar otros):

```tsx
className="px-4 sm:px-6 lg:px-8"  // estándar · TODA pantalla
```

NO usar `lg:px-10` ni otros valores · son legacy a deprecar cuando se vea.

### Patrón canónico

```tsx
<div className="px-4 sm:px-6 lg:px-8 pt-6 pb-10 max-w-content mx-auto w-full">
  {/* contenido del listado / dashboard */}
</div>

<div className="px-4 sm:px-6 lg:px-8 pt-4 pb-10 max-w-reading mx-auto w-full">
  {/* contenido del perfil / ajustes */}
</div>
```

### Por qué dos anchos y no uno

- **A 1400 todo** rompe la legibilidad de Empresa / Ajustes · líneas de
  texto a 100+ chars mata la lectura (Bringhurst recomienda 60-75).
- **A 1250 todo** colapsa los listados · grids de Promociones pierden
  una columna en pantallas grandes y se nota visiblemente.
- Linear, GitHub, Stripe, Notion usan el mismo patrón: contenedor
  más ancho para listados/dashboards, narrower para perfiles/settings.

### Checklist al crear/auditar una pantalla

- [ ] ¿Uso `max-w-content` o `max-w-reading` (no un valor hardcoded)?
- [ ] ¿Padding `px-4 sm:px-6 lg:px-8`?
- [ ] ¿Reúno la decisión a la tabla de arriba?
- [ ] Si es ambigua (listado dentro de un perfil, etc.) → preguntar
      antes de elegir un ancho propio.

### Cómo migrar valores hardcoded

```bash
# Reemplazo masivo (idempotente · seguro):
grep -rl "max-w-\[1400px\]" src | xargs sed -i '' 's/max-w-\[1400px\]/max-w-content/g'
grep -rl "max-w-\[1250px\]" src | xargs sed -i '' 's/max-w-\[1250px\]/max-w-reading/g'
```

Si encuentras un valor que NO es 1400 ni 1250 (ej. 1200 en un wizard
intermedio) → puede ser intencional para una pantalla específica.
Documentarlo inline con un comentario y abrir Open Question si no
está claro.

---

## 👁 REGLA DE ORO · Preview = Visitor

> **El toggle "Previsualizar como usuario" del owner DEBE mostrar
> exactamente lo mismo que un colaborador externo (visitor) ·
> bit-a-bit.** Si un dato/sección/CTA no es visible para el visitor,
> tampoco se ve en preview. La razón: el owner usa preview para
> validar qué expone su ficha pública · si preview muestra datos
> internos (verificación pendiente, formularios de edición, drafts),
> el owner llega a producción confiando en algo que NO está bien.

**Cómo se aplica · guard canónico**:

```ts
const isPublicView = isVisitor || viewMode === "preview";
{!isPublicView && <SeccionInternaQueElVisitorNoVe />}
```

Equivalente: si una sección usa `viewMode === "edit"`, ya está bien
(porque `edit` ≠ `preview`). El bug típico es usar `!isVisitor`
solo, que deja la sección visible al togglear preview.

**Ejemplos de qué oculta preview** (no exhaustivo):

- Card de verificación legal pendiente · admin only.
- Sección "Redes sociales y web" del tab About (los iconos ya viven
  en el hero · el listado solo lo ve el owner).
- Banner "Pendiente del responsable" para agencia onboarding.
- Mock controls del prototipo (`<details>` con simuladores).
- Sidebar "Fuerza del perfil" del owner.
- Cualquier `<EditableSection>` con `editContent` SIN `viewMode=edit`.

**Lo que SÍ ve el preview** (igual que el visitor):

- Todo el contenido público: hero · subtitle · datos de empresa
  públicos · equipo · oficinas · marketing snapshot · portfolio ·
  reseñas Google · sello de verificada (cuando ya está aprobada).

**Checklist al añadir una sección nueva en `/empresa`**:

- [ ] ¿Es contenido público? Sin guard ni con `!isVisitor`.
- [ ] ¿Es interno? `viewMode === "edit"` (incluye no-visitor por
      construcción) o el guard canónico `!isVisitor && viewMode !==
      "preview"`.
- [ ] Probé el toggle "Previsualizar como usuario" · todo lo interno
      desaparece · solo queda lo que un visitor real vería.

---

## 🪞 REGLA DE ORO · Mirror del panel del promotor desde la agencia

> Cuando una agencia ve a "su" promotor, accede a las pantallas espejo
> de las que el promotor usa para ver agencias. Mismo lenguaje visual,
> mismos componentes, distintas restricciones. Doc:
> **`docs/backend/domains/agency-developer-mirror.md`**.

**Pares simétricos:**

| Promotor → agencia | Agencia → promotor |
|---|---|
| `/colaboradores/:id` (ficha pública) | `/promotor/:id` (ficha pública) |
| `/colaboradores/:id/panel` (operativo) | `/promotor/:id/panel` (operativo) |
| `agencyHref(agency)` decide | `developerHref(user)` decide |
| Header con datos agencia | Header con datos promotor |
| Tab Datos → `DatosTab` | Tab Datos → `DeveloperDatosTab` |

**Restricciones del mirror agencia:**

1. **Documentación read-only** · `DocumentacionTab` recibe `readOnly`
   prop. La agencia NUNCA sube contratos · solo firma vía Firmafy email.
2. **Resumen read-only** · banner "Sin contrato" pasa de CTA "Subir
   contrato ahora" a aviso pasivo "Solo el promotor o comercializador
   puede subir el contrato".
3. **Sin "Compartir promoción"** en el header.
4. **Permiso del panel · más relajado** · no requiere
   `collaboration.panel.view`. Cualquier miembro de la agencia ve su
   propio día a día con el promotor (no es info sensible cross-tenant
   desde el lado agencia).

**Resolución de datos** · `useEmpresa(tenantId)` reconoce el prefijo
`developer-` y resuelve vía `loadEmpresa()` (single-tenant mock). En
backend: `GET /api/promotor/:id/profile`.

**Paridad visual obligatoria · NO romper:** la agencia mirando
`/promotor/:id` debe ver lo MISMO que el promotor cuando hace
"Previsualizar como usuario" en `/empresa`. Para mantenerlo:

- `isVisitor` (boolean) NO controla los KPIs · solo (a) eyebrow,
  (b) toggle preview, (c) modales de edición, (d) secciones internas
  que el visitor no ve.
- `entityType: "developer" | "agency"` controla los KPIs del
  `HeroStatsStrip` y su origen es el TIPO DE ENTIDAD que se muestra,
  no quién mira. `Empresa.tsx` lo deriva del tenantId.
- `useEmpresaStats()` · si `tenantId` empieza con `developer-` o no
  hay, computa los stats del workspace. Si es id de agencia, lee del
  seed `agencies`. NO mezcles los dos branches.

Si añades un campo o KPI nuevo, hazlo en una sola fuente
(`useEmpresaStats`) y asegúrate de que las dos pantallas lo muestran
igual ANTES de cerrar el PR.

---

## 🏢 REGLA DE ORO · Oficinas single source of truth

> **`byvaro-oficinas` es la ÚNICA fuente de verdad de oficinas del
> workspace.** Toda promoción que muestre un punto de venta lo
> referencia por id (`puntosDeVentaIds: string[]`). NUNCA se duplican
> datos de oficina. Ver
> **`docs/backend/domains/empresa-stats-and-offices.md`**.

**Por qué:** antes había 3 fuentes paralelas (`byvaro-oficinas`, inline
`Promotion.puntosDeVenta`, `companyOffices.ts`) con ids distintos y
datos divergentes. Una oficina podía aparecer en una promoción pero
no en `/empresa` → "oficina fantasma". Inadmisible.

**Regla:** si se ve una oficina en una promoción, **DEBE existir en
`/empresa`**. Sin excepciones.

Implementación:
- `OFICINAS_SEED` en `src/lib/empresa.ts` auto-seedea 6 oficinas
  (`of-1`...`of-6`) si localStorage está vacío.
- Promociones usan `puntosDeVentaIds: string[]` referenciando.
- `PromocionDetalle.tsx` resuelve vía `useOficinas()`.
- `companyOffices.ts` borrado.

**Backend:** tabla `offices` + pivote M:N `promotion_sales_offices` con
FK. `ON DELETE SET NULL` en pivote.

---

## 📊 REGLA DE ORO · KPIs de empresa derivados, NO manuales

> Los KPIs del hero de `/empresa` (Promociones, Unidades en venta,
> Importe en venta, etc.) se computan en runtime desde los datasets
> reales · NO son campos string editables en `Empresa.{x}Count`. Ver
> `docs/backend/domains/empresa-stats-and-offices.md`.

**Por qué:** los campos manuales se desincronizan inmediatamente del
estado real. Un workspace con 5 promociones publicadas mostraba
`promocionesCount: "0"` indefinidamente porque nadie tecleaba el valor.

**Regla:** nueva métrica en hero o panel → **derívala en
`useEmpresaStats()`** desde el dataset autoritario. NUNCA recrees un
campo manual en `Empresa`.

Eliminados (no los recrees): `aniosOperando`, `oficinasCount`,
`agentesCount`, `promocionesCount`, `unidadesVendidas`,
`agenciasColaboradoras`, `ventasAnuales`, `ingresosAnuales`,
`portfolio`.

`HeroStatsStrip` adapta los tiles con prop `mode: "owner" | "visitor"`:

- Owner: Años · Promociones · Unidades en venta · Importe en venta · Colaboradores
- Visitor: Años · Oficinas · Equipo · Unidades vendidas

Idiomas: unión de `member.languages` (members activos) cuando es own
workspace · NO campo `idiomasAtencion` editable manualmente.

---

## 🥇 REGLA DE ORO · Historial del contacto

> **Todo lo que pasa con un contacto se registra en su Historial.** Sin
> excepciones. El tab Historial (`/contactos/:id?tab=historial`) es la
> única fuente de verdad de la actividad del contacto y debe contar la
> historia completa de qué se hizo, quién lo hizo y cuándo.

**Cómo se aplica.** Toda acción que cree, modifique o comunique algo
sobre un contacto **DEBE** llamar a `recordEvent()` (o uno de sus
helpers tipados) de `src/components/contacts/contactEventsStorage.ts` en
el mismo handler que ejecuta la acción. Si añades una acción nueva en
una ficha de contacto y olvidas registrarla, el Historial pierde
fidelidad y es un bug.

**Qué se registra.** Sin pretender ser exhaustivo: creación, edición
(con diff de campos cambiados), borrado, asignación/desasignación,
vínculo/desvínculo entre contactos, cambio de status, alta/borrado de
documentos, evaluación de visita, comentario interno, email enviado,
WhatsApp enviado, llamada, alta de registro/oferta, actividad web
detectada, cambios de sistema (bot).

**Helpers disponibles** (azúcar para no construir el evento a mano):

```ts
recordContactCreated(id, by)
recordContactEdited(id, by, changedFields[])
recordAssigneeAdded(id, by, memberName)
recordAssigneeRemoved(id, by, memberName)
recordRelationLinked(id, by, otherName, relationLabel)  // bidireccional: registra en ambos contactos
recordRelationUnlinked(id, by, otherName)
recordVisitEvaluated(id, by, { promotionName, unit?, outcome, rating? })
recordDocumentUploaded(id, by, docName)
recordDocumentDeleted(id, by, docName)
recordCommentAdded(id, by, content, "user" | "system")
recordEmailSent(id, by, to, subject, attachmentsCount?)
recordWhatsAppSent(id, by, summary)
recordTypeAny(id, type, title, description?, by?)        // escape hatch para tipos no cubiertos
```

`by` siempre es `{ name, email }` del usuario actual (`useCurrentUser()`).
Si el cambio lo dispara el sistema (bot, automatización, integración),
pasa `{ name: "Sistema" }` y se renderiza con avatar bot + estilo
discontinuo.

**Vínculos bidireccionales.** Cuando una acción afecta a dos contactos
(ej. vincular A↔B), registra el evento en **ambos** contactos para que
cada ficha cuente su versión.

**Comentarios = parte del Historial.** No hay tab separado de
"Comentarios". El editor inline para añadir notas vive dentro del
Historial cuando el sub-pill activo es "Comentarios". Llama a
`addComment()` (storage) **y** `recordCommentAdded()` (audit) — los dos.

**No te olvides.** Antes de hacer commit de una acción nueva en
contactos, verifica: ¿se ve reflejada en `/contactos/:id?tab=historial`?
Si no, falta el `recordEvent()`.

---

## 🏢 REGLA DE ORO · Historial entre empresas (solo admin)

> **Toda interacción entre dos empresas (promotor ↔ agencia) se
> registra en el historial cross-tenant de ambas fichas.** El
> historial es la auditoría cruzada del negocio: primera solicitud,
> invitaciones enviadas/aceptadas/rechazadas, registros aprobados/
> rechazados, visitas (quién, cuándo, con qué resultado), contratos
> enviados/firmados, ventas cerradas/rechazadas, incidencias.
>
> **Solo visible para administradores.** No para agentes de la
> organización ni para la agencia colaboradora. El resto de usuarios
> no ve este timeline aunque tenga acceso a la ficha.

**Cómo se aplica.** Toda acción que ocurra "entre empresas" DEBE
llamar a `recordCompanyEvent()` (o uno de sus helpers tipados) de
`src/lib/companyEvents.ts` en el mismo handler que dispara la
acción. El timeline vive en la ficha de la agencia
(`/colaboradores/:id?tab=historial`) y es **la única fuente de
verdad** del vínculo comercial entre las dos organizaciones.

**Qué se registra.** Sin pretender ser exhaustivo:

- **Ciclo de vida de la relación**: solicitud entrante desde
  marketplace, invitación enviada por el promotor,
  aceptación/rechazo de ambos lados, pausa, reactivación, baja.
- **Promociones**: asignación/desasignación a una promoción concreta,
  cambio de comisión pactada, cambio de plan de pagos.
- **Registros de clientes**: creación por la agencia, aprobación,
  rechazo, cambio de estado, caducidad.
- **Visitas**: programación, realización, evaluación (quién hizo
  la visita, cuándo, con qué resultado).
- **Ofertas y ventas**: envío de oferta, aceptación, rechazo,
  reserva, contrato, escritura, caída.
- **Contratos firmados**: envío de borrador, firma, modificación,
  expiración.
- **Incidencias**: reclamación, cancelación, conflicto por duplicados.
- **Comunicación formal**: email enviado, whatsapp, llamada (solo
  los que son "entre empresas", no la conversación interna).
- **Bot/Sistema**: cambios automáticos (bloqueo de registros
  duplicados, expiración de invitaciones no respondidas, etc.)

**Helpers disponibles** (azúcar para no construir el evento a
mano — ver el catálogo completo en `src/lib/companyEvents.ts`):

```ts
recordInvitationSent(agencyId, promotionId?, by)
recordInvitationAccepted(agencyId, by)
recordInvitationRejected(agencyId, by, reason?)
recordInvitationCancelled(agencyId, by)
recordRequestReceived(agencyId, promotionId?, message?)
recordRequestApproved(agencyId, by)
recordRequestRejected(agencyId, by, reason?)
recordRegistrationApproved(agencyId, by, clientName, promotionName)
recordRegistrationRejected(agencyId, by, clientName, reason?)
recordVisitScheduled(agencyId, by, { clientName, promotionName, date })
recordVisitCompleted(agencyId, by, { clientName, outcome, rating? })
recordContractSent(agencyId, by, docName)
recordContractSigned(agencyId, by, docName)
recordSaleClosed(agencyId, by, { clientName, unit, amount })
recordSaleRejected(agencyId, by, { clientName, reason })
recordCollaborationPaused(agencyId, by, reason?)
recordCollaborationResumed(agencyId, by)
recordCompanyAny(agencyId, type, title, description?, by?)
```

`by` siempre es `{ name, email }` del usuario actual. Los eventos
del sistema pasan `{ name: "Sistema" }` y se renderizan con
estilo bot.

**Bidireccional.** Si la agencia Byvaro gana visibilidad propia
(futuro `agency.workspaceId`), el mismo evento se duplica en "su"
historial. Por ahora vive solo del lado del promotor.

**Visibilidad.** El componente `<CompanyActivityTimeline>` se
renderiza dentro de `<AdminOnly>`. Además la página muestra un
banner "Historial solo visible para administradores · los agentes
no ven esta sección" para que sea **explícito** en pantalla. No
se oculta: se declara. Si un agente entra a la ficha, el tab
Historial no aparece.

**No te olvides.** Antes de hacer commit de una acción que afecte
a otra empresa (invitación, rechazo, oferta, contrato…), verifica:
¿se ve reflejada en `/colaboradores/:id?tab=historial`? Si no,
falta el `recordCompanyEvent()`.

---

## 🏢 REGLA DE ORO · Datos del workspace son por tenant

> **Todo store que represente "datos del workspace" (equipo, oficinas,
> drafts, configuración interna) DEBE usar una clave de localStorage
> sufijada por el workspace del usuario actual.** Las keys globales
> single-tenant fugan los datos del promotor a las agencias y al revés.

**Por qué.** El prototipo arrancó single-tenant — todo en
`byvaro.organization.members.v4` (clave global). Cuando se introdujo el
dual-role, agencias entrando a `/equipo`, `/empresa` (tab Equipo),
selectores de miembros, etc. veían el equipo del promotor como si fuera
suyo. Eso rompe el modelo dual-role (`docs/dual-role-model.md`) — la
demo a una agencia validaba un producto que no es el real.

**Patrón canónico.**

```ts
import { useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";

const user = useCurrentUser();
const workspaceKey = currentWorkspaceKey(user);
// developer-default · agency-<agencyId>
const STORAGE_KEY = `byvaro.<dominio>.<entidad>.v1:${workspaceKey}`;
```

Para `team` ya hay helpers · usar siempre `useWorkspaceMembers()` de
`src/lib/useWorkspaceMembers.ts` o `getMembersForWorkspace(key)` de
`src/lib/team.ts`. **Nunca leas `TEAM_MEMBERS` directamente** desde un
componente · es solo el seed del workspace developer.

**Seeds por agencia** · `src/lib/agencyTeamSeeds.ts` deriva el equipo
demo desde `mockUsers.ts` filtrado por `agencyId`. Si añades una nueva
agencia con usuarios mock, su equipo aparece automáticamente. Si la
agencia no tiene usuarios mock (p.ej. solicitudes pendientes), el seed
es lista vacía y la pantalla muestra el empty-state estándar.

**Stores ya migrados** (no recrees logica para estos):

- `team` (Equipo, ajustes/usuarios/miembros, EmpresaAgentsTab,
  EmpresaHomeTab, useEmpresaStats).

**Stores PENDIENTES de migrar** (deuda técnica · documentar antes de
añadir features que dependan):

- `oficinas` (`byvaro-oficinas`) · agencias ven oficinas del promotor.
- Drafts de wizards y formularios que persisten en `localStorage`.
- Cualquier picker/selector que tire de TEAM_MEMBERS sin pasar por
  `useWorkspaceMembers` (ej. UserSelect en algunos contextos).

**Backend.** Cuando aterrice multi-tenancy real (`organization_id` +
RLS), las keys con sufijo desaparecen · cada endpoint estará scoped
al `organization_id` del JWT y devolverá solo datos del workspace.
Mantén los helpers `currentWorkspaceKey()` y `useWorkspaceMembers()`
porque sirven de adaptador 1-a-1 al backend.

**Checklist al añadir un store nuevo "del workspace":**

- [ ] ¿La clave de localStorage tiene sufijo `:${workspaceKey}`?
- [ ] ¿El seed por defecto es distinto para developer vs agency?
- [ ] ¿Se reseed automáticamente al cambiar de cuenta (account
      switcher) o queda contaminada la lista de la cuenta anterior?
- [ ] ¿El TODO(backend) anota cómo el endpoint scoped reemplaza la
      key sufijada?

---

## 🤝 REGLA DE ORO · Vista de Agencia colaboradora

> **Cada cambio en la app DEBE contemplar la vista de Agencia.** Byvaro
> no es un SaaS mono-rol: el promotor paga 249€/mes y la agencia
> colaboradora entra en la misma plataforma con una vista distinta.
> Olvidar ese lado rompe el diferencial del producto.
>
> 📖 **Modelo completo en `docs/dual-role-model.md`** — personas,
> interacciones cross-role, contratos backend (JWT, RLS, endpoints),
> matriz de features por pantalla y cómo portar al backend real. Lee
> ese documento antes de implementar cualquier feature nueva.

**Cómo funciona hoy (mock).**

- Dos roles coexisten via `useCurrentUser().accountType`:
  - `"developer"` → promotor (Luxinmo).
  - `"agency"` → agencia colaboradora, con `agencyId` apuntando a una
    agencia concreta de `src/data/agencies.ts`.
- El rol se elige al hacer login en `/login` con una cuenta demo (ver
  `src/data/mockUsers.ts` · password `demo1234`). Persiste en
  `sessionStorage` por pestaña — así una pestaña puede ser Promotor y
  otra Agencia a la vez.
- El `AccountSwitcher` (pill arriba-derecha en desktop) permite cambiar
  de rol en caliente y cerrar sesión.

**Obligaciones al implementar cualquier cambio.**

1. **Pregúntate**: ¿qué ve una agencia que entra a esta pantalla?
   - Si no debe verla → ocultarla del sidebar / redirigirla (ver
     `AppSidebar.tsx` → `isAgencyUser`).
   - Si debe verla con otros datos → filtra por `currentUser.agencyId`
     (patrón en `Promociones.tsx`, `Registros.tsx`).
   - Si debe verla con otras acciones → esconde los botones con
     `!isAgencyUser` (patrón en `PromocionDetalle.tsx` →
     `viewAsCollaborator`).
2. **Nuevo botón/acción**: declara explícitamente su disponibilidad en
   cada rol. Si no tiene sentido para agencia, esconderlo — nunca
   deshabilitado sin motivo.
3. **Nuevos datasets mock**: si tienen relación con agencias (ownership,
   ventas, contactos), añade `agencyId` al shape y filtra en la
   pantalla que los consume.
4. **Tests**: cuando añadas un flujo crítico, verifica que funciona en
   al menos una cuenta de agencia (`laura@primeproperties.com`) además
   de la del promotor (`arman@byvaro.com`).

**Si el usuario pide un cambio sin mencionar la agencia: PREGUNTA
explícitamente** qué pasa en la vista de agencia antes de
implementar. Ejemplo de pregunta tipo:

> _"¿Este cambio afecta también a la vista de agencia? Si sí, ¿qué
> debería ver/poder hacer la agencia en este flujo?"_

No inventes la respuesta. Si el producto no tiene decisión, anótalo
como `Qnueva` en `docs/open-questions.md` en el mismo PR.

**Checklist antes de cerrar cualquier tarea** (además del de la sección
"Documentación obligatoria" de abajo):

- [ ] Probé el flow logueado como **Promotor** (`arman@byvaro.com`)?
- [ ] Probé el flow logueado como **Agencia** (`laura@primeproperties.com`
      o alguna de las cuentas de `mockUsers.ts`)?
- [ ] El sidebar / botones / datos tienen sentido en ambos roles?
- [ ] Si escondí algo por rol, hay `TODO(backend)` junto al check de
      permiso anotando la key de la matriz (ver `docs/permissions.md`)?

---

## 🔄 REGLA DE ORO · Handover obligatorio al desactivar miembro

> **Cuando se desactiva a un miembro del equipo, el sistema DEBE
> obligar al admin a reasignar todos sus activos a otros miembros
> activos antes de efectuar la desactivación.** Nunca se pierde un
> lead, oportunidad, visita programada, registro o cuenta de email
> porque alguien sale de la empresa. Cada entidad reasignada queda
> marcada en su historial con **"Heredado de [empleado desactivado]"**.

**Cómo se aplica.** La UI que dispara la desactivación (hoy:
`MemberFormDialog` y la fila de "Desactivar" en `Equipo.tsx`) **no
cambia el `status` directamente**. Abre `DeactivateUserDialog`
(`src/components/team/DeactivateUserDialog.tsx`), que:

1. Lee el inventario de activos del miembro con `getMemberInventory()`
   (`src/lib/assetOwnership.ts`) · categorías: contactos,
   oportunidades, registros, visitas, propiedades asignadas, cuentas
   de email.
2. Muestra una fila por categoría con contador y dropdown de
   miembros activos · hay un atajo "Asignar todo a X" para casos
   rápidos.
3. Email se marca como **"Delegación auto"**: se configura forward
   desde la cuenta del desactivado hacia el destinatario elegido
   durante 6 meses.
4. Requiere seleccionar destinatario en **todas** las categorías
   con count > 0. Si falta alguna, el botón queda deshabilitado con
   aviso.
5. Admin puede añadir un motivo (opcional · queda en el historial).
6. Al confirmar → backend hace la reasignación atómica +
   cambia `status: "deactive"` en una misma transacción.

**Qué debe pasar en el historial (obligatorio):**

- Cada entidad reasignada (contacto, oportunidad, visita, registro)
  añade un evento en su timeline:
  ```
  { type: "reassigned",
    reason: "handover",
    from: { id: oldMemberId, name: oldMemberName },
    to:   { id: newMemberId, name: newMemberName },
    note: "Heredado de <nombre> · baja del equipo",
    occurredAt: ISO }
  ```
- La ficha de contacto (`/contactos/:id?tab=historial`) debe
  mostrar este evento con un estilo distintivo (por ejemplo icono
  `UserCheck` en color muted).

**Obligaciones al implementar cualquier feature que cree "cosas"
asignadas a un miembro** (leads, oportunidades, registros…):

1. **Incluir la categoría** en `src/lib/assetOwnership.ts` — si no,
   el sistema puede perder esa "cosa" al desactivar a su dueño.
2. **Añadir el label + description** para que se muestre en el
   dialog.
3. **Ampliar** el backend endpoint `POST /api/members/:id/handover`
   para que acepte la nueva categoría.

**Por qué esta regla existe.** Un agente que se va no puede
llevarse sus leads a la tumba. Un cliente que tenía una visita con
Diego y Diego se da de baja debe ver quién le atiende ahora —
nunca "tu agente ya no existe". Preservar el linaje (`Heredado de
X`) además permite al admin y a la IA analizar qué miembros
heredaron cartera de quién y ajustar asignaciones si el volumen
pesa demasiado al heredero.

Ver:
- `src/lib/assetOwnership.ts` · inventario + tipos.
- `src/components/team/DeactivateUserDialog.tsx` · UI del handover.
- `docs/screens/equipo.md §Desactivar miembro · handover obligatorio`.
- `DECISIONS.md ADR-051`.

---

## 💰 REGLA DE ORO · Venta cerrada vs venta terminada

> **Una venta está "cerrada" cuando se firma el contrato de
> compraventa (CPV · contrato privado). Una venta está "terminada"
> cuando ya se ha cobrado por completo (escritura pública firmada +
> último pago recibido).** No son intercambiables: **cerrada es hito
> comercial**, **terminada es hito financiero**.

**Mapping al modelo** (`src/data/sales.ts::VentaEstado`):

| Estado        | Significado                           | Cerrada | Terminada |
|---------------|---------------------------------------|:-------:|:---------:|
| `reservada`   | Señal firmada, sin contrato aún       |   ❌    |    ❌     |
| `contratada`  | **Contrato de compraventa firmado**   |   ✅    |    ❌     |
| `escriturada` | **Escritura + cobro total**           |   ✅    |    ✅     |
| `caida`       | Cancelada/fallida                     |   ❌    |    ❌     |

**Cómo se aplica.**

- Toda KPI / contador "ventas cerradas" agrega
  `estado IN ("contratada", "escriturada")`. **Nunca sólo
  `escriturada`** — eso infla los KPIs al director comercial.
- Toda KPI / contador "ventas terminadas" / "cobradas" / "volumen
  cobrado" agrega sólo `estado === "escriturada"`.
- **Pipeline abierto de cierre** · `estado === "reservada"` — es
  lo que falta por convertir a contrato.
- **Pipeline abierto de cobro** · `estado === "contratada"` — es
  lo que falta por cobrar / escriturar.
- **Embudo comercial** · lead → aprobado → visita → reserva →
  **cerrada (contrato)** → **terminada (escritura)**. Seis pasos,
  no cinco.
- **Eventos de dominio**: `sale.closed` se dispara al entrar en
  `contratada`; `sale.completed` al entrar en `escriturada`.
  `businessActivity.ts` debe etiquetarlos con títulos distintos
  ("Venta cerrada · contrato firmado" vs "Venta terminada ·
  cobro completado").
- **Comisiones**: se DEVENGAN al cerrar (contrato) pero se PAGAN al
  terminar (escritura) · la ficha del colaborador debe mostrar
  comisión devengada · cobrada · pendiente por separado.

**Por qué importa.** Entre firma de contrato y escritura suelen
pasar 3–6 meses. Confundir los dos hitos infla/desinfla los KPIs
entre 25-40%. El CEO mide rendimiento comercial por cerradas; el
CFO mide caja por terminadas; si la UI los junta, ambos pierden
confianza en los números.

**Dónde aplica hoy** (auditar al añadir KPI nuevo que hable de
ventas):

- `src/pages/Actividad.tsx` · KPI row, embudo, "Ventas por mes".
- `src/pages/Estadisticas.tsx` · KPI "Ventas · volumen".
- `src/pages/Ventas.tsx` · columna estado + filtros.
- `src/lib/businessActivity.ts` · builders de eventos de venta
  (`sale-contract-*` = cerrada, `sale-deed-*` = terminada).
- `src/pages/ColaboradoresEstadisticas.tsx` · ranking por ventas.
- `src/pages/EquipoMiembroEstadisticas.tsx` · KPIs del miembro.

**Checklist antes de cerrar una tarea que toque ventas:**

- [ ] ¿La KPI cuenta cerradas (contratada+escriturada) o
      terminadas (escriturada)? ¿Está etiquetada correctamente en
      la UI (no "ventas" a secas)?
- [ ] ¿El pipeline abierto separa "falta contrato" de "falta
      escritura"?
- [ ] ¿Los eventos de timeline ("Venta cerrada" vs "Venta
      terminada") usan los títulos correctos?
- [ ] ¿Las comisiones aparecen como devengadas al cerrar y
      cobradas al terminar?

**TODO(backend).** Vistas SQL `v_ventas_cerradas` (contratada +
escriturada) y `v_ventas_terminadas` (escriturada). Eventos de
dominio `SaleClosed` y `SaleCompleted` emitidos en las transiciones
correspondientes. Webhook a contabilidad sólo en `SaleCompleted`.

---

## 📊 REGLA DE ORO · KPIs en el dashboard del miembro

> **Todo dato de actividad del trabajador que tenga valor para valorar
> su desempeño DEBE reflejarse en el dashboard de estadísticas del
> miembro** (`/equipo/:id/estadisticas`). El dueño de la agencia usa esa
> pantalla — junto al análisis IA — para decidir cómo gestionar a su
> equipo. Si una métrica no aparece allí, no existe para el negocio.

**Qué cuenta como "KPI relevante".** Cualquier señal que responda a una
de estas preguntas:

- **¿Produce?** Ventas, comisiones, registros aprobados, visitas
  realizadas, conversiones.
- **¿Tiene pipeline sano?** Leads asignados, oportunidades abiertas,
  visitas programadas, registros pendientes, promociones asignadas.
- **¿Comunica bien?** Emails enviados + % apertura, WhatsApp, llamadas,
  tiempo medio de respuesta a lead.
- **¿Es constante?** Tiempo activo en CRM por día / por sesión, racha
  de días activos, días sin conectarse, heatmap día×hora.
- **¿Cierra bien el ciclo?** Visitas evaluadas a tiempo, tareas
  pendientes vencidas, duplicados creados (señal de calidad de datos).

**Obligaciones al añadir una feature que genere actividad:**

1. **Identifica** la métrica: qué cuenta, cómo se agrega (día, semana,
   promoción), contra qué se compara (media equipo, propio histórico).
2. **Amplía** el tipo `MemberStats` en `src/data/memberStats.ts` con el
   nuevo campo.
3. **Muestra** el dato en `/equipo/:id/estadisticas` (KPI card o panel
   relevante).
4. **Incluye** el campo en el prompt de `POST /api/ai/analyze-member/:id`
   para que la IA lo considere al analizar patrones.
5. **Documenta** en `docs/plan-equipo-estadisticas.md §2` qué fuente
   alimenta la métrica (endpoint backend).

**Por qué esta regla existe.** El core del producto para el admin es
convertir datos en decisiones — a quién promover, a quién formar, a
quién reasignar leads. Si un KPI no llega al dashboard, la IA no lo ve,
y el admin toma decisiones a ciegas. Spec completa de KPIs y fases
de implementación en **`docs/plan-equipo-estadisticas.md`**.

---

## 📬 REGLA DE ORO · Plantillas del sistema

> **Toda plantilla nueva que se cree en el producto — email, aviso
> automático, documento PDF o mensaje de WhatsApp — DEBE registrarse
> en el hub `/ajustes/plantillas`** (`src/pages/ajustes/plantillas/index.tsx`).
> Esa página es la única fuente de verdad de qué comunicaciones envía
> Byvaro y desde qué flujo se disparan.

**Por qué.** El admin de una cuenta necesita saber qué emails salen
con su marca antes de aprobarlos. Si una plantilla nueva queda escondida
en el flujo que la dispara, el admin la descubre tarde (o la descubre un
cliente). Centralizar en `/ajustes/plantillas` le da:

1. Un **mapa completo** de lo que envía Byvaro.
2. Contexto de **dónde** se dispara cada una (qué flujo/pantalla).
3. Estado **live / planned** para saber qué falta por implementar.
4. Un punto único desde donde editar contenido, remitente, marca.

**Categorías canónicas** (no inventar nuevas sin discutirlo):

1. **Comunicación comercial** · emails que el promotor/agencia envía
   desde `SendEmailDialog` (disponibilidad, nuevo lanzamiento, última
   unidad, sin plantilla).
2. **Cuentas y acceso** · emails de auth (bienvenida, reseteo de
   contraseña, verificación, invitación a miembro, invitación a
   agencia).
3. **Notificaciones transaccionales** · eventos del negocio (registro
   recibido/aprobado/rechazado, visita programada, contrato firmado,
   venta cerrada, etc.).
4. **Documentos** · PDFs generados (listado de precios, brochure,
   contrato de colaboración, propuesta de reserva).
5. **WhatsApp** · respuestas rápidas y auto-respondedor.

**Checklist al añadir una plantilla:**

- [ ] Registré la plantilla en `CATEGORIES` de `src/pages/ajustes/plantillas/index.tsx`
      con `id`, `label`, `description`, `icon`, `status`, `usedIn`.
- [ ] Si es `status: "live"`, la descripción refleja la realidad (no
      la aspiración).
- [ ] El campo `usedIn` lista TODOS los flujos/pantallas desde los que
      se puede disparar — así el admin sabe dónde aparece.
- [ ] Si hay pantalla donde se puede editar (p. ej. WhatsApp respuestas
      rápidas tienen `/ajustes/whatsapp/respuestas-rapidas`), se puso
      en `editHref`.
- [ ] Los emails automáticos del sistema están documentados como
      `planned` aunque aún no se haya implementado backend — así no se
      olvidan.

**Contrato backend** (cuando llegue el agent):

- `GET /api/templates` → lista con overrides del tenant actual.
- `PATCH /api/templates/:id` → custom subject/body/brand por tenant.
- Cada trigger del sistema referencia el `id` canónico — no
  hardcodear textos en handlers, se renderiza desde la plantilla
  configurada.

**Por qué no mezclar con otras listas.** Hay ya `/ajustes/email/plantillas`
(heredado) y `/ajustes/documentos/plantillas` (PDFs). **El hub unificado
`/ajustes/plantillas` los reemplaza a ambos** · los enlaces antiguos
pueden quedar como sub-filtros del hub, pero la página única es la que
se mantiene y se amplía. No duplicar plantillas en varios sitios —
una sola definición, un solo lugar donde editarla.

---

## ⬆️ REGLA DE ORO · Scroll al entrar en una página

> **Al navegar entre pantallas, el usuario aterriza SIEMPRE arriba**
> — no donde había dejado la pantalla anterior. El componente
> `<ScrollToTop>` de `src/components/ScrollToTop.tsx` está montado
> una sola vez en `App.tsx` dentro del `BrowserRouter` y resetea
> todos los scrollers en cada cambio de `pathname`.

**Por qué.** Sin esto, React Router mantiene la posición del scroll
al re-renderizar. El usuario hace click en un contacto desde la mitad
de un listado largo, entra al detalle y aparece "a la mitad" — y la
percepción es "se ha roto algo". Es el bug de UX web más común.

**Qué cubre** `<ScrollToTop>`:

1. `window.scrollTo(0,0)` · páginas con scroll del documento.
2. El `<main>` del `AppLayout` · contenedor con `overflow-auto` que
   engloba las páginas internas.
3. Cualquier elemento con `data-scroll-container` · escape hatch
   para pantallas que tienen su propio contenedor scrollable interno
   (ej. `/promociones/:id` con `h-full overflow-auto`).

**Qué NO hace:**

- No se dispara si cambian `search` o `hash` (cambiar de tab vía
  `?tab=` no debe scrollear).
- No intercepta el botón atrás si el navegador tiene scroll
  restoration propio — eso es deseable (volver y encontrar la
  posición).

**Si tu pantalla tiene un scroller interno propio:**

- Añade `data-scroll-container` al elemento con `overflow-auto` que
  quieras resetear al entrar · el `ScrollToTop` lo detecta y lo
  resetea.

```tsx
<div className="h-full overflow-auto bg-background" data-scroll-container>
  {/* contenido */}
</div>
```

**Checklist al crear una pantalla con scroller propio:**

- [ ] ¿El contenedor con `overflow-auto` está marcado con
      `data-scroll-container`?
- [ ] ¿Probé navegar a otra ruta y volver · la pantalla aparece arriba?

---

## 🔗 REGLA DE ORO · Estado navegable en la URL

> **Toda sub-navegación de nivel pantalla (tabs, sub-secciones de
> detalle) DEBE sincronizar su estado con un query param en la URL
> usando `useTabParam` de `src/lib/useTabParam.ts`. Nunca `useState`
> para tabs.**

**Por qué.** Si el usuario entra a una tab, navega a una sub-pantalla
(ej. ficha de agencia desde la tab Agencias de una promoción) y pulsa
"atrás", al re-montar la pantalla con `useState` la tab se pierde y el
usuario aterriza en la vista por defecto. Eso rompe el flujo y se
percibe como bug. Con URL sync, el historial del navegador restaura
la tab automáticamente.

Además habilita **deep-linking** (compartir
`/contactos/5?tab=emails` funciona) y hace que el patrón de back sea
consistente con el resto de la web (Linear, Stripe, GitHub, etc.).

**Cómo se aplica.** Importa el hook canónico:

```ts
import { useTabParam } from "@/lib/useTabParam";

const TAB_KEYS = ["resumen", "historial", "emails"] as const;
type Tab = typeof TAB_KEYS[number];

const [tab, setTab] = useTabParam<Tab>(TAB_KEYS, "resumen");
```

Comportamiento del hook:

- Lee la tab inicial de `?tab=<key>` · si es inválida o no está,
  usa `defaultKey`.
- Al cambiar, escribe con `{ replace: true }` — cambiar de tab NO
  ensucia el historial del navegador, pero navegar a sub-pantallas
  sí preserva la tab en el back.
- Cuando la tab activa coincide con el default, borra el param de la
  URL (`/contactos/5` en lugar de `/contactos/5?tab=resumen`).
- Tercer argumento opcional `paramName` si necesitas varios ejes
  ortogonales en la misma pantalla (p.ej. `?tab=...&dim=...`).

**Dónde está aplicado** (actualizar al añadir pantallas nuevas):

- `src/pages/PromocionDetalle.tsx` · tabs `Overview/Availability/Agencies/...`
- `src/pages/ContactoDetalle.tsx` · tabs `resumen/historial/...`
- `src/pages/LeadDetalle.tsx` · tabs `actividad/emails/...`
- `src/pages/Empresa.tsx` · tabs `home/about/agents/...`
- `src/pages/ColaboradoresEstadisticas.tsx` · tabs `registros/ventas/eficiencia`

**Excepciones** (donde `useState` sí es correcto):

- Tabs internos de diálogos modales (el estado se destruye al cerrar,
  no hay navegación de vuelta).
- ViewToggle de listado (`list/grid/map` en Promociones/Colaboradores):
  es preferencia de visualización, no sub-navegación. Si el usuario lo
  pide explícitamente, migrar también.
- Tabs controlados por props desde el padre (componentes reutilizables
  cuyo estado pertenece al contenedor).

**Checklist al añadir una pantalla con tabs:**

- [ ] ¿Usé `useTabParam` en vez de `useState`?
- [ ] ¿La tab por defecto coincide con lo que el usuario espera ver
      primero al entrar por URL sin param?
- [ ] ¿Probé navegar a una sub-pantalla y volver atrás · la tab se
      restaura?
- [ ] ¿El tuple `TAB_KEYS` tiene `as const` para que TypeScript tipe
      la union y evite typos?

---

## 🔐 REGLA DE ORO · Datos sensibles requieren permiso

> **Toda vista o acción que maneje información sensible DEBE declarar
> su propia `PermissionKey` en `src/lib/permissions.ts` y protegerse
> con `useHasPermission(...)`. Nunca confíes solo en ocultarlo de la
> navegación o asumir que el usuario es admin.**

**Qué cuenta como sensible.** Cualquiera de estas categorías dispara
la obligación de declarar una key:

- **Datos cross-empresa** · contratos, comisiones pactadas, incidencias,
  historial de colaboración, métricas de agentes individuales.
- **Acciones que comprometen** · enviar a firma, revocar contratos,
  pausar colaboración, cambiar comisión.
- **Datos financieros** · precios, márgenes, cierre de ventas, uso de
  plan de la empresa.
- **Configuración del workspace** · roles, miembros, integraciones
  externas, zona crítica.
- **Conversaciones/mensajes** de otros usuarios del workspace.

**Cómo se aplica.**

1. Declara la key en `PermissionKey` con comentario explicando qué
   protege exactamente:
   ```ts
   | "collaboration.contracts.manage"   // subir contrato + enviar a firmar
   ```
2. Añádela al rol `admin` por defecto en `DEFAULT_ROLE_PERMISSIONS`.
   `member` solo si procede (por defecto: no).
3. En el componente, consulta con el hook:
   ```ts
   const canManage = useHasPermission("collaboration.contracts.manage");
   if (!canManage) return null; // o mostrar empty state "Sin acceso"
   ```
4. En el catálogo canónico de `docs/permissions.md`, añade la key con
   su default por rol y el flujo donde se aplica.

**Niveles de aplicación:**

- **Ruta completa** → early return con empty state "Sin acceso" si el
  usuario no tiene la key (ver `ColaboracionPanel.tsx`).
- **Sección** → se oculta la sección (no renderiza nada).
- **Acción** → se oculta el botón (no renderiza).

**Naming convention:** `<dominio>.<scope>.<accion>`:

- `collaboration.panel.view` · ver panel entero.
- `collaboration.contracts.view` · ver lista de contratos.
- `collaboration.contracts.manage` · crear/enviar/revocar contratos.
- `collaboration.incidents.view` · ver incidencias.

**Por qué.** Los clientes que más peso tienen en este SaaS (promotores
con equipos) NO quieren que su agente junior vea con qué comisión
trabaja cada agencia, ni los contratos firmados, ni las reclamaciones
abiertas. Si se filtra una vez, perdemos la cuenta. Mejor ser
paranoico y declarar cada sensitive-view con su key.

**Checklist al añadir una vista/acción sensible:**

- [ ] ¿Declaré la key en `PermissionKey` con comentario?
- [ ] ¿La añadí al rol `admin` por defecto?
- [ ] ¿El componente hace `useHasPermission(key)` y oculta si no?
- [ ] ¿La documenté en `docs/permissions.md` con default por rol?
- [ ] Si es ruta completa · ¿tiene empty state "Sin acceso" con
      explicación del porqué?

---

## 🧭 REGLA DE ORO · Ficha pública vs panel operativo al entrar en una agencia

> **Si la agencia YA es colaboradora activa, clicar para verla lleva al
> PANEL operativo (`/colaboradores/:id/panel`). Si NO es colaboradora
> todavía (pending, inactive, marketplace, resultado de búsqueda) lleva
> a la FICHA PÚBLICA (`/colaboradores/:id`).**
>
> Antes de colaborar, el promotor necesita marketing (descripción,
> mercados, equipo, testimonios). Una vez colaboran, quiere operativa
> — no el brochure.

**Helper canónico** · `src/lib/agencyNavigation.ts`:

```ts
import { agencyHref, isActiveCollaborator } from "@/lib/agencyNavigation";

navigate(agencyHref(agency));
// opcional · preserva contexto de promoción en el panel
navigate(agencyHref(agency, { fromPromoId: p.id }));
```

**Criterio** · `isActiveCollaborator(a) = a.status === "active" || a.estadoColaboracion === "activa"`.

**No hardcodear `/colaboradores/:id`** para abrir desde click de usuario.
Todo `navigate()` / `<Link to=...>` hacia una agencia debe pasar por
`agencyHref()` — si no, la regla se rompe en sitios nuevos.

**Excepción** · rutas explícitas donde el usuario pidió ficha pública
(ej. botón "Ver ficha pública" dentro del panel). En ese caso sí se
linkea a `/colaboradores/:id` directamente · queda documentado en el
propio componente.

---

## 🛂 REGLA DE ORO · Setup de Responsable de agencia bloquea acciones críticas

> **Toda agencia recién dada de alta vía `/invite/:token` (caso 1)
> arranca con el setup de Responsable PENDIENTE.** Hasta que el user
> elige "Soy el Responsable" o "Quiero invitar al Responsable", el
> sistema NO debe permitir acciones críticas que dependan de tener
> la cadena de mando clara · si el user pulsó "Lo haré más tarde",
> el modal vuelve a aparecer al disparar cualquiera de esas acciones.

**Por qué.** El Responsable es la única persona que puede legalmente
firmar contratos, gestionar permisos, cambiar plan y representar a la
agencia. Si el sistema permite hacer esas cosas sin saber quién es el
Responsable, queda data huérfana y puede haber disputas a posteriori
("yo no autoricé esa firma", "yo no contraté ese plan").

**Estados del setup** (ver `src/lib/agencyOnboarding.ts`):

- `pending` (sin estado en storage) · acaba de crearse la agencia ·
  el modal `<ResponsibleSetupDialog>` aparece bloqueante en cualquier
  pantalla.
- `deferred` · el user pulsó "Lo haré más tarde" · `deferredAt` en
  storage · el modal NO se auto-abre, pero el banner ámbar
  `<PendingResponsibleBanner>` sale persistente arriba de la app +
  cualquier acción crítica dispara el modal otra vez.
- `completed` · el user eligió "Soy el Responsable" o terminó el form
  de "Invitar Responsable" · `completedAt` en storage · ni modal ni
  banner.

**Catálogo de acciones críticas** que DEBEN re-disparar el modal si
el setup está pendiente o aplazado:

- Invitar miembros del equipo (`/ajustes/usuarios/miembros`).
- Generar / firmar contratos de colaboración.
- Aprobar / rechazar registros recibidos.
- Editar datos fiscales o legales de la agencia.
- Cambiar plan de suscripción / acceder a billing.
- Conectar integraciones externas (Google Calendar, WhatsApp Business,
  pasarelas de pago).
- Aceptar términos legales nuevos en nombre de la agencia.

**Cómo aplicar el guard** (patrón canónico):

```tsx
import { useState } from "react";
import { needsResponsibleSetup } from "@/lib/agencyOnboarding";
import { ResponsibleSetupDialog } from "@/components/agency-onboarding/ResponsibleSetupDialog";
import { useCurrentUser } from "@/lib/currentUser";

function CriticalActionButton() {
  const user = useCurrentUser();
  const [forceSetup, setForceSetup] = useState(false);

  const handleClick = () => {
    if (user.accountType === "agency" && user.agencyId
        && needsResponsibleSetup(user.agencyId)) {
      setForceSetup(true);
      return;
    }
    /* … ejecuta la acción crítica real … */
  };

  return (
    <>
      <button onClick={handleClick}>Invitar miembro</button>
      {forceSetup && (
        <ResponsibleSetupDialog forceOpen onClose={() => setForceSetup(false)} />
      )}
    </>
  );
}
```

El dialog acepta `forceOpen` + `onClose` precisamente para este caso ·
así el caller decide si re-intentar la acción tras el setup completo.

**Checklist al añadir una acción crítica nueva:**

- [ ] ¿La acción cambia algo que solo el Responsable debería poder
      autorizar? Si sí, aplica el guard.
- [ ] ¿Se invoca desde un botón? Envuelve el handler.
- [ ] ¿Se invoca desde un `onSubmit` de formulario? Mete el check al
      principio y bloquea el submit.
- [ ] ¿La hace una agencia o un promotor? Solo aplica a `accountType ===
      "agency"` · los promotores tienen su propio flujo de billing.

**TODO(backend).** Cuando llegue la API real, este guard pasa al servidor:
los endpoints críticos comprueban el flag de onboarding del workspace
y devuelven `409 onboarding_incomplete` si hay setup pendiente. El
frontend lee el código y abre el modal igual que ahora.

---

## 🏷️ REGLA DE ORO · Promotor vs Comercializador · label dinámico

> **Cada promoción se crea como `promotor` o `comercializador` (campo
> `Promotion.ownerRole`). Toda la copy de la UI que hoy dice "promotor"
> hardcodeado DEBE leer ese campo y resolverse dinámicamente con los
> helpers de `src/lib/promotionRole.ts`.** Una agencia colaboradora
> puede estar trabajando con un promotor o con un comercializador
> exclusivo · si la UI dice "Esperando decisión del promotor" pero la
> promoción la lleva un comercializador, la copy es engañosa y rompe
> la confianza del partner.

**Modelo.**

- `Promotion.ownerRole?: "promotor" | "comercializador"` (default
  "promotor" para retrocompatibilidad). Set en el wizard de creación
  vía `WizardState.role` (ya existe · `RoleOption` en
  `src/components/crear-promocion/types.ts`).
- Es per-promoción, NO per-workspace · una misma empresa puede tener
  algunas promociones donde es promotor y otras donde es
  comercializador. La fuente de verdad vive en la promoción concreta.

**Helpers canónicos** · `src/lib/promotionRole.ts`:

```ts
import {
  getOwnerRoleLabel,         // "Promotor" | "Comercializador" · titulares
  getOwnerRoleLabelLower,    // "promotor" | "comercializador" · body inline
  getOwnerRoleArticleLower,  // "el promotor" | "el comercializador" · frases
  getOwnerRoleGenitive,      // "del promotor" | "del comercializador" · "Decisión del…"
  resolveOwnerRole,          // "promotor" | "comercializador" · branching lógico
} from "@/lib/promotionRole";

// Ejemplos de uso:
<p>Esperando decisión {getOwnerRoleGenitive(promo)}.</p>
<p>{getOwnerRoleArticleLower(promo)} aprobará el registro.</p>
<Tag>{getOwnerRoleLabel(promo)}</Tag>
```

**Sitios que SÍ deben migrar** (toda copy visible al usuario):

- Registros · "Esperando decisión del promotor", "Aprobado/Rechazado
  por el promotor", "Registro directo del promotor".
- Banner de visita y dialog de cancelación · "Cancelar visita
  (promotor)" → "Cancelar visita ({rol})".
- Activity timeline · `decision: { defaultTitle: "Decisión del
  promotor" }` debe leer la promo asociada.
- Emails y plantillas · cuando lleguen al backend, el handler debe
  resolver el label antes de renderizar.
- Toda mención de "el promotor" en copy informativa.

**Sitios que NO migran** (uso técnico/admin · queda "Promotor" fijo):

- `AccountSwitcher` · label de la cuenta del workspace · es el rol
  global del usuario logueado, no de una promoción concreta. Se
  resuelve aparte cuando se modele `Workspace.kind`.
- Plan de suscripción · "Plan Promotor 249€/mes" es nombre de
  producto comercial, no rol de promoción.
- `Promociones.tsx` placeholder de búsqueda · es texto de UX
  genérico ("Buscar promoción, promotor, ubicación") · no aplica.
- Comentarios en código (`// el promotor decide…`) · son
  documentación técnica, no copy visible.

**Checklist al añadir copy nueva que hable del owner:**

- [ ] ¿Tengo la `Promotion` en contexto? Sí → usar helpers de
      `promotionRole.ts`. No → bloquear y subir el `promo` por props.
- [ ] ¿Estoy hardcodeando "Promotor" o "el promotor" en JSX? → mal,
      usar helper.
- [ ] ¿La copy aparece en lado agencia? → doblemente importante ·
      la agencia NO debería ver "promotor" si trabaja con un
      comercializador.

**TODO(backend).** Cuando exista la API, `GET /api/promociones/:id`
devuelve `ownerRole`. Si en el futuro un workspace solo opera como
comercializador, considerar mover el campo también a
`organizations.kind` para defaults; per-promoción sigue siendo la
fuente de verdad.

---

## ⏳ REGLA DE ORO · Contratos · alerta a 60 días

> **Toda UI que muestre estado de un contrato firmado con `expiresAt`
> DEBE avisar cuando queden ≤ 60 días para que venza.** Es el margen
> mínimo razonable para que el promotor renegocie/renueve antes de
> quedarse sin marco legal con la agencia. Por debajo de eso queda
> "Sin contrato" en cuanto caduca · ya es tarde.

**Por qué 60 y no 30 ni 90.**

- 30 días → no da tiempo a redactar, revisar, mandar a firma y firmar
  un contrato nuevo. Negociación + Firmafy + email + lectura suele
  comer 2-3 semanas; el último día siempre se acumula con vacaciones,
  contrato pendiente del legal, etc.
- 90 días → ruidoso · el promotor ve la alerta meses antes, la
  ignora, y cuando llega el momento crítico la alerta es ambiental
  (lobo lobo).
- 60 días → margen suficiente para mover ficha sin saturar el panel.

**Fuente única de verdad.**

```ts
// src/lib/collaborationContracts.ts
export const CONTRACT_NEAR_EXPIRY_DAYS = 60;
export function daysUntilContractExpiry(c, refDate?): number | null;
```

Cambiar el número aquí impacta a TODOS los consumidores · NO
duplicar el threshold en otra parte.

**Consumidores actuales** (auditar al añadir uno nuevo):

- `getContractStatus()` en `src/data/agencies.ts` · estado global
  de la agencia · aparece en:
  - Header del panel `/colaboradores/:id/panel` (chip "Vence en Xd").
  - Listado `/colaboradores` (filtro "Por expirar" + chip por agencia).
  - `AgenciasTabStats` en `/promociones/:id?tab=Agencies`.
- `ResumenTab.tsx` · chip por promoción dentro del panel
  (`Sin contrato | Vence en Xd | Contrato vigente`).

**Tres estados visuales** en cualquier chip de contrato firmado:

| Estado          | Token de color               | Icono           | Label                  |
|-----------------|------------------------------|-----------------|------------------------|
| `sin-contrato`  | `text-warning bg-warning/10` | `AlertTriangle` | "Sin contrato"         |
| `por-expirar`   | `text-warning bg-warning/10` | `Clock`         | "Vence en {N}d"        |
| `vigente`       | `text-success bg-success/10` | `Check`         | "Contrato vigente"     |

`sin-contrato` y `por-expirar` comparten color · son ambos avisos.
La diferencia visual es el icono + el label · no inventes una
tercera tonalidad (rojo más fuerte) que rompa la paleta.

**Contratos sin `expiresAt`** (indefinidos) NUNCA caen en
`por-expirar` · se tratan como vigentes infinitos. Si una promoción
está cubierta por al menos un contrato indefinido, se considera
"vigente" aunque otros contratos de la misma agencia estén por
vencer · cubre lo que necesita cubrir.

**TODO(backend).** Cuando se conecte el real, mantener:

- `GET /api/agencias/:id/contract-status` · devuelve
  `{ state, daysLeft }` para el chip global.
- `GET /api/agencias/:id/promotions/:promoId/contract-status` ·
  per-promo, mismo shape.
- Cron diario (00:00 UTC) que dispara
  `recordCompanyEvent("contract.near_expiry", { agencyId, contractId, daysLeft })`
  el día que un contrato cruza el umbral (de 61 → 60 días). Se
  registra UNA sola vez por contrato · no spam.
- Email automático al promotor cuando `daysLeft = 60` y `daysLeft = 14`
  (plantilla `contract-near-expiry` registrada en
  `/ajustes/plantillas`, categoría "Notificaciones transaccionales").

**Checklist al añadir UI nueva con estado de contrato:**

- [ ] ¿Importé `CONTRACT_NEAR_EXPIRY_DAYS` o uso `getContractStatus()`?
- [ ] ¿Renderizo los TRES estados (sin-contrato / por-expirar / vigente)?
- [ ] ¿Uso los tokens canónicos (`text-warning` para los dos primeros,
      `text-success` para el tercero)?
- [ ] ¿Actualicé esta sección con la nueva ubicación si añadí un sitio?

---

## 🔁 REGLA DE ORO · Ciclo de vida de la colaboración por promoción

> **El menú de "3 puntos" sobre cada card de promoción compartida en
> el panel de colaboración expone EXACTAMENTE tres acciones:
> Renovar contrato, Pausar/Reanudar colaboración, Anular colaboración.
> Solo lo ve quien comparte la promoción** (promotor, comercializador,
> o agencia que comparte con otra agencia · NO la receptora).

**Modelo de estado.**

Estado per-promo en `src/lib/promoCollabStatus.ts`:

```ts
type PromoCollabStatus = "activa" | "pausada" | "anulada";
```

Distinto del campo global `Agency.estadoColaboracion` (a nivel
agencia, todas las promos). Aquí la fuente de verdad vive por par
`(agencyId, promotionId)`. `activa` es el default · no se persiste
fila en el store.

**Reglas de las 3 acciones.**

1. **Renovar contrato.** Solo aparece si la promo TIENE al menos un
   contrato firmado no archivado que la cubre. Abre el flujo normal
   de subida de contrato con scope preseleccionado a esa promo. Al
   subir el nuevo, los contratos sustituidos se archivan
   automáticamente (`uploadContract({ replacesContractIds })` con
   evento "Sustituido por renovación · contrato {newId}" en cada
   antiguo). En `DocumentacionTab` el contrato nuevo lleva chip
   "Renovación" + nota "Sustituye al contrato anterior por
   renovación"; el archivado lleva chip "Sustituido por renovación".

2. **Pausar / Reanudar colaboración.** Stand-by reversible. La
   agencia NO puede registrar nuevos clientes ni compartir la promo
   mientras esté `pausada`. Las ventas, registros, visitas y
   comisiones existentes SE MANTIENEN intactas. Quien comparte
   reanuda con un click. Dispara `recordCollaborationPaused` /
   `recordCollaborationResumed` en el historial cross-empresa.

3. **Anular colaboración.** Fin para esta promo (per-promo, no
   afecta a otras). La promo desaparece del panel. Variant
   destructive. El confirm dialog DEBE explicar literalmente:
   - La agencia dejará de ver la promoción.
   - No podrá registrar nuevos clientes ni programar visitas.
   - Las ventas cerradas, registros aprobados, visitas realizadas
     y comisiones devengadas hasta ahora se MANTIENEN intactas.
   - Solo se cierra la puerta a actividad nueva.
   Dispara `recordCompanyAny(agencyId, "collaboration_ended", ...)`.

**REGLA DURA · datos históricos NUNCA se borran.** Pausar y anular
SOLO controlan visibilidad / capacidad de operar a futuro. Las
comisiones devengadas siguen pagándose, las ventas siguen contando
en estadísticas, los registros siguen apareciendo en el historial.
Si alguna métrica nueva en el futuro depende de "colaboración viva",
filtrar por `getPromoCollabStatus !== "anulada"` en el agregador,
NUNCA borrando filas.

**Quién ve el menú.** Solo quien comparte la promoción puede
disparar las acciones · en `ResumenTab` el dropdown se renderiza
únicamente cuando `!readOnly`. La receptora (agencia colaboradora
viendo la ficha del promotor) lo ve oculto.

**Backend.**

```http
PATCH /api/agencias/:agencyId/promotions/:promoId/collab-status
Body: { status: "activa"|"pausada"|"anulada", reason?: string }
```

Mutación atómica · un único cambio dispara:
- Update de `(agencyId, promotionId, status)` en tabla
  `promotion_collab_status`.
- Insert en `company_events_log` con el tipo correspondiente.
- Si `anulada`: notificación email a la agencia receptora avisando
  del cierre + lista de operaciones históricas que sigue pudiendo
  consultar en su panel histórico.

Renovación · `POST /api/contracts` con campo
`replacesContractIds: string[]` opcional. El backend hace la
transacción `INSERT new + UPDATE old SET archived=true,
replaced_by_contract_id=newId` en una sola tx para que la UI
nunca vea estado intermedio inconsistente.

**Checklist al añadir UI nueva con estas acciones:**

- [ ] ¿La acción solo se muestra a quien comparte (no readOnly)?
- [ ] ¿El confirm de "Anular" lista explícitamente qué se preserva?
- [ ] ¿La acción dispara el `recordCompanyEvent` correspondiente?
- [ ] ¿El estado se persiste vía `setPromoCollabStatus` (no
      mutación directa de localStorage)?
- [ ] Si añado una vista que dependa de "colaboración viva",
      ¿filtro por `!== "anulada"` en lugar de borrar filas?

---

## ✍️ REGLA DE ORO · Firma del contrato desde el lado agencia

> **El canal principal de firma es Firmafy (email + SMS con OTP) ·
> Byvaro es un recordatorio en pantalla, NO el canal de firma.**
> Cuando un contrato se envía a firmar (`status: "sent"` o
> `"viewed"`), la agencia receptora debe poder verlo y entrar a
> firmar desde su panel también, por si pierde el email/SMS.

**Flujo end-to-end** (ya descrito en `docs/backend/integrations/firmafy.md`):

```
Promotor sube → Picker scope → Upload Dialog → uploadContract +
sendContractToSign → backend POST Firmafy action=request → CSV +
status=sent → Firmafy envía email + SMS al firmante → agencia
firma con OTP → webhook type=1 → backend marca status=signed +
guarda PDFs → cron actualiza UI promotor + agencia.
```

**Lo que ve la AGENCIA en Byvaro** (cuando `readOnly`):

1. **Banner arriba del Resumen** — `<FileSignature>` primary tone:
   "Tienes N contrato(s) pendiente(s) de firmar · revisa tu email y
   SMS de Firmafy o ábrelo desde aquí". Click → abre
   `<AgencySignContractDialog>` con el primer pendiente.

2. **Chip por promoción** — en cada card cuya promo está cubierta
   por un contrato `sent`/`viewed` aparece chip clickable
   "Pendiente de firma" (primary tone). Tiene PRIORIDAD sobre los
   chips "Sin contrato" / "Vence en Nd" / "Contrato vigente".

3. **Banner ámbar "Sin contrato firmado"** — solo cuenta promos
   SIN contrato vivo (signed o sent). Las que tienen pendiente NO
   entran ahí · la copy sería contradictoria.

4. **`<AgencySignContractDialog>`** — al hacer click, dialog con:
   - Resumen del acuerdo (alcance, comisión, duración, fecha límite).
   - Lista de firmantes con su `signerStatus` y badge "Tú" si email
     coincide con el del usuario actual.
   - Aviso: "La firma se realiza en Firmafy con código OTP por SMS"
     · "Te ha llegado el link a tu email y un SMS al {teléfono}".
   - CTA primary "Firmar en Firmafy" (`window.open(signUrl, "_blank")`).
   - Si el usuario NO es firmante o no hay `signUrl`, mensaje pasivo
     ("Solo los firmantes designados pueden firmar" / "Link no
     disponible · revisa tu email/SMS").

**El backend NUNCA devuelve `signUrl` de OTRA agencia ni del
promotor** · solo el del usuario actual si es firmante. RLS en la
tabla `contract_signers` filtra por email del JWT.

**Variantes admitidas** según `Contract.shipmentType` (Firmafy):
- `form` (default) → form pre-rellenado.
- `link` → link directo de firma.
- `email` → email con PDF adjunto.
- `sms` → SMS con link corto.

Independientemente del tipo, en la UI siempre exponemos `signUrl`
en pestaña nueva. Firmafy se encarga del envoltorio.

**Validación legal.** Firmafy emite el PDF firmado + PDF de
auditoría · ambos quedan guardados en storage privado
(`docSignedKey`, `docAuditKey`). La auditoría incluye IP, datesign,
email + teléfono OTP del firmante · válido en España según eIDAS.

**TODO(backend) · cuando aterrice la API real:**

- `GET /api/contracts/pending-for-me` (lado agencia · usa JWT) →
  lista de contratos `sent`/`viewed` donde el usuario actual es
  firmante con `signerStatus !== "signed"`. Incluye
  `signers[].signUrl` SOLO del firmante actual.
- `GET /api/contracts/:id` (cross-tenant lectura) · si el
  workspace_id del usuario es la agencia receptora, devuelve la
  vista filtrada. El promotor lo ve con todos los detalles +
  acciones de gestión (extender, revocar, reenviar).
- Push realtime al webhook · cuando llegue `signed`, los paneles
  de ambos tenants reciben actualización vía Pusher/Ably/SSE para
  que el chip pase de "Pendiente de firma" → "Contrato vigente"
  sin reload.

**Checklist al añadir UI nueva con contratos pendientes de firma:**

- [ ] ¿Solo se renderiza cuando `readOnly` (lado agencia)?
- [ ] ¿Usa `<AgencySignContractDialog>` (no recreas el dialog)?
- [ ] ¿Pasa `currentUserEmail` para resaltar SU firmante?
- [ ] ¿Abre `signUrl` en pestaña nueva con `noopener,noreferrer`?
- [ ] ¿Mensaje genérico que NO asume canal único (Firmafy email +
      SMS son los principales · pero podría haber rebote de email)?

---

## 🚧 REGLA DE ORO · `canPublishPromotion` es del DUEÑO, no del visor

> **`canPublishPromotion(p)` (y por extensión `getMissingForPromotion`,
> `empresaTieneIdentidad`) valida si EL DUEÑO de la promoción
> (promotor / comercializador) puede publicarla. NUNCA aplicar este
> check al lado AGENCIA / receptor.** Es un gate del workspace dueño,
> no del workspace que la observa.

**Por qué.** `empresaTieneIdentidad()` lee `byvaro-empresa` del
localStorage del navegador actual y comprueba `nombreComercial ||
razonSocial`. En el modelo single-tenant mock, ese localStorage
representa la empresa del workspace logueado:

- Promotor logueado → `byvaro-empresa` contiene los datos del promotor
  → check válido para validar publicación.
- Agencia logueada → `byvaro-empresa` contiene los datos de la AGENCIA
  → el check valida la identidad de la AGENCIA, no del promotor dueño
  de la promoción · semánticamente incorrecto.

Si la agencia tiene `byvaro-empresa` vacío (navegador limpio o
onboarding sin completar), TODAS las promociones del promotor se
marcan como "no publicables" y desaparecen del listado / dashboard
de la agencia. Ese fue el bug de Erik (admin de Nordic Home Finders)
viendo 0 promociones en navegador limpio mientras Anna (member) las
veía porque su navegador tenía estado anterior.

**Regla.** Las promociones que llegan a la cartera de una agencia
(`agency.promotionsCollaborating` + overrides en `agencyCartera.ts`)
YA pasaron por el panel del owner — el promotor no la habría
compartido si no la pudiera publicar. Reverificar al lado agencia
es pelado. Worse: filtra en falso.

**Sitios donde NO se debe llamar a `canPublishPromotion` al lado
agencia** (auditar al añadir uno nuevo):

- `Promociones.tsx` · pool agencia + filtro de tabs.
- `AgencyHome.tsx` · `promocionesAsignadas` del dashboard.
- Cualquier listado / KPI / banner que use `useAgencyCartera` o
  `agency.promotionsCollaborating`.

**Patrón canónico:**

```ts
const isAgencyUser = currentUser.accountType === "agency";

pool.filter((p) => {
  if (!ids.has(p.id)) return false;
  if (p.status !== "active") return false;
  if (!isAgencyUser && !canPublishPromotion(p)) return false;
  if (p.canShareWithAgencies === false) return false;
  return true;
});
```

**Cuándo SÍ aplica `canPublishPromotion`.**

- Lado promotor · `Promociones.tsx` con tab "published" · cards del
  promotor que aún no rellenó identidad muestran "Sin publicar".
- `CrearPromocion.tsx` · botón "Publicar" deshabilitado si `false`.
- `useUsageGuard("createPromotion")` cuando se intenta activar.

**Backend.** Cuando aterrice multi-tenancy real, `byvaro-empresa`
desaparece y cada promo lleva su `ownerOrganizationId`.
`canPublishPromotion(p)` aceptará un `Empresa` parameter (de
`GET /api/empresas/:ownerOrganizationId`) en vez de leer de
localStorage. El bug se elimina por construcción.

**Checklist al añadir UI nueva del lado agencia:**

- [ ] ¿Estoy filtrando por `canPublishPromotion` o
      `getMissingForPromotion` el lado agencia? Si sí, fallo · usa
      `isAgencyUser` para skipearlo.
- [ ] ¿La data viene de `agencyCartera` / `promotionsCollaborating`?
      Si sí, no necesita re-validación.
- [ ] Probar con navegador 100% limpio (sin localStorage) logueado
      como agency · si ves 0 promociones, hay un check
      contaminado leyendo `byvaro-empresa`.

---

## ✅ REGLA DE ORO · Tick azul de verificación junto al nombre

> **Donde aparece el nombre de una agencia y está verificada,
> SIEMPRE debe aparecer el tick azul (`<VerifiedBadge>`) pegado
> al nombre · sin excepciones.** Es identidad visual del producto.

**Cómo se aplica.** En cualquier componente que renderice
`agency.name`, si la agencia está verificada debe ir el tick
inline justo al lado (no en otro chip-row, no flotando en
otro lado de la card).

```tsx
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { VerifiedBadge } from "@/components/collaborators/panel/DatosTab";

<h3 className="inline-flex items-center gap-1.5">
  {a.name}
  {isAgencyVerified(getAgencyLicenses(a)) && <VerifiedBadge size="sm" />}
</h3>
```

**Regla de la fuente.** Siempre `isAgencyVerified(getAgencyLicenses(a))`
— no `isAgencyVerified(a.licencias)`. El helper `getAgencyLicenses(a)`
aplica los overrides que la propia agencia haya guardado en
localStorage via `/ajustes/empresa/licencias`.

**Tamaños del tick** · `<VerifiedBadge size="sm|md|lg">`:
- `sm` (16px) · chips y listas.
- `md` (20px) · junto a `<h1>` / `<h2>` en headers.
- `lg` (24px) · hero grande del perfil.

**Lista de sitios ya cubiertos** (update si añades uno nuevo):
- `/colaboradores` · card del listado y card de solicitudes pendientes.
- `/colaboradores/:id/panel` · header del panel operativo.
- `/colaboradores/:id/panel?tab=datos` · header de la ficha.
- `/colaboradores/:id` → `Empresa.tsx` · header público.
- `/promociones/:id?tab=Agencies` · `AgenciasTabStats` grid y list.
- `SharePromotionDialog` · `SelectableAgencyCard`.
- `AgenciaEntry` · lista de selección de cuenta.
- `AccountSwitcher` · topbar dropdown.

**Checklist al añadir una vista que renderice una agencia:**
- [ ] ¿El tick azul sale al lado del nombre si `isAgencyVerified(getAgencyLicenses(a))`?
- [ ] ¿Usé `size="sm"` (listas) o `"md"` (headers) según contexto?
- [ ] ¿Añadí la ruta a la lista de sitios cubiertos aquí arriba?

---

## 🛡️ REGLA DE ORO · Permisos y visibilidad

> **El catálogo canónico de permisos vive en `docs/permissions.md`.**
> Antes de añadir una key nueva, ocultar/mostrar un botón por rol o
> filtrar un listado por ownership, lee ese documento. Si te falta un
> caso, anótalo allí como Open Question — NO inventes claves nuevas.

**Modelo en dos ejes**:
1. **Rol del workspace** (`admin` | `member` | custom): qué FEATURES.
2. **Ownership** (own / all): qué REGISTROS dentro de cada feature.

`*.viewAll` implica `*.viewOwn`. El admin tiene **todo** por defecto
(escudo en `useHasPermission()` que devuelve true sin consultar la matriz).

**Hooks principales**:
```ts
useHasPermission(key)   // src/lib/permissions.ts
isAdmin(user)           // src/lib/currentUser.ts
useCurrentUser()        // src/lib/currentUser.ts
// TODO(visibility): useVisibilityFilter(scope) → predicado para listas
```

**Cómo aplicar**:
- **Acciones** (botones, mutaciones): `if (!useHasPermission("dom.action")) return null;`
- **Vistas enteras**: `if (!viewOwn) return <NoAccessView />;` (ver patrón en `ContactWhatsAppTab.tsx`).
- **Listados**: filtrar por `assignedTo.includes(user.id)` cuando solo hay `viewOwn`. **Ahora mismo nadie filtra** — la mayoría de pantallas asumen `viewAll`. Es una **deuda conocida** documentada en `docs/permissions.md` §6.

**Estado del código (abril 2026)**:
- ✅ Solo WhatsApp respeta permisos.
- ❌ Contactos / Registros / Operaciones / Visitas / Documentos / Emails muestran TODO sin filtrar.
- ❌ Faltan ~50 keys por declarar (catálogo completo en `docs/permissions.md` §2).

**Para el agente que monte el backend**: el contrato (esquema SQL, JWT
claims, RLS policies, endpoints) está en `docs/permissions.md` §4.
Implementar **antes** de quitar el modo mock de `permissions.ts`.

---

## 📣 REGLA DE ORO · Reglas de marketing por promoción

> **Toda promoción compartida con agencias lleva reglas de
> marketing/publicación.** El promotor define qué canales (portales
> inmobiliarios, redes sociales, ads) quedan PROHIBIDOS; la agencia
> los ve en la ficha y DEBE respetarlos. Violarlos puede extinguir
> el contrato.

**Cómo se aplica hoy (mock).**

- Catálogo canónico en `src/lib/marketingChannels.ts` (15 canales · 3
  categorías · portales · redes · publicidad). Ids estables — si
  Byvaro integra un portal nuevo, se añade entrada; nunca se
  renombran ids existentes.
- Storage por promoción en `src/lib/marketingRulesStorage.ts`
  (localStorage · hook reactivo `useMarketingProhibitions(id)`).
- UI en la ficha:
  - Entrada en el dock "Acciones rápidas" de la derecha
    (`PromocionDetalle.tsx` → `renderQuickActionsRail`) · icono
    `Megaphone`.
  - Tarjeta `<MarketingRulesCard>` al pie del tab Vista general
    (solo si `sharingEnabledForPromo`) · verde cuando no hay
    restricciones · ámbar con chips `<Ban>` cuando las hay · nota
    legal sobre extinción de contrato.
  - Dialog de edición `<MarketingRulesDialog>` · switches por canal
    agrupados por categoría · solo lo ve el promotor (el botón
    "Editar" se oculta con `viewAsCollaborator`).

**Cómo se aplicará con backend real.**

- `PATCH /api/promociones/:id { marketingProhibitions: string[] }`.
- Cuando se enchufen los conectores de portales
  (`src/lib/portalIntegrations/*` · fase futura), el dispatcher de
  publicación DEBE rechazar con 422 `channel_prohibited` si la
  agencia intenta publicar a un canal prohibido, y la UI del lado
  agencia debe deshabilitar ese botón con tooltip "El promotor ha
  prohibido este canal".
- Incidencias por violación · webhook del portal → registra evento
  `marketing.violation` en el historial cross-empresa
  (`recordCompanyEvent`) + notifica al admin.
- La cláusula de marketing del contrato de colaboración debe
  referenciar la regla textualmente · plantilla en
  `/ajustes/plantillas` categoría "Documentos → contratos".

**Obligaciones al añadir feature nueva que toque publicación/canal:**

1. ¿Hay un canal nuevo (portal o red)? → añadirlo al catálogo
   `marketingChannels.ts` con id kebab-case estable.
2. ¿La feature hace push a un portal desde el lado agencia? →
   consumir `isChannelProhibited(promotionId, channelId)` antes de
   habilitar el botón/acción. Documentar con `TODO(backend)` el
   gate server-side.
3. ¿Añades icono de "prohibido" en UI? → usa `<Ban>` de Lucide con
   `text-destructive` (coherente con `MarketingRulesCard` y
   `MarketingRulesDialog`).

Ver `docs/backend-integration.md §4.3` para el contrato completo.

---

## 🖱️ Popovers/Dropdowns/Selects dentro de Dialogs · fix de scroll

Cuando un `Popover`, `DropdownMenu` o `Select` de Radix se abre dentro
de un `Dialog` (que también es de Radix), el Dialog aplica scroll-lock
global (vía `react-remove-scroll`). El popover se portalea al body,
pero los `wheel` / `touchmove` se interceptan arriba del todo → **el
scroll interno del popover no funciona** y parece que está "colgado".

**Fix aplicado de forma global** en los tres wrappers canónicos:

- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`

Cada wrapper hace `e.stopPropagation()` en `onWheel` y `onTouchMove`
antes de delegar a cualquier handler del caller, y añade
`overscroll-contain` al Content para que el scroll no se fugue al
padre al llegar al final. Además, `onOpenAutoFocus={(e) =>
e.preventDefault()}` debe usarse en popovers que tengan un `<Input>`
dentro para evitar scroll-jump al abrir (Radix no enfoca
automáticamente · el usuario clica el input si quiere escribir).

**Regla para nuevos popovers**: si usas los wrappers canónicos, no
tienes que hacer nada — el fix ya está. Si creas un Content custom con
`@radix-ui/react-*` directamente (sin pasar por los wrappers), añade
tú mismo los `stopPropagation` + `overscroll-contain`.

---

## ⚙️ Settings: marcar `live` al activar

Las sub-páginas de `/ajustes/*` se declaran en
`src/components/settings/registry.ts` con `SettingsLink`. Cada link tiene
un flag opcional `live: boolean`:

- `live: true` → la sub-página tiene contenido funcional (formulario,
  CRUD, etc.). Se renderiza con color normal en el directorio (`AjustesHome`)
  y en el sidebar nav (`SettingsShell`).
- `live: false` (o ausente, por defecto) → la sub-página es un
  **placeholder** ("En diseño"). Se renderiza con `text-muted-foreground/45 italic`
  para que el usuario distinga de un vistazo qué está activo y qué no.

**REGLA**: cuando crees una sub-página real para un placeholder, marca su
link como `live: true` en el registry **en el mismo commit**. El
indicador visual desaparece automáticamente. No te olvides — un
placeholder marcado como `live` engaña al usuario; un real sin marcar
parece roto.

Ejemplo:

```ts
// Antes de implementar la página real
{ label: "Idioma", to: "/ajustes/idioma-region/idioma" }

// Cuando creas la página real (en el mismo commit)
{ label: "Idioma", to: "/ajustes/idioma-region/idioma", live: true }
```

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
| **`docs/backend-integration.md`** | 📌 **Canónico · todo el contrato UI↔API**, endpoints por dominio, crons, integraciones externas, referencias cruzadas a cada `TODO(backend)` del código |
| **`docs/permissions.md`** | 🛡️ **Canónico · permisos y visibilidad** · catálogo completo de keys, defaults por rol, contrato backend (RLS, JWT), contrato frontend, deuda técnica actual |
| `docs/ui-helpers.md` | Catálogo de helpers puros y componentes transversales |
| `docs/services.md` | Servicios externos a instalar para producción |
| `docs/api-contract.md` | Endpoints API esperados (histórico por pantalla) |
| `docs/screens/*.md` | Spec funcional por pantalla (+ `README.md` índice) |
| `docs/open-questions.md` | Preguntas abiertas · consultar antes de inventar |
| `DECISIONS.md` (raíz) | Log de decisiones de diseño/arquitectura |
| `ROADMAP.md` (raíz) | Qué está hecho, qué falta |

---

## 🔌 Handoff al backend · por dónde empezar

Si eres el agente que levanta el backend real:

0. **Entry point dedicado:** `docs/backend/README.md`. Contiene stack
   recomendado, orden de implementación, env vars, webhooks, crons y
   enlaces a los specs profundos:
   - `docs/backend/integrations/firmafy.md` · integración completa
     con Firmafy (contratos de colaboración firmados digitalmente).
   - `docs/backend/domains/collaboration.md` · el pilar del producto ·
     contratos + pagos a agencia + solicitudes de documentación.

1. **Sigue con `docs/backend-integration.md`** — es la **fuente única
   de verdad** del contrato UI↔API. Cada dominio (Promociones, Anejos,
   Colaboradores, Compartir, Estadísticas, etc.) tiene su sección con
   endpoints, shapes, reglas de negocio y referencias cruzadas al
   código (`archivo:línea` donde hay un `TODO(backend)`).
2. **Completa con `docs/data-model.md`** — entidades con su shape TS y
   las reglas de negocio clave (detector de duplicados, validez de
   registros, multi-tenancy, etc.).
3. **Cada pantalla tiene spec en `docs/screens/<nombre>.md`** — ahí
   está el detalle de UX, estados visuales y qué endpoints consume.
4. **`grep -r "TODO(backend)"` sobre `src/`** te da el mapa exacto de
   los puntos donde el frontend espera un endpoint. Cada TODO apunta a
   la sección de `docs/backend-integration.md` donde se especifica.
5. **`DECISIONS.md` (ADRs)** explica *por qué* están las cosas como
   están — léelo antes de proponer cambios estructurales.

**Dominios clave (con su sección en `docs/backend-integration.md`):**

- §3 · Promociones · `GET/PATCH /api/promociones/:id`, galería, brochure.
- §3.1 · **Anejos sueltos** · parkings/trasteros con modelo, origen
  desde wizard y endpoints CRUD + reservations/email.
- §4 · Colaboradores (agencias) · join `Empresa` + `Collaboration`.
- §4.1 · Recomendaciones de agencias (**aparcado** · ver ADR-038).
- §4.2 · Estadísticas de colaboradores · matrices + señales diferenciales.
- §5 · Compartir promoción · invitaciones multi-agencia, crosssell.
- §6 · Favoritos · store central cross-pantalla.
- §7 · Registros / ventas / contactos.
- §8 · Integraciones externas (Google Places, SMTP, WhatsApp).

**Regla de oro al integrar**: preserva todas las invariantes marcadas
en el contrato (filtros que excluyen agencias ya colaboradoras, cambios
de estado que desactivan acciones — ej. `brochureRemoved` → acción
"Brochure" deshabilitada, reglas de privacidad cross-tenant en
recomendaciones). Si algo no queda claro, `docs/open-questions.md` o
detente y pregunta — no inventes.

---

## 📜 REGLA DE ORO · Documentación obligatoria

**Es obligatorio para todo agente/colaborador que trabaje en este repo.**

### ⚠️ Al finalizar cualquier cambio no trivial · checklist antes de cerrar

Antes de responder "listo/hecho" al usuario **tienes que pasar esta check
explícita**, tocando cada punto y marcando:

- [ ] **Código** · ¿hay `TODO(backend)` junto a todo mock/localStorage nuevo?
- [ ] **`docs/backend-integration.md`** · ¿los endpoints nuevos están en la
      sección de dominio correspondiente, con referencia `archivo:línea`?
- [ ] **`docs/data-model.md`** · ¿el tipo nuevo/ampliado está documentado?
- [ ] **`docs/screens/*.md`** · ¿la pantalla afectada refleja el cambio?
      Si es pantalla nueva, ¿añadido al `docs/screens/README.md`?
- [ ] **`docs/ui-helpers.md`** · ¿helper transversal nuevo registrado?
- [ ] **`DECISIONS.md`** · ¿decisión no trivial con ADR nuevo?
- [ ] **`CLAUDE.md`** · ¿alguna regla nueva del sistema que anotar?

### 🙋 Pregunta obligatoria al terminar

Cuando cierres una tarea, **antes de devolver el control al usuario**, haz
explícitamente esta pregunta (o confirma que no aplica):

> _"¿Queda algo por documentar o actualizar de este cambio? Propongo
> actualizar: [lista concreta de archivos]. Si no hace falta, confirma y
> cierro."_

No es retórica — la respuesta del usuario puede añadir cosas (notas
legales, excepciones, ADR). **Si te saltas la pregunta, asumes riesgo
de dejar documentación obsoleta.** El coste de preguntar es 5 segundos;
el coste de no preguntar puede ser que el backend agent no entienda
qué conectar.

### ¿Por qué esta regla existe?

Byvaro es un proyecto frontend-first con mocks en localStorage. El agente
que levante el backend **nunca habrá vivido esta conversación**. Lo único
que tiene son los docs + los `TODO(backend)` del código. Si la documentación
está incompleta u obsoleta:

- Endpoints mal diseñados (porque no entendió la intención).
- Tipos duplicados (porque no vio que ya existía el modelo).
- Integraciones duplicadas (porque no vio el ADR).
- Reglas de negocio perdidas (porque estaban solo en un chat).

La documentación **es más importante que cualquier refactor**. Si tienes
5 minutos antes de cerrar una tarea, úsalos en docs, no en cosmética.

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
