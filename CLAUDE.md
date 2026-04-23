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

1. **Empieza por `docs/backend-integration.md`** — es la **fuente única
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
