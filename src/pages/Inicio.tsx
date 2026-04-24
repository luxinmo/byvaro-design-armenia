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
  Building2, UserPlus, AlertCircle, Users, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import AgencyHome from "./AgencyHome";
import { useCalendarEvents } from "@/lib/calendarStorage";
import {
  eventTypeConfig,
  type CalendarEvent,
} from "@/data/calendarEvents";
import { eventsInDay, formatTime, isToday as isTodayDate } from "@/lib/calendarHelpers";
import { registros } from "@/data/records";
import { developerOnlyPromotions } from "@/data/developerPromotions";

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function Inicio() {
  const user = useCurrentUser();
  if (user.accountType === "agency") {
    return <AgencyHome />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              General
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight mt-1 leading-tight">
              Hola, {user.name.split(" ")[0]}
              <span className="text-muted-foreground font-medium"> · qué tienes hoy</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Actividades pendientes, agenda y novedades del equipo.
            </p>
          </div>
          <Link
            to="/estadisticas"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-card text-[12.5px] font-medium hover:bg-muted transition-colors shrink-0"
          >
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ver estadísticas
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Contenido · 2 cols en desktop */}
      <div className="px-3 sm:px-6 lg:px-8 mt-6 pb-10">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 sm:gap-5">
          <div className="space-y-4 sm:space-y-5 min-w-0">
            <ActividadesPendientes />
            <Novedades />
          </div>
          <aside className="space-y-4 sm:space-y-5 min-w-0">
            <TodayAgendaWidget />
            <QuickActions />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVIDADES PENDIENTES · LISTA PLANA INDIVIDUAL
   ───────────────────────────────────────────────────────────────────
   Cada item es UNA tarea concreta · click navega al recurso específico:
     · Registro     → /registros#reg-<id>
     · Visita       → /calendario?event=<id> · o /oportunidades/:leadId
     · Llamada      → /contactos/:contactId · o /calendario?event=<id>
     · Email        → /emails
     · WhatsApp     → /contactos/:contactId?tab=whatsapp
     · Tarea        → /calendario?event=<id>
   Cabecera por tipo con contador · items ordenados por prioridad.
   ═══════════════════════════════════════════════════════════════════ */

type Activity = {
  id: string;
  kind: "registro" | "visita" | "llamada" | "email" | "whatsapp" | "tarea";
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  meta?: string;          // hora · prioridad · etc.
  href: string;
  tone: "default" | "warning" | "primary" | "success" | "destructive";
};

/* Filtros por categoría arriba del bloque. */
type Filter = "all" | Activity["kind"];

const FILTERS: { key: Filter; label: string; icon: LucideIcon }[] = [
  { key: "all",       label: "Todas",      icon: AlertCircle },
  { key: "registro",  label: "Registros",  icon: FileText },
  { key: "visita",    label: "Visitas",    icon: Home },
  { key: "llamada",   label: "Llamadas",   icon: Phone },
  { key: "email",     label: "Emails",     icon: Mail },
  { key: "whatsapp",  label: "WhatsApps",  icon: MessageSquare },
  { key: "tarea",     label: "Tareas",     icon: CheckSquare },
];

function ActividadesPendientes() {
  const allEvents = useCalendarEvents();
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo<Activity[]>(() => {
    const list: Activity[] = [];
    const today = new Date();

    /* === REGISTROS pendientes === */
    registros
      .filter((r) => r.estado === "pendiente")
      .forEach((r) => {
        list.push({
          id: `reg-${r.id}`,
          kind: "registro",
          icon: FileText,
          title: `${r.cliente.nombre} · registro pendiente`,
          subtitle: `Promoción ${r.promotionId}${r.matchPercentage >= 70 ? ` · ⚠ posible duplicado ${r.matchPercentage}%` : ""}`,
          meta: relativeTime(r.fecha),
          href: `/registros#${r.id}`,
          tone: r.matchPercentage >= 70 ? "destructive" : "warning",
        });
      });

    /* === VISITAS pending-confirmation === */
    allEvents
      .filter((ev) => ev.type === "visit" && ev.status === "pending-confirmation")
      .forEach((v) => {
        list.push({
          id: `visit-${v.id}`,
          kind: "visita",
          icon: Home,
          title: v.title,
          subtitle: `${v.contactName ?? ""} · ${(v as any).promotionName ?? ""}`.trim(),
          meta: `${formatDay(v.start)} · ${formatTime(v.start)}`,
          href: v.leadId
            ? `/oportunidades/${v.leadId}?tab=actividad`
            : `/calendario?event=${v.id}`,
          tone: "warning",
        });
      });

    /* === VISITAS done sin evaluación === */
    allEvents
      .filter(
        (ev) => ev.type === "visit" && ev.status === "done" && !(ev as any).evaluation,
      )
      .forEach((v) => {
        list.push({
          id: `visit-eval-${v.id}`,
          kind: "visita",
          icon: CheckSquare,
          title: `Evaluar ${v.title}`,
          subtitle: v.contactName ?? "Visita realizada",
          meta: "pendiente de feedback",
          href: v.leadId
            ? `/oportunidades/${v.leadId}?tab=actividad`
            : `/calendario?event=${v.id}`,
          tone: "warning",
        });
      });

    /* === LLAMADAS de hoy === */
    eventsInDay(allEvents, today)
      .filter((ev) => ev.type === "call" && ev.status !== "cancelled" && ev.status !== "done")
      .forEach((c) => {
        list.push({
          id: `call-${c.id}`,
          kind: "llamada",
          icon: Phone,
          title: c.contactName ? `Llamar a ${c.contactName}` : c.title,
          subtitle: c.notes ?? (c as any).phone ?? c.title,
          meta: formatTime(c.start),
          href: c.contactId
            ? `/contactos/${c.contactId}`
            : `/calendario?event=${c.id}`,
          tone: "primary",
        });
      });

    /* === EMAILS sin responder (mock) === */
    MOCK_EMAILS.forEach((e) => {
      list.push({
        id: `email-${e.id}`,
        kind: "email",
        icon: Mail,
        title: `${e.from} · ${e.subject}`,
        subtitle: e.snippet,
        meta: e.time,
        href: e.contactId ? `/contactos/${e.contactId}?tab=emails` : "/emails",
        tone: "default",
      });
    });

    /* === WHATSAPPS sin leer (mock) === */
    MOCK_WHATSAPPS.forEach((w) => {
      list.push({
        id: `wa-${w.id}`,
        kind: "whatsapp",
        icon: MessageSquare,
        title: `${w.from} · WhatsApp`,
        subtitle: w.snippet,
        meta: w.time,
        href: `/contactos/${w.contactId}?tab=whatsapp`,
        tone: "success",
      });
    });

    /* === TAREAS propias (mock) === */
    MOCK_TAREAS.forEach((t) => {
      list.push({
        id: `task-${t.id}`,
        kind: "tarea",
        icon: CheckSquare,
        title: t.title,
        subtitle: t.description,
        meta: t.due,
        href: `/calendario?task=${t.id}`,
        tone: t.overdue ? "destructive" : "primary",
      });
    });

    /* Orden: destructive primero (urgente), luego warning, luego resto. */
    const rank = { destructive: 0, warning: 1, primary: 2, success: 3, default: 4 };
    return list.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [allEvents]);

  const countsByKind = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach((i) => { c[i.kind] = (c[i.kind] ?? 0) + 1; });
    return c;
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="px-4 sm:px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={1.75} />
            Actividades pendientes
          </h3>
          <p className="text-[11.5px] text-muted-foreground tabular-nums">
            {filtered.length} de {items.length}
          </p>
        </div>
        {/* Filtros por categoría */}
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => {
            const count = countsByKind[f.key] ?? 0;
            if (f.key !== "all" && count === 0) return null;
            const active = filter === f.key;
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={1.75} />
                {f.label}
                <span className={cn(
                  "tabular-nums",
                  active ? "opacity-80" : "opacity-60",
                )}>· {count}</span>
              </button>
            );
          })}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="px-4 sm:px-5 py-10 text-center">
          <p className="text-[12px] text-muted-foreground italic">
            Sin actividades pendientes en esta categoría.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 max-h-[520px] overflow-y-auto overscroll-contain">
          {filtered.map((a) => {
            const Icon = a.icon;
            const toneBg = {
              default:     "bg-muted text-foreground",
              warning:     "bg-warning/10 text-warning",
              primary:     "bg-primary/10 text-primary",
              success:     "bg-emerald-50 text-emerald-700",
              destructive: "bg-destructive/5 text-destructive",
            }[a.tone];
            return (
              <li key={a.id}>
                <Link
                  to={a.href}
                  className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", toneBg)}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-foreground truncate">
                      {a.title}
                    </p>
                    {a.subtitle && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {a.subtitle}
                      </p>
                    )}
                  </div>
                  {a.meta && (
                    <p className="text-[10.5px] text-muted-foreground shrink-0 mt-1.5 tabular-nums">
                      {a.meta}
                    </p>
                  )}
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1.5" strokeWidth={1.75} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ─── Helpers locales ─── */

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === tomorrow.toDateString()) return "Mañana";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

/* ─── Mocks de Emails / WhatsApps / Tareas ·
       hasta que tengan store propio se hardcoded aquí con link al
       contacto cuando existe para que el click abra el panel real. ─── */

const MOCK_EMAILS = [
  { id: "e1", from: "Ahmed Al Rashid", subject: "Re: Villa Serena · financiación", snippet: "Mañana te paso la carta del banco · gracias.", time: "hace 2h", contactId: "ahmed-al-rashid" },
  { id: "e2", from: "Marie Dubois",    subject: "Re: Terrazas del Golf",           snippet: "Confirmo visita del jueves · ¿a qué hora?",    time: "hace 3h", contactId: "marie-dubois" },
  { id: "e3", from: "Lars Andersson",  subject: "Documentación adicional",         snippet: "Adjunto la preaprobación bancaria.",          time: "hace 5h", contactId: "lars-andersson" },
  { id: "e4", from: "Emma Johnson",    subject: "Planos Villa 03",                 snippet: "¿Puedes enviarme los planos actualizados?",    time: "ayer",    contactId: "emma-johnson" },
];

const MOCK_WHATSAPPS = [
  { id: "w1", from: "Marie Dubois",   snippet: "¿Podemos adelantar la visita al miércoles?", time: "13:45", contactId: "marie-dubois" },
  { id: "w2", from: "Emma Johnson",   snippet: "¡Gracias por la info! ¿nos vemos mañana?",   time: "11:20", contactId: "emma-johnson" },
];

const MOCK_TAREAS = [
  { id: "t1", title: "Enviar dossier Villa Serena a Ivan Petrov", description: "PDF con precios + disponibilidad", due: "vencida", overdue: true },
  { id: "t2", title: "Llamar a proveedor gráfico",                description: "Confirmar entrega nueva cartelería", due: "hoy",  overdue: false },
  { id: "t3", title: "Cierre semanal del pipeline",               description: "Revisar oportunidades · actualizar etapas", due: "hoy", overdue: false },
];

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

function TodayAgendaWidget() {
  const allEvents = useCalendarEvents();
  const today = new Date();
  const todayEvents = useMemo(() => {
    return eventsInDay(allEvents, today)
      .filter((ev) => ev.status !== "cancelled")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents]);

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
