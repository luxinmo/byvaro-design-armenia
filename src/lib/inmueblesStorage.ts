/**
 * inmueblesStorage.ts — Persistencia y hook reactivo de inmuebles.
 *
 * REGLA DE ORO · "Datos del workspace son por tenant" — la clave
 * lleva sufijo del workspace (`developer-default` o `agency-<id>`)
 * para que cada org sólo vea los suyos. Si el promotor y la agencia
 * comparten navegador (un solo localStorage), la separación se hace
 * por clave.
 *
 * TODO(backend): reemplazar por `GET /api/inmuebles` (scoped por JWT
 * con RLS Postgres). El endpoint público de la red filtra adicional
 * por `share_with_network = true` y devuelve sólo los inmuebles
 * habilitados de OTROS workspaces.
 */

import { useEffect, useState } from "react";
import { useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";
import {
  seedInmueblesForWorkspace,
  type Inmueble,
} from "@/data/inmuebles";

const BASE_KEY = "byvaro.inmuebles.v1";
const CHANNEL_EVENT = "byvaro:inmuebles-changed";

function storageKey(workspaceKey: string): string {
  return `${BASE_KEY}:${workspaceKey}`;
}

/* ─── Lectura sincrona ───────────────────────────────────────────── */

export function getInmueblesForWorkspace(workspaceKey: string): Inmueble[] {
  if (typeof window === "undefined") {
    return seedInmueblesForWorkspace(workspaceKey);
  }
  const raw = window.localStorage.getItem(storageKey(workspaceKey));
  if (!raw) return seedInmueblesForWorkspace(workspaceKey);
  try {
    const parsed = JSON.parse(raw) as Inmueble[];
    if (Array.isArray(parsed)) return parsed;
    return seedInmueblesForWorkspace(workspaceKey);
  } catch {
    return seedInmueblesForWorkspace(workspaceKey);
  }
}

function persist(workspaceKey: string, list: Inmueble[]): void {
  window.localStorage.setItem(storageKey(workspaceKey), JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANNEL_EVENT, { detail: { workspaceKey } }));
}

/* ─── Mutaciones ─────────────────────────────────────────────────── */

export function createInmueble(workspaceKey: string, draft: Omit<Inmueble, "id" | "organizationId" | "createdAt" | "updatedAt">): Inmueble {
  const now = new Date().toISOString();
  const inmueble: Inmueble = {
    ...draft,
    id: `inm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    organizationId: workspaceKey,
    createdAt: now,
    updatedAt: now,
  };
  const list = [inmueble, ...getInmueblesForWorkspace(workspaceKey)];
  persist(workspaceKey, list);
  return inmueble;
}

export function updateInmueble(workspaceKey: string, id: string, patch: Partial<Inmueble>): void {
  const list = getInmueblesForWorkspace(workspaceKey).map((i) =>
    i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i,
  );
  persist(workspaceKey, list);
}

export function deleteInmueble(workspaceKey: string, id: string): void {
  const list = getInmueblesForWorkspace(workspaceKey).filter((i) => i.id !== id);
  persist(workspaceKey, list);
}

export function toggleFavoriteInmueble(workspaceKey: string, id: string): void {
  const list = getInmueblesForWorkspace(workspaceKey).map((i) =>
    i.id === id ? { ...i, isFavorite: !i.isFavorite, updatedAt: new Date().toISOString() } : i,
  );
  persist(workspaceKey, list);
}

export function toggleShareInmueble(workspaceKey: string, id: string): void {
  const list = getInmueblesForWorkspace(workspaceKey).map((i) =>
    i.id === id ? { ...i, shareWithNetwork: !i.shareWithNetwork, updatedAt: new Date().toISOString() } : i,
  );
  persist(workspaceKey, list);
}

/* ─── Hook reactivo · scopeado al usuario actual ─────────────────── */

/**
 * Devuelve los inmuebles del workspace del usuario actual + helpers
 * para mutar la lista. Re-renderiza cuando cambia el storage del
 * propio workspace o cuando el usuario cambia de cuenta (otro
 * accountType / agencyId → otra clave).
 */
export function useInmuebles() {
  const user = useCurrentUser();
  const workspaceKey = currentWorkspaceKey(user);
  const [list, setList] = useState<Inmueble[]>(() => getInmueblesForWorkspace(workspaceKey));

  useEffect(() => {
    setList(getInmueblesForWorkspace(workspaceKey));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { workspaceKey?: string } | undefined;
      if (!detail?.workspaceKey || detail.workspaceKey === workspaceKey) {
        setList(getInmueblesForWorkspace(workspaceKey));
      }
    };
    window.addEventListener(CHANNEL_EVENT, handler);
    return () => window.removeEventListener(CHANNEL_EVENT, handler);
  }, [workspaceKey]);

  return {
    inmuebles: list,
    workspaceKey,
    create: (draft: Omit<Inmueble, "id" | "organizationId" | "createdAt" | "updatedAt">) =>
      createInmueble(workspaceKey, draft),
    update: (id: string, patch: Partial<Inmueble>) => updateInmueble(workspaceKey, id, patch),
    remove: (id: string) => deleteInmueble(workspaceKey, id),
    toggleFavorite: (id: string) => toggleFavoriteInmueble(workspaceKey, id),
    toggleShare: (id: string) => toggleShareInmueble(workspaceKey, id),
  };
}
