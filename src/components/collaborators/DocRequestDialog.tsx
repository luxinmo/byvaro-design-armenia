/**
 * DocRequestDialog · solicitar un documento a la agencia.
 *
 * El promotor elige el tipo (factura, IBAN, certificado fiscal,
 * modelo trimestral, seguro RC o custom), añade una nota explicando
 * por qué lo necesita y la solicitud queda registrada. La agencia la
 * verá en su panel (futuro) y podrá subir el archivo. El promotor
 * revisa (aprobar / rechazar con motivo) desde la lista del tab
 * Documentación.
 */

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Receipt, ClipboardCheck, Landmark, FileText, Shield, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import {
  createDocRequest, DOC_REQUEST_META,
  type DocRequestType,
} from "@/lib/agencyDocRequests";

const TYPE_ORDER: DocRequestType[] = [
  "invoice", "iban", "fiscal-cert", "tax-quarter", "rc-insurance", "custom",
];

const TYPE_ICON: Record<DocRequestType, LucideIcon> = {
  invoice:       Receipt,
  iban:          Landmark,
  "fiscal-cert": ClipboardCheck,
  "tax-quarter": FileText,
  "rc-insurance":Shield,
  custom:        Sparkles,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency: Agency;
  actor?: { name: string; email: string };
}

export function DocRequestDialog({ open, onOpenChange, agency, actor }: Props) {
  const [type, setType] = useState<DocRequestType>("invoice");
  const [customLabel, setCustomLabel] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setType("invoice");
      setCustomLabel("");
      setNote("");
    }
  }, [open, agency.id]);

  const meta = DOC_REQUEST_META[type];
  const finalLabel = type === "custom" ? customLabel.trim() : meta.defaultLabel;
  const canSubmit = finalLabel.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createDocRequest({
      agencyId: agency.id,
      type,
      label: finalLabel,
      note: note.trim() || undefined,
      actor,
    });
    toast.success("Documento solicitado", {
      description: `${agency.name} lo recibirá en su panel.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar documento</DialogTitle>
          <DialogDescription>
            Pide a <span className="font-medium text-foreground">{agency.name}</span> un
            documento que necesites para pagar, auditar o firmar. La agencia lo subirá
            desde su panel y tú podrás aprobarlo aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de documento */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tipo de documento
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {TYPE_ORDER.map((t) => {
                const m = DOC_REQUEST_META[t];
                const Icon = TYPE_ICON[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                  >
                    <span className={cn(
                      "h-7 w-7 rounded-lg grid place-items-center shrink-0",
                      selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                    )}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-foreground truncate">{m.defaultLabel}</span>
                      <span className="block text-[10.5px] text-muted-foreground line-clamp-2 mt-0.5">{m.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === "custom" && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre del documento
              </label>
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Ej. Acuerdo de confidencialidad"
                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nota para la agencia (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Contexto o requisitos · ej. 'Necesitamos factura con IVA desglosado antes del día 20.'"
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-full">
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
