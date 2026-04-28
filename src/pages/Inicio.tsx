/**
 * Inicio · dashboard operativo · "qué tengo que hacer hoy".
 *
 * Los KPIs + gráficos + rankings se movieron a `/estadisticas`
 * (página separada) porque el foco de la home es lo accionable:
 *
 *   - **Actividades** · pendientes de hoy o vencidas: registros
 *     por aprobar, visitas por confirmar, llamadas, emails pendientes
 *     de respuesta, whatsapps sin leer, tareas.
 *   - **Agenda de hoy** · widget del calendario real.
 *   - **Novedades** · nuevos comercializadores, nuevas agencias y
 *     última unidad en venta por promoción.
 *
 * Cada bloque enlaza a su pantalla para profundizar.
 *
 * Los agentes ven el mismo dashboard; las agencias tienen su propia
 * home (`AgencyHome`).
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, FileText, Home, Phone, Mail, MessageSquare,
  CheckSquare, Sparkles, ArrowUpRight, TrendingUp, Handshake,
  Building2, UserPlus, AlertCircle, Users, BarChart3, Activity,
} from "lucide-react";
import { UserContextSwitcher } from "@/components/ui/UserContextSwitcher";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import AgencyHome from "./AgencyHome";
import { useCalendarEvents } from "@/lib/calendarStorage";
import {
  eventTypeConfig,
  type CalendarEvent,
} from "@/data/calendarEvents";
import { eventsInDay, formatTime, isToday as isTodayDate } from "@/lib/calendarHelpers";
import { registros } from "@/data/records";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { getAllTeamMembers, memberInitials, getMemberAvatarUrl, findTeamMember } from "@/lib/team";
import { useBusinessActivity } from "@/lib/businessActivity";

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function Inicio() {
  const user = useCurrentUser();
  if (user.accountType === "agency") {
    return <AgencyHome />;
  }

  /* Contexto del dashboard · quién se está mirando. null = todo el
     equipo. El selector vive en el header (desktop y mobile) y filtra
     las Actividades y la Agenda de hoy. */
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-content mx-auto flex items-start sm:items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              General
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight mt-1 leading-tight">
              Hola, {user.name.split(" ")[0]}
              <span className="text-muted-foreground font-medium"> · qué tienes hoy</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 hidden sm:block">
              Actividades pendientes, agenda y novedades del equipo.
            </p>
          </div>
          {/* Acciones arriba-derecha · selector usuario + estadísticas */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <UserContextSwitcher
              selectedUserId={selectedUserId}
              onChange={setSelectedUserId}
            />
            <Link
              to="/estadisticas"
              title="Ver estadísticas"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 sm:px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors shrink-0"
            >
              <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Estadísticas</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Contenido · 2 cols en desktop */}
      <div className="px-3 sm:px-6 lg:px-8 mt-6 pb-10">
        <div className="max-w-content mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-5">
          <div className="space-y-4 sm:space-y-5 min-w-0">
            <ActividadesPendientes selectedUserId={selectedUserId} />
            <Novedades />
          </div>
          <aside className="space-y-4 sm:space-y-5 min-w-0">
            <TodayAgendaWidget selectedUserId={selectedUserId} />
            <RecentActivityWidget selectedUserId={selectedUserId} />
            <QuickActions />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* UserContextSwitcher · extraído a componente reutilizable en
   `@/components/ui/UserContextSwitcher` · lo usa también /calendario. */

/* ═══════════════════════════════════════════════════════════════════
   ACTIVIDADES PENDIENTES · vista agregada por tipo.
   ───────────────────────────────────────────────────────────────────
   Una card grande por cada categoría con el contador total y una
   línea de preview (los 1-2 items más urgentes). Click en la card
   navega a la pantalla de esa categoría.
   ═══════════════════════════════════════════════════════════════════ */

type ActivityKind = "registro" | "visita" | "llamada" | "email" | "whatsapp" | "tarea";

type ActivitySummary = {
  kind: ActivityKind;
  icon: LucideIcon;
  label: string;
  count: number;
  urgent?: number;     // subconjunto urgente (vencidos, destructivos)
  preview?: string;    // 1 línea con lo más relevante
  href: string;
  tone: "primary" | "warning" | "success" | "destructive" | "default";
};

function ActividadesPendientes({ selectedUserId }: { selectedUserId: string | null }) {
  const allEvents = useCalendarEvents();
  const teamMembers = useMemo(
    () => getAllTeamMembers().filter((m) => !m.status || m.status === "active"),
    [],
  );

  const summaries = useMemo<ActivitySummary[]>(() => {
    const today = new Date();
    const byUser = (ev: CalendarEvent) =>
      !selectedUserId || ev.assigneeUserId === selectedUserId;

    /* Registros pendientes · son cola compartida del promotor · no
       tienen assigneeUserId natural hasta que se decide. Si filtro
       por usuario, muestro sólo los que YA están siendo trabajados
       por ese usuario (decidedByUserId) · si no hay filtro, todos. */
    const regs = registros.filter((r) => {
      if (r.estado !== "pendiente") return false;
      if (!selectedUserId) return true;
      return r.decidedByUserId === selectedUserId;
    });
    const regsDup = regs.filter((r) => r.matchPercentage >= 70).length;

    /* Visitas pending + sin evaluar (filtradas por usuario). */
    const vPending = allEvents.filter(
      (ev) => ev.type === "visit" && ev.status === "pending-confirmation" && byUser(ev),
    );
    const vNoEval = allEvents.filter(
      (ev) => ev.type === "visit" && ev.status === "done" && !(ev as any).evaluation && byUser(ev),
    );
    const visitasTotal = vPending.length + vNoEval.length;

    /* Llamadas de hoy pendientes (filtradas por usuario). */
    const calls = eventsInDay(allEvents, today).filter(
      (ev) => ev.type === "call" && ev.status !== "cancelled" && ev.status !== "done" && byUser(ev),
    );

    /* Mock counts · cuando llegue el backend, estos vendrán filtrados
       por ownership real (assignedTo = selectedUserId || currentUser.id).
       Hoy no dividimos por miembros porque era matemática falsa — ver
       discusión de incoherencias Inicio↔Actividad (abril 2026). */
    const emails = 4;
    const whatsapps = 2;
    const tareasTotal = 3;
    const tareasVencidas = 1;

    return [
      {
        // CLAUDE.md · desambiguación Inicio vs Actividad:
        //   Inicio = "pendientes" (backlog) · Actividad = throughput
        kind: "registro", icon: FileText, label: "Registros pendientes",
        count: regs.length, urgent: regsDup,
        preview: regs.length > 0
          ? `${regs[0].cliente.nombre}${regs.length > 1 ? ` · +${regs.length - 1} más` : ""}`
          : "Todo al día",
        href: "/registros",
        tone: regsDup > 0 ? "destructive" : regs.length > 0 ? "warning" : "default",
      },
      {
        kind: "visita", icon: Home, label: "Visitas por gestionar",
        count: visitasTotal,
        urgent: vPending.length,
        preview: visitasTotal > 0
          ? `${vPending.length > 0 ? `${vPending.length} por confirmar` : ""}${vPending.length > 0 && vNoEval.length > 0 ? " · " : ""}${vNoEval.length > 0 ? `${vNoEval.length} por evaluar` : ""}`
          : "Nada pendiente",
        href: "/calendario",
        tone: visitasTotal > 0 ? "warning" : "default",
      },
      {
        kind: "llamada", icon: Phone, label: "Llamadas",
        count: calls.length,
        preview: calls.length > 0
          ? calls.slice(0, 2).map((c) => `${formatTime(c.start)} ${c.contactName ?? ""}`).join(" · ")
          : "Sin llamadas hoy",
        href: "/calendario",
        tone: calls.length > 0 ? "primary" : "default",
      },
      {
        kind: "email", icon: Mail, label: "Emails",
        count: emails,
        preview: "Ahmed Al Rashid · Marie Dubois · +2 más",
        href: "/emails",
        tone: emails > 0 ? "primary" : "default",
      },
      {
        kind: "whatsapp", icon: MessageSquare, label: "WhatsApps",
        count: whatsapps,
        preview: "Marie Dubois · Emma Johnson",
        href: "/contactos",
        tone: whatsapps > 0 ? "success" : "default",
      },
      {
        kind: "tarea", icon: CheckSquare, label: "Tareas",
        count: tareasTotal, urgent: tareasVencidas,
        preview: tareasVencidas > 0 ? `${tareasVencidas} vencida · ${tareasTotal - tareasVencidas} hoy` : `${tareasTotal} para hoy`,
        href: "/calendario",
        tone: tareasVencidas > 0 ? "destructive" : "primary",
      },
    ];
  }, [allEvents, selectedUserId]);

  const totalAll = summaries.reduce((s, x) => s + x.count, 0);
  const selectedMember = selectedUserId
    ? teamMembers.find((m) => m.id === selectedUserId)
    : null;

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={1.75} />
            Actividades pendientes
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
            {totalAll} en total · {selectedMember ? selectedMember.name.split(" ")[0] : "todo el equipo"}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 sm:p-4">
        {summaries.map((s) => {
          const Icon = s.icon;
          const toneClass = {
            default:     "bg-card border-border text-muted-foreground",
            primary:     "bg-primary/5 border-primary/20 text-primary",
            warning:     "bg-warning/10 border-warning/30 text-warning",
            success:     "bg-emerald-50 border-emerald-200 text-emerald-800",
            destructive: "bg-destructive/5 border-destructive/20 text-destructive",
          }[s.tone];
          return (
            <Link
              key={s.kind}
              to={s.href}
              className={cn(
                "rounded-xl border p-3 sm:p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-soft-lg group",
                toneClass,
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-4 w-4 opacity-80" strokeWidth={1.75} />
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" strokeWidth={1.75} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[24px] sm:text-[28px] font-bold tabular-nums leading-none">{s.count}</span>
                {s.urgent ? (
                  <span className="text-[10px] font-semibold tabular-nums opacity-80">
                    · {s.urgent} urgente{s.urgent === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70 mt-1.5">
                {s.label}
              </p>
              {s.preview && (
                <p className="text-[11px] opacity-80 mt-1 leading-snug line-clamp-2">
                  {s.preview}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NOVEDADES · nuevos comercializadores + nuevas agencias + última
   unidad en venta por promoción.
   ═══════════════════════════════════════════════════════════════════ */
function Novedades() {
  /* Detección "última unidad en venta" por promoción: cuando
     availableUnits === 1 · lista las ≤3 primeras. */
  const lastUnitPromos = useMemo(() => {
    return developerOnlyPromotions
      .filter((p) => p.availableUnits === 1)
      .slice(0, 3);
  }, []);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.75} />
            Novedades del equipo y del catálogo
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Últimas semanas.
          </p>
        </div>
      </header>
      <ul className="divide-y divide-border/40">
        {/* Mock: nuevos comercializadores */}
        <li className="flex items-start gap-3 px-4 sm:px-5 py-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-foreground">
              Nuevos comercializadores del equipo
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Laura Sánchez · Pedro Sánchez · Ana Martín. Incorporados este mes.
            </p>
          </div>
          <Link
            to="/equipo"
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0 mt-1"
          >
            Ver <ArrowUpRight className="h-3 w-3" />
          </Link>
        </li>

        {/* Mock: nuevas agencias */}
        <li className="flex items-start gap-3 px-4 sm:px-5 py-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center shrink-0">
            <Handshake className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-foreground">
              2 nuevas agencias colaboradoras
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Prime Properties · Nordic Real Estate. Activas desde abril.
            </p>
          </div>
          <Link
            to="/colaboradores"
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0 mt-1"
          >
            Ver <ArrowUpRight className="h-3 w-3" />
          </Link>
        </li>

        {/* Últimas unidades en venta por promoción */}
        {lastUnitPromos.length > 0 && (
          <li className="flex items-start gap-3 px-4 sm:px-5 py-3">
            <div className="h-9 w-9 rounded-xl bg-warning/10 text-warning grid place-items-center shrink-0">
              <Building2 className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-foreground">
                Última unidad en venta
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {lastUnitPromos.map((p) => (
                  <li key={p.id} className="text-[11px] text-muted-foreground truncate">
                    <Link
                      to={`/promociones/${p.id}`}
                      className="hover:text-foreground"
                    >
                      <strong className="text-foreground">{p.name}</strong> · {p.location}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}

        {/* Mock de otro item */}
        <li className="flex items-start gap-3 px-4 sm:px-5 py-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-foreground">
              Villa Serena supera el 80% vendido
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hito alcanzado el 22 abril · acelera cierre antes de verano.
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AGENDA DE HOY (widget) · reutilizado desde la versión anterior.
   ═══════════════════════════════════════════════════════════════════ */

function TodayAgendaWidget({ selectedUserId }: { selectedUserId: string | null }) {
  const allEvents = useCalendarEvents();
  const today = new Date();
  const todayEvents = useMemo(() => {
    return eventsInDay(allEvents, today)
      .filter((ev) => ev.status !== "cancelled")
      .filter((ev) => !selectedUserId || ev.assigneeUserId === selectedUserId)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, selectedUserId]);

  const totalToday = todayEvents.length;
  const visible = todayEvents.slice(0, 5);
  const overflow = Math.max(0, totalToday - visible.length);
  const todayLabel = today.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  const now = Date.now();

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            Hoy
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {todayLabel} · {totalToday} evento{totalToday === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          to="/calendario"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          Calendario <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      {totalToday === 0 ? (
        <div className="px-4 sm:px-5 py-6 text-center">
          <p className="text-[12px] text-muted-foreground">
            Sin eventos para hoy. Un buen momento para programar una visita.
          </p>
          <Link
            to="/calendario"
            className="inline-flex items-center gap-1.5 mt-3 h-8 px-3 rounded-full border border-border bg-card text-[11.5px] font-medium hover:bg-muted"
          >
            Abrir calendario
          </Link>
        </div>
      ) : (
        <ul className="p-2">
          {visible.map((ev: CalendarEvent) => {
            const cfg = eventTypeConfig[ev.type];
            const startTime = formatTime(ev.start);
            const isActive = isTodayDate(ev.start) && new Date(ev.start).getTime() <= now && new Date(ev.end).getTime() > now;
            const timeLabel = isActive ? "AHORA" : startTime;
            const detail = ev.location?.label ?? ev.contactName ?? cfg.label;
            return (
              <li key={ev.id}>
                <Link
                  to={ev.leadId ? `/oportunidades/${ev.leadId}` : "/calendario"}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-muted/40",
                    isActive && "bg-primary/5",
                  )}
                >
                  <div className={cn("w-14 shrink-0 text-center", isActive ? "text-primary font-semibold" : "text-muted-foreground")}>
                    <p className="text-[10px] tracking-wider tabular-nums">{timeLabel}</p>
                    {isActive && <p className="text-[9.5px] tabular-nums">{startTime}</p>}
                  </div>
                  <div className={cn("h-8 w-1 rounded-full shrink-0", cfg.dotClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-[10.5px] text-muted-foreground truncate">{detail}</p>
                  </div>
                </Link>
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="px-3 pt-1">
              <Link
                to="/calendario"
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Ver {overflow} evento{overflow === 1 ? "" : "s"} más
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ÚLTIMOS MOVIMIENTOS · widget compacto (5 items) que enlaza con
   `/actividad` para el feed completo. Filtra por `selectedUserId`
   igual que el resto del dashboard.
   ═══════════════════════════════════════════════════════════════════ */

function RecentActivityWidget({ selectedUserId }: { selectedUserId: string | null }) {
  // CLAUDE.md · "Datos sensibles requieren permiso" · si el user no
  // tiene activity.dashboard.view, el widget NO muestra actividad del
  // resto del equipo — solo la suya. Así un agente junior puede ver
  // "mis últimos movimientos" sin leakear ventas € o decisiones de
  // colegas desde el Home.
  const currentUser = useCurrentUser();
  const canSeeAll = useHasPermission("activity.dashboard.view");
  const effectiveUserId = canSeeAll
    ? (selectedUserId ?? undefined)
    : currentUser.id;

  const feed = useBusinessActivity({ userId: effectiveUserId });
  const items = feed.slice(0, 5);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            {canSeeAll ? "Últimos movimientos" : "Mis últimos movimientos"}
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
            {feed.length} en los últimos días
          </p>
        </div>
        {canSeeAll && (
          <Link
            to="/actividad"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            Ver todo <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      {items.length === 0 ? (
        <div className="px-4 sm:px-5 py-6 text-center">
          <p className="text-[12px] text-muted-foreground">
            Sin movimientos recientes.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((ev) => {
            const Icon = ev.icon;
            const tone = ev.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : ev.tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : ev.tone === "warning"
                  ? "bg-warning/10 text-warning"
                  : ev.tone === "primary"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground";
            const member = ev.userId ? findTeamMember(ev.userId) : undefined;
            const when = new Date(ev.at);
            const now = new Date();
            const hoursAgo = (now.getTime() - when.getTime()) / (1000 * 60 * 60);
            const relative = hoursAgo < 1
              ? "hace unos min"
              : hoursAgo < 24
                ? `hace ${Math.floor(hoursAgo)}h`
                : hoursAgo < 24 * 7
                  ? `hace ${Math.floor(hoursAgo / 24)}d`
                  : when.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
            const content = (
              <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                <div className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", tone)}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground leading-snug line-clamp-2">
                    {ev.title}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5 tabular-nums">
                    {member?.name.split(" ")[0] ?? ev.userName?.split(" ")[0] ?? ev.agencyName ?? "Sistema"} · {relative}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={ev.id}>
                {ev.href ? <Link to={ev.href}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   QUICK ACTIONS · accesos rápidos a crear-visita, llamada, etc.
   ═══════════════════════════════════════════════════════════════════ */
function QuickActions() {
  const actions: { icon: LucideIcon; label: string; to: string; tone: string }[] = [
    { icon: Home,  label: "Programar visita", to: "/calendario",     tone: "bg-primary/10 text-primary" },
    { icon: Phone, label: "Registrar llamada", to: "/calendario",    tone: "bg-sky-100 text-sky-800" },
    { icon: Users, label: "Nuevo lead",        to: "/oportunidades", tone: "bg-emerald-50 text-emerald-700" },
    { icon: Mail,  label: "Enviar email",      to: "/emails",        tone: "bg-indigo-50 text-indigo-800" },
  ];
  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">Acciones rápidas</h3>
      </header>
      <div className="grid grid-cols-2 gap-2 p-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="flex flex-col items-start gap-1 rounded-xl border border-border p-3 hover:bg-muted/30 hover:border-foreground/20 transition-colors"
            >
              <div className={cn("h-8 w-8 rounded-lg grid place-items-center", a.tone)}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </div>
              <p className="text-[11.5px] font-medium text-foreground leading-tight">{a.label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
