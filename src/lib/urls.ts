/**
 * urls.ts · Constructores canónicos de URLs públicas.
 *
 * Toda URL externa de Byvaro usa la `publicRef` (formato del scheme
 * canónico de CLAUDE.md) en vez del id interno del modelo. Esto:
 *   1. Oculta la estructura del modelo (`dev-2`, `reg-001`...).
 *   2. Estabiliza handles externos · si el id interno cambia, las
 *      URLs siguen funcionando contra la publicRef.
 *   3. Imposibilita enumerar entidades vecinas secuencialmente.
 *
 * Para cada entidad, este módulo expone:
 *   · `<entity>Href(entity)` · construye la URL con la publicRef.
 *   · `resolve<Entity>Param(refOrId, list)` · acepta param de URL
 *     (publicRef canónico o id legacy) y devuelve el entity match.
 *
 * Tenants tienen su propio módulo `developerNavigation.ts` /
 * `agencyNavigation.ts` por motivos históricos · este módulo cubre
 * las demás entidades (promotion, contact, registro, lead, unit).
 */

import type { Promotion } from "@/data/promotions";
import { promotions } from "@/data/promotions";
import type { DevPromotion } from "@/data/developerPromotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import type { Contact } from "@/components/contacts/types";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import type { Registro } from "@/data/records";
import { registros } from "@/data/records";
import type { Lead } from "@/data/leads";
import { leads } from "@/data/leads";

type AnyPromotion = Promotion | DevPromotion;

/* ══════ Promociones ═════════════════════════════════════════════ */

/** URL canónica de una promoción · usa `code` (PR + 5 dígitos) ·
 *  fallback al `id` interno solo si `code` está vacío. */
export function promotionHref(p: { id: string; code?: string }, opts?: { tab?: string }): string {
  const ref = p.code?.trim() || p.id;
  const base = `/promociones/${ref}`;
  return opts?.tab ? `${base}?tab=${opts.tab}` : base;
}

/** Para call sites que solo tienen `promotionId` (referencias en
 *  registros, leads, visitas, etc.) y necesitan construir la URL ·
 *  hace lookup en los seeds para obtener el `code` canónico. Si no
 *  encuentra, devuelve el id tal cual (URL legacy · sigue funcionando
 *  por compat backward del route handler). */
export function promotionHrefById(promotionId: string | undefined, opts?: { tab?: string }): string {
  if (!promotionId) return "/promociones";
  const all: Array<{ id: string; code?: string }> = [...promotions, ...developerOnlyPromotions];
  const p = all.find((x) => x.id === promotionId);
  const ref = p?.code?.trim() || promotionId;
  const base = `/promociones/${ref}`;
  return opts?.tab ? `${base}?tab=${opts.tab}` : base;
}

/** Resuelve el param de la URL `/promociones/:id` a una promoción.
 *  Acepta tanto `code` canónico (`PR12345`) como id interno legacy
 *  (`dev-2`, `1`-`8`). Devuelve la promoción match · undefined si
 *  ninguna coincide. */
export function findPromotionByParam<T extends { id: string; code?: string }>(
  param: string | undefined,
  list: ReadonlyArray<T>,
): T | undefined {
  if (!param) return undefined;
  return list.find((p) => p.code === param) ?? list.find((p) => p.id === param);
}

/* ══════ Contactos ═══════════════════════════════════════════════ */

export function contactHref(c: { id: string; publicRef?: string }, opts?: { tab?: string }): string {
  const ref = c.publicRef?.trim() || c.id;
  const base = `/contactos/${ref}`;
  return opts?.tab ? `${base}?tab=${opts.tab}` : base;
}

/** Para call sites que solo tienen `contactId` (no el objeto Contact
 *  completo). Hace lookup en seeds + storage local · si no encuentra,
 *  devuelve el id tal cual (URL legacy · sigue funcionando por compat
 *  backward del route handler). */
export function contactHrefById(contactId: string | undefined, opts?: { tab?: string }): string {
  if (!contactId) return "/contactos";
  /* Import inline · contactos viven repartidos entre `data.ts`
   *  (mock seed) y `createdContactsStorage` (runtime). Para mantener
   *  el helper sin acoplar a runtime store, solo busco en el seed. */
  const ref = contactRefLookup(contactId) || contactId;
  const base = `/contactos/${ref}`;
  return opts?.tab ? `${base}?tab=${opts.tab}` : base;
}

/** Lookup auxiliar · resuelve internalId → publicRef desde el seed
 *  de contactos. Build una única vez (memoized). */
let _contactRefMap: Map<string, string> | null = null;
function contactRefLookup(internalId: string): string | undefined {
  if (!_contactRefMap) {
    _contactRefMap = new Map();
    for (const c of MOCK_CONTACTS) {
      if (c.publicRef) _contactRefMap.set(c.id, c.publicRef);
    }
  }
  return _contactRefMap.get(internalId);
}

export function findContactByParam<T extends { id: string; publicRef?: string }>(
  param: string | undefined,
  list: ReadonlyArray<T>,
): T | undefined {
  if (!param) return undefined;
  return list.find((c) => c.publicRef === param) ?? list.find((c) => c.id === param);
}

/* ══════ Registros / Oportunidades / Leads ══════════════════════════ */

/** Registro y Lead comparten el mismo scheme (RG + 9 dígitos · son la
 *  misma entidad en fases distintas del funnel). */
export function registroHref(r: { id: string; publicRef?: string }): string {
  const ref = r.publicRef?.trim() || r.id;
  return `/registros/${ref}`;
}

export function leadHref(l: { id: string; publicRef?: string }): string {
  const ref = l.publicRef?.trim() || l.id;
  return `/oportunidades/${ref}`;
}

/** Para call sites que solo tienen `leadId`. Lookup en seed de leads
 *  → publicRef. Si no encuentra, devuelve id (legacy compat). */
let _leadRefMap: Map<string, string> | null = null;
export function leadHrefById(leadId: string | undefined): string {
  if (!leadId) return "/oportunidades";
  if (!_leadRefMap) {
    _leadRefMap = new Map();
    for (const l of leads) {
      if (l.publicRef) _leadRefMap.set(l.id, l.publicRef);
    }
  }
  const ref = _leadRefMap.get(leadId) || leadId;
  return `/oportunidades/${ref}`;
}

/** Para call sites que solo tienen `registroId`. */
let _registroRefMap: Map<string, string> | null = null;
export function registroHrefById(registroId: string | undefined): string {
  if (!registroId) return "/registros";
  if (!_registroRefMap) {
    _registroRefMap = new Map();
    for (const r of registros) {
      if (r.publicRef) _registroRefMap.set(r.id, r.publicRef);
    }
  }
  const ref = _registroRefMap.get(registroId) || registroId;
  return `/registros/${ref}`;
}

export function findRegistroByParam<T extends { id: string; publicRef?: string }>(
  param: string | undefined,
  list: ReadonlyArray<T>,
): T | undefined {
  if (!param) return undefined;
  return list.find((r) => r.publicRef === param) ?? list.find((r) => r.id === param);
}

export function findLeadByParam<T extends { id: string; publicRef?: string }>(
  param: string | undefined,
  list: ReadonlyArray<T>,
): T | undefined {
  if (!param) return undefined;
  return list.find((l) => l.publicRef === param) ?? list.find((l) => l.id === param);
}

/* Re-export type union útil para call-sites genéricos. */
export type { AnyPromotion };
