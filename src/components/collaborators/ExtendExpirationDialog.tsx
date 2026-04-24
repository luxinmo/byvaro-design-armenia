/**
 * ExtendExpirationDialog · extiende la fecha de vencimiento de un
 * contrato enviado a firmar. Firmafy permite mutarla con
 * `action=editar_vencimiento` (equivalente) · el backend traduce.
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { useCurrentUser } from "@/lib/currentUser";
import { extendContractExpiration } from "@/lib/collaborationContracts";

function toInputDate(ms?: number): string {
  const d = ms ? new Date(ms) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  currentExpiresAt?: number;
}

export function ExtendExpirationDialog({ open, onOpenChange, contractId, currentExpiresAt }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const [dateStr, setDateStr] = useState("");

  useEffect(() => { if (open) setDateStr(toInputDate(currentExpiresAt)); }, [open, currentExpiresAt]);

  const nextMs = dateStr ? new Date(dateStr + "T23:00:00").getTime() : 0;
  const valid = Number.isFinite(nextMs) && nextMs > Date.now();
  const isExtension = currentExpiresAt && nextMs > currentExpiresAt;

  const handleSubmit = () => {
    if (!valid) return;
    extendContractExpiration(contractId, nextMs, actor);
    toast.success("Vencimiento actualizado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Extender vencimiento</DialogTitle>
          <DialogDescription>
            Amplía el plazo de firma. Firmafy vuelve a notificar a los firmantes
            que no hayan completado aún.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nueva fecha de vencimiento
          </label>
          <div className="relative">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              min={toInputDate(Date.now())}
              autoFocus
              className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {currentExpiresAt && valid && !isExtension && (
            <p className="text-[11px] text-warning">
              La fecha nueva es anterior a la actual · se reducirá el plazo.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!valid} className="rounded-full">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
