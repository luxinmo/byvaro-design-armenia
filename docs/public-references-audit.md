# Public references · auditoría + modelo final

> Decisión de producto: una referencia pública por entidad (sin
> bifurcaciones lead↔opportunity ni preregistro↔registro). Las dos
> caras del mismo objeto comparten ref · solo cambia el `estado`.
>
> Final:
>
> - **Contact** → `coXXXXXX`
> - **Opportunity / Lead** → `opXXXXXX`
> - **Registration / Preregistration** → `reXXXXXX`
>
> UUID sigue siendo PK técnica · la ref es solo para humanos
> (búsqueda, emails, documentos, timeline, UI). Único por organización.

---

## TASK 1 · Auditoría del estado actual

### 1.1 · Contact

| Aspecto | Estado |
|---|---|
| Campo de ref | `reference?: string` en `Contact` · `src/components/contacts/types.ts:55` |
| Formato actual | `"CON-NNNN"` con 4 dígitos · ej. `"CON-0042"` |
| Generación | `nextContactReference(existingContacts)` en `createdContactsStorage.ts:44` · escanea todos los `reference` existentes y devuelve `CON-${max+1}` |
| Obligatorio | **No** · es `reference?:` (opcional). Seeds y `upsertContactFromRegistro` lo rellenan, pero el tipo no fuerza |
| PK técnica | `id: string` separado · ej. `"luxinmo-co1"` (slugify del nombre + sufijo Date.now en base36 · `generateContactId`) |
| Uso UI | Header de ficha de contacto · pendiente uniformar (no está en lista) |
| Unicidad | Cliente-side · escaneo de la lista en memoria · NO hay garantía cross-tenant |

### 1.2 · Lead / Opportunity

| Aspecto | Estado |
|---|---|
| Campo de ref | `reference: string` en `Lead` · `src/data/leads.ts:73` (obligatorio) |
| Formato actual | `"OPP-NNNN"` con 4 dígitos · ej. `"OPP-0001"` |
| Generación | **Hardcoded en seeds** · no hay helper `nextLeadReference()` análogo al de Contact |
| Obligatorio | **Sí** |
| PK técnica | `id: string` · ej. `"lead-001"` |
| Uso UI | Header de ficha de lead · `/leads/:id` |
| Unicidad | Solo seed estático · sin lógica de generación cliente-side |

**Observación clave**: el prefijo dice `OPP` pero la entidad se llama `Lead`. Ya hay disonancia · oportunidad de unificar a `op` (lowercase) en este pase.

### 1.3 · Registration / Preregistration

| Aspecto | Estado |
|---|---|
| Campo de ref | **NO existe** · `Registro` solo tiene `id: string` |
| Formato actual | `id` doble función: técnico + humano · ej. seed `"reg-001"`, creados `"reg-local-${Date.now()}"` |
| Generación | `id: \`reg-local-${Date.now()}\`` en `ClientRegistrationDialog.tsx:551` · timestamps no son referencias humanas |
| Obligatorio | `id` siempre · pero no es ref pública real |
| PK técnica | El mismo `id` |
| Uso UI | `id` aparece en mensajes como `matchWith: "Registrado primero por reg-local-1745..."` · impresentable al usuario |
| Unicidad | UUID-like por timestamp · suficiente cliente-side · no escala backend multi-tenant |

**Observación clave**: el `Registro` es la entidad **más visible al promotor en su día a día** (la cola de pendientes) y es la que NO tiene referencia humana. Es el principal gap.

### 1.4 · Resumen de inconsistencias

| Entidad | Ref pública | Formato | Obligatorio | Generador | Multi-tenant safe |
|---|---|---|---|---|---|
| Contact | `reference?` | `CON-NNNN` (4 digits) | no | sí (`nextContactReference`) | no |
| Lead | `reference` | `OPP-NNNN` (4 digits) | sí | hardcoded en seed | no |
| Registro | **falta** | — | — | — | — |
| Promotion | `code: string` | mixed (`SKY-001`, etc) | sí | hardcoded en seed | no |

(Promotion no estaba en el scope · lo menciono porque también necesitará alineación en Phase 2.)

### 1.5 · Gaps respecto al modelo final pedido

| Gap | Detalle |
|---|---|
| Registro sin ref | Necesario crear desde cero · `re` prefix |
| Formatos viejos | `CON-NNNN` / `OPP-NNNN` no coinciden con `coXXXXXX` / `opXXXXXX`. Cambio: prefijo lowercase + 6 dígitos en lugar de 4 |
| Contact ref opcional | Debe ser obligatorio una vez se aplique el modelo |
| Lead generator missing | Lead tiene refs hardcoded · se necesita helper análogo |
| Unicidad solo client-side | Phase 2 backend debe garantizar uniqueness con sequence per organization |
| `Registro.id` se usa como ref humana | `matchWith` y otros copy lo exponen al usuario · feo |
| Lead vs Opportunity | El campo se llama `Lead` pero el prefix `OPP` apunta a Opportunity. Decisión: unificar a `op` en lowercase + entidad sigue llamándose `Lead` (cambiar refactor más adelante) |

---

## TASK 2 · Modelo final de `publicRef`

### 2.1 · Tipo y formato

```ts
/**
 * Referencia pública de una entidad · única por organización ·
 * usada solo para humanos (búsqueda, emails, documentos, timeline,
 * UI labels). El UUID `id` sigue siendo PK técnica.
 *
 * Formato: prefix de 2 letras + 6 dígitos zero-padded.
 *   coXXXXXX · Contact
 *   opXXXXXX · Opportunity / Lead (misma entidad · ambos estados)
 *   reXXXXXX · Registration / Preregistration (misma entidad · estados distintos)
 */
type PublicRef = string;   // regex /^(co|op|re)\d{6}$/

const PUBLIC_REF_PREFIX = {
  contact:      "co",
  opportunity:  "op",   // = lead
  registration: "re",   // = preregistro · misma entidad
} as const;
```

**Por qué 6 dígitos**: 999.999 entidades por organización antes de overflow. 4 dígitos (`9999`) era inadecuado para promotores/agencias activos · 6 da margen para 10+ años. Lowercase prefix · más limpio en URLs y emails.

### 2.2 · Campos en cada entidad

```ts
type Contact = {
  id: string;            // UUID técnico · PK · interno
  publicRef: string;     // "co000042" · obligatorio · único por org
  // ... resto
};

type Lead = {            // entidad sigue llamándose Lead
  id: string;
  publicRef: string;     // "op000123" · obligatorio · único por org
  // ... resto
};

type Registro = {
  id: string;
  publicRef: string;     // "re000456" · obligatorio · único por org
  // ... resto
  // Mismo publicRef antes y después de transitar entre estados:
  // pendiente → preregistro_pendiente → preregistro_activo → aprobado
};
```

**Regla clave**: la `publicRef` es **inmutable durante la vida de la entidad**. Un Registro que pasa de `preregistro_pendiente` a `aprobado` mantiene su `re000456` · es el mismo objeto cambiando de estado.

### 2.3 · Migración del campo legacy

| Hoy | Después |
|---|---|
| `Contact.reference?: string` con `CON-NNNN` | `Contact.publicRef: string` con `coXXXXXX` |
| `Lead.reference: string` con `OPP-NNNN` | `Lead.publicRef: string` con `opXXXXXX` |
| `Registro.id` doble función | `Registro.id` solo técnico + nuevo `Registro.publicRef` con `reXXXXXX` |

**Estrategia de migración** (cuando se implemente):
- Backfill seeds de Contact: `CON-0042` → `co000042` (mantener número, cambiar prefix + padding).
- Backfill seeds de Lead: `OPP-0001` → `op000001`.
- Generar refs `reXXXXXX` en orden de `created_at` para los Registros existentes.
- Mantener `reference` como alias del nuevo `publicRef` durante 1 release para no romper UI.

### 2.4 · UUID como PK técnica

Sin cambios:
- Backend SQL: `id uuid primary key default gen_random_uuid()` · sigue siendo la PK.
- FK entre tablas SIEMPRE usan `id` UUID, nunca `publicRef`.
- API REST internas usan `id` para mutations (`POST /api/registros/:id/approve`).
- API públicas (futuras integraciones) pueden aceptar `publicRef` como path param para conveniencia (`GET /api/registros/by-ref/re000456`).

---

## TASK 3 · Generación y unicidad

### 3.1 · Sequence per organization

Backend Phase 2 (cuando exista):

```sql
-- Una secuencia por (organization_id, entity_type)
create table public_ref_sequences (
  organization_id  uuid not null references organizations(id) on delete cascade,
  entity_type      text not null check (entity_type in ('contact','opportunity','registration')),
  next_value       bigint not null default 1,
  primary key (organization_id, entity_type)
);

-- Función atómica: avanza el contador y devuelve la ref formateada.
create or replace function next_public_ref(p_org uuid, p_entity text)
returns text as $$
declare
  v_next bigint;
  v_prefix text;
begin
  insert into public_ref_sequences (organization_id, entity_type, next_value)
    values (p_org, p_entity, 1)
    on conflict (organization_id, entity_type)
    do update set next_value = public_ref_sequences.next_value + 1
    returning next_value into v_next;

  v_prefix := case p_entity
    when 'contact'      then 'co'
    when 'opportunity'  then 'op'
    when 'registration' then 're'
  end;

  return v_prefix || lpad(v_next::text, 6, '0');
end;
$$ language plpgsql;
```

**Concurrencia**: el `INSERT … ON CONFLICT … RETURNING` es atómico · dos creaciones simultáneas en la misma org reciben `re000042` y `re000043` sin colisión.

**Unicidad**: garantizada por el constraint compuesto de la secuencia + el helper. Adicionalmente:

```sql
alter table contacts        add constraint uq_contacts_pubref       unique (organization_id, public_ref);
alter table leads           add constraint uq_leads_pubref          unique (organization_id, public_ref);
alter table registrations   add constraint uq_registrations_pubref  unique (organization_id, public_ref);
```

### 3.2 · Generación cliente-side (Phase 1 mock)

Para mantener funcional el prototipo sin backend, helper único:

```ts
// src/lib/publicRef.ts (nuevo, no implementar aún)
export function generatePublicRef(
  entity: "contact" | "opportunity" | "registration",
  existing: { publicRef?: string }[],
): string {
  const prefix = { contact: "co", opportunity: "op", registration: "re" }[entity];
  const re = new RegExp(`^${prefix}(\\d{6})$`);
  let max = 0;
  for (const item of existing) {
    const m = item.publicRef?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}
```

Reemplaza `nextContactReference` actual y se reusa para Lead y Registro.

### 3.3 · Unicidad cross-tenant en backend

Cuando llegue Phase 2 con multi-org:

- `(organization_id, public_ref)` es UNIQUE. No se garantiza unicidad GLOBAL: dos orgs distintas pueden tener `co000042`. Es deseable: cada org tiene su numeración independiente.
- Búsqueda por ref: `WHERE organization_id = $1 AND public_ref = $2`. Filtrado por la org del usuario logueado · multi-tenant safe.

### 3.4 · Phase 1 mock (single-tenant)

Como hoy hay un solo workspace, la unicidad global = unicidad por org. El helper `generatePublicRef` que escanea `existing[]` en localStorage funciona sin sequence backend.

---

## TASK 4 · Uso solo para humanos · canales canónicos

### 4.1 · Búsqueda

| Canal | Ejemplo |
|---|---|
| Buscador global (⌘K) | usuario teclea `co000042` o `re000123` → resuelve directo a la ficha |
| Buscador de cada listado | input acepta tanto nombre como ref |
| URL deep-link | `/contactos?q=co000042` · `Contactos.tsx` ya lee `?q=` |

### 4.2 · Documentos

- Contratos generados (PDF) llevan ref del Contact en el header: "Cliente: Pedro García · Ref. co000042".
- Listados de precios y propuestas: Ref del Lead/Opportunity.
- Notificaciones emitidas a portales: Ref del Registro asociado.

### 4.3 · Emails

Asunto y body:
- "Confirmación de visita · co000042 · Pedro García"
- "Tu registro re000123 ha sido aprobado"
- Footer con `[Mention: re000123]` parseable para tracking de respuestas.

### 4.4 · Timeline

Cualquier evento que mencione otra entidad:
- "Lead op000089 convertido en Registro re000456"
- "Cliente co000042 vinculado al Contact co000017 (relación: pareja)"
- "Visita programada con co000042 el 28/abr a las 10:30"

### 4.5 · UI

| Sitio | Renderizado |
|---|---|
| Ficha de cualquier entidad | Pill secundario al lado del nombre · "co000042" en text-muted-foreground tabular-nums |
| Lista de contactos / leads / registros | Columna opcional (toggleable) "Ref" |
| Hover en mención cross-entity | Tooltip con la ref completa |
| Banner conflicto duplicado | "Otra agencia registró co000042 hace 47 días" en lugar de exponer UUIDs feos |

### 4.6 · Integraciones futuras (Phase 2+)

- Webhooks salientes incluyen `publicRef` además del `id` UUID · facilita debugging humano de logs.
- API públicas aceptan ambos como path params: `GET /api/contacts/:idOrRef`.

---

## TASK 5 · Unicidad por organización · resumen

| Capa | Garantía |
|---|---|
| Backend SQL | Sequence per (org_id, entity_type) + UNIQUE constraint compuesto (org_id, public_ref) |
| Backend API | Búsqueda siempre filtrada por `organization_id` del JWT |
| Frontend | `generatePublicRef()` escanea solo entidades de la org actual (en mock single-tenant = todas) |
| Visualización | La ref se muestra siempre con contexto de la org · no se expone cross-tenant |

**Casos edge**:

- Si un usuario pertenece a 2 orgs y cambia el `X-Organization-Id` activo, ve refs distintas para sus orgs · totalmente esperado.
- Refs no son globalmente únicas: `co000042` puede existir en orgs distintas. Las queries y la UI siempre asumen contexto de org.

---

## TASK 6 · Output consolidado

### 6.1 · Estado actual · resumen

| Entidad | Hoy | Cambio propuesto |
|---|---|---|
| Contact | `reference?` `CON-0042` (4 dig, optional) | `publicRef` `co000042` (6 dig, required) |
| Lead | `reference` `OPP-0001` (4 dig, hardcoded en seed) | `publicRef` `op000001` (6 dig, generador real) |
| Registro | sin ref · `id` doble función | `publicRef` `re000123` (nuevo) |

### 6.2 · Gaps identificados

1. Registro no tiene referencia pública · principal gap.
2. Formato `CON-NNNN` / `OPP-NNNN` no coincide con el modelo final solicitado (`coXXXXXX` / `opXXXXXX`).
3. Contact.reference es opcional · debe ser required.
4. Lead no tiene generador análogo a `nextContactReference`.
5. Unicidad cross-tenant ausente (cliente-side scan funciona en mock pero no escala).
6. UUID y referencia humana mezcladas: `Registro.id` se usa para ambas funciones · UUIDs aparecen en copy de UI.
7. Disonancia naming: campo `Lead` con prefix `OPP` no es consistente · oportunidad de alinear a `op` lowercase.

### 6.3 · Modelo final propuesto

```ts
// Contract pública por entidad

Contact {
  id: string;          // UUID técnico
  publicRef: string;   // "co000042" · obligatorio · único por org · inmutable
  // resto de campos sin cambios
}

Lead {
  id: string;
  publicRef: string;   // "op000089" · idem
  // resto sin cambios
}

Registro {
  id: string;
  publicRef: string;   // "re000456" · idem · MISMA ref antes/después de transitar
                       // entre pendiente → preregistro_activo → aprobado
  // resto sin cambios
}
```

**Backend** (Phase 2):
- Tabla `public_ref_sequences (organization_id, entity_type, next_value)` para atomic increment.
- Función `next_public_ref(org, entity_type)` server-side.
- UNIQUE constraint `(organization_id, public_ref)` por tabla.

**Frontend** (Phase 1 mock):
- Helper `src/lib/publicRef.ts::generatePublicRef(entity, existing)` que reemplaza `nextContactReference`.
- Backfill seeds: `CON-0042` → `co000042`, `OPP-0001` → `op000001`, generar `reXXXXXX` en orden de `fecha`.
- Mantener `reference` como alias deprecated 1 release.

### 6.4 · Lista de archivos afectados (cuando se implemente)

| Archivo | Cambio |
|---|---|
| `src/components/contacts/types.ts:55` | `reference?: string` → `publicRef: string` |
| `src/components/contacts/createdContactsStorage.ts:44` | Reemplazar `nextContactReference` con import de `generatePublicRef` |
| `src/components/contacts/data.ts` | Backfill todos los `reference: "CON-NNNN"` a `publicRef: "co00NNNN"` |
| `src/data/leads.ts:73` | `reference: string` → `publicRef: string`. Backfill 12 seeds. |
| `src/data/records.ts:135-210` | Añadir `publicRef: string` a `Registro` type. Backfill todos los seeds con `re00NNNN` por orden de `fecha`. |
| `src/lib/registroContactLink.ts:108` | Generar `publicRef` con helper en lugar de `reference` directo. |
| `src/components/promotions/detail/ClientRegistrationDialog.tsx:551` | Generar `publicRef` además del `id` técnico. |
| `src/components/registros/DuplicateResult.tsx` | `matchWith` mostrar `publicRef` en lugar de `id`. |
| `src/lib/publicRef.ts` | **Nuevo** · helper `generatePublicRef`. |

### 6.5 · Anti-overengineering · NO hacer ahora

- ❌ No migrar PK técnica `id` a UUIDs reales en frontend mock · sigue siendo el slug actual.
- ❌ No inventar prefix para `Promotion` (`pr000001`?) hasta que se valide el modelo en las 3 entidades pedidas.
- ❌ No añadir checksums tipo `co000042-X9` (estilo IBAN) · innecesario para Phase 1-2.
- ❌ No exponer la ref como path param en URLs (`/contactos/co000042`) hasta Phase 2 backend · hoy las URLs siguen usando `id` slug.

### 6.6 · Open questions

1. **¿La ref es case-insensitive en búsqueda?** · Propuesta: sí · `co000042` y `CO000042` resuelven igual. Almacenamiento siempre lowercase.
2. **¿Se permite reciclar números** de entidades borradas? · Propuesta: NO · la sequence solo avanza. Si Contact `co000042` se borra, ese número queda libre pero no se reutiliza · evita confusión histórica.
3. **¿Qué pasa si una entidad se mueve de org?** (raro pero posible · merge de orgs) · Propuesta: se le asigna nueva ref de la org destino · queda en historial la antigua para trazabilidad.
4. **¿El usuario puede personalizar el prefijo?** · Propuesta: NO. Constantes globales · evita fragmentación.
5. **¿Refs visibles a la otra agencia/owner cross-tenant?** · Propuesta: SÍ, con la ref de su propia org. La agencia ve `re000456` que es la ref del Registro EN SU CONTEXTO. El promotor ve la misma `re000456` que es su ref. Solo coincide porque el Registro es una sola entidad · no hay duplicación.
6. **¿Cuándo se backfillean los seeds?** · Propuesta: en el mismo PR de implementación · así no quedan datos huérfanos sin ref.
7. **`Promotion.code` vs `publicRef`** · ¿se mantienen ambos? Propuesta: por ahora sí · `code` es el código abreviado de la promoción usado como prefijo de unidades (`SKY-001`). `publicRef` sería la ref interna. Decidir en Phase 2.
8. **Lead vs Opportunity nombre del enum/tipo TS** · Propuesta: dejar `Lead` como nombre TS (refactor mayor) y solo cambiar el prefix de la ref a `op` para señalizar la equivalencia. Renombrar la entidad en Phase 2+.

---

## Referencias

- `src/components/contacts/types.ts:55` · Contact.reference actual.
- `src/components/contacts/createdContactsStorage.ts:44` · `nextContactReference` helper.
- `src/data/leads.ts:73` · Lead.reference actual.
- `src/data/records.ts:135-210` · Registro sin reference.
- `docs/registration-system.md` · sistema de registro.
- `docs/contact-origins-audit.md` · orígenes acumulados.
- `docs/registration-generic-model.md` · partes genéricas + last activity.
