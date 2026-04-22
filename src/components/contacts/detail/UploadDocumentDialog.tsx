/**
 * Dialog "Subir documento".
 *
 * File picker real → FileReader → guardar en
 * `byvaro.contact.<id>.documents.v1` con dataUrl, categoría y nombre.
 *
 * Cap 1.5 MB / archivo (límite localStorage). Para producción real
 * el archivo se sube a S3 / equivalente y guardamos solo metadatos
 * + URL firmada.
 */

import { useEffect, useRef, useState } from "react";
import {
  Save, Upload, FileText, IdCard, Briefcase, Folder, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import {
  addDocument, type StoredDocument,
} from "@/components/contacts/contactDocumentsStorage";
import { recordDocumentUploaded } from "@/components/contacts/contactEventsStorage";
import type { ContactDocumentEntry } from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onSaved: () => void;
};

const MAX_DOC_KB = 1500;

const CATEGORIES: {
  value: ContactDocumentEntry["category"];
  label: string;
  icon: typeof FileText;
  description: string;
}[] = [
  { value: "id",         label: "Identidad",  icon: IdCard,    description: "DNI, pasaporte, NIE…" },
  { value: "legal",      label: "Legal",      icon: FileText,  description: "Contratos, escrituras, poderes…" },
  { value: "commercial", label: "Comercial",  icon: Briefcase, description: "Ofertas, presupuestos, fichas técnicas…" },
  { value: "other",      label: "Otros",      icon: Folder,    description: "Cualquier otro documento." },
];

export function UploadDocumentDialog({ open, onOpenChange, contactId, onSaved }: Props) {
  const user = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ContactDocumentEntry["category"]>("legal");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDataUrl("");
      setName("");
      setCategory("legal");
    }
  }, [open]);

  const onFilePicked = (f: File) => {
    if (f.size > MAX_DOC_KB * 1024) {
      toast.error(`El archivo supera ${MAX_DOC_KB / 1000} MB. Comprime antes de subir.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile(f);
      setDataUrl(String(reader.result));
      /* Si el usuario aún no ha tocado el nombre, lo pre-rellenamos
       * con el nombre del archivo (sin extensión). */
      if (!name.trim()) {
        setName(f.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.readAsDataURL(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFilePicked(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFilePicked(f);
  };

  const canSave = !!file && !!dataUrl && name.trim().length > 0;

  const save = () => {
    if (!canSave || !file) return;
    const doc: StoredDocument = {
      id: `doc-${Date.now()}`,
      name: name.trim() + (file.name.match(/\.[^.]+$/)?.[0] ?? ""),
      category,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name,
      dataUrl,
    };
    addDocument(contactId, doc);
    recordDocumentUploaded(contactId, { name: user.name, email: user.email }, doc.name);
    onSaved();
    onOpenChange(false);
    toast.success(`Documento subido · ${doc.name}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/40 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Subir documento</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-5 space-y-5">

          {/* File picker */}
          {!file ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center cursor-pointer hover:border-foreground/40 transition-colors bg-muted/20"
            >
              <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-2">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Arrastra un archivo o pulsa</p>
              <p className="text-[11px] text-muted-foreground mt-1">PDF, imagen, doc · máx {MAX_DOC_KB / 1000} MB</p>
              <input
                ref={inputRef}
                type="file"
                hidden
                onChange={onInputChange}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="h-10 w-10 rounded-xl bg-foreground/10 grid place-items-center text-foreground shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                <p className="text-[10.5px] text-muted-foreground tnum">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => { setFile(null); setDataUrl(""); }}
                className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Nombre */}
          {file && (
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">
                Nombre del documento <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. DNI escaneado · Contrato reserva"
                autoFocus
              />
            </div>
          )}

          {/* Categoría */}
          {file && (
            <div>
              <label className="text-[12px] font-medium text-foreground block mb-2">
                Categoría
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "text-left p-2.5 rounded-xl border transition-colors flex items-start gap-2",
                        active
                          ? "border-foreground bg-foreground/5"
                          : "border-border bg-card hover:border-foreground/30",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{c.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug truncate">{c.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3.5 border-t border-border/40 bg-card flex-row sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!canSave} className="rounded-full">
            <Save className="h-3.5 w-3.5" /> Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
