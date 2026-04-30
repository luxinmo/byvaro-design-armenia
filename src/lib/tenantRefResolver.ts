/**
 * tenantRefResolver.ts · Capa de traducción public_ref → id interno.
 *
 * QUÉ
 * ----
 * Las URLs públicas de Byvaro usan EXCLUSIVAMENTE el formato
 * `IDXXXXXX` (`Empresa.publicRef`). Los ids internos del modelo
 * (`developer-default`, `ag-2`, `prom-1`) NUNCA aparecen en una URL.
 *
 *   · Oculta la estructura del modelo (prefijos `ag-`/`prom-`).
 *   · Imposibilita enumerar tenants vecinos.
 *   · Estabiliza handles externos · si el id interno cambia, las URLs
 *     siguen funcionando porque viven contra `IDXXXXXX`.
 *
 * Este módulo expone:
 *   · `resolveTenantId(ref)`     → id interno o `undefined` si la ref
 *                                  no es un IDXXXXXX válido o no existe.
 *                                  El page handler debe mostrar 404.
 *   · `getPublicRef(internalId)` → `IDXXXXXX` para un id interno ·
 *                                  `undefined` si no está hidratado.
 *
 * SIN BACKWARD-COMPAT (decisión 2026-04-30) · las URLs antiguas
 * `/promotor/developer-default/...`, `/colaboradores/ag-2/...` ya NO
 * funcionan. La razón: confunden visualmente el modelo interno con la
 * URL pública y dejaban un alias permanente que nadie usaba ya.
 *
 * FUENTES DE VERDAD (en orden de prioridad)
 * -----------------------------------------
 *   1. `byvaro-empresa:<orgId>` cache (hidratada desde Supabase al login).
 *   2. Seed de `agencies.ts` / `promotores.ts` (campo `publicRef`).
 *   3. Hardcode estático de Luxinmo (`developer-default` → `ID9P4HGF`)
 *      mientras la cache no se ha hidratado todavía.
 *
 * TODO(backend) cuando aterrice multi-tenant real · sustituir el
 * lookup local por la RPC pública `find_org_by_ref(p_ref)` que ya
 * existe (SECURITY DEFINER · devuelve campos públicos). La signature
 * de los helpers se mantiene.
 */

import { isValidTenantRef } from "./tenantRef";
import { agencies } from "@/data/agencies";
import { promotores } from "@/data/promotores";

const EMPRESA_KEY_PREFIX = "byvaro-empresa:";

/** Lee todas las claves `byvaro-empresa:<orgId>` y construye un map
 *  `internalId → publicRef`. Se llama bajo demanda (no se cachea ·
 *  localStorage es síncrono y rápido). */
function buildIdToRefMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (typeof window === "undefined") return map;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k?.startsWith(EMPRESA_KEY_PREFIX)) continue;
    const orgId = k.slice(EMPRESA_KEY_PREFIX.length);
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const e = JSON.parse(raw) as { publicRef?: string };
      if (e?.publicRef) map.set(orgId, e.publicRef);
    } catch { /* skip */ }
  }
  return map;
}

function buildRefToIdMap(): Map<string, string> {
  const inv = new Map<string, string>();
  const direct = buildIdToRefMap();
  for (const [id, ref] of direct.entries()) inv.set(ref, id);
  /* Seeds estáticos · si la cache aún no está hidratada (login fresco
   *  sin sesión real), seguimos resolviendo por seed. */
  for (const a of agencies) {
    if (a.publicRef) inv.set(a.publicRef, a.id);
  }
  for (const p of promotores) {
    if (p.publicRef) inv.set(p.publicRef, p.id);
  }
  /* Fallback Luxinmo · ver `getPublicRef` abajo. */
  inv.set("ID9P4HGF", "developer-default");
  return inv;
}

/** Resuelve un parámetro de URL (que DEBE ser un `IDXXXXXX`) al id
 *  interno del workspace para uso técnico (queries, lookups, RLS).
 *
 *  Devuelve `undefined` si:
 *    · El input no es un IDXXXXXX válido (formato incorrecto).
 *    · El IDXXXXXX no existe en la cache + seeds (tenant desconocido).
 *
 *  En ambos casos el page handler debe responder con 404 / "no
 *  encontrado". NO hay fallback al id interno legacy. */
export function resolveTenantId(ref: string): string | undefined {
  if (!isValidTenantRef(ref)) return undefined;
  return buildRefToIdMap().get(ref);
}

/** Devuelve el `IDXXXXXX` público de un id interno · `undefined` si
 *  no está disponible. Usado por los helpers de navegación para
 *  construir URLs canónicas (`agencyHref`, `developerHref`, links). */
export function getPublicRef(internalId: string): string | undefined {
  const fromCache = buildIdToRefMap().get(internalId);
  if (fromCache) return fromCache;
  /* Fallback estático para Luxinmo si la cache aún no tiene
   *  `developer-default` (login fresco antes de hidratar). El valor
   *  refleja el `public_ref` real generado por backfill de la
   *  migración 20260430120000_tenant_public_ref.sql · debe coincidir
   *  con `LUXINMO_PROFILE.publicRef` en empresa.ts. */
  if (internalId === "developer-default") return "ID9P4HGF";
  const a = agencies.find((x) => x.id === internalId);
  if (a?.publicRef) return a.publicRef;
  const p = promotores.find((x) => x.id === internalId);
  if (p?.publicRef) return p.publicRef;
  return undefined;
}
