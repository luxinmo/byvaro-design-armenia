# Flujo · Compartir promoción con agencia

## Propósito

Desde la lista de promociones (`/promociones`), el promotor puede compartir
una promoción con una agencia (existente o nueva). El flujo crea una
**invitación pendiente** que se refleja automáticamente en:

1. `/colaboradores` — la agencia aparece como fila con estado
   "Contrato pendiente".
2. Ficha de promoción · tab **Agencias** — sección "Invitaciones pendientes"
   arriba con las invitaciones enviadas para esa promoción.

**Audiencia:** solo Promotor.

**Puntos de entrada (todos abren el mismo `SharePromotionDialog`):**

- Lista de promociones · `Promociones.tsx:969` — botón "Compartir con
  agencias" en cada card.
- Ficha de promoción · `PromocionDetalle.tsx` action dock derecho — botones
  "Invitar agencias" y "Compartir" (solo si la promoción está publicada).
- Ficha de promoción · tab **Agencias** — botón flotante "Invitar agencia"
  de `PromotionAgenciesV2` vía la prop `onInviteAgency`.

---

## Flujo

Componente: `src/components/promotions/SharePromotionDialog.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  PASO 0 · CHOOSE · ¿Con quién compartir?                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Nueva        │  │ Mis          │  │ Mis          │    │
│  │ invitación   │  │ colaboradores│  │ favoritos    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼──────────────────┼───────────┘
          ▼                 ▼                  ▼
   STEP · EMAIL       STEP · PICK          STEP · PICK
   (email + nombre    (buscador;           (buscador;
    opcional)          solo FAV ids)        status=active)
          │                 │                  │
          ▼                 ▼                  ▼
           STEP · CONDITIONS (comisión, duración,
           forma de pago, datos obligatorios)
                           │
                           ▼
                Enviar invitación → invitar()
                → toast + cierre + sincroniza store
```

### Paso 0 · Choose

3 cards `UserPlus` / `Users` / `Star`:

- **Nueva invitación** → `step="email"`.
- **Mis colaboradores** → `step="pick"`, `pickSource="collaborators"`
  (filtro `agencies` con `status === "active"`).
- **Mis favoritos** → `step="pick"`, `pickSource="favorites"` (filtro
  por los IDs de `useFavoriteAgencies().ids`, store central en
  `src/lib/favoriteAgencies.ts`).

En ambas fuentes (colaboradores y favoritos) se **excluyen del picker
las agencias que ya colaboran en esta promoción** (`promotionsCollaborating`
incluye `promotionId`).

**Claridad en el paso Choose**: las cards de "Mis colaboradores" y
"Mis favoritos" muestran en el título un **badge con el contador** de
agencias disponibles (las que aún no colaboran) y una descripción
dinámica del tipo "3 agencias colaboradoras que aún no tienen esta
promoción · 2 ya colaboran". El subtítulo del paso hace la promesa
global visible: "Solo se muestran agencias que aún no colaboran en
esta promo".

Si una fuente tiene **0 disponibles** (porque todas ya colaboran), la
card queda **deshabilitada** con badge "sin disponibles" y copy
explícito ("Todos tus colaboradores ya colaboran en esta promoción") —
no se puede entrar al picker sin sentido.

Dentro del paso pick se muestra también un aviso discreto encima de
la lista indicando cuántas han quedado ocultas. Si **todas** las
agencias de la fuente ya colaboran en la promo, el picker renderiza
estado vacío con copy específico.

### Paso · Email

Entrada de `email corporativo` + `nombreAgencia` (opcional).

**Validaciones:**

- Formato email RFC mínimo (`x@y.z`).
- Rechazo inline de dominios públicos (`gmail.com`, `hotmail.com`, …).
  Lista en `PUBLIC_EMAIL_DOMAINS`. Motivo: buscamos email corporativo
  para que el motor pueda detectar si el dominio coincide con una agencia
  ya en el sistema.
- Detección por dominio: `allAgencies.find(a => nameSlug includes domain)`.
  Si hay match, `handleContinue` redirige al paso **matched** (confirma
  la empresa detectada antes de las condiciones). Si no hay match, se
  salta directamente a **conditions**.

### Paso · Matched (solo si el dominio hace match con agencia existente)

Paso intermedio que confirma al usuario que la agencia ya está en Byvaro:

- Título centrado "Hemos encontrado esta empresa".
- Card `bg-muted rounded-2xl` con logo (h-20 w-20 rounded-full, ring-card)
  + nombre de la agencia + email enmascarado (`a***n@dominio.com` vía
  helper `maskEmail()`).
- Texto explicando que la notificación se enviará al email tecleado
  **y** al contacto principal de la agencia.
- CTA "Continuar" → `conditions`.
- Botón ← Volver al paso email.

### Paso · Pick (grid multi-select)

**Al entrar, TODAS las agencias disponibles quedan preseleccionadas.**
La mecánica es de descarte: el promotor desmarca las que no quiere,
no de búsqueda uno-a-uno. Motivo: "compartir con todos mis
colaboradores" es el caso común al lanzar una promoción nueva.

- **Dialog ensanchado** a `max-w-[1040px]` solo en este paso.
- **Header sticky**: Volver · título · descripción ("Vas a compartir
  X con las seleccionadas") · nota de agencias ocultas si las hay ·
  dropdown **Ordenar** · botón "Seleccionar todas / Desmarcar todas".
- **Grid responsive** `1 col / sm:2 / lg:3`. Primer renderizado =
  **12 cards** (4 filas de 3 en desktop). Botón "Ver N más · M
  restantes" añade **6 cards** (2 filas) por click.
- **Orden**: `Más registros / Menos registros / Más ventas / Menos
  ventas / Nombre A-Z`. Default: más registros.
- **Card** (`SelectableAgencyCard`): cover 80px, logo, nombre,
  ubicación, banderas de mercados (max 5 + N), stats grid
  `Visitas · Registros · Ventas`, meta `Desde X · N agentes`.
  Selección: card completa clickable · indicador circular con check
  arriba a la derecha. Desmarcadas quedan con `opacity-70`.
- **Footer sticky**: contador "N de M seleccionadas" + CTA
  "Continuar (N)". Si `selCount === 0`, CTA deshabilitado.

Al pasar a `conditions`, el picker mantiene `selectedAgencyIds`
(`Set<string>`). Si el usuario vuelve al grid desde conditions, no
pierde la selección.

### Paso · Cross-sell (tras enviar)

Después del `invitar()` principal, el modal NO cierra: transiciona al paso
`crosssell` para ofrecer compartir más promociones con la misma agencia en
una sola operación.

- Header sticky · "Invitación enviada" + nombre agencia + X.
- Banner de éxito verde confirmando la primera invitación + resumen de
  condiciones.
- Lista de **otras promociones** del promotor donde esa agencia aún no
  colabora ni tiene invitación (filtro: `status === "active"` ∧ ¬
  `matchedAgency.promotionsCollaborating` ∧ `p.id !== promotionId` actual).
  Cada row lleva:
  - Checkbox tipo `rounded-md` (activo = `bg-foreground` con check blanco).
  - Thumb (`image`) + nombre + localización + entrega + unidades.
- Botón "Seleccionar todas / Quitar selección" si hay >1.
- Footer sticky · ghost "Saltar" + primary pill
  `Invitar a N promoción/es` (deshabilitado si 0 seleccionadas).
- Al invitar en bulk se llama `invitar()` N veces reutilizando las
  mismas condiciones (comisión, duración, forma de pago, datos
  obligatorios). Toast único con contador.
- Empty state si la agencia ya está en todo tu catálogo.

### Paso · Conditions

**Sticky header** con breadcrumb (agencia · promoción) + botón Back + X.

- **Modo single** (venido de email/matched): breadcrumb = "Agencia ·
  Promoción", CTA = "Enviar la invitación", tras envío → `crosssell`.
- **Modo multi** (venido de pick con N≥1 seleccionadas):
  - Título: `Condiciones para N agencias`, subtítulo: `Promoción ·
    mismas condiciones para todas`.
  - Encima del CTA, avatar-stack con los logos de las primeras 6
    agencias seleccionadas + `+N` · nombre si es solo 1.
  - CTA: `Enviar N invitaciones` → crea N invitaciones con las mismas
    condiciones iterando `invitar()`. Cierra el modal (sin
    crosssell) con toast único "N invitaciones enviadas".
  - Botón Back vuelve al grid multi-select · la selección se
    preserva.

**Campos** (todos con patrón **reposo / hover-lápiz / click-editar**
vía `<InlineEditNumber>`):

- **Comisión por venta** · default 5%, rango 0-100.
- **Duración** · chips 1/2/3/6/12 meses + Personalizado. Default 12.
- **Forma de pago al colaborador** · tabla editable de tramos; el botón
  "✎ Editar" arriba activa los botones añadir/eliminar tramo. La suma
  de `colaborador` debe ser 100% o el CTA se deshabilita.
- **Datos obligatorios** · checklist fijo: "Nombre y apellidos",
  "Las 4 últimas cifras del teléfono", "Nacionalidad".

---

## Persistencia

`handleSendInvitation` llama a `useInvitaciones().invitar(data)` del hook en
`src/lib/invitaciones.ts`. Cada invitación se guarda en
`localStorage` bajo clave `byvaro-invitaciones` con:

```ts
{
  id, token,                       // token único para el magic-link
  emailAgencia, nombreAgencia,
  mensajePersonalizado,
  comisionOfrecida,
  idiomaEmail: "es" | "en" | ...,
  estado: "pendiente" | "aceptada" | "rechazada" | "caducada",
  createdAt, expiraEn,             // caducidad: 30 días
  /* --- campos compartir promoción --- */
  promocionId, promocionNombre,
  duracionMeses,
  formaPago: PagoTramo[],
  datosRequeridos: string[],
}
```

### Sincronización cross-tab

- `storage` event + `CustomEvent("byvaro:invitaciones-changed")` para
  refrescar cualquier vista abierta.

### Visualización

El hook exporta `invitacionToSyntheticAgency(inv): Agency` que convierte
una invitación pendiente en una fila sintética con `status: "pending"`,
`estadoColaboracion: "contrato-pendiente"`, `origen: "invited"`.

**Dónde se consume:**

- `src/pages/Colaboradores.tsx` — fusiona las sintéticas con `baseAgencies`
  en el `useMemo` de `agencies`. Aparecen en el grid con el badge
  "Contrato pendiente" y en el contador de pendientes.
- `src/components/promotions/detail/PromotionAgenciesV2.tsx` — sección
  "Invitaciones pendientes" arriba, filtrando por `promocionId === p.id`.

---

## Email HTML

Plantilla en `getInvitacionHtml()` (`src/lib/invitaciones.ts`). Devuelve
`{ asunto, html }` listo para pasar al proveedor de envío.

**Estructura:**

1. **Hero** · foto de la promoción (`promocionFoto`) con gradiente y
   título superpuesto. Badge "BYVARO · INVITACIÓN".
2. **Invitador** · logo/inicial del promotor + "Invitación de {promotor}".
3. **Título H1** · "Hola {agencia}, {promotor} te invita a colaborar en
   {promoción}".
4. **Detalles de la promoción** · cards `rounded-xl` con Precio desde-hasta
   y Entrega.
5. **Pill unidades disponibles** · verde (`bg-[#E8F5EC]`), "N de M unidades
   disponibles".
6. **Mensaje personalizado** · blockquote si lo hay.
7. **Comisión destacada** · 5% en big type, "IVA incluido".
8. **Duración** + **Validez del link** · 2 cards.
9. **Tabla Forma de pago** · tramos Completado / Colaborador.
10. **Datos obligatorios** · checklist ✓.
11. **CTA "Ver invitación"** · pill azul, link fallback copiable.
12. **Footer legal** · mención de Byvaro + por qué recibe el email.

### Responsive

Tablas + inline styles + `<style>` con media queries en `<head>`:

- **≤640px** · card edge-to-edge (sin border-radius ni bordes laterales),
  `.inner-pad` reduce padding horizontal a 16px, `col-stack` apila las
  2-cols en vertical, CTA full-width.
- **≤420px** · H1 a 17px, hero a 160px.

Soporte probado en: Gmail web, Gmail app, Apple Mail, iOS Mail, Outlook
web. En Outlook desktop Windows las media queries se ignoran (se queda
con 640px + layout desktop, que también encaja).

Preview estático: `email-previews/invitacion-agencia.html`.

---

## Contrato de API (TODO backend)

```
POST /api/promociones/:id/share/check
  body: { email }
  → { exists: boolean, agencyId?: string }

POST /api/promociones/:id/invitaciones
  body: {
    email, agencyId?, agencyName?,
    comision, duracionMeses,
    formaPago: PagoTramo[],
    datosRequeridos: string[],
    idiomaEmail: "es" | "en" | ...,
  }
  → { invitacionId, acceptUrl, asunto, html }
  // El backend se encarga de persistir, renderizar el HTML y enviar.

GET /api/promociones/:id/invitaciones?estado=pendiente
  → Invitacion[]

GET /api/colaboradores/mios                (para paso "Mis colaboradores")
GET /api/promotor/favoritos                (para paso "Mis favoritos")
GET /api/agencias/:id/email-contacto       (email default de agencia existente)
```

---

## Condiciones para permitir compartir

Una promoción solo se puede compartir si:

1. Está **publicada** (`p.status === "active"`).
2. No tiene **pasos pendientes** (`missingSteps.length === 0` en el listado, `!isIncomplete` en la ficha).
3. Tiene **compartir activado** (`p.canShareWithAgencies !== false`, o un
   override local tras activarlo desde el popup).

Si alguna falla, los puntos de entrada se muestran **visibles pero
deshabilitados** con tooltip informativo:

- Lista `/promociones` · botón "Compartir con agencias" gris + tooltip
  indicando el motivo.
- Ficha · action dock derecho · botones con `opacity-50 cursor-not-allowed`
  y hint "Activa compartir en la tab Comisiones".
- Ficha · tab Agencias · botones "Invitar agencia" (header, empty state,
  sidebar) con `disabled` + estilos atenuados.

## Activar compartir desde la tab Comisiones

Cuando `canShareWithAgencies === false`, la tab **Comisiones** de la ficha
muestra un banner ámbar arriba del todo:

> ⚠ Compartir con agencias está desactivado
> Mientras esté desactivado, no puedes invitar ni compartir esta promoción.

Con un botón **"Activar compartir"** (`bg-primary`) que abre
`ActivateSharingDialog`:

- Campo **Comisión** editable (por defecto `p.collaboration.comisionInternacional` o `p.commission` o 5%).
- **Duración por defecto** en chips 1/3/6/12 meses (default 12).
- Botones Cancelar + Activar compartir (`bg-primary`).
- Al activar: dispara `onActivate({ comision, duracionMeses })` que en la
  página hace `setCanShareOverride(true)` + toast de éxito.

Override local (session-only); cuando exista backend será
`POST /api/promociones/:id/compartir/activar`.

## Estándares de UI

- **Botones primarios de CTA** en todos los pasos: `h-10 rounded-full
  text-sm bg-primary text-primary-foreground shadow-soft` (full-width en
  pasos tipo modal-card). Unificado para dar el mismo peso visual.
- **Back button** en todos los pasos secundarios: pill ghost
  `text-xs text-muted-foreground hover:text-foreground` con icono
  `ArrowLeft h-3.5`.
- **Header sticky** solo en `conditions` (el paso más denso). Los otros
  pasos tienen back button en el flujo normal.

## Edge cases & decisiones

- **Comisión editable con lápiz en hover** — permisos no resueltos aún.
  Cuando haya roles (`canEditConditions`), se gatea la aparición del lápiz.
- **Dominios públicos** — rechazados inline con aviso rojo; el CTA se
  deshabilita hasta que se use corporativo.
- **Nombre agencia opcional** — si falta, el email llega sin nombre visible
  y en la lista de Colaboradores aparece con el email como identificador.
  Se muestra aviso ayuda bajo el input.
- **Agencia ya en sistema** — al detectar match por dominio, el destinatario
  del email se compone como `contacto@<slug>.com` hasta que el backend
  resuelva el email de contacto real.
- **Unidades disponibles** — se muestra como pill verde bajo precio/entrega
  si se pasa `unidadesDisponibles`. Opcional `unidadesTotales` para mostrar
  "N de M".
