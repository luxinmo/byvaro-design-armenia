# dual-role-model.md · Modelo dual Promotor ↔ Agencia

> **Documento canónico** del modelo de dos roles que coexisten en Byvaro.
> Lectura obligatoria antes de implementar cualquier feature que afecte a
> pantallas, datos o permisos — es el diferencial del producto.
>
> **Audiencia**: Claude Code, desarrolladores humanos, agente de backend.
> Si cualquier cambio contradice lo que aquí se describe, para y pregunta
> antes de implementar (ver `CLAUDE.md` §Vista de Agencia).
>
> Última actualización: 2026-04-23.

---

## 0 · Resumen en 30 segundos

Byvaro es **una sola plataforma SaaS con dos roles** que interaccionan:

- **Promotor inmobiliario** — paga 249€/mes. Crea y gestiona promociones
  de obra nueva. Decide qué agencias invitar a colaborar. Aprueba o
  rechaza los registros de clientes que envían las agencias.
- **Agencia colaboradora** — paga 0€ si fue invitada, 99€/mes si entra
  por el marketplace. Accede al catálogo de promociones donde colabora,
  registra clientes ante el promotor, gestiona sus propias visitas y
  operaciones.

El core del negocio está en la **interacción** entre ambos: la agencia
registra un cliente → el promotor aprueba → el registro queda
"apartado" para esa agencia durante N días (contrato de exclusividad).

---

## 1 · Personas en detalle

### 1.1 · Promotor (`accountType: "developer"`)

Arquetipo: Arman Rahmanov, admin de Luxinmo. Una sola empresa
inmobiliaria con ~5-50 empleados, cartera de 2-30 promociones activas.

**Obligaciones del sistema hacia el promotor:**
- Ve TODO lo suyo: promociones (incluidos borradores), todos los
  registros entrantes, todas las agencias con las que colabora, todos
  sus contactos, microsites, ventas, emails.
- Puede crear, editar, publicar y archivar promociones.
- Decide sobre cada registro: aprobar / rechazar / pedir info.
- Invita agencias a colaborar en sus promociones.
- Configura comisiones, validez del registro, qué documentos se
  comparten, qué microsite se publica.

**Lo que NUNCA ve:**
- Datos comerciales cross-tenant de otras agencias (lo que una agencia
  tiene como cartera propia fuera de sus promociones).
- Contactos propios de otras agencias ajenos a los registros que
  envían.

### 1.2 · Agencia colaboradora (`accountType: "agency"`)

Dos sub-variantes, ambas con el mismo rol técnico (`accountType: "agency"`):

| Sub-variante | Paga | Cómo entra | Qué ve |
|---|---|---|---|
| **Invitada** | 0€/mes | El promotor la invita por email. | Solo las promociones donde el promotor le ha invitado a colaborar. |
| **Marketplace** | 99€/mes | Se da de alta en el marketplace y solicita colaborar con promotores que le interesan. | Catálogo completo del marketplace + las promociones donde su colaboración fue aceptada. |
| **Sin plan** | 0€/mes | Se da de alta en el marketplace pero no paga. | Marketplace con todo difuminado — contadores agregados, filtros funcionales, nada accionable. |

Arquetipo: Laura Sánchez, Sales Manager de Prime Properties Costa del
Sol. Agencia de 10-20 comerciales con cartera de clientes
internacionales.

**Obligaciones del sistema hacia la agencia:**
- Ve solo las promociones donde colabora + el marketplace (si paga).
- Registra clientes sobre esas promociones — el registro va al
  promotor para aprobación.
- Ve SOLO sus propios registros (nunca los de otras agencias).
- Gestiona sus contactos, visitas, operaciones y emails propios.
- Envía emails comerciales a sus clientes sin desvelar qué promoción
  concreta es (para que el cliente no pueda ir al promotor
  directamente).

**Lo que NUNCA ve:**
- Registros de otras agencias.
- Datos internos del promotor (borradores, comentarios internos,
  configuración de comisiones de otras agencias).
- Datos comerciales de otras agencias colaboradoras (no ve a sus
  competidores).
- Pantallas de gestión del promotor (`/colaboradores`, `/microsites`,
  `/empresa/*`, `/ajustes/usuarios/*` del tenant del promotor).

---

## 2 · Interacciones cross-role

### 2.1 · Flujo crítico: Registro de cliente

```
 Agencia                          Sistema                         Promotor
 ───────                          ───────                         ────────

  abre ficha de promoción  →
  "Registrar cliente"
                              ← diálogo directo (sin mode picker)
  rellena datos cliente,
  confirma
                                crea Registro {
                                  agencyId: <agencia>,
                                  origen: "collaborator",
                                  estado: "pendiente",
                                  matchPercentage: <IA>,
                                  ...
                                }
                              ← toast "Cliente registrado"

  ...                           notifica al promotor   →          bandeja /registros
                                                                  ve el Registro
                                                                  nuevo pendiente
                                                                  con matchPercentage

                                                                  decide:
                                                                  - aprobar  → registro
                                                                    "apartado" durante
                                                                    validezDias días
                                                                  - rechazar → vuelve
                                                                    libre
                                                                  - duplicado → marca
                                                                    y archiva

                                notifica a la agencia  ←
  bandeja /registros          ← registro actualizado
  ve estado actualizado
  (+ grace period de 5min
   para revertir decisión)
```

Detalles en `docs/screens/registros.md` y `src/components/registros/`.

### 2.2 · Flujo crítico: Invitación a colaborar

```
 Promotor                         Sistema                         Agencia
 ────────                         ───────                         ───────

  /colaboradores → "Invitar   →
  agencia"
  (o desde ficha promoción:
   "Compartir")
  introduce email, define
  comisión y qué promociones
  comparte
                                crea Invitacion {
                                  promotorId, email,
                                  comisionOfrecida,
                                  promotionsCompartidas[],
                                  estado: "pendiente",
                                  token: uuid
                                }
                                envía email con link  →           recibe email
                                                                  click link
                                                                  ⮕ si existe cuenta:
                                                                    login y aparece
                                                                    el promotor en
                                                                    su lista.
                                                                  ⮕ si no existe:
                                                                    onboarding de
                                                                    agencia + acepta.

                                crea Collaboration {
                                  promotorId,
                                  agencyId,
                                  estado: "activa",
                                  ...
                                }
                              ← notifica al promotor:
                                "Agencia X ha aceptado"
  /colaboradores actualiza
  lista
                                                                  /promociones ve
                                                                  las nuevas
                                                                  promociones
                                                                  compartidas
```

Detalles en `docs/screens/compartir-promocion.md` y `src/lib/invitaciones.ts`.

### 2.3 · Flujo crítico: Email comercial desde agencia

Regla de producto: **la agencia nunca desvela en el subject qué
promoción concreta está promocionando**. El cliente abre el email y
decide si quiere más info — si pregunta, pregunta a la agencia, no al
promotor.

- Subject genérico: _"Oportunidad inmobiliaria que te puede interesar"_.
- Cuerpo con la **tabla de disponibilidad** y voz de agencia
  ("Te comparto las unidades disponibles…"), pero **sin** mostrar:
  showroom/piso piloto, ubicación exacta, plan de pagos detallado.
- El footer lleva los datos de la agencia (no del promotor).

Implementación: `src/components/email/SendEmailDialog.tsx` +
`emailTemplates.ts` con `opts.agencyMode`.

---

## 3 · Contrato técnico

### 3.1 · Datos en el JWT (backend)

Cuando el usuario haga login, el JWT debe llevar al menos:

```json
{
  "sub": "u-123",
  "email": "laura@primeproperties.com",
  "name": "Laura Sánchez",
  "accountType": "developer" | "agency",
  "empresaId": "t-42",
  "agencyId": "t-42",      // solo si accountType === "agency", igual a empresaId
  "promotorId": null,       // solo para agencias: el promotor "home" si accedió desde una invitación
  "role": "admin" | "member",
  "permissions": ["contactos.viewAll", "emails.send", ...]
}
```

- `accountType` determina qué rutas/pantallas puede abrir.
- `empresaId`/`agencyId` es el tenant del que se leen TODOS los datos
  visibles (RLS).
- `role` + `permissions` granularizan dentro del tenant (ver
  `docs/permissions.md`).

### 3.2 · Frontend · hooks y patrón de scope

El contrato actual (mock) está en `src/lib/accountType.ts` +
`src/lib/currentUser.ts`. En producción:

- `useCurrentUser()` devuelve el usuario del JWT con `accountType` y
  `agencyId`.
- Las pantallas leen `currentUser.accountType === "agency"` y adaptan:
  - **Listados**: filtrar por `agencyId` cuando sea agencia.
  - **Sidebar**: `/colaboradores`, `/microsites`, `/empresa/*`,
    `/ajustes/usuarios/*`, `/ajustes/facturacion/*` → ocultos.
  - **Botones de edición**: `hideEdit={viewAsCollaborator}` o equivalente.
  - **Flujos**: el diálogo de "Registrar cliente" salta el mode picker
    (`isCollaboratorView`). El de "Enviar email" salta a audience=client
    y oculta "A un colaborador".

### 3.3 · Backend · RLS policies por tabla

Cada tabla que tenga scope de tenant debe llevar:

```sql
CREATE POLICY tenant_isolation ON <tabla>
  USING (empresa_id = current_setting('app.empresa_id')::uuid);
```

Casos especiales:

| Tabla | Visibilidad promotor | Visibilidad agencia |
|---|---|---|
| `promociones` | `empresa_id = me.empresa_id` | `id IN (SELECT promotion_id FROM collaborations WHERE agency_id = me.empresa_id AND estado = 'activa')` |
| `registros` | `promocion.empresa_id = me.empresa_id` | `agency_id = me.empresa_id` |
| `contactos` | `empresa_id = me.empresa_id` | `empresa_id = me.empresa_id` (**cada tenant tiene los suyos, nunca se comparten**) |
| `agencies` / `empresas` (perfil público) | todos pueden leer perfil público | idem |
| `collaborations` | `promotor_id = me.empresa_id` | `agency_id = me.empresa_id` |
| `emails` enviados | `empresa_id = me.empresa_id` | `empresa_id = me.empresa_id` |

### 3.4 · Backend · endpoints scopeados

La mayoría de endpoints son simétricos (mismo path, distinto scope por
JWT). Algunos son exclusivos de un rol:

**Solo promotor:**
- `POST /api/promociones` (crear)
- `POST /api/promociones/:id/invitar-agencia` (compartir)
- `POST /api/registros/:id/aprobar` (+ `/rechazar`)
- `GET /api/microsites/*`
- `PATCH /api/empresa` (datos de su empresa)
- `GET /api/colaboradores/estadisticas`

**Solo agencia:**
- `POST /api/promociones/:id/registros` (registrar cliente)
- `GET /api/marketplace/*`
- `POST /api/marketplace/:promotorId/solicitar-colaboracion`

**Ambos (simétricos por JWT):**
- `GET /api/promociones` — devuelve lo que cada rol debe ver.
- `GET /api/registros` — devuelve lo que cada rol debe ver.
- `GET /api/contactos`, `POST /api/contactos/*`.
- `GET /api/ventas`, `POST /api/ventas/*`.
- `POST /api/emails/send`.
- `GET /api/calendario/*`.

Detalle de cada endpoint en `docs/backend-integration.md`.

### 3.5 · Backend · namespaces de URL (opcional pero recomendado)

Una opción limpia: prefijar las rutas por rol.

```
/api/developer/*    → endpoints exclusivos del promotor
/api/agency/*       → endpoints exclusivos de la agencia
/api/shared/*       → endpoints simétricos
```

El middleware valida que `accountType` del JWT coincide con el prefijo
(401 si no). Tiene la ventaja de que los errores son rutas 404 en vez
de datos vacíos.

Alternativa: una sola API y validar rol a nivel de controller. Más
simple pero menos auto-documentada.

---

## 4 · Matriz de features por pantalla

| Ruta | Promotor | Agencia | Notas |
|---|---|---|---|
| `/inicio` | ✅ todo | ✅ KPIs scopeados (ventas/registros propios, promociones donde colabora) | Misma pantalla, datos distintos |
| `/promociones` | ✅ todas (drafts + published) | ✅ solo donde colabora; sin drafts | Filtro por `agencyId` en collaboration |
| `/promociones/:id` | ✅ edición completa | ✅ vista colaborador (sin editar, sin banner "Preview") | `viewAsCollaborator = isAgencyUser \|\| preview` |
| `/crear-promocion` | ✅ | ❌ 404 o redirect | Agencia no crea promociones |
| `/registros` | ✅ todos los entrantes | ✅ solo los suyos | Filtro por `agencyId === me.agencyId` |
| `/leads` | ✅ | ⚠ pendiente de decidir | Actualmente idéntico — documentar en open-questions |
| `/ventas` | ✅ todas | ✅ solo las suyas | Pendiente scope en código |
| `/calendario` | ✅ | ✅ eventos propios | Pendiente scope |
| `/colaboradores` | ✅ red de agencias | ❌ oculto del sidebar | Una agencia no ve a otras agencias |
| `/colaboradores/:id` | ✅ | ❌ 404 | Idem |
| `/contactos` | ✅ suyos | ✅ suyos | Cada tenant tiene sus contactos — no se comparten |
| `/microsites` | ✅ | ❌ oculto | Los microsites son del promotor |
| `/emails` | ✅ | ✅ | Ambos tienen cliente de correo |
| `/empresa` | ✅ gestión del promotor | ❌ oculto | Agencia gestiona su empresa desde `/ajustes` (TODO) |
| `/ajustes` | ✅ todo | ✅ subset (sin usuarios, sin facturación del promotor) | Pendiente filtrar secciones |
| `/agencia` | — | ✅ picker + entry mock | Solo existe en diseño, desaparece con login real |
| `/login` | ✅ cuentas demo | ✅ cuentas demo | En producción, mismo login; el backend decide a qué dashboard llevar por `accountType` |

---

## 5 · Cómo trabajar sobre este modelo

### 5.1 · Añadir una feature nueva

Antes de implementar:

1. **Pregúntate**: ¿esta feature aplica a promotor, a agencia, o a
   ambos?
2. Si aplica a ambos: ¿es el mismo comportamiento o distinto? Si es
   distinto, detállalo con una tabla tipo la de §4.
3. Si solo aplica a uno: ¿qué pasa si el otro entra a la URL? (404,
   redirect, placeholder).
4. Refleja la decisión en este documento + en `docs/screens/<nombre>.md`.

### 5.2 · Scopear una pantalla existente que no lo estaba

Patrón actual (ejemplos en `src/pages/Promociones.tsx` y `Registros.tsx`):

```tsx
const currentUser = useCurrentUser();
const isAgencyUser = currentUser.accountType === "agency";

const scopedData = useMemo(() => {
  if (!isAgencyUser) return allData;
  return allData.filter((x) => x.agencyId === currentUser.agencyId);
}, [allData, isAgencyUser, currentUser.agencyId]);
```

Si la pantalla hace mutaciones (crear, editar), hay que doble-checkear
con `isAgencyUser` antes de llamar al endpoint y validar server-side.

### 5.3 · Testing

Mínimo antes de cerrar una PR que afecte a scope:

- Log-in como **promotor** (`arman@byvaro.com`) → revisar la pantalla.
- Log-in como **agencia** (`laura@primeproperties.com`) → revisar la
  misma pantalla.
- Contrastar con la matriz de §4. Si algo no cuadra, o se ajusta o se
  documenta como cambio intencional.

Hay scripts E2E de referencia en `scripts/`:
- `scripts/account-switcher-e2e.mjs` — switch entre roles + flow de
  registro desde agencia.
- `scripts/login-e2e.mjs` — login con credenciales mock.

---

## 6 · Portar al backend real

Cuando el backend se levante:

1. **Este documento se duplica** al repo del backend (en
   `docs/dual-role-model.md` también, o se mueve todo a un monorepo). La
   fuente de verdad vive aquí mientras no exista backend.
2. **Sustituir** `src/lib/accountType.ts` y `src/lib/currentUser.ts` por
   un AuthProvider que lea el JWT. El resto de la app no cambia.
3. **Implementar RLS** en la base de datos según §3.3.
4. **Prefijar endpoints** por rol (opcional, recomendado) según §3.5.
5. **Ejecutar los scripts E2E** contra backend real — deben pasar igual
   (son UI-level, no dependen de mocks).
6. **Borrar** `src/data/mockUsers.ts`, `src/pages/AgenciaEntry.tsx`, la
   sección "Cuentas de demo" de `Login.tsx`, y el `AccountSwitcher`.

---

## 7 · Referencias cruzadas

- `CLAUDE.md` §Vista de Agencia — la regla de oro operativa.
- `docs/product.md` — modelo de negocio (por qué existen los dos roles).
- `docs/data-model.md` — entidades con shape TypeScript.
- `docs/backend-integration.md` §1 (Auth), §1.5 (Permisos), §4
  (Colaboradores), §5 (Compartir), §7 (Registros/Contactos).
- `docs/permissions.md` — catálogo de keys de permisos y matriz por rol.
- `docs/screens/README.md` — índice de pantallas.
- `src/lib/accountType.ts`, `src/lib/currentUser.ts`,
  `src/data/mockUsers.ts` — implementación mock.

---

## 8 · Preguntas abiertas

Las que quedan pendientes de decisión de producto (pendientes de mover
a `docs/open-questions.md`):

- ¿`/leads` tiene scope de agencia o es solo del promotor?
- ¿Agencia ve `/ventas` con solo las suyas cerradas, o se le muestra
  también las que tramitó pero cerró otra agencia?
- ¿Cómo se factura a la agencia marketplace (dónde ve sus facturas)?
- ¿Existe una pantalla de "mis promotores" para la agencia que hoy
  solo aparece indirectamente en `/promociones`?
- ¿El promotor puede ver las stats agregadas de una agencia, o solo
  datos derivados de las colaboraciones con él?
