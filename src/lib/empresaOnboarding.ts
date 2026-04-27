/**
 * empresaOnboarding.ts · Estado del onboarding de la empresa.
 *
 * El admin del workspace (developer · "Luxinmo" · o futura agencia
 * con su workspace propio) DEBE rellenar los datos básicos de su
 * empresa antes de poder operar el día a día. Sin esto:
 *   · La ficha de promoción muestra "Tu empresa" / placeholder.
 *   · Los emails (invitaciones a agencia, brochure, etc.) salen
 *     con marca vacía.
 *   · El brochure / listado de precios no se puede generar con
 *     datos legales correctos.
 *
 * Esta utility · gemela de `agencyOnboarding.ts` · decide si hay
 * setup pendiente y permite aplazarlo · el modal vuelve a salir en
 * acciones críticas (Empresa, Equipo, Ajustes, billing).
 *
 * Aplica SOLO al developer admin · las agencias seed están
 * pre-rellenadas y las nuevas vía signup tienen su propio onboarding
 * (Responsible setup) que cubre datos básicos.
 *
 * TODO(backend): mover a `organizations` row con flag
 * `onboarding_completed_at`. Endpoint mutante crítico debe rechazar
 * 409 `onboarding_incomplete` si falta.
 */

import { loadEmpresa } from "./empresa";
import type { CurrentUser } from "./currentUser";

const STORAGE_KEY = "byvaro.empresa.onboarding.v1";

interface EmpresaOnboardingState {
  /** ISO timestamp · si el user pulsó "Lo haré más tarde". */
  deferredAt?: string;
}

function read(): EmpresaOnboardingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as EmpresaOnboardingState;
  } catch {
    return {};
  }
}

function write(s: EmpresaOnboardingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("byvaro:empresa-onboarding-changed"));
}

/** ¿Faltan datos mínimos de la empresa? · Solo aplica a developer
 *  admin (las agencias ya tienen su flujo). Mínimos exigidos:
 *  nombre comercial, razón social y CIF. */
export function needsEmpresaSetup(user: CurrentUser | null | undefined): boolean {
  if (!user) return false;
  if (user.accountType !== "developer") return false;
  if (user.role !== "admin") return false;
  if (typeof window === "undefined") return false;
  const e = loadEmpresa();
  return !e.nombreComercial?.trim()
    || !e.razonSocial?.trim()
    || !e.cif?.trim();
}

/** ¿Auto-abrir el modal al cargar la app? · true si pendiente Y no
 *  aplazado. Si fue aplazado, el banner persistente recuerda. */
export function shouldAutoOpenEmpresaSetup(
  user: CurrentUser | null | undefined,
): boolean {
  if (!needsEmpresaSetup(user)) return false;
  const s = read();
  return !s.deferredAt;
}

/** Aplaza el setup · "Lo haré más tarde". */
export function deferEmpresaSetup(): void {
  write({ deferredAt: new Date().toISOString() });
}

/** Limpia el flag · cuando ya no hace falta (datos rellenos). */
export function clearEmpresaOnboardingDefer(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("byvaro:empresa-onboarding-changed"));
}

/** Suscríbete a cambios. */
export function onEmpresaOnboardingChanged(handler: () => void): () => void {
  const wrapped = () => handler();
  window.addEventListener("byvaro:empresa-onboarding-changed", wrapped);
  window.addEventListener("byvaro:empresa-changed", wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener("byvaro:empresa-onboarding-changed", wrapped);
    window.removeEventListener("byvaro:empresa-changed", wrapped);
    window.removeEventListener("storage", wrapped);
  };
}
