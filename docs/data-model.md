# Modelo de datos · Byvaro v2

Entidades del dominio + tipos TypeScript + reglas de negocio.

> Los tipos TS canónicos están en `src/data/*.ts`, `src/types/*.ts` y
> `src/components/crear-promocion/types.ts`. Este documento los **explica**
> pero no los **define** — para el contrato de datos, leer el código.

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

### Agencia (Agency / Collaborator)

Organización externa que colabora trayendo clientes.

```ts
interface Agency {
  id: string;
  name: string;
  logo?: string;
  cover?: string;
  location: string;          // "Marbella, Spain"
  type: "Agency" | "Broker" | "Network";
  description: string;
  visitsCount: number;
  registrations: number;
  salesVolume: number;       // € facturado
  collaboratingSince?: string;
  status: "active" | "pending" | "inactive" | "expired";
  offices: { city: string; address: string }[];
  promotionsCollaborating: string[];  // IDs de promociones activas
  totalPromotionsAvailable: number;
  isNewRequest?: boolean;     // solicitud nueva de colaboración
}
```

Datos: `src/data/agencies.ts`.

**Reglas:**
- Una agencia solo ve promociones listadas en `promotionsCollaborating`
- Nuevas solicitudes (`isNewRequest`) aparecen en banner arriba de la lista
- `status === "expired"` → no puede crear registros nuevos

### Registro (Record / Client Registration)

Solicitud de una agencia para "apartarse" un cliente potencial en una promo.

```ts
interface RegistrationRecord {
  id: string;
  type: "registration" | "registration_visit";  // con visita o sin
  contactName: string;
  contactPhoneLast4?: string;  // últimos 4 dígitos (duplicate check)
  contactNationality?: string;
  contactFlag?: string;        // "🇷🇺"
  contactEmail?: string;
  promotion: string;           // nombre de la promoción
  agencyName: string;
  agentName: string;
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
}
```

Datos: `src/components/records/data.ts`, tipos en `types.ts`.

**Reglas críticas:**
- `matchPercentage >= 70` → se muestra warning de duplicado y se sugiere
  rechazar
- Si se aprueba, la agencia tiene derecho preferente sobre ese cliente
  durante `validezRegistroDias` (configurable por promoción)
- Si expira sin visita, se libera automáticamente
- Los datos sensibles (cliente completo, otra agencia) NO se muestran a otras
  agencias que intenten registrar al mismo cliente — solo se indica "cliente
  ya registrado" genéricamente

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
