/**
 * anejosStorage.ts · CRUD mock de anejos sueltos en localStorage.
 *
 * QUÉ
 * ----
 * El seed canónico vive en `src/data/anejos.ts` (`anejosByPromotion`).
 * El promotor puede, desde la ficha de promoción:
 *   - Añadir anejos nuevos (parking o trastero).
 *   - Cambiar la visibilidad de cada anejo frente a agencias
 *     colaboradoras (`visibleToAgencies`).
 *   - Retirar / Reactivar (status).
 *   - Eliminar definitivamente.
 *
 * Guardamos el estado completo por promoción en un único objeto
 * `Record<promotionId, Anejo[]>`. En la primera lectura se fusiona el
 * seed del mock con cualquier override persistido.
 *
 * CÓMO
 * ----
 * Clave: `byvaro.anejos.v1`. Evento custom: `byvaro:anejos-change`.
 * El hook `useAnejosForPromotion()` se suscribe para mantener las
 * tablas sincronizadas sin recargar.
 *
 * TODO(backend): sustituir por endpoints reales — ver
 * `docs/backend-integration.md §3.1`:
 *   - GET    /api/promociones/:id/anejos
 *   - POST   /api/promociones/:id/anejos
 *   - PATCH  /api/anejos/:id
 *   - DELETE /api/anejos/:id
 */

import { useEffect, useState } from "react";
import { anejosByPromotion, type Anejo } from "@/data/anejos";

const STORAGE_KEY = "byvaro.anejos.v1";
const CHANGE_EVENT = "byvaro:anejos-change";

type Store = Record<string, Anejo[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function seedFor(promotionId: string): Anejo[] {
  const seed = anejosByPromotion[promotionId] ?? [];
  return seed.map((a) => ({ visibleToAgencies: true, ...a }));
}

/** Devuelve la lista canónica de anejos de una promoción (seed +
 *  overrides). Si nunca se tocó, devuelve el seed tal cual. */
export function getAnejos(promotionId: string): Anejo[] {
  const store = readStore();
  if (store[promotionId]) return store[promotionId];
  return seedFor(promotionId);
}

function commit(promotionId: string, next: Anejo[]) {
  const store = readStore();
  store[promotionId] = next;
  writeStore(store);
  /* Write-through · sync diff con `promotion_anejos`.
   *  Estrategia simple Phase 2 · borramos todos del promo y reinsert. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("promotion_anejos").delete().eq("promotion_id", promotionId);
      if (next.length > 0) {
        const rows = next.map((a) => ({
          id: a.id,
          promotion_id: promotionId,
          kind: a.tipo ?? "parking",
          label: (a as { label?: string; ref?: string }).label
            ?? (a as { ref?: string }).ref ?? null,
          price: (a as { precio?: number }).precio ?? null,
          status: a.status,
          metadata: a as unknown as Record<string, unknown>,
        }));
        const { error } = await supabase.from("promotion_anejos").insert(rows);
        if (error) console.warn("[anejos:sync]", error.message);
      }
    } catch (e) { console.warn("[anejos:sync] skipped:", e); }
  })();
}

export function addAnejo(
  promotionId: string,
  input: Omit<Anejo, "id" | "promotionId" | "status"> & { status?: Anejo["status"] },
): Anejo {
  const list = getAnejos(promotionId);
  const anejo: Anejo = {
    id: `anejo-${promotionId}-${Date.now()}`,
    promotionId,
    status: "available",
    visibleToAgencies: true,
    ...input,
  };
  commit(promotionId, [anejo, ...list]);
  return anejo;
}

export function updateAnejo(
  promotionId: string,
  anejoId: string,
  patch: Partial<Anejo>,
) {
  const list = getAnejos(promotionId);
  const next = list.map((a) => (a.id === anejoId ? { ...a, ...patch } : a));
  commit(promotionId, next);
}

export function deleteAnejo(promotionId: string, anejoId: string) {
  const list = getAnejos(promotionId);
  commit(promotionId, list.filter((a) => a.id !== anejoId));
}

/** Hook reactivo · se re-renderiza al mutar el store (misma pestaña
 *  vía `CHANGE_EVENT` u otra pestaña vía `storage`). */
export function useAnejosForPromotion(promotionId: string): Anejo[] {
  const [list, setList] = useState<Anejo[]>(() => getAnejos(promotionId));
  useEffect(() => {
    const cb = () => setList(getAnejos(promotionId));
    cb();
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [promotionId]);
  return list;
}
