/**
 * registrosStorage.ts · Registros creados por el usuario (mock en localStorage).
 *
 * QUÉ
 * ----
 * Los registros "base" viven en `src/data/records.ts` (seed). Cuando el
 * usuario dispara "Registrar cliente" desde la ficha de una promoción,
 * construimos un `Registro` y lo guardamos aquí para que luego se vea
 * listado en `/registros` junto con los mocks de origen.
 *
 * CÓMO
 * ----
 * Clave en localStorage: `byvaro.registros.created.v1`. El hook
 * `useCreatedRegistros()` se suscribe a un evento custom y al evento
 * `storage` para reaccionar a cambios en vivo o desde otra pestaña.
 *
 * TODO(backend): sustituir por POST /api/promociones/:id/registros y
 * un GET que devuelva los que pertenecen al usuario según RLS.
 */

import { useEffect, useState } from "react";
import { registros as SEED_REGISTROS, type Registro } from "@/data/records";
import { generatePublicRef } from "@/lib/publicRef";
import { findBestMatch } from "@/lib/matchScore";

const STORAGE_KEY = "byvaro.registros.created.v1";
const CHANGE_EVENT = "byvaro:registros-change";

function read(): Registro[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Registro[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Registro[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Persiste UN registro a Supabase · async write-through. Llamar tras
 *  cualquier mutación que añada/edite. RLS valida que el caller es
 *  member del workspace dueño O del workspace agencia. */
async function syncRegistroToSupabase(r: Registro, ownerOrgId: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("registros").upsert({
      id: r.id,
      organization_id: ownerOrgId,
      agency_organization_id: r.agencyId ?? null,
      promotion_id: r.promotionId,
      origen: r.origen,
      tipo: (r as { tipo?: string }).tipo ?? "registration",
      estado: r.estado,
      cliente_nombre: r.cliente.nombre,
      cliente_email: r.cliente.email ?? null,
      cliente_telefono: r.cliente.telefono ?? null,
      cliente_nacionalidad: r.cliente.nacionalidad ?? null,
      cliente_nationality_iso: r.cliente.nationalityIso ?? null,
      cliente_dni: r.cliente.dni ?? null,
      match_percentage: r.matchPercentage ?? 0,
      match_with: r.matchWith ?? null,
      match_cliente: r.matchCliente ?? null,
      recommendation: r.recommendation ?? null,
      visit_date: (r as { visitDate?: string }).visitDate ?? null,
      visit_time: (r as { visitTime?: string }).visitTime ?? null,
      visit_outcome: (r as { visitOutcome?: string }).visitOutcome ?? null,
      origin_registro_id: (r as { originRegistroId?: string }).originRegistroId ?? null,
      decided_at: r.decidedAt ?? null,
      decided_by_name: r.decidedBy ?? null,
      decided_by_role: r.decidedByRole ?? null,
      notas: r.notas ?? null,
      consent: r.consent ?? false,
      response_time: r.responseTime ?? null,
      public_ref: r.publicRef ?? null,
      fecha: r.fecha,
    });
    if (error) console.warn("[registros:sync] upsert failed:", error.message);
  } catch (e) { console.warn("[registros:sync] skipped:", e); }
}

/** Actualiza el estado/decision de un registro existente · usado por
 *  los flows de aprobar/rechazar. Persiste en localStorage + Supabase. */
export function updateRegistroState(id: string, patch: Partial<Registro>) {
  const list = read();
  const idx = list.findIndex((r) => r.id === id);
  let updated: Registro | undefined;
  if (idx >= 0) {
    updated = { ...list[idx], ...patch };
    const next = [...list];
    next[idx] = updated;
    write(next);
  } else {
    /* Si no está en created, puede ser un seed · creamos override
     *  local para que `useAllRegistros()` que mergea seed+created
     *  refleje el cambio. Persistencia Supabase aún así. */
    const seed = SEED_REGISTROS.find((r) => r.id === id);
    if (seed) {
      updated = { ...seed, ...patch };
      write([updated, ...list]);
    }
  }
  if (updated) {
    /* TODO(backend): organization_id viene del registro original · en
     * mock single-tenant es siempre developer-default. Cuando Phase 3
     * llegue, leemos el campo del registro existente. */
    void syncRegistroToSupabase(updated, "developer-default");
  }
}

/* ══════ Helpers de normalización · "first-come silent" ══════════ */

function normEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Busca un registro EN CURSO existente con el mismo cliente (email o
 *  teléfono normalizados) en la MISMA promoción · bloquea creaciones
 *  posteriores como `duplicado` (regla first-come silent).
 *
 *  Phase 1 Core · estados que bloquean:
 *    · `pendiente` · esperando decisión del promotor.
 *    · `preregistro_activo` · aprobado pero esperando visita ·
 *      la visita programada protege el cliente.
 *  No bloquean: aprobado (es atribución final, gestionado por
 *  cross-promo warning); rechazado/duplicado (ya invalidados).
 *
 *  IMPORTANTE: la regla "first-come silent" aplica SOLO dentro de
 *  la misma promoción. Un mismo cliente puede tener registros en
 *  promociones distintas (potencial cliente cross-sell) · no es
 *  conflicto de comisión y no se silencia. El conflicto cross-promo
 *  cuando el cliente YA ESTÁ APROBADO en otra promo se gestiona en
 *  `CrossPromotionWarning` con un banner al promotor. */
function findPendingDuplicate(input: Registro): Registro | undefined {
  const email = normEmail(input.cliente.email);
  const phone = normPhone(input.cliente.telefono);
  if (!email && !phone) return undefined;
  const all = [...read(), ...SEED_REGISTROS];
  return all.find((r) => {
    if (r.estado !== "pendiente" && r.estado !== "preregistro_activo") return false;
    if (r.promotionId !== input.promotionId) return false; // distinta promo · no es conflicto
    if (r.id === input.id) return false; // evita match consigo mismo
    if (email && normEmail(r.cliente.email) === email) return true;
    if (phone && normPhone(r.cliente.telefono) === phone) return true;
    return false;
  });
}

/**
 * Añade un registro a la cola.
 *
 * Regla "first-come silent" (CLAUDE.md futuro · ver `docs/screens/registros.md`):
 *   · Si ya hay otro registro PENDIENTE con el mismo cliente (email o
 *     teléfono normalizados), el nuevo entra automáticamente como
 *     `estado: "duplicado"` con `matchWith` apuntando al ganador.
 *   · NO se notifica a ninguna agencia · es lógica interna.
 *   · El promotor solo verá el ganador en la cola de pendientes.
 *   · El perdedor solo aparece si filtra por estado "Duplicados".
 */
export function addCreatedRegistro(r: Registro) {
  /* Defensa · si el caller no generó publicRef, generamos uno aquí
     escaneando el storage actual + seeds. Garantiza que ningún
     Registro queda sin ref pública. */
  const ensured: Registro = r.publicRef
    ? r
    : { ...r, publicRef: generatePublicRef("registration", [...read(), ...SEED_REGISTROS]) };
  const winner = findPendingDuplicate(ensured);

  /* Si hay duplicado intra-promo · regla first-come silent · el score
     es 100 (cliente exacto · match por email/tel normalizado). */
  if (winner) {
    const list = read();
    write([{
      ...ensured,
      estado: "duplicado",
      matchPercentage: 100,
      matchWith: `Registrado primero por ${winner.publicRef}`,
      matchCliente: { ...winner.cliente },
    }, ...list]);
    return;
  }

  /* Bloque C · sin duplicado bloqueante, calculamos match score
     contra otros registros del workspace (CROSS-promoción + contactos
     CRM cuando exista) para que el promotor vea el aviso al revisar.
     · score 0   → banner verde "seguro aprobar"
     · 1-69      → coincidencia parcial (mismo cliente otra promo)
     · 70-100    → posible duplicado relevante
     TODO(backend): sustituir por POST /api/match/score (IA real). */
  const candidates = [...read(), ...SEED_REGISTROS].filter(
    (other) => other.id !== ensured.id && other.estado !== "rechazado" && other.estado !== "caducado",
  );
  const best = findBestMatch(ensured.cliente, candidates);
  const finalRegistro: Registro = best && best.score > 0
    ? {
        ...ensured,
        matchPercentage: best.score,
        matchWith: best.score >= 70
          ? `Posible duplicado · ${best.target.publicRef}`
          : `Coincidencia parcial · ${best.target.publicRef}`,
        matchCliente: { ...best.target.cliente },
      }
    : ensured;
  const list = read();
  write([finalRegistro, ...list]);
  /* Write-through · el dueño es el promotor de la promoción. En mock
   * single-tenant siempre developer-default · cuando Phase 3 los
   * promotores externos creen sus propias promos, derivamos del
   * `promotions.owner_organization_id`. */
  void syncRegistroToSupabase(finalRegistro, "developer-default");
}

/** Helper exportado · permite a la UI calcular el score de un cliente
 *  entrante contra el universo actual (en form de creación, antes de
 *  submitear · real-time hint). */
export function previewMatchForCliente(cliente: Registro["cliente"]): number {
  const candidates = [...read(), ...SEED_REGISTROS].filter(
    (r) => r.estado !== "rechazado" && r.estado !== "caducado",
  );
  const best = findBestMatch(cliente, candidates);
  return best?.score ?? 0;
}

export function removeCreatedRegistro(id: string) {
  write(read().filter((r) => r.id !== id));
}

export function useCreatedRegistros(): Registro[] {
  const [list, setList] = useState<Registro[]>(read);
  useEffect(() => {
    const cb = () => setList(read());
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return list;
}
