/**
 * useTabParam · hook canónico para sincronizar la tab activa de una
 * pantalla con un query param en la URL (por defecto `?tab=`).
 *
 * REGLA DE ORO — ver CLAUDE.md §"Estado navegable en la URL":
 * Todas las sub-navegaciones de nivel pantalla (tabs de ficha,
 * secciones internas de detalle) DEBEN usar este hook en vez de
 * `useState`. Motivo: si el usuario navega a una sub-pantalla y pulsa
 * "atrás", la tab se pierde cuando es estado local; con URL sync, el
 * historial del navegador la restaura automáticamente.
 *
 * Uso típico:
 *
 *   const TABS = ["resumen", "historial", "registros"] as const;
 *   type Tab = typeof TABS[number];
 *   const [tab, setTab] = useTabParam<Tab>(TABS, "resumen");
 *
 * Características:
 *  · Inicial leída de la URL (si válida), fallback a `defaultKey`.
 *  · Al cambiar, escribe con `replace: true` para NO ensuciar el
 *    historial mientras se cambian tabs dentro de la misma pantalla.
 *  · Cuando el valor coincide con `defaultKey`, elimina el param de
 *    la URL para mantenerla limpia (p. ej. `/contactos/5` en vez de
 *    `/contactos/5?tab=resumen`).
 *  · Genérico en el tipo de clave — idealmente una union literal para
 *    evitar typos.
 *  · Segundo param opcional `paramName` si necesitas varias tabs
 *    ortogonales en la misma pantalla (ej. `?tab=...&dim=...`).
 *
 * Back-compat: cuando migres desde `useState`, mantén el mismo orden
 * de devolución `[value, setValue]` para no tocar el resto del JSX.
 */

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useTabParam<T extends string>(
  validKeys: readonly T[],
  defaultKey: T,
  paramName: string = "tab",
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  /* Parsear el valor actual · si no está o es inválido, usar default. */
  const current: T = useMemo(() => {
    const raw = searchParams.get(paramName);
    if (raw && (validKeys as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return defaultKey;
  }, [searchParams, paramName, validKeys, defaultKey]);

  const setValue = useCallback(
    (next: T) => {
      const nextParams = new URLSearchParams(searchParams);
      if (next === defaultKey) {
        nextParams.delete(paramName);
      } else {
        nextParams.set(paramName, next);
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams, defaultKey, paramName],
  );

  return [current, setValue];
}
