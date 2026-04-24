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

import { useMemo } from "react";
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
   ACTIVIDADES PENDIENTES
   ───────────────────────────────────────────────────────────────────
   Agrega items de distintas fuentes (registros pendientes, visitas
   por confirmar, llamadas de hoy, emails/whatsapps pendientes,
   tareas) y los pinta por prioridad.
   ═══════════════════════════════════════════════════════════════════ */

type Activity = {
  id: string;
  kind: "registro" | "visita" | "llamada" | "email" | "whatsapp" | "tarea";
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  time?: string;          // "14:30" o "hace 2h"
  href: string;           // dónde abrir al clicar
  tone: "default" | "warning" | "primary" | "success" | "destructive";
  count?: number;         // si agrupa varios items
};

function ActividadesPendientes() {
  const allEvents = useCalendarEvents();

  const items = useMemo<Activity[]>(() => {
    const list: Activity[] = [];
    const today = new Date();

    /* Registros pendientes (todos los que están sin decisión hoy). */
    const regsPendientes = registros.filter((r) => r.estado === "pendiente");
    if (regsPendientes.length > 0) {
      list.push({
        id: "registros-pendientes",
        kind: "registro",
        icon: FileText,
        title: `${regsPendientes.length} ${regsPendientes.length === 1 ? "registro pendiente" : "registros pendientes"} de decidir`,
        subtitle: regsPendientes.slice(0, 2).map((r) => r.cliente.nombre).join(" · ") +
          (regsPendientes.length > 2 ? ` · +${regsPendientes.length - 2} más` : ""),
        href: "/registros",
        tone: "warning",
        count: regsPendientes.length,
      });
    }

    /* Visitas pending-confirmation · necesitan confirmación manual. */
    const visitasPending = allEvents.filter(
      (ev) => ev.type === "visit" && ev.status === "pending-confirmation",
    );
    if (visitasPending.length > 0) {
      list.push({
        id: "visitas-pendientes",
        kind: "visita",
        icon: Home,
        title: `${visitasPending.length} ${visitasPending.length === 1 ? "visita" : "visitas"} por confirmar`,
        subtitle: visitasPending.slice(0, 2).map((v) => v.title).join(" · ") +
          (visitasPending.length > 2 ? ` · +${visitasPending.length - 2} más` : ""),
        href: "/calendario",
        tone: "warning",
        count: visitasPending.length,
      });
    }

    /* Visitas sin evaluar (done del pasado sin evaluación). */
    const visitasSinEvaluar = allEvents.filter(
      (ev) => ev.type === "visit" && ev.status === "done" && !(ev as any).evaluation,
    );
    if (visitasSinEvaluar.length > 0) {
      list.push({
        id: "visitas-sin-evaluar",
        kind: "visita",
        icon: CheckSquare,
        title: `${visitasSinEvaluar.length} ${visitasSinEvaluar.length === 1 ? "visita" : "visitas"} sin evaluar`,
        subtitle: "Añade feedback antes de que pase de 24h.",
        href: "/calendario",
        tone: "warning",
        count: visitasSinEvaluar.length,
      });
    }

    /* Llamadas de hoy. */
    const llamadasHoy = eventsInDay(allEvents, today).filter(
      (ev) => ev.type === "call" && ev.status !== "cancelled" && ev.status !== "done",
    );
    if (llamadasHoy.length > 0) {
      list.push({
        id: "llamadas-hoy",
        kind: "llamada",
        icon: Phone,
        title: `${llamadasHoy.length} ${llamadasHoy.length === 1 ? "llamada" : "llamadas"} hoy`,
        subtitle: llamadasHoy.map((c) => `${formatTime(c.start)} · ${c.contactName ?? c.title}`).join(" · "),
        href: "/calendario",
        tone: "primary",
        count: llamadasHoy.length,
      });
    }

    /* Emails pendientes (mock · harcoded para V1 hasta que haya store real). */
    list.push({
      id: "emails-pendientes",
      kind: "email",
      icon: Mail,
      title: "4 emails sin responder",
      subtitle: "Consulta de Ahmed Al Rashid · re: financiación · +2 más",
      href: "/emails",
      tone: "default",
      count: 4,
    });

    /* WhatsApps pendientes (mock). */
    list.push({
      id: "wa-pendientes",
      kind: "whatsapp",
      icon: MessageSquare,
      title: "2 WhatsApps sin leer",
      subtitle: "Marie Dubois (13:45) · Emma Johnson (11:20)",
      href: "/contactos",
      tone: "success",
      count: 2,
    });

    /* Tareas propias (mock · hoy no hay store de tareas). */
    list.push({
      id: "tareas-hoy",
      kind: "tarea",
      icon: CheckSquare,
      title: "1 tarea vencida · 2 para hoy",
      subtitle: "Enviar dossier Villa Serena · Llamar a proveedor gráfico · Cierre semanal",
      href: "/calendario",
      tone: "destructive",
      count: 3,
    });

    return list;
  }, [allEvents]);

  const totalPendientes = items.reduce((s, i) => s + (i.count ?? 1), 0);

  return (
    <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={1.75} />
            Actividades pendientes
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {totalPendientes} {totalPendientes === 1 ? "item" : "items"} · agrupados por tipo
          </p>
        </div>
      </header>
      <ul className="divide-y divide-border/40">
        {items.map((a) => {
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
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>
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
