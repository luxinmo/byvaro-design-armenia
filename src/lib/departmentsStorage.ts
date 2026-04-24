/**
 * departmentsStorage.ts · departamentos del workspace.
 *
 * Antes los departamentos vivían como un array hardcodeado en
 * `MemberFormDialog.tsx` (DEPARTMENT_SUGGESTIONS). El admin pidió
 * poder gestionarlos desde Ajustes → Empresa → Departamentos, así
 * que pasan a un store propio con CRUD.
 *
 * Un departamento es simplemente un string único por workspace. No
 * tiene jerarquía, no tiene color. Se usa como sugerencia en los
 * formularios de miembro · el admin lo selecciona (o escribe uno nuevo
 * libre — la lista son sugerencias, no una enum cerrada).
 *
 * TODO(backend): reemplazar por
 *   GET    /api/workspace/departments       → string[]
 *   POST   /api/workspace/departments       { name }
 *   PATCH  /api/workspace/departments/:id   { name }
 *   DELETE /api/workspace/departments/:id
 *   Respeta el orden devuelto por el backend · no se ordena alfabéticamente.
 */

import { useEffect, useState } from "react";

const KEY = "byvaro.workspace.departments.v1";
const EVENT = "byvaro:departments-change";

/** Semilla · si el workspace no tiene nada guardado, usamos estos
 *  departamentos iniciales (mismos que vivían hardcoded). */
export const DEFAULT_DEPARTMENTS = [
  "Comercial", "Marketing", "Operaciones", "Administración",
  "Dirección", "Atención al cliente", "Legal",
] as const;

export function getDepartments(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_DEPARTMENTS];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_DEPARTMENTS];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
      return arr;
    }
    return [...DEFAULT_DEPARTMENTS];
  } catch {
    return [...DEFAULT_DEPARTMENTS];
  }
}

export function saveDepartments(list: string[]): void {
  if (typeof window === "undefined") return;
  // Mantenemos el orden del admin · deduplica por comparación case-insensitive
  // pero conserva la capitalización original.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const d of list) {
    const t = d.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(t);
  }
  window.localStorage.setItem(KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function addDepartment(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const existing = getDepartments();
  if (existing.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    return false;
  }
  saveDepartments([...existing, trimmed]);
  return true;
}

export function renameDepartment(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const existing = getDepartments();
  // Si el nuevo nombre ya existe (distinto del viejo) lo rechazamos.
  if (
    existing.some(
      (d) => d.toLowerCase() === trimmed.toLowerCase()
          && d.toLowerCase() !== oldName.toLowerCase(),
    )
  ) {
    return false;
  }
  saveDepartments(existing.map((d) => (d === oldName ? trimmed : d)));
  return true;
}

export function removeDepartment(name: string): void {
  saveDepartments(getDepartments().filter((d) => d !== name));
}

export function reorderDepartments(list: string[]): void {
  saveDepartments(list);
}

/** Hook reactivo · se refresca cuando cambia el store. */
export function useDepartments(): string[] {
  const [list, setList] = useState<string[]>(() => getDepartments());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setList(getDepartments());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return list;
}
