# backend-integration.md · contrato de integración backend

> **Regla de oro**: cualquier feature nueva en frontend debe registrar
> aquí sus puntos de integración backend y dejar un `TODO(backend)` en
> el código apuntando a la sección correspondiente de este documento.
>
> **Audiencia**: agente/desarrollador backend que levante la API real
> para Byvaro. Este documento es la fuente única de verdad de:
>
> 1. Qué endpoints espera el frontend.
> 2. Qué forma tienen los modelos (multi-tenant).
> 3. Qué campos se persisten y cuáles son derivados.
> 4. Qué datos hoy viven en `localStorage` y deben migrarse.
> 5. Qué crons / jobs periódicos hacen falta.
> 6. Qué integraciones externas consumir (Google, SMTP, WhatsApp, …).

Última actualización: 2026-04-22.

---

## 0 · Arquitectura multi-tenant

Byvaro es multi-tenant. Cada **cuenta** (promotor o agencia) es una
`Empresa` (tenant) con sus usuarios, promociones, contratos y assets
públicos (logo, cover, web, etc.).

```
┌────────────────┐          ┌────────────────┐
│ Empresa        │          │ Empresa        │
│ id=t1          │          │ id=t2          │
│ (Promotor)     │          │ (Agencia)      │
│                │          │                │
│ logoUrl        │          │ logoUrl        │
│ coverUrl       │          │ coverUrl       │
│ promociones[]  │          │ mercados[]     │
└────────┬───────┘          └────────┬───────┘
         │                           │
         └────── Collaboration ──────┘
                 (id, estado, comisión,
                  contractSignedAt, …)
```

La entidad `Agency` que ve el promotor en su `/colaboradores` es una
**vista/join** sobre:

- La tabla `Empresa` (del tenant agencia) → `name, logo, cover, location, type, mercados, teamSize, googlePlaceId, …`
- La tabla `Collaboration` (relación con el promotor) → `estadoColaboracion, origen, contractSignedAt, contractExpiresAt, comisionMedia, registrosAportados, ventasCerradas, salesVolume, visitsCount, solicitudPendiente, …`

**⚠️ Implementación actual (mock)** — `src/data/agencies.ts` mezcla
ambas cosas en un único tipo `Agency`. Al implementar backend, separar:

- `GET /api/empresas/:id/public` → datos públicos del tenant.
- `GET /api/colaboradores` → array de collaborations enriquecidas con el
  bloque público de cada empresa.

---

## 1 · Auth & usuarios

| Endpoint | Propósito | TODO en código |
|---|---|---|
| `POST /api/v1/auth/register` | alta de cuenta (promotor / agencia) | `src/pages/Register.tsx:50,195,211` |
| `POST /api/v1/auth/login` | login email+password | `src/pages/Login.tsx:32,86` |
| `POST /api/v1/companies/join-request` | usuario se une a empresa ya existente | `src/pages/Register.tsx:52,195` |
| `GET  /api/v1/companies/lookup?domain=x` | resolver empresa por dominio email | `src/pages/Register.tsx:54` |
| `POST /api/auth/sign-out-everywhere` | cerrar sesión global | `src/pages/ajustes/zona-critica/cerrar-sesion.tsx:23` |
| `POST /api/me/change-password/request` | pedir código 2FA para cambio password | `src/pages/ajustes/seguridad/contrasena.tsx:176` |
| `POST /api/me/change-password/verify` | confirmar cambio password | `src/pages/ajustes/seguridad/contrasena.tsx:323` |
| `POST /api/me/2fa/setup` | generar secret TOTP + QR | `src/pages/ajustes/seguridad/dos-fa.tsx:102` |
| `POST /api/me/2fa/activate` | activar 2FA con código | `src/pages/ajustes/seguridad/dos-fa.tsx:130` |
| `POST /api/me/2fa/verify` | validar código 2FA en login | `src/lib/twoFactor.ts:87` |
| `POST /api/me/2fa/disable` | desactivar 2FA | `src/pages/ajustes/seguridad/dos-fa.tsx:166` |
| `POST /api/me/2fa/backup-codes/regenerate` | regenerar backup codes | `src/pages/ajustes/seguridad/dos-fa.tsx:182` |
| `POST /api/organization/invitations` | invitar miembro a la cuenta (con rol) | `src/pages/ajustes/usuarios/miembros.tsx:59` |
| `POST /api/workspace/roles/:role/permissions` | editar permisos de rol | `src/pages/ajustes/usuarios/roles.tsx:13` |
| `DELETE /api/me` | eliminar cuenta propia (anonimizar) | `src/pages/ajustes/zona-critica/eliminar-cuenta.tsx:32` |
| `DELETE /api/organization` | borrar workspace completo | `src/pages/ajustes/zona-critica/eliminar-workspace.tsx:48` |
| `POST /api/organization/transfer` | transferir ownership | `src/pages/ajustes/zona-critica/transferir.tsx:45` |
| `PATCH /api/me { locale }` | cambiar idioma | `src/pages/ajustes/idioma-region/idioma.tsx:114` |
| `PATCH /api/organization { currency }` | cambiar moneda | `src/pages/ajustes/idioma-region/moneda.tsx:211` |

**Nota TOTP**: el secret NO debe vivir nunca en el cliente (`src/lib/totp.ts:35`, `src/lib/twoFactor.ts:21`). Actualmente es mock localStorage.

**Nota permisos**: hoy todos los permisos son lado cliente (`src/lib/permissions.ts:8`). En backend, cada endpoint valida server-side por rol (owner/admin/manager/agent/viewer).

---

## 2 · Empresa (perfil del tenant)

**Tipo completo**: `src/lib/empresa.ts:32` (interface `Empresa`).

**Storage actual**: localStorage bajo clave `byvaro-empresa`.

### Endpoints esperados

| Endpoint | Propósito |
|---|---|
| `GET /api/empresa` | perfil completo del tenant logueado |
| `PATCH /api/empresa` | update parcial del perfil |
| `GET /api/empresas/:id/public` | perfil público (para enriquecer cards de colaborador en OTRO promotor) |
| `POST /api/empresa/logo` | upload de logo (circular, ≥256×256) → devuelve `logoUrl` |
| `POST /api/empresa/logo-rect` | upload de wordmark rectangular (~250×100) → `logoRectUrl` |
| `POST /api/empresa/cover` | upload de cover (portada) → `coverUrl` |
| `GET /api/empresa/oficinas` | lista de oficinas del tenant |
| `POST /api/empresa/oficinas` | crear oficina |
| `PATCH /api/empresa/oficinas/:id` | editar oficina |
| `DELETE /api/empresa/oficinas/:id` | borrar oficina (regla: si es `esPrincipal`, promover otra automáticamente) |

### Google Places API (rating público)

Ver detalle en sección **#8 · Integraciones externas**.

Endpoints dedicados:
- `POST /api/empresa/google-place { mapsUrl }` → resuelve `place_id` y dispara primer fetch.
- Cron interno semanal que llama a Places Details y actualiza `googleRating`, `googleRatingsTotal`, `googleFetchedAt`.

TODOs: `src/components/empresa/GoogleRatingCard.tsx:16`.

---

## 3 · Promociones

**Tipo**: `src/data/promotions.ts` (`Promotion`) + `src/data/developerPromotions.ts` (`DevPromotion` extiende `Promotion`).

### Endpoints

| Endpoint | Propósito | TODO |
|---|---|---|
| `GET /api/promociones` | listar con filtros | — |
| `GET /api/promociones/:id` | detalle | — |
| `POST /api/promociones` | crear (con `WizardState`) | `src/pages/CrearPromocion.tsx` |
| `PATCH /api/promociones/:id` | actualizar | — |
| `POST /api/promociones/:id/publish` | publicar (requiere `missingSteps.length === 0`) | `src/pages/PromocionDetalle.tsx:537,563` |
| `GET /api/promociones?estado=borrador` | listar borradores del user | `src/lib/promotionDrafts.ts:12` |
| `POST /api/promociones/borradores` | guardar borrador | idem |
| `DELETE /api/promociones/borradores/:id` | eliminar borrador | idem |
| `GET /api/promociones/:id/units` | listar unidades (paginado) | `src/components/promotions/detail/PromotionAvailabilityFull.tsx:59` |
| `PATCH /api/units/bulk` | edición masiva atómica | idem:60 |
| `PATCH /api/units/:id` | editar unidad | `src/components/promotions/detail/UnitDetailPanel.tsx:49` |
| `POST /api/units/:id/reservations` | crear reserva | idem:50 |
| `GET /api/units/:id/media` | media (planos, fotos, tour) | idem:52 |
| `PATCH /api/promociones/:id/blocks/:block` | renombrar bloque | `PromotionAvailabilityFull.tsx:65` |
| `GET /api/promociones/:id/gallery` | galería (5+ imágenes) consumida por el mosaic + `ImageLightbox` en `PromocionDetalle.tsx:368` | — |
| `GET /api/promociones/:id/brochure` | URL del PDF oficial · 404 si no existe (la acción rápida "Brochure" queda deshabilitada) | `PromocionDetalle.tsx` (state `brochureRemoved`) |
| `POST /api/promociones/:id/brochure` | subir/reemplazar brochure | `EditDocumentDialog` con key `"brochure"` |
| `DELETE /api/promociones/:id/brochure` | eliminar brochure | kebab de la card Brochure · debe dejar la promo sin brochure (UI oculta la sección y deshabilita la acción rápida) |
| `GET /api/promociones/:id/availability-summary` | resumen de disponibilidad | `PromotionAvailabilitySummary.tsx:32` |
| `GET /api/promociones/:id/export` | descarga ficha PDF | `PromotionAvailabilityFull.tsx:66` |
| `POST /api/promociones/:id/notify-collaborators` | aviso masivo nuevas unidades | idem:61 |
| `POST /api/promociones/:id/share-clients` | aviso a clientes registrados | idem:63 |
| `POST /api/promociones/:id/units/:ref/drive-folder` | crear carpeta Drive | `src/components/crear-promocion/UnitSimpleEditDialog.tsx:171` |
| `GET /api/promociones/:id/anejos` | listado de anejos sueltos (parkings/trasteros) · consumido por el segmento "Anejos" de Disponibilidad | `src/data/anejos.ts` · `PromotionAnejosTable.tsx` |
| `PATCH /api/anejos/:id` | editar anejo (precio, estado, cliente) | idem |
| `POST /api/anejos/:id/reservations` | iniciar compra / reservar anejo | idem |
| `POST /api/anejos/:id/email` | enviar ficha de anejo por email | idem |

**Campos derivados a calcular en backend** (no duplicar en DB):
- `priceMin/Max` → `MIN/MAX(units.price)`.
- `availableUnits` → `COUNT(units WHERE status='available')`.
- `constructionProgress` → desde `faseConstruccion`.

### 3.1 · Anejos sueltos

Entidad paralela a `Unit` para parkings y trasteros que se venden **por
separado** (no incluidos en el precio de la vivienda). Modelo en
`src/data/anejos.ts`:

```ts
type Anejo = {
  id: string;                  // interno
  promotionId: string;
  publicId: string;            // "P1", "T3"
  tipo: "parking" | "trastero";
  precio: number;              // EUR
  status: "available" | "reserved" | "sold" | "withdrawn";
  clientName?: string;
  agencyName?: string;
  reservedAt?: string;         // ISO
  soldAt?: string;             // ISO
};
```

Origen de los datos: los crea el wizard `CrearUnidadesStep` en el
campo "Anejos sueltos" cuando `trasterosAdicionales > 0` o
`parkingsAdicionales > 0` (calculado como `total - (units ×
incluidosPorVivienda)` cuando `incluidosPrecio === true`).

**Persistencia backend**: al publicar la promoción, generar N filas en
la tabla `anejos` a partir de `state.parkings` / `state.trasteros` y
los arrays `parkingPrecios` / `trasteroPrecios`. Los estados arrancan
todos como `available`. `publicId` se autogenera (P1..Pn, T1..Tn).

**UI consumidora**: `PromotionAnejosTable.tsx`. Solo se muestra si la
promoción tiene anejos (el segmento "Anejos" en la toolbar de
Disponibilidad aparece condicionalmente).

---

## 4 · Colaboradores (agencias)

**Tipo**: `src/data/agencies.ts` (`Agency`). Helper `getContractStatus()`.

### Endpoints

| Endpoint | Propósito | Notas |
|---|---|---|
| `GET /api/colaboradores` | lista de agencias del promotor enriquecida con su `Empresa.public` | ver #0 sobre el join |
| `GET /api/colaboradores/:id` | ficha detalle · `/colaboradores/:id` | `src/pages/AgenciaDetalle.tsx` |
| `GET /api/promociones?collaboratingAgencyId=:id` | promos donde colabora una agencia | idem (bloque "Promociones compartidas") |
| `GET /api/colaboradores/estadisticas` | analítica agencia × {nacionalidad, promoción} · ver sub-sección 4.1 | `src/pages/ColaboradoresEstadisticas.tsx` · hoy mock inline |
| `POST /api/collaborators/:id/approve` | aprobar solicitud pendiente | `src/pages/Colaboradores.tsx:179` |
| `POST /api/collaborators/:id/reject` | rechazar solicitud | `src/pages/Colaboradores.tsx:184` |
| `POST /api/collaborators/:id/pause` | pausar colaboración | `src/pages/Colaboradores.tsx:200` |
| `POST /api/collaborators/:id/resume` | reanudar colaboración | idem |
| `GET /api/agencias/:id/email-contacto` | email de contacto para invitaciones | `src/components/promotions/SharePromotionDialog.tsx:203` |

### Campos clave del `Agency`

**Identidad (vienen del Empresa de la agencia):**
- `logo` (circular) → `Empresa.logoUrl`
- `logoRect` (wordmark) → `Empresa.logoRectUrl`
- `cover` → `Empresa.coverUrl`
- `name`, `location`, `type`, `description`, `offices[]`
- `teamSize` → calculado (COUNT users de ese tenant)

**Métricas operativas (calculadas por backend):**
- `visitsCount`, `registrations`, `salesVolume`, `ventasCerradas`, `registrosAportados`
- `conversionRate` = `ventasCerradas / registrosAportados * 100`
- `ticketMedio` = `salesVolume / ventasCerradas`
- `lastActivityAt` = MAX(fecha de último registro/visita/login)

**Relación con el promotor (`Collaboration` entity):**
- `estadoColaboracion`: `"activa" | "contrato-pendiente" | "pausada"`
- `origen`: `"invited" | "marketplace"`
- `comisionMedia`
- `promotionsCollaborating[]` (ids de promociones donde esa agencia está activa)
- `solicitudPendiente`, `mensajeSolicitud`

**Contrato:**
- `contractSignedAt` (ISO date)
- `contractExpiresAt` (ISO date, null = sin caducidad)
- `contractDocUrl` (PDF firmado)

Estado computed en frontend vía `getContractStatus(a)`:
- `"vigente"` · `"por-expirar"` (≤30 días) · `"expirado"` · `"sin-contrato"`

**Google Places (público, refrescado semanalmente por cron):**
- `googlePlaceId`, `googleRating`, `googleRatingsTotal`, `googleFetchedAt`, `googleMapsUrl`
- Ver #8 para detalles de integración.

**Evaluación interna del promotor:**
- `ratingPromotor` (1-5, subjetivo, no mostrado públicamente)
- `incidencias: { duplicados, cancelaciones, reclamaciones }` (counts)

### 4.1 · Recomendaciones de agencias

Endpoint `GET /api/colaboradores/recomendaciones`. Consumidor:
`src/pages/Colaboradores.tsx` vía `useAgencyRecommendations()` en
`src/data/agencyRecommendations.ts`. Hoy mock inline (sustituir entero).

**Propósito**: motor que sugiere al promotor agencias fuera de su red
con las que podría colaborar. Explota señal cross-tenant agregada
(actividad en sus zonas, nacionalidades complementarias, aprobación
histórica con promotores similares).

**Query params**:

```
?limit=8              // nº máximo de recomendaciones (default 8)
?zone[]=city          // opcional · fuerza zonas (default: zonas de sus promociones)
?nationality[]=ISO2   // opcional · fuerza mercados de interés
```

**Respuesta**:

```ts
Array<{
  id:         string;
  name:       string;
  logo:       string;
  location:   string;
  type:       "Agency" | "Broker" | "Network";
  mercados:   string[];       // ISO2 · nacionalidades que atiende
  zonasActivas: string[];     // ciudades donde es activa
  signal: {
    aprobacionPct:    number; // 0-100 · con promotores similares
    conversionPct:    number; // 0-100
    promotoresActivos:number; // agregado · NUNCA identifica quiénes
  };
  googleRating?: number;
  razon:    string;           // frase principal generada por el motor
  razones:  string[];         // razones secundarias (pills)
}>
```

**Criterios de matching** (a implementar en backend):

1. **Exclusión**: agencias ya colaborando con el promotor o con
   invitación pendiente.
2. **Solape de zonas**: al menos 1 `zonasActivas` coincide con una
   ciudad/provincia donde el promotor tiene promoción activa.
3. **Scoring** (composite 0-100):
   - Solape de nacionalidades en los mercados del promotor (peso 0.35).
   - Aprobación con promotores similares (obra nueva en España) (0.25).
   - Conversión histórica normalizada (0.2).
   - SLA respuesta (0.1).
   - Actividad reciente (último 30d) (0.1).
4. **Ranking**: top N por score.

**Reglas de privacidad (vinculantes)**:

- **Nunca exponer identidad de otros promotores.** `promotoresActivos`
  es un contador agregado — no devuelve lista de empresas.
- **"Promotores similares"** se define como: misma categoría (obra
  nueva), solape geográfico ≥1 provincia, tamaño similar (±50% en nº
  unidades activas). El frontend nunca ve este grupo.
- **Auditoría**: cada invocación del motor queda logueada con `promotor_id
  + agencias_devueltas` para auditar filtraciones.

**Fase 2 · email digest semanal** (pendiente, no en este endpoint):
cron semanal que, si hay ≥3 nuevas recomendaciones con score alto para
un promotor, envía email "Byvaro te sugiere 3 agencias esta semana" con
link a `/colaboradores`. Infra: misma SMTP que invitaciones (ver §5).
Opt-out por defecto activo, desde `/ajustes/notificaciones`.

---

### 4.2 · Estadísticas de colaboradores

Endpoint `GET /api/colaboradores/estadisticas`. Consumidor:
`src/pages/ColaboradoresEstadisticas.tsx`. Hoy mock inline (sustituir
todas las matrices y `AGENCY_META`).

**Query params** (todos multi-valor opcionales):

```
?nationality[]=ISO2       // filtra a ciertas nacionalidades
?promocion[]=promotionId  // filtra a ciertas promociones
?agency[]=agencyId        // filtra a ciertas agencias
```

**Nota**: sin `from/to` de fechas. El frontend no muestra trend histórico
todavía — cuando exista histórico real, ampliar contrato con rango.

**Respuesta**:

```ts
{
  agencies: Array<{
    id: string;
    name: string;
    city: string;
    meta: {
      aprobacionPct: number;   // 0-100 · % registros aprobados por promotor
      duplicados:    number;   // count absoluto detectados por la IA
      respuestaHoras:number;   // SLA medio 1ª respuesta
    };
  }>;
  nations: Array<{ id: string; name: string; label: string }>;     // ISO2 + español
  promotions: Array<{ id: string; code: string; name: string; city: string }>;

  matrices: {
    nacionalidad: {
      REG: Record<AgencyId, Record<NationId, number>>;  // registros
      VIS: Record<AgencyId, Record<NationId, number>>;  // visitas realizadas
      EFF: Record<AgencyId, Record<NationId, number>>;  // conversion % (0-100)
    };
    promocion: {
      REG: Record<AgencyId, Record<PromoId, number>>;
      VIS: Record<AgencyId, Record<PromoId, number>>;
      EFF: Record<AgencyId, Record<PromoId, number>>;
    };
  };
}
```

**Cómo calcular cada métrica (backend)**:

| Campo | Cálculo |
|---|---|
| `REG` | `COUNT(lead) WHERE agency_id=A AND <eje>=X` |
| `VIS` | `COUNT(visit) WHERE agency_id=A AND lead.<eje>=X AND visit.status='done'` |
| `EFF` | `COUNT(sale) / COUNT(lead) * 100` por cada celda (A × eje) |
| `meta.aprobacionPct` | `COUNT(lead WHERE approval_status='approved') / COUNT(lead) * 100` |
| `meta.duplicados` | `COUNT(lead WHERE duplicate_detected_at IS NOT NULL)` |
| `meta.respuestaHoras` | `AVG(first_response_at - created_at)` en horas |

**Lo que NO pide el endpoint** (derivado en cliente):
- `KPIs` totales (suma de matrices visibles).
- `insights` automáticos (3 mini-cards por tab).
- `oportunidades` (lista numerada en tab Eficiencia).

Las tres se derivan con reglas deterministas en
`ColaboradoresEstadisticas.tsx` (`deriveInsights` y `deriveOportunidades`).
Cuando el dataset crezca y las reglas se compliquen, mover al servidor
con endpoint dedicado `GET .../estadisticas/insights`.

---

## 5 · Compartir promoción · invitaciones

**Flujo completo en**: `docs/screens/compartir-promocion.md`.

**Tipo**: `src/lib/invitaciones.ts:21` (interface `Invitacion`). Ampliado con campos de share: `promocionId`, `promocionNombre`, `duracionMeses`, `formaPago[]`, `datosRequeridos[]`.

**Storage actual**: localStorage (`byvaro-invitaciones`). Sincronización cross-tab por storage event + CustomEvent.

### Endpoints

| Endpoint | Body / Query | Respuesta / Efectos |
|---|---|---|
| `POST /api/promociones/:id/share/check` | `{ email }` | `{ exists: boolean, agencyId?: string, agency?: AgencyPublic }` — resuelve si el dominio del email coincide con una agencia ya en Byvaro |
| `POST /api/promociones/:id/invitaciones` | ver body abajo | `{ invitacionId, token, acceptUrl, asunto, html }` — backend envía el email |
| `GET /api/promociones/:id/invitaciones?estado=pendiente` | — | `Invitacion[]` |
| `POST /api/invitaciones/:id/revocar` | — | marca como `rechazada` |
| `POST /api/invitaciones/:id/reenviar` | — | extiende `expiraEn` 30 días |
| `DELETE /api/invitaciones/:id` | — | hard delete |
| `GET /api/invitaciones?token=X` | — | resolver invitación por token (para landing de aceptación) |
| `POST /api/invitaciones/:id/aceptar` | — | agency crea cuenta y acepta → `Collaboration` activa |
| `POST /api/promociones/:id/compartir/activar` | `{ comision, duracionMeses }` | sube `canShareWithAgencies=true` + condiciones default |

**Body de invitación:**
```ts
{
  email: string,
  agencyId?: string,              // si existe ya en sistema
  agencyName?: string,            // nombre a mostrar si se teclea
  mensajePersonalizado?: string,
  comisionOfrecida: number,
  idiomaEmail: "es"|"en"|"fr"|"de"|"pt"|"it",
  promocionId: string,
  promocionNombre: string,
  duracionMeses: number,
  formaPago: PagoTramo[],         // [{tramo, completado, colaborador}]
  datosRequeridos: string[],      // ["Nombre completo", "Las 4 últimas cifras del teléfono", "Nacionalidad"]
}
```

**Reglas de negocio:**
- El token de aceptación expira a los 30 días (`VALIDEZ_DIAS`).
- La suma de `formaPago[].colaborador` debe ser 100%.
- Rechazo inline de dominios públicos (`gmail.com`, `hotmail.com`, …). Lista completa en `SharePromotionDialog.tsx:PUBLIC_EMAIL_DOMAINS`.
- Match por dominio: `Empresa.domain === email.split("@")[1]`.
- Cuando la agencia está "activada" para compartir (`canShareWithAgencies=true`), el frontend permite enviar invitaciones. Si no, los botones se deshabilitan (gate definido en ADR-033).

**Cross-sell** (paso posterior a enviar una invitación):
- Frontend sugiere otras promociones del promotor donde esa agencia aún no colabora.
- Backend recibe múltiples `POST /api/promociones/:id/invitaciones` con mismas condiciones.

### Plantilla HTML del email

Función actual: `getInvitacionHtml(data)` en `src/lib/invitaciones.ts`. Devuelve `{ asunto, html }` responsive (media queries inline). Preview estático: `email-previews/invitacion-agencia.html`.

**En producción**, el backend puede:
1. **Usar la misma plantilla** (llamar a la función desde Node), o
2. **Implementar plantilla propia** en su template engine y solo consumir los datos.

Datos necesarios para el render: ver `InvitacionEmailData` en `invitaciones.ts:280`.

Campos clave pasados al template:
- `promotorNombre`, `promotorLogo`
- `nombreAgencia`, `emailAgencia`
- `promocionNombre`, `promocionFoto`, `precioDesde`, `precioHasta`, `entrega`, `unidadesDisponibles`, `unidadesTotales`
- `comisionOfrecida`, `duracionMeses`, `formaPago[]`, `datosRequeridos[]`
- `mensajePersonalizado`
- `acceptUrl`, `expiraEnDias`

### Vistas que dependen

- **Promociones listado** → botón "Compartir" en cada card (`Promociones.tsx:967`).
- **Ficha de promoción** → 4 puntos de entrada: dock derecho, KPI Agencias, tab Agencias (header, empty state, sidebar).
- **Colaboradores** → las invitaciones pendientes se inyectan como filas sintéticas en la lista (helper `invitacionToSyntheticAgency` en `invitaciones.ts`).

---

## 6 · Favoritos de agencias

**Tipo**: `Set<string>` de `Agency.id`.

**Storage actual**: localStorage (`byvaro-favoritos-agencias`).

**Hook**: `useFavoriteAgencies()` en `src/lib/favoriteAgencies.ts`.

### Endpoints

| Endpoint | Propósito |
|---|---|
| `GET /api/promotor/favoritos` | lista de IDs de agencias marcadas como favoritas |
| `POST /api/promotor/favoritos/:id` | marcar favorita |
| `DELETE /api/promotor/favoritos/:id` | desmarcar |

Consumidores: `Colaboradores.tsx`, `ColaboradoresV2.tsx`, `ColaboradoresV3.tsx`, `SharePromotionDialog.tsx`, `SendEmailDialog.tsx`, `PromotionAgenciesV2.tsx`.

---

## 7 · Registros, ventas, contactos

### Registros

| Endpoint | TODO |
|---|---|
| `GET /api/records?status=&promotion=&agency=` | `src/pages/Registros.tsx:25` |
| `POST /api/records/:id/approve` | idem:26 |
| `POST /api/records/:id/reject` | idem:26 |
| `POST /api/records/bulk-approve { ids:[] }` | idem:27 |
| `POST /api/records/bulk-reject { ids:[] }` | idem:27 |
| `GET /api/records` paginado server-side | `src/data/records.ts:25` |

### Ventas

| Endpoint | TODO |
|---|---|
| `GET /api/sales?promotionId=&status=&from=&to=` | `src/pages/Ventas.tsx:13`, `src/data/sales.ts:15` |
| `PATCH /api/sales/:id/transition { to, meta? }` | `Ventas.tsx:14`, `sales.ts:16` |

### Contactos

| Endpoint | TODO |
|---|---|
| `GET /api/contacts/:id` → `ContactDetail` | `src/components/contacts/contactDetailMock.ts:9` |
| `PATCH /api/contacts/:id { tags }` | `src/components/contacts/contactTagsStorage.ts:9` |
| `POST /api/contacts/bulk` | `src/pages/ajustes/contactos/importar.tsx:14` |
| `GET /api/contacts/:id/whatsapp/messages` | `src/components/contacts/whatsappMessagesMock.ts:11` |
| `UPDATE contacts SET source=target WHERE source=deleted` | `src/pages/ajustes/contactos/origenes.tsx:104,109` |
| Autogen `ref` del contacto | `src/components/contacts/types.ts:42` |

---

## 8 · Integraciones externas

### 8.1 · Google Places API (rating público)

**Usado por**: empresa del promotor (`GoogleRatingCard`) y cada agencia.

**Flujo:**

1. Usuario pega URL de Google Maps en su perfil → `POST /api/empresa/google-place { mapsUrl }`.
2. Backend extrae `place_id` vía Places **Find Place / Text Search**.
3. Primer fetch con Places **Details (Atmosphere data)** → rating, ratingsTotal, photos, opening_hours.
4. **Cron semanal** refresca cada `place_id` (Places ToS: ≤30 días de cache).
5. Al refrescar actualiza `googleRating`, `googleRatingsTotal`, `googleFetchedAt`.

**Coste**:
- $200/mes de free tier Google Maps Platform.
- Places Details (Atmosphere) = $0.005/call. Con 500 agencias ≈ $10/mes.

**Restricciones ToS** (obligatorias):
- Refresco al menos cada 30 días (no cachear más).
- Atribución visible al mostrar rating: "Basado en reseñas de Google".
- No modificar el rating ni las reseñas.
- Link a la ficha pública de Maps cuando se muestre el rating.

**UI que ya cumple ToS**: `GoogleRatingBadge` en `ColaboradoresV3.tsx`, `GoogleRatingCard` en `empresa/`.

### 8.2 · WhatsApp Business (Baileys / Meta OAuth)

Ver `src/pages/ajustes/whatsapp/numero.tsx:10` + `src/lib/whatsappStorage.ts:10`.

Endpoints esperados:
- `POST /api/whatsapp/connect { mode: "oauth" | "qr" }` → URL OAuth o stream de QR.
- `POST /api/whatsapp/disconnect`.
- `GET /api/whatsapp/status` → `{ connected, number, lastSeen }`.
- `POST /api/contacts/:id/whatsapp/messages` → envío.

Generación de QR real va contra Baileys o WPPConnect (`ContactWhatsAppTab.tsx:284`).

### 8.3 · Email transaccional

Plantillas HTML actuales que el backend debe renderizar o reemplazar:

- `getInvitacionHtml()` — invitaciones a agencia (detallado en #5).
- `getEmailPreview()` — versión texto plano (legacy, 6 idiomas) — `invitaciones.ts:137`.
- `src/components/email/emailTemplates.ts` — plantillas del Compose (last-unit, new-launch, new-availability, blank).

Endpoint:
- `POST /api/emails/send { to, subject, html, templateId?, variables? }` → cola SendGrid/Resend/Postmark/SMTP.
- Webhook de entrega → `GmailInterface.tsx:81` mock.

### 8.4 · Storage (logos, covers, PDFs)

Hoy: los uploads son `data:` URLs en localStorage (`ImageCropModal.tsx`).

En prod: S3 / Cloudflare R2 / Vercel Blob.

Endpoints:
- `POST /api/upload { file, kind: "logo" | "cover" | "contract" | "unit-media" }` → devuelve `{ url, size, mime }`.

### 8.5 · Google Drive (carpetas de unidad)

`UnitSimpleEditDialog.tsx:171`: `POST /api/promociones/:id/units/:ref/drive-folder` crea carpeta Drive con el `ref` de la unidad como nombre.

### 8.6 · Microsites

`src/pages/Microsites.tsx` + `src/data/microsites.ts`.

- `GET /api/v1/microsites` (por `companyId`).
- `PATCH /api/v1/microsites/:id` (patch).
- `PATCH /api/v1/microsites/:id/theme`.
- `POST /api/v1/microsites/:id/domain` (custom domain).

---

## 9 · Crons / jobs periódicos

| Job | Frecuencia | Propósito |
|---|---|---|
| `refresh-google-places` | semanal | actualiza rating/reseñas de cada `googlePlaceId` |
| `expire-invitations` | diario | marca invitaciones pendientes con `expiraEn < now()` como `caducada` |
| `expire-contracts` | diario | notifica a promotor 30/7/0 días antes de `contractExpiresAt`; pasa a `expirado` al vencer |
| `recompute-agency-metrics` | horario / diario | calcula `conversionRate`, `ticketMedio`, `lastActivityAt` |
| `drafts-cleanup` | mensual | borra borradores abandonados >6 meses |

---

## 10 · Estándares del contrato

### Nomenclatura
- Rutas REST en **kebab-case** plural: `/api/promociones`, `/api/colaboradores`, `/api/invitaciones`.
- IDs: string, formato libre pero único (`dev-1`, `ag-3`, `inv-xxx`).

### Formatos
- Fechas ISO 8601 (`"2026-04-22"` o `"2026-04-22T14:30:00Z"`).
- Dinero: número entero en céntimos, o float EUR (consistente por endpoint). Actualmente frontend usa EUR float (`Intl.NumberFormat`).
- Porcentajes: número 0-100 (no 0-1).

### Errores
- `400` validation con `{ error, field?, message }`.
- `403` cuando falta permiso (rol insuficiente).
- `409` conflict en invariantes (p.ej. `canShareWithAgencies=false` al intentar invitar).
- `422` para fallos de dominio específicos (`LOCKED_CONTRACT`, `PROMOTION_NOT_PUBLISHED`).

### Paginación
- Query `?page=1&pageSize=20`.
- Respuesta `{ data: [], page, pageSize, total }`.

### Permisos
Ya documentado conceptualmente en `src/lib/permissions.ts:8`. Cuando exista backend:
- Middleware por endpoint que verifica `req.user.role` vs `required_permissions`.
- Owner / Admin / Manager / Agent / Viewer.

---

## 11 · Checklist para nuevas features

Cuando se añade una feature en frontend que requiera backend:

- [ ] Añadir bloque `TODO(backend): ...` en los archivos que tocan storage local o mock data.
- [ ] Registrar los nuevos endpoints en este documento bajo la sección adecuada.
- [ ] Si la feature introduce un modelo nuevo, describirlo en `docs/data-model.md`.
- [ ] Si altera una relación entre entidades (p.ej. una tabla de join como `Collaboration`), documentar aquí en la sección #0.
- [ ] Si añade integración externa, registrarla en #8.
- [ ] Si requiere job periódico, añadir a la tabla de #9.
- [ ] Si cambia el contrato UI↔API de una feature existente, actualizar `docs/api-contract.md` Y este doc.
- [ ] Añadir ADR en `DECISIONS.md` para decisiones no triviales.

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-04-22 | Documento creado — consolida todos los `TODO(backend)` existentes. |
