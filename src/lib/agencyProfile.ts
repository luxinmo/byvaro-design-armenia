/**
 * Datos fiscales y de contacto de una agencia colaboradora.
 *
 * Guardados desde la vista del promotor · es su "ficha operativa"
 * de la agencia con los campos que necesita para emitir contratos,
 * facturar comisiones, contactar al firmante legal, etc.
 *
 * Mock localStorage. En backend esto será:
 *   GET    /api/agencias/:id/profile
 *   PATCH  /api/agencias/:id/profile
 * Los campos públicos de la agencia (nombre, logo, web…) siguen
 * viviendo en `Empresa` (tenant agencia) · aquí solo los que el
 * promotor guarda como su "acuerdo operativo" con la agencia.
 */

import { useCallback, useEffect, useState } from "react";
import { memCache } from "./memCache";

export interface AgencyProfile {
  /** Nombre comercial · el que usa en carteles, web, emails. */
  nombreComercial?: string;
  /** Razón social · nombre jurídico completo en el Registro Mercantil. */
  razonSocial?: string;
  /** CIF / NIF de empresa. */
  cif?: string;
  /** Persona responsable de firmar los contratos de colaboración. */
  firmante?: {
    nombre?: string;
    cargo?: string;      // "Administrador", "Apoderado", etc.
    nif?: string;
    email?: string;
    telefono?: string;
  };
  /** Persona de contacto principal para el día a día (puede coincidir
   *  o no con el firmante). Si coincide con `Agency.contactoPrincipal`
   *  del mock, se prioriza este. */
  contactoPrincipal?: {
    nombre?: string;
    rol?: string;
    email?: string;
    telefono?: string;
  };
  /** Dirección fiscal · la que figura en contratos y facturas. */
  direccionFiscal?: {
    calle?: string;
    ciudad?: string;
    codigoPostal?: string;
    provincia?: string;
    pais?: string;
  };
  /** Web corporativa (opcional · lo básico suele venir en `Empresa`). */
  web?: string;
  /** Timestamp de la última actualización (para mostrar "actualizado hace N días"). */
  updatedAt?: number;
}

const STORAGE_KEY = "byvaro.agencyProfiles.v1";
const CHANGE_EVENT = "byvaro:agency-profile-change";

type Store = Record<string, AgencyProfile>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = memCache.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  memCache.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getAgencyProfile(agencyId: string): AgencyProfile {
  return readStore()[agencyId] ?? {};
}

export function saveAgencyProfile(agencyId: string, profile: AgencyProfile) {
  const store = readStore();
  store[agencyId] = { ...profile, updatedAt: Date.now() };
  writeStore(store);
  void syncAgencyProfileToSupabase(agencyId, store[agencyId]);
}

/* ── Write-through · org_settings.key=agency_profile (per-agency from
 *    the developer's POV · scoped to the developer's organization). */
async function syncAgencyProfileToSupabase(agencyId: string, profile: AgencyProfile) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { getCurrentOrgId } = await import("./dbWriteThrough");
    const orgId = await getCurrentOrgId();
    if (!orgId) return;
    const { error } = await supabase.from("org_settings").upsert({
      organization_id: orgId,
      key: `agency_profile:${agencyId}`,
      value: profile as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,key" });
    if (error) console.warn("[agencyProfile] sync:", error.message);
  } catch (e) {
    console.warn("[agencyProfile] sync skipped:", e);
  }
}

/** Pull desde `org_settings.key like 'agency_profile:%'`. */
export async function hydrateAgencyProfilesFromSupabase(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { getCurrentOrgId } = await import("./dbWriteThrough");
    const orgId = await getCurrentOrgId();
    if (!orgId) return;
    const { data, error } = await supabase.from("org_settings")
      .select("key, value")
      .eq("organization_id", orgId)
      .like("key", "agency_profile:%");
    if (error || !data) return;
    const store: Store = {};
    for (const r of data) {
      const k = (r.key as string).slice("agency_profile:".length);
      if (k) store[k] = r.value as AgencyProfile;
    }
    if (typeof window !== "undefined") {
      memCache.setItem(STORAGE_KEY, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch (e) {
    console.warn("[agencyProfile] hydrate skipped:", e);
  }
}

export function useAgencyProfile(agencyId: string): [AgencyProfile, (patch: AgencyProfile) => void] {
  const [profile, setProfile] = useState<AgencyProfile>(() => getAgencyProfile(agencyId));
  useEffect(() => {
    const cb = () => setProfile(getAgencyProfile(agencyId));
    cb();
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agencyId]);
  const update = useCallback((patch: AgencyProfile) => {
    saveAgencyProfile(agencyId, { ...getAgencyProfile(agencyId), ...patch });
  }, [agencyId]);
  return [profile, update];
}

/** Resuelve un campo con fallback: si el promotor aún no lo ha
 *  guardado en `AgencyProfile`, se cae al dato del mock `Agency`
 *  o a `undefined`. Patrón pensado para mostrar "datos conocidos"
 *  mientras no se completa el alta. */
export function mergeAgencyProfile(
  profile: AgencyProfile,
  agencyFallback: {
    name?: string;
    contactoPrincipal?: { nombre: string; rol?: string; email: string; telefono?: string };
    offices?: { city: string; address: string }[];
  },
): AgencyProfile {
  const defaultOffice = agencyFallback.offices?.[0];
  return {
    ...profile,
    nombreComercial: profile.nombreComercial ?? agencyFallback.name,
    contactoPrincipal: {
      nombre:   profile.contactoPrincipal?.nombre   ?? agencyFallback.contactoPrincipal?.nombre,
      rol:      profile.contactoPrincipal?.rol      ?? agencyFallback.contactoPrincipal?.rol,
      email:    profile.contactoPrincipal?.email    ?? agencyFallback.contactoPrincipal?.email,
      telefono: profile.contactoPrincipal?.telefono ?? agencyFallback.contactoPrincipal?.telefono,
    },
    direccionFiscal: {
      ...profile.direccionFiscal,
      ciudad: profile.direccionFiscal?.ciudad ?? defaultOffice?.city,
      calle:  profile.direccionFiscal?.calle  ?? defaultOffice?.address,
    },
  };
}
