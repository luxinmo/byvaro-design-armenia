/**
 * tenantRefResolver.ts · Capa de traducción id interno ↔ public_ref.
 *
 * QUÉ
 * ----
 * Las URLs externas de Byvaro usan el `IDXXXXXX` público (`Empresa.publicRef`)
 * en vez del id interno del workspace (`developer-default`, `ag-2`,
 * `prom-1`). Esto:
 *
 *   1. Oculta la estructura del modelo (que existían prefijos `ag-`/`prom-`).
 *   2. Imposibilita enumerar tenants vecinos.
 *   3. Estabiliza handles externos · si el id interno cambia (UUID,
 *      refactor de schema), las URLs siguen funcionando.
 *
 * Este módulo expone:
 *   · `resolveTenantId(refOrId)`  → devuelve siempre el id INTERNO.
 *     Backward-compat · acepta tanto `ag-2` (legacy) como `IDHE7TBV`.
 *   · `getPublicRef(internalId)`  → devuelve el `IDXXXXXX` para un id
 *     interno · null si no está hidratado/seedado todavía.
 *
 * FUENTES DE VERDAD (en orden de prioridad)
 * -----------------------------------------
 *   1. `byvaro-empresa:<orgId>` cache (hidratada desde Supabase al login).
 *   2. Seed de `agencies.ts` / `promotores.ts` (campo `publicRef` opcional).
 *
 * Si la ref no está en ninguna fuente, `resolveTenantId` la devuelve
 * tal cual · en peor caso la página renderiza con el id que tenga
 * (que puede ser un IDXXXXXX que aún no resolvemos), y el visitor verá
 * la ficha vacía · es un fallback seguro · no rompe la app.
 *
 * TODO(backend) cuando aterrice multi-tenant real · sustituir el
 * lookup local por una RPC `find_org_by_ref(p_ref)` que ya existe
 * (SECURITY DEFINER, devuelve campos públicos). El frontend mantiene
 * la signature.
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
  /* Fallback Luxinmo · ver `getPublicRef` arriba. */
  inv.set("ID9P4HGF", "developer-default");
  return inv;
}

/** Resuelve un parámetro de URL al id interno del workspace.
 *
 *  - Si es un IDXXXXXX válido → busca el id interno en cache + seeds.
 *    Si no lo encuentra, devuelve el ref tal cual (la página
 *    renderizará con un id desconocido · safe fallback).
 *  - Si no es ref válido → devuelve tal cual (legacy ids `ag-X`,
 *    `prom-X`, `developer-default` siguen funcionando para enlaces
 *    antiguos compartidos por email).
 */
export function resolveTenantId(refOrId: string): string {
  if (!isValidTenantRef(refOrId)) return refOrId;
  return buildRefToIdMap().get(refOrId) ?? refOrId;
}

/** Devuelve el `IDXXXXXX` público de un id interno · null si no está
 *  disponible. Usado por los helpers de navegación para construir
 *  URLs canónicas. */
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
