/**
 * VisitActionDialogs — diálogos de gestión de visita asociada a un
 * registro en estado `preregistro_activo`.
 *
 * Tres acciones canónicas (ver `docs/registration-system.md §2.3`
 * + bloque A del plan Phase 2):
 *
 *   · RescheduleVisitDialog · cambiar fecha/hora · max 2 reprogramaciones
 *     antes de obligar a cancelar y crear nuevo registro.
 *   · CancelVisitDialog (vista agencia) · 2 motivos: cliente desistió
 *     o renuncia agencia. El segundo cuenta en track record.
 *   · CancelVisitDialog (vista promotor) · campo libre de motivo.
 *     NO penaliza a la agencia.
 *
 * Cada acción retorna el outcome al caller para que mute el state
 * de Registros (transición de estado + log timeline + notificación).
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock, Ban, AlertTriangle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisitOutcome } from "@/data/records";

/* ══════ Reschedule ══════════════════════════════════════════════ */

type RescheduleProps = {
  open: boolean;
  onClose: () => void;
  /** Fecha/hora actuales · prefill del form. */
  currentDate?: string;       // YYYY-MM-DD
  currentTime?: string;       // HH:mm
  /** Cuántas reprogramaciones se han usado ya · cap a 2. */
  reprogramacionesCount: number;
  /** Callback con la nueva fecha + nota opcional. */
  onConfirm: (payload: { newDate: string; newTime: string; note?: string }) => void;
};

const MAX_REPROGRAMACIONES = 2;

export function RescheduleVisitDialog({
  open, onClose, currentDate, currentTime, reprogramacionesCount, onConfirm,
}: RescheduleProps) {
  const [date, setDate] = useState(currentDate ?? "");
  const [time, setTime] = useState(currentTime ?? "");
  const [note, setNote] = useState("");
  const remaining = MAX_REPROGRAMACIONES - reprogramacionesCount;
  const exhausted = remaining <= 0;
  const canSubmit = !exhausted && !!date && !!time;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({ newDate: date, newTime: time, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <CalendarClock className="h-4 w-4" />
            </div>
            <DialogTitle>Cambiar fecha de visita</DialogTitle>
          </div>
          <DialogDescription>
            {exhausted
              ? "Has usado las 2 reprogramaciones permitidas · cancela la visita y crea un nuevo registro si lo necesitas."
              : `Reprogramaciones usadas: ${reprogramacionesCount}/${MAX_REPROGRAMACIONES}. Quedan ${remaining}.`}
          </DialogDescription>
        </DialogHeader>

        {!exhausted && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nueva fecha</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hora</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Motivo (opcional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ej. cliente fuera ese día · prefiere mañana"
                className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none resize-none"
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Confirmar cambio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════ Cancel · vista agencia ══════════════════════════════════ */

type CancelAgencyProps = {
  open: boolean;
  onClose: () => void;
  /** Outcome elegido · transmitido al caller para que mute estado. */
  onConfirm: (payload: { outcome: VisitOutcome; note?: string }) => void;
  /** Label dinámico del owner de la promoción · "el promotor" o
   *  "el comercializador". Si no se pasa, default "el destinatario". */
  ownerArticle?: string;
};

export function CancelVisitAgencyDialog({ open, onClose, onConfirm, ownerArticle = "el destinatario" }: CancelAgencyProps) {
  const [outcome, setOutcome] = useState<VisitOutcome | null>(null);
  const [note, setNote] = useState("");
  const canSubmit = !!outcome;

  const handleSubmit = () => {
    if (!outcome) return;
    onConfirm({ outcome, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive grid place-items-center shrink-0">
              <Ban className="h-4 w-4" />
            </div>
            <DialogTitle>Cancelar visita</DialogTitle>
          </div>
          <DialogDescription>
            Al cancelar, el cliente queda <strong>liberado</strong>: cualquier
            otra agencia o el promotor podrán registrarlo de nuevo. Tu
            preregistro pasará a "Caducado".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {([
            {
              v: "no_show_cliente" as const,
              icon: UserX,
              title: "El cliente desistió",
              desc: "El cliente no quiere visitar la promoción. No afecta a tu track record.",
            },
            {
              v: "cancelada_agencia" as const,
              icon: AlertTriangle,
              title: "No la voy a hacer",
              desc: `Renuncia interna. Cuenta como cancelación de la agencia · puede afectar el track record con ${ownerArticle}.`,
            },
          ]).map((opt) => {
            const active = outcome === opt.v;
            const Icon = opt.icon;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => setOutcome(opt.v)}
                className={cn(
                  "w-full text-left flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                )}
              >
                <div className={cn(
                  "h-7 w-7 rounded-lg grid place-items-center shrink-0 mt-0.5",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">{opt.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </button>
            );
          })}
          <label className="flex flex-col gap-1 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nota (opcional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`Contexto adicional para ${ownerArticle}`}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none resize-none"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Volver</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Cancelar visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════ Cancel · vista promotor ══════════════════════════════════ */

type CancelPromoterProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: { outcome: VisitOutcome; note: string }) => void;
  /** Label dinámico para el título · "Promotor" o "Comercializador".
   *  Si no se pasa, default "Promotor" (retrocompatibilidad). */
  ownerLabel?: string;
};

export function CancelVisitPromoterDialog({ open, onClose, onConfirm, ownerLabel = "Promotor" }: CancelPromoterProps) {
  const [note, setNote] = useState("");
  const canSubmit = note.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({ outcome: "cancelada_promotor", note: note.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center shrink-0">
              <Ban className="h-4 w-4" />
            </div>
            <DialogTitle>Cancelar visita ({ownerLabel.toLowerCase()})</DialogTitle>
          </div>
          <DialogDescription>
            Vas a cancelar tú la visita. La agencia recibirá una notificación
            con el motivo · NO afecta a su track record. Si solo quieres
            cambiar la fecha, usa "Cambiar fecha" mejor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Motivo · obligatorio
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ej. obra cerrada esa fecha · agente no disponible · cambio de plan en la promoción…"
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none resize-none"
            />
            <span className="text-[10.5px] text-muted-foreground">
              Mínimo 5 caracteres · queda en el historial cross-empresa.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Volver</Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            Cancelar visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
