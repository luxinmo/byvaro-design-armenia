/**
 * EmailPreviewDialog — visor del email transaccional simulado.
 *
 * Mientras no haya backend, "enviar un email" significa generar el
 * HTML con la plantilla y mostrarlo al usuario en un dialog. Esto da
 * dos cosas:
 *  - Confianza al diseñador / usuario de que la plantilla queda bien.
 *  - Manera fácil de leer el código en local sin tener email real.
 *
 * Cuando exista backend, este componente sigue siendo útil como
 * preview de admin / debug. La función `sendEmail()` real reemplaza
 * el `console.log` y el dialog se vuelve opt-in (modo dev).
 */

import { useState } from "react";
import { Mail, Eye, FileText, Copy, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { RenderedEmail } from "@/lib/email-templates/types";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Email destinatario. */
  to: string;
  /** Email renderizado (subject + html + text). */
  email: RenderedEmail;
};

export function EmailPreviewDialog({ open, onOpenChange, to, email }: Props) {
  const [view, setView] = useState<"html" | "text">("html");
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    await navigator.clipboard.writeText(email.text);
    setCopied(true);
    toast.success("Texto del email copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-muted/30 border-border/40 p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 py-4 border-b border-border/40 bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-foreground text-background grid place-items-center shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{email.subject}</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Para: <span className="text-foreground">{to}</span>
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-1 shrink-0">
              Preview
            </span>
          </div>

          <div className="flex items-center gap-1 mt-3 -mb-1">
            <button onClick={() => setView("html")}
              className={cn("h-8 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "html" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <Eye className="h-3.5 w-3.5" /> HTML
            </button>
            <button onClick={() => setView("text")}
              className={cn("h-8 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                view === "text" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <FileText className="h-3.5 w-3.5" /> Texto plano
            </button>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={copyText} className="rounded-full h-8 text-xs">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-[#F4F4F5]">
          {view === "html" ? (
            <iframe
              title="email-preview"
              srcDoc={email.html}
              className="w-full bg-transparent"
              style={{ border: "none", minHeight: "70vh" }}
            />
          ) : (
            <pre className="p-6 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground bg-card m-4 rounded-xl border border-border/40 font-mono">
              {email.text}
            </pre>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border/40 bg-card flex justify-end">
          <Button onClick={() => onOpenChange(false)} variant="outline" className="rounded-full" size="sm">
            Cerrar preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
