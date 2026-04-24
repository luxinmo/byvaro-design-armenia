/**
 * ContractSendChoiceDialog · popup de confirmación antes de subir
 * un contrato. Pregunta la INTENCIÓN:
 *
 *   A · Enviar a firmar ahora → Byvaro lo manda a Firmafy (flujo
 *                                normal). Callback `onSend()`.
 *
 *   B · Ya está firmado → el PDF viene firmado fuera de Byvaro y lo
 *                          archivamos directamente como `signed`.
 *                          Callback `onMarkSigned({ signedAt,
 *                          signedSignerIndices })`.
 *
 * Dos pasos internos:
 *   1. `choice`          · dos cards grandes.
 *   2. `signed-details`  · fecha de firma + qué firmantes firmaron
 *                          (si hay varios declarados).
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileSignature, Send, ShieldCheck, ArrowLeft, Calendar as CalendarIcon, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractSigner } from "@/lib/collaborationContracts";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function toInputDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signers: ContractSigner[];
  onSend: () => void;
  onMarkSigned: (data: { signedAt: number; signedSignerIndices: number[] }) => void;
}

type Step = "choice" | "signed-details";

export function ContractSendChoiceDialog({
  open, onOpenChange, signers, onSend, onMarkSigned,
}: Props) {
  const [step, setStep] = useState<Step>("choice");
  const [signedDate, setSignedDate] = useState(toInputDate(Date.now()));
  const [checks, setChecks] = useState<boolean[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep("choice");
    setSignedDate(toInputDate(Date.now()));
    setChecks(signers.map(() => true));
  }, [open, signers]);

  const pickSend = () => {
    onSend();
    onOpenChange(false);
  };

  const pickSigned = () => {
    if (signers.length === 0) {
      /* Sin firmantes declarados · simple confirm de fecha. */
      setStep("signed-details");
    } else {
      setStep("signed-details");
    }
  };

  const confirmSigned = () => {
    const signedAt = new Date(`${signedDate}T12:00:00`).getTime();
    const indices = checks.map((v, i) => v ? i : -1).filter((i) => i >= 0);
    onMarkSigned({ signedAt, signedSignerIndices: indices });
    onOpenChange(false);
  };

  const anySignerChecked = checks.some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "choice" ? "¿Cómo quieres subirlo?" : "Archivar como firmado"}
          </DialogTitle>
          <DialogDescription>
            {step === "choice"
              ? <>Decide si Byvaro debe mandarlo a firmar o si ya viene firmado desde fuera y solo lo archivamos.</>
              : <>Indica cuándo se firmó y quién. Quedará archivado como firmado sin pasar por Firmafy.</>
            }
          </DialogDescription>
        </DialogHeader>

        {step === "choice" && (
          <div className="py-2 space-y-2">
            {/* Card A · Enviar a firmar */}
            <button
              type="button"
              onClick={pickSend}
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

            {/* Card B · Ya firmado */}
            <button
              type="button"
              onClick={pickSigned}
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
        )}

        {step === "signed-details" && (
          <div className="py-2 space-y-4">
            <button
              type="button"
              onClick={() => setStep("choice")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              Volver
            </button>

            {/* Fecha de firma */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fecha de firma
              </label>
              <div className="relative mt-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <input
                  type="date"
                  value={signedDate}
                  max={toInputDate(Date.now())}
                  onChange={(e) => setSignedDate(e.target.value)}
                  autoFocus
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-[10.5px] text-muted-foreground mt-1">
                Por defecto hoy · no puede ser una fecha futura.
              </p>
            </div>

            {/* Firmantes que firmaron · si hay alguno declarado */}
            {signers.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  ¿Quién firmó? <span className="text-muted-foreground/70 normal-case tracking-normal">(opcional)</span>
                </label>
                <ul className="mt-1.5 space-y-1.5">
                  {signers.map((s, i) => {
                    const checked = !!checks[i];
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setChecks((prev) => prev.map((v, idx) => idx === i ? !v : v))}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors text-left",
                            checked
                              ? "border-foreground bg-foreground/5"
                              : "border-border bg-card hover:bg-muted/40",
                          )}
                        >
                          <span className={cn(
                            "h-5 w-5 rounded-[6px] border grid place-items-center shrink-0",
                            checked ? "bg-foreground border-foreground text-background" : "border-border bg-background",
                          )}>
                            {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                          <span className="h-7 w-7 rounded-full bg-muted/60 grid place-items-center shrink-0 text-[10px] font-semibold text-muted-foreground">
                            {initials(s.nombre) || "—"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground truncate">
                              {s.nombre || "(sin nombre)"}
                            </span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {s.email}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[10.5px] text-muted-foreground mt-1.5">
                  Desmarca los firmantes que no hayan firmado (si aplica).
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          {step === "signed-details" && (
            <Button
              onClick={confirmSigned}
              disabled={!signedDate || (signers.length > 0 && !anySignerChecked)}
              className="rounded-full"
            >
              <FileSignature className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
              Archivar como firmado
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
