/**
 * Leads · entradas crudas de potenciales compradores que llegan desde
 * portales (Idealista, Fotocasa, Habitaclia…), formularios del microsite,
 * o agencias colaboradoras antes de ser aprobados/rechazados como
 * Registros.
 *
 * Diferencia con `Registro`:
 *   - Lead = entrada sin cualificar, pendiente de revisión por el
 *     promotor o asignación a un comercial.
 *   - Registro = lead ya aprobado y ligado a un cliente + promoción
 *     concreta. La IA de duplicados corre sobre los leads antes de
 *     promocionarlos a registros.
 *
 * TODO(backend): `GET /api/leads` con paginación + filtros. Cada lead
 *   se persiste al recibir el webhook del portal o al someter un
 *   formulario. Ver `docs/backend-integration.md §7.1`.
 */

export type LeadSource =
  | "idealista"
  | "fotocasa"
  | "habitaclia"
  | "microsite"
  | "referral"
  | "agency"
  | "whatsapp"
  | "walkin"
  | "call";

/** Pipeline unificado: Lead y Oportunidad conviven en la misma entidad.
 *  El lead entra en `solicitud` y va avanzando por el embudo hasta
 *  `ganada` / `perdida` (o `duplicate` si la IA detecta doble entrada).
 *
 *  Orden canónico:
 *    1. solicitud   · entrada cruda sin cualificar
 *    2. contactado  · ya se contactó (email/call/WS)
 *    3. visita      · visita programada o realizada (label "En visita")
 *    4. evaluacion  · post-visita, cliente evalúa
 *    5. negociando  · oferta concreta en negociación
 *    6. ganada      · terminal · cliente firmado/reservó
 *    7. perdida     · terminal · se descartó
 *    8. duplicate   · IA detectó que es doble entrada */
export type LeadStatus =
  | "solicitud"
  | "contactado"
  | "visita"
  | "evaluacion"
  | "negociando"
  | "ganada"
  | "perdida"
  | "duplicate";

export type LeadInterest = {
  /** Promoción con la que el lead ha mostrado interés. */
  promotionId?: string;
  promotionName?: string;
  /** Tipología (Apartamento, Villa, Ático…). */
  tipologia?: string;
  /** Rango de dormitorios pedido. */
  dormitorios?: string;        // "2-3", "3+"
  /** Presupuesto máximo en EUR (null = no declarado). */
  presupuestoMax?: number;
  /** Zona preferida. */
  zona?: string;
};

export type Lead = {
  id: string;
  /** @deprecated Usar `publicRef`. Alias derivado durante migración. */
  reference?: string;
  /** Referencia pública de la oportunidad · formato `opXXXXXX` (lead
   *  y oportunidad comparten ref · son la misma entidad en distintas
   *  fases). Inmutable, única por organización. Uso humano solo.
   *  Ver `docs/public-references-audit.md`. */
  publicRef: string;
  fullName: string;
  email: string;
  phone: string;
  /** ISO2 del país de origen del comprador. */
  nationality?: string;
  /** Idioma preferido para comunicarse (ISO2). */
  idioma?: string;
  source: LeadSource;
  status: LeadStatus;
  /** Interés declarado. */
  interest: LeadInterest;
  /** ISO timestamp cuando entró el lead. */
  createdAt: string;
  /** ISO timestamp del primer contacto del equipo (null si aún no). */
  firstResponseAt?: string;
  /** Usuario del promotor asignado al lead. */
  assignedTo?: { name: string; email: string };
  /** Mensaje libre del comprador (si llegó con mensaje). */
  message?: string;
  /** Score de IA duplicados · 0-100 · null si aún no se ha evaluado. */
  duplicateScore?: number;
  /** Si duplicateScore ≥ 70, referencia al contacto/registro con el
   *  que matchea (para revisar antes de crear doble entrada). */
  duplicateOfContactId?: string;
  /** Etiquetas libres para clasificar (urgente, cash-buyer, etc.). */
  tags?: string[];
};

/* ─── Helpers de UI ─── */

export const leadSourceLabel: Record<LeadSource, string> = {
  idealista:  "Idealista",
  fotocasa:   "Fotocasa",
  habitaclia: "Habitaclia",
  microsite:  "Microsite",
  referral:   "Referido",
  agency:     "Agencia",
  whatsapp:   "WhatsApp",
  walkin:     "Visita oficina",
  call:       "Llamada",
};

export const leadStatusConfig: Record<LeadStatus, { label: string; order: number; badgeClass: string; dotClass: string }> = {
  solicitud:  { label: "Solicitud",  order: 1, badgeClass: "bg-primary/10 text-primary border border-primary/25",            dotClass: "bg-primary" },
  contactado: { label: "Contactado", order: 2, badgeClass: "bg-cyan-50 text-cyan-800 border border-cyan-200",                dotClass: "bg-cyan-500" },
  visita:     { label: "En visita",  order: 3, badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",                   dotClass: "bg-sky-500" },
  evaluacion: { label: "Evaluación", order: 4, badgeClass: "bg-indigo-50 text-indigo-800 border border-indigo-200",          dotClass: "bg-indigo-500" },
  negociando: { label: "Negociando", order: 5, badgeClass: "bg-warning/10 text-warning border border-warning/25",            dotClass: "bg-warning" },
  ganada:     { label: "Ganada",     order: 6, badgeClass: "bg-success/10 text-success border border-success/25",            dotClass: "bg-success" },
  perdida:    { label: "Perdida",    order: 7, badgeClass: "bg-muted text-muted-foreground border border-border",            dotClass: "bg-muted-foreground" },
  duplicate:  { label: "Duplicado",  order: 8, badgeClass: "bg-destructive/5 text-destructive border border-destructive/25", dotClass: "bg-destructive" },
};

/* ═══════════════════════════════════════════════════════════════════
   MOCK · sustituir por `GET /api/leads`
   ═══════════════════════════════════════════════════════════════════ */

/** Helper: resta N días/horas al momento actual en ISO. */
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

import { seedRef } from "@/lib/publicRef";

/* Backfill · cada Lead se enriquece con `publicRef` derivado del
 * id via hash determinista. Scheme canónico: lead/oportunidad =
 * registro · prefijo `RG` + 9 dígitos. El campo legacy
 * `reference: "OPP-NNNN"` queda como breadcrumb. */
type LegacyLeadSeed = Omit<Lead, "publicRef">;

function enrichLegacyLeadSeed(seed: LegacyLeadSeed, _idx: number): Lead {
  return {
    ...seed,
    publicRef: seedRef("registro", seed.id),
  };
}

const RAW_LEADS: Lead[] = [];

/** Export final · cada lead enriquecido con `publicRef`. El campo
 *  legacy `reference` se mantiene por retrocompat hasta purgar. */
export const leads: Lead[] = RAW_LEADS.map(enrichLegacyLeadSeed);
