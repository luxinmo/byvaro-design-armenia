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
