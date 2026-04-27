/**
 * promotionRole.ts · Resolución dinámica del rol del owner de una promoción.
 *
 * REGLA DE ORO (CLAUDE.md). Cada promoción se crea como `promotor` o
 * `comercializador`. La UI NUNCA debe asumir "promotor" hardcoded · debe
 * leer este campo y resolver la copy correcta.
 *
 *   getOwnerRoleLabel(promo)        → "Promotor" | "Comercializador"
 *   getOwnerRoleLabelLower(promo)   → "promotor" | "comercializador"
 *   getOwnerRoleArticleLower(promo) → "el promotor" | "el comercializador"
 *   getOwnerRoleDecisionPhrase(promo, "Decisión del") → "Decisión del promotor"|"Decisión del comercializador"
 *
 * Para sitios donde NO hay promoción en contexto (ej. sidebar global,
 * label de cuenta), usa `getOwnerRoleLabelFromString(role)` con el
 * `WizardState.role` o equivalente.
 *
 * Default · si la promoción no trae `ownerRole` (seeds antiguos), se
 * asume "promotor" para retrocompatibilidad. NUNCA falla.
 */

import type { RoleOption } from "@/components/crear-promocion/types";
import type { Promotion } from "@/data/promotions";
import { loadEmpresa } from "./empresa";

/** Rol con default · si la promo no lo trae, "promotor". */
export function resolveOwnerRole(
  promo: Pick<Promotion, "ownerRole"> | null | undefined,
): RoleOption {
  return promo?.ownerRole ?? "promotor";
}

/** "Promotor" | "Comercializador". Cabecera, badges, títulos. */
export function getOwnerRoleLabel(
  promo: Pick<Promotion, "ownerRole"> | null | undefined,
): "Promotor" | "Comercializador" {
  return resolveOwnerRole(promo) === "comercializador" ? "Comercializador" : "Promotor";
}

/** "promotor" | "comercializador". Body copy en minúscula. */
export function getOwnerRoleLabelLower(
  promo: Pick<Promotion, "ownerRole"> | null | undefined,
): "promotor" | "comercializador" {
  return resolveOwnerRole(promo) === "comercializador" ? "comercializador" : "promotor";
}

/** "el promotor" | "el comercializador". Frases en body. */
export function getOwnerRoleArticleLower(
  promo: Pick<Promotion, "ownerRole"> | null | undefined,
): "el promotor" | "el comercializador" {
  return resolveOwnerRole(promo) === "comercializador" ? "el comercializador" : "el promotor";
}

/** "del promotor" | "del comercializador". Para concatenar tras un sustantivo
 *  ("Decisión del promotor", "Aprobado por el promotor"). */
export function getOwnerRoleGenitive(
  promo: Pick<Promotion, "ownerRole"> | null | undefined,
): "del promotor" | "del comercializador" {
  return resolveOwnerRole(promo) === "comercializador" ? "del comercializador" : "del promotor";
}

/** Variante para sitios sin promoción en contexto (label estático del rol
 *  de la cuenta). Pasa el string del rol (puede venir del WizardState
 *  o de un getter futuro a nivel workspace). */
export function getOwnerRoleLabelFromString(
  role: RoleOption | null | undefined,
): "Promotor" | "Comercializador" {
  return role === "comercializador" ? "Comercializador" : "Promotor";
}

/** Nombre comercial del promotor / comercializador propietario de la
 *  promoción. Resuelve dinámicamente desde `byvaro-empresa`
 *  (`useEmpresa().nombreComercial`) · si el admin cambia el nombre en
 *  /ajustes/empresa/datos, todas las superficies (cards, hero,
 *  registros, lista de la agencia colaboradora) lo reflejan sin
 *  redeploy.
 *
 *  Si no hay nombre guardado, devuelve el `developer` que traiga la
 *  promoción (legacy seeds). NUNCA cae al label genérico
 *  "Promotor" / "Comercializador" como nombre comercial — esa copy es
 *  el rol, no el nombre, y mostrarla como nombre engaña al usuario.
 *  Si ambos están vacíos, devuelve "" y el caller decide si oculta la
 *  línea o muestra placeholder.
 *
 *  Single-tenant mock · `byvaro-empresa` siempre contiene los datos
 *  del developer. Backend producción · cambiar a `GET
 *  /api/promociones/:id` que devuelve `ownerOrganization.commercialName`. */
export function getPromoterDisplayName(
  promo: Pick<Promotion, "developer" | "ownerRole"> | null | undefined,
): string {
  if (typeof window !== "undefined") {
    try {
      const stored = loadEmpresa();
      const comercial = stored?.nombreComercial?.trim();
      if (comercial) return comercial;
      const razon = stored?.razonSocial?.trim();
      if (razon) return razon;
    } catch { /* noop */ }
  }
  return promo?.developer?.trim() ?? "";
}
