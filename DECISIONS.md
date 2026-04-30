# DECISIONS.md · Log de decisiones de diseño y arquitectura

Orden cronológico. Cada decisión tiene contexto, alternativas consideradas y
razón elegida. Al tomar una decisión nueva, se añade una entrada aquí.

---

## 2026-04-19 · ADR-001 · Persona primaria: Promotor

**Contexto:** Byvaro tiene dos personas (Promotor y Agencia) que comparten
muchas pantallas.

**Decisión:** Diseñar primero la vista Promotor completa, luego adaptar a
Agencia.

**Alternativas:** Diseñar Agencia primero · Ambas en paralelo.

**Razón:** Promotor tiene 12 secciones y la complejidad real, Agencia 5 y es
mayormente read-only. Haciendo Promotor bien, Agencia sale en ~30% del
esfuerzo.

---

## 2026-04-19 · ADR-002 · Refresh visual, no redesign total

**Decisión:** Mantener tokens HSL y stack existente (Tailwind + shadcn). No
cambiar fuente ni paleta base. Unificar inconsistencias y subir densidad
visual.

**Alternativas:** Redesign total con nuevo branding · Evolución muy suave
sin romper nada.

**Razón:** Los tokens del repo original son sanos. El problema no es el ADN
sino la **inconsistencia** (V1/V2 coexistentes, idioma mezclado, links
rotos). Un refresh resuelve eso sin tirar trabajo bueno.

---

## 2026-04-19 · ADR-003 · Nueva IA del menú

**Decisión:** Reestructurar el menú del Promotor en 4 grupos funcionales:
**General · Comercial · Red · Contenido** + Admin al pie.

**Alternativas:** Mantener lista plana · Menos grupos (3 en vez de 4) ·
Más grupos (6+).

**Razón:** 4 grupos es el sweet spot entre orden y simplicidad. Los 11 items
del original tenían 7 rotos y lista plana. El nuevo menú no tiene links
rotos, está 100% en español, y agrupa por actividad del usuario.

Detalle: `docs/ia-menu.md`.

---

## 2026-04-19 · ADR-004 · Proyecto limpio separado

**Decisión:** Crear un repositorio nuevo (`byvaro-design-armenia`) con stack
mínimo en vez de portar al repo original.

**Alternativas:** Añadir una nueva carpeta `src/pages-v2/` al repo original ·
Feature branch en repo original.

**Razón:** El repo original tiene mucha deuda (V1/V2 duplicados, shadcn
completo, lovable tagger, etc.). Un proyecto limpio:
- Es más fácil de razonar para Claude Code
- No arrastra decisiones obsoletas
- Permite iteración rápida sin miedo a romper el original
- La migración al repo final se hace con commits dirigidos cuando esté listo

Los tipos y datos se copian 1:1 (no se reescriben).

---

## 2026-04-19 · ADR-005 · Personalidad visual: "sofisticado + eficiente"

**Decisión:** Tomar como referencias **Linear + Attio** (híbrido). Monocromo
controlado con acentos de color semánticos, densidad media-alta, sombras
suaves.

**Alternativas consideradas:** Pipedrive (más colorido), Notion (más cálido),
Stripe (más enterprise).

**Razón:** El promotor inmobiliario tiene que transmitir confianza (no
"divertido") sin ser frío. Linear aporta la precisión técnica, Attio la
calidez comercial.

---

## 2026-04-19 · ADR-006 · Mobile-first estricto

**Decisión:** Diseñar desde 375px (iPhone SE). Desktop es consecuencia.
`MobileBottomNav` con FAB central. `MobileHeader` con drawer.

**Alternativas:** Desktop-first con adaptación mobile · Solo desktop (no hay
apps mobile reales aún).

**Razón:** Un comercial de agencia pasa 80% del tiempo en el coche o en
visitas. Debe poder registrar un cliente desde el móvil sin frustración.

---

## 2026-04-19 · ADR-007 · Modo oscuro pospuesto a Fase 3

**Decisión:** Los tokens `.dark` ya están definidos en `index.css` pero no
se activa automáticamente. Se pulirá después de terminar todas las
pantallas en claro.

**Razón:** Diseñar en paralelo claro/oscuro duplica el trabajo de
iteración. Mejor clavar el claro primero.

---

## 2026-04-19 · ADR-008 · `/inicio` es el home real (no `/promociones`)

**Decisión:** El menú del original tenía "Dashboard" rota. La nueva vista
Inicio se construye como dashboard ejecutivo con KPIs + actividad + agenda
+ top colaboradores + acciones rápidas.

**Alternativas:** Dejar `/promociones` como home (era así en el original).

**Razón:** El promotor necesita un "pulso" del negocio al entrar cada día.
La lista de promociones es importante pero secundaria.

---

## 2026-04-19 · ADR-009 · Wizard fullscreen para Crear promoción

**Decisión:** `/crear-promocion` se renderiza fuera del `AppLayout`
(sin sidebar global ni header de app), con su propia sidebar timeline +
footer de nav.

**Alternativas:** Modal gigante · Página dentro del AppLayout.

**Razón:** Es una tarea focal y larga (14 pasos). El layout global compite
con el timeline del wizard. Fullscreen aísla el flujo y comunica al usuario
"estás en un flujo, no navegando".

---

## 2026-04-19 · ADR-010 · Cards horizontales en listado Promociones

**Decisión:** En `/promociones`, cada promoción es una card full-width
horizontal (cover 550×400 izquierda, contenido derecha) en vez de grid de
cards verticales.

**Alternativas:** Grid 3 columnas de cards verticales (como hice en mi
primera versión).

**Razón:** Densidad de info mucho mayor (precios, KPIs, agencias,
warnings, tipologías, últimas unidades) sin sacrificar jerarquía. El usuario
escanea de izquierda a derecha y le llega todo sin scroll horizontal.
Patrón validado del repo original.

---

## 2026-04-19 · ADR-011 · Header global sin search ni CTA

**Decisión:** El `AppHeader` se queda como barra fina de utilidades:
breadcrumb + ⌘K compacto + notificaciones. NO tiene search input grande ni
botón "+ Nueva promoción". Esas son responsabilidad de la página.

**Razón:** Evitar duplicación con la cabecera de cada página (cada una trae
su buscador específico y su CTA). Un header global limpio permite que la
pantalla tenga más espacio y jerarquía clara.

---

## 2026-04-19 · ADR-012 · Fusión de Contactos en una sola pantalla

**Decisión:** El repo original tenía `Contacts.tsx` y `ContactsApp.tsx`
en paralelo. En v2 se unifica en un solo `/contactos` con toggle
lista / tarjetas.

**Razón:** La duplicidad confundía. Un solo componente con dos vistas
visuales es más mantenible.

---

## 2026-04-19 · ADR-013 · Analítica Agencia×Nacionalidad vive dentro de Colaboradores

**Decisión:** El dashboard original de "Colaboradores Analytics" (3 tabs
Registros/Ventas/Eficiencia con heatmap) NO es una página propia, sino un
**sub-tab** dentro de `/colaboradores`. Colaboradores tendrá 2 tabs:
**Red** (listado) y **Analítica** (el dashboard).

**Razón:** Mantener la IA simple. No queremos 15 items de sidebar. Ventas
seguirá siendo pipeline comercial; la analítica profunda vive con la red.

---

## 2026-04-19 · ADR-014 · Documentación en español

**Decisión:** Toda la docs (`docs/`, `CLAUDE.md`, `DECISIONS.md`,
`ROADMAP.md`) en español.

**Razón:** El producto es español, el usuario lo es, el equipo lo es. El
código sigue usando TypeScript y los nombres técnicos (camelCase,
identifiers) siguen en inglés para ergonomía, pero la documentación humana
en castellano.

---

## 2026-04-19 · ADR-015 · Deploy a Vercel (no GitHub Pages)

**Decisión:** Despliegue principal vía Vercel con el repo conectado.
GitHub Pages se intentó pero Vercel ofrece mejor DX (preview por PR,
detección automática de Vite, sin configurar base path).

**Razón:** Menos fricción. El workflow de Pages queda en el repo por si
algún día hace falta una mirror estática.

---

## 2026-04-19 · ADR-016 · Respeto 1:1 de datos y features del original

**Decisión:** Al portar cada pantalla del repo original al diseño nuevo, se
**copian los tipos y datos tal cual** (`promotions.ts`, `developerPromotions.ts`,
`units.ts`, `create-promotion/types.ts`, `options.ts`). No se inventan
campos, no se eliminan features, no se cambian estados posibles. Solo
cambia el **vestido visual**.

**Razón:** Garantiza que cuando se conecte el backend, el contrato ya está
establecido y probado en otro entorno. Evita volver a tomar decisiones que
ya están tomadas.

---

## 2026-04-19 · ADR-017 · Tamaños de card respetan el original

**Decisión:** La card de `/promociones` usa las mismas proporciones que el
original (cover 550×400 en desktop, `rounded-xl` mobile / `rounded-2xl`
desktop, etc. — luego unificado a rounded-2xl siempre, ver ADR-018).

**Razón:** El usuario pidió explícitamente "respeta los tamaños" — el
original estaba calibrado, no hay que reinventar.

---

## 2026-04-19 · ADR-018 · Unificar Promociones con estándar Inicio

**Decisión:** Auditada Promociones contra Inicio (que fijé como estándar).
Aplicados 8 cambios: título `text-[22px] sm:text-[28px]`, cards
`rounded-2xl` consistente, `shadow-soft` tokens, `border-border` sólido,
`duration-200`, `p-4 sm:p-5`, warnings a `rounded-xl`, trending con
`ring-amber-300/50`.

**Razón:** Coherencia entre pantallas. Una regla: lo que se ve en Inicio y
en Promociones debe sentirse del mismo sistema.

---

## 2026-04-19 · ADR-019 · Documentación exhaustiva para handoff

**Decisión:** Antes de seguir con más pantallas, crear docs completa
(`CLAUDE.md`, `docs/architecture.md`, `docs/data-model.md`,
`docs/services.md`, `docs/api-contract.md`, `docs/screens/*.md`,
`DECISIONS.md`, `ROADMAP.md`).

**Razón:** El usuario quiere poder retomar el proyecto con Claude Code o
con un dev externo. La docs ahora evita re-descubrir contexto, y cada
pantalla nueva se documenta en el mismo commit para que la sync se mantenga.

---

## 2026-04-19 · ADR-020 · Nombre canónico "Byvaro"

**Decisión:** El producto se escribe **Byvaro** (con Y), como en el repo.
Aunque se pronuncia "bívaro" / "bívalo", el nombre canónico en UI, dominio
y documentación es **Byvaro**.

---

## 2026-04-19 · ADR-021 · Byvaro resuelve 2 dolores concretos

**Decisión:** La propuesta de valor se articula sobre **dos problemas**
específicos del promotor inmobiliario:

1. **Web de la promoción** — se entrega lista (`byvaro.com/<slug>` o
   dominio custom), evitando que el promotor contrate freelance externo
2. **Caos de registros entre agencias** — IA recomienda aprobar/rechazar
   analizando duplicados

Todo lo demás (CRM, calendario, analítica) es soporte a estos dos núcleos.
El roadmap se prioriza en función del **valor diferencial**, no del orden
cronológico de las pantallas.

---

## 2026-04-19 · ADR-022 · Pricing definido

**Decisión:**

| Tier | Precio | Quién |
|---|---|---|
| Promotor | 249€/mes | Dueño de proyecto inmobiliario |
| Agencia invitada | 0€ | Agencia que el promotor invita |
| Agencia marketplace | 99€/mes | Agencia que quiere acceder al catálogo completo |

Sin fees por venta. Sin splits. Solo SaaS suscripción.

---

## 2026-04-19 · ADR-023 · IA de duplicados scope restringido

**Decisión:** La IA que detecta duplicados **solo compara dentro del mismo
promotor** (tenant). Es decir:

- Contactos propios del promotor (su CRM)
- Registros previos de otras agencias a ese mismo promotor

NO cruza entre promotores distintos por privacidad y porque no tendría
sentido de negocio.

**Modelo a elegir**: Claude Haiku (por latencia < 500ms) o GPT-4o-mini (por
coste). Se decidirá al implementar backend.

**Formato de respuesta**:
```ts
{
  matchPercentage: number,            // 0-100
  matchDetails: MatchDetail[],        // campos concretos que coinciden
  existingClient?: ExistingClient,    // si se encontró un duplicado
  recommendation: string,             // texto libre dirigido al promotor
}
```

---

## 2026-04-19 · ADR-024 · Magic link para onboarding de agencia

**Decisión:** Cuando el promotor invita a una agencia:

1. Promotor escribe email de la agencia
2. Byvaro envía email con **magic link único** (token con expiración 7 días)
3. Agencia hace click → aterriza en `/onboarding-agencia?token=xxx`
4. Pantalla única: email (pre-rellenado) + **crear contraseña**
5. Submit → cuenta creada + sesión activa → ya ve la promoción

NO pedimos: nombre, apellido, teléfono, etc. en el onboarding. Se completan
después en ajustes si hace falta. Fricción **cero**.

Alternativas consideradas: SSO obligatorio con Google (descartada, muchas
agencias sin Google Workspace), email + password + verificación (demasiados
pasos).

---

## 2026-04-19 · ADR-025 · Paywall total para agencia sin plan en marketplace

**Decisión:** Una agencia sin plan que visita el marketplace **no ve NADA**
de contenido sensible. No se difumina parcialmente, no hay preview. Se
oculta:

- Fotos, nombre de promotor, nombre de promoción, precios, ubicación exacta,
  unidades, comisión, datos de contacto

Se muestra solo:
- Contador total ("247 promociones")
- Contadores por zona general
- Filtros funcionales
- CTAs de upgrade

**Razón:** el modelo freemium funciona solo si el valor está realmente
detrás del muro. Medio-preview = agencia recolecta data sin pagar.

Detalle: `docs/paywall.md`.

---

## 2026-04-19 · ADR-026 · Microsite auto-generado por promoción

**Decisión:** Cada promoción activa genera automáticamente un microsite
público accesible en:

- **Default**: `byvaro.com/<slug>` (ej. `byvaro.com/villa-serena`)
- **Custom (opcional)**: dominio propio del promotor (`villaserena.com`)

El microsite reutiliza fotos, descripción, unidades y formulario de
captación. El formulario escribe directo en el flujo de registros del
promotor como `source: "microsite"`.

**Razón:** diferencial clave del producto (30% del valor). No entregar esto
es no entregar Byvaro.

**Scope:** plantilla fija pero con tokens (colores del promotor, logo,
nombre). Editor visual viene en Fase posterior.

---

## 2026-04-19 · ADR-027 · Activación de una promoción

**Decisión:** Una promoción pasa de `borrador` a `activa` cuando:

1. Todos los 14 pasos del wizard completados (`missingSteps.length === 0`)
2. **Comisión definida** (campo obligatorio para compartir)
3. Ningún warning rojo en la ficha

No requiere datos fiscales del promotor (esos van en `/ajustes/empresa`,
a nivel cuenta, no por promoción).

Una vez activa:
- Se puede invitar agencias
- Se genera el microsite automático
- Aparece en el marketplace

---

## 2026-04-19 · ADR-028 · Integraciones fuera de scope inicial

**Decisión:** Las integraciones (WhatsApp, n8n, S3, portales inmobiliarios)
están en el roadmap pero **no se diseñan en las primeras fases**. Se
priorizarán más adelante según demanda de promotores reales.

`docs/services.md` queda como referencia de qué se instalará cuando toque,
pero el flujo de pantallas se diseña sin depender de ninguna de estas
integraciones — asumiendo implementación mock hasta fase de integraciones.

---

## 2026-04-19 · ADR-029 · Roles de usuarios diferidos

**Decisión:** Los roles internos dentro del promotor (owner, comercial,
asistente) se definirán más adelante. Por ahora, asumimos un único rol con
permisos totales en la cuenta. Cuando se añada granularidad de roles, se
documentará aquí y en `docs/data-model.md`.

---

## 2026-04-20 · ADR-030 · Colaboradores con dos tabs (Red · Analítica)

**Contexto:** El módulo legacy "Agencies" era una tabla simple. En v2 la
pantalla `/colaboradores` debe cubrir dos necesidades muy distintas:
gestión diaria (aprobar, pausar, filtrar) y visión agregada (top
performers, heatmap, conversión).

**Decisión:** Dos tabs **subrayado** (NO pills) — "Red" (grid de cards
con acciones) y "Analítica" (KPIs + top 5 + heatmap + conversión).
Añadidos campos al tipo `Agency`: `origen` (`invited` | `marketplace`),
`estadoColaboracion`, `registrosAportados`, `ventasCerradas`,
`comisionMedia`, `solicitudPendiente`, `mensajeSolicitud`. Mock
adicional en `src/data/collaboratorActivity.ts` para el heatmap.

**Alternativas:** Una sola vista con sección colapsable de analítica ·
tres tabs separando "Solicitudes" · árbol sidebar + detalle.

**Razón:** La separación Red/Analítica encaja con la frecuencia de uso
(Red es diaria, Analítica semanal/mensual) y evita saturar la vista
principal. Tabs subrayado mantienen consistencia con
`PromocionDetalle.tsx`.

**Modal invitar**: se reutiliza `components/empresa/InvitarAgenciaModal`
para no duplicar el wizard de 3 pasos.

---

## 2026-04-22 · ADR-031 · Compartir promoción: flujo, persistencia y plantilla

**Contexto:** El botón "Compartir con agencias" de `Promociones.tsx` no
estaba conectado. Queríamos que desde ahí el promotor pudiera invitar a una
agencia (nueva, colaboradora existente o favorita) a colaborar en una
promoción, con condiciones (comisión, duración, forma de pago), y que la
invitación apareciese como pendiente en `/colaboradores` y en la ficha de
la promoción.

**Decisión:** Modal de 3 pasos (`SharePromotionDialog`):

1. **Choose** — 3 cards (Nueva invitación · Mis colaboradores · Mis
   favoritos).
2. **Email** (nueva) o **Pick** (existentes). En email: se rechazan
   dominios públicos (gmail, hotmail…) y se detecta match de agencia por
   dominio. En pick NO se vuelca la lista completa por defecto; solo
   aparece tras escribir ≥2 caracteres (puede haber 100+).
3. **Conditions** — paso único para ambos ramales, con edición
   **reposo / hover-lápiz / click** vía `InlineEditNumber`. Default 12
   meses. La suma del % al colaborador debe = 100%.

Persistencia: hook existente `useInvitaciones()` (localStorage). Se
amplía el tipo `Invitacion` con `promocionId`, `promocionNombre`,
`duracionMeses`, `formaPago: PagoTramo[]`, `datosRequeridos`. Helper
nuevo `invitacionToSyntheticAgency()` convierte invitación pendiente →
fila sintética `Agency` con `estadoColaboracion: "contrato-pendiente"`.

Visualización cross-feature:
- `Colaboradores.tsx` fusiona las sintéticas con `baseAgencies`.
- `PromotionAgenciesV2.tsx` añade bloque "Invitaciones pendientes" arriba
  del hero, filtrando por `promocionId`.

Plantilla email HTML: `getInvitacionHtml()` devuelve `{ asunto, html }`
email-safe (tablas + inline + media queries). Hero con foto de la
promoción, precios desde-hasta, entrega, pill de unidades disponibles,
comisión destacada, tabla de tramos, checklist de datos obligatorios y
CTA "Ver invitación". Responsive en ≤640 (edge-to-edge, cols apiladas).
Preview estático en `email-previews/invitacion-agencia.html` · 640px.

**Alternativas:**
- 4 pasos separados (conditions en 2) — descartado por pesadez.
- Volcar la lista de colaboradores en "Pick" — ruido a escala real.
- Email de texto plano (reutilizar `getEmailPreview`) — el HTML con hero
  vende mejor la promoción al colaborador.

**Razón:** Unificar `conditions` para ambos ramales reduce duplicación.
Lápiz en hover anticipa el gateo por roles (`canEditConditions`). La
plantilla HTML responsive es email-safe (probada Gmail/Apple/iOS) y el
preview estático nos da ciclo de iteración rápido sin backend.

Ver spec completa en `docs/screens/compartir-promocion.md`.

---

## 2026-04-22 · ADR-032 · Favoritos de agencias como store central

**Contexto:** Teníamos `FAVORITE_AGENCY_IDS` hardcodeado en dos componentes
(`SharePromotionDialog` y `SendEmailDialog`) con ids distintos. No había
manera de marcar/desmarcar desde la UI y los cambios en un sitio no se
reflejaban en otros.

**Decisión:** Hook `useFavoriteAgencies()` en `src/lib/favoriteAgencies.ts`
como única fuente de verdad. Persistencia en localStorage bajo clave
`byvaro-favoritos-agencias`, sincronización cross-tab vía storage event +
CustomEvent. API: `{ ids, isFavorite, toggleFavorite, add, remove }`.

Consumidores:
- `Colaboradores.tsx` · botón estrella en cada `AgencyCard`.
- `PromotionAgenciesV2.tsx` · botón estrella en cada `AgencyCardV2` del
  tab Agencias de la ficha.
- `SharePromotionDialog.tsx` · filtra la lista "Mis favoritos" y muestra
  chip estrella en agencias del buscador.
- `SendEmailDialog.tsx` · filtro "Favoritos" al elegir destinatarios de un
  email (mantiene el nombre `FAVORITE_AGENCY_IDS` internamente vía alias
  `const { ids: FAVORITE_AGENCY_IDS } = useFavoriteAgencies()`).

**Estándar UI del toggle:** botón `p-1.5 rounded-full`, icono `Star h-4 w-4`
`strokeWidth={1.5}`. Activo = `fill-foreground text-foreground`; inactivo =
`text-muted-foreground`. Toast "Añadido a favoritos" / "Quitado de
favoritos" al togglear.

**Alternativas:**
- Prop drilling desde una página raíz — demasiado ruido para un dato global.
- Context API — válido, pero el hook con `storage` event ya ofrece la
  sincronización que queríamos cross-tab.

**Razón:** Un único lugar donde definir/leer favoritos elimina divergencia
entre componentes, y la persistencia real llega gratis (localStorage).
Migrar al backend cuando exista es cambiar 4 líneas del hook.

**Semilla inicial:** `["ag-1", "ag-3"]` para que la primera carga no esté
vacía (si luego el usuario toggle-a, se persiste su elección).

---

## 2026-04-22 · ADR-033 · Gate de compartir: publicada + activada

**Contexto:** Los botones de Compartir/Invitar agencias aparecían
activos siempre. Necesitábamos:
1. Deshabilitar cuando la promoción no está publicada (incompleta).
2. Tener un flag explícito `canShareWithAgencies` que el promotor
   pueda desactivar/activar, independiente del estado de publicación.
3. Desde la tab Comisiones, mostrar un aviso cuando esté desactivado +
   popup para activarlo fijando condiciones por defecto.

**Decisión:** Condición global `canShare = isPublished && canShareWithAgencies !== false` (con override local). Donde antes solo chequeábamos `isPublished`, ahora pasamos `canShare`:

- `Promociones.tsx` · botón Compartir de cada card: `disabled` + cursor
  `not-allowed` + tooltip con el motivo concreto (no publicada / pasos
  pendientes / compartir desactivado).
- `PromocionDetalle.tsx` · action dock derecho (dos variantes compact y
  labeled): `disabled` + opacidad atenuada + hint "Activa compartir en
  la tab Comisiones".
- `AgenciesTab` interna · 3 botones Invitar: props `canShare` +
  `onActivateSharing`; todos `disabled` cuando el gate cierra.

**Popup activación (`ActivateSharingDialog`):** abre desde un banner ámbar
en la tab Comisiones cuando `!sharingEnabledForPromo`. Pide comisión
(pill editable, default `p.collaboration.comisionInternacional`) y duración
por defecto (chips 1/3/6/12 meses, default 12). Al activar, dispara
`setCanShareOverride(true)` + toast. Override local por ahora;
`TODO(backend): POST /api/promociones/:id/compartir/activar`.

**Alternativas:**
- Ocultar los botones cuando están desactivados → se descartó porque deja
  al usuario sin contexto sobre por qué no puede compartir.
- Abrir directamente el wizard en step Collaborators → descartado: el
  usuario explícitamente pidió un popup ligero, no una ruta completa.

**Razón:** Visibilidad (el usuario ve que existe la acción pero entiende
por qué está bloqueada) + control granular (un promotor puede decidir
no compartir una promoción específica aunque esté publicada).

Ver spec en `docs/screens/compartir-promocion.md` → sección "Condiciones
para permitir compartir" y "Activar compartir desde la tab Comisiones".

---

## 2026-04-22 · ADR-034 · Doc canónico de integración backend

**Contexto:** El proyecto vive en fase frontend-first con storage en
localStorage y mocks. Muchas features (invitaciones, favoritos, ratings
Google, contratos, colaboradores, compartir promoción…) acumulan
`TODO(backend)` sueltos por el código. Sin un índice central, el agente
/ desarrollador que levante el backend tendría que rastrear decenas de
archivos para entender qué mock reemplazar.

**Decisión:** Crear `docs/backend-integration.md` como **fuente única de
verdad** del contrato UI↔API. Contenido:

1. Arquitectura multi-tenant (Empresa + Collaboration).
2. Endpoints por dominio (auth, empresa, promociones, colaboradores,
   invitaciones, favoritos, registros, ventas, contactos, integraciones
   externas, microsites).
3. Modelos de datos con campos derivados vs persistidos.
4. Crons/jobs periódicos (refresh Google, expire invitations, contracts).
5. Integraciones externas (Google Places, WhatsApp Baileys, email
   transaccional, storage, Drive).
6. Referencia cruzada a cada `TODO(backend)` con `archivo:línea`.
7. Checklist obligatorio al añadir feature nueva.

**Regla de oro documentada en `CLAUDE.md`:** toda feature con storage
local o mock debe registrar su endpoint en `backend-integration.md`
antes de cerrarse. Si un modelo o integración nueva se introduce, se
actualiza la sección correspondiente.

**Alternativas descartadas:**
- Mantener cada `TODO(backend)` disperso en el código → inmanejable a
  escala (ya >60 TODOs repartidos en 50+ archivos).
- Solo `docs/api-contract.md` → ya existe pero es por-pantalla, no por
  dominio, y no captura crons/integraciones/multi-tenancy.
- OpenAPI schema generado → prematuro; aún no hay backend y la forma
  exacta de los endpoints se decidirá al implementar.

**Razón:** Un solo fichero legible en 10 minutos por el backend agent /
dev, con enlaces directos al archivo/línea del mock correspondiente,
reduce el tiempo de integración de semanas a días. La regla de oro
garantiza que el documento no se quede obsoleto.

Ver `docs/backend-integration.md` · sección §11 "Checklist para nuevas
features".

---

## 2026-04-22 · ADR-035 · Colaboradores: consolidación en una sola versión

**Contexto:** Tras iterar con el usuario sobre el diseño de la pantalla
`/colaboradores`, generamos 3 variantes:
- V1 (clásica) — tabs Red/Analítica, bandeja pendientes, cards compactas.
- V2 (comercial minimal) — hero + top-3 destacados + grid cards.
- V3 (comercial enriquecida) — señales (mercados, rating Google,
  contrato, incidencias), drawer de filtros, ordenación, integración
  con ficha detalle, cross-sell…

**Decisión:** Eliminar V1 y V2; dejar **V3 como única versión** de la
pantalla. El antiguo toggle `?v=2|3` se retira. `Colaboradores.tsx` pasa
a contener el código de V3 (renombrado). Los archivos
`ColaboradoresV2.tsx` y `ColaboradoresV3.tsx` se borran; la spec
`docs/screens/colaboradores-v3.md` se fusiona en `colaboradores.md`.

**Consecuencias:**
- Se pierde la tab "Analítica" de V1 (heatmap + top 5 + conversión).
  Queda como `TODO(ui)` en el botón "Estadísticas ↗" del header, que
  muestra toast "próximamente". Cuando se construya, debe ser una
  sub-ruta o tab dentro del nuevo Colaboradores.
- Todas las ubicaciones que listaban agencias usan ahora el mismo
  diseño `FeatureCard` (Colaboradores + drawer solicitudes). Pendiente
  evaluar `PromotionAgenciesV2` de la ficha de promoción — por ahora
  sigue con su propio diseño.

**Razón:** Mantener 3 variantes acumula deuda visual y code-ownership.
La V3 es la más completa y alineada con el resto del producto (helpers
reutilizados, filtros consistentes con Promociones, ordenación
`MinimalSort`, ficha detalle enlazada). Consolidar ahora evita que
cualquier iteración futura tenga que replicarse en 3 sitios.

**Alternativas descartadas:**
- Mantener el toggle como A/B → prematuro, no tenemos métrica ni user
  testing; sumaba complejidad sin valor.
- Fusionar V2 y V3 (tomar lo bueno de cada) → V3 ya es superset de V2.
- Mantener V1 como fallback → el código vivo obsoleto confunde.

---

## 2026-04-22 · ADR-036 · Una sola vista de ficha de empresa

**Contexto:** Construí inicialmente un `AgenciaDetalle` nuevo con mi
propio hero y mis propios tabs, mimetizando visualmente el de
`Empresa.tsx` pero sin reutilizarlo. Resultado: dos implementaciones
paralelas para el mismo concepto (ficha de empresa). Si se mejora
`Empresa.tsx`, la ficha de agencia no se entera. Deuda técnica inmediata.

**Decisión:** **Una sola pantalla** de ficha de empresa. `Empresa.tsx`
es el único componente. Acepta props:

- `tenantId?: string` — si viene, modo visitor (lee el perfil público
  del tenant indicado).
- `visitorSlot?: ReactNode` — bloque inyectado sobre el hero.
- `visitorFooter?: ReactNode` — barra sticky inferior.

En visitor mode se fuerza `viewMode="preview"`, se ocultan banner
onboarding/overlays de edición/sidebar/toggle Previsualizar, y se
añade breadcrumb "← Colaboradores".

`useEmpresa(tenantId?)` carga el tenant correcto:
- Sin id → localStorage (dueño). `update/patch` persiste.
- Con id → resolve via `agencyToEmpresa(agencies.find)` (mock). En
  prod: `GET /api/empresas/:id/public`. `update/patch` no-op.

`AgenciaDetalle.tsx` es un wrapper thin que lee `:id` de la URL y
renderiza `<Empresa tenantId={id} visitorSlot={...} visitorFooter={...} />`
con los bloques promotor-specific (contrato, métricas con tu red,
incidencias, mensaje solicitud) + acciones (Aprobar/Descartar ·
Pausar/Reanudar · Eliminar · Compartir).

**Adapter** `src/lib/agencyEmpresaAdapter.ts · agencyToEmpresa(a)` mapea
`Agency` → `Empresa`. Cuando el backend tenga el endpoint público, el
adapter desaparece.

**Alternativas descartadas:**
- Crear mi propio `AgenciaDetalle` paralelo (lo hice y revertí) → dos
  mantenimientos, inconsistencia visual progresiva.
- Extraer un componente "EmpresaProfile" compartido por ambas vistas →
  mismo resultado que props opcionales pero con más código.
- Refactor mayor de `useEmpresa` a stores separados → innecesario
  mientras el hook sepa distinguir owner vs visitor.

**Razón:** Consistencia automática. Cualquier mejora en el hero, tabs o
bloques de Empresa se refleja instantáneamente en la ficha que ve el
promotor sobre una agencia. Zero deuda visual. La relación
promotor↔agencia vive en slots (`visitorSlot`, `visitorFooter`), así
Empresa queda desacoplada de Colaboradores.

Ver spec completa en `docs/screens/agencia-detalle.md`.

---

## 2026-04-22 · ADR-037 · Estadísticas sin volumen €; con diferenciales Byvaro

**Contexto:** La primera versión de `/colaboradores/estadisticas` copiaba
un dashboard genérico: KPI "Volumen €", "Ticket medio", trends `+18,4%`
vs. período anterior, filtro de fechas, gauges por nacionalidad, lista
de distribución, lista de dominantes, insights hardcodeados. Al revisar,
la mayoría de eso no encaja con Byvaro o directamente miente:

- **Volumen € / ticket medio**: el promotor vende sus propias unidades a
  precio conocido. El "ticket medio de una agencia" es un derivado del
  mix de promociones que le asignamos — no una señal de su rendimiento.
- **Trends y filtro fechas**: las matrices son agregados, no series
  temporales. Mostrar "+18,4%" es inventarse el dato.
- **Gauges / distribución / dominantes**: toda esa información ya está
  en el heatmap (columna, ring de dominante, fila Total). Duplicaciones.
- **Insights hardcoded**: no se recalculaban con filtros; si filtrabas a
  una nacionalidad, los insights seguían hablando del global. No eran
  "automáticos".
- **Falta lo que Byvaro hace mejor**: aprobación de leads, IA de
  duplicados, SLA de respuesta. Los diferenciales del producto no
  aparecían en la analítica del producto.

**Decisión:**

1. **Sustituir Volumen € por Visitas** en KPIs, matrices, rankings e
   insights. Las visitas son operativas (generan coste del comercial) y
   observables en el embudo `registro → visita → venta`.
2. **Eliminar trends falsos y filtro Fechas** hasta que haya histórico
   real. Un KPI desnudo es mejor que un trend inventado.
3. **Añadir panel "Calidad de los registros"** en tab Registros con los
   3 diferenciales Byvaro (aprobación %, duplicados detectados, SLA
   respuesta) por agencia.
4. **Añadir eje Promoción** como segunda dimensión del heatmap, con
   toggle segmented `Por nacionalidad / Por promoción`. El promotor
   asigna stock por promoción — esa dimensión es tan importante como
   la de nacionalidad.
5. **Derivar insights y oportunidades del subset visible** con reglas
   deterministas (`deriveInsights`, `deriveOportunidades`). Si filtras,
   reaccionan.
6. **Eliminar duplicaciones**: fuera gauges, distribución, dominantes.
   El heatmap ya lo cuenta todo.

**Alternativas descartadas:**

- Mantener volumen € y ticket porque "otros dashboards los muestran" →
  no somos un CRM genérico; medimos para un promotor de obra nueva.
- Dejar filtro Fechas visual-only con una nota de "pendiente backend"
  → peor que quitarlo: el usuario lo configura pensando que filtra.
- Dos heatmaps separados (uno por nacionalidad, otro por promoción) →
  duplica superficie y obliga al usuario a comparar con la mirada; el
  toggle es más barato en atención.
- Insights vía LLM en backend → prematuro. Reglas deterministas
  `if conv<5 && regs>80 → warn` cubren el 80% útil hoy.

**Razón:** Honestidad con el usuario (no mostrar datos que no tenemos)
+ alineación con el modelo de negocio (visitas, no volumen) +
diferenciación del producto (aprobación, duplicados, SLA). El dashboard
deja de parecerse a cualquier-otro-dashboard y empieza a parecerse a
"cómo Byvaro mide a tus colaboradores".

Ver spec completa en `docs/screens/colaboradores-estadisticas.md` y
contrato backend en `docs/backend-integration.md §4.2`.

---

## 2026-04-22 · ADR-038 · Recomendaciones de agencias · privacidad cross-tenant · **APARCADO**

> **Estado**: diseñado, mockeado, documentado — **no renderizado en UI
> hasta tener datos cross-tenant suficientes** (decisión 2026-04-22).
> El motor debe garantizar que cada recomendación sea mejor que la red
> actual del promotor; hoy no podemos. Se reactivará cuando tengamos
> volumen real de aprobaciones, conversiones y SLA por agencia.
>

**Contexto:** Byvaro es multi-tenant y tiene señal que ningún promotor
individual posee: qué agencia es activa en qué zona, con qué
nacionalidades, con qué tasa de aprobación/conversión frente a otros
promotores de obra nueva. Explotar esa señal para recomendar agencias
a los promotores es una ventaja natural del producto — pero **si se
hace mal, destruye la confianza entre tenants**.

**Decisión:**

1. **Incluir recomendaciones** (strip horizontal al cierre de
   `/colaboradores/estadisticas`): agencias activas en las zonas del
   promotor, con buen track record, con las que aún no colabora. La
   colocación en stats (no en el listado operativo) es intencional:
   acabas de ver dónde tienes gaps de mercado, y justo debajo aparecen
   los candidatos que podrían cubrirlos. El listado
   `/colaboradores` queda limpio y es para operar sobre la red ya
   construida.
2. **Fase 1 (ahora) · in-app**: el promotor descubre cuando entra a la
   pantalla. No push, no email.
3. **Fase 2 (pendiente) · email digest**: semanalmente, si hay ≥3
   recomendaciones de alto score, enviar email opt-out. No spam, no
   frecuencia agresiva.
4. **Reglas de privacidad vinculantes** (nunca se saltan):
   - **Nunca** devolver identidad de otros promotores. Las métricas
     cross-tenant son agregadas (`promotoresActivos: number`,
     `aprobacionPct` con "promotores similares", etc.).
   - **"Promotores similares"** se define por categoría (obra nueva),
     solape geográfico y tamaño; el frontend nunca ve este grupo.
   - **Auditoría**: cada invocación del motor queda logueada.
5. **Mock actual** · dataset `src/data/agencyRecommendations.ts` con 6
   recomendaciones sintéticas (Riviera Elite, Alpine International,
   London Bridge, Russian Costa Partners, Côte d'Azur, Mediterranean US).
   Sustituido por `GET /api/colaboradores/recomendaciones` cuando haya
   backend.

**Alternativas descartadas:**

- **Marketplace abierto** (lista navegable de todas las agencias de
  Byvaro) · rompe la promesa de curación. Byvaro **recomienda**, no
  muestra catálogo sin opinión.
- **Outreach automático de Byvaro a las agencias** ("Hola agencia X,
  el promotor Y podría interesarte") · es spam y asume tracción que no
  tenemos. Deja al promotor decidir.
- **Exponer identidades** de otros promotores para dar prueba social
  ("Ya colabora con Promotor B y C") · suicidio de producto. Si un
  promotor supiera qué agencias usan sus competidores, cada tenant
  empezaría a minería de datos.
- **Sin filtro de exclusión** (recomendar agencias donde ya colabora)
  · ruido, confunde.

**Razón:** El motor explota la ventaja natural de ser multi-tenant sin
cruzar la línea. Añade discovery al producto sin convertirlo en
marketplace abierto ni violar la privacidad entre cuentas. La Fase 2
de email se pospone hasta tener suficientes recomendaciones de alto
score para que valga la pena despertar al promotor.

Ver spec completa en `docs/screens/colaboradores-estadisticas.md`
(sección "Recomendaciones Byvaro") y contrato backend en
`docs/backend-integration.md §4.1`.

---

## 2026-04-22 · ADR-039 · Permisos en dos ejes: rol del workspace + ownership

**Contexto:** Byvaro empezó con un sistema de permisos basado solo en
roles (`admin` / `member`) con 5 keys hardcoded en
`src/lib/permissions.ts`. Funciona para WhatsApp pero todo el resto
de la app ignora permisos: cualquier miembro ve TODOS los contactos,
registros, oportunidades, ventas, visitas, documentos y emails del
workspace.

**Decisión:** Modelo en dos ejes ortogonales:

1. **Rol del workspace** (`admin` | `member` | custom) decide qué
   FEATURES puede usar el usuario.
2. **Ownership** (campo `assignedTo: string[]` en cada entidad)
   decide qué REGISTROS concretos puede ver dentro de cada feature.

`*.viewAll` implica `*.viewOwn`. Admin tiene todos los permisos por
defecto vía `isAdmin(user)` shortcut en `useHasPermission()`.

Catálogo completo de ~50 keys por dominio en `docs/permissions.md` §2.
Defaults por rol en §3. Contrato backend (esquema SQL + JWT + RLS)
en §4.

**Alternativas consideradas:**

- **Solo roles** (sin ownership) — los miembros verían siempre todo
  o nada. Para promotores con 5+ comerciales esto rompe la
  privacidad operativa entre agentes.
- **Solo ownership** (sin roles) — todos serían iguales, no habría
  forma de dar permisos administrativos como conectar canales o
  editar la matriz.
- **ABAC genérico** (atributos arbitrarios, motor de políticas) —
  sobre-ingeniería para el tamaño de Byvaro. Los dos ejes cubren
  100% de los casos sin complejidad operativa.

**Razón:** Refleja exactamente el modelo mental del cliente
("eres comercial junior → ves solo TUS leads; eres coordinador → los
ves todos pero no puedes facturar"). Admite roles custom en
`/ajustes/usuarios/roles` para casos como `coordinador`, `finanzas`,
`marketing` sin tocar código.

**Estado actual:** documentado completo, **NO implementado** salvo
WhatsApp. Listados (`/contactos`, `/registros`, ficha tabs) muestran
todo. Migración paso a paso descrita en `docs/permissions.md` §6.
Backend lo implementa antes de quitar el modo mock.

Ver: `docs/permissions.md` (canónico), `CLAUDE.md` (regla de oro
🛡️ Permisos), `src/lib/permissions.ts`.

---

## 2026-04-22 · ADR-040 · Historial es la única fuente de verdad de la actividad del contacto

**Contexto:** Acciones sobre contactos quedaban dispersas: el
comentario tiene su tab, el envío de email no se anotaba en ningún
sitio, el registro de un cambio de asignado se perdía al refrescar.
Imposible reconstruir "qué pasó con este cliente" en producción.

**Decisión:** Tab Historial (`/contactos/:id?tab=historial`) es la
única fuente de verdad. Toda acción que cree, modifique o comunique
algo sobre un contacto **DEBE** llamar a `recordEvent()` (o helper
tipado) de `src/components/contacts/contactEventsStorage.ts` en el
mismo handler que ejecuta la acción.

Helpers tipados disponibles: `recordContactCreated`, `recordContactEdited`
(con diff de campos), `recordAssigneeAdded/Removed`,
`recordRelationLinked/Unlinked` (bidireccional → registra en ambos
contactos), `recordVisitEvaluated`, `recordDocumentUploaded/Deleted`,
`recordCommentAdded`, `recordEmailSent/Delivered/Opened/Received`,
`recordWhatsAppSent`, `recordTypeAny` (escape hatch).

Cada evento lleva `{ id, type, timestamp, title, description?, actor,
actorEmail?, meta? }`. Se almacena append-only en
`byvaro.contact.<id>.events.v1` (cap 500 eventos) y se mergea con el
mock en `loadMergedEvents()`.

**Alternativas:**

- Audit log centralizado por workspace (no por contacto): mejor para
  reporting global pero peor UX en la ficha (filtros pesados).
- Sin audit log explícito (derivar de tablas): pierde semántica
  ("se cambió el nombre" vs "se editó el contacto").

**Razón:** Garantiza historia completa del cliente sin mantener
estructuras paralelas. Permite vista cronológica unificada con
sub-pills (Todo · Comentarios · Emails · WhatsApp · Web · Sistema).
Backend genera el evento server-side en cada PATCH/POST relevante.

Ver: `CLAUDE.md` (regla de oro 🥇 Historial),
`src/components/contacts/contactEventsStorage.ts`,
`docs/permissions.md` (`audit.viewOwn` / `audit.viewAll`).

---

## 2026-04-22 · ADR-041 · Comentarios fusionados en Historial (sin tab separado)

**Contexto:** La ficha de contacto tenía un tab "Comentarios" aparte
del "Historial". Los comentarios YA se registraban en Historial vía
`recordCommentAdded()`, así que el tab era redundante (los mismos
datos en dos sitios).

**Decisión:** Eliminar el tab "Comentarios". Mover el editor inline
de comentarios DENTRO del tab Historial: aparece arriba cuando el
sub-pill activo es "Todo" o "Comentarios". Misma lógica
(`addComment` + `recordCommentAdded`), misma vista cronológica.

**Alternativas:**

- Mantener ambos tabs (status quo) → ruido visual + confusión sobre
  cuál es la fuente de verdad.
- Eliminar Historial y dejar solo Comentarios → comentarios son uno
  de los ~25 tipos de evento. No se puede subordinar lo más amplio
  a lo más concreto.

**Razón:** Coherencia con ADR-040. Si Historial es source of truth,
los comentarios viven ahí. El sub-pill "Comentarios" filtra el
timeline a solo eventos de tipo `comment` y muestra el editor
arriba para que añadir uno no implique salir del flujo.

Ver: `src/components/contacts/detail/ContactHistoryTab.tsx`
(componente `CommentComposer` interno).

---

## 2026-04-22 · ADR-042 · Operaciones tab estilo Lovable (Banner + Leads + Oportunidades)

**Contexto:** El tab "Operaciones" de la ficha del contacto se
intentó montar como filtro de `Venta[]` por email. Empty state para
casi todos porque los emails de mock contactos no coinciden con los
de mock sales. Lovable original tiene un layout más rico con tres
zonas en el mismo tab.

**Decisión:** Replicar el layout Lovable adaptado a tokens Byvaro:

1. **Botón "+ Añadir oportunidad"** arriba derecha (CTA primario,
   stub hasta cablear `AddOpportunityDialog`).
2. **Banner verde "Compra en curso"** cuando hay un lead convertido
   con `convertedSaleId`. Muestra unidad/promoción + 3 KPIs (Precio,
   Señal, Fecha de inicio) + CTA "Ver venta →" a `/ventas/:id`.
3. **Card "Oportunidades (N)"** — `ContactOpportunityEntry[]` con
   thumbnail, agencia · agente, pill estado (Activa/Ganada/Archivada),
   intereses del cliente (Tipo, Zona, Presupuesto, Dormitorios) y
   tags libres ("Vistas al mar", "Inversión"…).
4. **Card "Leads (N)"** — `ContactRecordEntry[]` con thumbnail, "Desde
   [origen] · [fecha]", ref + landing y pill estado
   (Convertido/Abierto/Pendiente/Cancelado).

Cada card tiene CTA "Ver oportunidad →" / "Ver venta →" que apunta a
`/oportunidades/:id` o `/ventas/:id` (pantallas a crear).

Tab "Registros" se mantiene aparte (decisión del usuario "no quites
registros, eso es otra cosa") — es la bandeja de ENTRADA cronológica
del contacto, distinta de la vista de pipeline operacional.

**Alternativas:**

- Filtrar `sales[]` por email → empty state casi siempre. Descartado.
- Sintetizar operaciones desde leads convertidos a partir de
  `convertedSaleId` → era lo que hacía `contactOperacionesMock.ts`
  (borrado al pivotar).
- Fusionar Registros + Operaciones en un solo tab → el usuario lo
  rechazó explícitamente.

**Razón:** El layout Lovable es el más fiel a cómo el agente piensa
el contacto: "qué compra está cerrando ya · qué oportunidades sigue
trabajando · qué leads brutos le entraron". El tab Registros
complementa con la vista cronológica del log.

Ver: `src/components/contacts/detail/ContactOperacionesTab.tsx`,
`docs/screens/contactos-ficha.md`.

---

## 2026-04-22 · ADR-043 · WhatsApp como modal lateral (no tab)

**Contexto:** WhatsApp era un tab más en la ficha del contacto. Al
hacer click se cambiaba de pantalla y se perdía el contexto del
resumen, registros, oportunidades…

**Decisión:** WhatsApp pasa a ser un **modal lateral** (`Dialog`
de Radix custom):

- **Backdrop con `backdrop-blur-md`** sobre la ficha de fondo
  (desenfocada, no oscurecida).
- **Panel anclado a la derecha**, slide-in desde la derecha.
- **`h-[100dvh]` (todo el alto)**, ancho **920px** en md+ (chat
  ~620px + sidebar de agentes 300px) · fullscreen en mobile.
- Botón cerrar (X) arriba derecha.
- Contenido reutiliza `ContactWhatsAppTab` con un nuevo prop
  `mode: "page" | "modal"`. En modal: oculta sidebar de agentes en
  mobile (md:flex), elimina chrome extra, usa `h-full` en lugar de
  `h-[calc(100vh-260px)] min-h-[560px]`.
- El tab "WhatsApp" sigue en la barra de tabs pero su click intercepta
  → abre el modal sin cambiar `activeTab`.

Otros entry points (icono WhatsApp del bloque "Teléfonos" del Resumen,
envío de documentos por WhatsApp al propio contacto) también abren el
modal.

**Alternativas:**

- Quitar WhatsApp de tabs y poner un FAB → rompe consistencia con el
  resto de tabs.
- Modal centrado pequeño → no escalaría con el sidebar de agentes
  necesario para multi-agente.
- Sheet/drawer desde abajo → menos cómodo en desktop para chat largo.

**Razón:** El agente quiere responder rápido sin perder contexto.
Modal lateral con blur preserva la lectura del cliente al lado y
no obliga a navegar fuera. Wide enough para ver chat + lista de
otros agentes que han hablado con el cliente.

Ver: `src/components/contacts/detail/ContactWhatsAppDialog.tsx`,
`src/components/contacts/detail/ContactWhatsAppTab.tsx` (prop `mode`).

---

## 2026-04-22 · ADR-044 · Catálogo dinámico de tipos de relación entre contactos

**Contexto:** El dialog "Vincular contacto" usaba 5 opciones
hardcoded (`spouse`, `partner`, `family`, `colleague`, `other`). Casos
reales del cliente piden tipos custom: "Inversor conjunto", "Heredero",
"Asesor financiero", "Tutor legal".

**Decisión:** Crear catálogo gestionable por admin en
`/ajustes/contactos/relaciones` (página `relaciones.tsx`):

- 5 tipos predeterminados (no se pueden eliminar pero sí desactivar).
- Admin puede añadir tipos custom, renombrar, activar/desactivar,
  eliminar custom.
- Tipos desactivados siguen mostrándose en vínculos existentes pero no
  aparecen al crear nuevos.
- Storage: `byvaro.contacts.relationTypes.v1` (`relationTypesStorage.ts`).

Cambios en código:
- `ContactRelation.relationType` ampliado de union literal a `string`
  (acepta cualquier id del catálogo).
- `LinkContactDialog` carga el catálogo con `loadRelationTypes()` y
  filtra `enabled !== false`.
- `ContactSummaryTab` resuelve la etiqueta con `getRelationLabel(id)`
  (gracefully cae al id como fallback si el tipo desaparece).
- Vínculo es bidireccional: `recordRelationLinked` se llama en
  AMBOS contactos.

**Alternativas:**

- Mantener union literal con keys nuevas en código → cada cliente
  forzaría release.
- Tipos solo custom (sin predeterminados) → onboarding pesado.
- Free-text en lugar de catálogo → fragmentación ("Conyuge" vs
  "Cónyuge" vs "Esposa").

**Razón:** Estándar SaaS B2B (catálogo editable + valores
predeterminados sensatos). Permite extensión sin release. Wired al
sidebar Settings con `live: true` (ver ADR-006 para el flag).

Ver: `src/pages/ajustes/contactos/relaciones.tsx`,
`src/components/contacts/relationTypesStorage.ts`,
`src/components/contacts/detail/LinkContactDialog.tsx`.

---

## 2026-04-22 · ADR-045 · Tab Emails de la ficha es vista de RESUMEN, nunca cliente de email

**Contexto:** Tentación de mostrar los emails completos dentro del
tab Emails de la ficha (replicar GmailInterface filtrado). Llevaría a
mantener dos clientes de email + lógica duplicada de etiquetas,
firmas, plantillas, drafts…

**Decisión:** El tab Emails es **solo vista de resumen** y siempre
deep-linkea a `/emails?contact=<id>` (filtro server-side cuando
exista) para leer/responder. Componentes:

- **Banner azul "N emails nuevos sin leer"** si hay `email_received`
  en últimas 48h sin `email_sent` posterior.
- **Card stats globales**: Enviados / Recibidos / Entregados / Abiertos.
- **Card desglose por usuario**: lista de agentes que han enviado
  emails al contacto con su count y último envío.
- **CTA grande final** "Ver todos los emails con este contacto".

Cada elemento es clickeable y lleva a `/emails?contact=<id>`. **Nunca**
mostramos el contenido de un email aquí.

En el Historial, los eventos de tipo `email_*` también son clickeables
y navegan a `/emails?contact=<id>`. **Nunca** al `?tab=emails` de la
ficha — esa pestaña es solo summary.

Nuevos tipos de evento añadidos: `email_delivered` (callback SMTP,
icono `MailCheck` verde) y `email_opened` (pixel tracking, icono
`MailOpen` violeta). Ambos los emite el sistema (`actor: "Sistema"`).

**Alternativas:**

- Cliente de email completo dentro del tab → duplicación masiva.
- Nada en el tab (eliminarlo) → pierde el resumen de actividad y la
  visibilidad por usuario.

**Razón:** Single source of truth para leer correos = `/emails`. El
tab de la ficha responde la pregunta "¿qué actividad de email tiene
este cliente y con qué agentes?" sin convertirse en un cliente
secundario.

Ver: `src/components/contacts/detail/ContactEmailsTab.tsx`,
`src/components/contacts/contactEventsStorage.ts`
(`recordEmailDelivered/Opened/Received`),
`docs/screens/contactos-ficha.md` §Tabs · Emails.

---

## 2026-04-23 · ADR-046 · Asimetría de datos entre registro `direct` y `collaborator`

**Contexto:** Un registro puede entrar por dos caminos: lo crea una
agencia colaboradora (caso clásico que exige IA de duplicados) o lo
crea el propio promotor desde su CRM para reservar un cliente "suyo".
Hasta ahora el modelo `Registro` tenía `agencyId` obligatorio y trataba
los dos casos igual.

**Decisión:** Introducir `RegistroOrigen = "direct" | "collaborator"`
como eje canónico del flujo. `agencyId` pasa a ser opcional (requerido
solo para `collaborator`). La visibilidad de datos es asimétrica:

- **`collaborator`** — la agencia solo envía 3 campos canónicos:
  `nombre` completo, `nacionalidad`, `phoneLast4`. Email, DNI y teléfono
  completo quedan **bloqueados con candado** en el detalle hasta que el
  promotor apruebe. Backend debe ignorar/rechazar esos campos si llegan
  en el `POST /api/records`.
- **`direct`** — el promotor tiene todos los datos del cliente desde el
  minuto cero (es su propio CRM). Se muestran sin restricción.

UI:
- List card → badge `Directo` (verde) vs `Colab.` (gris).
- Detalle → card "Origen" distinta; CompareCard reetiquetada en directo.
- ActivityTimeline → primer evento con actor = promotor en directos.
- Filtro pill "Origen" en el toolbar de `/registros`.
- Filtro "Agencia" excluye directos automáticamente cuando hay selección.

**Alternativas:**

- Mantener un solo tipo y convertir "direct" en un colaborador especial
  con `agencyId = promotorId`. → Contamina las queries de comisiones y
  rompe la semántica del panel "Colaboradores".
- Dos entidades separadas (`DirectRecord` y `AgencyRecord`). → Duplica
  IA de duplicados, endpoints, filtros y la pantalla. Peor para el
  promotor que los quiere ver mezclados en una bandeja única.

**Razón:** Un solo eje (`origen`) modela la diferencia sin duplicar
nada. La asimetría de datos refleja una restricción real de privacidad
cross-agencia: una agencia colaboradora **no puede** compartir el email
de su cliente a otra agencia ni al promotor antes de la aprobación
(riesgo legal + competitivo). La UI debe mostrar ese candado de forma
explícita para que el promotor entienda por qué faltan campos.

**Pregunta abierta** (ver `docs/open-questions.md`):
¿Al aprobar, los campos bloqueados se desbloquean automáticamente, o
nunca se comparten y quedan solo en el CRM de la agencia?

Ver: `src/data/records.ts` (`RegistroOrigen` + mocks directos),
`src/pages/Registros.tsx` (badge + filtro + detalle),
`src/components/promotions/detail/ClientRegistrationDialog.tsx:260`
(alta con origen correcto según `accountType`),
`docs/data-model.md §Registro`,
`docs/backend-integration.md §7.2 · Registros`,
`docs/screens/registros.md §Origen del registro`,
`preview/registros-clean.html` (mockup con candado).

---

## 2026-04-23 · ADR-047 · Perfil del usuario desacoplado del mock, con store único

**Contexto:** `/ajustes/perfil/personal` permitía editar el perfil, pero
el resultado quedaba huérfano: `useCurrentUser()` seguía devolviendo el
`DEVELOPER_USER` hardcoded y los 93 consumers del hook (sidebar, emails,
historial de contactos, permisos) ignoraban los cambios. El usuario
editaba su nombre, pulsaba Guardar… y seguía apareciendo como "Arman
Rahmanov" en todas partes.

**Decisión:** Crear `src/lib/profileStorage.ts` como store único del
perfil editable, con el mismo patrón que `registrosStorage.ts`
(get/save + hook reactivo con `CustomEvent`). Reescribir
`useCurrentUser()` para fusionar el perfil persistido sobre el mock
base cuando la cuenta es promotor. El modo "ver como agencia" sigue
recibiendo la identidad desde el mock de la agencia (es una simulación
demo, no un perfil de usuario).

Paralelamente, `logout()` limpia ahora `byvaro.user.profile.v1` y
`byvaro.user.phones.v1` para que no se hereden datos entre sesiones.

**Alternativas:**

- Contexto global (React Context + Provider) para el perfil. →
  Requiere envolver la app y añadir más re-renders. El hook + evento
  custom es más ligero y compatible con el patrón de `registrosStorage`.
- Leer directamente `localStorage` desde `useCurrentUser()`. → Pierde
  reactividad entre pestañas y esconde la persistencia.

**Razón:** Un único hook (`useCurrentUser`) como punto de verdad para
la identidad. Cualquier consumer hoy o mañana se beneficia del cambio
sin tocar su código. Al portar al backend, sustituir la implementación
del hook para que lea del `AuthProvider`/JWT es la única pieza a cambiar
— los 93 consumers no se tocan. La separación `profileStorage.ts`
también hace obvio qué persistir en el servidor cuando llegue el
`PATCH /api/me`.

Ver: `src/lib/profileStorage.ts`,
`src/lib/currentUser.ts:58-80` (fusión),
`src/lib/accountType.ts:75-88` (logout amplía su scope),
`src/pages/ajustes/perfil/personal.tsx` (consume los helpers),
`src/components/MobileHeader.tsx` (drawer muestra identidad + logout),
`docs/backend-integration.md §1 · Auth & usuarios` (nuevos endpoints
`GET/PATCH /api/me` + `POST /api/auth/logout`).

---

## 2026-04-23 · ADR-048 · Permisos granulares por miembro, desacoplados del rol

**Contexto:** Hasta ahora `TeamMember` tenía sólo `role: "admin" |
"member"` como eje de permisos. Esto no cubre casos reales que aparecen
en cuanto el equipo crece más allá de 3-4 personas:

- Un agente senior **puede aprobar registros** pero **no es admin**
  (no gestiona facturación ni miembros).
- Un administrativo **es admin** para gestionar miembros e integraciones
  pero **no debe firmar contratos** (ni tiene representación legal).
- Parte del equipo aparece **en el microsite público** del promotor
  (las caras comerciales), otra parte **no** (gente de backoffice).

**Decisión:** Añadir tres flags booleanos independientes al
`TeamMember`, que se combinan con `role` para decidir capacidad:

- `canAcceptRegistrations` — gate en los botones Aprobar/Rechazar de
  `/registros` (y en las acciones bulk).
- `canSign` — gate en el flujo de cierre/activación de colaboraciones
  con agencias (contratos, condiciones comerciales).
- `visibleOnProfile` — filtro aplicado en `/empresa` y en los templates
  del microsite de cada promoción para decidir qué miembros se
  muestran al público.

La UI de edición vive en `/ajustes/usuarios/miembros` · cada card es
expandible y permite al admin editar cargo, departamento y los tres
toggles inline.

**Alternativas:**

- **Rol con más valores** (`admin | senior | agent | accountant`). →
  Combinatoria explota · tres ejes independientes cuelgan mejor de
  flags booleanos que de un único string.
- **Sistema de permisos totalmente libre** (catálogo de ~50 keys como
  `docs/permissions.md` define para el largo plazo). → Correcto pero
  excesivo para el MVP · introducir los 3 flags hoy desbloquea los
  casos de negocio reales sin parálisis del diseño.
- **Heredar de `role`** (admin ⇒ todo). → Rompe el caso "admin
  técnico sin firma" que es el más frecuente en promotores pequeños.

**Razón:** Tres ejes ortogonales (admin técnico / representación
legal / cara comercial) son ejes reales del negocio que el usuario
identifica fácilmente. Un flag booleano es más legible que un rol
compuesto, tanto para el admin al configurarlos como para el backend
al validarlos (middleware simple: `if (!user.canAcceptRegistrations)
return 403`).

El catálogo completo de permisos (`docs/permissions.md`) queda
intacto — cuando se implemente, los 3 flags mapean directamente a
keys `records.decide`, `contracts.sign`, `profile.visible` y la UI
pasa a leer de allí sin tocar esta pantalla.

**Impacto backend:** `PATCH /api/organization/members/:id` acepta los
tres flags en el body · RLS/middleware comprueba cada uno en su
endpoint correspondiente. Un endpoint que requiera `canAcceptRegistrations`
y no lo tenga devuelve 403 aunque el usuario sea admin.

Ver: `src/lib/team.ts` (tipo + mocks),
`src/pages/ajustes/usuarios/miembros.tsx` (UI de edición),
`docs/screens/ajustes-miembros.md` (spec funcional),
`docs/backend-integration.md §1 · Auth & usuarios` (endpoints),
`docs/data-model.md §Usuario / TeamMember`.

---

## 2026-04-23 · ADR-049 · Dashboard de rendimiento del miembro + 2 flows de alta

**Contexto:** El admin necesitaba dos capacidades que hasta ahora no
estaban en el producto:

1. **Dar de alta** nuevos miembros de forma ágil. Invitar por email es
   lo estándar, pero en onboarding presencial (p. ej. el admin está
   con el nuevo agente en la oficina) no sirve — se necesita poder
   crear la cuenta en el momento y entregar una contraseña temporal.
2. **Medir el desempeño** de cada miembro con datos accionables. Las
   decisiones de gestión (a quién promover, formar, reasignar leads,
   o incluso despedir) se hacían sin datos consistentes.

También había un problema colateral: un mismo email podía acabar
ligado a varias organizaciones si el admin no tenía cuidado, creando
una confusión grave sobre propiedad de datos (¿de quién son los
registros creados por ese email?).

**Decisión:**

### 1. Dos flows de alta con una regla dura de unicidad

- **Flow A · Invitar por email** (recomendado).
  `POST /api/organization/invitations { email, role, personalMessage? }`.
  Backend envía email con token 7 días. Plantilla canónica en
  `src/lib/teamInvitationEmail.ts` (es/en). El dialog del admin
  muestra **preview HTML del email** antes de enviar (iframe).
- **Flow B · Crear con contraseña temporal**.
  `POST /api/organization/members { ..., generateTempPassword: true }`.
  Devuelve `{ member, tempPassword }`. Admin copia y comparte por
  canal seguro. `mustChangePassword = true` al primer login.
- **Regla fuerte**: `409 EMAIL_TAKEN` si el email ya está en cualquier
  otra organización. La respuesta incluye `existingWorkspace` para que
  el frontend muestre "Este email ya pertenece a Prime Properties".

### 2. Dashboard `/equipo/:id/estadisticas` con 4 bloques canónicos

- **Resultados comerciales** · ventas €, count, comisión, registros
  aprobados, tasa aprobación, visitas realizadas, conversión visita→venta.
- **Pipeline** · leads asignados, oportunidades abiertas, visitas
  próximas 7d, registros pendientes.
- **Comunicación** · emails + % apertura, WhatsApp, llamadas, tiempo
  medio respuesta a lead.
- **Actividad CRM** · tiempo activo diario, tiempo/sesión, hora pico,
  heatmap día×hora (168 celdas), racha, duplicados, visitas sin evaluar.

Benchmarks contra la media del equipo en los KPIs principales
(↑34% vs equipo) para dar contexto inmediato.

### 3. Plan de comisiones opcional

Dos campos `commissionCapturePct` (0-100) y `commissionSalePct` (0-100)
en el `TeamMember`. `undefined` = hereda plan del workspace. Expuestos
en un pill del header del dashboard del miembro cuando tienen valor.

### 4. Resumen de rendimiento en el popup de edición

`MemberFormDialog` incluye una sección "Rendimiento · últimos 30 días"
con 6 KPI tiles y un link "Ver estadísticas completas →" al dashboard.
Esto evita hacer un popup gigante y mantiene el dialog centrado en
edición de perfil, dejando el análisis profundo para su pantalla.

**Alternativas:**

- **Un único flow de alta (solo invitación)**. → Bloquea el caso
  onboarding presencial, que es real en agencias pequeñas.
- **Crear siempre con contraseña temporal y nunca invitar**. → Peor
  UX para casos remotos (mucha agencia es distribuida).
- **Dashboard dentro del popup** sin página dedicada. → 15 campos en
  un popup rompe el foco · un dashboard completo merece su pantalla.
- **Mostrar stats solo al admin**. → Lo hacemos inicialmente, pero
  cuando haya privacy granular, el miembro debería ver sus propias
  stats también (pendiente · TODO en la pantalla).

**Razón:**

- La regla de un email único por organización es **estructural**: evita
  datos huérfanos, facilita RLS backend, y alinea con cómo funcionan
  SaaS estándar (Slack, Linear, Notion — todos lo hacen así).
- Los 4 bloques de KPIs corresponden a preguntas reales del dueño de
  agencia: ¿produce?, ¿tiene pipeline?, ¿comunica?, ¿es constante?.
- El plan de comisiones a nivel de miembro habilita configuraciones
  heterogéneas (junior 10%, senior 20%) sin tocar el plan global.

**Preparación para IA (sin implementar todavía):**

- El shape de `MemberStats` está diseñado para ser el INPUT directo
  de `POST /api/ai/analyze-member/:id`. El output `AIMemberReport` ya
  está especificado en `docs/plan-equipo-estadisticas.md §3`.
- La golden rule de CLAUDE.md (§📊 KPIs en el dashboard del miembro)
  obliga a que cualquier señal nueva de actividad se añada al
  `MemberStats` y se muestre en la pantalla, manteniendo sincronizado
  lo que ve el admin con lo que procesa la IA.

**Impacto:**

- Frontend: 4 archivos nuevos (`Equipo.tsx`, `EquipoMiembroEstadisticas.tsx`,
  `MemberFormDialog.tsx`, `InviteMemberDialog.tsx`), 4 helpers
  (`memberStats.ts`, `jobTitles.ts`, `teamInvitationEmail.ts`,
  `flags.ts`), 2 components reutilizables (`Flag.tsx`, `ViewToggle.tsx`).
- Backend: 7 endpoints nuevos listados en
  `docs/backend-integration.md §1` y `§1.9`.
- Regla de oro nueva en CLAUDE.md (§📊 KPIs en el dashboard del miembro).
- 250 SVGs de banderas en `public/flags/` · reemplazan emojis en
  nacionalidades, idiomas y prefijos telefónicos.

Ver:
- `src/pages/Equipo.tsx` · `src/pages/EquipoMiembroEstadisticas.tsx`,
- `src/components/team/{MemberFormDialog,InviteMemberDialog,JobTitlePicker}.tsx`,
- `src/data/{memberStats,jobTitles}.ts`,
- `src/lib/{teamInvitationEmail,flags}.ts`,
- `docs/screens/{equipo,equipo-estadisticas}.md`,
- `docs/plan-equipo-estadisticas.md`,
- `docs/backend-integration.md §1.9`,
- CLAUDE.md §📊 KPIs en el dashboard del miembro.

---

## 2026-04-23 · ADR-050 · Usuario unificado · "mí" es mi entrada en el equipo

**Contexto:** Hasta ahora había dos stores independientes que
describían a la misma persona:

- `byvaro.user.profile.v1` (profileStorage · editado en
  `/ajustes/perfil/personal`).
- `byvaro.organization.members.v4` → entrada `u1` (editado en
  `/equipo` → `MemberFormDialog`).

Resultado: el usuario editaba su perfil en Ajustes, pero al verse a
sí mismo en `/equipo` encontraba **datos distintos**. Y al revés: un
admin podía cambiarle la foto o el cargo desde `/equipo` y eso no se
reflejaba en el sidebar ni en la firma de emails del propio usuario.

**Decisión:** Unificar en una sola fuente. "Mí" es **la entrada de
TEAM_MEMBERS donde `id === currentUser.id`**. Nace
`src/lib/meStorage.ts` como fachada única:

- `getMe()` / `updateMe(patch)` / `useMe()` reactivo.
- `emitMembersChange()` helper que cualquier pantalla que edite
  miembros llama tras persistir · dispara `byvaro:me-change` +
  `byvaro:members-change` para que sidebar, perfil, historial y
  equipo se refresquen en caliente.
- `profileStorage.ts` queda como **fachada legacy**: todas sus
  funciones delegan en `meStorage`. No se rompen los 10+ consumers
  existentes.
- Migración silenciosa: si existía un `byvaro.user.profile.v1`, en
  la primera carga del cliente se vuelca sobre `meStorage` (una sola
  vez · flag `byvaro.me-migration.v1`).

**División editor ↔ admin:**

- Usuario edita (desde `/ajustes/perfil/personal`): fullName, email,
  avatar, teléfono, cargo (JobTitlePicker), departamento (auto +
  manual override), idiomas, bio.
- Admin edita (desde `/equipo/MemberFormDialog`): todo lo anterior
  **más** rol, permisos granulares, `visibleOnProfile`, plan de
  comisiones, status (activate/deactivate).
- El usuario ve una nota al pie de `/ajustes/perfil/personal` que
  explica qué campos solo gestiona el admin.

**Segundo cambio · ubicación en el navbar:**

Equipo baja del grupo **Red** al grupo **Administración** (junto a
Empresa). Lógica: los miembros del equipo forman parte del perfil
organizativo (aparecen en la ficha pública de Empresa y microsites
según `visibleOnProfile`), no son "red comercial" como agencias y
contactos. El usuario mental del admin es: "aquí gestiono mi
empresa" (Empresa + Equipo) vs "aquí gestiono el pipeline" (Red).

**Tercer cambio · visibilidad en ficha de Empresa (pill explícita):**

La vista Lista de `/equipo` ahora muestra una **pill explícita**
junto a cada miembro con `Eye` "Visible" (verde) o `EyeOff` "Oculto"
(gris). Antes solo aparecía en la galería como badge sutil. Razón:
el admin necesita poder escanear rápido quién sale en el microsite
sin tener que abrir el dialog de cada miembro.

**Alternativas descartadas:**

- **Dos stores sincronizados vía reactividad** (sync on write hacia
  ambas direcciones). → Mantenible en teoría, fuente de bugs
  sutiles en la práctica. Hoy lo tenemos cerrado con un único store.
- **Mover profileStorage completamente y eliminar la fachada**. →
  Rompe los 10+ consumers existentes en un solo commit. La fachada
  legacy permite migración gradual.
- **Mantener Equipo en Red**. → Usuario dejó claro que conceptualmente
  pertenece a Administración junto a Empresa.

**Consecuencias:**

- `useCurrentUser()` ahora es reactivo a cambios en TEAM_MEMBERS —
  un admin editando al usuario desde `/equipo` refresca el sidebar,
  historial y firma en tiempo real.
- `MemberFormDialog`, `InviteMemberDialog`, `miembros.tsx` y `Equipo.tsx`
  llaman a `emitMembersChange()` tras escribir para propagar.
- `TeamMember.bio` añadido al tipo (antes solo en profileStorage).
- `/ajustes/perfil/personal` ahora permite editar phone, cargo
  (JobTitlePicker con máx 2), y los mismos idiomas (ISO codes) que
  el resto del sistema.

**Backend:** cuando se conecte, el mapping es directo:

- `GET /api/me` → devuelve el `TeamMember` del usuario logueado
  (equivalente a `meStorage.getMe()`).
- `PATCH /api/me` → actualiza los campos permitidos al propio
  usuario (fullName, email, avatar, phone, jobTitle, department,
  languages, bio).
- `PATCH /api/organization/members/:id` → actualiza campos reservados
  a admin (role, permisos, commissions, visibleOnProfile).

Ver: `src/lib/meStorage.ts`, `src/lib/profileStorage.ts` (fachada),
`src/lib/currentUser.ts`, `src/pages/ajustes/perfil/personal.tsx`,
`src/pages/Equipo.tsx`, `src/pages/ajustes/usuarios/miembros.tsx`,
`src/components/AppSidebar.tsx` (Equipo movido a Administración),
`docs/screens/equipo.md §Regla de visibilidad en Empresa`.

---

## 2026-04-23 · ADR-051 · Handover obligatorio al desactivar miembro

**Contexto:** Si un miembro del equipo se da de baja (despido, baja
voluntaria, excedencia) y el admin lo desactiva con un simple toggle,
todas sus cosas quedan **huérfanas**:

- Sus contactos dejan de tener agente asignado (los clientes llaman
  y no saben a quién dirigirse).
- Sus oportunidades se pierden del pipeline.
- Sus visitas programadas no aparecen en la agenda de nadie.
- Los emails que entran a su cuenta rebotan o se quedan sin leer.
- La IA pierde contexto · no sabe quién heredó qué.

Este es un problema real de SaaS inmobiliario — la rotación en el
sector es alta y sin un handover bien diseñado se pierden leads con
coste alto de adquisición.

**Decisión:** La desactivación NO es un toggle atómico. Pasa por
`DeactivateUserDialog` que **obliga** al admin a reasignar cada
categoría de activos antes de ejecutar el cambio de status.

**Categorías contempladas** (en `src/lib/assetOwnership.ts`):

- `contacts` · contactos asignados.
- `opportunities` · oportunidades abiertas.
- `records` · registros con validez vigente.
- `visits` · visitas programadas + pendientes de evaluar.
- `promotions` · si era el agente de referencia de alguna promoción.
- `email` · cuenta(s) de email del miembro → **delegación
  automática** (forward de 6 meses a otro destinatario).

**Contrato del historial (CRÍTICO):** cada entidad reasignada añade
en su timeline un evento `reassigned` con:

```ts
{
  type: "reassigned",
  reason: "handover",
  from: { id, name },
  to: { id, name },
  note: "Heredado de <nombre> · baja del equipo",
  occurredAt: ISO,
}
```

Esto se renderiza en la ficha de contacto (`/contactos/:id?tab=historial`)
como un evento diferenciado. La IA puede leer esta señal para
detectar patrones ("el 40 % de los contactos heredados de Diego
acabaron cerrando con Isabel — considerar darle más leads RU").

**Alternativas descartadas:**

- **Toggle directo** (lo que había). → Pérdida de datos garantizada
  en cuanto hay volumen real. Inaceptable en producción.
- **Reasignación en bulk automática** al miembro con menos carga. →
  Sin intención del admin · desbalancea equipos por accidente.
- **Solo bloquear el login** sin reasignar. → El activo sigue
  vinculado al miembro que no puede ejecutar nada · mismo problema.
- **Categorías reasignadas por email (soft)** en vez de obligar. → La
  UI no debe dejar salir al admin sin resolver esto.

**Email · caso especial:** el email se delega automáticamente porque:
1. Reasignar emails individuales es inviable.
2. El forward temporal (6 meses) captura la cola sin perder mensajes
   entrantes.
3. El admin elige el destinatario una sola vez en el dialog.

**Consecuencias de diseño:**

- `Equipo.tsx` y `MemberFormDialog` ya no llaman directamente a
  `toggleActive` para desactivar · abren el dialog.
- Reactivar sigue siendo un toggle directo (no hay nada que
  reasignar al revés).
- Backend (`POST /api/members/:id/handover`) ejecuta la transacción
  atómica: reasignaciones + `status: "deactive"` + eventos de
  historial + forward de email. Si falla, rollback.
- Cualquier feature nueva que cree "cosas" asignadas a un miembro
  tiene que añadirse al inventario en `assetOwnership.ts` · si no,
  pierde esa cosa al desactivar al dueño (rule aplicable a
  code-reviews).

**Regla de oro** añadida a `CLAUDE.md §🔄 Handover obligatorio al
desactivar miembro`.

Ver: `src/lib/assetOwnership.ts`,
`src/components/team/DeactivateUserDialog.tsx`,
`src/pages/Equipo.tsx:toggleActive + handleDeactivateConfirm`,
`docs/screens/equipo.md §Desactivar miembro`.


## 2026-04-23 · ADR-052 · ~~Oportunidades como entidad standalone~~ · **REVERTIDO**

> **Status: SUPERSEDED por ADR-053**. Esta decisión se revirtió el
> mismo día tras probar el diseño: la distinción Lead/Oportunidad
> añadía fricción sin aportar claridad. Se vuelve a una sola entidad
> **Lead** con pipeline interno de etapas (ver ADR-053).

**Contexto original.** Se diseñaron Leads + Oportunidades como dos
entidades separadas con una pantalla cada una (`/leads` + `/oportunidades`),
un seed propio (`src/data/opportunities.ts`), conversión manual
`Lead → Oportunidad` con diálogo de confirmación y settings en
`/ajustes/leads-oportunidades` para alternar el flow-mode.

**Por qué se revirtió.** Al usar la UI quedó claro que para el tamaño
del equipo y la operativa del promotor inmobiliario no hace falta la
separación. "Está contactado", "en visita" o "negociando" son estados
del mismo lead, no conceptos distintos. Mantener dos listados + dos
fichas + una conversión manual era peso muerto: el comercial salta
entre pantallas para seguir al mismo cliente.

Decisión nueva: pipeline interno en la entidad Lead (ADR-053).

**Archivos borrados en el revert.**
- `src/data/opportunities.ts`
- `src/pages/Oportunidades.tsx`
- `src/pages/OportunidadDetalle.tsx`
- `src/pages/ajustes/leads-oportunidades.tsx`
- `docs/screens/oportunidades.md`
- `docs/screens/oportunidad-detalle.md`
- §7.3 de `docs/backend-integration.md`

## 2026-04-23 · ADR-053 · Pipeline unificado dentro de Lead (sin entidad Oportunidad)

**Decisión.** En Byvaro no existe una entidad "Oportunidad" separada.
Todo cliente potencial vive en la lista de **Leads** y avanza por un
pipeline de 5 etapas + 2 terminales:

```
solicitud → contactado → visita → evaluacion → negociando → ganada | perdida
                                                           + duplicate (IA)
```

- La etapa se guarda en `lead.status` (ampliación del enum
  `LeadStatus` en `src/data/leads.ts`).
- No hay conversión manual ni botón "Convertir a oportunidad" — el
  comercial simplemente cambia la etapa desde la ficha del lead.
- Un solo listado (`/leads`), una sola ficha (`/leads/:id`), un solo
  pipeline. La ficha interior se diseñará en una iteración siguiente
  con la barra de etapas, matching e historial dentro del mismo lead.

**Por qué.** Fricción. La distinción Lead/Oportunidad pertenece a
CRMs grandes con equipos segmentados (SDR → AE). Para un promotor
inmobiliario, es el mismo comercial quien lleva al cliente desde que
entra hasta que firma — separarlo en dos entidades solo duplica UI y
obliga a una conversión manual que no aporta.

**Implicación en mocks / backend.**
- Los 12 leads del seed cubren ahora las 5 etapas (distribuidos para
  demo: solicitud · contactado · visita · evaluacion · negociando ·
  ganada · perdida · duplicate).
- Backend: `PATCH /api/leads/:id { status }` para avanzar etapa.
  Cuando toque, cada cambio emitirá evento en el timeline del lead y
  en el historial del contacto (regla §🥇).

Ver:
- `src/data/leads.ts` · `LeadStatus` + `leadStatusConfig`.
- `src/pages/Leads.tsx` · KPIs + segmented por etapa actualizados.
- `src/pages/LeadDetalle.tsx` · sin diálogo de conversión (queda
  pendiente la iteración de la vista de dentro).


## 2026-04-24 · ADR-054 · Departamentos gestionables + catálogo de prefijos ISO completo

**Contexto.** Dos problemas operativos que surgieron al usar los
formularios de alta de miembro del equipo:

1. Los departamentos vivían hardcodeados en un array dentro de
   `MemberFormDialog.tsx` (`DEPARTMENT_SUGGESTIONS` con 7 valores).
   Cada empresa tiene su propia estructura organizativa — no tiene
   sentido obligar a usar la nuestra.
2. El `PhoneInput` sólo tenía 74 países curados. Suficiente para el
   mercado típico de Byvaro (España, UE, Latam, Oriente Medio,
   Cáucaso) pero había casos reales donde faltaba algún prefijo (p. ej.
   Liechtenstein, Mónaco, Bangladés, varios del Caribe/NANP).

**Decisión.**

1. **Departamentos gestionables** por el admin desde
   `/ajustes/empresa/departamentos`. Store canónico en
   `src/lib/departmentsStorage.ts` con CRUD + hook reactivo
   `useDepartments()`. Los formularios (`MemberFormDialog`,
   `InviteMemberDialog`) leen del store en lugar del array hardcodeado.
   - Deduplicación case-insensitive conservando capitalización del admin.
   - Eliminar un departamento NO cambia los miembros que ya lo tenían
     asignado (ellos conservan su valor hasta edición manual).
   - Renombrar propaga automáticamente (un solo `saveDepartments`).

2. **Catálogo ISO 3166-1 completo** en `src/lib/phoneCountries.ts`:
   de 74 → 245 países. Estados soberanos + territorios dependientes
   con prefijo propio. Los 25+ países NANP (+1) comparten prefijo y
   se marcan `ambiguous` en el popover del PhoneInput · el admin
   elige manualmente.

**Por qué ahora.** El admin pidió explícitamente gestionar
departamentos desde Ajustes (iba a usar "Recursos Humanos" y no estaba
en la lista). Y el usuario pidió "todos los prefijos sin falta" cuando
al buscar un país no aparecía.

**Implicación en backend** (TODO):
- `GET/POST/PATCH/DELETE /api/workspace/departments` — CRUD del
  store. Respeta el orden del admin (no ordenar alfabéticamente).
- El catálogo de prefijos es estático client-side (como el Flag SVG).
  No requiere endpoint.

Ver:
- `src/lib/departmentsStorage.ts` · store + hook.
- `src/pages/ajustes/empresa/departamentos.tsx` · UI CRUD.
- `src/lib/phoneCountries.ts` · 245 países ISO.
- `docs/screens/empresa-departamentos.md` · spec.
- `docs/backend-integration.md §Empresa · endpoints nuevos`.


## 2026-04-24 · ADR-055 · Fix global del scroll en Popovers dentro de Dialogs

**Contexto.** Cuando un `Popover`, `DropdownMenu` o `Select` de Radix
se abre dentro de un `Dialog` (que también es Radix), el Dialog usa
scroll-lock global vía `react-remove-scroll`. El popover se portalea
al body, pero los eventos `wheel` / `touchmove` se interceptan a
nivel document → **el scroll interno del popover no funciona**.

El síntoma visual: abres el selector de países del teléfono dentro
del `MemberFormDialog`, intentas scrollear la lista con la rueda del
ratón y no pasa nada. El popover parecía "colgado".

También había un scroll-jump al abrir: el `<input autoFocus>` dentro
del popover hacía que el browser hiciera `scrollIntoView` del
elemento enfocado, provocando saltos bruscos en el dialog.

**Decisión.** Arreglar en los **tres wrappers canónicos** para cubrir
todo el repo sin tocar sitios individuales:

- `src/components/ui/popover.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`

Cada wrapper:
1. Hace `e.stopPropagation()` en `onWheel` y `onTouchMove` antes de
   delegar al handler del caller (si lo hay).
2. Añade `overscroll-contain` al Content para que llegar al final de
   la lista no scrollee el viewport padre.
3. El `onOpenAutoFocus={(e) => e.preventDefault()}` es responsabilidad
   del caller cuando hay un input interno con `autoFocus` que pudiera
   causar scroll-jump.

**Regla viva.** Si alguien crea un Content custom con
`@radix-ui/react-*` sin pasar por nuestros wrappers, tiene que añadir
los `stopPropagation` + `overscroll-contain`. Regla documentada en
`CLAUDE.md §🖱️ Popovers/Dropdowns/Selects dentro de Dialogs`.

**JobTitlePicker** (cambio relacionado del mismo sprint):
- Máx 2 cargos: el 3º se bloquea en vez de reemplazar FIFO.
- Banner amarillo "Máximo 2 · limpia para cambiar" + CTA Limpiar.
- Items disabled con `cursor-not-allowed` cuando se alcanza el límite.

Ver:
- `src/components/ui/popover.tsx`, `.../dropdown-menu.tsx`, `.../select.tsx`.
- `src/components/team/JobTitlePicker.tsx` · lógica de límite estricto.
- `CLAUDE.md §🖱️ Popovers/Dropdowns/Selects dentro de Dialogs`.


## 2026-04-24 · ADR-056 · Calendario unificado · entidad única + conflicto duro + multi-calendario

**Contexto.** Había que diseñar el calendario del CRM. Varios caminos
posibles:

- **Entidades separadas por tipo** (Visit, Call, Meeting, Block,
  Reminder) cada una con su pantalla y modelo. Más tipado, pero forzaría
  a duplicar UI y a sincronizar 5 backends.
- **Un tipo único** con union discriminada por `type`.

El producto esperado es "la agenda del comercial" — todos los eventos
comparten lo importante: `start/end/assigneeUserId`, se pintan en el
mismo grid, tienen las mismas acciones (mover, editar, cancelar).

**Decisión.**

1. **Entidad única** `CalendarEvent` con union discriminada por `type`
   (`visit | call | meeting | block | reminder`). Cada tipo extiende el
   base con sus campos específicos (p. ej. `visit` con `promotionId`,
   `unitId`, `evaluation`). Un solo CRUD en backend, un solo listado
   en UI.

2. **Un único agente por evento** (`assigneeUserId`). El multi-calendario
   de Google Calendar se representa como "carriles" en la sidebar, no
   como campos multi-asignee. Razón: el comercial siempre es uno — los
   compañeros pueden acompañar, pero la responsabilidad es única.

3. **Detección de conflicto DURA**. Si el agente ya tiene un evento
   solapando (excluyendo cancelados/noshow), el dialog **bloquea** la
   creación/edición con banner rojo y CTA "Cambia el existente
   primero". Razón: evitar doble-booking silencioso · el comercial que
   mueve el existente conscientemente entiende la implicación.

4. **Pipeline mobile como Apple Calendar** · no como Google Calendar:
   grid del mes con dots de color por tipo · tap en día → lista del
   día. Más rápido y más leíble en 375px.

5. **Sync con Google Calendar** en V1 con UI funcional (toggle por
   miembro en `/ajustes/calendario/sync`) y contrato backend
   documentado. Outlook/Apple llegan después.

6. **Visitas linkadas a oportunidades** · cuando el comercial pulsa
   "Programar visita" desde la ficha de oportunidad, se crea el
   evento con `leadId`. Si la visita llega desde un Registro, el
   evento se crea con `status="pending-confirmation"` y se pinta con
   borde punteado + opacidad baja en el calendario.

**Consecuencia en backend** (documentada en
`docs/backend-integration.md §Calendar`):

- `GET/POST/PATCH/DELETE /api/calendar/events`.
- `GET /api/calendar/events/conflicts?assigneeUserId&start&end&ignoreId`
  — pre-check server-side para consistencia con la UI.
- OAuth Google Calendar + cron bidireccional cada 5 min.
- Emisión de eventos en timeline de la oportunidad/contacto vinculados.

Ver:
- `src/data/calendarEvents.ts` · tipos + seed con 24 eventos.
- `src/lib/calendarStorage.ts` · CRUD + `findConflict()`.
- `src/lib/calendarHelpers.ts` · utilidades fecha/hora.
- `src/pages/Calendario.tsx` · página con 4 vistas + mobile.
- `src/components/calendar/CreateCalendarEventDialog.tsx` · dialog de
  crear/editar con conflicto duro.
- `src/pages/ajustes/calendario/sync.tsx` · sync Google.
- `docs/screens/calendario.md` · spec.

---

## 2026-04-24 · ADR-057 · Panel operativo del colaborador + reglas de oro del vínculo promotor↔agencia

**Contexto.** Al cerrar la ficha de agencia nos encontramos con varios
problemas mezclados que antes resolvíamos "a ojo" en cada sitio:

1. La ficha pública de la agencia (`Empresa.tsx`) funciona como
   brochure, pero cuando la agencia **ya colabora** el promotor no
   quiere el marketing — quiere la operativa.
2. No había un sitio donde centralizar contratos, visitas, registros,
   ventas, pagos, facturas e historial **de ese vínculo concreto**.
3. El tick azul de verificación se pintaba en unos sitios sí y en
   otros no · incoherente con la identidad del producto.
4. El flujo de "compartir promoción" permitía compartir promociones
   con `canShareWithAgencies: false` (p.ej. borradores, pausadas),
   y además la agencia nunca recibía la invitación en consecuencia,
   lo que rompía toda la cadena.
5. La agencia colaboradora entraba a la promoción y veía botones
   "Compartir con agencias" / "Invitar" que no tienen sentido en su
   rol — filtraban capacidades del promotor a quien no debe verlas.

**Decisión.**

### 1. Panel operativo del colaborador — `/colaboradores/:id/panel`

Nueva pantalla dedicada (`ColaboracionPanel.tsx`) con **9 tabs** que
cubren toda la operativa del vínculo con una agencia concreta:
Resumen · Datos · Visitas · Registros · Ventas · Documentación ·
Pagos · Facturas · Historial.

- Tabs sincronizadas con `useTabParam` (regla de oro URL·tabs).
- Historial solo visible para admins (`AdminOnly` + banner explícito).
- Contratos per-promoción · modelo Firmafy-style con `scopePromotionIds`
  y `ContractSigner`. Al firmar, las promociones en scope se marcan
  como "contrato en vigor" en la ficha.
- Todas las acciones cross-empresa llaman a `recordCompanyEvent()`
  para alimentar el historial (regla de oro historial cross-tenant).

### 2. 🧭 REGLA DE ORO · Ficha pública vs panel operativo

**Si la agencia ya es colaboradora activa, clicar lleva al PANEL
operativo. Si NO, lleva a la FICHA PÚBLICA.**

Centralizado en `src/lib/agencyNavigation.ts`:

```ts
agencyHref(agency, { fromPromoId? })
isActiveCollaborator(a) = a.status === "active" || a.estadoColaboracion === "activa"
```

Prohibido hardcodear `/colaboradores/:id/panel` en código nuevo —
todo `navigate()` hacia una agencia pasa por `agencyHref()`. Documentado
en `CLAUDE.md`. Ya aplicado a `AgenciasTabStats`, `Contratos`,
`Inicio`, `AccountSwitcher`, `Colaboradores`, `Ficha contacto`…

### 3. ✅ REGLA DE ORO · Tick azul de verificación

**Donde aparece el nombre de una agencia verificada, SIEMPRE
aparece `<VerifiedBadge>` pegado al nombre. Sin excepciones.**

- Componente único en `src/components/ui/VerifiedBadge.tsx` · custom
  SVG path (Twitter/X-blue `#1d9bf0`) · tamaños `sm/md/lg`.
- Fuente canónica de verificación: `isAgencyVerified(getAgencyLicenses(a))`
  — nunca `isAgencyVerified(a.licencias)`. `getAgencyLicenses()`
  aplica overrides que la propia agencia guarda via
  `/ajustes/empresa/licencias`.
- Cubre: `/colaboradores` listado, panel header, ficha pública,
  `AgenciasTabStats`, `SharePromotionDialog`, `AgenciaEntry`,
  `AccountSwitcher`, `AgenciasPendientesDialog`, `ajustes/empresa/datos`.

### 4. Gate dura de compartibilidad + self-heal

- `ShareMultiPromosDialog` y `ResumenTab.activePromos` filtran
  `status === "active" && canShareWithAgencies !== false`. Antes solo
  filtraba status, dejando publicar promos internas.
- `src/lib/invitaciones.ts::loadAll()` y
  `src/lib/agencyCartera.ts::loadStore()` ejecutan **auto-heal**:
  eliminan al cargar cualquier entrada que apunte a una promoción que
  ya no es compartible. Evita arrastrar datos corruptos de flujos
  previos al gate.
- Helper compartido `shareablePromoIds()` en ambos módulos para que
  la definición de "qué se puede compartir" sea una única regla.

### 5. Invitaciones bidireccionales con UX simétrica

- El promotor invita → se crea una entrada en `invitaciones.ts`
  con `{ promotionId, agencyId, invitedAt, status: "pending" }`.
- La agencia ve la promoción **en su listado normal** de
  `/promociones` (misma `PromoCardCompact`) con una overlay chip
  "Invitación" arriba + contador rojo en sidebar. No se inventa una
  tarjeta distinta — la diferenciación es mínima porque la promo es
  la misma, solo cambia la relación.
- Al abrir la promoción, la agencia ve CTA "Añadir a mi cartera".
  Al aceptar → se guarda en `agencyCartera.ts` y se desbloquea
  "Registrar cliente". Hasta entonces, registrar está bloqueado con
  motivo explícito.
- Los botones exclusivos del promotor (Compartir · Invitar agencia ·
  AgenciasTab) se **ocultan** (no desabilitan) cuando el usuario es
  agencia. Patrón declarativo, no deshabilitado sin motivo.

### 6. "Contrato en vigor" · lenguaje canónico

Renombrado "Cubierta" → "Contrato en vigor" en todos los sitios
(panel, badges, filtros, seed). El estado refleja el hito comercial
(contrato firmado), no una categoría genérica de documento. Alinea
con regla de oro "venta cerrada vs venta terminada" (ADR anterior).

**Consecuencia en backend** (actualizado en
`docs/backend-integration.md §4 Colaboradores`):

- `GET /api/collaborators/:agencyId/panel/*` (por tab).
- `POST/PATCH /api/contracts` con `scopePromotionIds` obligatorio
  para contratos per-promoción + hook a Firmafy
  (`docs/backend/integrations/firmafy.md`).
- `POST /api/invitations` / `POST /api/invitations/:id/accept` +
  evento `CollaborationStarted` al aceptar.
- Validación server-side · rechazo si la promo en el payload no es
  `active && canShareWithAgencies` — el gate debe replicarse en
  backend, no solo en UI.

Ver:
- `src/pages/ColaboracionPanel.tsx` · panel con 9 tabs.
- `src/components/collaborators/panel/*` · tabs (ResumenTab,
  DatosTab, VisitasTab, RegistrosTab, VentasTab, DocumentacionTab,
  PagosTab, FacturasTab, HistorialTab).
- `src/lib/agencyNavigation.ts` · regla de navegación.
- `src/components/ui/VerifiedBadge.tsx` · tick canónico.
- `src/lib/licenses.ts` + `src/lib/agencyLicenses.ts` · verificación
  con overrides.
- `src/lib/invitaciones.ts` · store de invitaciones + self-heal.
- `src/lib/agencyCartera.ts` · cartera aceptada de la agencia + self-heal.
- `src/components/collaborators/ShareMultiPromosDialog.tsx` · gate dura.

## 2026-04-25 · ADR-058 · Paywall Fase 1 · validación 249€/mes promotor

**Contexto.** Antes de invertir en backend completo (billing real, Stripe,
proration, multi-org), necesitamos saber si los promotores están
dispuestos a pagar 249€/mes. Una capa fina de paywall mock con CTA
"Suscribirme" que no procesa pagos reales pero marca el plan como
activo es suficiente para medir conversión sin las 4-6 semanas de
trabajo de billing real.

**Decisión.** Plan workspace-level con dos tiers (`trial` /
`promoter_249`), 3 contadores (promociones / agencias / registros) y
3 puntos de bloqueo. Solo los promotores se monetizan (Fase 1) · las
agencias permanecen gratis con `useUsageGuard()` devolviendo
`blocked: false` para `accountType !== "developer"`.

**Límites trial** (tunables · ver `PLAN_LIMITS` en `src/lib/plan.ts`):
- 2 promociones activas
- 5 agencias invitadas (cualquier estado)
- 40 registros recibidos (acumulado)

**Razones**:
- 1 promoción no basta para experimentar el producto · 2 permite
  comparar y crea sensación de portfolio.
- 5 agencias: 3 pegaba al inicio de la prueba; 5 da margen para
  validar el flujo de invitación bidireccional.
- 40 registros: con seed de ~24, el promotor llega al límite tras
  ~16 registros adicionales · suficiente para sentir valor del
  detector de duplicados y del ranking de agencias.

**Implementación frontend**:
- `src/lib/plan.ts` · modelo + hook `usePlan()` reactivo (localStorage
  + `byvaro:plan-change` event).
- `src/lib/usage.ts` · contadores derivados de seeds + storage.
- `src/lib/usageGuard.ts` · `useUsageGuard(action)` + store singleton
  del modal.
- `src/components/paywall/UpgradeModal.tsx` · modal global montado en
  `App.tsx` · 4 triggers con copy específico.
- `src/components/paywall/UsagePill.tsx` · pill ámbar header (≥80%).
- 3 puntos de bloqueo: wizard publicar (CrearPromocion.tsx),
  invitar agencia (InvitarAgenciaModal.tsx), aprobar registro
  (Registros.tsx::approve).

**Backend pendiente**: 4 endpoints + webhook Stripe + 402 Payment
Required en endpoints mutantes existentes. Spec completa
en `docs/backend-integration.md §12`.

**Tracking**: evento `paywall.shown` con `{ trigger, used, limit, tier }`.
Es la métrica clave de validación · qué % de promotores que ven el
modal hacen click en "Suscribirme".

**Regla de oro CLAUDE.md**: añadida sección "Paywall Fase 1" para que
toda feature nueva del promotor que cuente contra alguna cuota pase
obligatoriamente por `useUsageGuard()`.

**Archivos clave**:
- `src/lib/plan.ts`, `src/lib/usage.ts`, `src/lib/usageGuard.ts`,
  `src/lib/usagePressure.ts`.
- `src/components/paywall/{UpgradeModal,UsagePill}.tsx`.
- `src/pages/ajustes/facturacion/plan.tsx` (refactor a usePlan real).
- `docs/screens/ajustes-plan.md` · spec.
- `docs/backend-integration.md §12` · contrato backend.


## 2026-04-30 · ADR-059 · Tenant public_ref · referencia pública inmutable

**Contexto**. Hasta ahora las URLs / emails / payloads cross-tenant
exponían el id interno del workspace (`ag-2`, `developer-default`,
`prom-1`). Eso (a) revela información de modelo (mock single-tenant
con prefijos "ag-"/"prom-") y (b) facilita enumerar tenants vecinos
secuencialmente. Además, no hay un handle externo estable: si en el
futuro cambia el id interno (UUID, refactor de schema) las URLs
quedarían rotas.

**Decisión**. Cada `organization` lleva una columna `public_ref`
con formato `IDXXXXXX` (`ID` + 6 chars del alfabeto sin
ambigüedades `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 32 chars). Espacio
32^6 ≈ 1.07 mil millones · imposible de enumerar secuencialmente,
imposible de inferir orden de registro.

Inmutable después del primer set: trigger `organizations_protect_public_ref`
rechaza cualquier UPDATE que intente modificarla. Auto-generada
server-side por trigger `gen_tenant_public_ref()` al INSERT.

**Por qué aleatoria.** Si fuera secuencial (000001, 000002…) cualquier
observador podría inferir tamaño del producto y orden de registro.
Aleatoriedad uniforme rompe esa correlación. `IDXXXXXX` es público
(no es secreto · sirve como handle externo) pero no informativo.

**Display**. `/empresa` tab "Sobre nosotros" muestra la ref
read-only con icono Lock + botón Copiar. Formato visual cosmético
`ID·ABC·DEF` para legibilidad humana · valor canónico es de 8 chars
sin separador. NUNCA editable desde UI.

**Linking foundation**. Tabla `tenant_links` con `(from_ref, to_ref,
kind, status)` registra cualquier vínculo cross-tenant identificado
por public_ref. RLS valida membership en cualquiera de las dos orgs.
NO sustituye a `organization_collaborations` (relación operativa) ·
es un índice de discovery + auditoría que evita exponer ids internos
en URLs/emails/webhooks. URLs futuras: `byvaro.app/i/IDABC123-IDDEF456-<token>`.

**Discovery**. RPC pública `find_org_by_ref(p_ref)` (SECURITY DEFINER)
resuelve la org por su ref devolviendo solo campos públicos
(display_name, kind, logo, verified). Permite resolver QUIÉN te invita
sin exponer su id interno antes de aceptar.

**Backfill**. Migración rellena las 15 orgs existentes (Luxinmo + 4
promotores externos + 10 agencias) con refs aleatorias en una sola
transacción. NOT NULL constraint añadida después del backfill.

**Archivos clave**:
- `supabase/migrations/20260430120000_tenant_public_ref.sql` · schema + trigger + RPC + tenant_links.
- `src/lib/tenantRef.ts` · helpers TS (`generateTenantRef`, `isValidTenantRef`, `formatTenantRef`).
- `src/lib/empresa.ts` · campo `Empresa.publicRef`.
- `src/lib/supabaseHydrate.ts` · `rowToEmpresa()` propaga `public_ref` desde DB.
- `src/components/empresa/EmpresaAboutTab.tsx` · `TenantRefField` (edit) + `TenantRefDisplay` (preview/visitor).
- `docs/contract-index.md §1.5 + §1.6` · contrato.
- Regla de oro en `CLAUDE.md`.
