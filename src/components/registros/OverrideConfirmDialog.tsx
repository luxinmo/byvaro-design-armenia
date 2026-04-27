/**
 * OverrideConfirmDialog — confirma aprobación a pesar de match alto.
 *
 * Cuando el promotor decide aprobar un registro entrante con
 * `matchPercentage >= 70` (posible duplicado), debe explicar
 * obligatoriamente por qué · justificación queda en el historial
 * cross-empresa para auditoría futura ante disputa de comisión.
 *
 * Persistencia · `Registro.overrideNote/At/ByUserId` (Phase 2).
 *
 * Trigger en el approval state machine: si `matchPercentage >= 70`,
 * el promotor pasa por `match` (`MatchConfirmDialog`) y luego por
 * `override` (este dialog) antes del `terms` (T&C) final.
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Eye } from "lucide-react";
import type { Registro } from "@/data/records";

const MIN_NOTE_LENGTH = 10;

type Props = {
  open: boolean;
  onClose: () => void;
  record: Registro;
  onConfirm: (payload: { overrideNote: string }) => void;
};

export function OverrideConfirmDialog({ open, onClose, record, onConfirm }: Props) {
  const [note, setNote] = useState("");
  const canSubmit = note.trim().length >= MIN_NOTE_LENGTH;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({ overrideNote: note.trim() });
    setNote("");
    onClose();
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive grid place-items-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <DialogTitle>Aprobar a pesar del duplicado</DialogTitle>
          </div>
          <DialogDescription>
            Estás aprobando un registro que matchea al{" "}
            <strong>{record.matchPercentage}%</strong> con un cliente
            existente. La decisión queda auditada en historial
            cross-empresa · explica por qué la apruebas igualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {record.matchWith && (
            <div className="rounded-lg bg-muted/50 border border-border px-3.5 py-2.5 inline-flex items-start gap-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-[11.5px] text-foreground leading-relaxed">
                <span className="font-medium">Match detectado:</span>{" "}
                {record.matchWith}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Motivo del override · obligatorio
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Ej. la otra agencia lleva 47 días sin actividad · cliente confirma que ya no trabaja con ellos · prefiere a Prime Properties"
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:border-primary outline-none resize-none"
              autoFocus
            />
            <span className="text-[10.5px] text-muted-foreground">
              Mínimo {MIN_NOTE_LENGTH} caracteres ·{" "}
              <span className={note.trim().length >= MIN_NOTE_LENGTH ? "text-success" : "text-warning"}>
                {note.trim().length}/{MIN_NOTE_LENGTH}
              </span>{" "}
              · queda visible en el historial de la agencia anterior.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="rounded-full">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Confirmar override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
