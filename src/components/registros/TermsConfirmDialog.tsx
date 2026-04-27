/**
 * TermsConfirmDialog — último step de aprobación · términos legales.
 *
 * Antes de transitar el registro a `aprobado` o `preregistro_activo`,
 * el promotor debe confirmar explícitamente que reconoce la
 * atribución al colaborador. Persiste `approvedTermsVersion/At` en el
 * Registro para auditoría · imprescindible si después hay disputa
 * por comisión.
 *
 * Ver `docs/registration-system.md §C "T&C popup en aprobación"`.
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScrollText, Crown } from "lucide-react";
import { getRegistrationTerms } from "@/lib/legalTerms";

type Props = {
  open: boolean;
  onClose: () => void;
  modo: "directo" | "por_visita";
  vars: {
    agencia?: string;
    cliente?: string;
    promocion?: string;
  };
  onConfirm: (payload: { termsVersion: string; termsAcceptedAt: string }) => void;
};

export function TermsConfirmDialog({ open, onClose, modo, vars, onConfirm }: Props) {
  const [accepted, setAccepted] = useState(false);
  const terms = getRegistrationTerms(modo, vars);

  const handleConfirm = () => {
    if (!accepted) return;
    onConfirm({
      termsVersion: terms.version,
      termsAcceptedAt: new Date().toISOString(),
    });
    setAccepted(false);
    onClose();
  };

  const handleClose = () => {
    setAccepted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <ScrollText className="h-4 w-4" />
            </div>
            <DialogTitle>Confirma la atribución</DialogTitle>
          </div>
          <DialogDescription>
            Antes de aprobar, lee y acepta los términos de la atribución.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
            <p className="text-[12.5px] text-foreground leading-relaxed">
              {terms.body}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-2 inline-flex items-center gap-1.5 tabular-nums">
              <Crown className="h-3 w-3" />
              Términos {terms.version} · queda registrado en el historial.
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border bg-card px-3.5 py-3 hover:bg-muted/30 transition-colors">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <span className="text-[12.5px] text-foreground leading-relaxed">
              He leído y acepto los términos de la atribución. Reconozco que
              esta decisión queda auditada en el historial cross-empresa.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="rounded-full">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!accepted}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Confirmar y aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
