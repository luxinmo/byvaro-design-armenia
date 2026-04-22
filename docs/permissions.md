# Permisos y visibilidad · Byvaro v2

> 📌 **Documento canónico del modelo de permisos.** Cualquier cambio
> en visibilidad de datos, gating de acciones o roles debe reflejarse
> aquí. El backend que implemente Byvaro debe leer este documento
> ANTES de definir el esquema de roles, las RLS policies o el JWT.

## 1. Modelo de visibilidad

Byvaro tiene **dos ejes ortogonales** de control de acceso:

1. **Roles del workspace** (admin / member / custom): qué FEATURES puede
   usar el usuario (ej. conectar WhatsApp, eliminar contactos, ver
   métricas globales del workspace).

2. **Visibilidad por OWNERSHIP** (own / all / shared): qué REGISTROS
   concretos puede ver dentro de cada feature. Un member con permiso
   `contacts.viewOwn` ve solo los contactos donde aparece como
   `assignedTo`; con `contacts.viewAll` ve todos los del workspace.

**Regla mental**: el rol abre la puerta a la sala; el ownership decide
qué cajones de esa sala puedes abrir.

### Defaults del producto

| Rol | WhatsApp | Contactos | Registros / Oportunidades / Ventas / Visitas / Documentos / Emails |
|---|---|---|---|
| **admin** | viewAll + manage | viewAll + delete + editOrgTags | viewAll en todo |
| **member** | viewOwn | viewOwn (ve solo donde está asignado) | viewOwn en todo |
| **custom** | configurable por admin en `/ajustes/usuarios/roles` | ídem | ídem |

> Los **datos sensibles entre agencias colaboradoras** (ver
> `docs/product.md` · matriz de personas) tienen una regla extra:
> agencia A nunca puede ver datos de cliente, comisión o nota interna
> de agencia B aunque ambas colaboren en la misma promoción. Eso es
> RLS de tenant + visibility de agencia, ortogonal a este sistema.

## 2. Catálogo completo de permission keys

Las claves siguen el patrón `<dominio>.<acción>`. Un permiso `viewAll`
**implica** `viewOwn` (no es necesario darlos ambos).

### WhatsApp · `whatsapp.*` (existente)
- `whatsapp.viewOwn` — ver/usar conversaciones donde el usuario es agente.
- `whatsapp.viewAll` — ver conversaciones de todos los agentes del workspace.
- `whatsapp.manageChannel` — conectar / desconectar el canal del workspace.

### Contactos · `contacts.*`
- `contacts.viewOwn` — ver contactos donde aparece en `assignedTo`.
- `contacts.viewAll` — ver todos los contactos del workspace.
- `contacts.create` — crear contactos nuevos (manualmente o por importer).
- `contacts.edit` — editar contactos. Sin esto, solo lectura.
- `contacts.delete` — eliminar contactos. **Solo admin por defecto.**
- `contacts.assign` — asignar/desasignar miembros a un contacto.
- `contacts.editOrgTags` — crear/editar/eliminar etiquetas de organización
  (las personales las puede editar siempre cualquier usuario).
- `contacts.merge` — fusionar contactos detectados como duplicados.
- `contacts.export` — exportar listado a CSV.

### Registros (leads entrantes) · `records.*`
- `records.viewOwn` — ver registros donde el usuario es agente asignado.
- `records.viewAll` — ver toda la bandeja de registros del workspace
  (incluyendo los pendientes de aprobar de cualquier agencia).
- `records.approve` — aprobar registros (decisión del promotor).
- `records.reject` — rechazar registros.
- `records.assign` — reasignar un registro a otro agente.

### Oportunidades · `opportunities.*`
- `opportunities.viewOwn` — solo donde el usuario es agente.
- `opportunities.viewAll` — todas las del workspace.
- `opportunities.create` — abrir oportunidad sobre un contacto.
- `opportunities.edit` — modificar intereses/tags/agente.
- `opportunities.archive` — cerrar como archivada.
- `opportunities.win` — marcar como ganada (genera Venta).

### Ventas / Operaciones · `sales.*`
- `sales.viewOwn` — solo las suyas.
- `sales.viewAll` — todas.
- `sales.create` — crear venta manualmente (sin pasar por oportunidad).
- `sales.edit` — modificar precios, fechas, hitos, comisión.
- `sales.editCommission` — editar específicamente el % de comisión y
  marcar `comisionPagada`. **Suele ser solo admin.**
- `sales.transition` — cambiar de estado (reservada → contratada → escriturada).
- `sales.delete` — eliminar (rara, mayoría hace soft-delete).

### Visitas · `visits.*`
- `visits.viewOwn` — visitas donde el usuario es agente.
- `visits.viewAll` — todas las del workspace.
- `visits.schedule` — agendar visitas nuevas.
- `visits.evaluate` — evaluar visita realizada (rating, interés, feedback).
- `visits.cancel` — cancelar visita programada.

### Documentos · `documents.*`
- `documents.viewOwn` — documentos de contactos donde está asignado.
- `documents.viewAll` — todos los documentos del workspace.
- `documents.upload` — subir documentos nuevos.
- `documents.delete` — eliminar.
- `documents.share` — enviar por email/WhatsApp a terceros.

### Emails · `emails.*`
- `emails.viewOwn` — solo los emails enviados/recibidos por la cuenta del usuario.
- `emails.viewAll` — todos los emails del workspace (cuentas compartidas + delegadas).
- `emails.send` — enviar.
- `emails.manageAccounts` — añadir/eliminar cuentas Gmail/Microsoft/IMAP.
- `emails.editTemplates` — gestionar plantillas de la organización.
- `emails.editSignature` — editar firma de organización (la propia siempre puede).

### Promociones · `promotions.*`
- `promotions.viewAll` — ver todas las promociones del promotor (siempre true para todos).
- `promotions.create` — crear promociones nuevas.
- `promotions.edit` — editar (precio, unidades, descripción…).
- `promotions.publish` — publicar / despublicar.
- `promotions.delete` — eliminar.
- `promotions.inviteAgencies` — invitar agencias colaboradoras.
- `promotions.manageCommission` — fijar % comisión por defecto.

### Microsites · `microsites.*`
- `microsites.viewAll` — ver microsites publicados (siempre true).
- `microsites.edit` — editar contenido del microsite (textos, fotos, SEO).
- `microsites.publish` — publicar / despublicar.
- `microsites.customDomain` — conectar dominio propio.

### Colaboradores (Agencias) · `agencies.*`
- `agencies.viewAll` — ver el directorio del marketplace.
- `agencies.invite` — invitar nuevas agencias a colaborar.
- `agencies.removeCollaborator` — desvincular una agencia colaboradora.

### Calendario · `calendar.*`
- `calendar.viewOwn` — ver solo eventos donde es organizador o invitado.
- `calendar.viewAll` — ver toda la agenda del workspace.
- `calendar.editAvailability` — editar horario laboral.

### Ajustes · `settings.*`
- `settings.viewBilling` — ver plan, facturas, método de pago.
- `settings.manageBilling` — cambiar plan, método de pago.
- `settings.manageMembers` — invitar/eliminar miembros del workspace.
- `settings.manageRoles` — editar la matriz de permisos (esta misma).
- `settings.manageWorkspace` — datos de empresa, oficinas, verificación.
- `settings.manageIntegrations` — conectar/desconectar APIs externas.
- `settings.manageWorkspaceDelete` — **eliminar el workspace entero**. Solo owner.

### Histórico (audit log) · `audit.*`
- `audit.viewOwn` — ver eventos donde el usuario es actor o subject.
- `audit.viewAll` — ver el audit log completo.

## 3. Defaults por rol (matriz completa)

> Esta matriz se hidrata en `loadRolePermissions()` de
> `src/lib/permissions.ts` y se persiste en `localStorage` mientras no
> haya backend. En producción vive en la tabla `role_permissions` y se
> resuelve server-side.

### `admin` — TODOS los permisos por defecto.

`isAdmin(user)` devuelve true → `useHasPermission()` devuelve `true`
sin consultar la matriz. Esto es un **escudo extra** para evitar
lock-out accidental al editar la matriz desde la UI.

### `member` (por defecto)
```
whatsapp.viewOwn
contacts.viewOwn, contacts.create, contacts.edit, contacts.assign
records.viewOwn
opportunities.viewOwn, opportunities.create, opportunities.edit, opportunities.archive
sales.viewOwn, sales.edit, sales.transition
visits.viewOwn, visits.schedule, visits.evaluate, visits.cancel
documents.viewOwn, documents.upload, documents.share
emails.viewOwn, emails.send, emails.editSignature
promotions.viewAll
microsites.viewAll
agencies.viewAll
calendar.viewOwn, calendar.editAvailability
audit.viewOwn
```

### Roles custom

El admin puede crear roles intermedios desde
`/ajustes/usuarios/roles`. Casos típicos:

- **`coordinador`** = member + `*.viewAll` (lectura global) + `contacts.assign` + `records.approve`.
- **`finanzas`** = `sales.viewAll`, `sales.editCommission`, `settings.viewBilling`, `audit.viewAll`. Sin acceso a contactos/visitas.
- **`marketing`** = `microsites.edit/publish`, `promotions.edit`, `emails.editTemplates`, `audit.viewOwn`.

## 4. Contrato BACKEND

### 4.1 Esquema de tablas

```sql
-- Permisos asignados a cada rol del workspace
CREATE TABLE role_permissions (
  workspace_id  UUID NOT NULL,
  role          TEXT NOT NULL,            -- 'admin' | 'member' | custom
  permission    TEXT NOT NULL,            -- key del catálogo (sección 2)
  PRIMARY KEY (workspace_id, role, permission)
);

-- Cada usuario tiene UN rol dentro del workspace
ALTER TABLE workspace_members
  ADD COLUMN role TEXT NOT NULL DEFAULT 'member';

-- Ownership en CADA entidad: array de userIds asignados
ALTER TABLE contacts        ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE records         ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE opportunities   ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE sales           ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE visits          ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE documents       ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE emails          ADD COLUMN assigned_to UUID[] NOT NULL DEFAULT '{}';

-- Índices para los WHERE de visibilidad
CREATE INDEX ON contacts USING GIN (assigned_to);
CREATE INDEX ON records  USING GIN (assigned_to);
-- ... etc
```

### 4.2 JWT claims

Cada token devuelto en `/auth/login` debe llevar:

```json
{
  "sub": "<userId>",
  "workspace_id": "<workspaceId>",
  "role": "admin" | "member" | "<customRole>",
  "permissions": ["whatsapp.viewOwn", "contacts.viewAll", ...],
  "iat": ..., "exp": ...
}
```

El frontend NO debe llamar a `/permissions` — usa el JWT. Si los
permisos cambian (admin edita la matriz), el backend invalida tokens
del workspace y fuerza re-login (o emite un push WS para que el
cliente refresque).

### 4.3 RLS policies (PostgreSQL example)

```sql
-- Multi-tenant guard: solo veo filas de mi workspace
CREATE POLICY tenant_isolation ON contacts
  USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- Visibilidad por ownership
CREATE POLICY contacts_view ON contacts
  FOR SELECT USING (
    -- Admin o viewAll → ve todo del tenant
    has_permission('contacts.viewAll')
    OR
    -- viewOwn → solo donde está asignado
    (has_permission('contacts.viewOwn')
     AND current_setting('app.user_id')::uuid = ANY(assigned_to))
  );

-- Helper que lee permission del JWT
CREATE FUNCTION has_permission(perm TEXT) RETURNS BOOLEAN AS $$
  SELECT perm = ANY(string_to_array(current_setting('app.permissions', true), ','))
$$ LANGUAGE SQL STABLE;
```

Repetir el patrón para `records`, `opportunities`, `sales`, `visits`,
`documents`, `emails`. Adaptar la condición de `assigned_to` cuando la
relación sea indirecta (ej. `documents.assigned_to` derivado de
`contact.assigned_to`).

### 4.4 Endpoints

```
GET    /api/permissions/roles
       → { admin: [...], member: [...], <customRole>: [...] }
PATCH  /api/permissions/roles/:role
       Body: { permissions: PermissionKey[] }
       Solo settings.manageRoles. Invalida tokens del workspace.

POST   /api/permissions/roles
       Body: { name: string, basedOn?: "member" | "admin", permissions: [...] }
DELETE /api/permissions/roles/:role
       Falla si hay miembros con ese rol activo.

GET    /api/me
       → { user, workspace, role, permissions[] }
```

### 4.5 Validación server-side

**Cada endpoint que lee/escribe entidades del usuario debe**:
1. Validar el JWT y extraer `userId`, `workspaceId`, `permissions[]`.
2. Setear los `current_setting('app.*')` para activar las RLS.
3. Comprobar permiso de la acción ANTES de ejecutar (ej.
   `contacts.delete` para `DELETE /api/contacts/:id`).
4. **Nunca** confiar en filtros del cliente (`?onlyMine=true` puede ser
   ignorado server-side si el usuario tiene viewAll).

## 5. Contrato FRONTEND

### 5.1 Helpers existentes

**`src/lib/permissions.ts`**:
```ts
useHasPermission(key: PermissionKey): boolean
hasPermission(role: string, key: PermissionKey): boolean
loadRolePermissions(): RolePermissions
saveRolePermissions(perms: RolePermissions): void
```

**`src/lib/currentUser.ts`**:
```ts
useCurrentUser(): User
isAdmin(user: User): boolean
```

### 5.2 Helpers a CREAR (TODO)

Para no repetir filtros de visibilidad en cada listado:

```ts
// src/lib/visibility.ts
export type Scope = "contacts" | "records" | "opportunities"
                  | "sales" | "visits" | "documents" | "emails";

/**
 * Devuelve un predicado para filtrar listados según la visibilidad
 * del usuario actual. Si tiene `*.viewAll` (o es admin) acepta todo;
 * si solo tiene `*.viewOwn`, filtra por presencia en assignedTo.
 */
export function useVisibilityFilter<T extends { assignedTo: string[] }>(
  scope: Scope,
): (item: T) => boolean;
```

Uso esperado:

```tsx
const canSee = useVisibilityFilter<Contact>("contacts");
const visible = useMemo(() => allContacts.filter(canSee), [allContacts, canSee]);
```

### 5.3 Patrón de gating de acciones

**Botones / acciones**:
```tsx
const canDelete = useHasPermission("contacts.delete");
{canDelete && <button onClick={...}>Eliminar</button>}
```

**Tabs / vistas enteras**:
```tsx
if (!canViewOwn) return <NoAccessView feature="WhatsApp" />;
```

**Acciones bulk**: filtrar por permiso en el handler ANTES de
disparar la mutación, no solo ocultar el botón.

### 5.4 Componentes de UI ya pensados

- **`<NoAccessView />`** y **`<NotConfiguredView />`** — viven en
  `ContactWhatsAppTab.tsx`. Patrón a replicar en otros tabs cuando
  hagamos gating real.

- **Indicador "live" en Settings** — `live: true` en el registry
  (`src/components/settings/registry.ts`) marca qué páginas tienen
  contenido funcional. La de **Roles y permisos** ya está marcada
  `live: true, done: true`.

## 6. Estado actual del código (auditoría · abril 2026)

### ✅ Implementado
- Catálogo + matriz + UI en `/ajustes/usuarios/roles`.
- 5 keys: `whatsapp.{viewAll,viewOwn,manageChannel}`, `contacts.{editOrgTags,delete}`.
- Hook `useHasPermission()` y helper `isAdmin()`.
- WhatsApp tab respeta los 3 permisos de WhatsApp.
- Eliminar contacto requiere `contacts.delete` (vía `useConfirm` solo, no estricto).

### ❌ Pendiente (gating real)
- **Listado `/contactos`** muestra TODOS los contactos sin filtrar por `assignedTo` del usuario actual.
- **Tabs Registros / Operaciones / Visitas / Documentos / Emails**: misma situación.
- **Faltan keys** del catálogo de la sección 2: contacts.{viewOwn,viewAll,...}, records.*, opportunities.*, sales.*, visits.*, documents.*, emails.*, promotions.*, microsites.*, agencies.*, calendar.*, settings.*, audit.*.
- **`useVisibilityFilter()` no existe** — hay que crearlo.
- **Acciones bulk** (selección múltiple en listas) no chequean permisos.
- **Botón "Asignar miembros"** en el Resumen de la ficha no requiere `contacts.assign`.

### 🔵 Tareas de migración (orden sugerido)

1. **Ampliar `PermissionKey`** con todas las keys de la sección 2.
2. **Hidratar `DEFAULT_ROLE_PERMISSIONS`** con la matriz de la sección 3.
3. **Añadir `assignedTo: string[]`** al tipo de cada entidad
   (`Contact`, `Registro`, `Oportunidad`, `Venta`, `Visit`, `Document`,
   `Email`). Hidratar en mocks.
4. **Crear `src/lib/visibility.ts`** con `useVisibilityFilter()`.
5. **Aplicar el filtro** en cada listado:
   - `src/pages/Contactos.tsx`
   - `src/pages/Registros.tsx`
   - `src/pages/Ventas.tsx`
   - (los tabs de la ficha YA filtran porque viven dentro de un contacto al que ya tienes acceso, salvo que necesitemos ocultar campos sensibles entre miembros).
6. **Gating de acciones**: `Eliminar`, `Asignar`, `Aprobar registro`,
   `Editar comisión`, etc. — wrap con `useHasPermission()`.
7. **Reemplazar placeholders** por `<NoAccessView />` cuando el usuario no tenga `viewOwn` del dominio.
8. **Backend**: implementar §4 antes de quitar el modo mock de
   `permissions.ts`.

## 7. Casos límite / open questions

- **Compartir un contacto puntualmente** con un miembro fuera del
  `assignedTo` (ej. cubrir vacaciones). ¿Mecanismo de "delegación
  temporal"? Pendiente: ver `docs/open-questions.md`.

- **Auto-asignación al crear**: cuando un member crea un contacto, ¿se
  auto-añade a `assignedTo`? Recomendación: SÍ siempre, además de los
  miembros que el usuario marque manualmente.

- **Visibilidad CROSS-AGENCIA**: agencia A nunca ve datos de cliente,
  comisión o nota interna de agencia B (regla del producto, no del
  rol). Esto es ortogonal y se implementa con un filtro extra
  `current_user.agency_id = entity.agency_id` en la RLS, encadenado
  con la visibilidad de ownership.

- **Audit log**: ¿`audit.viewAll` deja ver eventos sensibles (cambios
  de comisión, edición de roles)? Probablemente sí — es justo el
  público objetivo.

- **Owner del workspace**: ¿se modela como un permiso especial o como
  un flag `is_owner` en `workspace_members`? Recomendación: flag
  separado. Owner siempre tiene `settings.manageWorkspaceDelete` y
  no se puede quitar a sí mismo `settings.manageRoles`.

## 8. Referencias cruzadas

- Código fuente actual: `src/lib/permissions.ts`, `src/lib/currentUser.ts`.
- UI de configuración: `src/pages/ajustes/usuarios/roles.tsx`.
- Reglas del producto sobre datos cross-agencia: `docs/product.md`.
- Modelo de datos: `docs/data-model.md` (añadir `assignedTo[]` a las entidades).
- Endpoints: `docs/backend-integration.md` (añadir sección Permissions).
