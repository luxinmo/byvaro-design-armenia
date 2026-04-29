/**
 * empresaCategories.ts · categorías de empresa derivadas (Byvaro).
 *
 * REGLA DE ORO BYVARO (consensuada con producto · 2026-04-29):
 *   1. El sistema tiene 3 categorías canónicas:
 *      - "inmobiliaria"     → workspace de tipo agencia.
 *      - "promotor"         → tiene ≥1 promoción activa con ownerRole=promotor.
 *      - "comercializador"  → tiene ≥1 promoción activa con ownerRole=comercializador.
 *
 *   2. Una agencia puede activar el "pack de promotor/comercializador"
 *      que le da CAPACIDAD de crear promociones (con cualquiera de los
 *      dos roles · se decide en el wizard al crear cada una). El pack
 *      por sí solo NO añade categoría · solo da la habilidad. La
 *      categoría aparece cuando hay una promoción activa con ese rol.
 *
 *   3. Un workspace puede tener N categorías a la vez. Ej. una agencia
 *      con pack activado y dos promociones (una con role=promotor,
 *      otra con role=comercializador) tiene las 3 categorías:
 *      [Inmobiliaria, Promotor, Comercializador].
 *
 *   4. Las categorías se MUESTRAN en la ficha y la card de cualquier
 *      empresa para que el observador sepa qué hace cada una.
 *
 * Backend equivalent · `GET /api/empresas/:id/categorias` devolverá el
 * mismo array. Hoy (mock single-tenant) lo derivamos en cliente desde
 * los seeds globales + el flag de pack en localStorage.
 *
 * TODO(backend): ver `docs/backend-integration.md §4.2.3` para el
 * contrato completo y la migración.
 */

import { useEffect, useState } from "react";
import type { AccountType } from "./accountType";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { resolveOwnerRole } from "./promotionRole";

export type EmpresaCategory = "inmobiliaria" | "promotor" | "comercializador";

/** Orden canónico de las categorías para renderizar. */
export const EMPRESA_CATEGORY_ORDER: EmpresaCategory[] = [
  "inmobiliaria",
  "promotor",
  "comercializador",
];

export const EMPRESA_CATEGORY_LABELS: Record<EmpresaCategory, string> = {
  inmobiliaria: "Inmobiliaria",
  promotor: "Promotor",
  comercializador: "Comercializador",
};

/* ═══════════════════════════════════════════════════════════════════
   Pack de promotor / comercializador · activación per-workspace

   Storage `localStorage.byvaro.workspace.developerPack.v1:${workspaceKey}`
   con shape `{ enabled: boolean, activatedAt?: number }`. Al activar,
   la agencia gana acceso a `/promociones` y al wizard de creación.
   La categoría no se añade aquí · se añade automáticamente cuando crea
   una promoción activa con `ownerRole`.

   TODO(backend): tabla `workspace_features` con flag por workspace.
   ═══════════════════════════════════════════════════════════════════ */
const PACK_EVENT = "byvaro:developer-pack-changed";
function packStorageKey(workspaceKey: string): string {
  return `byvaro.workspace.developerPack.v1:${workspaceKey}`;
}

interface PackState {
  enabled: boolean;
  activatedAt?: number;
}

export function loadDeveloperPack(workspaceKey: string): PackState {
  if (typeof window === "undefined") return { enabled: false };
  try {
    const raw = window.localStorage.getItem(packStorageKey(workspaceKey));
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    return { enabled: !!parsed?.enabled, activatedAt: parsed?.activatedAt };
  } catch {
    return { enabled: false };
  }
}

export function setDeveloperPackEnabled(workspaceKey: string, enabled: boolean): void {
  const next: PackState = enabled
    ? { enabled: true, activatedAt: Date.now() }
    : { enabled: false };
  window.localStorage.setItem(packStorageKey(workspaceKey), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PACK_EVENT, { detail: { workspaceKey } }));
}

export function useDeveloperPack(workspaceKey: string): PackState {
  const [state, setState] = useState<PackState>(() => loadDeveloperPack(workspaceKey));
  useEffect(() => {
    const refresh = () => setState(loadDeveloperPack(workspaceKey));
    refresh();
    window.addEventListener(PACK_EVENT, refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PACK_EVENT, refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceKey]);
  return state;
}

/* ═══════════════════════════════════════════════════════════════════
   Derivación de categorías

   Reglas:
   - accountType="agency"    → siempre "inmobiliaria".
   - accountType="developer" → derivado de promociones activas (mock
     tiene todo en `[...promotions, ...developerOnlyPromotions]`).
   - accountType="agency" con pack activado · puede ganar Promotor /
     Comercializador si crea sus propias promos. En el mock no hay
     storage de promos por agencia · queda como TODO(backend).

   Si necesitas un override (ej. tests o vistas mirror), usa
   `deriveCategoriesFromOwnerRoles(roles)` directamente.
   ═══════════════════════════════════════════════════════════════════ */

export function getActiveOwnerRolesForDeveloper(): Array<"promotor" | "comercializador"> {
  const all = [...promotions, ...developerOnlyPromotions];
  const set = new Set<"promotor" | "comercializador">();
  for (const p of all) {
    if (p.status !== "active") continue;
    set.add(resolveOwnerRole(p));
  }
  return Array.from(set);
}

export function deriveCategoriesFromOwnerRoles(
  ownerRoles: Array<"promotor" | "comercializador">,
  accountType: AccountType,
): EmpresaCategory[] {
  const set = new Set<EmpresaCategory>();
  if (accountType === "agency") set.add("inmobiliaria");
  if (ownerRoles.includes("promotor")) set.add("promotor");
  if (ownerRoles.includes("comercializador")) set.add("comercializador");
  return EMPRESA_CATEGORY_ORDER.filter((c) => set.has(c));
}

interface GetCategoriesArgs {
  accountType: AccountType;
  /** Solo necesario cuando se quiere considerar promos del propio
   *  workspace agencia con pack activo. En el mock single-tenant no
   *  hay storage de promos por agencia · este branch queda dormido. */
  workspaceKey?: string;
}

export function getEmpresaCategories({
  accountType,
}: GetCategoriesArgs): EmpresaCategory[] {
  if (accountType === "developer") {
    return deriveCategoriesFromOwnerRoles(getActiveOwnerRolesForDeveloper(), "developer");
  }
  /* Agencia · siempre Inmobiliaria. Las agencias con pack que crean
   *  sus propias promos sumarían Promotor/Comercializador, pero en el
   *  mock single-tenant las promociones son del developer · TODO al
   *  backend para iterar `agency.workspace_id` cuando exista. */
  return ["inmobiliaria"];
}

/** Hook reactivo · re-renderiza si cambia el pack o el dataset de
 *  promociones (este último no cambia en mock estático, pero el evento
 *  `byvaro:empresa-changed` puede usarse en el futuro). */
export function useEmpresaCategories(args: GetCategoriesArgs): EmpresaCategory[] {
  const [cats, setCats] = useState<EmpresaCategory[]>(() => getEmpresaCategories(args));
  useEffect(() => {
    const refresh = () => setCats(getEmpresaCategories(args));
    refresh();
    window.addEventListener(PACK_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener(PACK_EVENT, refresh as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.accountType, args.workspaceKey]);
  return cats;
}
