/**
 * salesStorage.ts · helper canónico para mutaciones de ventas.
 *
 * Las ventas seed estáticas siguen viviendo en `src/data/sales.ts`.
 * Las ventas NUEVAS o MUTADAS persisten aquí + Supabase write-through.
 *
 * REGLA · ver `docs/backend-development-rules.md §5` y
 * `docs/contract-index.md §4.3`.
 *
 * Pattern híbrido · `getAllSales()` mergea seed + cache local
 * sobreescribiendo por id (lo del cache gana). Componentes leen de
 * aquí · cero acceso a `data/sales.ts` directo desde UI mutante.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { sales as SEED_SALES, type Venta } from "@/data/sales";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";

/** Resuelve el `ownerOrganizationId` de la venta desde su promoción.
 *  Antes el sync usaba hardcode "developer-default" · ahora deriva
 *  el workspace del promotor real para que las ventas multi-developer
 *  se persistan al workspace correcto en Supabase. */
function resolveSaleOwnerOrgId(s: Venta): string {
  const all = [...promotions, ...developerOnlyPromotions];
  const p = all.find((x) => x.id === s.promotionId);
  return p?.ownerOrganizationId ?? "developer-default";
}

const KEY_OVERRIDES = "byvaro.sales.overrides.v1";
const KEY_CREATED   = "byvaro.sales.created.v1";
const KEY_DELETED   = "byvaro.sales.deleted.v1";
const EVENT = "byvaro:sales-change";

/* ─── Lectura ─── */

function loadOverrides(): Record<string, Venta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = memCache.getItem(KEY_OVERRIDES);
    return raw ? (JSON.parse(raw) as Record<string, Venta>) : {};
  } catch { return {}; }
}

function loadCreated(): Venta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(KEY_CREATED);
    return raw ? (JSON.parse(raw) as Venta[]) : [];
  } catch { return []; }
}

function loadDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = memCache.getItem(KEY_DELETED);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

/** Universo completo · seed + creadas - eliminadas, con overrides. */
export function getAllSales(): Venta[] {
  const overrides = loadOverrides();
  const created = loadCreated();
  const deleted = loadDeletedIds();
  const out: Venta[] = [];
  const seen = new Set<string>();
  for (const s of SEED_SALES) {
    if (deleted.has(s.id)) continue;
    out.push(overrides[s.id] ?? s);
    seen.add(s.id);
  }
  for (const c of created) {
    if (!seen.has(c.id) && !deleted.has(c.id)) out.push(c);
  }
  return out;
}

/* ─── Escritura ─── */

function saveOverrides(map: Record<string, Venta>) {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY_OVERRIDES, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function saveCreated(list: Venta[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY_CREATED, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function saveDeleted(set: Set<string>) {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY_DELETED, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/* ─── Supabase write-through ─── */

async function syncSaleToSupabase(s: Venta, ownerOrgId: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("sales").upsert({
      id: s.id,
      organization_id: ownerOrgId,
      agency_organization_id: s.agencyId ?? null,
      promotion_id: s.promotionId,
      registro_id: s.registroId ?? null,
      unit_id: s.unitId || null,
      unit_label: s.unitLabel || null,
      cliente_nombre: s.clienteNombre,
      cliente_email: s.clienteEmail ?? null,
      cliente_telefono: s.clienteTelefono ?? null,
      cliente_nacionalidad: s.clienteNacionalidad ?? null,
      agent_name: s.agentName ?? null,
      estado: s.estado,
      fecha_reserva: s.fechaReserva || null,
      fecha_contrato: s.fechaContrato || null,
      fecha_escritura: s.fechaEscritura || null,
      fecha_caida: s.fechaCaida || null,
      precio_reserva: s.precioReserva ?? null,
      precio_final: s.precioFinal ?? null,
      precio_listado: s.precioListado ?? null,
      descuento_aplicado: s.descuentoAplicado ?? null,
      comision_pct: s.comisionPct ?? null,
      comision_pagada: s.comisionPagada ?? false,
      metodo_pago: s.metodoPago,
      siguiente_paso: s.siguientePaso ?? null,
      siguiente_paso_fecha: s.siguientePasoFecha ?? null,
      nota: s.nota ?? null,
    });
    if (error) console.warn("[sales:sync]", error.message);

    /* Sale payments · borrar y reinsertar (simple Phase 2). */
    if (s.pagos && s.pagos.length > 0) {
      await supabase.from("sale_payments").delete().eq("sale_id", s.id);
      const rows = s.pagos.map((p) => ({
        sale_id: s.id, fecha: p.fecha, concepto: p.concepto, importe: p.importe,
      }));
      const { error: pErr } = await supabase.from("sale_payments").insert(rows);
      if (pErr) console.warn("[sale_payments:sync]", pErr.message);
    }
  } catch (e) { console.warn("[sales:sync] skipped:", e); }
}

async function deleteSaleFromSupabase(id: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    await supabase.from("sale_payments").delete().eq("sale_id", id);
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) console.warn("[sales:delete]", error.message);
  } catch (e) { console.warn("[sales:delete] skipped:", e); }
}

/* ─── API pública · mutaciones ─── */

export function createSale(s: Venta): void {
  saveCreated([s, ...loadCreated()]);
  void syncSaleToSupabase(s, resolveSaleOwnerOrgId(s));
}

export function updateSale(id: string, patch: Partial<Venta>): void {
  const all = getAllSales();
  const existing = all.find((x) => x.id === id);
  if (!existing) return;
  const updated = { ...existing, ...patch };

  /* Si la fila es de seed (mismo id en SEED_SALES), guarda override.
   *  Si no es de seed, edita la "created" list. */
  const isSeed = SEED_SALES.some((s) => s.id === id);
  if (isSeed) {
    const overrides = loadOverrides();
    overrides[id] = updated;
    saveOverrides(overrides);
  } else {
    const created = loadCreated();
    saveCreated(created.map((c) => c.id === id ? updated : c));
  }
  void syncSaleToSupabase(updated, resolveSaleOwnerOrgId(updated));
}

export function deleteSale(id: string): void {
  /* Si es seed, marca como deleted. Si no, quita de created. */
  const isSeed = SEED_SALES.some((s) => s.id === id);
  if (isSeed) {
    const deleted = loadDeletedIds();
    deleted.add(id);
    saveDeleted(deleted);
  } else {
    saveCreated(loadCreated().filter((c) => c.id !== id));
  }
  void deleteSaleFromSupabase(id);
}

/* ─── Hook reactivo ─── */

export function useAllSales(): Venta[] {
  const [list, setList] = useState<Venta[]>(() => getAllSales());
  useEffect(() => {
    const refresh = () => setList(getAllSales());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}
