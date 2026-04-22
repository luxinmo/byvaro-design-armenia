/**
 * Dialog "Evaluar visita".
 *
 * Captura qué pasó realmente con la visita programada:
 *  - Realizada (default) → rating + interés + agente + fotos + feedback
 *  - Cancelada           → motivo
 *  - Reprogramada        → nueva fecha + motivo
 *
 * Una visita con `status="done"` SIN evaluation es una TAREA pendiente
 * del agente (regla de negocio · ver memoria feedback_visit_evaluation).
 *
 * Persistencia mock: byvaro.visits.evaluations.v1.
 * TODO(backend): POST /api/visits/:id/evaluation y, según outcome,
 *   actualizar el status base de la visita (cancelled / scheduled
 *   con nueva fecha) en el calendario.
 */

import { useEffect, useState } from "react";
import {
  Save, Star, CheckCircle2, XCircle, CalendarClock,
  Building2, MapPin, Calendar as CalendarIcon, User,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserSelect } from "@/components/ui/UserSelect";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import { findTeamMember } from "@/lib/team";
import { setEvaluation } from "@/components/contacts/visitEvaluationsStorage";
import { recordVisitEvaluated } from "@/components/contacts/contactEventsStorage";
import type {
  ContactVisitEntry, VisitEvaluation, VisitOutcome,
} from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id del contacto al que pertenece la visita — necesario para
   *  registrar el evento en el historial. */
  contactId: string;
  visit: ContactVisitEntry | null;
  onSaved: () => void;
};

const OUTCOMES: { value: VisitOutcome; label: string; icon: typeof CheckCircle2; color: string }[] = [
  { value: "completed",   label: "Realizada",    icon: CheckCircle2,  color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" },
  { value: "cancelled",   label: "Cancelada",    icon: XCircle,       color: "bg-destructive/15 text-destructive border-destructive/40" },
  { value: "rescheduled", label: "Reprogramada", icon: CalendarClock, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
];

const INTEREST_OPTIONS: { value: NonNullable<VisitEvaluation["clientInterest"]>; label: string; color: string }[] = [
  { value: "low",    label: "Bajo",   color: "bg-muted text-muted-foreground border-border" },
  { value: "medium", label: "Medio",  color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
  { value: "high",   label: "Alto",   color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40" },
];

export function EvaluateVisitDialog({ open, onOpenChange, contactId, visit, onSaved }: Props) {
  const user = useCurrentUser();

  const [outcome, setOutcome] = useState<VisitOutcome>("completed");
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [interest, setInterest] = useState<NonNullable<VisitEvaluation["clientInterest"]>>("medium");
  /** Guardamos el id del miembro (no el nombre) para usar UserSelect. */
  const [actualAgentId, setActualAgentId] = useState<string>(user.id);
  const [feedback, setFeedback] = useState("");
  const [rescheduledTo, setRescheduledTo] = useState<string>("");

  /* Reset al abrir (carga existente si la hay). */
  useEffect(() => {
    if (!open) return;
    const ev = visit?.evaluation;
    setOutcome(ev?.outcome ?? "completed");
    setRating((ev?.rating as 1 | 2 | 3 | 4 | 5) ?? 4);
    setInterest(ev?.clientInterest ?? "medium");
    /* Buscamos el miembro por nombre (datos antiguos) o usamos el
     * agente programado si existe. */
    const initialAgent = ev?.actualAgent
      ? findTeamMember(ev.actualAgent)?.id ?? user.id
      : visit?.agent
        ? findTeamMember(visit.agent)?.id ?? user.id
        : user.id;
    setActualAgentId(initialAgent);
    setFeedback(ev?.feedback ?? "");
    setRescheduledTo(ev?.rescheduledTo ? ev.rescheduledTo.slice(0, 16) : "");
  }, [open, visit, user.id]);

  if (!visit) return null;

  const actualAgentName = findTeamMember(actualAgentId)?.name ?? user.name;

  const canSave = (() => {
    if (outcome === "completed") return true;
    if (outcome === "cancelled") return feedback.trim().length > 0;
    if (outcome === "rescheduled") return !!rescheduledTo;
    return false;
  })();

  const save = () => {
    if (!canSave) return;
    const ev: VisitEvaluation = {
      outcome,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: user.name,
      feedback: feedback.trim() || undefined,
      ...(outcome === "completed" && {
        rating,
        clientInterest: interest,
        actualAgent: actualAgentName,
      }),
      ...(outcome === "rescheduled" && {
        rescheduledTo: new Date(rescheduledTo).toISOString(),
      }),
    };
    setEvaluation(visit.id, ev);
    recordVisitEvaluated(contactId, { name: user.name, email: user.email }, {
      promotionName: visit.promotionName,
      unit: visit.unit,
      outcome,
      rating: outcome === "completed" ? rating : undefined,
    });
    onSaved();
    onOpenChange(false);
    toast.success(
      outcome === "completed" ? "Visita evaluada"
        : outcome === "cancelled" ? "Visita marcada como cancelada"
        : "Visita reprogramada",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border/40 p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-base font-semibold">Evaluar visita</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Header visual de la promoción que se visitó */}
          <PromotionHeader visit={visit} />

          {/* Outcome */}
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-2">
              ¿Qué pasó con la visita?
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {OUTCOMES.map((o) => {
                const Icon = o.icon;
                const active = outcome === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOutcome(o.value)}
                    className={cn(
                      "h-auto py-2.5 px-2 rounded-xl text-[11px] font-medium border transition-colors flex flex-col items-center gap-1",
                      active ? o.color : "bg-card text-muted-foreground border-border hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Si REALIZADA ── */}
          {outcome === "completed" && (
            <>
              <div>
                <label className="text-[12px] font-medium text-foreground block mb-2">
                  Calidad de la visita
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                      className={cn(
                        "h-9 w-9 rounded-lg grid place-items-center transition-colors",
                        n <= rating ? "text-amber-500" : "text-muted-foreground/30 hover:text-muted-foreground",
                      )}
                      aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
                    >
                      <Star className={cn("h-5 w-5", n <= rating && "fill-current")} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-foreground block mb-2">
                  Interés del cliente
                </label>
                <div className="flex items-center gap-1.5">
                  {INTEREST_OPTIONS.map((o) => {
                    const active = interest === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setInterest(o.value)}
                        className={cn(
                          "h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                          active ? o.color : "bg-card text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-foreground block mb-2 inline-flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Agente que la realizó
                </label>
                <UserSelect
                  value={actualAgentId}
                  onChange={setActualAgentId}
                  required
                />
                {actualAgentName !== visit.agent && (
                  <p className="text-[10.5px] text-muted-foreground mt-1">
                    Visita reasignada (programada con {visit.agent}).
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Si REPROGRAMADA ── */}
          {outcome === "rescheduled" && (
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">
                Nueva fecha y hora
              </label>
              <Input
                type="datetime-local"
                value={rescheduledTo}
                onChange={(e) => setRescheduledTo(e.target.value)}
              />
            </div>
          )}

          {/* Feedback / motivo (siempre visible) */}
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-2">
              {outcome === "completed" ? "Comentario interno" :
               outcome === "cancelled" ? "Motivo de la cancelación" :
               "Motivo del cambio (opcional)"}
              {outcome === "cancelled" && <span className="text-destructive ml-1">*</span>}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={
                outcome === "completed" ? "Qué pasó, qué unidades vio, próximo paso…" :
                outcome === "cancelled" ? "¿Por qué se canceló?" :
                "¿Por qué se cambió la fecha?"
              }
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-5 py-3.5 border-t border-border/40 bg-card flex-row sm:justify-between gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!canSave} className="rounded-full">
            <Save className="h-3.5 w-3.5" /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════ Header visual de la promoción visitada ══════
 *  Da contexto al evaluar: el agente ve qué visita está evaluando sin
 *  tener que recordarlo. Cuando el modelo de promoción tenga foto real,
 *  reemplazar el placeholder por <img>. */
function PromotionHeader({ visit }: { visit: ContactVisitEntry }) {
  const date = new Date(visit.scheduledAt);
  const dateLabel = date.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
  const timeLabel = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
      {/* TODO(backend): cuando el modelo Promotion tenga `coverImageUrl`,
       *  reemplazar este placeholder por <img src={cover} ... />. */}
      <div className="h-14 w-20 rounded-xl bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/15 grid place-items-center text-foreground/60 shrink-0">
        <Building2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{visit.promotionName}</span>
          {visit.unit && <span className="text-muted-foreground font-normal">· {visit.unit}</span>}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
          <CalendarIcon className="h-3 w-3" />
          <span className="capitalize">{dateLabel}</span>
          <span className="tnum">· {timeLabel}</span>
        </p>
      </div>
    </div>
  );
}
