# Contact / Lead / Registro · auditoría de modelo de orígenes

> El sistema actual asume **un origen único** por Contact y lo sobrescribe.
> El negocio requiere **orígenes acumulativos**: una persona puede llegar
> por Idealista, volver por Fotocasa, rellenar el form del microsite y
> finalmente ser registrada por una agencia · todos esos orígenes
> deben quedar trazados sin que ninguno se pierda.

---

## TASK 1 · Campos actuales para origen/source

### 1.1 · `Contact` (`src/components/contacts/types.ts:39-109`)

| Campo | Tipo | Qué guarda |
|---|---|---|
| `source` | `string` | Etiqueta humana del origen · "Idealista", "Agencia Norte", "Promotor directo", "Microsite". **Un solo valor.** |
| `sourceType` | `ContactSourceType` enum (`"registration" \| "portal" \| "direct" \| "import"`) | Categoría técnica del origen. **Un solo valor.** |
| `firstSeen` | `string` formato `"12 mar 2026"` | Fecha primer contacto · localizada. No tiene timestamp ISO ni hora. |

**Observación**: `source` y `sourceType` son escalares · cuando un Contact gana un nuevo origen, **se sobrescriben** o se ignoran (ver §3).

### 1.2 · `Lead` (`src/data/leads.ts:67-100`)

| Campo | Tipo | Qué guarda |
|---|---|---|
| `source` | `LeadSource` enum (`idealista \| fotocasa \| habitaclia \| microsite \| referral \| agency \| whatsapp \| walkin \| call`) | Origen normalizado del Lead. **Un solo valor.** |
| `createdAt` | ISO timestamp | Cuándo entró el lead. Esto es el **único Lead** · si la misma persona vuelve, ¿se crea otro Lead o se reutiliza? No queda claro en el modelo. |

`Lead` es por sí mismo "un evento de origen" · si la misma persona viene 3 veces, idealmente serían 3 Leads y los unifica un Contact. Pero la UI/storage no implementa esto: no hay `Lead.contactId` que enlace múltiples Leads al mismo Contact.

### 1.3 · `Registro` (`src/data/records.ts:135-210`)

| Campo | Tipo | Qué guarda |
|---|---|---|
| `origen` | `"direct" \| "collaborator"` | Si viene de agencia o de promotor directo. **Un solo valor por Registro.** |
| `origenCliente` | `string?` | Solo para `origen: "direct"` · "Idealista", "Referido", "Web propia"… **string libre, no normalizado**. |
| `agencyId` | `string?` | Si `origen: "collaborator"`, qué agencia. |
| `audit` | `ActionFingerprint` | Quién creó el registro, cuándo, desde qué IP/device. Auditoría de la creación, no del origen del cliente. |
| `fecha` | ISO timestamp | Cuándo se creó el Registro. |

Cada Registro lleva su propio origen · múltiples Registros del mismo cliente (cross-promo) tienen orígenes potencialmente distintos. Pero **no hay un campo agregado en Contact que recoja todos los orígenes** de sus Registros.

### 1.4 · Eventos de timeline (`ContactTimelineEventType`)

Existen tipos relevantes que sí podrían trackear orígenes:

- `"lead_entry"` · "Nuevo registro · {Promo} · Origen: {sourceLabel}" (usado en `recordTypeAny`).
- `"web_activity"` · visitas al microsite (web tracking).
- `"contact_created"` · creación inicial.
- `"registration"` · cuando un Registro se asocia al Contact.

Estos eventos se persisten en `contactEventsStorage` por contact id. **Son la fuente más rica de información histórica** pero no están agregados en una vista de "orígenes acumulados".

---

## TASK 2 · ¿Soporta el modelo múltiples orígenes?

**Respuesta corta: parcialmente · por accidente, no por diseño.**

### Lo que sí soporta

- El **timeline de eventos** acumula entradas independientes · si configuramos cada origen nuevo como un `lead_entry` event, queda trazado.
- `upsertContactFromRegistro` añade `lead_entry` cuando aprueba un Registro de un Contact existente (no sobrescribe nada).
- Múltiples `Registro`s pueden coexistir para el mismo Contact (cross-promo) · cada uno con su `origenCliente` propio.

### Lo que NO soporta

- **`Contact.source` y `Contact.sourceType` son escalares** · en `upsertContactFromRegistro` cuando se CREA un Contact nuevo se rellenan, pero si el Contact ya existe, **no se actualizan ni se acumulan**.
- **No hay campo `leadOrigins[]`** que liste todos los canales por los que ha venido el cliente.
- **Ningún UI muestra "orígenes acumulados"** · la lista de contactos pinta un solo `source` como columna; la ficha pinta un solo `source` en el header.
- **`Lead` como entidad no se reutiliza** · cada vez que llega una entrada nueva se crea un Lead nuevo sin enlazarse al Contact existente vía `contactId` (campo que no existe en `Lead`).
- **`firstSeen` solo guarda fecha de alta** · no hay `lastSeen` ni `lastSourceAt`.

---

## TASK 3 · Dónde se sobrescribe o se pierde la información

### Punto 1 · `upsertContactFromRegistro` cuando el Contact ya existe

`src/lib/registroContactLink.ts:91-101`:

```ts
if (existing) {
  recordTypeAny(existing.id, "lead_entry", `Nuevo registro · ${promoName}`,
                `Registro aprobado · origen: ${sourceLabel}`, by);
  return { contactId: existing.id, created: false, ... };
}
```

- ✓ Crea evento `lead_entry` (queda en timeline).
- ✗ NO actualiza `Contact.source` ni `Contact.sourceType`.
- ✗ NO actualiza `lastActivity` con el nuevo origen.
- ✗ NO incrementa `totalRegistrations`.

**Resultado**: si el Contact entró por Idealista y luego una agencia lo registra, en el listado sigue apareciendo "Idealista" como `source`. La agencia es invisible en la columna principal · solo aparece si abres el timeline.

### Punto 2 · Creación inicial fija el origen "para siempre"

`src/lib/registroContactLink.ts:107-138`:

```ts
const newContact: Contact = {
  ...
  source: sourceLabel,           // ← una vez ⇒ queda fijo
  sourceType: "registration",     // ← una vez ⇒ queda fijo
  firstSeen: ...
};
```

`source` y `sourceType` se calculan en el momento de creación y **nunca se vuelven a tocar**, aunque después el Contact reciba 5 eventos más de canales distintos.

### Punto 3 · Duplicación de Leads no se evita

`Lead` no tiene `contactId`. Si el mismo cliente entra por Idealista y por Fotocasa, son **dos Leads distintos en el sistema** (cada uno con su `id`, su `source`, sin enlace común). El único punto de unificación es `Contact` cuando alguien hace upsert · pero `Lead` propiamente dicho queda huérfano.

### Punto 4 · `origenCliente` del Registro es string libre

`Registro.origenCliente: string?` (`src/data/records.ts:189-192`). Valores típicos: "Idealista", "Referido", "Web propia"…

- No coincide con `LeadSource` enum (`idealista`, `referral`, `microsite`).
- Imposible agregar/contar fiablemente: "¿cuántos clientes vienen de Idealista?" · respuesta depende de string matching frágil.

### Punto 5 · `firstSeen` pierde precisión temporal

Es un string formateado en castellano (`"12 mar 2026"`). Sin ISO timestamp, no se puede ordenar exactamente, ni calcular días entre orígenes, ni rastrear cuál fue primero si dos llegan el mismo día.

### Punto 6 · Lista de Contactos no muestra orígenes acumulados

`src/pages/Contactos.tsx` y `src/components/contacts/ContactRow.tsx` (asumido por nombres) renderizan `contact.source` como string · no hay UI para "vino por X canales".

---

## TASK 4 · Modelo mínimo propuesto

> Objetivo · **acumular sin perder, sin overengineering**. El timeline ya
> existe y funciona · solo necesitamos agregarle estructura para los
> orígenes y exponerlo en UI.

### 4.1 · Cambios al tipo `Contact`

```ts
export type ContactOrigin = {
  /** Canal normalizado · alineado con LeadSource. */
  source: LeadSource;
  /** Etiqueta humana mostrada en UI · "Idealista", "Agencia Norte", etc. */
  label: string;
  /** ISO timestamp del momento exacto. */
  occurredAt: string;
  /** Promoción asociada si aplica · ej. portal lead sobre Promo A. */
  promotionId?: string;
  /** Agencia asociada si aplica. */
  agencyId?: string;
  /** Id del Registro/Lead/event que disparó este origen · trazabilidad. */
  refId?: string;
  refType?: "registro" | "lead" | "web_activity" | "import";
  /** Notas opcionales: campaña, UTM, etc. */
  meta?: Record<string, string | number>;
};

export type Contact = {
  // ... campos existentes
  /** PRIMER origen del contacto · inmutable tras creación. */
  primarySource: ContactOrigin;
  /** ÚLTIMO origen · se actualiza cuando entra uno nuevo. */
  latestSource: ContactOrigin;
  /** Lista cronológica completa de orígenes · NUNCA se sobrescribe.
   *  Se añaden entradas, jamás se borran salvo borrado del Contact. */
  origins: ContactOrigin[];
  // `source` (string) y `sourceType` (enum 4-valores) DEPRECATED ·
  // mantener durante migración, derivar de primarySource/latestSource.
};
```

**Por qué tres campos y no solo `origins[]`**:

- `primarySource` · acceso O(1) para el listado · no requiere ordenar el array.
- `latestSource` · idem para mostrar "última actividad de origen X".
- `origins[]` · fuente de verdad completa · render del histórico.

Los tres se sincronizan en cada nuevo origen. El "first" jamás cambia · el "latest" siempre se actualiza · el array crece append-only.

### 4.2 · Compatibilidad con timeline existente

Cada nuevo `ContactOrigin` añadido al array dispara también un evento en el timeline:

- `web_activity` para entradas web/portal.
- `lead_entry` para Registros nuevos.
- Eventos custom si vienen de import o WhatsApp.

El timeline sigue siendo la fuente narrativa · `origins[]` es la fuente estructurada para queries y agregados (rankings, dashboards, filtros).

### 4.3 · Helpers obligatorios

```ts
// src/lib/contactOrigins.ts (nuevo)
export function appendOrigin(contact: Contact, origin: ContactOrigin): Contact;
export function getPrimarySource(contact: Contact): ContactOrigin;  // contact.primarySource
export function getLatestSource(contact: Contact): ContactOrigin;   // contact.latestSource
export function countByChannel(contact: Contact): Record<LeadSource, number>;
```

Único punto de mutación: `appendOrigin()`. Cualquier código que crea/actualiza Contacts con un nuevo origen pasa por aquí.

### 4.4 · Cambios en flujos existentes

| Flujo | Cambio |
|---|---|
| `upsertContactFromRegistro` (existing path) | Llamar `appendOrigin()` con el origen del Registro · NO solo añadir `lead_entry` event. |
| Creación de Lead desde portal/microsite/walk-in | `appendOrigin()` con `source: "idealista" \| "fotocasa" \| ...`. |
| Importación CSV | `appendOrigin()` con `source: "import"` por cada Contact creado. |
| Web activity tracker (microsite visit) | `appendOrigin()` con `source: "microsite"` SOLO si es la primera visita (no crear uno por cada visita o saturamos). |

### 4.5 · Política de unificación

- Match por email normalizado OR teléfono normalizado.
- Si hay match → **NO crear Contact nuevo** · `appendOrigin()` al existente.
- Si no hay match → crear Contact nuevo con `primarySource = latestSource = origin` y `origins: [origin]`.

Esta política ya existe parcialmente en `findContact()` de `registroContactLink.ts` · se generaliza.

---

## TASK 5 · Cambios en UI

### 5.1 · Lista de contactos (`/contactos`)

**Hoy** · columna "Origen" muestra `contact.source` (string único).

**Propuesta** · columna "Orígenes" muestra:

```
🏠 Idealista · primer contacto
   + 2 más
```

- Pill principal · `primarySource.label` con icono del canal.
- Counter "+N más" si `origins.length > 1`.
- Tooltip al hover muestra los últimos 3 orígenes con fecha.

Filtro lateral · multiselect "Origen alguna vez" filtra por `origins.some(o => filter.includes(o.source))` (no solo `primarySource`).

### 5.2 · Ficha del contacto (`/contactos/:id`)

**Tab Resumen** · sección "Cómo nos conoció":

```
┌───────────────────────────────────────────────┐
│  Cómo entró este contacto                     │
│                                               │
│  ① Idealista · 12 abr 2026 (primer contacto) │
│  ② Fotocasa  · 23 abr 2026                    │
│  ③ Microsite · 28 abr 2026                    │
│  ④ Agencia Norte · 1 may 2026 (último)       │
│                                               │
│  4 canales · 19 días entre primer y último   │
└───────────────────────────────────────────────┘
```

Cada entrada link al evento del timeline para detalles completos.

**Tab Historial** · sin cambios · el timeline ya muestra `lead_entry` y `web_activity`. Solo confirmar que se renderizan claramente.

### 5.3 · Banner de conflicto en Registro

Cuando una agencia registra un cliente que ya está en CRM, en el detalle del Registro pendiente (vista promotor):

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ Cliente ya en tu CRM                                 │
│                                                          │
│  Pedro García ha entrado por 3 canales antes:           │
│   • Idealista · 12 abr (primer contacto)                │
│   • Fotocasa  · 23 abr                                   │
│   • Microsite · 28 abr                                   │
│                                                          │
│  Agencia Norte ahora propone visita el 5 may.           │
│  Si apruebas, comisión a Agencia Norte.                 │
│                                                          │
│  [Ver histórico completo]   [Aprobar]   [Rechazar]      │
└──────────────────────────────────────────────────────────┘
```

Este banner reemplaza al actual `<CrossPromotionWarning>` (que solo mira otros Registros aprobados) · ahora cruza también con `Contact.origins[]` para dar contexto completo.

### 5.4 · Ficha de Lead/oportunidad

Si mantenemos `Lead` como entidad (Phase 2 podría absorberla en Contact), el campo `source` sigue siendo único por Lead. Pero al renderizar la ficha del Lead, se muestra:

> *"Este lead es la 3ª vez que este cliente nos contacta · ver
> [historial completo de orígenes]."*

Con link a la ficha del Contact asociado (`Lead.contactId` · campo nuevo a añadir).

---

## TASK 6 · Resumen ejecutivo

### Estado actual

- `Contact.source` y `Contact.sourceType` son escalares · **se sobrescriben en creación, se ignoran en upsert**.
- El timeline (`lead_entry`, `web_activity`) acumula info pero no está agregada estructuralmente.
- `Lead` no se enlaza a Contact · cada entrada huérfana.
- `Registro.origenCliente` es string libre, no normalizado con `LeadSource`.
- Múltiples Registros del mismo Contact (cross-promo) tienen orígenes propios · ninguno los agrega en el Contact.

### Gaps principales

1. Pérdida silenciosa del primer origen al sobrescribir.
2. No hay forma de filtrar/contar contactos por canales recurrentes ("¿cuántos clientes han venido por ≥2 canales?").
3. UI muestra un solo origen · oculta riqueza real del histórico.
4. Banner de conflicto (`<CrossPromotionWarning>`) no aprovecha el histórico de orígenes del Contact.
5. Imposible reportar al promotor "tu inversión en Idealista está trayendo 60% de los clientes que después registran agencias" · la data está desconectada.

### Modelo propuesto · mínimo

| Campo nuevo en `Contact` | Propósito |
|---|---|
| `primarySource: ContactOrigin` | Inmutable · primer canal por el que entró. |
| `latestSource: ContactOrigin` | Mutable · último canal que aportó este contacto. |
| `origins: ContactOrigin[]` | Append-only · histórico estructurado completo. |

Single point of mutation: `appendOrigin(contact, origin)`. Todos los flujos existentes (upsertContactFromRegistro, importer, portal webhook futuro, microsite form) llaman a este helper.

`source` y `sourceType` actuales se mantienen DEPRECATED durante migración · derivados de `primarySource`. UI legacy sigue funcionando · UI nueva pasa a usar `origins[]`.

### Impacto

- **Storage**: pequeño · cada origen ~150 bytes · típico Contact tendrá 1-5 orígenes · negligible.
- **UI lista**: cambio cosmético · pill principal + counter "+N".
- **UI ficha**: nueva sección "Cómo nos conoció" en tab Resumen.
- **Banner conflicto Registro**: enriquecido con contexto completo.
- **Backend**: tabla `contact_origins (contact_id, source, label, occurred_at, ...)` con FK a `contacts` · simple.
- **Migration**: backfill `origins[]` con un solo entry por Contact existente derivado de su `source` actual + `firstSeen`.

### Anti-overengineering · lo que NO hace falta

- ❌ Eliminar `Lead` ahora · ese refactor es Phase 2.
- ❌ Normalizar `Registro.origenCliente` a `LeadSource` enum ahora · cosmético, no bloqueante.
- ❌ Webhooks reales de portales · backend post-validación.
- ❌ ML/IA para deduplicar orígenes · regla simple de match email/teléfono basta.
- ❌ Ventanas temporales para "expirar" un origen · el array crece para siempre · si pesa demasiado en 5 años, archivamos.

---

## Open questions

1. **¿Web activity entra en `origins[]` o solo en timeline?** · Propuesta: solo el primer `web_activity` del Contact entra en `origins[]` (es el "primer click"). Los siguientes son timeline sin agregar al array · si no, saturamos.
2. **¿`appendOrigin` es idempotente?** · Si el mismo origen llega 2 veces el mismo día (mismo source + mismo email + 1h diferencia), ¿se duplica? Propuesta: dedup por `(source, email/phone, ±1h ventana)` para evitar ruido de webhooks repetidos.
3. **¿Permitimos editar `primarySource`?** · NO. Es inmutable. Si data está mal por bug, soporte la corrige a nivel DB · no UI.
4. **¿Qué pasa si fusionamos dos Contacts duplicados?** · `origins[]` se merge ordenado por `occurredAt` · `primarySource` = el más antiguo · `latestSource` = el más reciente.
5. **¿`origenCliente` del Registro se elimina?** · No · se sigue guardando para no romper compat. Pero el origen "fuente de verdad" ahora vive en `Contact.origins[]`.

---

## Referencias

- `src/components/contacts/types.ts:39-109` · Contact actual.
- `src/components/contacts/types.ts:21-25` · `ContactSourceType` enum (4 valores).
- `src/components/contacts/types.ts:310-359` · `ContactTimelineEventType` (eventos ricos · ya disponibles).
- `src/data/leads.ts:19-28` · `LeadSource` enum (9 valores · canónico).
- `src/data/records.ts:189-192` · `Registro.origenCliente` (string libre).
- `src/lib/registroContactLink.ts:91-138` · upsert que sobrescribe en creación e ignora en update.
- `docs/registration-system.md` · spec del sistema de registro.
- `docs/portal-leads-integration.md` · cómo encajan portales con Registros.
