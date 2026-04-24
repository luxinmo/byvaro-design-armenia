/**
 * Cartera de promociones de una agencia (runtime).
 *
 * El seed de `agencies.ts` lleva un `promotionsCollaborating` estático
 * por agencia, pero cuando una agencia ACEPTA una invitación desde el
 * producto (flujo `AgencyInvitationBanner`), el id de la promoción
 * debe sumarse a su cartera para que:
 *   · Aparezca en su listado `/promociones`.
 *   · Pueda registrar clientes sobre ella.
 *   · Desaparezca del Bloque 2 "Aún sin compartir" del promotor.
 *
 * Este store guarda ese override en localStorage. `useAgencyCartera()`
 * devuelve el Set mergeado (seed + override) de forma reactiva.
 */

import { useEffect, useState } from "react";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";

const KEY = "byvaro.agencyCartera.v1";
const CHANGE = "byvaro:agency-cartera-changed";

type Store = Record<string, string[]>;

/** IDs de promociones que son realmente compartibles · usado para
 *  auto-limpiar entradas fantasma en la cartera override. */
function shareablePromoIds(): Set<string> {
  const ids = new Set<string>();
  for (const p of developerOnlyPromotions) {
    if (p.status === "active" && p.canShareWithAgencies !== false) ids.add(p.id);
  }
  for (const p of promotions) {
    if (p.status === "active") ids.add(p.id);
  }
  return ids;
}

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    const shareable = shareablePromoIds();
    let dirty = false;
    for (const agencyId of Object.keys(parsed)) {
      const filtered = (parsed[agencyId] ?? []).filter((id) => {
        if (!shareable.has(id)) { dirty = true; return false; }
        return true;
      });
      if (filtered.length !== (parsed[agencyId] ?? []).length) {
        parsed[agencyId] = filtered;
      }
    }
    if (dirty) window.localStorage.setItem(KEY, JSON.stringify(parsed));
    return parsed;
  } catch { return {}; }
}
function saveStore(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGE));
}

/** Añade una promoción a la cartera de la agencia · idempotente. */
export function addPromotionToCartera(agencyId: string, promotionId: string) {
  const store = loadStore();
  const list = new Set(store[agencyId] ?? []);
  if (list.has(promotionId)) return;
  list.add(promotionId);
  store[agencyId] = Array.from(list);
  saveStore(store);
}

/** Quita una promoción de la cartera (override · no toca el seed). */
export function removePromotionFromCartera(agencyId: string, promotionId: string) {
  const store = loadStore();
  const list = new Set(store[agencyId] ?? []);
  if (!list.has(promotionId)) return;
  list.delete(promotionId);
  store[agencyId] = Array.from(list);
  saveStore(store);
}

/** Set efectivo de promociones en cartera = seed + overrides. */
export function getCarteraSet(agency: Agency): Set<string> {
  const seed = new Set(agency.promotionsCollaborating ?? []);
  for (const id of loadStore()[agency.id] ?? []) seed.add(id);
  return seed;
}

/** Hook reactivo · el Set se reemplaza cuando se añade/quita algo. */
export function useAgencyCartera(agency: Agency): Set<string> {
  const [set, setSet] = useState<Set<string>>(() => getCarteraSet(agency));
  useEffect(() => {
    const cb = () => setSet(getCarteraSet(agency));
    cb();
    window.addEventListener(CHANGE, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agency]);
  return set;
}

/** Versión pura · útil para rutas sync (sin hook). */
export function isInCartera(agency: Agency, promotionId: string): boolean {
  return getCarteraSet(agency).has(promotionId);
}
