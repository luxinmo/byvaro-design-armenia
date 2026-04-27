# Sistema de registro de clientes · auditoría + lógica final

> Documento de diseño del **pilar core** de Byvaro: cómo se registran
> los clientes, cómo se detectan duplicados, cómo se resuelven conflictos
> entre agencias y cómo el preregistro con visita gana prioridad sobre
> registros posteriores.
>
> No implementa código · es spec para la próxima implementación.

---

## TASK 1 · Auditoría del estado actual

### 1.1 · Registro de cliente

**Identificación**: `RegistroCliente` (`src/data/records.ts:51-66`)

| Campo | Estado | Notas |
|---|---|---|
| `nombre` | obligatorio | string libre, sin canonicalización |
| `telefono` | obligatorio | string libre · solo se normaliza al detectar duplicados |
| `nacionalidad` | obligatorio | string en español + emoji `flag` opcional |
| `email` | opcional | solo si la promoción tiene `"email_completo"` en `condicionesRegistro` |
| `dni` | opcional | excluido por diseño en fase registro (GDPR · solo en reserva) |

**Configurable por promoción** vía `condicionesRegistro: CondicionRegistro[]` en wizard (`ColaboradoresStep.tsx`).

**Creación**: `addCreatedRegistro()` en `src/lib/registrosStorage.ts` · localStorage clave `byvaro.registros.created.v1`. Disparado desde `ClientRegistrationDialog.tsx::handleConfirmDirect` cuando agencia o promotor pulsan "Registrar cliente" en una ficha de promoción.

**Atribución**:
- `accountType === "agency"` → `origen: "collaborator"`, `agencyId: currentUser.agencyId` (auto). Hardening: aborta con toast si `agencyId` es falsy.
- `accountType === "developer"` → `origen: "direct"`, sin `agencyId`, con `origenCliente` (Idealista/Web/Referido/etc.).

### 1.2 · Detección de duplicados

`findPendingDuplicate()` (`src/lib/registrosStorage.ts:63-76`):

- Solo detecta dentro de **la misma promoción** (`r.promotionId === input.promotionId`).
- Solo entre registros con `estado === "pendiente"`.
- Match: email normalizado (`trim().toLowerCase()`) **OR** teléfono normalizado (solo dígitos).
- Devuelve el primer match encontrado · no calcula score.

**`matchPercentage` (0-100)** existe en el modelo pero es **estático en el seed** · no hay calculo en cliente. Pensado para que la IA del backend lo rellene.

### 1.3 · Cross-promotion warning

`CrossPromotionWarning.tsx`:

- Disparado en el detalle de un registro pendiente.
- Busca registros con `estado === "aprobado"` en **otras** promociones del workspace con mismo email/teléfono normalizados.
- Devuelve hasta 3 hits · banner rojo "Posible conflicto cross-promoción".
- **Solo aviso visual** · no bloquea ni silencia el registro.

### 1.4 · First-come logic

Regla **"first-come silent"** en `addCreatedRegistro()`:

- Si `findPendingDuplicate(r)` devuelve un ganador previo:
  - El nuevo registro entra con `estado: "duplicado"`, `matchPercentage: 100`, `matchWith: "Registrado primero por {winnerId}"`, `matchCliente: { ...winner.cliente }`.
  - **No se notifica a ninguna agencia** · es lógica interna.
  - El promotor solo ve el ganador en pendientes; el perdedor aparece solo si filtra por estado `duplicado`.
- Si NO hay match: registro entra como `pendiente` normal con `matchPercentage: 0`.

### 1.5 · Approval / rejection flow

State machine en `Registros.tsx::startApprove` y `advanceApproval`:

```
START → (nextStageFor "start")
  ├─ visit_only         → "visit"          → approve()
  ├─ matchPercentage≥65 → "match"          → "relation"? → "visit"? → approve()
  ├─ possibleRelation   → "relation"       → "visit"? → approve()
  ├─ registration_visit → "visit"          → approve()
  └─ default            → approve()
```

Componentes: `MatchConfirmDialog`, `RelationConfirmDialog`, `VisitConfirmDialog`, `RejectDialog` (todos en `ApprovalDialogs.tsx`).

`approve()` muta:
- `estado: "aprobado"`, `decidedAt`, `decidedByUserId`, `decidedBy`, `decidedByRole`.
- Si `tipo === "registration_visit"` y hay visita linkada → `onRegistroApproved()` confirma la visita en calendario.
- `upsertContactFromRegistro()` crea/actualiza Contact en CRM.

Footer del detalle:
- `pendiente` → botones Aprobar / Rechazar.
- Decidido + 5min de gracia → `<GracePeriodBanner>` con countdown + "Revertir".
- Decidido + post-gracia → `<DecidedStatus>` pill final ("Aprobado · agencia notificada · ya no se puede revertir").

**Solo developer aprueba**. `canDecide = !viewerIsAgency && estado === "pendiente"`.

### 1.6 · Preregistration flow

**Estado actual: NO existe como concepto técnico.**

- En `ColaboradoresStep.tsx:299` el wizard muestra copy descriptivo "El cliente queda como preregistro reservado a nombre del colaborador. La reserva se confirma definitivamente tras la primera visita." · **es texto, no comportamiento**.
- **No hay toggle** que controle esa regla.
- **No hay estado** `"preregistro"` en `RegistroEstado` (solo `pendiente | aprobado | rechazado | duplicado`).
- **No hay transición** "visita realizada → registro confirmado".
- **No hay diferenciación** entre registro "directo" y registro "por visita".

`grep preregistr` solo aparece una vez en todo el repo: en el copy descriptivo del wizard.

### 1.7 · Visit-related registration

Tres tipos en `RegistroTipo` (`src/data/records.ts:78`):

| Tipo | Significado | Comportamiento |
|---|---|---|
| `"registration"` | Registro sin visita | Default · aprobar registra al cliente. |
| `"registration_visit"` | Registro + visita propuesta | Misma promoción · aprobar registra Y confirma visita en calendario (`onRegistroApproved`). Lleva `visitDate` + `visitTime`. |
| `"visit_only"` | Solo visita · cliente ya estaba aprobado | Apunta a `originRegistroId`. Salta match/relation y va directo a `VisitConfirmDialog`. Cliente ya es del workspace, solo se programa visita nueva. |

`registroVisitaLink.ts`:
- `onRegistroApproved(id)` busca visita con `registroId === id` y la confirma.
- `createVisitFromRegistro(reg)` crea entrada en calendario al aprobar `registration_visit`.

**No existe** la transición "visita realizada → upgrade del registro a confirmado". El registro es `aprobado` desde el momento que el promotor decide; la visita es un evento separado en el calendario.

### 1.8 · Notificaciones

**Solo toasts client-side** (Sonner). NO hay sistema real de notificaciones · ni in-app, ni email, ni WhatsApp.

Toasts emitidos:
- `ClientRegistrationDialog.tsx:630` "Registro enviado" al agente que registró.
- `ClientRegistrationDialog.tsx:822` "Registro creado" + "X recibirá la notificación" (mensaje aspiracional · no envía nada).
- `Registros.tsx:411` "Registro aprobado · 5 min para revertir antes de notificar a la agencia" (la "notificación" no se envía · solo el toast lo dice).
- `Registros.tsx:467` "N registros aprobados · Notificaciones enviadas" (idem · texto sin envío).
- `Registros.tsx:448` "Match descartado".

**TODO(backend)** apuntan a:
- `POST /api/records/:id/approve|reject` programa notificación con delay 5min y cancela si llega `/revert`.
- Email a la agencia + push in-app · ninguno implementado.

### 1.9 · Qué ve la agencia

- Lista filtrada por `agencyId === currentUser.agencyId` en `/registros`.
- Detalle del registro completo, **pero NO el footer Aprobar/Rechazar** (`canDecide` es false).
- En `<DuplicateResult>` ve la comparación side-by-side · campos sensibles del otro cliente quedan visibles (no hay redacción cross-tenant aún).
- Cross-promo warning: NO se le muestra · es info estratégica del promotor.
- En ficha de promoción: botón "Registrar cliente" cuando colabora.

### 1.10 · Qué ve el promotor

- Todos los registros del workspace (sin filtro de agencia).
- Detalle completo + footer Aprobar/Rechazar si pendiente.
- `<DuplicateResult>`, `<CrossPromotionWarning>`, `<PossibleRelation>` flow completo.
- Banner verde "Sin coincidencias · seguro aprobar" cuando `matchPercentage === 0` y pendiente.
- `<UsagePill>` ámbar y modal del paywall en `acceptRegistro`.
- Filtros por estado, agencia, nacionalidad, promoción, origen, fecha.
- Tab "Duplicados" con los rechazados por first-come silent.

---

## TASK 2 · Lógica de negocio ideal

### 2.1 · Ampliación del modelo

**`RegistroEstado`** extendido:

```ts
type RegistroEstado =
  | "preregistro_pendiente"   // creado por agencia, esperando aprobación promotor
  | "preregistro_activo"      // aprobado por promotor, esperando que se realice visita
  | "pendiente"               // registro normal, esperando aprobación promotor
  | "aprobado"                // formalizado · cliente del workspace
  | "rechazado"               // promotor rechazó
  | "duplicado"               // first-come silent: otra agencia ya tenía pending
  | "desplazado"              // perdió por visita ajena completada antes
  | "caducado"                // preregistro_activo expiró sin visita
```

**`Promotion`** gana toggle:

```ts
modoValidacionRegistro: "directo" | "por_visita"
// directo · pendiente → aprobado (hoy)
// por_visita · pendiente → preregistro_activo → aprobado (tras visita)
```

**`Registro`** gana campos de auditoría de visita:

```ts
visitConfirmedAt?: string   // ISO · cuándo se confirmó la visita programada
visitCompletedAt?: string   // ISO · cuándo el agente registró la visita realizada
visitOutcome?: "realizada" | "no_show" | "reprogramada"
// expirationAt?: string    // ISO · derivado de promo.validezRegistroDias
```

### 2.2 · Flujo · registro normal (modo `directo`)

1. Agencia/promotor pulsa "Registrar cliente" en ficha de promoción.
2. `findPendingDuplicate()` se ejecuta · si match intra-promoción → `duplicado` silencioso (regla actual).
3. Si no hay match → entra como `pendiente`.
4. Promotor recibe notificación in-app + email.
5. Promotor decide:
   - **Aprobar** → `aprobado`. Notificación a agencia. Counter `acceptRegistro` +1.
   - **Rechazar** → `rechazado`. Notificación a agencia con motivo opcional.
6. Tras aprobar: `upsertContactFromRegistro()` crea/actualiza Contact en CRM.

### 2.3 · Flujo · preregistro (modo `por_visita`)

1. Agencia pulsa "Preregistrar cliente · con visita" en ficha de promoción. **CTA distinto al normal** (CLAUDE.md regla "etiqueta dinámica" ya documentada).
2. Form requiere obligatoriamente `visitDate + visitTime`.
3. Entra como `preregistro_pendiente` con `tipo: "registration_visit"`.
4. `findPendingDuplicate()` se aplica igual · si match → `duplicado`.
5. Promotor decide:
   - **Aprobar** → `preregistro_activo`. Visita confirmada en calendario. Counter `acceptRegistro` +1.
   - **Rechazar** → `rechazado`.
6. Día de la visita:
   - El agente registra resultado (`visitOutcome`) en el calendario.
   - **Si `realizada`** → registro transita automáticamente a `aprobado`. Cliente queda formalizado a nombre de la agencia. Eventos cross-empresa: "Visita realizada · cliente registrado".
   - **Si `no_show` y dentro de plazo** → vuelve a `preregistro_activo` con visita reprogramable.
   - **Si `no_show` y fuera de plazo** → `caducado`. Cliente queda libre.
   - **Si `reprogramada`** → `preregistro_activo` con nueva fecha.
7. Caducidad: si pasa `promo.validezRegistroDias` sin visita realizada → `caducado` automático (cron). Cliente queda libre para que cualquier agencia lo registre.

### 2.4 · Detección de duplicados / conflictos

**Tres niveles de detección**, todos calculados al crear o intentar crear:

#### Nivel A · Duplicado intra-promoción (regla actual + extensión)

- Compara entrante vs registros del mismo `promotionId` con estado en `{pendiente, preregistro_pendiente, preregistro_activo, aprobado}`.
- Si match → marcar entrante como `duplicado` con score y `matchWith`.
- Excepción: si entrante viene con visita programada Y el ganador es `preregistro_activo` sin visita programada → ver §2.5 reglas de prioridad (la visita gana).

#### Nivel B · Cross-promo warning (regla actual)

- Compara entrante vs registros con `estado === "aprobado"` en **otras** promociones del mismo workspace.
- No bloquea · solo aviso al promotor.
- Mantener tal cual.

#### Nivel C · Match score (NUEVO · IA backend)

`matchPercentage` deja de ser estático. Backend calcula score 0-100 cruzando:

| Señal | Peso |
|---|---|
| Email exacto normalizado | 40 |
| Teléfono exacto normalizado | 35 |
| Nombre exacto normalizado | 10 |
| Nombre con typo (Levenshtein ≤2) | 5 |
| Misma dirección | 5 |
| Mismo apellido + nacionalidad | 3 |
| Histórico de registros previos del mismo cliente | 2 |

**Umbrales**:
- 0-39 · sin coincidencias relevantes (banner verde).
- 40-69 · coincidencia parcial (banner ámbar · revisar).
- 70-100 · posible duplicado (banner rojo · `MatchConfirmDialog`).

### 2.5 · Reglas de prioridad

Orden estricto de mayor a menor (el más alto gana):

1. **Visita realizada** (`visitCompletedAt` con `outcome: "realizada"`) → siempre gana. La agencia que ejecutó la visita queda como dueña del cliente.
2. **Aprobado** (`estado: "aprobado"`) sin visita pendiente → propietario actual.
3. **Preregistro_activo con visita programada futura** → propietario provisional · expiración aplica.
4. **Pendiente o preregistro_pendiente** ordenado por `created_at` ascendente · primero gana (first-come).
5. **Duplicado / desplazado / caducado** → no son propietarios.

**Casos críticos resueltos por estas reglas**:

- Agencia A preregistra X (sin visita aún) · Agencia B intenta registrar X mismo día → B entra como `duplicado` (first-come).
- Agencia A preregistra X · realiza visita · transita a `aprobado` · Agencia B intenta registrar X → B entra como `duplicado`.
- Agencia A preregistra X · no realiza visita en plazo → A pasa a `caducado`. Agencia B registra X → entra como `pendiente` normal. El promotor ve el historial: "X estuvo preregistrado por A, caducó el dd/mm, ahora B lo registra".
- Agencia B reserva visita primero (timestamp) sin saber que A había preregistrado · primero llega A → A gana. La política protege al primero, premia al que ejecuta visita real.

### 2.6 · Notificaciones agencia

| Evento | Cuándo | Canal |
|---|---|---|
| **Registro aprobado** | Promotor aprueba · pasa gracia 5min | in-app + email |
| **Preregistro aprobado** | Promotor aprueba · pasa gracia · visita confirmada en calendario | in-app + email |
| **Posible duplicado detectado** | Al crear, si `matchPercentage ≥ 40` | in-app inmediato (tooltip + banner en form) |
| **Marcado como duplicado (first-come)** | Tras submit, otra agencia ya tenía pending | in-app + email opcional |
| **Registro rechazado** | Promotor rechaza | in-app + email con motivo |
| **Otra agencia tiene prioridad** | Visita ajena se completó antes que tu registro | in-app + email · explica claramente que perdiste por visita ajena |
| **Preregistro convertido tras visita** | Tu visita se marcó como realizada | in-app + email "Cliente formalmente registrado a tu nombre" |
| **Preregistro próximo a caducar** | 48h antes de `expirationAt` | in-app + email con CTA "Programar visita" |
| **Preregistro caducado** | Tras expiration | in-app · cliente libre para otros |

### 2.7 · Notificaciones promotor

| Evento | Cuándo | Canal |
|---|---|---|
| **Nuevo registro recibido** | Agencia o promotor crea | in-app + email diario digest |
| **Posible duplicado detectado** | Al crear, si `matchPercentage ≥ 70` | in-app + email inmediato |
| **Conflicto cross-promo** | Cliente aprobado en otra promo del workspace | in-app · banner en detalle |
| **Visita realizada · listo para formalizar** | Agente marca visita realizada con preregistro asociado | in-app · transición automática |
| **Registro requiere decisión** | Pendiente >24h sin acción | in-app + email diario |
| **Preregistro caducado** | Cron diario detecta expiración | in-app digest semanal |

### 2.8 · Resolución de conflictos

**Auto-resolución** (sin intervención del promotor):

- First-come silent intra-promoción · perdedor a `duplicado` (regla actual).
- Visita realizada gana sobre preregistro pendiente · perdedor a `desplazado`.
- Caducidad de preregistro · libera al cliente para otros.

**Decisión del promotor**:

- Cuando hay duplicado activo (`matchPercentage ≥ 70`) en intra-promoción, el promotor ve `<MatchConfirmDialog>` antes de aprobar · puede:
  - **Confirmar es duplicado** → rechazar entrante.
  - **No es duplicado** → marcar match como descartado (ya implementado · `dismissMatch`) y aprobar.
- En cross-promo warning, el promotor decide manualmente · sin auto-bloqueo.
- **Override del promotor**: puede forzar aprobación contra cualquier regla auto · queda en historial cross-empresa con justificación obligatoria (`decisionNote`).

---

## TASK 3 · Alertas duplicados / conflictos

### 3.1 · Cuándo aparece la alerta

**En el formulario de registro** (NUEVO · hoy no existe):

- En tiempo real al teclear email/teléfono · debounce 500ms.
- Llamada a `POST /api/registros/check-duplicates` con email + teléfono normalizados + `promotionId` + `agencyId`.
- Backend devuelve match potencial con score y status del existente:
  ```json
  {
    "matchPercentage": 89,
    "existingRegistration": {
      "agencyName": "Agencia Norte",  // visible solo al promotor
      "agencyId": "ag-2",              // redactado para agencia que registra
      "status": "preregistro_activo",
      "createdAt": "2026-04-22T10:00:00Z",
      "hasVisit": true,
      "visitDate": "2026-04-28"
    },
    "currentAgencyIsFirst": false,
    "matchedOn": ["email", "telefono"],
    "rule": "another_agency_first" | "you_are_first" | "completed_visit_priority"
  }
  ```

### 3.2 · Quién ve qué

| Rol | Lo que ve |
|---|---|
| **Agencia que registra** | "Otra agencia registró este cliente primero (89% match) · puedes continuar pero entrará como duplicado pendiente de revisión del promotor" · NO ve nombre de la otra agencia (cross-tenant privacy). |
| **Promotor (al revisar)** | Detalle completo · ambas agencias visibles, fechas, estados, visitas. Permite decisión informada. |

### 3.3 · Significado del porcentaje

- 0-39 · sin coincidencias relevantes · seguro registrar.
- 40-69 · coincidencia parcial · agencia ve aviso amarillo "verifica que es el mismo cliente".
- 70-89 · coincidencia alta · banner rojo "muy probable duplicado".
- 90-100 · coincidencia casi exacta · banner rojo + CTA secundario "Es el mismo cliente, no registrar".

### 3.4 · Cómo se calcula

Ver §2.4 · Nivel C. Backend calcula. Cliente solo muestra.

### 3.5 · ¿Bloquea o avisa?

**Avisa, no bloquea.** La agencia decide. Esto es deliberado:

- Si bloqueamos, la agencia no puede dejar constancia de que "ella también vio al cliente". El registro es valor.
- Si avisamos, la agencia entra informada · si insiste, queda como `duplicado` y el promotor decide. La traza queda.
- Excepción: si `matchPercentage ≥ 95` y la otra agencia ya está en `aprobado` → mostrar CTA secundario destacado · pero técnicamente sigue permitiendo.

### 3.6 · Casos por la posición temporal

#### Si la agencia actual fue primera

Mensaje a la agencia (en form):
> "Tienes ya este cliente preregistrado en esta promoción · revisa antes de duplicar."

Si insiste:
- Si el existente es de la misma agencia → bloquear con error "Ya tienes este cliente. Ve a /registros para gestionar."
- Si el existente es de otra agencia pero la actual es la primera → no aplica (caso imposible por definición).

#### Si otra agencia fue primera

Mensaje a la agencia que intenta registrar:
> "Otra agencia envió un registro que coincide con este cliente al 89%. Tu registro se enviará pero entrará como **duplicado** pendiente de revisión del promotor. Si quieres seguir, confirma."

Resultado: registro entra como `duplicado` (first-come silent reforzado con UX explícita).

#### Si hay preregistro con visita realizada por otra agencia

Mensaje:
> "Este cliente ya está registrado a nombre de otra agencia tras una visita realizada. La política de Byvaro premia la ejecución: la atribución no se puede transferir."

Resultado: registro entra como `desplazado` (no `duplicado` · el motivo es distinto). Visible al promotor con explicación clara.

### 3.7 · Valor percibido para el promotor

Mensaje en `<UpgradeModal>` y en marketing:

> "Byvaro detecta intentos de registro duplicado en tiempo real. Te
> avisamos cuando dos agencias compiten por el mismo cliente y aplicamos
> reglas claras de prioridad — primero quien preregistra, después quien
> ejecuta la visita. Cero conflictos de comisión, cero manipulación."

Ya es uno de los **3 vectores de valor** del producto (junto con el
microsite y la analítica).

---

## TASK 4 · Modelo de prioridad (resumen canónico)

```
PRIORIDAD (de mayor a menor)
═══════════════════════════════════════
1. Visita realizada (visitCompletedAt + outcome="realizada")
   → la agencia que ejecutó la visita es la propietaria · inmutable
2. Aprobado sin visita pendiente
   → propietario actual hasta caducidad
3. Preregistro_activo con visita futura programada
   → propietario provisional · pierde si no completa visita en plazo
4. Pendiente / preregistro_pendiente ordenado por created_at ASC
   → first-come gana
5. Estados sin atribución · duplicado, desplazado, caducado, rechazado
═══════════════════════════════════════
```

### Casos clave

- ¿**Preregistro sin visita tiene prioridad?** · Sí, sobre nuevos pendientes (regla 3 > regla 4). NO sobre visita realizada ajena (regla 1 gana).
- ¿**Visita realizada siempre gana?** · Sí · es la única acción concreta verificable. Prima ejecución sobre intención.
- ¿**Promotor puede override?** · Sí · con `decisionNote` obligatoria que queda en historial cross-empresa. Excepción: NO puede revertir una visita ya realizada por agencia A para dársela a B (eso sería dolo · auditable y reversible solo por soporte).
- ¿**Qué se loguea en historial?** · Cada transición de estado del registro + cada decisión del promotor + cada conflicto resuelto · ambas fichas (registro y agencia) reciben evento.
- ¿**Qué ve cada agencia?** · Solo sus propios registros + estado actual. NO ve el flujo interno del promotor con otras agencias. Cuando pierde por una regla auto, recibe notificación con razón ("Otra agencia completó visita primero").

---

## TASK 5 · Matriz de notificaciones (canónica)

### 5.1 · Lado agencia

| # | Evento | Trigger | Mensaje | Urgencia | Canal |
|---|---|---|---|---|---|
| A1 | Registro aprobado | post-gracia 5min | "Tu cliente {N} ha sido aprobado en {Promo}. Comisión {X}€." | media | in-app + email |
| A2 | Preregistro aprobado | post-gracia | "Tu preregistro de {N} ha sido aprobado · visita confirmada el {fecha}." | media | in-app + email |
| A3 | Posible duplicado (en form) | submit con score ≥40 | "Match con cliente registrado por otra agencia · score 89%." | alta | inline en form (no notificación) |
| A4 | Marcado duplicado | post-creación, otro fue primero | "Tu registro de {N} se ha marcado como duplicado · otra agencia llegó antes." | media | in-app |
| A5 | Registro rechazado | promotor rechaza | "Tu registro de {N} ha sido rechazado. Motivo: {nota}." | alta | in-app + email |
| A6 | Otra agencia tiene prioridad | visita ajena completada | "Otra agencia ha realizado la visita primero. Cliente atribuido a ellos." | alta | in-app + email |
| A7 | Preregistro convertido | visita realizada | "Visita de {N} marcada como realizada · cliente formalmente registrado a tu nombre." | alta · positiva | in-app + email |
| A8 | Preregistro próximo a caducar | 48h antes de expiration | "Tu preregistro de {N} caduca el {fecha} · programa visita ahora." | alta | in-app + email |
| A9 | Preregistro caducado | tras expiration | "Tu preregistro de {N} ha caducado · cliente liberado." | media | in-app |

### 5.2 · Lado promotor

| # | Evento | Trigger | Mensaje | Urgencia | Canal |
|---|---|---|---|---|---|
| P1 | Nuevo registro recibido | agencia/promotor crea | "Nuevo registro pendiente · {N} de {Agencia}." | media | in-app + digest email diario |
| P2 | Posible duplicado detectado | submit con score ≥70 | "Posible duplicado: {N} coincide al 89% con registro existente. Revisa antes de aprobar." | alta | in-app inmediato |
| P3 | Conflicto cross-promo | aprobar registro de cliente ya en otra promo | banner en detalle "Cliente aprobado en {OtraPromo}" | media | in-app inline |
| P4 | Visita realizada · listo para formalizar | agente marca outcome="realizada" | "Visita de {N} realizada · registro formalizado automáticamente." | media · informativa | in-app digest |
| P5 | Registro pendiente >24h | cron diario | "{N} registros llevan >24h sin decisión." | media | digest email diario |
| P6 | Preregistros caducados | cron diario | "{X} preregistros han caducado hoy · {Y} clientes liberados." | baja | digest email semanal |

### 5.3 · Reglas de canal

- **In-app**: campanita en topbar + entrada en `/notificaciones` (NUEVO · no existe). Persistente hasta marcar como leído.
- **Email**: para eventos alta urgencia individual; eventos baja/media en digest.
- **Digest**: email diario o semanal con N eventos agrupados · evita spam.
- **WhatsApp**: opt-in por agencia · solo para urgencia alta. Phase 2.

---

## TASK 6 · Output consolidado

### 6.1 · Auditoría implementación actual · resumen

| Bloque | Estado |
|---|---|
| Modelo de cliente (nombre+tel+nac+email opt) | ✓ implementado |
| Detección duplicados intra-promo email/tel | ✓ implementado · sin score real |
| First-come silent intra-promo | ✓ implementado |
| Cross-promotion warning (aprobados otras promos) | ✓ implementado · solo aviso |
| Approval state machine (match/relation/visit/approve) | ✓ implementado |
| Visit confirmation en calendar al aprobar | ✓ implementado |
| Tipo `visit_only` para visitas posteriores | ✓ implementado |
| Tipo `registration_visit` con visita propuesta | ✓ implementado |
| **Preregistro como estado** | ✗ **falta** · solo copy descriptivo |
| **Toggle modoValidacionRegistro per promo** | ✗ **falta** |
| **Transición visita_realizada → aprobado** | ✗ **falta** |
| **Caducidad de registros** | ✗ **falta** |
| **Match score real (IA)** | ✗ **falta** · campo existe pero estático |
| **Sistema de notificaciones** | ✗ **falta** · solo toasts |
| **Detección duplicados en form (real-time)** | ✗ **falta** |
| **Estado `desplazado` (perdió por visita ajena)** | ✗ **falta** |
| **Estado `caducado`** | ✗ **falta** |
| Hardening agencyId | ✓ implementado (toast error si falta) |

### 6.2 · Gaps / conflictos

1. **Conceptual**: la copy del wizard promete "preregistro" pero técnicamente no existe → desalineación entre promesa de marketing y producto.
2. **Comportamental**: hoy todo registro aprobado es definitivo · no hay forma de premiar la ejecución de la visita.
3. **Técnico**: `matchPercentage` es campo del modelo pero el cálculo no existe. La UI muestra colores en función de él pero los valores son falsos (seed-only).
4. **UX**: agencia no se entera de que perdió por first-come · solo ve que su registro está en estado `duplicado` pero no entiende por qué.
5. **Privacidad**: la agencia A puede ver datos del cliente de la agencia B en `<DuplicateResult>` (cross-tenant). Solo aplica al promotor — la agencia debería ver los datos redactados.
6. **Notificaciones**: cero canal real. Toasts cliente-side son volátiles · si la agencia no está logueada no se entera nunca.
7. **Race condition**: dos agencias submitean simultáneamente · ambas pasan el check pre-insert · ambas entran como `pendiente` y quedan como duplicados mutuos. Necesita lock backend.

### 6.3 · Lógica de negocio final propuesta · resumen

- Modelo extendido: `RegistroEstado` += `preregistro_pendiente`, `preregistro_activo`, `desplazado`, `caducado`.
- `Promotion.modoValidacionRegistro: "directo" | "por_visita"`.
- `Registro` += `visitCompletedAt`, `visitOutcome`, `expirationAt`.
- Backend calcula `matchPercentage` con score IA · cliente solo muestra.
- Backend ejecuta cron de caducidad y transiciones de visita.
- Backend gestiona la carrera con advisory lock por `(promotionId, normalizedEmail|normalizedPhone)`.

### 6.4 · Reglas de prioridad · 5 niveles claros (ver §4).

### 6.5 · Matriz de notificaciones · 9 + 6 eventos definidos (ver §5).

### 6.6 · Cambios de UI necesarios

| Cambio | Archivos | Descripción |
|---|---|---|
| Toggle preregistro en wizard | `ColaboradoresStep.tsx` | Radios `directo` / `por_visita` con copy condicional. |
| Etiqueta dinámica CTA | `PromocionDetalle.tsx`, `ClientRegistrationDialog.tsx`, `AgencyHome.tsx` | "Registrar cliente" / "Preregistrar cliente" según `modoValidacionRegistro` (helper `registroCtaLabel`). |
| Detector duplicados en form | `ClientRegistrationDialog.tsx` | Llamada debounce a `/api/registros/check-duplicates` + banner inline ámbar/rojo. |
| Banner "perdiste por X" | `Registros.tsx` agency view | En estado `duplicado` o `desplazado` mostrar razón explícita. |
| Redacción cross-tenant | `DuplicateResult.tsx` | Ocultar datos del otro cliente cuando `viewerIsAgency` y match es de otra agencia. |
| Pill estado `preregistro_activo` | `Tag.tsx` variants | Color ámbar suave + label "Preregistro · visita {fecha}". |
| Filtros de estado en lista | `Registros.tsx` toolbar | Añadir `preregistro_activo`, `desplazado`, `caducado` a `estadoTabs`. |
| Banner caducidad próxima | `RegistroDetail` | 48h antes de expiration · CTA "Programar visita". |
| Centro de notificaciones in-app | NUEVO `/notificaciones` + `<NotificationsBell>` | Lista de eventos por usuario · filtros por leído/no-leído. |
| Override decision en MatchConfirmDialog | `ApprovalDialogs.tsx` | Campo obligatorio `decisionNote` cuando se descarta match score ≥70%. |

### 6.7 · Backend TODOs

1. **Schema**:
   - `RegistroEstado` enum extendido.
   - `Promotion.modo_validacion_registro` column.
   - `Registro.visit_completed_at`, `Registro.visit_outcome`, `Registro.expiration_at` columns.
   - `notifications` table (id, recipient_user_id, event_type, payload jsonb, read_at, created_at).
2. **Endpoints**:
   - `POST /api/registros/check-duplicates` · real-time match check.
   - `POST /api/registros/:id/mark-visit-outcome` · agente registra resultado de visita · si "realizada" + tipo preregistro → transición a aprobado.
   - `POST /api/registros/:id/override` · promotor fuerza decisión contra regla auto · requiere `decisionNote`.
3. **Workers**:
   - Cron diario `expirePreregistrations` · marca `caducado` los `preregistro_activo` con `expirationAt < now`.
   - Cron diario `nudgeStalePending` · genera notificación P5.
   - Cron diario `nudgeNearExpiry` · genera notificación A8 (48h antes).
4. **Match score IA**:
   - `POST /api/match/score` con datos del cliente entrante + `promotionId` · devuelve `{ matchPercentage, breakdown, candidates }`.
   - Implementación inicial: reglas explícitas (peso por señal) · iterar a embedding/ML cuando haya volumen.
5. **Concurrencia**:
   - Advisory lock en `addRegistro()` por `(promotionId, normalize(email|phone))` durante 100ms · garantiza first-come determinista.
6. **Notificaciones**:
   - Worker `dispatchNotifications` con templates por evento (in-app + email).
   - Idempotencia por `(user_id, event_type, registro_id)`.
   - Digest diario/semanal vía cron.
7. **Cross-tenant**:
   - Endpoint que devuelve match info aplica filtros server-side: si `viewer.role === "agency"` → redacta `existingRegistration.agencyName` y campos sensibles.

### 6.8 · Riesgos / open questions

1. **¿Qué pasa con preregistros existentes al activar `por_visita` en una promo ya en marcha?** · Propuesta: no migrar retroactivamente · solo aplica a nuevos. Documentar.
2. **¿La caducidad debe pausarse si la visita se reprogramó por causa del cliente (no del agente)?** · Propuesta: sí, reset del timer al reprogramar · max 2 reprogramaciones.
3. **¿El score IA se recalcula al editar un registro existente?** · Propuesta: solo al crear · cambios posteriores no re-disparan match check.
4. **¿La agencia puede ver el match score de su propio registro entrante?** · Propuesta: sí, ve "alto/medio/bajo" sin número exacto · el promotor ve el número.
5. **Bulk actions del promotor sobre conflictos** · ¿debe haber acción "aprobar A, rechazar B, marcar C como caducado" en una sola operación? Propuesta Phase 2.
6. **¿Las visitas no formalizadas (sin preregistro) generan algún tipo de claim?** · No · solo `preregistro_activo` con visita programada protege contra duplicados.
7. **Política RGPD de los registros caducados** · ¿se anonimizan a los X días? Necesario revisar con legal antes de implementar.
8. **¿Soporta el modelo registros multi-promoción del mismo cliente con misma agencia?** · Sí · son válidos · solo el cross-promo warning lo señala como info.
9. **Override del promotor: ¿quién audita?** · Propuesta: log obligatorio en `companyEvents` cross-empresa + visible al admin.
10. **Migración de datos**: los seeds actuales sin `expiration_at` · cron debe ignorarlos hasta backfill manual.

---

## Referencias

- `src/lib/registrosStorage.ts` · first-come silent + storage.
- `src/lib/registroVisitaLink.ts` · vinculación visita-registro.
- `src/components/registros/CrossPromotionWarning.tsx` · cross-promo banner.
- `src/components/registros/DuplicateResult.tsx` · UI comparación.
- `src/components/registros/ApprovalDialogs.tsx` · state machine de aprobación.
- `src/pages/Registros.tsx` · página principal + gates paywall.
- `src/components/promotions/detail/ClientRegistrationDialog.tsx` · form de creación.
- `src/components/crear-promocion/ColaboradoresStep.tsx:299` · copy descriptivo "preregistro" (único lugar donde aparece la palabra).
- `docs/backend-integration.md §12` · contrato actual del paywall.
- `CLAUDE.md` · regla "etiqueta dinámica registro/preregistro" + reglas de oro de historial.
