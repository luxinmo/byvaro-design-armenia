/**
 * businessActivity.ts · Feed unificado de actividad de la empresa.
 *
 * QUÉ
 * ----
 * Agrega todos los eventos de negocio relevantes en un timeline único
 * ordenado cronológicamente. Es la fuente de datos de:
 *
 *   - `/actividad` · pantalla completa con filtros + agrupación por día.
 *   - `<RecentActivityWidget>` · widget compacto en `/inicio` (5-7 items).
 *
 * Cada pieza de actividad se normaliza al tipo `BusinessActivityEvent`
 * para que la UI solo tenga que leer un único shape. Las fuentes son
 * las existentes · no se duplica storage ni se añade historia nueva:
 *
 *   1. Registros decididos (`src/data/records.ts` + overrides locales)
 *      · aprobado | rechazado | duplicado → 1 evento cada uno.
 *   2. CalendarEvent done (`src/data/calendarEvents.ts`) · visitas,
 *      llamadas y reuniones que ya se hicieron.
 *   3. Ventas (`src/data/sales.ts`) · reservas, contratos, escrituras
 *      y caídas (un evento por cada transición que tenga fecha).
 *   4. Miembros del equipo (`src/lib/team.ts`) · altas recientes vía
 *      `joinedAt` (filtrado a <= 90 días para no inundar el feed).
 *   5. Agencias colaboradoras (`src/data/agencies.ts`) · alta de
 *      colaboración vía `collaboratingSince` (human-readable parseado).
 *
 * CÓMO
 * ----
 * - `getAllBusinessActivity()` · función pura (no hooks, no setState).
 * - `useBusinessActivity(filter?)` · hook React que se suscribe a los
 *   stores reactivos (calendarEvents, registrosCreados) y devuelve el
 *   feed ordenado y filtrado.
 *
 * TODO(backend): reemplazar por un endpoint único paginado
 *   `GET /api/activity?types=&userId=&from=&to=&cursor=`. El backend
 *   debe construir este feed uniendo las mismas tablas (registros,
 *   calendar_events, sales, members, agency_collaborations,
 *   company_events) + aplicar RLS por workspace. El shape devuelto
 *   debe coincidir con `BusinessActivityEvent` (o al menos ser trivial
 *   de mapear).
 */

import { useMemo } from "react";
import {
  CircleDollarSign, Home, Phone, UsersRound, FileText,
  UserPlus, Handshake, AlertCircle, CheckCircle2,
  FileSignature, XCircle, CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { registros as SEED_REGISTROS } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { useCalendarEvents } from "@/lib/calendarStorage";
import { getPublicRef } from "@/lib/tenantRefResolver";
import { sales as SEED_SALES } from "@/data/sales";
import { agencies as SEED_AGENCIES } from "@/data/agencies";
import { getAllTeamMembers, findTeamMember } from "@/lib/team";

/* ══════════════════════════════════════════════════════════════════
   Tipos
   ══════════════════════════════════════════════════════════════════ */

export type BusinessActivityKind =
  | "sale"        // venta (reserva, contrato, escritura, caída)
  | "visit"       // visita realizada
  | "call"        // llamada completada
  | "meeting"     // reunión completada
  | "registro"    // registro aprobado/rechazado/duplicado
  | "member"      // nuevo miembro del equipo
  | "agency";     // nueva agencia colaboradora

export type BusinessActivityTone =
  | "primary"     // destacado (ventas, hitos)
  | "success"     // positivo (aprobado, cerrado)
  | "warning"     // amarillo (pendiente, alerta)
  | "destructive" // rojo (rechazo, caída)
  | "muted";      // neutro

export type BusinessActivityEvent = {
  /** Id único (estable entre renders, prefijo por fuente). */
  id: string;
  kind: BusinessActivityKind;
  /** Sub-tipo legible ("aprobado", "contratada", "noshow"...). Opcional. */
  subtype?: string;
  /** ISO 8601 · momento en el que ocurrió. */
  at: string;
  title: string;
  description?: string;
  /** Id del miembro del equipo que protagoniza · TEAM_MEMBERS.id.
   *  `null` cuando el actor es sistema/externo. */
  userId?: string | null;
  /** Snapshot del nombre por si el miembro se desactiva. */
  userName?: string;
  /** Importe en EUR · ventas. */
  amount?: number;
  /** Id de agencia externa relacionada (si aplica). */
  agencyId?: string | null;
  agencyName?: string;
  /** Deeplink a la pantalla relevante. */
  href?: string;
  /** Icono + tono preferidos (UI puede sobreescribir). */
  icon: LucideIcon;
  tone: BusinessActivityTone;
  /** Metadata extra opcional · promoción, unidad, cliente. */
  meta?: {
    promotionId?: string;
    promotionName?: string;
    unit?: string;
    clientName?: string;
    registroId?: string;
    eventId?: string;
    saleId?: string;
  };
};

export type BusinessActivityFilter = {
  /** Si se pasa, filtra por miembro (TEAM_MEMBERS.id). null = todo el equipo. */
  userId?: string | null;
  /** Si se pasa, incluye sólo los kinds listados. */
  kinds?: BusinessActivityKind[];
  /** ISO · límite inferior (inclusive). */
  from?: string;
  /** ISO · límite superior (exclusive). */
  to?: string;
};

/* ══════════════════════════════════════════════════════════════════
   Helpers internos
   ══════════════════════════════════════════════════════════════════ */

/** Mapea un nombre legible "Mar 2025" al ISO aproximado del 1º del mes.
 *  Se usa para `agencies.collaboratingSince`. Devuelve undefined si el
 *  formato no encaja — la agencia se excluye del feed en ese caso. */
const ES_MONTHS: Record<string, string> = {
  Ene: "01", Feb: "02", Mar: "03", Abr: "04", May: "05", Jun: "06",
  Jul: "07", Ago: "08", Sep: "09", Oct: "10", Nov: "11", Dic: "12",
};
function parseSpanishMonthYear(s?: string): string | undefined {
  if (!s) return undefined;
  const parts = s.trim().split(/\s+/);
  if (parts.length !== 2) return undefined;
  const [m, y] = parts;
  const mm = ES_MONTHS[m];
  if (!mm || !/^\d{4}$/.test(y)) return undefined;
  return `${y}-${mm}-01T09:00:00Z`;
}

/** Resuelve el userId del agente de una venta · cruza `agentName` con
 *  TEAM_MEMBERS. Devuelve undefined si el agente es externo (de la
 *  agencia) o no se encuentra. */
function resolveSaleUserId(agentName: string): string | undefined {
  const member = findTeamMember(agentName);
  return member?.id;
}

/* ══════════════════════════════════════════════════════════════════
   Builders por fuente
   ══════════════════════════════════════════════════════════════════ */

function buildRegistroEvents(regs: typeof SEED_REGISTROS): BusinessActivityEvent[] {
  const out: BusinessActivityEvent[] = [];
  for (const r of regs) {
    if (r.estado === "pendiente") continue;
    const at = r.decidedAt ?? r.fecha;
    if (r.estado === "aprobado") {
      out.push({
        id: `reg-approved-${r.id}`,
        kind: "registro",
        subtype: "aprobado",
        at,
        title: `Registro aprobado · ${r.cliente.nombre}`,
        description: r.matchPercentage > 0
          ? `Aprobado pese a ${r.matchPercentage}% de coincidencia`
          : "Sin duplicado · aprobación limpia",
        userId: r.decidedByUserId ?? null,
        userName: r.decidedBy,
        agencyId: r.agencyId ?? null,
        href: "/registros",
        icon: CheckCircle2,
        tone: "success",
        meta: { registroId: r.id, clientName: r.cliente.nombre, promotionId: r.promotionId },
      });
    } else if (r.estado === "rechazado") {
      out.push({
        id: `reg-rejected-${r.id}`,
        kind: "registro",
        subtype: "rechazado",
        at,
        title: `Registro rechazado · ${r.cliente.nombre}`,
        description: r.decisionNote || r.recommendation,
        userId: r.decidedByUserId ?? null,
        userName: r.decidedBy,
        agencyId: r.agencyId ?? null,
        href: "/registros",
        icon: XCircle,
        tone: "destructive",
        meta: { registroId: r.id, clientName: r.cliente.nombre, promotionId: r.promotionId },
      });
    } else if (r.estado === "duplicado") {
      out.push({
        id: `reg-duplicate-${r.id}`,
        kind: "registro",
        subtype: "duplicado",
        at,
        title: `Duplicado detectado · ${r.cliente.nombre}`,
        description: r.matchWith,
        userId: r.decidedByUserId ?? null,
        userName: r.decidedBy,
        agencyId: r.agencyId ?? null,
        href: "/registros",
        icon: AlertCircle,
        tone: "warning",
        meta: { registroId: r.id, clientName: r.cliente.nombre, promotionId: r.promotionId },
      });
    }
  }
  return out;
}

function buildCalendarEvents(events: ReturnType<typeof useCalendarEvents>): BusinessActivityEvent[] {
  const out: BusinessActivityEvent[] = [];
  for (const ev of events) {
    if (ev.status !== "done") continue;
    if (ev.type === "visit") {
      const eval_ = (ev as { evaluation?: { rating?: number; clientInterest?: string } }).evaluation;
      const promo = (ev as { promotionName?: string }).promotionName;
      const unit = (ev as { unitLabel?: string }).unitLabel;
      out.push({
        id: `visit-done-${ev.id}`,
        kind: "visit",
        subtype: "done",
        at: ev.end,
        title: `Visita realizada · ${ev.contactName ?? ev.title}`,
        description: [
          promo,
          unit,
          eval_?.rating ? `${eval_.rating}★` : undefined,
        ].filter(Boolean).join(" · ") || undefined,
        userId: ev.assigneeUserId,
        userName: ev.assigneeName,
        href: `/calendario?event=${ev.id}`,
        icon: Home,
        tone: "success",
        meta: { clientName: ev.contactName, eventId: ev.id, promotionName: promo, unit },
      });
    } else if (ev.type === "call") {
      out.push({
        id: `call-done-${ev.id}`,
        kind: "call",
        subtype: "done",
        at: ev.end,
        title: `Llamada · ${ev.contactName ?? ev.title}`,
        description: ev.notes,
        userId: ev.assigneeUserId,
        userName: ev.assigneeName,
        href: `/calendario?event=${ev.id}`,
        icon: Phone,
        tone: "muted",
        meta: { clientName: ev.contactName, eventId: ev.id },
      });
    } else if (ev.type === "meeting") {
      out.push({
        id: `meeting-done-${ev.id}`,
        kind: "meeting",
        subtype: "done",
        at: ev.end,
        title: `Reunión · ${ev.title}`,
        description: ev.contactName ? `Con ${ev.contactName}` : ev.location?.label,
        userId: ev.assigneeUserId,
        userName: ev.assigneeName,
        href: `/calendario?event=${ev.id}`,
        icon: UsersRound,
        tone: "muted",
        meta: { clientName: ev.contactName, eventId: ev.id },
      });
    }
  }
  return out;
}

function buildSaleEvents(sales: typeof SEED_SALES): BusinessActivityEvent[] {
  const out: BusinessActivityEvent[] = [];
  for (const s of sales) {
    const userId = resolveSaleUserId(s.agentName);
    const base = {
      userId: userId ?? null,
      userName: s.agentName,
      agencyId: s.agencyId ?? null,
      href: "/ventas",
      amount: s.precioFinal,
      meta: {
        saleId: s.id,
        clientName: s.clienteNombre,
        promotionId: s.promotionId,
        unit: s.unitLabel,
      },
    };

    // Reserva · siempre existe
    out.push({
      ...base,
      id: `sale-reserve-${s.id}`,
      kind: "sale",
      subtype: "reservada",
      at: `${s.fechaReserva}T10:00:00Z`,
      title: `Reserva · ${s.clienteNombre}`,
      description: `${s.unitLabel} · señal ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(s.precioReserva)}`,
      icon: FileText,
      tone: "primary",
    });

    if (s.fechaContrato) {
      out.push({
        ...base,
        id: `sale-contract-${s.id}`,
        kind: "sale",
        subtype: "contratada",
        at: `${s.fechaContrato}T11:00:00Z`,
        // CLAUDE.md · "Venta cerrada vs terminada" · contrato firmado = cerrada
        title: `Venta cerrada · ${s.clienteNombre}`,
        description: `Contrato firmado · ${s.unitLabel} · ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(s.precioFinal)}`,
        icon: FileSignature,
        tone: "success",
      });
    }
    if (s.fechaEscritura) {
      out.push({
        ...base,
        id: `sale-deed-${s.id}`,
        kind: "sale",
        subtype: "escriturada",
        at: `${s.fechaEscritura}T12:00:00Z`,
        // CLAUDE.md · "Venta cerrada vs terminada" · escritura + cobro = terminada
        title: `Venta terminada · ${s.clienteNombre}`,
        description: `Escriturada y cobrada · ${s.unitLabel} · ${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(s.precioFinal)}`,
        icon: CircleDollarSign,
        tone: "success",
      });
    }
    if (s.fechaCaida) {
      out.push({
        ...base,
        id: `sale-fallen-${s.id}`,
        kind: "sale",
        subtype: "caida",
        at: `${s.fechaCaida}T10:00:00Z`,
        title: `Venta caída · ${s.clienteNombre}`,
        description: s.nota ?? `${s.unitLabel}`,
        icon: XCircle,
        tone: "destructive",
      });
    }
  }
  return out;
}

function buildMemberEvents(): BusinessActivityEvent[] {
  const out: BusinessActivityEvent[] = [];
  const now = Date.now();
  const cutoff = now - 90 * 24 * 60 * 60 * 1000; // 90 días

  for (const m of getAllTeamMembers()) {
    if (!m.joinedAt) continue;
    if (m.status === "deactive") continue;
    const ts = new Date(m.joinedAt).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    out.push({
      id: `member-joined-${m.id}`,
      kind: "member",
      subtype: m.status ?? "active",
      at: m.joinedAt,
      title: `Nuevo miembro · ${m.name}`,
      description: m.jobTitle ?? "Se une al equipo",
      userId: m.id,
      userName: m.name,
      href: `/equipo/${m.id}/estadisticas`,
      icon: UserPlus,
      tone: "primary",
    });
  }
  return out;
}

function buildAgencyEvents(agencies: typeof SEED_AGENCIES): BusinessActivityEvent[] {
  const out: BusinessActivityEvent[] = [];
  for (const a of agencies) {
    const at = parseSpanishMonthYear(a.collaboratingSince);
    if (!at) continue;
    out.push({
      id: `agency-joined-${a.id}`,
      kind: "agency",
      subtype: a.origen ?? "invited",
      at,
      title: `Nueva agencia · ${a.name}`,
      description: [a.location, a.origen === "marketplace" ? "Marketplace" : "Invitación"].filter(Boolean).join(" · "),
      agencyId: a.id,
      agencyName: a.name,
      href: `/colaboradores/${a.publicRef || getPublicRef(a.id) || a.id}`,
      icon: Handshake,
      tone: "primary",
    });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   API pública
   ══════════════════════════════════════════════════════════════════ */

/** Aplica filtros + orden cronológico descendente. */
function applyFilters(
  list: BusinessActivityEvent[],
  filter: BusinessActivityFilter = {},
): BusinessActivityEvent[] {
  const { userId, kinds, from, to } = filter;
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : Infinity;
  return list
    .filter((e) => {
      if (userId !== undefined && userId !== null && e.userId !== userId) return false;
      if (kinds && kinds.length > 0 && !kinds.includes(e.kind)) return false;
      const ts = new Date(e.at).getTime();
      if (Number.isNaN(ts)) return false;
      if (ts < fromMs || ts >= toMs) return false;
      return true;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** Versión no reactiva · útil en tests y en builders de mocks. */
export function getAllBusinessActivity(
  sources: {
    registros?: typeof SEED_REGISTROS;
    calendarEvents?: ReturnType<typeof useCalendarEvents>;
    sales?: typeof SEED_SALES;
    agencies?: typeof SEED_AGENCIES;
  } = {},
): BusinessActivityEvent[] {
  const regs = sources.registros ?? SEED_REGISTROS;
  const evs = sources.calendarEvents ?? [];
  const sls = sources.sales ?? SEED_SALES;
  const ags = sources.agencies ?? SEED_AGENCIES;
  return [
    ...buildRegistroEvents(regs),
    ...buildCalendarEvents(evs),
    ...buildSaleEvents(sls),
    ...buildMemberEvents(),
    ...buildAgencyEvents(ags),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** Hook reactivo · se refresca cuando cambian registros o eventos de
 *  calendario (las otras fuentes son seed estático). */
export function useBusinessActivity(
  filter: BusinessActivityFilter = {},
): BusinessActivityEvent[] {
  const createdRegs = useCreatedRegistros();
  const calendarEvents = useCalendarEvents();
  const filterKey = JSON.stringify(filter);

  return useMemo(() => {
    const allRegs = [...createdRegs, ...SEED_REGISTROS];
    const list = [
      ...buildRegistroEvents(allRegs),
      ...buildCalendarEvents(calendarEvents),
      ...buildSaleEvents(SEED_SALES),
      ...buildMemberEvents(),
      ...buildAgencyEvents(SEED_AGENCIES),
    ];
    return applyFilters(list, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdRegs, calendarEvents, filterKey]);
}

/** Lista de kinds con metadatos para la barra de filtros. */
export const BUSINESS_ACTIVITY_KINDS: {
  value: BusinessActivityKind;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "sale",     label: "Ventas",    icon: CircleDollarSign },
  { value: "visit",    label: "Visitas",   icon: Home },
  { value: "call",     label: "Llamadas",  icon: Phone },
  { value: "meeting",  label: "Reuniones", icon: CalendarCheck },
  { value: "registro", label: "Registros", icon: FileText },
  { value: "member",   label: "Equipo",    icon: UserPlus },
  { value: "agency",   label: "Agencias",  icon: Handshake },
];
