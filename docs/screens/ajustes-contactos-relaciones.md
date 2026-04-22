# Pantalla · Ajustes · Tipos de relación entre contactos (`/ajustes/contactos/relaciones`)

> Spec funcional de la página de catálogo de tipos de relación. Vista
> Promotor (Admin). Implementada en
> `src/pages/ajustes/contactos/relaciones.tsx`.
> Decisión arquitectónica: ver ADR-044.

## Propósito

Catálogo editable por admin de los **tipos de relación entre
contactos** (ej. cónyuge, pareja, familiar, colega, inversor conjunto,
heredero, asesor financiero, tutor legal). Se usa en el dialog
"Vincular contacto" de la ficha (sidebar Resumen).

5 tipos predeterminados se hidratan al primer load. El admin puede
añadir custom, renombrar, activar/desactivar y eliminar custom (los
predeterminados solo se pueden desactivar, no eliminar).

## Layout

Pantalla estándar de Settings (`SettingsScreen` + `SettingsCard`):

```
┌──────────────────────────────────────────────────────────────────┐
│ Tipos de relación                                                │
│ Cómo se vinculan los contactos entre sí (cónyuges, familiares…) │
│                                                                  │
│ [Valores por defecto]                          [Guardar]        │
├──────────────────────────────────────────────────────────────────┤
│ N tipos activos                                                  │
│ Los tipos desactivados se mantienen para vínculos existentes…   │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ ❤  Cónyuge        [predet.]              ✓  ✎  🗑       │    │
│ │ ❤  Pareja         [predet.]              ✓  ✎  🗑       │    │
│ │ 👥 Familiar       [predet.]              ✓  ✎  🗑       │    │
│ │ 💼 Colega         [predet.]              ✓  ✎  🗑       │    │
│ │ ⋯  Otro           [predet.]              ✓  ✎  🗑       │    │
│ │ 👤 Inversor conjunto                     ✓  ✎  🗑       │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                              [+ Añadir tipo]    │
└──────────────────────────────────────────────────────────────────┘
```

Los tipos desactivados se renderizan con `bg-muted/20 opacity-60` y
chip "desactivado".

## Componentes

- **`SettingsScreen`** — wrapper estándar con title, description y
  actions slot.
- **`SettingsCard`** — wrapper de card con title, description y
  footer slot.
- **Lista de items** inline editables (no modal):
  - Click en ✎ → input se hace editable inline (autoFocus, Enter
    para guardar, Escape o blur para cancelar).
  - Click en ✓/✗ → toggle `enabled`.
  - Click en 🗑 → `useConfirm()` antes de eliminar.
- **Item de creación**: aparece al final cuando se pulsa
  "+ Añadir tipo", input vacío con placeholder
  "Ej. Inversor conjunto, Heredero…".

## Acciones del usuario

| Acción | Trigger | Permiso | Resultado |
|---|---|---|---|
| Añadir tipo nuevo | "+ Añadir tipo" + escribir + Enter | Admin | Se añade a `types` con id slug generado |
| Renombrar | ✎ + escribir + Enter | Admin | `t.label` actualizado |
| Activar / desactivar | ✓ / ✗ | Admin | `t.enabled` toggle |
| Eliminar custom | 🗑 + confirm | Admin | `t` quitado del array |
| Eliminar predeterminado | 🗑 + confirm | Admin | Idem (los vínculos existentes lo siguen mostrando como label) |
| Restaurar valores por defecto | "Valores por defecto" + confirm | Admin | Reset a 5 tipos predeterminados, custom se pierden |
| Guardar cambios | "Guardar" | Admin | `saveRelationTypes(types)` → `byvaro.contacts.relationTypes.v1` |

## Validaciones

- **Etiqueta no vacía**: `clean = newLabel.trim()` debe tener length > 0.
- **Sin duplicados** (case-insensitive): si `types.some(t => t.label.toLowerCase() === clean.toLowerCase())` entonces `toast.error("Ya existe un tipo con ese nombre")`.
- **Id único**: `nextRelationTypeId(label, types)` slugifica + añade
  sufijo numérico si choca.
- **Dirty tracking**: `useDirty()` activa el guardrail de "tienes
  cambios sin guardar" si sale del SettingsShell sin pulsar Guardar.

## API endpoints esperados

```
GET    /api/contacts/relation-types
       → { types: RelationType[] }
PUT    /api/contacts/relation-types
       Body: { types: RelationType[] }
       Permiso: settings.manageRoles (o uno específico
       contacts.manageRelationTypes si se quiere granular).
       Devuelve la lista guardada.
```

Tipo:
```ts
export type RelationType = {
  id: string;       // slug inmutable
  label: string;    // editable
  enabled?: boolean; // false = desactivado
};
```

> Mientras no haya backend, el listado vive en `localStorage` bajo
> `byvaro.contacts.relationTypes.v1`. Helper de carga
> `loadRelationTypes()` cae a `DEFAULT_RELATION_TYPES` si no hay nada.

## Permisos

- Solo **Admin** puede editar (`isAdmin(user)`).
- Member ve la lista en read-only con un panel de "Solo
  administradores pueden gestionar los tipos de relación".

> En el modelo de permisos canónico (`docs/permissions.md`), este
> permiso entra en la familia `settings.*` o se promociona a un key
> propio `contacts.manageRelationTypes` si se quiere desacoplar.

## Estados

- **Loading**: instantáneo (storage local). Con backend, skeleton list.
- **Empty**: nunca empty — siempre hay 5 predeterminados garantizados.
- **Sin permisos**: card de bloqueo con icono 🔒.
- **Dirty unsaved**: SettingsShell intercepta navegación.

## Enlaces salientes

| Desde | A | Cuándo |
|---|---|---|
| (sin enlaces salientes) | — | — |

> El consumidor de este catálogo es `LinkContactDialog` en la ficha
> de contacto, que llama a `loadRelationTypes()` cada vez que se
> abre y filtra `enabled !== false`.

## Responsive

- **375px**: items de lista a una columna, botones de acción
  visibles permanentemente (no solo en hover).
- **640px+ (sm)**: layout idéntico, más respiración.

## Notas de implementación

- `BUILTIN_IDS = ["spouse", "partner", "family", "colleague", "other"]` —
  los predeterminados se identifican por id, no por flag. Permite
  renombrar la etiqueta ("Cónyuge" → "Pareja registrada") sin perder
  el comportamiento.
- `ICON_FOR_BUILTIN` mapea cada predeterminado a su icono Lucide;
  los custom muestran ✎ por defecto.
- Al eliminar un tipo que algún contacto sigue usando (campo
  `relationType: string` en `ContactRelation`), `getRelationLabel(id)`
  cae al `id` literal como fallback.
- El registry (`src/components/settings/registry.ts`) tiene
  `live: true` para esta página — ver ADR-006 (regla del flag `live`).

## TODOs al conectar backend

```ts
// src/components/contacts/relationTypesStorage.ts
// TODO(backend): GET /api/contacts/relation-types
// TODO(backend): PUT /api/contacts/relation-types { types: [...] }
//   Permiso: settings.manageRoles
//   Invalidar caches del LinkContactDialog tras guardar.
```

## Open questions

- ¿Permiso propio `contacts.manageRelationTypes` o se aplica
  `settings.manageRoles`? Recomendación: propio para que un futuro
  rol "coordinador" pueda gestionar este catálogo sin tocar la
  matriz de permisos.
- ¿Versionado del catálogo? Si un admin renombra "Cónyuge" → "Pareja
  registrada", ¿los vínculos ya creados muestran el nuevo o el
  antiguo? Decisión actual (frontend): muestran el NUEVO (resuelto
  en cada render con `getRelationLabel`).
