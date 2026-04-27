# Portal leads · integración con el sistema de registro

> Documento de diseño · cómo encajan los leads externos (Idealista,
> Fotocasa, Habitaclia, microsite, llamadas, walk-ins) con el modelo
> de registro/preregistro/contacto.
>
> Principio rector: **simplicidad sobre perfección técnica.** El
> promotor debe poder explicar el sistema en una frase.

---

## TASK 1 · Estado actual

### 1.1 · Entidades existentes

Hay **3 entidades paralelas** sin conexión robusta:

| Entidad | Ubicación | Para qué |
|---|---|---|
| `Lead` | `src/data/leads.ts` | Entrada cruda · portal, microsite, agencia, walk-in, call. Pipeline propio (solicitud → ganada). |
| `Registro` | `src/data/records.ts` | Cliente registrado a nombre de agencia o promotor en una promoción concreta. Flujo de aprobación. |
| `Contact` | `src/components/contacts/types.ts` | Persistencia CRM del cliente. `sourceType: registration\|portal\|direct\|import`. |

### 1.2 · Por origen del lead

#### Portales (Idealista, Fotocasa, Habitaclia)

- En el seed (`src/components/contacts/data.ts:51, :180`) aparecen como **`Contact` con `sourceType: "portal"`**.
- **NO crean `Registro`.** Llegan directos al CRM sin pasar por aprobación.
- **NO cuentan en el paywall** (el counter `acceptRegistro` mira solo `registrations` table).
- **NO entran en la detección de duplicados** del sistema de registros · `findPendingDuplicate` solo cruza con otros `Registro`. La detección "agencia A registra cliente que ya estaba en CRM por portal" hoy queda en manos de `upsertContactFromRegistro` (que SÍ cruza con todos los Contacts).
- Asignados al promotor por defecto · sin agencia.

#### Microsite del promotor

- Igual que portales: previsto como `Contact` con `sourceType: "portal"` o `"direct"`.
- En `Lead.source` existe `"microsite"` como valor enum, pero no hay flujo que cree el Lead automáticamente en el prototipo · es seed estático.

#### Llamadas / walk-ins / contacto directo

- En `Lead.source` existen `"call"`, `"walkin"`, `"whatsapp"`, `"referral"`.
- En la práctica, el promotor que recibe un walk-in usa "Registrar cliente · Directo" en una promoción → crea un `Registro` con `origen: "direct"`, `agencyId: undefined`, `origenCliente: "Idealista" | "Referido" | ...` (campo string libre).
- Este `Registro` **SÍ pasa por el flujo de aprobación** (auto-aprobable por el propio promotor) y **SÍ cuenta en el paywall**.

### 1.3 · Respuestas a las 5 preguntas

1. **¿Crean `Registro` o `Contacto`?**
   - Portales: solo `Contact` (no Registro).
   - Microsite: solo `Contact` (en teoría · sin flujo real implementado).
   - Walk-in/llamada gestionado por promotor: típicamente `Registro` directo → `Contact` al aprobar.

2. **¿Pasan por aprobación?**
   - Portales/microsite: **NO**. Llegan directos al CRM.
   - Walk-in/llamada vía "Registrar cliente": **SÍ**, por el flujo de aprobación normal.

3. **¿Cuentan al paywall (`acceptRegistro`)?**
   - Portales/microsite: **NO** (no hay Registro).
   - Walk-in/llamada vía Registrar cliente: **SÍ** (cuenta como cualquier registro recibido).

4. **¿A quién se asignan?**
   - Portales/microsite: **al promotor** automáticamente (sin `agencyId`).
   - Walk-in/llamada vía Registrar: al promotor (`origen: "direct"`).

5. **¿Participan en detección de duplicados?**
   - Detección intra-promoción (`findPendingDuplicate`): solo entre `Registro`s. Los Contacts no se ven · GAP.
   - Cross-promo warning: solo entre `Registro`s aprobados de otras promociones · GAP.
   - Upsert al aprobar (`upsertContactFromRegistro`): SÍ cruza con todos los Contacts (incl. portal). Si match → no crea Contact nuevo, añade evento al existente. Pero el Registro entra normal igualmente · no se marca como conflicto.

### 1.4 · Problemas / inconsistencias

1. **Inconsistencia conceptual** · "Lead" y "Registro" son dos pipelines diferentes que tratan al mismo cliente como entidades distintas.
2. **Detección incompleta** · una agencia puede registrar un cliente que ya está en CRM como portal lead, sin warning real al promotor antes de aprobar.
3. **Counter del paywall asimétrico** · si el promotor "regulariza" un portal lead creando un Registro, esa acción cuenta · pero el lead inicial no contaba. El mismo cliente puede consumir 0 o 1 cupos según cómo entre.
4. **`origenCliente` es string libre** · "Idealista" / "Referido" / "Web propia" no están normalizados con el enum `LeadSource`. Dos sistemas para lo mismo.
5. **El concepto de "Lead" en el prototipo no está conectado al flujo de Registros** · el pipeline `Lead.status` (solicitud → ganada) y `Registro.estado` (pendiente → aprobado) son universos disjuntos.

---

## TASK 2 · Decisión de modelo de negocio

### 2.1 · Cómo se trata cada origen

Propuesta canónica · **simple, una regla clara por origen**:

| Origen | Crea | Aprobación | Asignado a | Cuenta paywall |
|---|---|---|---|---|
| Portal (Idealista, Fotocasa, Habitaclia) | `Contact` (sourceType: portal) | NO | Promotor | NO |
| Microsite del promotor | `Contact` (sourceType: portal) | NO | Promotor | NO |
| Llamada / WhatsApp / walk-in del promotor | `Contact` (sourceType: direct) | NO (ya gestionado por él) | Promotor | NO |
| Registro directo del promotor en una promo (botón "Registrar cliente") | `Registro` (origen: direct) | Auto-aprobado | Promotor | NO ← cambio propuesto |
| Registro/preregistro de agencia | `Registro` (origen: collaborator) | SÍ | Agencia | **SÍ** |

**Regla simple para el promotor**:
> *"Byvaro cobra por gestionar la red de agencias. Tus propios leads —
> portales, microsite, walk-ins — no cuentan."*

### 2.2 · Por qué este modelo

1. **El paywall mide colaboración**, no marketing del promotor. Si un promotor invierte en Idealista, Byvaro no le penaliza por ello.
2. **Los leads del promotor NO compiten con la red.** Son su pool propio. La red de agencias es un canal adicional, no superpuesto.
3. **Cuando un mismo cliente aparece por dos canales** (portal Y agencia), se aplica la regla de prioridad · pero el ownership lo decide la EJECUCIÓN (ver §4).
4. **Reduce gaming**: si el promotor pudiera "crear leads como portal" para evitar paywall, sí · pero no le aporta nada porque esos leads no tienen agencia asignada (no hay comisión que pagar). El gaming no rompe el modelo.

### 2.3 · Interacción con detección de duplicados

- **Portal/direct lead crea Contact**. Si después una agencia registra un cliente con mismo email/teléfono normalizados:
  - El sistema detecta el match al cruzar con Contacts existentes.
  - **Banner al promotor (al revisar)**: "Este cliente ya estaba en tu CRM como lead de Idealista del 12/abr. La agencia X ahora lo registra y propone visita."
  - **Decisión del promotor**: aprobar el Registro de la agencia (la agencia ejecuta visita → gana atribución) o rechazar (el lead ya era suyo, no quiere comisión).
- **Si el promotor ya tenía visita programada con ese contacto** y una agencia registra después: el promotor decide. No hay regla auto que destruya su trabajo previo.

### 2.4 · Interacción con preregistro

- Portal leads NO crean preregistro · son contactos sueltos.
- Si una agencia preregistra un cliente que ya está en CRM como portal lead → flujo normal de preregistro. El promotor ve el contexto al revisar ("Este cliente vino por Idealista hace 2 semanas").
- La regla de prioridad por visita realizada se aplica solo entre Registros (no afecta a portal leads que no tienen Registro asociado).

### 2.5 · Interacción con regla de prioridad por visita

Sin cambios respecto al modelo de §4 del doc `registration-system.md`. Los portal leads no entran en el ranking de prioridad porque no son Registros · son Contacts informativos.

---

## TASK 3 · Modelo unificado

### 3.1 · Single source of truth

**`Contact` es el cliente.** Una persona física = un Contact.

**`Registro` es una atribución** = "esta agencia/promotor reclama este Contact en esta promoción". Múltiples Registros por Contact son posibles (cross-promo) y normales.

**`Lead` (la entidad de `data/leads.ts`) se elimina como concepto separado** · su rol lo absorbe `Contact`. Las propiedades específicas de "lead aún no cualificado" (status del pipeline comercial, etc.) viven en el Contact directamente.

> Ya hay un movimiento en esta dirección: `ADR-053 · Pipeline unificado dentro de Lead (sin entidad Oportunidad)`. La siguiente iteración es absorber `Lead` en `Contact`.

### 3.2 · Entry points unificados

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ENTRADA                       EFECTO                   │
│  ─────────────────────────────────────────────────────  │
│  Portal API webhook         →  Contact (sourceType: portal)  │
│  Microsite form submit      →  Contact (sourceType: portal)  │
│  Promotor walk-in/call      →  Contact (sourceType: direct)  │
│  Excel/CSV import           →  Contact (sourceType: import)  │
│  Promotor "Registrar"       →  Registro auto-aprobado +      │
│   en promo                       Contact (upsert)            │
│  Agencia "Registrar"        →  Registro pendiente aprobación │
│   en promo                                                   │
│  Agencia "Preregistrar"     →  Registro tipo registration_   │
│   con visita                     visit pendiente              │
│                                                              │
└─────────────────────────────────────────────────────────┘
```

### 3.3 · Conversion path

```
Lead crudo (Contact)
    ↓ (interacción comercial · email, llamada, visita)
Cualificado (Contact con status="active")
    ↓ (algún canal le asigna a una promoción concreta)
Registro pendiente / preregistro_pendiente
    ↓ (promotor aprueba)
Registro aprobado / preregistro_activo
    ↓ (visita realizada · si era preregistro)
Cliente formalmente registrado a nombre de la agencia
    ↓ (reserva firmada)
Venta cerrada
```

Cada paso queda registrado en el timeline del Contact (regla de oro CLAUDE.md "Historial del contacto").

---

## TASK 4 · Reglas de prioridad con portales

### 4.1 · Caso 1 · Portal lead entra primero, después agencia registra el mismo cliente

**Contexto**: Cliente Pedro envía formulario en Idealista para Promo A · queda como Contact `sourceType: portal`. 5 días después, Agencia Norte registra a Pedro en Promo A.

| Momento | Estado del sistema |
|---|---|
| T0 | Contact Pedro existe · `sourceType: portal` · sin Registro asociado |
| T+5d | Agencia Norte intenta crear Registro |

**Quién gana**: la **agencia**, sujeto a aprobación del promotor.

**Por qué**:
- Un portal lead es solo un "showed interest" sin trabajo posterior.
- La agencia trae verificación + ejecución.
- El promotor recibe banner "Cliente ya estaba en CRM (Idealista, hace 5 días)" al revisar · puede:
  - Aprobar (la agencia se gana la comisión).
  - Rechazar (el promotor ya estaba contactando · no quiere ceder).

**Qué muestra el sistema al promotor**:
> "Pedro García · ya en tu CRM desde el 12/abr (Idealista). Agencia Norte
> lo registra ahora · revisa antes de aprobar para no duplicar contacto."

### 4.2 · Caso 2 · Agencia preregistra con visita, después llega portal lead del mismo cliente

**Contexto**: Agencia Norte preregistra a Pedro en Promo A con visita el 28/abr. Día 25/abr, Pedro envía formulario en Fotocasa.

| Momento | Estado |
|---|---|
| T0 | Registro `preregistro_activo` de Agencia Norte · visita 28/abr |
| T+? | Portal lead crea Contact match (Fotocasa) |

**Quién gana**: **la agencia mantiene el preregistro** (visita programada).

**Qué muestra el sistema**:
- Al promotor: notificación "Pedro tiene preregistro activo de Agencia Norte (visita 28/abr) · ahora también ha mostrado interés vía Fotocasa. Considéralo señal de calidad del lead."
- El portal lead NO crea otro Contact (upsert por email/teléfono → mismo Contact con timeline enriquecido: "Visto en Fotocasa el 25/abr").
- Si la visita del 28/abr se realiza → preregistro pasa a `aprobado`. Comisión agencia.
- Si no se realiza en plazo → preregistro caduca · el Contact queda libre · el promotor puede contactarlo via canal Fotocasa.

### 4.3 · Caso 3 · Portal lead entra, después agencia completa visita

**Contexto**: Pedro entra como Contact por Idealista. Agencia Norte preregistra después con visita · realiza visita.

**Quién gana**: la **agencia** (ejecutó visita · regla de prioridad principal).

**Qué muestra el sistema**:
- Al promotor: "Visita realizada por Agencia Norte · Pedro queda formalmente registrado a su nombre. Lead inicial vino por Idealista (info contextual)."
- Comisión: agencia.
- Timeline del Contact: ambas fuentes (Idealista + agencia) quedan en historial.

### 4.4 · Caso 4 · Promotor registra manualmente después de portal lead

**Contexto**: Pedro entra por Idealista. El promotor lo gestiona internamente (llama, propone visita) y al final usa "Registrar cliente · Directo" en Promo A.

**Quién gana**: el **promotor** (no hay agencia involucrada).

**Qué pasa**:
- Se crea Registro `origen: direct` auto-aprobado.
- Contact existente recibe upsert (no duplicar).
- Comisión: ninguna (es captación propia).
- **NO cuenta al paywall** (regla §2.1 propuesta).

### 4.5 · Caso 5 · Múltiples agencias + portal lead

**Contexto**: Pedro entra por Idealista. Agencia Norte preregistra el día 10. Agencia Sur intenta registrar el día 12.

**Quién gana**:
- Aplican las reglas de §4 del doc `registration-system.md`:
  1. Visita realizada (si la hay) gana.
  2. Aprobado existente.
  3. Preregistro_activo (Agencia Norte).
  4. Pendiente por timestamp (first-come).
- En este caso: Agencia Norte tiene preregistro_activo · gana sobre Agencia Sur. Sur entra como `duplicado`.
- El portal lead no afecta al ranking · es solo info contextual.

**Qué muestra el sistema al promotor**:
> "Conflicto detectado · Pedro:
> - 25/abr · Lead Idealista (info)
> - 10/may · Preregistro Agencia Norte (visita 15/may)
> - 12/may · Registro Agencia Sur (entra como duplicado)
> Agencia Norte tiene prioridad por preregistro previo con visita."

---

## TASK 5 · Impacto en paywall

### 5.1 · Reglas finales propuestas

El counter `acceptRegistro` cuenta SOLO:
- `Registro` con `origen === "collaborator"` (de agencia).
- En CUALQUIER estado (pendiente / preregistro_activo / aprobado / rechazado / duplicado / desplazado / caducado).

NO cuenta:
- `Contact` creados por portal/microsite/import.
- `Registro` con `origen === "direct"` (del promotor).

### 5.2 · Por qué este cambio respecto al estado actual

Hoy el counter cuenta TODOS los Registros incluyendo los `direct`. Implicación: si el promotor recibe un walk-in y lo registra él mismo, gasta cupo. Esto es:

- **Anti-product**: el promotor paga por leads que nunca pasaron por una agencia.
- **Confuso**: "¿por qué sube mi contador si no he involucrado a una agencia?"
- **Anti-validación**: distorsiona la métrica de "qué valor entrega Byvaro al promotor" (la red de agencias, no el formulario de registro).

### 5.3 · Cambio mínimo en código

En `src/lib/usage.ts::countRegistros`:

```ts
// ANTES:
return createdCount + SEED_REGISTROS.length;

// DESPUÉS (propuesta):
const created = useCreatedRegistros();
const all = [...created, ...SEED_REGISTROS];
return all.filter(r => r.origen === "collaborator").length;
```

Y mismo filtro para Phase 1B backend en `workspace_usage()`:
```sql
(select count(*)::int from registrations
   where developer_organization_id = p_org
   and origen = 'collaborator')
```

### 5.4 · ¿Y si una agencia "registra" un portal lead que el promotor le pasa?

- Si la agencia crea un Registro `origen: collaborator`: cuenta. Es válido · la agencia lo está gestionando, hay comisión que tracking.
- Si el promotor solo "asigna" un Contact a un agente sin crear Registro: no cuenta. Es solo asignación interna de equipo.

---

## TASK 6 · Output consolidado

### 6.1 · Comportamiento actual · resumen

- 3 entidades paralelas (Lead, Registro, Contact) sin conexión robusta.
- Portal/microsite leads → `Contact` con `sourceType: "portal"` · sin Registro · sin paywall · asignados al promotor.
- Promotor walk-in/call vía "Registrar cliente" → `Registro` `origen: direct` · cuenta paywall (problemático).
- Detección de duplicados solo intra-Registros · no cruza con Contacts.
- `Lead.source` y `Registro.origenCliente` son dos taxonomías paralelas.

### 6.2 · Problemas identificados

1. Counter del paywall pena al promotor por sus propios leads.
2. Detección incompleta · agencia puede registrar un Contact ya en CRM por portal sin warning.
3. Dos taxonomías de origen no normalizadas.
4. `Lead` como entidad separada introduce overhead conceptual sin valor claro.

### 6.3 · Modelo unificado propuesto

| Entidad | Significado |
|---|---|
| `Contact` | El cliente · una sola entidad por persona física · todas las fuentes upsertean aquí |
| `Registro` | Atribución agencia/promotor → cliente → promoción · counts paywall solo si `origen: collaborator` |

`Lead` desaparece como entidad separada · sus campos relevantes (status comercial, source) se absorben en `Contact`. Phase 2 · no urgente.

### 6.4 · Reglas claras por entidad

#### `Contact`
- Único por (email normalizado) OR (teléfono normalizado).
- `sourceType` registra primer origen (portal / direct / registration / import).
- Timeline acumula todas las interacciones (regla CLAUDE.md "Historial del contacto").
- Asignado al promotor por defecto · puede tener `assignedToUserIds` (agentes del equipo).
- `ownerAgencyId` solo cuando vino por Registro de agencia · privacidad cross-tenant.

#### `Registro`
- Una promoción + una agencia (o promotor directo) + un Contact.
- Estados: `pendiente`, `preregistro_pendiente`, `preregistro_activo`, `aprobado`, `rechazado`, `duplicado`, `desplazado`, `caducado`.
- Cuenta paywall **solo si `origen: collaborator`**.

#### `Preregistro`
- No es una entidad separada · es un `Registro` con `tipo: registration_visit` y `estado: preregistro_pendiente|preregistro_activo`.
- Aplica solo cuando `Promotion.modoValidacionRegistro === "por_visita"`.

### 6.5 · Reglas de prioridad incluyendo portales

Mantener las 5 niveles de `registration-system.md §4`:
1. Visita realizada
2. Aprobado
3. Preregistro_activo con visita futura
4. Pendiente por timestamp (first-come)
5. Sin atribución (duplicado/desplazado/caducado/rechazado)

**Los portal leads no entran en el ranking** · son contexto informativo del Contact. Cuando una agencia registra un Contact que ya tenía portal lead, el banner informa al promotor pero no cambia el flujo.

### 6.6 · Implicaciones paywall

- Counter `acceptRegistro` filtrado a `origen: collaborator`.
- Promotor no paga por su propio marketing · paga por gestión de red.
- Frase canónica para marketing: *"Byvaro cobra por gestionar la red de agencias. Tus propios leads — portales, microsite, walk-ins — son tuyos sin coste."*

### 6.7 · Simplificación recomendada (anti-overengineering)

**Lo que cambia · mínimo viable**:

1. **`countRegistros()` filtra `origen: collaborator`** · 1 línea de cambio en `src/lib/usage.ts`. Cero cambio UI · cero cambio modelo.
2. **Banner contextual al aprobar** · cuando el Registro entrante matchea con un Contact existente vía email/teléfono, mostrar info "Cliente ya en CRM desde {fecha} ({source})". Reusable: ya hay infra (`CrossPromotionWarning` patrón). Phase 1B backend.
3. **Documentar** la regla "portales no cuentan" en CLAUDE.md sección "Paywall" + en la página `/ajustes/facturacion/plan` (subtitle).

**Lo que NO cambia ahora · queda Phase 2+**:

1. Eliminar `Lead` como entidad separada · refactor grande, no necesario hoy.
2. Normalizar `origenCliente` con `LeadSource` enum · cosmético.
3. Webhooks reales de portales · backend integration · post-validación paywall.
4. UI tabs específicos para "leads no cualificados" · ya hay `/leads` página · suficiente.

---

## Cambios mínimos necesarios

| Archivo | Cambio | Prioridad |
|---|---|---|
| `src/lib/usage.ts::countRegistros` | Filtrar `origen === "collaborator"` antes de contar | Alta · 1 línea · cambia el counter en cliente |
| `docs/backend-integration.md §12.3` | Actualizar SQL del backend con `WHERE origen = 'collaborator'` | Alta · spec backend |
| `CLAUDE.md` Phase 1 §2 | Añadir frase "portal leads y registros directos NO cuentan al paywall" | Media · documentación |
| `src/pages/ajustes/facturacion/plan.tsx` | Subtítulo "Solo cuentan registros de agencias colaboradoras" en card "Uso del workspace" | Baja · transparencia |
| `docs/screens/registros.md` | Documentar el filtro en spec | Baja · doc |

---

## Riesgos / open questions

1. **¿Y si el promotor mueve un walk-in a una agencia para que lo gestione?** · Si crea Registro `origen: collaborator` con esa agencia → cuenta. Coherente. El promotor decide si vale la pena ceder comisión a cambio de no consumir cupo.
2. **¿Y si una agencia "scrapea" un portal lead y lo registra como suyo?** · Detección de duplicados al crear avisará al promotor (banner "ya en CRM como Idealista"). Decisión final del promotor.
3. **¿`origen: direct` podría usarse para gaming?** · Si el promotor pone todos los leads de agencias como `direct` para no consumir cupo, pierde la atribución a la agencia (no podrá pagar comisión sin trace). El gaming se auto-castiga.
4. **Microsite del promotor** · ¿forms del microsite van como `Contact sourceType: portal` o `direct`? Propuesta: `direct` (es canal propio, no portal externo). Define en helper de creación.
5. **WhatsApp inbound** · ¿qué entidad? Propuesta: `Contact sourceType: direct`. Si después se vincula a una promoción concreta vía Registro → cuenta paywall solo si involucra agencia.
6. **Importaciones masivas (CSV/Excel)** · `Contact sourceType: "import"` · NO crean Registros · NO cuentan paywall. Confirmado.
7. **Multi-canal del mismo cliente** · Pedro vuelve por Fotocasa habiendo entrado antes por Idealista. Upsert por email/teléfono · Contact único · timeline acumula ambas fuentes. No duplica.

---

## Referencias

- `src/data/leads.ts` · entidad Lead actual.
- `src/data/records.ts` · Registro + `origenCliente` string.
- `src/components/contacts/types.ts:21` · `ContactSourceType` enum.
- `src/components/contacts/data.ts:51, :180` · seeds con `sourceType: "portal"`.
- `src/lib/registroContactLink.ts` · upsert al aprobar (cruza con todos los Contacts).
- `src/lib/usage.ts` · counter actual sin filtro de origen.
- `docs/registration-system.md` · spec del sistema de registro.
- `docs/backend-integration.md §12` · contrato Phase 1 backend.
- `DECISIONS.md` ADR-053 · pipeline unificado en Lead.
