/**
 * scripts/generate-crm-seed.ts
 * ----------------------------
 * Convierte registros, sales, calendarEvents (TS seeds) a INSERT
 * statements para `supabase/migrations/20260429100003_crm_seed.sql`.
 *
 * Run · `npx tsx scripts/generate-crm-seed.ts`
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { registros as REGISTROS } from "../src/data/records";
import { sales as SALES } from "../src/data/sales";
import { calendarEvents as CAL_EVENTS } from "../src/data/calendarEvents";

const __dirname = dirname(fileURLToPath(import.meta.url));

function S(v: string | undefined | null): string {
  if (v == null) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}
function N(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return "null";
  return String(v);
}
function B(v: boolean | undefined | null): string {
  if (v == null) return "null";
  return v ? "true" : "false";
}
function J(v: unknown): string {
  if (v == null) return "null";
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}
function TS(v: string | number | undefined | null): string {
  if (v == null) return "null";
  if (typeof v === "number") return `to_timestamp(${v / 1000})`;
  return S(v);
}

const lines: string[] = [];
lines.push("-- ===================================================================");
lines.push("-- AUTO-GENERATED · do not edit manually.");
lines.push("-- Source: scripts/generate-crm-seed.ts");
lines.push("-- ===================================================================");
lines.push("");
lines.push("-- Idempotente · limpia datos CRM antes de re-seedear.");
lines.push("delete from public.visit_evaluations;");
lines.push("delete from public.calendar_events where id like 'ce-%' or id like 'ev-%';");
lines.push("delete from public.sale_payments;");
lines.push("delete from public.sales;");
lines.push("delete from public.registro_events;");
lines.push("delete from public.registros;");
lines.push("");

/* ─── Registros · todos pertenecen a developer-default (Luxinmo). ─── */
lines.push("-- ─── registros ──────────────────────────────────────────");
for (const r of REGISTROS) {
  /* Estados: el seed usa los canónicos del enum directamente. */
  const estado = r.estado;
  const tipo = (r as { tipo?: string }).tipo ?? "registration";
  const visitDate = (r as { visitDate?: string }).visitDate;
  const visitTime = (r as { visitTime?: string }).visitTime;
  const originRegistro = (r as { originRegistroId?: string }).originRegistroId;
  const visitOutcome = (r as { visitOutcome?: string }).visitOutcome ?? null;
  const decidedAt = (r as { decidedAt?: string }).decidedAt
    ?? (r.estado === "aprobado" || r.estado === "rechazado" ? r.fecha : null);
  /* Nota · en mock single-tenant, organization_id = developer-default. */
  lines.push(`insert into public.registros (
  id, organization_id, agency_organization_id, promotion_id, contact_id,
  origen, tipo, estado,
  cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad, cliente_nationality_iso, cliente_dni,
  match_percentage, match_with, match_cliente, recommendation,
  visit_date, visit_time, visit_outcome, origin_registro_id,
  decided_at, decided_by_user_id, decided_by_name, decided_by_role,
  notas, consent, response_time, public_ref, fecha
) values (
  ${S(r.id)}, 'developer-default', ${S(r.agencyId)}, ${S(r.promotionId)}, null,
  ${S(r.origen)}, ${S(tipo)}, ${S(estado)},
  ${S(r.cliente.nombre)}, ${S(r.cliente.email)}, ${S(r.cliente.telefono)},
  ${S(r.cliente.nacionalidad)}, ${S(r.cliente.nationalityIso)}, ${S(r.cliente.dni)},
  ${N(r.matchPercentage)}, ${S(r.matchWith)}, ${J(r.matchCliente)}, ${S(r.recommendation)},
  ${visitDate ? S(visitDate) : "null"}, ${S(visitTime)}, ${visitOutcome ? S(visitOutcome) : "null"},
  ${S(originRegistro)},
  ${TS(decidedAt)}, null, ${S(r.decidedBy)}, ${S(r.decidedByRole)},
  ${S(r.notas)}, ${B(r.consent)}, ${S(r.responseTime)}, ${S(r.publicRef)},
  ${TS(r.fecha)}
);`);
}
lines.push("");

/* ─── Sales ───────────────────────────────────────────────────────── */
const REGISTRO_IDS = new Set(REGISTROS.map((r) => r.id));
lines.push("-- ─── sales ──────────────────────────────────────────────");
for (const s of SALES) {
  /* sales.ts apunta a `registroId` con ids ("r-1045") que no existen
   * en records.ts seed (que usa "reg-001"). Solo conservamos el FK si
   * el registro existe en seed · si no, NULL para que el insert pase. */
  const registroIdSafe = s.registroId && REGISTRO_IDS.has(s.registroId) ? s.registroId : null;
  lines.push(`insert into public.sales (
  id, organization_id, agency_organization_id, promotion_id, registro_id, contact_id,
  unit_id, unit_label, cliente_nombre, cliente_email, cliente_telefono, cliente_nacionalidad,
  agent_name, estado, fecha_reserva, fecha_contrato, fecha_escritura, fecha_caida,
  precio_reserva, precio_final, precio_listado, descuento_aplicado, comision_pct, comision_pagada,
  metodo_pago, siguiente_paso, siguiente_paso_fecha, nota
) values (
  ${S(s.id)}, 'developer-default', ${S(s.agencyId)}, ${S(s.promotionId)}, ${S(registroIdSafe)}, null,
  ${S(s.unitId)}, ${S(s.unitLabel)}, ${S(s.clienteNombre)}, ${S(s.clienteEmail)},
  ${S(s.clienteTelefono)}, ${S(s.clienteNacionalidad)},
  ${S(s.agentName)}, ${S(s.estado)},
  ${S(s.fechaReserva)}, ${S(s.fechaContrato)}, ${S(s.fechaEscritura)}, ${S(s.fechaCaida)},
  ${N(s.precioReserva)}, ${N(s.precioFinal)}, ${N(s.precioListado)}, ${N(s.descuentoAplicado)},
  ${N(s.comisionPct)}, ${B(s.comisionPagada)},
  ${S(s.metodoPago)}, ${S(s.siguientePaso)}, ${S(s.siguientePasoFecha)}, ${S(s.nota)}
);`);
  /* Sale payments. */
  if (s.pagos && s.pagos.length > 0) {
    for (const p of s.pagos) {
      lines.push(`insert into public.sale_payments (sale_id, fecha, concepto, importe)
values (${S(s.id)}, ${S(p.fecha)}, ${S(p.concepto)}, ${N(p.importe)});`);
    }
  }
}
lines.push("");

/* ─── Calendar events ─────────────────────────────────────────────── */
lines.push("-- ─── calendar_events ────────────────────────────────────");
for (const e of CAL_EVENTS) {
  /* Defensive · nullificar FKs que apunten a IDs inexistentes en seed. */
  const evRegId = (e as { registroId?: string }).registroId;
  const registroIdSafe = evRegId && REGISTRO_IDS.has(evRegId) ? evRegId : null;
  /* Algunos seeds tienen solo `start` con fecha + hora separados. Normalizamos. */
  const startsAt = (e as { startsAt?: string; start?: string }).startsAt
    ?? (e as { startsAt?: string; start?: string }).start;
  const endsAt = (e as { endsAt?: string; end?: string }).endsAt
    ?? (e as { endsAt?: string; end?: string }).end
    ?? startsAt;
  if (!startsAt || !endsAt) continue;
  /* Map seed statuses al enum DB. */
  const rawStatus = (e as { status?: string }).status ?? "scheduled";
  const statusMapped: Record<string, string> = {
    "scheduled": "scheduled",
    "confirmed": "confirmed",
    "done": "done",
    "cancelled": "cancelled",
    "rescheduled": "rescheduled",
    "noshow": "cancelled",
    "pending-confirmation": "scheduled",
  };
  const status = statusMapped[rawStatus] ?? "scheduled";
  const rawType = (e as { type?: string }).type ?? "task";
  const typeMapped: Record<string, string> = {
    "visit": "visit", "call": "call", "meeting": "meeting",
    "task": "task", "block": "block", "followup": "followup",
    "reminder": "task",
  };
  const type = typeMapped[rawType] ?? "task";
  lines.push(`insert into public.calendar_events (
  id, organization_id, type, status, title, description, starts_at, ends_at,
  contact_id, registro_id, promotion_id, lead_id, location, metadata
) values (
  ${S(e.id)}, 'developer-default',
  ${S(type)},
  ${S(status)},
  ${S((e as { title?: string }).title ?? "")},
  ${S((e as { description?: string }).description)},
  ${S(startsAt)}, ${S(endsAt)},
  null, ${S(registroIdSafe)},
  ${S((e as { promotionId?: string }).promotionId)},
  null,
  ${S((e as { location?: string }).location)},
  null
);`);
}
lines.push("");

const out = resolve(__dirname, "../supabase/migrations/20260429100003_crm_seed.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`✓ CRM seed generated · ${out}`);
