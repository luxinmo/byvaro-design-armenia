/**
 * Overrides locales de las licencias de una agencia.
 *
 * El seed de `src/data/agencies.ts` lleva un array `licencias`
 * por agencia, pero en el mock la propia agencia (cuando entra
 * con rol "agency" desde el AccountSwitcher) puede añadir,
 * editar o quitar las suyas desde `/ajustes/empresa/licencias`.
 * Esos cambios se persisten aquí en localStorage.
 *
 * Lectura: se devuelve el override si existe · si no, el seed.
 * Byvaro (staff interno) marca `verificada: true` cuando valida el
 * número contra el registro oficial · hoy eso es un flag manual,
 * en producción lo hará un scraper contra AICAT/RAICV/FMI/etc.
 */

import { useCallback, useEffect, useState } from "react";
import type { Agency } from "@/data/agencies";
import type { LicenciaInmobiliaria } from "./licenses";

const KEY = "byvaro.agencyLicenses.v1";
const CHANGE = "byvaro:agency-licenses-changed";

type Store = Record<string, LicenciaInmobiliaria[]>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStore(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGE));
}

/** Devuelve la lista efectiva de licencias para una agencia ·
 *  aplica el override de localStorage si existe, si no, el seed. */
export function getAgencyLicenses(agency: Agency): LicenciaInmobiliaria[] {
  const store = loadStore();
  const override = store[agency.id];
  return override ?? agency.licencias ?? [];
}

export function setAgencyLicenses(agencyId: string, list: LicenciaInmobiliaria[]): void {
  const store = loadStore();
  store[agencyId] = list;
  saveStore(store);
}

/** Hook reactivo · útil para las pantallas de edición en
 *  `/ajustes/empresa/licencias`. Devuelve la lista efectiva y un
 *  setter que persiste. */
export function useAgencyLicenses(
  agency: Agency,
): [LicenciaInmobiliaria[], (list: LicenciaInmobiliaria[]) => void] {
  const [list, setList] = useState<LicenciaInmobiliaria[]>(() => getAgencyLicenses(agency));
  useEffect(() => {
    const cb = () => setList(getAgencyLicenses(agency));
    cb();
    window.addEventListener(CHANGE, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agency]);
  const update = useCallback((next: LicenciaInmobiliaria[]) => {
    setAgencyLicenses(agency.id, next);
  }, [agency.id]);
  return [list, update];
}
