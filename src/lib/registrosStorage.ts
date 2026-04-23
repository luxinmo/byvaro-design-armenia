/**
 * registrosStorage.ts · Registros creados por el usuario (mock en localStorage).
 *
 * QUÉ
 * ----
 * Los registros "base" viven en `src/data/records.ts` (seed). Cuando el
 * usuario dispara "Registrar cliente" desde la ficha de una promoción,
 * construimos un `Registro` y lo guardamos aquí para que luego se vea
 * listado en `/registros` junto con los mocks de origen.
 *
 * CÓMO
 * ----
 * Clave en localStorage: `byvaro.registros.created.v1`. El hook
 * `useCreatedRegistros()` se suscribe a un evento custom y al evento
 * `storage` para reaccionar a cambios en vivo o desde otra pestaña.
 *
 * TODO(backend): sustituir por POST /api/promociones/:id/registros y
 * un GET que devuelva los que pertenecen al usuario según RLS.
 */

import { useEffect, useState } from "react";
import type { Registro } from "@/data/records";

const STORAGE_KEY = "byvaro.registros.created.v1";
const CHANGE_EVENT = "byvaro:registros-change";

function read(): Registro[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Registro[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Registro[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function addCreatedRegistro(r: Registro) {
  const list = read();
  write([r, ...list]);
}

export function removeCreatedRegistro(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function useCreatedRegistros(): Registro[] {
  const [list, setList] = useState<Registro[]>(read);
  useEffect(() => {
    const cb = () => setList(read());
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return list;
}
