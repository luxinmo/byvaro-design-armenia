/**
 * Calendario · agenda unificada del equipo.
 *
 * Un solo calendario donde conviven **todos los tipos** de evento:
 * visitas a propiedades, llamadas comerciales, reuniones, bloqueos
 * de tiempo y recordatorios. Cada evento pertenece a un único agente
 * (`assigneeUserId`) y el Multi-calendario de la sidebar deja
 * encender/apagar el carril de cada miembro independientemente.
 *
 * Vistas (mismo patrón que Google Calendar):
 *   - Semana (default) · columnas lun-dom · resolución 1 h.
 *   - Mes · grid 6×7 · muestra hasta 3 eventos por día + "N más".
 *   - Día · detalle de 30 min.
 *   - Agenda · lista cronológica agrupada por día.
 *
 * Integración Google Calendar: botón en la sidebar de calendarios.
 * Crear evento: click en slot vacío o botón primary del header →
 *   CreateCalendarEventDialog (Fase 3).
 *
 * TODO(backend): ver §Calendar de docs/backend-integration.md.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Plus, Home, Phone, Users, Ban, Bell,
  CalendarDays, CalendarCheck2, Filter, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  useCalendarEvents,
} from "@/lib/calendarStorage";
import {
  eventTypeConfig, eventStatusConfig, getMemberCalendarColor,
  type CalendarEvent, type CalendarEventType, type CalendarEventStatus,
} from "@/data/calendarEvents";
import {
  startOfWeek, endOfWeek, getWeekDays, getMonthGrid, startOfMonth,
  addDays, addWeeks, addMonths, isSameDay, isToday,
  formatTime, formatTimeRange, formatWeekRange, formatMonthTitle,
  formatDayTitle, formatShortDate, durationMinutes,
  eventsInDay, eventsInMonth, WEEKDAY_SHORT_ES,
} from "@/lib/calendarHelpers";
import { getAllTeamMembers, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { CreateCalendarEventDialog } from "@/components/calendar/CreateCalendarEventDialog";
import { cn } from "@/lib/utils";

type ViewMode = "semana" | "mes" | "dia" | "agenda";

/* Las horas que pinta la vista Semana · 8-20h es el rango laboral
 * habitual · suficiente para cubrir los eventos mock sin saturar. */
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8..20

/** Detecta si estamos en viewport mobile. Se actualiza con resize. */
function useIsMobile(breakpoint = 1024): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Calendario() {
  const navigate = useNavigate();
  const allEvents = useCalendarEvents();
  const teamMembers = useMemo(() => getAllTeamMembers(), []);

  /* ─── Estado de vista ─── */
  const isMobile = useIsMobile();
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 1024 ? "mes" : "semana",
  );
  /* En mobile, vista Mes muestra además la lista del día seleccionado
     abajo (estilo Apple Calendar). */
  const [mobileSelectedDay, setMobileSelectedDay] = useState<Date>(() => new Date());
  /* Sidebar de agentes · drawer en mobile. */
  const [mobileAgentsOpen, setMobileAgentsOpen] = useState(false);
  /* Al cambiar entre mobile y desktop, ajusta vistas que no encajan. */
  useEffect(() => {
    if (isMobile && (viewMode === "semana" || viewMode === "dia")) {
      setViewMode("mes");
    }
  }, [isMobile, viewMode]);

  /* ─── Multi-calendario · qué agentes se muestran.
     Por defecto: todos los miembros activos encendidos. */
  const [enabledAgents, setEnabledAgents] = useState<Set<string>>(() => {
    return new Set(
      teamMembers
        .filter((m) => !m.status || m.status === "active")
        .map((m) => m.id),
    );
  });
  const toggleAgent = (id: string) => {
    setEnabledAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ─── Filtros ─── */
  const [typeFilter, setTypeFilter] = useState<Set<CalendarEventType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<CalendarEventStatus>>(new Set());
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  /* ─── Eventos filtrados · todas las vistas los consumen. ─── */
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (!enabledAgents.has(ev.assigneeUserId)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(ev.type)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(ev.status)) return false;
      return true;
    });
  }, [allEvents, enabledAgents, typeFilter, statusFilter]);

  /* ─── Navegación ─── */
  const goToday = () => setViewDate(new Date());
  const goPrev = () => {
    if (viewMode === "semana") setViewDate((d) => addWeeks(d, -1));
    else if (viewMode === "mes") setViewDate((d) => addMonths(d, -1));
    else setViewDate((d) => addDays(d, -1));
  };
  const goNext = () => {
    if (viewMode === "semana") setViewDate((d) => addWeeks(d, 1));
    else if (viewMode === "mes") setViewDate((d) => addMonths(d, 1));
    else setViewDate((d) => addDays(d, 1));
  };

  const headerTitle =
    viewMode === "semana" ? formatWeekRange(viewDate) :
    viewMode === "mes"    ? formatMonthTitle(viewDate) :
    viewMode === "dia"    ? formatDayTitle(viewDate) :
    /* agenda */            `Próximas · desde ${formatShortDate(viewDate)}`;

  /* ─── Crear evento · dialog con detección de conflicto ─── */
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<
    { date?: Date; hour?: number; assigneeUserId?: string } | undefined
  >(undefined);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const openCreate = (preset?: { date?: Date; hour?: number; assigneeUserId?: string }) => {
    setEditingEvent(undefined);
    setCreatePreset(preset);
    setCreateOpen(true);
  };
  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setCreatePreset(undefined);
    setCreateOpen(true);
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ══════ Header ══════ */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Comercial
              </p>
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground mt-1 leading-tight">
                Calendario
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[640px] leading-relaxed">
                Agenda del equipo · visitas, llamadas, reuniones y bloqueos. Cada
                agente tiene su carril · conecta tu Google Calendar para sincronizar.
              </p>
            </div>

            {/* CTA primary · crear. En mobile se sustituye por FAB
               flotante abajo-derecha (más cómodo para pulgar). */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <button
                onClick={() => openCreate({ date: new Date() })}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Crear evento
              </button>
            </div>
          </div>

          {/* Toolbar · navegación · en mobile va en 2 filas para no
             amontonarse. Fila 1: nav + título. Fila 2: segmented + filtros. */}
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <button
              onClick={goToday}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-card text-[12.5px] font-medium hover:bg-muted"
            >
              Hoy
            </button>
            <div className="inline-flex items-center">
              <button
                onClick={goPrev}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={goNext}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-muted ml-1"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm font-semibold text-foreground ml-1 sm:ml-2 capitalize truncate flex-1 min-w-0">
              {headerTitle}
            </p>
            {/* Botón 'Agentes' mobile · abre drawer con los calendarios */}
            <button
              onClick={() => setMobileAgentsOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card text-[12px] font-medium hover:bg-muted"
              aria-label="Agentes"
            >
              <Users className="h-3 w-3" strokeWidth={1.75} />
              {enabledAgents.size}
            </button>
          </div>

          {/* Fila 2 mobile · segmented + filtros */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {/* Segmented vistas · en mobile se ofrecen solo Mes/Agenda
               (Semana y Día son densas y no leen bien en 375px). */}
            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5">
              {(isMobile
                ? ([
                    { key: "mes"    as const, label: "Mes" },
                    { key: "agenda" as const, label: "Agenda" },
                  ])
                : ([
                    { key: "semana" as const, label: "Semana" },
                    { key: "mes"    as const, label: "Mes" },
                    { key: "dia"    as const, label: "Día" },
                    { key: "agenda" as const, label: "Agenda" },
                  ])
              ).map((opt) => {
                const active = viewMode === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setViewMode(opt.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors",
                      active
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Más filtros · ml-auto lo empuja a la derecha en desktop */}
            <button
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12.5px] font-medium transition-colors",
                (typeFilter.size + statusFilter.size > 0 || moreFiltersOpen)
                  ? "bg-foreground text-background border-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Filter className="h-3 w-3" strokeWidth={1.75} />
              Filtros
              {(typeFilter.size + statusFilter.size) > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-background/20 text-[10px] font-bold tabular-nums inline-flex items-center justify-center">
                  {typeFilter.size + statusFilter.size}
                </span>
              )}
            </button>
          </div>

          {moreFiltersOpen && (
            <FiltersPanel
              typeFilter={typeFilter} setTypeFilter={setTypeFilter}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              onClear={() => { setTypeFilter(new Set()); setStatusFilter(new Set()); }}
            />
          )}
        </div>
      </section>

      {/* ══════ Cuerpo · sidebar + vista ══════ */}
      <section className="px-4 sm:px-6 lg:px-8 mt-5 pb-10">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          {/* Sidebar · multi-calendario (desktop) */}
          <AgentSidebar
            teamMembers={teamMembers}
            enabledAgents={enabledAgents}
            toggleAgent={toggleAgent}
            onEnableAll={() =>
              setEnabledAgents(new Set(teamMembers.filter((m) => !m.status || m.status === "active").map((m) => m.id)))
            }
            onDisableAll={() => setEnabledAgents(new Set())}
          />

          {/* Panel de la vista */}
          <div className="min-w-0">
            {viewMode === "semana" && (
              <WeekView
                viewDate={viewDate}
                events={filteredEvents}
                onEmptySlotClick={(date, hour) => openCreate({ date, hour })}
                onEventClick={(ev) => openEdit(ev)}
              />
            )}
            {viewMode === "mes" && !isMobile && (
              <MonthView
                viewDate={viewDate}
                events={filteredEvents}
                onDayClick={(d) => { setViewDate(d); setViewMode("dia"); }}
                onEventClick={(ev) => openEdit(ev)}
                onEmptyDayClick={(d) => openCreate({ date: d })}
              />
            )}
            {viewMode === "mes" && isMobile && (
              <MobileMonthView
                viewDate={viewDate}
                events={filteredEvents}
                selectedDay={mobileSelectedDay}
                onSelectDay={(d) => setMobileSelectedDay(d)}
                onEventClick={(ev) => openEdit(ev)}
                onCreate={(d) => openCreate({ date: d })}
              />
            )}
            {viewMode === "dia" && (
              <DayView
                viewDate={viewDate}
                events={filteredEvents}
                onEmptySlotClick={(date, hour) => openCreate({ date, hour })}
                onEventClick={(ev) => openEdit(ev)}
              />
            )}
            {viewMode === "agenda" && (
              <AgendaView
                viewDate={viewDate}
                events={filteredEvents}
                onEventClick={(ev) => openEdit(ev)}
              />
            )}
          </div>
        </div>
      </section>

      {/* Drawer de Agentes · solo mobile · backdrop simple. */}
      {mobileAgentsOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setMobileAgentsOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] bg-card shadow-soft-lg overflow-y-auto overscroll-contain p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Mis calendarios</h3>
              <button
                onClick={() => setMobileAgentsOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <AgentSidebar
              teamMembers={teamMembers}
              enabledAgents={enabledAgents}
              toggleAgent={toggleAgent}
              onEnableAll={() =>
                setEnabledAgents(new Set(teamMembers.filter((m) => !m.status || m.status === "active").map((m) => m.id)))
              }
              onDisableAll={() => setEnabledAgents(new Set())}
              compact
            />
          </div>
        </div>
      )}

      {/* FAB de crear · solo mobile · esquina inferior derecha.
         En desktop el CTA vive en el header (hidden lg:flex). */}
      <button
        onClick={() => openCreate({ date: new Date() })}
        className="lg:hidden fixed bottom-[88px] right-5 h-14 w-14 rounded-full bg-foreground text-background shadow-soft-lg hover:bg-foreground/90 grid place-items-center z-30"
        aria-label="Crear evento"
      >
        <Plus className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Dialog de crear / editar evento */}
      <CreateCalendarEventDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        event={editingEvent}
        preset={createPreset}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR · multi-calendario (agentes)
   ═══════════════════════════════════════════════════════════════════ */

function AgentSidebar({
  teamMembers, enabledAgents, toggleAgent, onEnableAll, onDisableAll, compact,
}: {
  teamMembers: ReturnType<typeof getAllTeamMembers>;
  enabledAgents: Set<string>;
  toggleAgent: (id: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  /** Si true, el componente no añade `hidden lg:block` · se usa dentro
   *  del drawer mobile. */
  compact?: boolean;
}) {
  const actives = teamMembers.filter((m) => !m.status || m.status === "active");

  return (
    <aside className={cn(compact ? "block" : "hidden lg:block")}>
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mis calendarios
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={enabledAgents.size === actives.length ? onDisableAll : onEnableAll}
              className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground"
            >
              {enabledAgents.size === actives.length ? "Ninguno" : "Todos"}
            </button>
          </div>
        </header>

        <ul className="py-1.5">
          {actives.map((m) => {
            const color = getMemberCalendarColor(m.id);
            const on = enabledAgents.has(m.id);
            return (
              <li key={m.id}>
                <button
                  onClick={() => toggleAgent(m.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-[4px] border-2 border-transparent transition-colors shrink-0",
                      on ? color : "bg-muted border-border",
                    )}
                  />
                  {getMemberAvatarUrl(m) ? (
                    <img src={getMemberAvatarUrl(m)!} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[9px] font-bold shrink-0">
                      {memberInitials(m)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <p className={cn("text-[12px] font-medium truncate", on ? "text-foreground" : "text-muted-foreground/60 line-through")}>
                      {m.name}
                    </p>
                    {m.jobTitle && (
                      <p className="text-[10px] text-muted-foreground/70 truncate">{m.jobTitle}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="px-3 py-2.5 border-t border-border bg-muted/30">
          <button
            onClick={() => toast.info("Conectar Google Calendar · disponible al enlazar backend (TODO)")}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-full border border-dashed border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <CalendarCheck2 className="h-3 w-3" strokeWidth={1.75} />
            Conectar Google Calendar
          </button>
        </footer>
      </div>

      {/* Leyenda tipos · ayuda a leer colores en las vistas densas */}
      <div className="mt-3 rounded-2xl border border-border bg-card p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Tipos de evento
        </p>
        <ul className="space-y-1.5">
          {(Object.keys(eventTypeConfig) as CalendarEventType[]).map((t) => {
            const cfg = eventTypeConfig[t];
            return (
              <li key={t} className="flex items-center gap-2 text-[11.5px] text-foreground">
                <span className={cn("h-2 w-2 rounded-full", cfg.dotClass)} />
                {cfg.label}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILTERS PANEL · tipo + estado
   ═══════════════════════════════════════════════════════════════════ */

function FiltersPanel({
  typeFilter, setTypeFilter, statusFilter, setStatusFilter, onClear,
}: {
  typeFilter: Set<CalendarEventType>;
  setTypeFilter: (s: Set<CalendarEventType>) => void;
  statusFilter: Set<CalendarEventStatus>;
  setStatusFilter: (s: Set<CalendarEventStatus>) => void;
  onClear: () => void;
}) {
  const toggle = <T,>(set: Set<T>, value: T, setFn: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setFn(next);
  };
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Tipo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(eventTypeConfig) as CalendarEventType[]).map((t) => {
              const cfg = eventTypeConfig[t];
              const on = typeFilter.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggle(typeFilter, t, setTypeFilter)}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors border",
                    on
                      ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`
                      : "bg-card text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClass)} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Estado
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(eventStatusConfig) as CalendarEventStatus[]).map((s) => {
              const cfg = eventStatusConfig[s];
              const on = statusFilter.has(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(statusFilter, s, setStatusFilter)}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors border",
                    on
                      ? cfg.badgeClass
                      : "bg-card text-muted-foreground border-border hover:bg-muted",
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {(typeFilter.size + statusFilter.size) > 0 && (
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW · SEMANA
   ═══════════════════════════════════════════════════════════════════ */

function WeekView({
  viewDate, events, onEmptySlotClick, onEventClick,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  onEmptySlotClick: (date: Date, hour: number) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const days = getWeekDays(viewDate);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      {/* Cabecera de días */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-muted/30">
        <div />
        {days.map((d, i) => (
          <div key={i} className={cn("py-2 text-center border-l border-border/60", isToday(d) && "bg-primary/5")}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {WEEKDAY_SHORT_ES[i]}
            </p>
            <p className={cn(
              "text-sm font-bold mt-0.5",
              isToday(d) ? "inline-flex items-center justify-center h-7 w-7 rounded-full bg-foreground text-background" : "text-foreground",
            )}>
              {d.getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Cuerpo · horas × 7 días */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] min-w-[820px] relative">
          {/* Franjas horarias */}
          {HOURS.map((h) => (
            <div key={`h-${h}`} className="h-14 border-t border-border/50 flex items-start justify-end pr-2 pt-0.5">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
          {/* 7 días (columnas) */}
          {days.map((day, di) => (
            <DayColumn
              key={`col-${di}`}
              day={day}
              events={eventsInDay(events, day)}
              colIndex={di}
              onEmptySlotClick={onEmptySlotClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day, events, colIndex, onEmptySlotClick, onEventClick,
}: {
  day: Date;
  events: CalendarEvent[];
  colIndex: number;
  onEmptySlotClick: (date: Date, hour: number) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const startH = HOURS[0];
  const pxPerMin = 56 / 60; // 56px por hora

  return (
    <div
      className={cn(
        "relative border-l border-border/60",
        isToday(day) && "bg-primary/[0.02]",
      )}
      style={{ gridColumn: colIndex + 2, gridRow: `1 / span ${HOURS.length}` }}
    >
      {/* Slots vacíos por hora · para clicar y crear. */}
      {HOURS.map((h) => (
        <button
          key={`slot-${h}`}
          onClick={() => onEmptySlotClick(day, h)}
          className="w-full h-14 border-t border-border/30 hover:bg-muted/40 transition-colors block"
          aria-label={`Crear evento a las ${h}:00`}
        />
      ))}

      {/* Eventos absolute */}
      {events.map((ev) => {
        const evStart = new Date(ev.start);
        const evEnd   = new Date(ev.end);
        const startMinutes = evStart.getHours() * 60 + evStart.getMinutes();
        const endMinutes = evEnd.getHours() * 60 + evEnd.getMinutes();
        const top = Math.max(0, (startMinutes - startH * 60) * pxPerMin);
        const height = Math.max(18, (endMinutes - startMinutes) * pxPerMin);
        const cfg = eventTypeConfig[ev.type];
        const isPending = ev.status === "pending-confirmation";
        const isCancelled = ev.status === "cancelled" || ev.status === "noshow";

        return (
          <button
            key={ev.id}
            onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
            className={cn(
              "absolute left-1 right-1 rounded-md px-1.5 py-1 text-left overflow-hidden border transition-shadow",
              cfg.bgClass, cfg.borderClass, cfg.textClass,
              "hover:shadow-soft-lg cursor-pointer",
              isPending && "border-dashed",
              isCancelled && "opacity-40 line-through",
            )}
            style={{ top: `${top}px`, height: `${height}px` }}
            title={`${ev.title} · ${formatTimeRange(ev.start, ev.end)}`}
          >
            <p className="text-[10.5px] font-semibold leading-tight truncate">
              {formatTime(ev.start)} · {ev.title}
            </p>
            {height >= 40 && (
              <p className="text-[9.5px] opacity-80 mt-0.5 truncate">
                {ev.contactName ?? (ev as any).promotionName ?? cfg.label}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW · MES
   ═══════════════════════════════════════════════════════════════════ */

function MonthView({
  viewDate, events, onDayClick, onEventClick, onEmptyDayClick,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
  onEmptyDayClick: (d: Date) => void;
}) {
  const cells = getMonthGrid(viewDate);
  const monthStart = startOfMonth(viewDate);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/30 border-b border-border">
        {WEEKDAY_SHORT_ES.map((d, i) => (
          <div key={i} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-l first:border-l-0 border-border/60">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const isCurrentMonth = d.getMonth() === monthStart.getMonth();
          const dayEvents = eventsInDay(events, d);
          const visibleEvents = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visibleEvents.length;
          return (
            <button
              key={i}
              onClick={() => (dayEvents.length > 0 ? onDayClick(d) : onEmptyDayClick(d))}
              className={cn(
                "relative min-h-[110px] border-l border-t border-border/60 p-1.5 text-left hover:bg-muted/30 transition-colors",
                !isCurrentMonth && "bg-muted/10",
              )}
            >
              <p className={cn(
                "text-[11.5px] font-semibold mb-1",
                !isCurrentMonth && "text-muted-foreground/60",
                isToday(d) && "inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background",
              )}>
                {d.getDate()}
              </p>
              <div className="space-y-0.5">
                {visibleEvents.map((ev) => {
                  const cfg = eventTypeConfig[ev.type];
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium truncate",
                        cfg.bgClass, cfg.textClass,
                        ev.status === "cancelled" || ev.status === "noshow" ? "opacity-40 line-through" : "",
                        ev.status === "pending-confirmation" ? "border border-dashed border-warning/50" : "",
                      )}
                      title={`${formatTime(ev.start)} · ${ev.title}`}
                    >
                      <span className="tabular-nums opacity-80">{formatTime(ev.start)}</span>
                      <span className="mx-1">·</span>
                      {ev.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    + {overflow} más
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW · DÍA (detalle)
   ═══════════════════════════════════════════════════════════════════ */

function DayView({
  viewDate, events, onEmptySlotClick, onEventClick,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  onEmptySlotClick: (date: Date, hour: number) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const dayEvents = eventsInDay(events, viewDate).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[80px_1fr] min-w-[500px] relative">
          {/* Horas */}
          {HOURS.map((h) => (
            <div key={`h-${h}`} className="h-20 border-t border-border/50 flex items-start justify-end pr-3 pt-1">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
          {/* Columna del día (abarca todas las horas). */}
          <div className="relative border-l border-border/60" style={{ gridColumn: 2, gridRow: `1 / span ${HOURS.length}` }}>
            {HOURS.map((h) => (
              <button
                key={`slot-${h}`}
                onClick={() => onEmptySlotClick(viewDate, h)}
                className="w-full h-20 border-t border-border/30 hover:bg-muted/40 transition-colors block"
                aria-label={`Crear evento a las ${h}:00`}
              />
            ))}
            {/* Eventos */}
            {dayEvents.map((ev) => {
              const evStart = new Date(ev.start);
              const evEnd = new Date(ev.end);
              const startMinutes = evStart.getHours() * 60 + evStart.getMinutes();
              const endMinutes = evEnd.getHours() * 60 + evEnd.getMinutes();
              const pxPerMin = 80 / 60;
              const top = Math.max(0, (startMinutes - HOURS[0] * 60) * pxPerMin);
              const height = Math.max(24, (endMinutes - startMinutes) * pxPerMin);
              const cfg = eventTypeConfig[ev.type];
              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className={cn(
                    "absolute left-2 right-4 rounded-lg px-3 py-2 text-left overflow-hidden border hover:shadow-soft-lg transition-shadow",
                    cfg.bgClass, cfg.borderClass, cfg.textClass,
                    ev.status === "pending-confirmation" && "border-dashed",
                    (ev.status === "cancelled" || ev.status === "noshow") && "opacity-50 line-through",
                  )}
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <p className="text-xs font-bold tabular-nums">
                    {formatTimeRange(ev.start, ev.end)}
                  </p>
                  <p className="text-sm font-semibold truncate">{ev.title}</p>
                  {ev.contactName && (
                    <p className="text-[11px] opacity-80 truncate">{ev.contactName}</p>
                  )}
                  {ev.location?.label && (
                    <p className="text-[11px] opacity-70 truncate">📍 {ev.location.label}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW · AGENDA (lista cronológica agrupada por día)
   ═══════════════════════════════════════════════════════════════════ */

function AgendaView({
  viewDate, events, onEventClick,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const now = Date.now();
  const fromDate = viewDate.getTime();
  const upcoming = events
    .filter((ev) => new Date(ev.start).getTime() >= Math.min(now, fromDate))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const grouped = upcoming.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const key = new Date(ev.start).toDateString();
    (acc[key] = acc[key] ?? []).push(ev);
    return acc;
  }, {});

  if (upcoming.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">Sin eventos próximos</p>
        <p className="text-xs text-muted-foreground">
          Ajusta los filtros o crea un nuevo evento desde el botón "Crear evento".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dayKey, dayEvents]) => {
        const day = new Date(dayKey);
        return (
          <section key={dayKey} className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
            <header className="px-4 py-2.5 bg-muted/30 border-b border-border">
              <p className="text-[11.5px] font-semibold text-foreground capitalize">
                {isToday(day) ? "Hoy · " : isSameDay(day, addDays(new Date(), 1)) ? "Mañana · " : ""}
                {formatDayTitle(day)}
              </p>
            </header>
            <ul className="divide-y divide-border/50">
              {dayEvents.map((ev) => {
                const cfg = eventTypeConfig[ev.type];
                const statusCfg = eventStatusConfig[ev.status];
                const Icon: LucideIcon =
                  ev.type === "visit" ? Home :
                  ev.type === "call" ? Phone :
                  ev.type === "meeting" ? Users :
                  ev.type === "block" ? Ban :
                  Bell;
                return (
                  <li key={ev.id}>
                    <button
                      onClick={() => onEventClick(ev)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", cfg.bgClass, cfg.textClass)}>
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[11px] font-semibold text-foreground tabular-nums">
                            {formatTimeRange(ev.start, ev.end)}
                          </p>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {cfg.label}
                          </span>
                          {ev.status !== "confirmed" && (
                            <span className={cn("inline-flex items-center text-[9.5px] font-medium rounded-full px-1.5 py-0.5", statusCfg.badgeClass)}>
                              {statusCfg.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate mt-0.5">
                          {ev.title}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground truncate">
                          {ev.contactName ?? "—"}
                          {ev.location?.label ? ` · ${ev.location.label}` : ""}
                          {` · ${durationMinutes(ev)} min`}
                        </p>
                      </div>
                      <div className={cn("h-7 w-7 rounded-full grid place-items-center shrink-0", getMemberCalendarColor(ev.assigneeUserId))}>
                        <span className="text-[9px] font-bold text-white">
                          {(ev.assigneeName ?? "").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW · MES mobile (Apple Calendar-like)
   ───────────────────────────────────────────────────────────────────
   Grid 7×6 con el número del día + dots de color (uno por tipo de
   evento presente). Al tap en un día → se marca y se muestra la
   lista cronológica debajo. Más compacto que el Month desktop
   porque no cabría pintar eventos como chips.
   ═══════════════════════════════════════════════════════════════════ */

function MobileMonthView({
  viewDate, events, selectedDay, onSelectDay, onEventClick, onCreate,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
  onCreate: (d: Date) => void;
}) {
  const cells = getMonthGrid(viewDate);
  const monthStart = startOfMonth(viewDate);
  const dayEvents = eventsInDay(events, selectedDay).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return (
    <div className="space-y-3">
      {/* Grid del mes · cada celda = círculo si seleccionado/hoy +
          dots del color del tipo de evento. */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/30 border-b border-border">
          {WEEKDAY_SHORT_ES.map((d, i) => (
            <div key={i} className="py-1.5 text-center text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const isCurrentMonth = d.getMonth() === monthStart.getMonth();
            const evs = eventsInDay(events, d);
            const selected = isSameDay(d, selectedDay);
            const today = isToday(d);
            // dots · uno por tipo presente (máx 4 distintos)
            const types = new Set(evs.map((ev) => ev.type));
            return (
              <button
                key={i}
                onClick={() => onSelectDay(d)}
                className={cn(
                  "relative aspect-[1.1] flex flex-col items-center justify-center gap-0.5 border-r border-b border-border/40",
                  !isCurrentMonth && "bg-muted/10",
                )}
              >
                <span className={cn(
                  "grid place-items-center text-[12px] font-semibold",
                  selected && !today && "h-7 w-7 rounded-full bg-foreground text-background",
                  today && "h-7 w-7 rounded-full bg-primary text-background",
                  !selected && !today && isCurrentMonth && "text-foreground",
                  !isCurrentMonth && "text-muted-foreground/50",
                )}>
                  {d.getDate()}
                </span>
                {evs.length > 0 && (
                  <span className="flex gap-0.5">
                    {[...types].slice(0, 4).map((t) => (
                      <span key={t} className={cn("h-1 w-1 rounded-full", eventTypeConfig[t].dotClass)} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista del día seleccionado */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <header className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
          <p className="text-[11.5px] font-semibold text-foreground capitalize">
            {isToday(selectedDay) ? "Hoy · " : ""}{formatDayTitle(selectedDay)}
          </p>
          <button
            onClick={() => onCreate(selectedDay)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Crear
          </button>
        </header>
        {dayEvents.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground italic">
            Sin eventos programados.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {dayEvents.map((ev) => {
              const cfg = eventTypeConfig[ev.type];
              return (
                <li key={ev.id}>
                  <button
                    onClick={() => onEventClick(ev)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/20 text-left"
                  >
                    <div className="w-14 shrink-0">
                      <p className="text-[11px] font-semibold text-foreground tabular-nums">
                        {formatTime(ev.start)}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {formatTime(ev.end)}
                      </p>
                    </div>
                    <div className={cn("h-10 w-1 rounded-full shrink-0", cfg.dotClass)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-foreground truncate">
                        {ev.title}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground truncate">
                        {ev.contactName ?? cfg.label}
                        {ev.location?.label ? ` · ${ev.location.label}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
