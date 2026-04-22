/**
 * Dialog "Vista previa de documento".
 *
 * Soporta:
 *  - Imágenes (img/* → <img>)
 *  - PDFs (application/pdf → <iframe>)
 *  - Otros tipos: muestra info + botón descargar (no podemos previsualizar todo).
 *
 * Solo los documentos subidos localmente tienen `dataUrl` real. Para los
 * del seed mock, mostramos un placeholder explicativo.
 */

import {
  Download, X, FileText, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContactDocumentEntry } from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: (ContactDocumentEntry & { dataUrl?: string; local?: boolean }) | null;
};

export function DocumentPreviewDialog({ open, onOpenChange, document: doc }: Props) {
  if (!doc) return null;

  const dataUrl = doc.dataUrl;
  const mime = dataUrlMime(dataUrl);
  const isImage = mime?.startsWith("image/") ?? /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(doc.name);
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(doc.name);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = window.document.createElement("a");
    a.href = dataUrl;
    a.download = doc.name;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border/40 p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-border/40 flex-row items-center gap-3 space-y-0 shrink-0">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold truncate">{doc.name}</DialogTitle>
            <p className="text-[11px] text-muted-foreground truncate">
              {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString("es-ES")} · {doc.uploadedBy}
            </p>
          </div>
          {dataUrl && (
            <Button onClick={handleDownload} variant="outline" size="sm" className="rounded-full shrink-0">
              <Download className="h-3.5 w-3.5" /> Descargar
            </Button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/30">
          {!dataUrl ? (
            <NotPreviewable message="Documento de demostración (seed). No tiene archivo real para previsualizar." />
          ) : isImage ? (
            <div className="p-4 grid place-items-center min-h-[300px]">
              <img
                src={dataUrl}
                alt={doc.name}
                className="max-w-full max-h-[70vh] rounded-xl shadow-soft"
              />
            </div>
          ) : isPdf ? (
            <iframe
              title={doc.name}
              src={dataUrl}
              className="w-full bg-card border-0"
              style={{ height: "70vh" }}
            />
          ) : (
            <NotPreviewable
              message="Vista previa no disponible para este tipo de archivo."
              action={
                <Button onClick={handleDownload} size="sm" className="rounded-full mt-3">
                  <Download className="h-3.5 w-3.5" /> Descargar archivo
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NotPreviewable({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center text-center py-16 px-6">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {action}
    </div>
  );
}

function dataUrlMime(dataUrl?: string): string | null {
  if (!dataUrl) return null;
  const m = /^data:([^;]+);/.exec(dataUrl);
  return m ? m[1] : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
