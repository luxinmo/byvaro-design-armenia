# Modelo de datos · Byvaro v2

Entidades del dominio + tipos TypeScript + reglas de negocio.

> Los tipos TS canónicos están en `src/data/*.ts`, `src/types/*.ts` y
> `src/components/crear-promocion/types.ts`. Este documento los **explica**
> pero no los **define** — para el contrato de datos, leer el código.

## 🛡️ Ownership y visibilidad

Las entidades transaccionales del workspace llevan un array
`assignedTo: string[]` (userIds) que el sistema de permisos usa para
filtrar `viewOwn` vs `viewAll`. Aplica a:

- `Contact` — agentes asignados al contacto.
- `Registro` — agente que captó el lead.
- `Oportunidad` — agente que la trabaja.
- `Venta` — agente que la cerró.
- `Visit` — agente que la realizó.
- `Document` — heredado del `assignedTo` del contacto dueño.
- `Email` — usuario propietario de la cuenta + delegados.

**En BD**: columna `assigned_to UUID[] NOT NULL DEFAULT '{}'` con
índice GIN. Catálogo completo de keys, defaults por rol, RLS policies
y JWT claims en `docs/permissions.md`.

## Entidades principales

### Empresa (Company / Tenant)

Cuenta raíz. Cada empresa tiene una o varias promociones.

```ts
interface Company {
  id: string;
  name: string;
  logo?: string;
  taxId: string;         // CIF
  address: string;
  billing: BillingInfo;
  plan: "starter" | "pro" | "enterprise";
  createdAt: Date;
}
```

Relaciones: 1 Company → N Users, N Promociones.

### Usuario

Miembro del equipo de una empresa.

```ts
interface User {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: "owner" | "comercial" | "asistente";
  avatar?: string;
  permissions: {
    canRegister: boolean;
    canShareWithAgencies: boolean;
    canEdit: boolean;
  };
}
```

### Promoción (Promotion)

Proyecto inmobiliario. **Entidad central** del sistema.

Tipo canónico: `src/data/promotions.ts` → `Promotion` + extensión
`src/data/developerPromotions.ts` → `DevPromotion`.

Campos principales:

```ts
type PromotionStatus = "active" | "incomplete" | "inactive" | "sold-out";
type BuildingType = "plurifamiliar" | "unifamiliar-single" | "unifamiliar-multiple";

interface Promotion {
  id: string;
  code: string;              // referencia humana "PRM-0050"
  name: string;
  location: string;
  priceMin: number;
  priceMax: number;
  availableUnits: number;
  totalUnits: number;
  status: PromotionStatus;
  reservationCost: number;
  delivery: string;          // "Q3 2026"
  commission: number;        // % base
  developer: string;         // nombre empresa promotora
  agencies: number;          // cuántas colaboran
  agencyAvatars: string[];   // URLs
  propertyTypes: string[];
  image?: string;
  badge?: "new" | "last-units";
  collaborating?: boolean;   // ¿la empresa actual participa?
  updatedAt: string;         // texto humano "hace 2h"
  constructionProgress?: number;  // 0-100
  hasShowFlat?: boolean;
  buildingType?: BuildingType;
  activity?: {
    inquiries: number;
    reservations: number;
    visits: number;
    trend: number;           // -100..+100 (varía demanda)
  };
}

// Extension: DevPromotion = Promotion & { collaboration, comerciales, puntosDeVenta, missingSteps }
```

**Reglas de negocio:**
- `availableUnits <= totalUnits`
- `priceMin <= priceMax`
- Si `missingSteps` tiene elementos, la promo no puede publicarse
- Si `canShareWithAgencies === false`, no se puede invitar agencias
- Si `activity.trend >= 50`, se marca como "Trending" (ver `TRENDING_THRESHOLD`)

### Unidad (Unit)

Item vendible dentro de una promoción (piso, villa, local).

```ts
interface Unit {
  id: string;
  promotionId: string;
  block: string;             // "A", "B"
  floor: number;
  door: string;              // "1", "2", "Dcha"
  type: "Piso" | "Ático" | "Dúplex" | "Villa" | "Local" | "Chalet";
  bedrooms: number;
  bathrooms: number;
  builtArea: number;         // m² construidos
  terrace: number;           // m² terraza
  orientation: string;       // "Sur", "Este-Oeste", etc.
  price: number;
  status: "available" | "reserved" | "sold" | "blocked";
  reservedBy?: string;       // agencyId si reservada
  soldAt?: Date;
  photos: string[];
}
```

Datos: `src/data/units.ts` → `unitsByPromotion[promotionId]`.

**Reglas:**
- Vista Agencia solo ve `status === "available"`
- Para unifamiliar, el campo "planta" se muestra como "parcela"
- Una unidad con `status === "sold"` no puede volver a reservarse

### Anejo suelto (Anejo)

Parking o trastero que se vende **por separado** de la vivienda. Se
crea cuando la config de la promoción declara que NO va incluido en el
precio, o cuando hay más plazas/trasteros que viviendas (excedente).

```ts
interface Anejo {
  id: string;
  promotionId: string;
  publicId: string;              // "P1", "P2", "T1", "T2"
  tipo: "parking" | "trastero";
  precio: number;                // EUR
  status: "available" | "reserved" | "sold" | "withdrawn";
  clientName?: string;           // si reservado / vendido
  agencyName?: string;
  reservedAt?: string;           // ISO
  soldAt?: string;               // ISO
}
```

Datos: `src/data/anejos.ts` → `anejosByPromotion[promotionId]`.

**Reglas:**
- Paralelo a `Unit`: mismo modelo de estados, misma UX de tabla (kebab
  con Ver · Editar · Enviar · Iniciar compra), misma paleta de status.
- El segmento "Parkings" o "Trasteros" solo se muestra en
  `/promociones/:id` (tab Disponibilidad) si hay al menos un anejo de
  ese tipo. Si no hay, el segmento queda oculto — no se muestra
  contador a cero.
- Origen de los datos: al publicar promoción, backend genera N filas
  desde `WizardState.parkings` / `WizardState.trasteros` y los arrays
  `parkingPrecios` / `trasteroPrecios`. Todos arrancan `available`.
- `publicId` lo genera el backend (`P1..Pn`, `T1..Tn`).
- Contrato API: ver `docs/backend-integration.md §3.1`.

### Agencia (Agency / Collaborator)

Organización externa que colabora trayendo clientes.

⚠️ En backend, `Agency` es un **join** entre `Empresa` (tenant agencia) y
`Collaboration` (relación con el promotor). Los campos identidad (logo,
cover, name, mercados, teamSize, googleRating…) pertenecen al `Empresa`
público de la agencia; los operativos (estado, comisión, ventas, contrato)
a la `Collaboration`. Ver `docs/backend-integration.md` §0 y §4.

```ts
interface Agency {
  /* ─── Identidad pública (de Empresa del tenant agencia) ─── */
  id: string;
  name: string;
  /** Logo circular/cuadrado · avatar en listados, chips. ≥256×256. */
  logo?: string;
  /** Logo rectangular tipo wordmark · cabeceras, emails. ~250×100 (2:1). */
  logoRect?: string;
  cover?: string;
  location: string;          // "Marbella, Spain"
  type: "Agency" | "Broker" | "Network";
  description: string;
  offices: { city: string; address: string }[];

  /* ─── Relación (Collaboration con el promotor) ─── */
  status: "active" | "pending" | "inactive" | "expired";  // legacy
  estadoColaboracion?: "activa" | "contrato-pendiente" | "pausada";
  origen?: "invited" | "marketplace";
  collaboratingSince?: string;
  promotionsCollaborating: string[];          // IDs de promociones activas
  totalPromotionsAvailable: number;
  solicitudPendiente?: boolean;
  mensajeSolicitud?: string;
  isNewRequest?: boolean;

  /* ─── Contrato firmado ─── */
  contractSignedAt?: string;                  // ISO yyyy-mm-dd
  contractExpiresAt?: string;                 // ISO; null = sin caducidad
  contractDocUrl?: string;                    // PDF

  /* ─── Métricas operativas (calculadas por backend) ─── */
  visitsCount: number;
  registrations: number;                      // histórico
  registrosAportados?: number;                // para vista v2 en Colaboradores
  ventasCerradas?: number;
  salesVolume: number;                        // EUR acumulado
  comisionMedia?: number;                     // %
  conversionRate?: number;                    // % ventasCerradas / registrosAportados
  ticketMedio?: number;                       // EUR salesVolume / ventasCerradas
  lastActivityAt?: string;                    // ISO · último registro/venta/login
  teamSize?: number;                          // nº agentes (COUNT users tenant)

  /* ─── Especialización comercial ─── */
  especialidad?: "luxury" | "residential" | "commercial" | "tourist" | "second-home";
  mercados?: string[];                        // ISO2 nacionalidades cubiertas, ej ["GB","NL"]

  /* ─── Rating público Google (Places API, cron semanal) ─── */
  googlePlaceId?: string;
  googleRating?: number;                      // 0-5
  googleRatingsTotal?: number;
  googleFetchedAt?: string;                   // ISO · ToS: ≤30 días
  googleMapsUrl?: string;

  /* ─── Evaluación interna del promotor ─── */
  ratingPromotor?: number;                    // 1-5 subjetivo (privado)
  incidencias?: { duplicados: number; cancelaciones: number; reclamaciones: number };
}
```

Datos mock: `src/data/agencies.ts`. Helper `getContractStatus(a)` computa
`"vigente" | "por-expirar" (≤30d) | "expirado" | "sin-contrato"`.

**Reglas:**
- Una agencia solo ve promociones listadas en `promotionsCollaborating`.
- Nuevas solicitudes (`isNewRequest`) aparecen en banner arriba de la lista.
- `status === "expired"` → no puede crear registros nuevos.
- `canShareWithAgencies === false` en la promoción → el promotor no puede
  invitar nuevas agencias ni compartir esa promo (gate en ADR-033).
- `ratingPromotor` e `incidencias` NO se envían a la agencia (privados).
- Atribución "Basado en reseñas de Google" obligatoria al mostrar
  `googleRating` (Places API ToS).

### Lead (bandeja de entrada · sin cualificar)

Entrada cruda de un potencial comprador antes de ser cualificado. Se
origina en webhooks de portales, submits del microsite, WhatsApp,
referrals de agencias o walk-ins en oficina.

```ts
type LeadSource =
  | "idealista" | "fotocasa" | "habitaclia"
  | "microsite" | "referral"  | "agency"
  | "whatsapp"  | "walkin"    | "call";

type LeadStatus =
  | "new"          // recién entrado, sin revisar
  | "qualified"    // revisado, cumple requisitos mínimos
  | "contacted"    // alguien del equipo ya contactó
  | "duplicate"    // detectado duplicado por la IA
  | "rejected"     // descartado manualmente
  | "converted";   // promovido a Registro

interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nationality?: string;         // ISO2
  idioma?: string;              // ISO2
  source: LeadSource;
  status: LeadStatus;
  interest: {
    promotionId?: string;
    promotionName?: string;
    tipologia?: string;
    dormitorios?: string;        // "2-3", "3+"
    presupuestoMax?: number;     // EUR
    zona?: string;
  };
  createdAt: string;            // ISO
  firstResponseAt?: string;     // ISO · primera acción del equipo
  assignedTo?: { name: string; email: string };
  message?: string;
  duplicateScore?: number;      // 0-100 · IA de duplicados
  duplicateOfContactId?: string;// match si score ≥ 70
  tags?: string[];
}
```

Datos: `src/data/leads.ts` → `leads: Lead[]`.

**Reglas:**
- Al crear un lead, backend encola un job de IA que rellena
  `duplicateScore` y `duplicateOfContactId`. Si score ≥ 70 →
  `status="duplicate"` automático.
- `firstResponseAt` lo graba el servidor en la primera interacción
  (email / WhatsApp / llamada). No editable a mano.
- Convertir un lead a registro es **irreversible**: el lead queda en
  `status="converted"` y el registro creado referencia el `leadId`
  original (traza de origen).
- Un lead descartado (`rejected`) no se elimina, se conserva para
  estadística de calidad de fuente.
- El SLA medio de respuesta por agencia se calcula como
  `AVG(firstResponseAt - createdAt)` y alimenta el dashboard de
  Estadísticas de colaboradores (§4.2 de backend-integration).
- Contrato API completo: ver `docs/backend-integration.md §7.1`.

### Registro (Record / Client Registration)

Solicitud de apartar un cliente potencial sobre una promo. Puede venir de
dos orígenes (`origen`) con flujo y privacidad muy distintas — ver
**ADR-046** para el rationale completo.

```ts
type RegistroOrigen = "direct" | "collaborator";

interface RegistrationRecord {
  id: string;
  /** Origen del registro. Determina el flujo de aprobación y qué campos
   *  son visibles/compartidos. */
  origen: RegistroOrigen;
  type: "registration" | "registration_visit";  // con visita o sin
  contactName: string;
  contactPhoneLast4?: string;  // últimos 4 dígitos (duplicate check)
  contactNationality?: string;
  contactFlag?: string;        // "🇷🇺"
  contactEmail?: string;
  promotion: string;           // nombre de la promoción
  /** Obligatorio si origen === "collaborator", undefined si es direct. */
  agencyId?: string;
  agencyName?: string;
  agentName?: string;
  status: "pending" | "approved" | "declined" | "expired";
  date: string;
  relativeDate: string;
  matchPercentage?: number;    // 0-100, duplicado con cliente previo
  matchDetails?: MatchDetail[];
  existingClient?: ExistingClient;
  recommendation?: string;     // texto IA
  comment?: string;
  submissionNote?: string;
  timeline?: TimelineEvent[];
  visitDate?: string;          // si type === "registration_visit"
  visitTime?: string;
  visitConfirmed?: boolean;
  visitNewDate?: string;
  visitNewTime?: string;
  visitAssignedTo?: string;
  visitAssignedRole?: string;
  decidedBy?: string;
  decidedByRole?: string;
  decisionNote?: string;
  /** ISO · cuándo se decidió. Dispara el GracePeriodBanner (5 min). */
  decidedAt?: string;
}
```

Datos: `src/data/records.ts` (seed + tipos), UI en `src/pages/Registros.tsx`.

**Reglas críticas:**
- `matchPercentage >= 70` → se muestra warning de duplicado y se sugiere
  rechazar.
- Si se aprueba, la agencia tiene derecho preferente sobre ese cliente
  durante `validezRegistroDias` (configurable por promoción).
- Si expira sin visita, se libera automáticamente.
- **Asimetría por `origen` (ADR-046):**
  - `collaborator` — la agencia solo envía 3 campos canónicos (nombre,
    nacionalidad, últimos 4 del teléfono). Email / teléfono completo / DNI
    **no se comparten** hasta que el promotor apruebe.
  - `direct` — lo mete el propio promotor desde su CRM, tiene todos los
    datos del cliente desde el minuto cero.
- Los datos sensibles del `existingClient` tampoco se muestran a otras
  agencias que intenten registrar al mismo cliente — solo se indica
  "cliente ya registrado" genéricamente.
- Tras aprobar/rechazar hay un **grace period de 5 min** (`decidedAt`)
  durante el cual el promotor puede revertir la decisión antes de que se
  envíe la notificación a la agencia.

### Contacto (Contact / Lead)

Cliente potencial o real en el CRM.

```ts
interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  flag?: string;
  source: "agency" | "direct" | "microsite" | "import";
  agencyId?: string;           // quién lo trajo (si agency)
  promotions: string[];        // IDs de promociones donde está registrado
  visits: Visit[];
  timeline: ContactTimelineEvent[];
  scoring: "hot" | "warm" | "cold";
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Visita (Visit)

Cita física para ver una unidad.

```ts
interface Visit {
  id: string;
  contactId: string;
  promotionId: string;
  unitId?: string;             // si visita a unidad específica
  date: Date;
  time: string;
  duration: number;            // minutos
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  assignedTo?: string;         // userId del equipo
  notes?: string;
  outcome?: "interested" | "reserved" | "declined";
}
```

### Venta (Sale)

Operación cerrada.

```ts
interface Sale {
  id: string;
  contactId: string;
  unitId: string;
  promotionId: string;
  agencyId?: string;           // si vino por agencia
  price: number;               // precio final (puede diferir del listado)
  reservationDate: Date;
  contractDate?: Date;         // firma C/V
  deliveryDate?: Date;
  status: "reserved" | "signed" | "delivered";
  commission: Commission;
}

interface Commission {
  percentage: number;
  amount: number;
  status: "pending" | "paid";
  paymentMilestones: HitoComision[];
  paidAt?: Date;
}
```

### Configuración de colaboración (por promoción)

```ts
interface CollaborationConfig {
  comisionInternacional: number;       // %
  comisionNacional: number;            // %
  diferenciarNacionalInternacional: boolean;
  diferenciarComisiones: boolean;
  agenciasRefusarNacional: boolean;    // pueden las agencias rechazar nacionales
  clasificacionCliente: ClasificacionCliente;
  formaPagoComision: FormaPagoComision;
  hitosComision: HitoComision[];
  ivaIncluido: boolean;
  condicionesRegistro: CondicionRegistro[];
  validezRegistroDias: number;         // 0 = no expira
}
```

Tipos: `src/data/developerPromotions.ts` + `src/types/promotion-config.ts`.

### Invitación (Invitacion)

Representa una invitación del promotor a una agencia (nueva o existente)
para colaborar en una promoción concreta o en la cartera entera.

```ts
type EstadoInvitacion = "pendiente" | "aceptada" | "rechazada" | "caducada";

interface PagoTramo {
  tramo: number;
  completado: number;   // % del cobro del cliente
  colaborador: number;  // % de la comisión al colaborador en ese tramo
}

interface Invitacion {
  id: string;
  token: string;                         // token magic-link único
  emailAgencia: string;
  nombreAgencia: string;                 // puede ir vacío si no se rellenó
  mensajePersonalizado: string;
  comisionOfrecida: number;              // %
  idiomaEmail: "es"|"en"|"fr"|"de"|"pt"|"it";
  estado: EstadoInvitacion;
  createdAt: number;                     // timestamp ms
  expiraEn: number;                      // timestamp ms (30 días default)
  respondidoEn?: number;

  /* Opcionales · flujo SharePromotionDialog */
  promocionId?: string;
  promocionNombre?: string;
  duracionMeses?: number;
  formaPago?: PagoTramo[];
  datosRequeridos?: string[];            // ["Nombre completo", "Teléfono", "Nacionalidad"]
}
```

Tipos: `src/lib/invitaciones.ts`. Storage actual: localStorage bajo clave
`byvaro-invitaciones`. Sincronización cross-tab por storage event +
CustomEvent.

**Helper:** `invitacionToSyntheticAgency(inv)` convierte una invitación
pendiente en una fila sintética `Agency` con `estadoColaboracion:
"contrato-pendiente"` para mostrarla en `/colaboradores` mientras no
responda.

**Template HTML:** `getInvitacionHtml(data)` devuelve `{ asunto, html }`
email-safe (tablas + inline + media queries) con hero de promoción,
precio desde-hasta, entrega, pill de unidades disponibles, comisión,
tabla de tramos de pago, checklist de datos, CTA "Ver invitación".
Preview estático: `email-previews/invitacion-agencia.html`.

**Reglas:**
- El token expira a los 30 días (`VALIDEZ_DIAS`).
- La suma de `formaPago[].colaborador` debe ser 100%.
- Dominios públicos (gmail, hotmail, …) se rechazan inline en el input.
- Match por dominio contra `Empresa.domain` de otro tenant.
- En `/colaboradores`, las pendientes se inyectan como filas sintéticas.

### Favoritos (de agencias)

Marcador booleano del promotor sobre sus colaboradores (para acceso rápido
al compartir, filtrar, enviar email).

```
Set<Agency["id"]>    // localStorage: "byvaro-favoritos-agencias"
```

Hook: `useFavoriteAgencies()` en `src/lib/favoriteAgencies.ts` → expone
`{ ids, isFavorite, toggleFavorite, add, remove }`. Persistencia + sync
cross-tab idéntica al store de invitaciones.

Consumidores: `Colaboradores.tsx`, `ColaboradoresV2/V3.tsx`,
`SharePromotionDialog` (step "Mis favoritos"), `SendEmailDialog`
(filtro "Favoritos"), `PromotionAgenciesV2`.

## Entidades de la ficha de contacto

> Todos los tipos viven en `src/components/contacts/types.ts`. Esta
> sección documenta los más relevantes para el backend y la spec en
> `docs/screens/contactos-ficha.md`.

### `ContactRecordEntry` (lead / registro)

Solicitud entrante al contacto desde un origen (agencia, portal, microsite, manual).

```ts
type ContactRecordEntry = {
  id: string;
  promotionId: string;
  promotionName: string;
  unit?: string;
  /** Imagen del inmueble para thumbnail. */
  propertyImage?: string;
  /** Referencia interna (ej. MN-4B). */
  propertyRef?: string;
  /** URL del landing del microsite o portal donde se captó. */
  landingUrl?: string;
  /** Agente asignado. */
  agent: string;
  /** De dónde vino: "Idealista", "Fotocasa", "Microsite Marina Bay",
   *  "Agencia Costa Sur", "Manual"… */
  source: string;
  status: "pending" | "approved" | "cancelled" | "converted";
  timestamp: string;          // ISO
  /** Si converted, id de la venta generada. */
  convertedSaleId?: string;
  /** Si cancelled, motivo libre. */
  cancelReason?: string;
  blockchainHash?: string;
  agentNote?: string;
};
```

Ciclo: `pending` (esperando aprobación del promotor) → `approved` (en
trabajo) → `converted` (genera Venta) o `cancelled` (no fructificó).

### `ContactOpportunityEntry` (oportunidad)

Oportunidad activa con intereses declarados/inferidos del cliente.

```ts
type ContactOpportunityEntry = {
  id: string;
  promotionId: string;
  promotionName: string;
  unit?: string;
  propertyImage?: string;
  agencyName?: string;        // null si la abre el promotor en directo
  agentName: string;
  status: "active" | "won" | "archived";
  createdAt: string;          // ISO
  clientInterests?: {
    propertyType?: string;    // "Ático" | "Piso" | "Villa" | …
    area?: string;            // "Playa" | "Centro" | "Golf" | …
    budgetMin?: number;
    budgetMax?: number;
    bedrooms?: string;        // "2" | "3" | "3+" | "4+"
  };
  tags?: string[];            // ["Vistas al mar", "Inversión", …]
};
```

Ver ADR-042 para el rationale del 3-zone layout en el tab Operaciones.

### `ContactActiveOperation` (banner "Compra en curso")

Resumen de la operación activa (compra firmada) para el banner verde
del tab Operaciones. Derivado del primer lead `converted` del contacto.

```ts
type ContactActiveOperation = {
  id: string;
  title: string;              // "Compra en curso"
  promotionName: string;
  unit?: string;
  price: number;              // EUR
  deposit: number;            // EUR
  startDate: string;          // ISO
  state: "in-progress";       // futuro: "signed" | "delivered" | …
};
```

### `ContactRelation` (vínculo entre contactos)

```ts
type ContactRelation = {
  contactId: string;
  contactName: string;
  /** Id del catálogo `relationTypesStorage`. NO es un union literal:
   *  acepta tipos custom creados por el admin. */
  relationType: string;
};
```

Ver ADR-044 (catálogo dinámico).

### `RelationType` (catálogo de tipos de relación)

Vive en `src/components/contacts/relationTypesStorage.ts`. Editable
por admin en `/ajustes/contactos/relaciones`.

```ts
type RelationType = {
  id: string;          // slug inmutable (e.g. "spouse", "inversor-conjunto")
  label: string;       // visible, editable
  enabled?: boolean;   // false = no aparece al crear nuevos vínculos
};

const DEFAULT_RELATION_TYPES = [
  { id: "spouse",    label: "Cónyuge",  enabled: true },
  { id: "partner",   label: "Pareja",   enabled: true },
  { id: "family",    label: "Familiar", enabled: true },
  { id: "colleague", label: "Colega",   enabled: true },
  { id: "other",     label: "Otro",     enabled: true },
];
```

### `ContactTimelineEvent` (audit log)

Append-only log de toda actividad relacionada con un contacto. Ver
ADR-040 + regla de oro 🥇 Historial en CLAUDE.md.

```ts
type ContactTimelineEvent = {
  id: string;
  type: ContactTimelineEventType;
  timestamp: string;          // ISO
  title: string;
  description?: string;
  actor?: string;             // "Sistema" si es bot/automatización
  actorEmail?: string;
  meta?: Record<string, string | number>;
};

type ContactTimelineEventType =
  // Identidad
  | "lead_entry" | "contact_created" | "contact_edited" | "contact_deleted"
  // Asignación / vinculación
  | "assignee_added" | "assignee_removed"
  | "relation_linked" | "relation_unlinked"
  // Etiquetas / status
  | "tag_added" | "tag_removed" | "status_changed"
  // Visitas
  | "visit_scheduled" | "visit_done" | "visit_cancelled" | "visit_evaluated"
  // Email (ciclo completo · ADR-045)
  | "email_sent" | "email_received" | "email_delivered" | "email_opened"
  // WhatsApp
  | "whatsapp_sent" | "whatsapp_received"
  // Otros
  | "call" | "comment" | "registration" | "web_activity"
  | "document_uploaded" | "document_deleted"
  | "system_change";

type TimelineCategory = "all" | "comments" | "emails" | "whatsapp" | "web" | "system";
```

Helpers tipados (azúcar para no construir el evento a mano) en
`contactEventsStorage.ts` — ver `docs/ui-helpers.md`.

## Reglas de negocio clave

### Detector de duplicados de registro

Al crear un registro, se compara contra los registros existentes de la misma
promoción. Se calcula `matchPercentage` con weighted fields:

| Campo | Peso |
|---|---|
| Teléfono últimos 4 dígitos | 40% |
| Nombre completo | 30% |
| Email | 20% |
| Nacionalidad | 10% |

- `< 30%`: registro sano, aprobación automática sugerida
- `30-69%`: ambiguo, mostrar detalles al promotor
- `>= 70%`: duplicado probable, recomendar rechazo

### Trending

Una promoción es "Trending" si `activity.trend >= 50` (últimas 2 semanas).
Se muestra con ring ámbar + tag `Flame`.

### Missing steps

Promociones con `missingSteps: string[]` no pueden publicarse ni compartirse
con agencias. El wizard de creación valida cada paso; si salta uno, lo
registra en `missingSteps`.

### Validez de un registro

Al aprobar un registro, la agencia tiene derecho preferente durante
`validezRegistroDias` (default 30). Si no hay visita programada en ese plazo,
el registro expira y otra agencia puede registrar al mismo cliente.

### Edición masiva de unidades → aviso

Si el promotor edita precios/estados de múltiples unidades de golpe, al
guardar se abre diálogo "¿Avisar a colaboradores?" → opción email automático
con el detalle del cambio.

### Vista Agencia · filtros automáticos

En cualquier pantalla con `agencyMode=true`:
- Filtrar `unit.status === "available"` automáticamente
- Ocultar campos sensibles: `reservedBy`, `soldAt`, otra agencia, comisiones
  que no son propias
- Reemplazar CTAs de edición con "Ver" o "Enviar a cliente"

### Scoring de contacto

Calculado automáticamente según actividad reciente:
- **Hot**: visita en últimos 7 días o reserva pendiente
- **Warm**: visita en últimos 30 días o 2+ interacciones
- **Cold**: sin actividad en 30+ días

## Schema SQL sugerido (Postgres)

Al montar backend, el schema base será (resumen):

```sql
CREATE TABLE companies ( id uuid PK, name, tax_id, plan, created_at );
CREATE TABLE users ( id uuid PK, company_id FK, email unique, role, ... );
CREATE TABLE agencies ( id uuid PK, name, type, status, ... );
CREATE TABLE promotions ( id uuid PK, company_id FK, code, name, ... );
CREATE TABLE units ( id uuid PK, promotion_id FK, block, floor, ... );
CREATE TABLE collaborations ( agency_id FK, promotion_id FK, config jsonb, UNIQUE(agency, promo) );
CREATE TABLE contacts ( id uuid PK, company_id FK, name, phone_hash, ... );
CREATE TABLE registrations ( id uuid PK, contact_id FK, promotion_id FK, agency_id FK, status, match_percentage, timeline jsonb );
CREATE TABLE visits ( id uuid PK, contact_id FK, promotion_id FK, unit_id FK, date, status );
CREATE TABLE sales ( id uuid PK, contact_id FK, unit_id FK, agency_id FK, price, commission jsonb );
```

Indices recomendados:
- `registrations(promotion_id, status)` — filtros de la pantalla Registros
- `registrations(contact_id)` — búsqueda de duplicados
- `units(promotion_id, status)` — disponibilidad
- `contacts(company_id, phone_hash)` — dedup del CRM

Migraciones: carpeta pendiente `supabase/migrations/` o `prisma/migrations/`.

## Multi-tenancy

Cada tabla relevante debe tener `company_id` + **Row Level Security (RLS)**
si usas Supabase. Ejemplo:

```sql
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own company promos"
  ON promotions FOR SELECT
  USING (company_id = auth.jwt() ->> 'company_id');
```

Agencias acceden vía tabla `collaborations` (join-based RLS).
