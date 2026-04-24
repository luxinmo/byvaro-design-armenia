/**
 * ContractNewChoiceDialog · popup inicial al crear un contrato
 * nuevo. Pregunta la intención antes de abrir el form correcto:
 *
 *   A · Enviar a firmar ahora  → abre `ContractUploadDialog`
 *                                 (wizard 3 pasos · Firmafy).
 *   B · Ya está firmado        → abre `ContractSignedUploadDialog`
 *                                 (form sencillo · archivo histórico).
 *
 * El popup sirve para separar dos flujos radicalmente distintos:
 * uno necesita idioma/asunto/mensaje/expiración porque el email va a
 * salir; el otro solo necesita PDF + firmantes + fecha de firma.
 */

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Send, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPickSend: () => void;
  onPickSigned: () => void;
}

export function ContractNewChoiceDialog({ open, onOpenChange, onPickSend, onPickSigned }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo contrato de colaboración</DialogTitle>
          <DialogDescription>
            Decide si Byvaro debe mandarlo a firmar o si ya viene firmado
            desde fuera y solo lo archivamos.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <button
            type="button"
            onClick={() => { onPickSend(); onOpenChange(false); }}
            className="w-full text-left rounded-2xl border border-border bg-card hover:border-foreground/30 hover:shadow-soft-lg transition-all p-4 flex items-start gap-3"
          >
            <span className="h-10 w-10 rounded-lg bg-foreground text-background grid place-items-center shrink-0">
              <Send className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Enviar a firmar ahora</p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                Byvaro lo manda a Firmafy · los firmantes reciben email/SMS con enlace y firman con OTP.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { onPickSigned(); onOpenChange(false); }}
            className="w-full text-left rounded-2xl border border-border bg-card hover:border-foreground/30 hover:shadow-soft-lg transition-all p-4 flex items-start gap-3"
          >
            <span className="h-10 w-10 rounded-lg bg-success/10 text-success grid place-items-center shrink-0">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Ya está firmado</p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
                Archivamos el PDF como firmado sin enviar nada. Útil para contratos firmados a mano o fuera de Byvaro.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
