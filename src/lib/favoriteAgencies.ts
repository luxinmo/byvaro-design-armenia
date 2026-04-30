/**
 * lib/favoriteAgencies.ts · favoritos de agencias del promotor.
 *
 * Fuente única de verdad para los IDs de agencias marcadas como favoritas.
 * Persistencia en localStorage y sincronización cross-tab (storage event +
 * CustomEvent interno).
 *
 * QUÉ EXPONE
 * ──────────
 *   const { ids, isFavorite, toggleFavorite, add, remove } = useFavoriteAgencies();
 *
 * DÓNDE SE USA
 * ────────────
 *   - Colaboradores.tsx               → toggle estrella en cada card
 *   - PromotionAgenciesV2.tsx         → toggle en cards de colaboradores
 *                                       de la ficha de promoción
 *   - SharePromotionDialog.tsx        → filtro "Mis favoritos" al compartir
 *   - SendEmailDialog.tsx             → filtro "Favoritos" al elegir
 *                                       destinatarios de un email
 *
 * TODO(backend):
 *   GET /api/promotor/favoritos         → string[]
 *   POST /api/promotor/favoritos/:id    → { favorite: true }
 *   DELETE /api/promotor/favoritos/:id
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "byvaro-favoritos-agencias";
const EVENT = "byvaro:favoritos-agencias-changed";

/** Semilla inicial: algunos favoritos coherentes con los mocks para que
 *  la primera carga no se vea vacía. Al tocar el toggle se sobreescribe. */
const DEFAULT_FAVORITES = ["ag-1", "ag-3"];

function loadAll(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_FAVORITES);
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : DEFAULT_FAVORITES);
  } catch {
    return new Set(DEFAULT_FAVORITES);
  }
}

function saveAll(ids: Set<string>) {
  /* Optimistic local · write-through a Supabase async. */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  window.dispatchEvent(new CustomEvent(EVENT));
  void syncFavoritesToSupabase(ids);
}

async function syncFavoritesToSupabase(ids: Set<string>) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    /* Diff · borramos los que ya no están + insertamos los nuevos.
     *  Para Phase 2 simple: borrar todos los del user kind=agency y
     *  re-insertar. Volumen es bajo (<50 favoritos por user). */
    await supabase.from("user_favorites")
      .delete().eq("user_id", user.id).eq("kind", "agency");

    if (ids.size > 0) {
      const rows = Array.from(ids).map((target_id) => {
        /* organization_id en user_favorites debe ser el WORKSPACE del
         *  user que marca · resolvemos con primera membership activa.
         *  Phase 2 simplificado · si user en varias orgs, usa la primera. */
        return { user_id: user.id, kind: "agency", target_id };
      });
      /* Necesitamos organization_id · derivamos de la primera membership. */
      const { data: members } = await supabase
        .from("organization_members")
        .select("organization_id").eq("user_id", user.id).eq("status", "active")
        .order("created_at", { ascending: true }).limit(1);
      const orgId = members?.[0]?.organization_id;
      if (!orgId) return;
      const { error } = await supabase.from("user_favorites").insert(
        rows.map((r) => ({ ...r, organization_id: orgId }))
      );
      if (error) console.warn("[favoriteAgencies] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[favoriteAgencies] supabase sync skipped:", e);
  }
}

export function useFavoriteAgencies() {
  const [ids, setIds] = useState<Set<string>>(() => loadAll());

  useEffect(() => {
    const onChange = () => setIds(loadAll());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    const current = loadAll();
    if (current.has(id)) current.delete(id);
    else current.add(id);
    saveAll(current);
  }, []);

  const add = useCallback((id: string) => {
    const current = loadAll();
    if (!current.has(id)) { current.add(id); saveAll(current); }
  }, []);

  const remove = useCallback((id: string) => {
    const current = loadAll();
    if (current.has(id)) { current.delete(id); saveAll(current); }
  }, []);

  return { ids, isFavorite, toggleFavorite, add, remove };
}
