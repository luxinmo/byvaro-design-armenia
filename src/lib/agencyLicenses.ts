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
import { memCache } from "./memCache";
import type { Agency } from "@/data/agencies";
import type { LicenciaInmobiliaria } from "./licenses";

const KEY = "byvaro.agencyLicenses.v1";
const CHANGE = "byvaro:agency-licenses-changed";

type Store = Record<string, LicenciaInmobiliaria[]>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = memCache.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStore(store: Store) {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY, JSON.stringify(store));
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
  void syncLicensesToSupabase(agencyId, list);
}

/* ── Write-through · `agency_licenses` table. Reemplaza completamente
 *    el set de licencias del agency · DELETE + INSERT batch. */
async function syncLicensesToSupabase(agencyId: string, list: LicenciaInmobiliaria[]) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    await supabase.from("agency_licenses").delete().eq("organization_id", agencyId);
    if (list.length === 0) return;
    const rows = list.map((l) => ({
      organization_id: agencyId,
      type: l.tipo,
      registry_label: l.etiqueta ?? null,
      number: l.numero,
      issued_date: l.desde ?? null,
      expires_date: l.expiraEn ?? null,
      document_url: null,
      verified: l.verificada ?? false,
      verified_at: null,
      metadata: { raw: l },
    }));
    const { error } = await supabase.from("agency_licenses").insert(rows);
    if (error) console.warn("[agencyLicenses] sync:", error.message);
  } catch (e) {
    console.warn("[agencyLicenses] sync skipped:", e);
  }
}

/** Pull desde Supabase a localStorage. */
export async function hydrateAgencyLicensesFromSupabase(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from("agency_licenses").select("*");
    if (error || !data) return;
    const store: Store = {};
    for (const r of data) {
      const orgId = r.organization_id as string;
      if (!store[orgId]) store[orgId] = [];
      const meta = (r.metadata ?? {}) as { raw?: LicenciaInmobiliaria };
      store[orgId].push({
        ...(meta.raw ?? {}),
        tipo: r.type as LicenciaInmobiliaria["tipo"],
        etiqueta: (r.registry_label as string | null) ?? undefined,
        numero: r.number as string,
        desde: (r.issued_date as string | null) ?? undefined,
        expiraEn: (r.expires_date as string | null) ?? undefined,
        verificada: !!r.verified,
      } as LicenciaInmobiliaria);
    }
    if (typeof window !== "undefined") {
      memCache.setItem(KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent(CHANGE));
    }
  } catch (e) {
    console.warn("[agencyLicenses] hydrate skipped:", e);
  }
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
