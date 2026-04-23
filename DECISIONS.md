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
