# Preguntas abiertas · Byvaro

> **Lee esto antes de inventar.** Lista de decisiones de producto y técnicas
> **no tomadas todavía**. Si estás implementando algo y la spec te deja
> ambiguo, revisa aquí primero. Si tu duda no está en esta lista, añádela.
>
> Cuando se tome una decisión, se mueve de aquí a `DECISIONS.md` como un
> nuevo ADR numerado.

---

## 🧠 Producto · Diferenciales clave sin especificar

### Q1 · IA de duplicados (40% del valor) — pendiente de definir

**Contexto.** Núcleo diferencial del producto: cuando entra un registro
nuevo al promotor, un modelo IA compara contra contactos propios +
registros previos a la misma promoción y recomienda aprobar/rechazar.

**No decidido:**
- **Modelo**: ¿Claude Haiku 4.5 (latencia <500ms, $1/M tokens) o
  GPT-4o-mini ($0.15/M tokens)? ¿Modelo propio fine-tuneado con datos
  anotados?
- **Prompt exacto**: ¿cómo se le pasa el contacto nuevo + los previos?
- **Formato de salida estructurado**: actualmente el código tiene
  `{ matchPercentage, matchDetails[], existingClient, recommendation:string }`,
  pero falta el esquema JSON exacto y los thresholds:
  - `< 30%` → auto-aprobar?
  - `30-69%` → mostrar al promotor con recomendación neutra
  - `>= 70%` → recomendación fuerte de rechazar
- **Campos ponderados**: `data-model.md` sugiere 40% teléfono + 30%
  nombre + 20% email + 10% nacionalidad. ¿Se confirma?
- **Latencia objetivo**: ¿síncrono (promotor espera) o asíncrono
  (se ejecuta en background y notifica)?
- **Costes esperados**: ¿cuántos registros/día por promotor? Estimar
  presupuesto mensual de API.

**Impacto de no decidir:** Claude Code implementaría una heurística simple
no-IA, desaprovechando el diferencial.

### Q2 · Microsites (30% del valor) — sin spec de pantalla

**Contexto.** Cada promoción activa genera un microsite público.

**No decidido:**
- **Dominio**: ¿subdirectorio `byvaro.com/<slug>`, subdominio
  `<slug>.byvaro.app`, dominio custom, todos? Prioridad de cada uno.
- **Template**: ¿único fijo o múltiples a elegir? ¿Qué secciones incluye?
  - Hero con galería
  - Tour 3D / render
  - Plantas y tipologías
  - Ubicación en mapa
  - Formulario de contacto
  - Promotor/agencia asignada
- **Editor**: ¿el promotor customiza colores, logo, orden de secciones?
  ¿O plantilla fija y solo puede cambiar textos?
- **SEO**: meta tags automáticos (title, description, og:image), schema
  `RealEstateListing`, sitemap.xml, robots.txt.
- **Formulario de captación**: qué campos obligatorios (nombre, teléfono,
  email, nacionalidad, presupuesto, interés). ¿Captura cookie/UTM para
  trackear origen?
- **i18n**: los compradores internacionales son RU/DE/BE/NL/NO/SE/FR.
  ¿El microsite es multi-idioma? ¿Traducción manual por promotor o
  automática?
- **Analítica**: ¿Plausible? ¿Google Analytics? ¿Meta Pixel para
  remarketing?
- **Build strategy**: ¿SSR (Next.js para SEO), SSG estático por
  promoción, o SPA pública?

**Impacto de no decidir:** pantalla no se puede diseñar.

---

## 🔐 Auth y onboarding

### Q3 · Auth del Promotor

**Contexto.** El agente invitado usa magic link (ADR-024). El **promotor**
no tiene decidido su flujo.

**No decidido:**
- Email + password + Google OAuth ¿es suficiente? ¿Microsoft OAuth?
- 2FA: ¿obligatorio, opcional, solo cuentas enterprise?
- Verify email: ¿bloquea acceso hasta verificar? ¿permite 24h de gracia?
- "Recordar sesión" cuánto dura (7 días? 30 días?)
- Cookie httpOnly + refresh token ¿o JWT en localStorage?

### Q4 · Onboarding del Promotor

**Contexto.** Tras registro, antes de llegar a `/inicio`, flujo de
configuración inicial.

**No decidido:**
- ¿Cuántos pasos y cuáles son obligatorios?
  - Propuesta: Empresa (nombre, CIF, logo) → Datos fiscales → Equipo
    (invitar comerciales) → Primera promoción (opcional)
- ¿Se puede saltar? ¿"Hacerlo más tarde" o bloqueante?
- ¿Hay un "tour" guiado después (onboarding dentro del producto)?

### Q5 · Roles y permisos del equipo del promotor

**Contexto.** ADR-029 dice "diferidos". Pero el código ya tiene botones
de acción (Compartir, Editar, Aprobar registro) que en un equipo pueden
ser solo para ciertos roles.

**No decidido:**
- Roles: ¿Owner · Comercial · Asistente · Contable? ¿Otros?
- Matriz de permisos por rol para cada acción.
- ¿Los roles son customizables por el Owner o fijos?

---

## 📧 Emails transaccionales

### Q6 · Lista completa de emails a enviar

**No decidido:**

Falta definir el catálogo de emails transaccionales y sus variables.
Propuesta inicial a validar:

| Trigger | Destinatario | Cuándo |
|---|---|---|
| Invitación colaboración | Email de agencia | Promotor invita |
| Confirmación registro | Agencia + cliente | Registro creado |
| Registro aprobado | Agencia | Promotor aprueba |
| Registro rechazado | Agencia | Promotor rechaza |
| Visita confirmada | Cliente | Promotor confirma |
| Visita reprogramada | Cliente + agencia | Promotor cambia fecha |
| Reserva firmada | Cliente + agencia | Se cierra venta |
| Recordatorio visita 24h | Cliente | Cron diario |
| Bienvenida promotor | Promotor | Tras onboarding |
| Bienvenida agencia | Agencia | Tras magic link |
| Reset password | Cualquiera | Solicita reset |
| Verify email | Cualquiera | Tras registro |
| Trial ending | Agencia | 3 días antes |

- ¿Plantillas con React Email o MJML?
- ¿Idioma del email: el del destinatario, o del promotor?

---

## 🧩 Convenciones técnicas sin documentar

### Q7 · Formularios

**No decidido:**
- **Librería**: `react-hook-form` + `zod` es el estándar React moderno.
  ¿Lo usamos en Byvaro o vamos con estado React manual?
- **Validación**: ¿inline al blur o al submit?
- **Mensajes de error**: ¿debajo del campo o toast?
- **Loading**: ¿botón deshabilitado con spinner interno?

### Q8 · Data fetching

**No decidido:**
- **Librería**: `@tanstack/react-query` (standard), `swr`, o `fetch` nativo.
- **Caching**: stale-while-revalidate strategy, invalidation por tags.
- **Loading states**: skeleton vs spinner vs progress, cuándo cada uno.
- **Error handling**: toast de error + retry button vs inline.
- **Optimistic updates**: ¿sí para aprobación de registros, etc.?

### Q9 · Estado global

**No decidido:**
- ¿Context API es suficiente o se introduce Zustand/Jotai?
- Estados compartidos identificados: user actual, tenant/company actual,
  config de columnas de tablas, filtros persistentes entre páginas.

### Q10 · Testing

**No decidido:**
- ¿Tests unitarios con Vitest? ¿Cobertura objetivo?
- ¿E2E con Playwright? ¿Flujos críticos a cubrir?
- ¿Tests de integración visuales (Chromatic, Percy)?
- CI que corre tests en cada PR.

### Q11 · Internacionalización

**Contexto.** ADR-014 dice que **la UI interna** del producto es 100%
español. No está decidido qué pasa con los microsites públicos y los
emails al cliente final.

**No decidido:**
- Microsites multi-idioma (ES/EN/RU/DE/FR/NL/NO/SE/BE) — ver Q2
- Emails al cliente final: idioma según `contact.nationality` o
  configurable por promotor
- UI para agencias internacionales: ¿mantener solo español o añadir
  inglés?
- Librería: `react-i18next` es estándar.

### Q12 · Accesibilidad

**No decidido:**
- Nivel objetivo: **AA** (recomendado). ¿O solo "best effort"?
- Tests automatizados: `axe-core` + Playwright.
- Keyboard nav: todos los flujos sin ratón. ¿Se audita?
- Screen readers: pruebas con VoiceOver / NVDA.

### Q13 · SEO de los microsites

**No decidido:**
- Framework: ¿Next.js (SSR/SSG) separado del SPA?, ¿SvelteKit?, ¿Astro?
  ¿O ssr dentro del mismo Vite?
- Sitemap dinámico por promotor.
- Schema `RealEstateListing` + `Place` + `Organization`.
- Open Graph images auto-generadas por promoción.
- hreflang si hay multi-idioma.

### Q14 · Upload de archivos

**Contexto.** Wizard tiene paso de Multimedia (fotos + videos).

**No decidido:**
- Librería de UI: ¿react-dropzone?
- Límites: tamaño máximo por archivo, formatos aceptados, resolución
  mínima.
- Procesamiento: ¿client-side resize antes de subir? ¿server-side
  variantes?
- Presigned URLs directas al bucket vs pasar por API.
- Progreso de upload (% individual y total).
- Resume de uploads interrumpidos.

### Q15 · Notificaciones in-app

**Contexto.** La campana en AppHeader.

**No decidido:**
- Tipos: nuevo registro, visita programada, venta cerrada, mensaje de
  agencia, aviso de expiración de plan, system announcements…
- UI: dropdown panel vs página dedicada `/notificaciones`.
- Agrupación por tipo o por fecha.
- Realtime (Supabase Realtime / WebSocket) o polling cada N segundos.
- Persistencia: ¿la campana muestra solo no leídas o histórico completo?
- Preferencias: el usuario elige qué notificaciones recibir por email
  vs solo in-app.

### Q16 · Convenciones de commits

**No decidido:**
- ¿Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)?
- ¿Prefijo de scope obligatorio (`feat(promociones): ...`)?
- ¿Co-authored-by trailer en PRs cuando hay AI?
- ¿Lint de mensajes con `commitlint`?

### Q17 · CI/CD

**No decidido:**
- Workflow GitHub Actions: lint + typecheck + tests + build en cada PR.
- Preview deployments automáticos por branch (Vercel ya lo hace).
- Protect main branch: requiere PR + aprobaciones.
- Staging environment separado del prod.

### Q18 · Observabilidad

**No decidido:**
- Errores: Sentry (ya mencionado en services.md).
- Logs server-side: ¿Axiom, Logtail, BetterStack?
- Métricas de negocio: ¿PostHog para eventos producto?
- Health checks: ¿endpoint `/api/health` + status page pública?

---

## 📱 UX móvil específico

### Q19 · Comportamientos táctiles

**No decidido:**
- Swipe gestures: ¿swipe para aprobar/rechazar registro (tipo Tinder)?
- Pull to refresh en listas.
- Bottom sheets nativos (tipo Instagram/Twitter) vs drawers.
- Haptic feedback en interacciones críticas.

---

## 🏗️ Arquitectura de backend no decidida

### Q20 · Stack backend concreto

**Contexto.** `services.md` menciona opciones (Supabase, Neon+Vercel,
NestJS standalone) pero no hay decisión final.

**No decidido:**
- **Supabase** (Postgres + Auth + Storage + Realtime en uno) vs
  **Neon + Clerk + R2 + Express** vs otro combo.
- Si Supabase: RLS policies detalladas por tabla.
- Migrations: ¿`supabase db push` o `prisma`?
- Seed data para dev: ¿script automático con los mocks actuales?

### Q21 · Multi-tenancy

**No decidido:**
- ¿Isolation a nivel DB (schema por tenant) o a nivel fila (RLS)?
- Identificador del tenant: ¿`company_id` en JWT claims?
- ¿Usuarios pueden pertenecer a múltiples empresas?

### Q23 · Ventas · cálculo de comisión y modelo de pagos

**Contexto.** Pantalla `/ventas` implementada en Fase 1 con mocks
(`src/data/sales.ts`, `src/pages/Ventas.tsx`). Cada venta tiene
`comisionPct`, `precioFinal` y un booleano `comisionPagada`.

**No decidido:**
- **Base del cálculo**: ¿la comisión se aplica sobre `precioFinal` con IVA
  incluido o sobre la base imponible (sin IVA)? Afecta directamente al
  importe que se muestra al promotor y a la agencia.
- **Hitos parciales**: la estructura `CollaborationConfig.hitosComision`
  ya define pagos escalonados (%, momento: reserva/contrato/escritura).
  ¿La pantalla de ventas debe calcular y mostrar los hitos individualmente
  (con su propio estado pagado/pendiente por hito), o basta un flag
  global `comisionPagada`?
- **Modelo de datos**: si se opta por hitos individuales, ¿se añade una
  colección `ComisionPago[] { id, ventaId, hitoKey, importe, fechaPago,
  estado }` a nivel de datos, o se deriva al vuelo desde
  `venta.pagos[]` + config de la promoción?
- **Retención por caída**: cuando una venta pasa a `caida`, ¿la comisión
  devengada hasta ese momento se retiene, se devuelve o se negocia caso a
  caso? Actualmente el mock asume que queda `comisionPagada=false` sin más.

**Impacto de no decidir:** la UI muestra un importe bruto agregado y un
único booleano. Para la operativa real del promotor esto probablemente se
queda corto (varias agencias × varios hitos × varios meses).

---

### Q22 · Cron jobs / tareas programadas

**Contexto.** Hay procesos que corren periódicamente:
- Expirar registros no aprobados después de N días
- Recordatorios de visita 24h antes
- Generación de informes mensuales

**No decidido:**
- Runtime: ¿Vercel Cron, Supabase Edge Functions cron, GitHub Actions
  schedule, n8n?
- Resistencia a duplicación: idempotencia de los jobs.

---

## 🎯 Cómo usar este documento

**Para Claude Code (o cualquier dev):**

1. Antes de implementar, lee este archivo entero una vez.
2. Al topar con ambigüedad en una spec, revisa si hay una Q* relacionada.
3. Si la pregunta está aquí: **detén la implementación, pregunta a Arman.**
   No inventes.
4. Si la pregunta NO está aquí pero deberías estar: **añádela como Qnueva
   en el mismo PR.**
5. Cuando se tome una decisión, se mueve a `DECISIONS.md` como ADR
   numerado y se elimina de aquí.

**Para Arman:**

Cada Q# es una decisión pendiente. Vamos cerrándolas según prioridad de
implementación. Al cerrar una, yo la muevo a `DECISIONS.md` en el mismo
commit. Las más críticas para arrancar backend son: **Q1 (IA duplicados),
Q2 (Microsites), Q3-Q4 (Auth/Onboarding promotor), Q20 (stack backend),
Q5 (roles)**.
