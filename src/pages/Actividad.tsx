/**
 * Actividad · dashboard analítico de la empresa.
 *
 * Pensado para ser el dashboard "best in class" para un promotor
 * inmobiliario. Los bloques están ordenados por valor al CEO/director
 * comercial:
 *
 *   1. Alertas IA · 2-3 cosas detectadas automáticamente (patrón, no
 *      LLM real por ahora — TODO(backend) llamar al endpoint real
 *      cuando exista).
 *   2. 6 KPIs con delta vs periodo anterior · Pipeline €, Ventas €,
 *      Visitas, T.Respuesta, Conversión del embudo, Nuevos leads.
 *   3. Embudo grande · 5 pasos (leads → aprobados → visitas →
 *      reservas → escrituras) con % de caída entre pasos.
 *   4. Actividad por día / semana / mes (barras apiladas) + Ventas €
 *      por mes (barras).
 *   5. Velocidad de cierre (mini KPIs con días medios) + Mix por
 *      nacionalidad (donut).
 *   6. Heatmap día × hora (cuándo pasa la actividad) + Salud del
 *      equipo (quién está caliente / frío).
 *   7. Rankings · Top miembros · Top promociones · Top agencias
 *      (split: por registros y por ventas).
 *   8. Feed de últimos movimientos (colapsable, 8 items).
 *
 * DATA: cruza `useBusinessActivity()` (feed agregado) con acceso
 * directo a registros y sales para métricas que necesitan más
 * contexto (pipeline €, t.respuesta, embudo).
 *
 * TODO(backend): reemplazar por GET /api/activity/summary con todos
 * los KPIs + deltas pre-calculados server-side. Cada bloque grande
 * debería poder cachearse por (tenantId, userId, from, to).
 * TODO(agency): la vista de agencia necesita un dashboard propio con
 *   comisión devengada / cobrada / pendiente + ranking dentro de la
 *   cartera del promotor. Hoy `/actividad` es PromotorOnly · ver
 *   `App.tsx`.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity as ActivityIcon, ArrowUpRight, TrendingUp, TrendingDown,
  CircleDollarSign, Home, Phone, FileText, Handshake, Users,
  Building2, Sparkles, Clock, Gauge, Globe, Flame, Snowflake,
  ChevronDown, ChevronUp, Timer, PieChart, Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { promotionHrefById } from "@/lib/urls";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import { Flag } from "@/components/ui/Flag";
import { resolveNationality } from "@/data/nationalities";
import { agencyHref } from "@/lib/agencyNavigation";
import { UserContextSwitcher } from "@/components/ui/UserContextSwitcher";
import { findTeamMember, getMemberAvatarUrl, memberInitials, getAllTeamMembers } from "@/lib/team";
import {
  useBusinessActivity,
  type BusinessActivityEvent,
  type BusinessActivityKind,
  type BusinessActivityTone,
} from "@/lib/businessActivity";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { agencies as SEED_AGENCIES } from "@/data/agencies";
import { registros as SEED_REGISTROS, type Registro } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { sales as SEED_SALES, type Venta } from "@/data/sales";
import { useCalendarEvents } from "@/lib/calendarStorage";

/* ══════════════════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════════════════ */

type RangePreset = "7d" | "30d" | "90d" | "12m";

const RANGE_PRESETS: { value: RangePreset; label: string; days: number }[] = [
  { value: "7d",  label: "7 días",   days: 7 },
  { value: "30d", label: "30 días",  days: 30 },
  { value: "90d", label: "90 días",  days: 90 },
  { value: "12m", label: "12 meses", days: 365 },
];

const KIND_COLOR: Record<BusinessActivityKind, string> = {
  sale:     "hsl(142 71% 45%)",
  visit:    "hsl(var(--primary))",
  call:     "hsl(220 14% 50%)",
  meeting:  "hsl(260 60% 55%)",
  registro: "hsl(38 92% 50%)",
  member:   "hsl(220 70% 50%)",
  agency:   "hsl(174 60% 40%)",
};

const KIND_LABEL: Record<BusinessActivityKind, string> = {
  sale: "Ventas", visit: "Visitas", call: "Llamadas",
  meeting: "Reuniones", registro: "Registros", member: "Equipo", agency: "Agencias",
};

const TONE_BG: Record<BusinessActivityTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const EUR0 = new Intl.NumberFormat("es-ES", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});
const EUR_COMPACT = new Intl.NumberFormat("es-ES", {
  style: "currency", currency: "EUR", maximumFractionDigits: 1, notation: "compact",
});

/* ══════════════════════════════════════════════════════════════════
   HELPERS DE PERIODO + MÉTRICAS
   ══════════════════════════════════════════════════════════════════ */

type Range = { from: number; to: number };

function rangeFromPreset(preset: RangePreset, reference: number = Date.now()): Range {
  const p = RANGE_PRESETS.find((r) => r.value === preset)!;
  const to = reference;
  const from = reference - p.days * 24 * 60 * 60 * 1000;
  return { from, to };
}

/** Periodo inmediatamente anterior al dado (misma duración). */
function previousRange(r: Range): Range {
  const duration = r.to - r.from;
  return { from: r.from - duration, to: r.from };
}

function inRange(iso: string | undefined, r: Range): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= r.from && t < r.to;
}

/** Añade T00:00:00 si el string es solo yyyy-mm-dd. */
function saleDateToISO(d?: string): string | undefined {
  if (!d) return undefined;
  return d.length === 10 ? `${d}T12:00:00Z` : d;
}

/* ══════ Cálculo del embudo ══════════════════════════════════════ */

/** Embudo comercial según CLAUDE.md "Venta cerrada vs terminada":
 *  leads → aprobados → visitas → reservas → cerradas (contrato) →
 *  terminadas (escritura). Seis pasos, no cinco. */
type Funnel = {
  leads: number;
  aprobados: number;
  visitas: number;
  reservas: number;
  cerradas: number;      // contrato de compraventa firmado
  terminadas: number;    // escriturada + cobro completo
};

function computeFunnel(
  allRegistros: Registro[],
  calEvents: ReturnType<typeof useCalendarEvents>,
  allSales: Venta[],
  range: Range,
  selectedUserId: string | null,
): Funnel {
  const memberName = selectedUserId ? findTeamMember(selectedUserId)?.name : undefined;

  const leads = allRegistros.filter((r) => {
    if (!inRange(r.fecha, range)) return false;
    if (selectedUserId && r.decidedByUserId !== selectedUserId) return false;
    return true;
  }).length;

  const aprobados = allRegistros.filter((r) => {
    if (r.estado !== "aprobado") return false;
    if (!inRange(r.decidedAt ?? r.fecha, range)) return false;
    if (selectedUserId && r.decidedByUserId !== selectedUserId) return false;
    return true;
  }).length;

  const visitas = calEvents.filter((ev) => {
    if (ev.type !== "visit" || ev.status !== "done") return false;
    if (!inRange(ev.end, range)) return false;
    if (selectedUserId && ev.assigneeUserId !== selectedUserId) return false;
    return true;
  }).length;

  const reservas = allSales.filter((s) => {
    if (!inRange(saleDateToISO(s.fechaReserva), range)) return false;
    if (selectedUserId && s.agentName !== memberName) return false;
    return true;
  }).length;

  const cerradas = allSales.filter((s) => {
    if (!inRange(saleDateToISO(s.fechaContrato), range)) return false;
    if (selectedUserId && s.agentName !== memberName) return false;
    return true;
  }).length;

  const terminadas = allSales.filter((s) => {
    if (!inRange(saleDateToISO(s.fechaEscritura), range)) return false;
    if (selectedUserId && s.agentName !== memberName) return false;
    return true;
  }).length;

  return { leads, aprobados, visitas, reservas, cerradas, terminadas };
}

/* ══════ Cálculo de KPIs ══════════════════════════════════════════ */

/** KPIs alineados con CLAUDE.md "Venta cerrada vs terminada":
 *   - Pipeline se parte en cierre (reservadas) + cobro (contratadas).
 *   - Ventas cerradas incluye contratada + escriturada (€ de negocio).
 *   - Ventas terminadas solo escriturada (€ cobrado en caja). */
type Kpis = {
  pipelineCierreEur: number;    // reservadas · falta contrato
  pipelineCobroEur: number;     // contratadas · falta escritura/cobro
  ventasCerradasCount: number;  // sales con fechaContrato en rango
  ventasCerradasEur: number;
  ventasTerminadasCount: number;// sales con fechaEscritura en rango
  ventasTerminadasEur: number;
  visitas: number;
  avgResponseMin: number | null;
  conversionPct: number;        // visitas / leads
  nuevosLeads: number;
};

function computeKpis(
  allRegistros: Registro[],
  calEvents: ReturnType<typeof useCalendarEvents>,
  allSales: Venta[],
  range: Range,
  selectedUserId: string | null,
): Kpis {
  const memberName = selectedUserId ? findTeamMember(selectedUserId)?.name : undefined;
  const ownsSale = (s: Venta) => !selectedUserId || s.agentName === memberName;

  // Pipeline de cierre · reservadas vivas (stock)
  const pipelineCierreEur = allSales
    .filter((s) => s.estado === "reservada" && ownsSale(s))
    .reduce((sum, s) => sum + s.precioFinal, 0);

  // Pipeline de cobro · contratadas vivas (stock · firmado sin escriturar)
  const pipelineCobroEur = allSales
    .filter((s) => s.estado === "contratada" && ownsSale(s))
    .reduce((sum, s) => sum + s.precioFinal, 0);

  const cerradasInRange = allSales.filter((s) =>
    inRange(saleDateToISO(s.fechaContrato), range) && ownsSale(s)
  );
  const ventasCerradasCount = cerradasInRange.length;
  const ventasCerradasEur = cerradasInRange.reduce((a, x) => a + x.precioFinal, 0);

  const terminadasInRange = allSales.filter((s) =>
    inRange(saleDateToISO(s.fechaEscritura), range) && ownsSale(s)
  );
  const ventasTerminadasCount = terminadasInRange.length;
  const ventasTerminadasEur = terminadasInRange.reduce((a, x) => a + x.precioFinal, 0);

  const visitas = calEvents.filter((ev) => {
    if (ev.type !== "visit" || ev.status !== "done") return false;
    if (!inRange(ev.end, range)) return false;
    if (selectedUserId && ev.assigneeUserId !== selectedUserId) return false;
    return true;
  }).length;

  // Tiempo medio de respuesta: minutos entre fecha (submission) y decidedAt
  const respuestas = allRegistros
    .filter((r) => {
      if (!r.decidedAt) return false;
      if (!inRange(r.decidedAt, range)) return false;
      if (selectedUserId && r.decidedByUserId !== selectedUserId) return false;
      return true;
    })
    .map((r) => {
      const submitted = new Date(r.fecha).getTime();
      const decided = new Date(r.decidedAt!).getTime();
      return Math.max(0, decided - submitted);
    });
  const avgResponseMin = respuestas.length > 0
    ? Math.round(respuestas.reduce((a, b) => a + b, 0) / respuestas.length / 60000)
    : null;

  const nuevosLeads = allRegistros.filter((r) => {
    if (!inRange(r.fecha, range)) return false;
    if (selectedUserId && r.decidedByUserId !== selectedUserId) return false;
    return true;
  }).length;

  const conversionPct = nuevosLeads > 0
    ? Math.round((visitas / nuevosLeads) * 100)
    : 0;

  return {
    pipelineCierreEur, pipelineCobroEur,
    ventasCerradasCount, ventasCerradasEur,
    ventasTerminadasCount, ventasTerminadasEur,
    visitas, avgResponseMin, conversionPct, nuevosLeads,
  };
}

/* ══════ Velocidad de cierre ═════════════════════════════════════ */

type Velocity = {
  leadToVisit: number | null;         // lead → visita realizada
  visitToReserva: number | null;      // visita → señal
  reservaToContrato: number | null;   // señal → contrato (cerrada)
  contratoToEscritura: number | null; // contrato → escritura (terminada)
};

function computeVelocity(
  allRegistros: Registro[],
  calEvents: ReturnType<typeof useCalendarEvents>,
  allSales: Venta[],
  range: Range,
): Velocity {
  // lead → visit
  const leadToVisitSamples: number[] = [];
  for (const ev of calEvents) {
    if (ev.type !== "visit" || ev.status !== "done") continue;
    if (!inRange(ev.end, range)) continue;
    const rid = ev.registroId;
    if (rid) {
      const r = allRegistros.find((x) => x.id === rid);
      if (r) {
        const days = (new Date(ev.end).getTime() - new Date(r.fecha).getTime()) / (24 * 60 * 60 * 1000);
        if (days >= 0 && days < 365) leadToVisitSamples.push(days);
      }
    }
  }

  // visita → reserva (proxy: registro.fecha → fechaReserva)
  const visitToReservaSamples: number[] = [];
  for (const s of allSales) {
    if (!inRange(saleDateToISO(s.fechaReserva), range)) continue;
    if (!s.registroId) continue;
    const r = allRegistros.find((x) => x.id === s.registroId);
    if (!r) continue;
    const days = (new Date(s.fechaReserva).getTime() - new Date(r.fecha).getTime()) / (24 * 60 * 60 * 1000);
    if (days >= 0 && days < 365) visitToReservaSamples.push(days);
  }

  // reserva → contrato (cerrada)
  const reservaToContratoSamples: number[] = [];
  for (const s of allSales) {
    if (!s.fechaContrato) continue;
    if (!inRange(saleDateToISO(s.fechaContrato), range)) continue;
    const days = (new Date(s.fechaContrato).getTime() - new Date(s.fechaReserva).getTime()) / (24 * 60 * 60 * 1000);
    if (days >= 0 && days < 730) reservaToContratoSamples.push(days);
  }

  // contrato → escritura (terminada)
  const contratoToEscrituraSamples: number[] = [];
  for (const s of allSales) {
    if (!s.fechaEscritura || !s.fechaContrato) continue;
    if (!inRange(saleDateToISO(s.fechaEscritura), range)) continue;
    const days = (new Date(s.fechaEscritura).getTime() - new Date(s.fechaContrato).getTime()) / (24 * 60 * 60 * 1000);
    if (days >= 0 && days < 730) contratoToEscrituraSamples.push(days);
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    leadToVisit: avg(leadToVisitSamples),
    visitToReserva: avg(visitToReservaSamples),
    reservaToContrato: avg(reservaToContratoSamples),
    contratoToEscritura: avg(contratoToEscrituraSamples),
  };
}

/* ══════ Mix por nacionalidad ═════════════════════════════════════ */

function computeNationalityMix(
  allRegistros: Registro[],
  range: Range,
  selectedUserId: string | null,
): { label: string; iso?: string; count: number; pct: number }[] {
  const counts = new Map<string, { count: number; iso?: string }>();
  for (const r of allRegistros) {
    if (!inRange(r.fecha, range)) continue;
    if (selectedUserId && r.decidedByUserId !== selectedUserId) continue;
    const key = r.cliente.nacionalidad || "—";
    const incomingIso = r.cliente.nationalityIso ?? resolveNationality(r.cliente.nacionalidad).iso;
    const prev = counts.get(key) ?? { count: 0, iso: incomingIso };
    counts.set(key, { count: prev.count + 1, iso: prev.iso ?? incomingIso });
  }
  const total = Array.from(counts.values()).reduce((s, x) => s + x.count, 0);
  if (total === 0) return [];
  const sorted = Array.from(counts.entries())
    .map(([label, { count, iso }]) => ({ label, iso, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
  // top 5 + Otros
  if (sorted.length <= 5) return sorted;
  const top = sorted.slice(0, 5);
  const otros = sorted.slice(5).reduce((s, x) => s + x.count, 0);
  top.push({ label: "Otros", iso: undefined, count: otros, pct: (otros / total) * 100 });
  return top;
}

/* ══════ Heatmap día × hora ═══════════════════════════════════════ */

function computeHeatmap(events: BusinessActivityEvent[]): number[][] {
  // [day 0..6 (lun-dom)] × [hour 0..23]
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of events) {
    const d = new Date(e.at);
    if (Number.isNaN(d.getTime())) continue;
    const day = (d.getDay() + 6) % 7; // ISO lunes=0
    const hr = d.getHours();
    grid[day][hr] += 1;
  }
  return grid;
}

/* ══════ Salud del equipo ═════════════════════════════════════════ */

type TeamHealthRow = {
  memberId: string;
  name: string;
  avatarUrl: string;
  count: number;
  status: "hot" | "normal" | "cold";
};

function computeTeamHealth(events: BusinessActivityEvent[]): TeamHealthRow[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (!e.userId) continue;
    counts.set(e.userId, (counts.get(e.userId) ?? 0) + 1);
  }
  const activeMembers = getAllTeamMembers().filter((m) => !m.status || m.status === "active");
  const rows = activeMembers.map<TeamHealthRow>((m) => {
    const c = counts.get(m.id) ?? 0;
    return {
      memberId: m.id,
      name: m.name,
      avatarUrl: getMemberAvatarUrl(m),
      count: c,
      status: c === 0 ? "cold" : c >= 5 ? "hot" : "normal",
    };
  });
  return rows.sort((a, b) => b.count - a.count);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}

function formatDelta(current: number, previous: number): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (previous === 0 && current === 0) return { text: "—", tone: "neutral" };
  if (previous === 0) return { text: "nuevo", tone: "positive" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return { text: "±0%", tone: "neutral" };
  const sign = pct > 0 ? "+" : "";
  const tone = pct > 0 ? "positive" : "negative";
  return { text: `${sign}${Math.round(pct)}%`, tone };
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function Actividad() {
  const user = useCurrentUser();
  const isAgency = user.accountType === "agency";
  // CLAUDE.md · "Datos sensibles requieren permiso" — /actividad es
  // admin-only por defecto (pipeline €, ventas €, rankings cross-
  // tenant, juicios sobre miembros). Ver DEFAULT_ROLE_PERMISSIONS.
  const canView = useHasPermission("activity.dashboard.view");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [range, setRange] = useState<RangePreset>("30d");

  const createdRegs = useCreatedRegistros();
  const calEvents = useCalendarEvents();

  const allRegistros = useMemo(() => [...createdRegs, ...SEED_REGISTROS], [createdRegs]);
  const allSales = SEED_SALES;

  /* Rangos: actual + periodo anterior equivalente */
  const now = Date.now();
  const rangeCurrent = useMemo(() => rangeFromPreset(range, now), [range, now]);
  const rangePrevious = useMemo(() => previousRange(rangeCurrent), [rangeCurrent]);

  /* Métricas */
  const kpis = useMemo(
    () => computeKpis(allRegistros, calEvents, allSales, rangeCurrent, selectedUserId),
    [allRegistros, calEvents, allSales, rangeCurrent, selectedUserId],
  );
  const prevKpis = useMemo(
    () => computeKpis(allRegistros, calEvents, allSales, rangePrevious, selectedUserId),
    [allRegistros, calEvents, allSales, rangePrevious, selectedUserId],
  );

  const funnel = useMemo(
    () => computeFunnel(allRegistros, calEvents, allSales, rangeCurrent, selectedUserId),
    [allRegistros, calEvents, allSales, rangeCurrent, selectedUserId],
  );

  const velocity = useMemo(
    () => computeVelocity(allRegistros, calEvents, allSales, rangeCurrent),
    [allRegistros, calEvents, allSales, rangeCurrent],
  );

  const mix = useMemo(
    () => computeNationalityMix(allRegistros, rangeCurrent, selectedUserId),
    [allRegistros, rangeCurrent, selectedUserId],
  );

  /* Feed + heatmap + team health tiran del aggregator */
  const events = useBusinessActivity({
    userId: selectedUserId ?? undefined,
    from: new Date(rangeCurrent.from).toISOString(),
    to: new Date(rangeCurrent.to).toISOString(),
  });
  const heatmap = useMemo(() => computeHeatmap(events), [events]);
  const team = useMemo(() => computeTeamHealth(events), [events]);

  // Guard canónico: hooks llamados arriba, early-return aquí. El
  // patrón replica `ColaboracionPanel.tsx` (ver CLAUDE.md §"Datos
  // sensibles requieren permiso").
  if (!canView) {
    return (
      <div className="flex-1 flex flex-col min-h-full bg-background items-center justify-center px-4 py-12 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
        <h1 className="text-base font-semibold text-foreground mb-1">Sin acceso</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Este dashboard contiene datos sensibles de negocio: pipeline €, ventas
          cerradas, ranking de agencias, salud del equipo y análisis IA. Solo
          administradores y miembros con el permiso{" "}
          <code className="text-[11px] bg-muted px-1.5 rounded">activity.dashboard.view</code> pueden verlo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-content mx-auto flex items-start sm:items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              General
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight mt-1 leading-tight flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" strokeWidth={1.75} />
              Actividad
              <span className="text-muted-foreground font-medium text-sm sm:text-base"> · cómo va la empresa</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 hidden sm:block">
              KPIs, embudo y salud del pipeline · comparado con el periodo anterior.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {!isAgency && (
              <UserContextSwitcher
                selectedUserId={selectedUserId}
                onChange={setSelectedUserId}
              />
            )}
            <div className="inline-flex items-center gap-1 bg-muted/40 border border-border rounded-full p-0.5 text-xs">
              {RANGE_PRESETS.map((p) => {
                const active = range === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => setRange(p.value)}
                    className={cn(
                      "px-3 h-9 rounded-full transition-colors",
                      active
                        ? "bg-background text-foreground font-medium shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-3 sm:px-6 lg:px-8 mt-6 pb-10">
        <div className="max-w-content mx-auto space-y-5">
          <KpiRow6 current={kpis} previous={prevKpis} />
          <FunnelPanel funnel={funnel} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <ActivityByDayChart events={events} range={range} />
            <VentasPorMesChart events={events} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <VelocityPanel velocity={velocity} />
            <NationalityDonut mix={mix} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <HeatmapPanel grid={heatmap} />
            <TeamHealthPanel rows={team} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <TopMembers events={events} />
            <TopPromotions events={events} />
            <TopAgencias events={events} />
          </div>
          <RecentFeed events={events} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BLOQUES DE UI
   ══════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────
   KPIs con delta vs periodo anterior
   ──────────────────────────────────────────────────────────────── */

function KpiRow6({ current, previous }: { current: Kpis; previous: Kpis }) {
  const pipelineTotal = current.pipelineCierreEur + current.pipelineCobroEur;
  const items: {
    icon: LucideIcon; label: string; value: string; sub?: string;
    delta: ReturnType<typeof formatDelta>; iconBg: string; iconColor: string;
  }[] = [
    {
      icon: CircleDollarSign,
      label: "Pipeline abierto",
      value: EUR_COMPACT.format(pipelineTotal),
      sub: `${EUR_COMPACT.format(current.pipelineCierreEur)} cierre · ${EUR_COMPACT.format(current.pipelineCobroEur)} cobro`,
      delta: { text: "stock", tone: "neutral" },
      iconBg: "bg-emerald-50", iconColor: "text-emerald-700",
    },
    {
      // CLAUDE.md · venta cerrada (contrato) = hito comercial.
      // terminadas (escritura) se muestra en el sub para no inflar el row.
      icon: TrendingUp,
      label: "Ventas cerradas",
      value: EUR_COMPACT.format(current.ventasCerradasEur),
      sub: `${current.ventasCerradasCount} contrato${current.ventasCerradasCount === 1 ? "" : "s"} · ${current.ventasTerminadasCount} terminada${current.ventasTerminadasCount === 1 ? "" : "s"} (${EUR_COMPACT.format(current.ventasTerminadasEur)})`,
      delta: formatDelta(current.ventasCerradasEur, previous.ventasCerradasEur),
      iconBg: "bg-primary/10", iconColor: "text-primary",
    },
    {
      icon: Home,
      label: "Visitas realizadas",
      value: String(current.visitas),
      sub: "Con evaluación o cerradas",
      delta: formatDelta(current.visitas, previous.visitas),
      iconBg: "bg-violet-500/10", iconColor: "text-violet-600",
    },
    {
      icon: Clock,
      label: "Tiempo de respuesta",
      value: current.avgResponseMin === null ? "—" : formatDuration(current.avgResponseMin),
      sub: "Medio en decidir registros",
      delta: previous.avgResponseMin !== null && current.avgResponseMin !== null
        ? invertDelta(formatDelta(current.avgResponseMin, previous.avgResponseMin))
        : { text: "—", tone: "neutral" },
      iconBg: "bg-warning/10", iconColor: "text-warning",
    },
    {
      icon: Gauge,
      label: "Conversión lead → visita",
      value: `${current.conversionPct}%`,
      sub: `${current.visitas} visitas · ${current.nuevosLeads} leads`,
      delta: formatDelta(current.conversionPct, previous.conversionPct),
      iconBg: "bg-sky-100", iconColor: "text-sky-700",
    },
    {
      icon: FileText,
      label: "Nuevos leads",
      value: String(current.nuevosLeads),
      sub: "Registros entrantes",
      delta: formatDelta(current.nuevosLeads, previous.nuevosLeads),
      iconBg: "bg-amber-100", iconColor: "text-amber-700",
    },
  ];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
      {items.map((k) => {
        const Icon = k.icon;
        const DeltaIcon = k.delta.tone === "positive" ? TrendingUp : k.delta.tone === "negative" ? TrendingDown : null;
        return (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-4 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between mb-3">
              <div className={cn("h-8 w-8 rounded-xl grid place-items-center", k.iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", k.iconColor)} strokeWidth={1.75} />
              </div>
              {k.delta.tone !== "neutral" && (
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums inline-flex items-center gap-0.5",
                  k.delta.tone === "positive" && "text-emerald-700",
                  k.delta.tone === "negative" && "text-destructive",
                )}>
                  {DeltaIcon && <DeltaIcon className="h-2.5 w-2.5" strokeWidth={2} />}
                  {k.delta.text}
                </span>
              )}
            </div>
            <p className="text-[9.5px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{k.label}</p>
            <p className="text-[20px] sm:text-[22px] font-bold leading-none tabular-nums tracking-tight mt-1.5">
              {k.value}
            </p>
            {k.sub && (
              <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug line-clamp-2">{k.sub}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Invierte la semántica del delta: más minutos de respuesta = peor. */
function invertDelta(d: ReturnType<typeof formatDelta>): ReturnType<typeof formatDelta> {
  if (d.tone === "positive") return { ...d, tone: "negative" };
  if (d.tone === "negative") return { ...d, tone: "positive" };
  return d;
}

/* ──────────────────────────────────────────────────────────────────
   Embudo · 5 pasos con % de caída
   ──────────────────────────────────────────────────────────────── */

function FunnelPanel({ funnel }: { funnel: Funnel }) {
  // CLAUDE.md · embudo de 6 pasos: leads → aprobados → visitas →
  // reservas → cerradas (contrato) → terminadas (escritura).
  const steps: { label: string; count: number; color: string; icon: LucideIcon }[] = [
    { label: "Nuevos leads",         count: funnel.leads,      color: "bg-amber-500",    icon: FileText },
    { label: "Registros aprobados",  count: funnel.aprobados,  color: "bg-orange-500",   icon: FileText },
    { label: "Visitas realizadas",   count: funnel.visitas,    color: "bg-violet-500",   icon: Home },
    { label: "Reservas",             count: funnel.reservas,   color: "bg-sky-500",      icon: Timer },
    { label: "Cerradas (contrato)",  count: funnel.cerradas,   color: "bg-primary",      icon: FileText },
    { label: "Terminadas (escrit.)", count: funnel.terminadas, color: "bg-emerald-500",  icon: CircleDollarSign },
  ];
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
      <header className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PieChart className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            Embudo de conversión
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Lead → visita → reserva → contrato (cerrada) → escritura (terminada)
          </p>
        </div>
        {funnel.leads > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            Conv. global {Math.round((funnel.terminadas / funnel.leads) * 100)}%
          </span>
        )}
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const widthPct = (s.count / max) * 100;
          const dropPct = i > 0 && steps[i - 1].count > 0
            ? Math.round((s.count / steps[i - 1].count) * 100)
            : null;
          return (
            <div key={s.label} className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.75} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {s.label}
                </p>
              </div>
              <p className="text-[24px] sm:text-[28px] font-bold leading-none tabular-nums tracking-tight">
                {s.count}
              </p>
              {/* Barra proporcional */}
              <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", s.color)}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {/* % retención */}
              {dropPct !== null ? (
                <p className={cn(
                  "text-[10px] mt-1.5 tabular-nums",
                  dropPct >= 40 ? "text-emerald-700" : dropPct >= 15 ? "text-warning" : "text-destructive",
                )}>
                  {dropPct}% pasa desde el paso previo
                </p>
              ) : (
                <p className="text-[10px] mt-1.5 text-muted-foreground">Punto de entrada</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Actividad por día/semana/mes
   ──────────────────────────────────────────────────────────────── */

type Bucket = { key: string; label: string; counts: Partial<Record<BusinessActivityKind, number>>; amount?: number };

function buildBuckets(
  events: BusinessActivityEvent[],
  range: RangePreset,
): { unit: "día" | "semana" | "mes"; items: Bucket[] } {
  const now = new Date();
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const items: Bucket[] = [];
    const map = new Map<string, Bucket>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const label = days <= 7
        ? d.toLocaleDateString("es-ES", { weekday: "short" })
        : d.toLocaleDateString("es-ES", { day: "numeric" });
      const b: Bucket = { key, label, counts: {}, amount: 0 };
      items.push(b);
      map.set(key, b);
    }
    for (const e of events) {
      const key = e.at.slice(0, 10);
      const b = map.get(key);
      if (!b) continue;
      b.counts[e.kind] = (b.counts[e.kind] ?? 0) + 1;
      if (e.kind === "sale" && e.subtype === "escriturada") b.amount! += e.amount ?? 0;
    }
    return { unit: "día", items };
  }
  if (range === "90d") {
    const items: Bucket[] = [];
    const map = new Map<string, Bucket>();
    const start = startOfWeek(now);
    start.setDate(start.getDate() - 12 * 7);
    for (let i = 0; i < 13; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 7);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const b: Bucket = { key, label, counts: {}, amount: 0 };
      items.push(b); map.set(key, b);
    }
    for (const e of events) {
      const d = new Date(e.at);
      const sow = startOfWeek(d);
      const key = sow.toISOString().slice(0, 10);
      const b = map.get(key); if (!b) continue;
      b.counts[e.kind] = (b.counts[e.kind] ?? 0) + 1;
      if (e.kind === "sale" && e.subtype === "escriturada") b.amount! += e.amount ?? 0;
    }
    return { unit: "semana", items };
  }
  const items: Bucket[] = [];
  const map = new Map<string, Bucket>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-ES", { month: "short" });
    const b: Bucket = { key, label, counts: {}, amount: 0 };
    items.push(b); map.set(key, b);
  }
  for (const e of events) {
    const d = new Date(e.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = map.get(key); if (!b) continue;
    b.counts[e.kind] = (b.counts[e.kind] ?? 0) + 1;
    if (e.kind === "sale" && e.subtype === "escriturada") b.amount! += e.amount ?? 0;
  }
  return { unit: "mes", items };
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function ActivityByDayChart({ events, range }: { events: BusinessActivityEvent[]; range: RangePreset }) {
  const buckets = useMemo(() => buildBuckets(events, range), [events, range]);
  const kinds: BusinessActivityKind[] = ["sale", "visit", "call", "meeting", "registro"];
  const max = Math.max(1, ...buckets.items.map((b) => kinds.reduce((s, k) => s + (b.counts[k] ?? 0), 0)));
  const total = buckets.items.reduce((s, b) => s + kinds.reduce((a, k) => a + (b.counts[k] ?? 0), 0), 0);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] lg:col-span-2 overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            Actividad por {buckets.unit}
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
            {total} eventos · {buckets.items.length} {buckets.unit === "día" ? "días" : buckets.unit === "semana" ? "semanas" : "meses"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {kinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </header>
      <div className="px-4 sm:px-5 py-5">
        <StackedBars buckets={buckets.items} kinds={kinds} max={max} />
      </div>
    </section>
  );
}

function StackedBars({ buckets, kinds, max }: { buckets: Bucket[]; kinds: BusinessActivityKind[]; max: number }) {
  return (
    <div className="flex items-end gap-1 h-40 w-full">
      {buckets.map((b) => {
        const total = kinds.reduce((s, k) => s + (b.counts[k] ?? 0), 0);
        const heightPct = (total / max) * 100;
        return (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
            <div className="w-full h-full flex flex-col justify-end">
              <div
                className="w-full rounded-t-md flex flex-col-reverse overflow-hidden transition-opacity group-hover:opacity-90"
                style={{ height: `${heightPct}%`, minHeight: total > 0 ? 2 : 0 }}
              >
                {kinds.map((k) => {
                  const c = b.counts[k] ?? 0;
                  if (c === 0) return null;
                  const h = (c / total) * 100;
                  return <div key={k} style={{ background: KIND_COLOR[k], height: `${h}%` }} />;
                })}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums truncate max-w-full">{b.label}</span>
            <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block z-10 bg-foreground text-background text-[10px] rounded-md px-2 py-1.5 whitespace-nowrap shadow-lg">
              <div className="font-semibold mb-0.5">{b.label} · {total}</div>
              {kinds.map((k) => {
                const c = b.counts[k] ?? 0;
                if (c === 0) return null;
                return <div key={k}>{KIND_LABEL[k]}: {c}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Ventas € por mes
   ──────────────────────────────────────────────────────────────── */

function VentasPorMesChart({ events }: { events: BusinessActivityEvent[] }) {
  const buckets = useMemo(() => {
    const now = new Date();
    const items: { key: string; label: string; amount: number; count: number }[] = [];
    const map = new Map<string, typeof items[number]>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-ES", { month: "short" });
      const b = { key, label, amount: 0, count: 0 };
      items.push(b); map.set(key, b);
    }
    for (const e of events) {
      // CLAUDE.md · "ventas cerradas por mes" cuenta el hito de cierre
      // (contrato firmado), no la escritura. La escritura es otro evento.
      if (e.kind !== "sale" || e.subtype !== "contratada") continue;
      const d = new Date(e.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = map.get(key); if (!b) continue;
      b.amount += e.amount ?? 0;
      b.count += 1;
    }
    return items;
  }, [events]);

  const max = Math.max(1, ...buckets.map((b) => b.amount));
  const totalAmount = buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CircleDollarSign className="h-3.5 w-3.5 text-emerald-700" strokeWidth={1.75} />
          Ventas cerradas · 6 meses
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
          {EUR0.format(totalAmount)} en contratos firmados
        </p>
      </header>
      <div className="px-4 sm:px-5 py-5">
        {totalAmount === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-8">Sin ventas cerradas en este rango.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {buckets.map((b) => {
              const pct = (b.amount / max) * 100;
              return (
                <div key={b.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full h-full flex flex-col justify-end relative">
                    {b.count > 0 && (
                      <span className="text-[9px] font-semibold text-foreground text-center mb-0.5 tabular-nums">
                        {EUR_COMPACT.format(b.amount)}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-md bg-emerald-500/80 hover:bg-emerald-500 transition-colors"
                      style={{ height: `${pct}%`, minHeight: b.amount > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{b.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Velocidad de cierre · 3 mini KPIs
   ──────────────────────────────────────────────────────────────── */

function VelocityPanel({ velocity }: { velocity: Velocity }) {
  const fmt = (n: number | null) => n === null ? "—" : `${n} d`;
  // CLAUDE.md · 4 hitos: lead → visita → reserva → cerrada (contrato)
  // → terminada (escritura). Cada transición = un mini KPI.
  const rows: { label: string; value: string; hint: string }[] = [
    { label: "Lead → Visita",      value: fmt(velocity.leadToVisit),         hint: "Desde el lead hasta visita" },
    { label: "Visita → Reserva",   value: fmt(velocity.visitToReserva),      hint: "Desde visita hasta señal" },
    { label: "Reserva → Cerrada",  value: fmt(velocity.reservaToContrato),   hint: "Señal hasta contrato privado" },
    { label: "Cerrada → Terminada",value: fmt(velocity.contratoToEscritura), hint: "Contrato hasta escritura/cobro" },
  ];
  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden lg:col-span-2">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          Velocidad del pipeline
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">Días medios entre hitos · lead → terminada</p>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-border/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{r.label}</p>
            <p className="text-[22px] sm:text-[26px] font-bold tabular-nums mt-1 leading-none">{r.value}</p>
            <p className="text-[10.5px] text-muted-foreground mt-1.5 leading-snug">{r.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Mix nacionalidad · donut SVG
   ──────────────────────────────────────────────────────────────── */

function NationalityDonut({ mix }: { mix: { label: string; iso?: string; count: number; pct: number }[] }) {
  const colors = [
    "hsl(var(--primary))", "hsl(260 60% 55%)", "hsl(38 92% 50%)",
    "hsl(142 71% 45%)", "hsl(220 70% 50%)", "hsl(0 70% 55%)",
  ];
  const total = mix.reduce((s, x) => s + x.count, 0);

  // Generar segmentos del donut
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const segments = mix.map((m, i) => {
    const len = (m.pct / 100) * circ;
    const seg = {
      color: colors[i % colors.length],
      dash: `${len} ${circ - len}`,
      offset: -offset,
      ...m,
    };
    offset += len;
    return seg;
  });

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          Mix por nacionalidad
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">{total} leads entrantes</p>
      </header>
      <div className="p-4 sm:p-5">
        {total === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-8">Sin datos en este rango.</p>
        ) : (
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" width="112" height="112" className="shrink-0">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
              {segments.map((s, i) => (
                <circle
                  key={i}
                  cx="50" cy="50" r={radius}
                  fill="none" stroke={s.color} strokeWidth="14"
                  strokeDasharray={s.dash} strokeDashoffset={s.offset}
                  transform="rotate(-90 50 50)"
                />
              ))}
              <text x="50" y="54" textAnchor="middle" className="fill-foreground text-[14px] font-bold tabular-nums">
                {total}
              </text>
            </svg>
            <ul className="flex-1 min-w-0 space-y-1.5">
              {segments.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-[11.5px]">
                  <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="truncate flex-1 inline-flex items-center gap-1.5">
                    {s.iso && <Flag iso={s.iso} size={12} />}
                    {s.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0">{Math.round(s.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Heatmap día × hora
   ──────────────────────────────────────────────────────────────── */

function HeatmapPanel({ grid }: { grid: number[][] }) {
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((s, x) => s + x, 0);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden lg:col-span-2">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />
          Heatmap · cuándo pasa la actividad
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">{total} eventos por día × hora · intensidad proporcional</p>
      </header>
      <div className="p-4 sm:p-5 overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Cabecera horas */}
          <div className="flex items-center gap-0.5 pl-5 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <span key={h} className="text-[8px] text-muted-foreground tabular-nums" style={{ width: 16 }}>
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
          {grid.map((row, d) => (
            <div key={d} className="flex items-center gap-0.5 mb-0.5">
              <span className="text-[9px] text-muted-foreground font-semibold w-4 tabular-nums">{days[d]}</span>
              <div className="w-1" />
              {row.map((v, h) => {
                const intensity = v === 0 ? 0 : 0.15 + (v / max) * 0.85;
                return (
                  <div
                    key={h}
                    title={v > 0 ? `${days[d]} · ${h}:00 → ${v} evento${v === 1 ? "" : "s"}` : undefined}
                    className="h-4 w-4 rounded-sm shrink-0"
                    style={{ background: v === 0 ? "hsl(var(--muted))" : `hsla(var(--primary), ${intensity})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Salud del equipo
   ──────────────────────────────────────────────────────────────── */

function TeamHealthPanel({ rows }: { rows: TeamHealthRow[] }) {
  const hot = rows.filter((r) => r.status === "hot").length;
  const cold = rows.filter((r) => r.status === "cold").length;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          Salud del equipo
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
          {hot} caliente{hot === 1 ? "" : "s"} · {cold} frío{cold === 1 ? "" : "s"}
        </p>
      </header>
      <ul className="divide-y divide-border/40 max-h-[340px] overflow-y-auto">
        {rows.map((r) => {
          const pct = (r.count / max) * 100;
          const statusChip = r.status === "hot"
            ? { icon: Flame, label: "hot", class: "bg-warning/10 text-warning" }
            : r.status === "cold"
              ? { icon: Snowflake, label: "frío", class: "bg-sky-100 text-sky-700" }
              : null;
          const SIcon = statusChip?.icon;
          return (
            <li key={r.memberId}>
              <Link
                to={`/equipo/${r.memberId}/estadisticas`}
                className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <img src={r.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{r.name}</p>
                    {statusChip && SIcon && (
                      <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold uppercase tracking-wider", statusChip.class)}>
                        <SIcon className="h-2.5 w-2.5" strokeWidth={2} />
                        {statusChip.label}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div
                      className={cn(
                        "h-full",
                        r.status === "hot" ? "bg-warning" : r.status === "cold" ? "bg-sky-400" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[11.5px] font-semibold tabular-nums shrink-0">{r.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Rankings (miembros · promociones · agencias)
   ──────────────────────────────────────────────────────────────── */

function TopMembers({ events }: { events: BusinessActivityEvent[] }) {
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.userId) continue;
      counts.set(e.userId, (counts.get(e.userId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count, member: findTeamMember(id) }))
      .filter((r) => r.member)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [events]);
  const max = Math.max(1, ...ranking.map((r) => r.count));

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          Top miembros
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">Por número de actividades</p>
      </header>
      {ranking.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-8">Sin datos.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {ranking.map((r, i) => {
            const pct = (r.count / max) * 100;
            const m = r.member!;
            const avatar = getMemberAvatarUrl(m);
            return (
              <li key={r.id}>
                <Link
                  to={`/equipo/${m.id}/estadisticas`}
                  className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                  {avatar ? (
                    <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] font-bold shrink-0">
                      {memberInitials(m)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{m.name}</p>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11.5px] font-semibold tabular-nums shrink-0">{r.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TopPromotions({ events }: { events: BusinessActivityEvent[] }) {
  const ranking = useMemo(() => {
    const stats = new Map<string, { ventas: number; visitas: number; volumen: number }>();
    for (const e of events) {
      const pid = e.meta?.promotionId;
      if (!pid) continue;
      const s = stats.get(pid) ?? { ventas: 0, visitas: 0, volumen: 0 };
      // CLAUDE.md · ventas CERRADAS = contrato firmado (hito comercial)
      if (e.kind === "sale" && e.subtype === "contratada") { s.ventas += 1; s.volumen += e.amount ?? 0; }
      else if (e.kind === "visit") s.visitas += 1;
      stats.set(pid, s);
    }
    return Array.from(stats.entries())
      .map(([id, s]) => {
        const promo = developerOnlyPromotions.find((p) => p.id === id);
        return promo ? { id, promo, ...s, score: s.ventas * 3 + s.visitas } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [events]);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
          Top promociones
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">Ventas × 3 + visitas</p>
      </header>
      {ranking.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-8">Sin datos.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {ranking.map((r, i) => (
            <li key={r.id}>
              <Link to={promotionHrefById(r.id)} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/30 transition-colors">
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{r.promo.name}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate tabular-nums">
                    {r.ventas} venta{r.ventas === 1 ? "" : "s"} · {r.visitas} visita{r.visitas === 1 ? "" : "s"}
                  </p>
                </div>
                {r.volumen > 0 && (
                  <span className="text-[11px] font-semibold text-emerald-700 tabular-nums shrink-0">
                    {EUR_COMPACT.format(r.volumen)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopAgencias({ events }: { events: BusinessActivityEvent[] }) {
  const byRegistros = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.kind !== "registro") continue;
      if (!e.agencyId) continue;
      counts.set(e.agencyId, (counts.get(e.agencyId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const ag = SEED_AGENCIES.find((a) => a.id === id);
        return ag ? { id, count, ag } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [events]);

  const byVentas = useMemo(() => {
    const stats = new Map<string, { count: number; amount: number }>();
    for (const e of events) {
      // CLAUDE.md · venta cerrada = contrato firmado
      if (e.kind !== "sale" || e.subtype !== "contratada") continue;
      if (!e.agencyId) continue;
      const s = stats.get(e.agencyId) ?? { count: 0, amount: 0 };
      s.count += 1; s.amount += e.amount ?? 0;
      stats.set(e.agencyId, s);
    }
    return Array.from(stats.entries())
      .map(([id, s]) => {
        const ag = SEED_AGENCIES.find((a) => a.id === id);
        return ag ? { id, ...s, ag } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [events]);

  const [tab, setTab] = useState<"reg" | "ven">("reg");
  const list = tab === "reg" ? byRegistros : byVentas;

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Handshake className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            Top agencias
          </h3>
          <div className="inline-flex items-center gap-0.5 bg-muted/50 rounded-full p-0.5">
            <button
              onClick={() => setTab("reg")}
              className={cn(
                "px-2 h-6 rounded-full text-[10.5px] font-medium transition-colors",
                tab === "reg" ? "bg-background text-foreground shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)]" : "text-muted-foreground",
              )}
            >
              Registros
            </button>
            <button
              onClick={() => setTab("ven")}
              className={cn(
                "px-2 h-6 rounded-full text-[10.5px] font-medium transition-colors",
                tab === "ven" ? "bg-background text-foreground shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)]" : "text-muted-foreground",
              )}
            >
              Ventas €
            </button>
          </div>
        </div>
      </header>
      {list.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-8">Sin datos.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {list.map((r, i) => (
            <li key={r.id}>
              <Link to={agencyHref(r.ag)} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/30 transition-colors">
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                {r.ag.logo ? (
                  <img src={r.ag.logo} alt="" className="h-7 w-7 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-muted grid place-items-center text-[10px] font-bold shrink-0">
                    {r.ag.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{r.ag.name}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{r.ag.location}</p>
                </div>
                {tab === "reg" ? (
                  <span className="text-[11.5px] font-semibold tabular-nums shrink-0">{(r as { count: number }).count}</span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-700 tabular-nums shrink-0">
                    {EUR_COMPACT.format((r as { amount: number }).amount)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Feed colapsable
   ──────────────────────────────────────────────────────────────── */

function RecentFeed({ events }: { events: BusinessActivityEvent[] }) {
  const [open, setOpen] = useState(false);
  const items = events.slice(0, open ? 20 : 8);
  const hasMore = events.length > 8;

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            Últimos movimientos
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
            {events.length} en el rango · últim{events.length === 1 ? "o" : "os"} {items.length} visibles
          </p>
        </div>
        {hasMore && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {open ? "Ver menos" : "Ver más"} {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-8">Sin movimientos.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((ev) => {
            const Icon = ev.icon;
            const member = ev.userId ? findTeamMember(ev.userId) : undefined;
            const when = new Date(ev.at);
            const now = Date.now();
            const diffH = (now - when.getTime()) / (1000 * 60 * 60);
            const rel = diffH < 1 ? "hace unos min"
              : diffH < 24 ? `hace ${Math.floor(diffH)}h`
              : diffH < 24 * 7 ? `hace ${Math.floor(diffH / 24)}d`
              : when.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
            const content = (
              <div className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", TONE_BG[ev.tone])}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground leading-snug line-clamp-1">{ev.title}</p>
                  {ev.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{ev.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10.5px] text-muted-foreground tabular-nums">{rel}</p>
                  {member && (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{member.name.split(" ")[0]}</p>
                  )}
                </div>
                {ev.href && <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" strokeWidth={1.75} />}
              </div>
            );
            return <li key={ev.id}>{ev.href ? <Link to={ev.href}>{content}</Link> : content}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
