# Registro genérico · modelo agnóstico de personas + Last Activity

> Hoy el sistema asume **promotor ↔ agencia** como única relación posible.
> El roadmap incluye agencia ↔ agencia, agencia ↔ propietario y
> propietario ↔ agencia · todas con la misma lógica de
> registro / preregistro / visita / duplicados / atribución / notificaciones.
>
> Este documento audita el acoplamiento actual y propone un modelo
> genérico de partes (parties) + tracking de última actividad para
> habilitar las nuevas relaciones sin reescribir el sistema.
>
> No implementa código.

---

## TASK 1 · Auditoría del modelo actual

### 1.1 · `Registro` asume developer ↔ agencia

`src/data/records.ts:135-210` — campos relevantes:

| Campo | Tipo | Por qué acopla |
|---|---|---|
| `origen` | `"direct" \| "collaborator"` | **Binario hardcoded** · "direct" = promotor capta él mismo; "collaborator" = agencia. No hay forma de expresar "agencia A registra cliente para agencia B" o "owner ↔ agencia". |
| `promotionId` | `string` | Asume que el inventario es siempre una **`Promotion`** (obra nueva del promotor). Una propiedad de owner individual no es Promotion · sería `Property` u otra entidad. |
| `agencyId?` | `string` | Solo se rellena si `origen === "collaborator"`. No hay slot para otras agencias / owners involucrados. |
| `decidedByUserId` | `string` | Es el quién aprueba · siempre un miembro del workspace promotor (asumido). |
| `audit.actor` | objeto | El quién creó · puede ser cualquier user en teoría. |

### 1.2 · Hardcoded `developerOrganizationId`

**No existe en el frontend.** El prototipo es single-tenant: hay un solo developer (Luxinmo) y todo el código asume implícitamente que el usuario logueado promotor pertenece a esa única org.

En el **spec del backend** (`docs/backend-integration.md §12`) sí lo hardcodeé:

```sql
create table registrations (
  ...
  developer_organization_id uuid not null references organizations(id),
  agency_organization_id    uuid references organizations(id),
  ...
);
```

→ El nombre `developer_organization_id` literal **no es generalizable**. Una relación agencia ↔ agencia no tiene developer.

### 1.3 · Hardcoded `agencyId`

Aparece en:

| Sitio | Uso |
|---|---|
| `Registro.agencyId?: string` | Modelo · solo cuando `origen: collaborator`. |
| `ClientRegistrationDialog.tsx:543, 554` | Form de creación · auto-set si `currentUser.accountType === "agency"`. |
| `Registros.tsx` filtros y vistas | Lista filtrada por `r.agencyId === currentUser.agencyId` para vista agencia. |
| `findPendingDuplicate`, cross-promo, banner conflicto | Comparaciones binarias agencia vs no-agencia. |
| `agencyTrackRecord.ts` | Calcula score de agencias · asume que la "otra parte" es siempre una agencia. |
| `useUsageGuard` | Solo developers pasan por el gate · agencias siempre `blocked: false`. Asume que el "actor monetizado" es solo developer. |

### 1.4 · ¿Soporta otras combinaciones de partes?

**No.** El modelo es bilateral con dos slots fijos: "el workspace promotor" (implícito) y "la agencia" (opcional). Para soportar las 3 relaciones nuevas haría falta:

| Relación nueva | Por qué no encaja |
|---|---|
| **Agencia ↔ Agencia** (sub-colaboración: A invita a B a colaborar en su cartera) | Dos `agencyId` slots · no existe. No hay "developer" · existe la agencia "anfitrión". |
| **Agencia ↔ Propietario** (agencia gestiona venta de propiedades de un owner) | El "inventario" es una `Property` del owner, no una `Promotion`. El owner es la parte que aprueba. |
| **Propietario ↔ Agencia** (owner invita a una agencia a comercializar) | Inverso del anterior · misma estructura de inventario. El owner es el "anfitrión". |

Todos estos casos rompen el supuesto "siempre hay un developer + opcional agencia".

### 1.5 · Last activity tracking

`Contact.lastActivity: string` (`src/components/contacts/types.ts:68`):

- Es un **string humano** ("Hace 2 horas", "Ayer", "Hace 3 días").
- **No tiene ISO timestamp** · imposible calcular días de inactividad arithmetic.
- Se actualiza ad-hoc al añadir comentarios/visitas/emails · no hay un único punto de actualización canónico.
- No discrimina **por agencia/owner**: si Agencia A interactuó hace 45 días y Agencia B hace 1 día, `lastActivity` muestra "Hace 1 día" · información perdida.

El timeline (`contactEventsStorage`) sí guarda eventos con ISO timestamps y `actor`. Pero **nadie los agrega** a un campo "última actividad de la agencia X con este cliente".

---

## TASK 2 · Modelo genérico de atribución

### 2.1 · Tipo `Party` (cualquier actor del sistema)

```ts
type PartyKind = "developer" | "agency" | "owner";

type Party = {
  kind: PartyKind;
  organizationId: string;   // FK → organizations(id)
  /** Display label · "Luxinmo", "Prime Properties", "Antonio Pérez". */
  label?: string;
};
```

`Party` reemplaza el binario `developer | agency`. Cualquier organization es una `Party` con su `kind`. El `kind` determina qué puede hacer (ver permisos) pero no la estructura.

### 2.2 · Tipo `Registration` genérico

Reemplaza al actual `Registro` (mantenemos el nombre español en UI):

```ts
type Registration = {
  id: string;

  /** Quién es el "anfitrión" del inventario · quién decide aprobar/rechazar.
   *  Su `kind` puede ser developer (promo de obra nueva), owner (propiedad
   *  individual) o agency (cartera propia). */
  owningParty: Party;

  /** Quién está REGISTRANDO al cliente · quién quiere ganar la atribución.
   *  Suele ser una agencia, pero puede ser el propio owningParty (registro
   *  directo · `submittingParty.id === owningParty.id`). */
  submittingParty: Party;

  /** Cliente · normalizado a Contact único. */
  contactId: string;
  cliente: ContactSnapshot;   // datos cacheados al crear

  /** Inventario en disputa · puede ser una Promotion (developer) o una
   *  Property (owner) o una listing de la cartera de la agency. */
  inventoryRef: {
    type: "promotion" | "property" | "listing";
    id: string;
    label?: string;
  };

  /** Tipo de relación entre partes · derivado pero útil para queries. */
  relationshipType:
    | "developer-agency"
    | "owner-agency"
    | "agency-agency"
    | "developer-direct"     // owningParty registra él mismo
    | "owner-direct"
    | "agency-direct";

  /** Estados (de `registration-system.md §2.1`) · agnósticos. */
  estado:
    | "pendiente" | "preregistro_pendiente" | "preregistro_activo"
    | "aprobado" | "rechazado" | "duplicado" | "desplazado" | "caducado";

  tipo: "registration" | "registration_visit" | "visit_only";

  // ... resto de campos existentes (matchPercentage, decidedAt, audit, etc.)
};
```

**Cambios clave**:

- `origen: "direct" | "collaborator"` → derivado de `relationshipType` (mantener para back-compat o eliminar).
- `promotionId` → `inventoryRef.id` con `type: "promotion"`.
- `agencyId` → `submittingParty.organizationId` cuando `submittingParty.kind === "agency"`.

### 2.3 · Mapeo de los casos del roadmap

| Caso | `owningParty.kind` | `submittingParty.kind` | `inventoryRef.type` | `relationshipType` |
|---|---|---|---|---|
| Promotor + agencia (hoy) | developer | agency | promotion | developer-agency |
| Walk-in del promotor | developer | developer | promotion | developer-direct |
| Agencia gestiona propiedad de owner | owner | agency | property | owner-agency |
| Owner registra él mismo a un cliente | owner | owner | property | owner-direct |
| Agencia A subcolabora con Agencia B | agency | agency | listing | agency-agency |
| Agencia que registra en su propia cartera | agency | agency | listing | agency-direct |

### 2.4 · Implicación en counters / paywall

El counter `acceptRegistro` en Phase 1 se filtra por `owningParty.kind === "developer"` (solo developer-org consume su cuota). Cuando llegue Phase 2 con orgs owner/agency en plan pagado, cada uno tendrá su propio counter sobre `Registration WHERE owningParty.organizationId = X`.

---

## TASK 3 · Last activity logic

### 3.1 · Qué cuenta como actividad

**Lista cerrada de eventos que actualizan "última actividad"** entre una `Party` y un `Contact`:

| Evento | Cuenta | Notas |
|---|---|---|
| `email_sent` / `email_received` | sí | bidireccional |
| `whatsapp_sent` / `whatsapp_received` | sí | bidireccional |
| `call` | sí | log explícito de llamada |
| `visit_scheduled` | sí | programar visita reactiva el contacto |
| `visit_done` / `visit_evaluated` | sí | ejecución |
| `comment` (interno) | **no** | nota del agente · no es actividad con el cliente |
| `web_activity` | **no** | el cliente visitó la web · no es interacción del agente con él (depende de definición · ver §3.4) |
| `registration` / `lead_entry` | sí | crear el registro CUENTA como primer touchpoint |
| `tag_added` / `assignee_added` | **no** | mantenimiento interno |

Regla: **solo cuentan eventos que implican comunicación o acción con/sobre el cliente** por parte de la party específica.

### 3.2 · Dónde se almacena

Hoy: `lastActivity: string` (humano) en Contact. Sin per-party.

**Propuesta · campo nuevo en Contact**:

```ts
type PartyActivity = {
  partyId: string;          // organizationId
  partyKind: PartyKind;
  partyLabel: string;       // cacheado para UI
  lastActivityAt: string;   // ISO timestamp
  lastActivityType: ContactTimelineEventType;  // ej. "call"
  /** Total de eventos relevantes con esta party · útil para "intensidad" de relación. */
  activityCount: number;
  /** Primera vez que esta party tocó al cliente. */
  firstActivityAt: string;
};

type Contact = {
  ...
  /** Actividad agregada por party · una entrada por organización que ha tenido
   *  algún touchpoint con el cliente. Append-only en cuanto a partyIds (no se
   *  borran entries) pero `lastActivityAt` se actualiza. */
  partyActivities: PartyActivity[];
  /** Conveniencia · activity más reciente de cualquier party. Reemplaza
   *  el actual `lastActivity: string` cuando se migre. */
  lastActivityAt?: string;
};
```

**Cómo se mantiene**: hook único `recordActivity(contactId, party, eventType, occurredAt)` que:
1. Busca o crea el entry de esa party en `partyActivities[]`.
2. Actualiza `lastActivityAt`, `lastActivityType`, incrementa `activityCount`.
3. Si es la primera vez, setea `firstActivityAt`.
4. Actualiza el `Contact.lastActivityAt` global si el nuevo evento es más reciente.

Backend: tabla `contact_party_activities (contact_id, party_id, last_activity_at, last_activity_type, activity_count, first_activity_at, primary key (contact_id, party_id))`.

### 3.3 · Cuántos días importan · umbrales

Tres umbrales canónicos (tunables por feature flag):

| Umbral | Valor sugerido | Significado |
|---|---|---|
| **Activo** | < 14 días | "La party tuvo actividad reciente · atribución sólida." |
| **Inactivo** | 14-44 días | "Sin actividad reciente · banner amarillo de aviso." |
| **Dormido** | ≥ 45 días | "Sin actividad prolongada · puede liberarse para otra party (con warning fuerte)." |

Después de 45 días, **el sistema permite la nueva atribución pero la decisión final sigue siendo del owningParty** (promotor/owner según contexto). No se libera automáticamente.

Excepciones:
- **`preregistro_activo`** con visita futura programada: el periodo de inactividad NO se calcula entre actividades · se calcula desde `lastActivityAt` o desde la fecha de la visita programada (lo que sea más reciente). La visita futura "extiende" la atribución.
- **`aprobado` con `validezRegistroDias` configurada**: la caducidad explícita de la promoción manda sobre el umbral genérico (los 45 días son default si no hay `validezRegistroDias`).

### 3.4 · Cómo aparece en UI

Etiqueta humana derivada de `lastActivityAt`:

| Días | Etiqueta | Color |
|---|---|---|
| 0 | "Hoy" | verde |
| 1 | "Ayer" | verde |
| 2-13 | "Hace {N} días" | verde |
| 14-44 | "Hace {N} días · sin actividad reciente" | ámbar |
| ≥45 | "Hace {N} días · dormido" | rojo |

Componente `<ActivityFreshness party={...} contact={...} />` que renderiza el pill apropiado y un tooltip con el último evento ("último contacto: llamada del 12 mar").

---

## TASK 4 · Mensajes de conflicto · ejemplos canónicos

Cuando una nueva party intenta registrar un Contact ya atribuido a otra, el sistema muestra un banner contextual basado en el estado de actividad. **Cuatro mensajes base** + variantes.

### 4.1 · Cliente registrado por otra party · sin actividad reciente (45+ días)

**Trigger**: `submittingParty ≠ ownerParty` & cliente tiene Registration aprobado/preregistro_activo de otra party & `daysSince(otherParty.lastActivityAt) >= 45`.

**Mensaje (vista del owningParty al revisar)**:
> 🟠 Este cliente fue registrado por **{Agencia X}** el {fecha}, pero
> **no hay actividad desde hace {N} días** ({último evento: {tipo}}).
> Otra agencia ahora propone registrar al cliente · puedes
> reasignar atribución sin penalización.

**Mensaje (vista de la submittingParty al crear)**:
> 🟠 Este cliente está atribuido a **otra agencia** desde hace {N} días,
> pero **sin actividad reciente**. Tu registro entrará para revisión del
> promotor · si la otra parte sigue inactiva, puede ser reasignado.

### 4.2 · Cliente con visita activa programada

**Trigger**: cliente tiene `Registration.estado === "preregistro_activo"` con `visitDate >= hoy`.

**Mensaje**:
> 🔴 Este cliente tiene **visita programada el {fecha}** con
> **{Agencia X}**. La atribución no se puede transferir hasta que se
> realice o se cancele la visita.

Acción: el registro entrante entra como `duplicado` automáticamente. La submittingParty recibe notificación con explicación.

### 4.3 · Cliente contactado recientemente por la misma party

**Trigger**: `submittingParty === otherParty existente` & `daysSince(lastActivityAt) <= 7` & ya hay Registration activo.

**Mensaje**:
> 🟢 Este cliente ya está registrado a tu nombre (último contacto:
> {fecha}, {tipo}). No es necesario crear otro registro · ve a
> [/registros/{id}] para gestionarlo.

Acción: blockear creación · es la única vez que bloqueamos hard. Es un error obvio.

### 4.4 · Cliente sin actividad reciente con nadie

**Trigger**: cliente existe en CRM como Contact pero NO tiene Registration activa y `partyActivities` están todas inactivas (≥14 días).

**Mensaje**:
> 🟡 Este cliente está en el CRM (entró por {primarySource} el {fecha})
> pero **no tiene atribución activa**. Tu registro será el primero ·
> entrará pendiente de aprobación normal.

Acción: continúa flujo normal · solo aviso informativo.

### 4.5 · Variantes según relationship type

Mismas reglas, sustituyendo etiquetas:

- "Otra agencia" → "Otra agencia" / "El propietario" / "Otro promotor" según `otherParty.kind`.
- "El promotor decidirá" → "El propietario decidirá" si `owningParty.kind === "owner"`.
- "Agencia anfitrión decidirá" si `owningParty.kind === "agency"` (caso agency-agency).

Helper `getOwningPartyLabel(owningParty.kind)` centraliza estas variantes.

---

## TASK 5 · Implicaciones de prioridad

Extiende el modelo de prioridad de `registration-system.md §4` con **decay por inactividad**.

### 5.1 · Modelo de 5 niveles · sin cambios estructurales

```
1. Visita realizada
2. Aprobado activo
3. Preregistro_activo con visita futura
4. Pendiente · first-come por timestamp
5. Sin atribución (caducado/desplazado/duplicado/rechazado)
```

### 5.2 · Cómo aplica el decay por inactividad

| Estado | Inactividad <14d | 14-44d | ≥45d |
|---|---|---|---|
| **Aprobado activo** | Atribución sólida · bloquea | Atribución débil · banner ámbar al rival | Atribución cuestionable · banner rojo + override habilitado |
| **Preregistro_activo** con visita futura | Sólida · bloquea | Sólida (la visita futura cuenta como actividad) | Si visita pasada sin marcar resultado · degrada a `caducado` automático |
| **Pendiente** | First-come limpio | Same | Pasa a "stale pending" · cron marca `caducado` |

### 5.3 · ¿La inactividad debilita la prioridad?

**Sí · pero no auto-degrada**. La inactividad **habilita** al owningParty a reasignar, pero la decisión sigue siendo manual.

Excepciones que sí auto-degradan:
- `pendiente` >45 días sin acción → `caducado` (cron).
- `preregistro_activo` con visita pasada >7 días sin `outcome` registrado → `caducado` (cron).

### 5.4 · ¿Puede el owningParty hacer override?

**Sí · siempre**. Es la regla base. El owningParty es soberano de su inventario.

Override requiere `decisionNote` obligatoria que queda en historial cross-empresa. Ejemplos válidos:

- "Reasigno a Agencia B porque A lleva 50 días sin actividad y B trae cliente caliente."
- "Mantengo a A pese a inactividad porque me ha avisado que está negociando."

Excepción donde NO hay override: visita ya realizada por A no se puede reatribuir a B (sería dolo). Solo soporte puede revertir esto a nivel DB.

### 5.5 · Cuándo avisar vs bloquear

| Situación | Acción del sistema |
|---|---|
| Cliente activo con visita programada futura | **Bloquea** creación duplicada · entra como `duplicado` automático |
| Cliente con atribución <14d | **Avisa** fuerte (banner rojo) · permite con confirmación |
| Cliente con atribución 14-44d | **Avisa** moderado (banner ámbar) · permite |
| Cliente con atribución ≥45d | **Avisa** suave (banner amarillo · "puede reasignarse") · permite |
| Cliente sin atribución | **Sin aviso** · flujo normal |
| Cliente registrado por la misma party <7d | **Bloquea** · es duplicado obvio del propio agente |

---

## TASK 6 · Impacto en UI

### 6.1 · Lista de contactos (`/contactos`)

**Hoy**: columna "Última actividad" con string humano.

**Propuesta**:
- Misma columna, ahora derivada de `lastActivityAt` (ISO).
- Color en background del pill según freshness (verde/ámbar/rojo).
- Hover → tooltip "{último evento} con {party} · {fecha exacta}".
- Filtro lateral nuevo · "Estado de actividad": activos / inactivos / dormidos.

### 6.2 · Detalle de Registro (`/registros/:id`)

**Banner contextual nuevo** que sustituye/complementa el actual `<CrossPromotionWarning>`:

```
┌────────────────────────────────────────────────────────┐
│  Atribución actual de este cliente                    │
│                                                        │
│  Agencia Norte · Aprobado el 12 mar 2026              │
│  Última actividad: llamada · hace 47 días 🔴          │
│  Inactividad supera el umbral · puedes reasignar      │
│                                                        │
│  [Ver histórico de actividad]                         │
└────────────────────────────────────────────────────────┘
```

Si el banner es para Phase 1 promoter ↔ agency, el copy ya es lo bastante genérico (substituye nombres).

### 6.3 · Warning de duplicado en form de creación

**Inline en `<ClientRegistrationDialog>`** al teclear email/teléfono:

```
🟠 Match (89%) con cliente en CRM
   Atribuido a Agencia Norte · sin actividad desde hace 47 días
   Tu registro entrará para revisión · puede reasignarse
   por inactividad.
   [ ] He revisado · continuar
```

### 6.4 · Flujo de preregistro

Sin cambios estructurales · solo el banner de §6.3 aplica también a preregistro. Diferencia única: si ya hay `preregistro_activo` con visita futura, el flujo bloquea (ver §5.5).

### 6.5 · Vista agencia (futura · cuando agencia sea owningParty)

Cuando una agencia sea owningParty (caso agency-agency o agency-direct):

- La agencia ve la lista de Registrations de su cartera con filtros idénticos al promotor hoy.
- Recibe paywall si su plan lo requiere (Phase 2 · monetización agencia activa).
- Ve banners contextuales con label "Otra agencia colaboradora" en lugar de "Otra agencia" cuando submittingParty es subcolaboradora.

### 6.6 · Vista owner (futura)

Cuando un owner es owningParty:

- UI más simple · 1 propiedad, pocos registros, raras conflictos.
- Banners con label "El propietario" en mensajes generados al rival.
- Owner aprueba registros igual que un promotor · flujo idéntico.
- En Phase 2 con plan owner 9€/mes los gates se aplican proporcionalmente.

### 6.7 · `<ActivityFreshness>` componente nuevo

Reusable en lista, ficha, banner, sidebar. Inputs: `party + contact`. Output: pill colored + tooltip con detalle. Lo consume cualquier UI que muestre actividad agregada.

---

## TASK 7 · Backend TODOs

### 7.1 · Schema changes

```sql
-- Renombrar / generalizar columnas
alter table registrations rename column developer_organization_id to owning_organization_id;
alter table registrations add column submitting_organization_id uuid not null references organizations(id);
alter table registrations add column relationship_type text not null check (
  relationship_type in (
    'developer-agency','developer-direct','owner-agency','owner-direct',
    'agency-agency','agency-direct'
  )
);
alter table registrations add column inventory_type text not null default 'promotion'
  check (inventory_type in ('promotion','property','listing'));
alter table registrations rename column promotion_id to inventory_id;

-- Phase 1 sigue funcionando: todos los rows existentes son
-- 'developer-agency' o 'developer-direct' con inventory_type = 'promotion'.

-- Activity tracking · nueva tabla
create table contact_party_activities (
  contact_id            uuid not null references contacts(id) on delete cascade,
  party_id              uuid not null references organizations(id) on delete cascade,
  party_kind            text not null check (party_kind in ('developer','agency','owner')),
  last_activity_at      timestamptz not null,
  last_activity_type    text not null,
  first_activity_at     timestamptz not null,
  activity_count        integer not null default 1,
  primary key (contact_id, party_id)
);
create index cpa_contact_idx on contact_party_activities(contact_id);
create index cpa_party_idx   on contact_party_activities(party_id, last_activity_at desc);
```

### 7.2 · Activity tracking

Endpoint y workers:

- `POST /api/contact-activities` · cualquier mutación que genere un evento de timeline llama internamente a `recordActivity(contact_id, party, event_type, occurred_at)`. Idempotente por `(contact_id, party_id, event_type, occurred_at)` con ventana ±1h.
- Backend cron `markStaleRegistrations` diario · marca `caducado` los `pendiente` >45d sin actividad.
- Backend cron `markStalePreregistrations` diario · marca `caducado` los `preregistro_activo` con visita pasada >7d sin outcome.
- Backend cron `notifyInactivityWarning` diario · genera notificaciones a la party dueña cuando un cliente alcanza 14d sin actividad ("Tu cliente {N} lleva 14 días inactivo · puede reasignarse a partir del día 45").

### 7.3 · Reglas de atribución

Función central server-side `resolveAttribution(contactId, candidateParty, inventoryRef)`:

1. Buscar Registrations activas del Contact en ese inventoryRef.
2. Si no hay → atribuir a `candidateParty` con `pendiente`.
3. Si hay con visita futura → bloquear · entrar como `duplicado`.
4. Si hay con `aprobado/preregistro_activo` → calcular daysSinceActivity para esa party.
5. Devolver decisión: `{ decision: "block" | "warn" | "allow", reason, days, otherParty }`.

El cliente consume este endpoint en el form de creación (`POST /api/registros/check-duplicates`) y en el banner del detalle.

### 7.4 · Notification events

Eventos del sistema relacionados con esta lógica (extiende la matriz de `registration-system.md §5`):

| Evento | Recipient | Trigger |
|---|---|---|
| `attribution.inactivity_warning` | submittingParty del Registration activo | El sistema detecta 14 días de inactividad |
| `attribution.dormant_warning` | idem | 30 días (recordatorio fuerte) |
| `attribution.eligible_for_reassignment` | owningParty | 45 días sin actividad de la party atribuida |
| `attribution.reassigned` | party que pierde + party que gana | Owning hace override por inactividad |
| `attribution.blocked_by_visit` | submittingParty entrante | Tu registro se bloqueó por visita ajena programada |

---

## TASK 8 · Open questions

1. **¿`web_activity` cuenta como actividad de la party?** · Propuesta: NO. La visita web del cliente al microsite no es esfuerzo del agente. Se mantiene en timeline pero no actualiza `lastActivityAt` de la party.
2. **Reasignación retroactiva con comisión** · si owningParty reasigna por inactividad, ¿la party A pierde TODA la comisión o solo la de la siguiente venta? Open · depende de contrato de colaboración. Default Phase 1: pierde toda. Cláusula obligatoria en contrato.
3. **Override sin nota** · ¿se permite forzar el override saltándose `decisionNote`? Propuesta: NO en producción. Sí en cuentas demo/test (flag `bypass_decision_note`).
4. **Días personalizables por workspace** · ¿el promotor puede configurar el umbral 45 días en `/ajustes/empresa/`? Propuesta: Phase 2. Phase 1 hardcoded a 45.
5. **Multi-inventario por Registration** · ¿una Registration puede cubrir varias propiedades del mismo owner? Propuesta: NO · una Registration = un inventoryRef. Si el cliente quiere ver 3 propiedades, son 3 Registrations.
6. **Cuándo `validezRegistroDias` de la promoción gana sobre los 45 días genéricos** · Propuesta: si la promo lo configura explícitamente, manda. Si lo deja en 0 (no expira) o por defecto, aplica 45 genérico.
7. **¿`partyActivities` se purga cuando un Contact se borra?** · Sí · `on delete cascade`.
8. **Performance** · ¿`partyActivities` puede crecer indefinidamente? Cap teórico = nº de organizations que han tocado a ese cliente · típicamente < 5. No hay riesgo Phase 1. Si en 5 años un cliente acumula 50 entries, archivar las inactivas >2 años a tabla cold.

---

## Resumen ejecutivo

### Estado actual
- `Registro` asume binario `direct | collaborator` · imposible expresar las 3 nuevas relaciones.
- `Contact.lastActivity` es string humano sin timestamp ISO · imposible calcular inactividad arithmetic.
- No hay tracking per-party de actividad · una agencia que lleva 50 días sin tocar al cliente queda igual de "fresh" en UI que una activa.

### Cambios mínimos para Phase 1
- Mantener Phase 1 (developer ↔ agency) funcional.
- Añadir helper `recordActivity()` y campo `Contact.lastActivityAt: ISO` (sin per-party aún).
- UI muestra freshness con colores en lista y ficha (sin distinguir party · una sola "última actividad").
- Documentar este modelo genérico para que Phase 2+ sea refactor en lugar de rewrite.

### Cambios para Phase 2 · cuando lleguen owners y agency-as-host
- Tabla `contact_party_activities` per-party.
- Renombrar `developer_organization_id` → `owning_organization_id`.
- Añadir `submitting_organization_id` y `relationship_type`.
- `inventoryRef` polimórfica (promotion / property / listing).
- Componente `<ActivityFreshness party={...}>` reusable.
- Banners contextuales con labels variables según `kind` de cada party.

### Anti-overengineering · NO hacer ahora
- ❌ Renombrar columnas en Phase 1 · romperíamos el frontend trabajando.
- ❌ Tabla `parties` separada de `organizations` · solapamiento sin valor.
- ❌ Polimorfismo de `inventoryRef` antes de tener owner/property reales · YAGNI.
- ❌ Configuración de umbrales 45d por workspace · post-validación de fase.
- ❌ ML para detectar patrones de actividad · regla simple basta.

---

## Referencias

- `src/data/records.ts:135-210` · Registro actual.
- `src/components/contacts/types.ts:39-109` · Contact actual.
- `src/components/contacts/types.ts:310-359` · ContactTimelineEventType (eventos disponibles).
- `docs/registration-system.md` · sistema de registro completo.
- `docs/portal-leads-integration.md` · portales y atribución.
- `docs/contact-origins-audit.md` · orígenes acumulativos del Contact.
- `docs/backend-integration.md §12` · contrato actual del backend Phase 1.
