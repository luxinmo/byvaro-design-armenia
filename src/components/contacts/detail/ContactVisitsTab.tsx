/**
 * Tab "Visitas" de la ficha de contacto.
 *
 * 3 secciones:
 *  1. Próximas — status=scheduled y fecha futura.
 *  2. Pendientes de evaluar — status=done sin `evaluation` (TAREA).
 *  3. Historial — resto (done evaluadas, canceladas, no-show).
 *
 * Una visita realizada SIN evaluación es una tarea pendiente del agente
 * (regla de negocio). Por eso aparece destacada arriba con CTA "Evaluar".
 *
 * TODO(backend): GET /api/contacts/:id/visits + POST /api/visits + PATCH.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar, CheckCircle2, XCircle, UserX, Star,
  CalendarPlus, MapPin, ArrowRight, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ContactDetail, ContactVisitEntry, VisitEvaluation } from "@/components/contacts/types";
import { EvaluateVisitDialog } from "./EvaluateVisitDialog";

const STATUS_META: Record<ContactVisitEntry["status"], {
  label: string;
  icon: typeof Calendar;
  pillClass: string;
  iconClass: string;
}> = {
  scheduled: {
    label: "Programada",
    icon: Calendar,
    pillClass: "bg-warning/15 text-warning dark:text-warning",
    iconClass: "bg-warning/15 text-warning dark:text-warning",
  },
  done: {
    label: "Realizada",
    icon: CheckCircle2,
    pillClass: "bg-success/15 text-success dark:text-success",
    iconClass: "bg-success/15 text-success dark:text-success",
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    pillClass: "bg-destructive/15 text-destructive",
    iconClass: "bg-destructive/15 text-destructive",
  },
  noshow: {
    label: "No se presentó",
    icon: UserX,
    pillClass: "bg-muted text-muted-foreground",
    iconClass: "bg-muted text-muted-foreground",
  },
};

const INTEREST_LABEL: Record<VisitEvaluation["clientInterest"], string> = {
  low: "Interés bajo",
  medium: "Interés medio",
  high: "Interés alto",
};
const INTEREST_COLOR: Record<VisitEvaluation["clientInterest"], string> = {
  low: "text-muted-foreground",
  medium: "text-warning dark:text-warning",
  high: "text-success dark:text-success",
};

export function ContactVisitsTab({ detail }: { detail: ContactDetail }) {
  /* version-tick para refrescar tras evaluar */
  const [version, setVersion] = useState(0);
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalVisit, setEvalVisit] = useState<ContactVisitEntry | null>(null);

  const { upcoming, pending, history } = useMemo(() => {
    const now = Date.now();
    const upcoming: ContactVisitEntry[] = [];
    const pending: ContactVisitEntry[] = [];
    const history: ContactVisitEntry[] = [];

    for (const v of detail.visits) {
      const future = new Date(v.scheduledAt).getTime() > now;
      if (v.status === "scheduled" && future) upcoming.push(v);
      else if (v.status === "done" && !v.evaluation) pending.push(v);
      else history.push(v);
    }

    upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    pending.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    history.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return { upcoming, pending, history };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.visits, version]);

  const totalVisits = detail.visits.length;
  const visitsDone = detail.visits.filter((v) => v.status === "done").length;

  const openEval = (v: ContactVisitEntry) => {
    setEvalVisit(v);
    setEvalOpen(true);
  };

  const handleSchedule = () => {
    toast.info("Agendar visita — próximamente");
    /* TODO(backend): POST /api/visits con contactId, promotionId, scheduledAt, agent. */
  };

  return (
    <div className="space-y-5">
      {/* Header con stats + acción */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-5">
          <Stat value={upcoming.length} label="Próximas" />
          <Stat value={pending.length} label="Por evaluar" highlight={pending.length > 0} />
          <Stat value={visitsDone} label="Realizadas" />
          <Stat value={totalVisits} label="Total" muted />
        </div>
        <Button onClick={handleSchedule} size="sm" className="rounded-full">
          <CalendarPlus className="h-3.5 w-3.5" /> Agendar visita
        </Button>
      </div>

      {/* Pendientes de evaluar (DESTACADO — son tareas) */}
      {pending.length > 0 && (
        <Section
          title="Pendientes de evaluar"
          count={pending.length}
          subtitle="Visitas realizadas sin evaluación. Cada una es una tarea pendiente."
          accent
        >
          {pending.map((v) => (
            <VisitItem key={v.id} visit={v} onEvaluate={() => openEval(v)} pending />
          ))}
        </Section>
      )}

      {/* Próximas */}
      {upcoming.length > 0 && (
        <Section title="Próximas" count={upcoming.length}>
          {upcoming.map((v) => <VisitItem key={v.id} visit={v} />)}
        </Section>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <Section title="Historial" count={history.length}>
          {history.map((v) => (
            <VisitItem key={v.id} visit={v} onEvaluate={v.status === "done" ? () => openEval(v) : undefined} />
          ))}
        </Section>
      )}

      {totalVisits === 0 && <EmptyState onSchedule={handleSchedule} />}

      <EvaluateVisitDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        contactId={detail.id}
        visit={evalVisit}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

/* ══════ Sub-componentes ══════ */

function Stat({
  value, label, highlight, muted,
}: { value: number; label: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className={cn(
        "text-xl font-bold tnum",
        highlight ? "text-warning" : muted ? "text-muted-foreground" : "text-foreground",
      )}>
        {value}
      </p>
      <p className={cn(
        "text-[10px] uppercase tracking-wider font-semibold",
        highlight ? "text-warning/80" : "text-muted-foreground",
      )}>
        {label}
      </p>
    </div>
  );
}

function Section({
  title, count, subtitle, accent, children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5">
        <h3 className={cn(
          "text-[11px] uppercase tracking-[0.16em] font-semibold inline-flex items-center gap-1.5",
          accent ? "text-warning dark:text-warning" : "text-muted-foreground/80",
        )}>
          {accent && <AlertCircle className="h-3 w-3" />}
          {title}
          <span className={cn("ml-1 tnum font-normal", accent ? "text-warning/80" : "text-muted-foreground/60")}>
            ({count})
          </span>
        </h3>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function VisitItem({
  visit, onEvaluate, pending,
}: {
  visit: ContactVisitEntry;
  onEvaluate?: () => void;
  pending?: boolean;
}) {
  const meta = STATUS_META[visit.status];
  const Icon = meta.icon;
  const date = new Date(visit.scheduledAt);
  const dateLabel = formatVisitDate(date);
  const timeLabel = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const ev = visit.evaluation;

  return (
    <article className={cn(
      "rounded-2xl border p-4 transition-all duration-200 shadow-soft",
      pending
        ? "bg-warning/50 dark:bg-warning/15 border-warning/30 dark:border-warning/40 hover:shadow-soft-lg"
        : "bg-card border-border/40 hover:shadow-soft-lg hover:-translate-y-0.5",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", meta.iconClass)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/promociones/${visit.promotionId}`}
                className="text-sm font-semibold text-foreground hover:underline inline-flex items-center gap-1.5"
              >
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{visit.promotionName}</span>
                {visit.unit && (
                  <span className="text-muted-foreground font-normal">· {visit.unit}</span>
                )}
              </Link>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                <Clock className="h-3 w-3" />
                <span className="capitalize">{dateLabel}</span>
                <span className="text-border" aria-hidden>·</span>
                <span className="tnum">{timeLabel}</span>
                <span className="text-border" aria-hidden>·</span>
                <span>{visit.agent}</span>
              </p>
            </div>

            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full shrink-0",
              pending
                ? "bg-warning text-white"
                : meta.pillClass,
            )}>
              {pending ? "Sin evaluar" : meta.label}
            </span>
          </div>

          {visit.notes && !pending && (
            <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed italic">
              "{visit.notes}"
            </p>
          )}

          {/* Evaluación si la hay */}
          {ev && (
            <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center gap-3 text-[11.5px]">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "h-3 w-3",
                      n <= ev.rating ? "text-warning fill-current" : "text-muted-foreground/30",
                    )}
                  />
                ))}
              </div>
              <span className={cn("font-medium", INTEREST_COLOR[ev.clientInterest])}>
                {INTEREST_LABEL[ev.clientInterest]}
              </span>
              {ev.feedback && (
                <span className="text-muted-foreground truncate">· {ev.feedback}</span>
              )}
            </div>
          )}

          {/* Acciones contextuales */}
          <div className="flex items-center gap-2 mt-3">
            {pending && onEvaluate && (
              <Button onClick={onEvaluate} size="sm" className="rounded-full h-7 text-[11px]">
                <Star className="h-3 w-3" /> Evaluar visita
              </Button>
            )}
            {visit.status === "scheduled" && (
              <Link
                to={`/calendario?event=${visit.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:underline"
              >
                Ver en calendario <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {ev && onEvaluate && (
              <button
                onClick={onEvaluate}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Editar evaluación
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Para pendientes mostramos las notas debajo, no en el medio */}
      {visit.notes && pending && (
        <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed italic pl-13">
          "{visit.notes}"
        </p>
      )}
    </article>
  );
}

function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <Calendar className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin visitas todavía</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Aún no hay visitas registradas con este contacto. Agenda la primera para una promoción concreta.
      </p>
      <Button onClick={onSchedule} size="sm" className="rounded-full mt-4">
        <CalendarPlus className="h-3.5 w-3.5" /> Agendar visita
      </Button>
    </div>
  );
}

function formatVisitDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays === -1) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
