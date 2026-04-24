# empresa-departamentos.md · Ajustes > Empresa > Departamentos

> Ruta: `/ajustes/empresa/departamentos`.
> Archivo: `src/pages/ajustes/empresa/departamentos.tsx`.
> Store: `src/lib/departmentsStorage.ts`.

## Propósito

CRUD de departamentos del workspace. Los departamentos son strings
únicos por workspace que se usan como **sugerencias** en los
formularios de alta/edición de miembro. No son una enum cerrada: el
admin puede escribir un departamento libre en el formulario del
miembro aunque no esté en la lista.

Antes los departamentos vivían como un array hardcodeado en
`MemberFormDialog.tsx`. Se movieron a un store gestionable porque
cada empresa tiene su propia estructura organizativa.

## Layout

Página estándar de Ajustes (`SettingsScreen`) con dos cards:

1. **Departamentos actuales** — listado con editar inline, eliminar
   con confirm.
2. **Añadir departamento** — input + botón (Enter también guarda).

## Reglas

- Deduplicación por nombre **case-insensitive** (manteniendo la
  capitalización que escribió el admin).
- Los departamentos no se pueden dejar vacíos (se trimmen en guardado).
- Eliminar un departamento **no cambia** los miembros que ya lo
  tenían asignado · conservan su valor hasta que se editen manualmente.
  El confirm lo explica.
- Renombrar propaga automáticamente por el store (un solo `saveDepartments`).

## Consumo desde otros componentes

```ts
import { useDepartments } from "@/lib/departmentsStorage";
const list = useDepartments(); // reactivo · actualiza al instante
```

Componentes que lo usan:
- `src/components/team/MemberFormDialog.tsx` · popover del campo
  Departamento.
- `src/components/team/InviteMemberDialog.tsx` · popover con
  sugerencias (antes era input plano).

## TODOs al conectar backend

```
GET    /api/workspace/departments       → string[]
POST   /api/workspace/departments       { name }
PATCH  /api/workspace/departments/:id   { name }
DELETE /api/workspace/departments/:id
```

El store mock respeta el orden del admin · backend también debe
respetarlo (no ordenar alfabéticamente). Ver `TODO(backend)` en
`src/lib/departmentsStorage.ts`.
