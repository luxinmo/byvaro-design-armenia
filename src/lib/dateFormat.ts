/**
 * dateFormat.ts · formateador único de fechas de la app.
 *
 * Lee la preferencia guardada en `/ajustes/idioma-region/formato-fecha`
 * (localStorage `byvaro.userDateFormat.v1`) y aplica el mismo formato
 * en TODA la app: fichas de contacto, historial, emails, documentos…
 *
 * Formatos soportados:
 *   DD/MM/YYYY   → "21/04/2026"   (Europa, España — default)
 *   MM/DD/YYYY   → "04/21/2026"   (Estados Unidos)
 *   YYYY-MM-DD   → "2026-04-21"   (ISO 8601, técnico)
 *   DD MMM YYYY  → "21 abr 2026"  (legible corto)
 *   DD MMMM YYYY → "21 abril 2026" (legible largo)
 *
 * TODO(backend): cuando el usuario cambie su preferencia se sincroniza
 *   server-side vía PATCH /api/me { dateFormat }.
 */

import { useEffect, useState } from "react";

const KEY = "byvaro.userDateFormat.v1";
const CHANGE_EVENT = "storage"; // cross-tab; también disparamos manualmente al guardar en settings

export type DateFormatPreset =
  | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
  | "DD MMM YYYY" | "DD MMMM YYYY";

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG  = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function getDateFormat(): DateFormatPreset {
  if (typeof window === "undefined") return "DD/MM/YYYY";
  const raw = window.localStorage.getItem(KEY);
  if (raw && raw.length > 0) return raw as DateFormatPreset;
  return "DD/MM/YYYY";
}

/** Formatea una fecha ISO (`2026-04-21` o Date-compatible string) según
 *  la preferencia del usuario. Devuelve `""` si la fecha es inválida. */
export function formatDate(iso?: string | Date | null, preset?: DateFormatPreset): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = preset ?? getDateFormat();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const mmm = MONTHS_SHORT[d.getMonth()];
  const mmmm = MONTHS_LONG[d.getMonth()];
  switch (p) {
    case "MM/DD/YYYY":   return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":   return `${yyyy}-${mm}-${dd}`;
    case "DD MMM YYYY":  return `${dd} ${mmm} ${yyyy}`;
    case "DD MMMM YYYY": return `${dd} ${mmmm} ${yyyy}`;
    case "DD/MM/YYYY":
    default:             return `${dd}/${mm}/${yyyy}`;
  }
}

/** Hook reactivo · reformatea al cambiar la preferencia (storage event). */
export function useDateFormat(): DateFormatPreset {
  const [preset, setPreset] = useState<DateFormatPreset>(() => getDateFormat());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setPreset(getDateFormat());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);
  return preset;
}
