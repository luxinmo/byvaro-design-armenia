/**
 * useResolvedAgencies · merge entre el seed estático `agencies` y el
 * cache hidratado desde Supabase (`byvaro-empresa:<orgId>`).
 *
 * PROBLEMA · el listado `/colaboradores` y similares importan el array
 * `agencies` directamente del seed · cuando una agencia edita su logo,
 * descripción o teléfono en `/empresa`, esos cambios se persisten en
 * localStorage scoped + Supabase, pero el seed sigue mostrando los
 * valores originales.
 *
 * Este hook resuelve la fusión en runtime · cada agency del seed se
 * "sobre-escribe" con los campos canónicos del cache scoped si los
 * tiene poblados. Re-renderiza al recibir `byvaro:empresa-changed`.
 *
 * Backend equivalent · cuando se sustituyan los seeds por
 * `GET /organizations` paginado, este hook se simplifica a un fetch
 * directo · los componentes mantienen la signature.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { agencies as SEED_AGENCIES, type Agency } from "@/data/agencies";
import { promotores as SEED_PROMOTORES } from "@/data/promotores";
import { defaultEmpresa, type Empresa } from "./empresa";

const EMPRESA_KEY_PREFIX = "byvaro-empresa:";

function readCachedEmpresa(orgId: string): Empresa | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(EMPRESA_KEY_PREFIX + orgId);
    if (!raw) return null;
    return { ...defaultEmpresa, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

function mergeAgencyWithCache(a: Agency): Agency {
  const cached = readCachedEmpresa(a.id);
  if (!cached) return a;
  /* Solo sobrescribimos los campos que la cache tiene poblados con
   * valor real · no rompemos el seed con strings vacíos. */
  return {
    ...a,
    publicRef: cached.publicRef?.trim() || a.publicRef,
    name: cached.nombreComercial?.trim() || a.name,
    logo: cached.logoUrl?.trim() || a.logo,
    cover: cached.coverUrl?.trim() || a.cover,
    description: cached.overview?.trim() || a.description,
    razonSocial: cached.razonSocial?.trim() || a.razonSocial,
    cif: cached.cif?.trim() || a.cif,
    sitioWeb: cached.sitioWeb?.trim() || a.sitioWeb,
    horario: cached.horario?.trim() || a.horario,
    fundadaEn: cached.fundadaEn?.trim() || a.fundadaEn,
    googleRating: cached.googleRating || a.googleRating,
    googleRatingsTotal: cached.googleRatingsTotal || a.googleRatingsTotal,
  };
}

/** Devuelve el array `agencies` con los logos/datos hidratados desde
 *  Supabase si están disponibles. Re-rendera en `byvaro:empresa-changed`. */
export function useResolvedAgencies(): Agency[] {
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    window.addEventListener("byvaro:empresa-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("byvaro:empresa-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return SEED_AGENCIES.map(mergeAgencyWithCache);
}

/** Mismo merge para los promotores externos (`prom-*`). */
export function useResolvedPromotores(): Agency[] {
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    window.addEventListener("byvaro:empresa-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("byvaro:empresa-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return SEED_PROMOTORES.map(mergeAgencyWithCache);
}

/** Resuelve UNA agencia por id, fusionando seed + cache. Útil cuando
 *  un componente solo necesita una concreta (ej. ficha pública). */
export function getResolvedAgencyById(id: string): Agency | undefined {
  const seed = SEED_AGENCIES.find((a) => a.id === id)
    ?? SEED_PROMOTORES.find((p) => p.id === id);
  if (!seed) return undefined;
  return mergeAgencyWithCache(seed);
}
