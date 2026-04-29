/**
 * ContractSignedUploadDialog · archivar un contrato YA firmado (fuera
 * de Byvaro) sin pasar por Firmafy.
 *
 * Form sencillo · sin wizard ni pasos. Captura lo mínimo para
 * archivar con trazabilidad:
 *   · PDF del contrato firmado.
 *   · Título.
 *   · Comisión + duración (opcional · tipo metadata).
 *   · Firmantes que firmaron · via `SignerPickerDialog` como el wizard.
 *   · Fecha de firma · default hoy · máximo hoy.
 *
 * Al confirmar, crea el contrato con `status: signed` directamente.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileSignature, Upload, X, Plus, Calendar as CalendarIcon, Pencil,
  CheckCircle2, AlertTriangle, ShieldCheck, Check, Trash2,
} from "lucide-react";
import { PdfIcon } from "@/components/icons/PdfIcon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import {
  uploadContract,
  type ContractSigner,
} from "@/lib/collaborationContracts";
import { recordContractSigned, recordCompanyAny } from "@/lib/companyEvents";
import { SignerPickerDialog } from "./SignerPickerDialog";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function isValidEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); }
function isValidNif(s: string) {
  const v = s.trim().toUpperCase();
  if (!v) return false;
  return /^[0-9]{7,8}[A-Z]$/.test(v)
      || /^[XYZ][0-9]{7}[A-Z]$/.test(v)
      || /^[A-Z0-9]{6,12}$/.test(v);
}
function isValidPhone(s: string) {
  const v = s.replace(/[\s-]/g, "");
  return /^\+?[0-9]{9,15}$/.test(v);
}
function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function toInputDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Draft = ContractSigner & { juridica?: boolean };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency: Agency;
  actor?: { name: string; email: string };
  /** Promociones que cubre el contrato · si se omite, cubre todas. */
  defaultScopePromotionIds?: string[];
  /** Si se indica, sustituye a los contratos listados (renovación) ·
   *  los antiguos se archivan auto al subir. */
  defaultReplacesContractIds?: string[];
}

export function ContractSignedUploadDialog({ open, onOpenChange, agency, actor, defaultScopePromotionIds, defaultReplacesContractIds }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [comision, setComision] = useState<string>("");
  const [duracionMeses, setDuracionMeses] = useState<string>("12");
  const [signers, setSigners] = useState<Draft[]>([]);
  const [signedDate, setSignedDate] = useState(toInputDate(Date.now()));
  const [dragging, setDragging] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  /* Al cambiar el listado, purgar índices obsoletos. */
  useEffect(() => {
    setSelectedFiles((prev) => new Set([...prev].filter((i) => i < files.length)));
  }, [files.length]);
  const toggleSelectFile = (idx: number) => setSelectedFiles((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });
  const removeSelectedFiles = () => {
    const idxs = [...selectedFiles].sort((a, b) => b - a);
    setFiles((prev) => prev.filter((_, i) => !idxs.includes(i)));
    setSelectedFiles(new Set());
  };

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setTitle(`Contrato firmado · ${agency.name}`);
    setComision(agency.comisionMedia ? String(agency.comisionMedia) : "");
    setDuracionMeses("12");
    setSigners([]);
    setSignedDate(toInputDate(Date.now()));
    setDragging(false);
    setEditingIdx(null);
  }, [open, agency.id, agency.name, agency.comisionMedia]);

  /** Añade uno o varios PDFs al listado (dedupe). */
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`${f.name} no es un PDF`); return false;
      }
      return true;
    });
    if (arr.length === 0) return;
    setFiles((prev) => {
      const key = (f: File) => `${f.name}·${f.size}`;
      const existing = new Set(prev.map(key));
      return [...prev, ...arr.filter((f) => !existing.has(key(f)))];
    });
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  /* Archivo ya firmado · firmantes OPCIONALES. Solo exigimos nombre
     si el usuario añade alguno (no ensuciamos la lista con entries
     sin identificar). Email/NIF/teléfono son opcionales. */
  const signerValidity = useMemo(
    () => signers.map((s) => {
      const missing: string[] = [];
      if (!s.nombre.trim()) missing.push("nombre");
      return { signer: s, missing, valid: missing.length === 0 };
    }),
    [signers],
  );
  const validSigners = signerValidity.filter((x) => x.valid);
  const canSubmit = files.length > 0 && title.trim().length > 0 && !!signedDate;

  const handlePickerAdd = (signer: ContractSigner) => {
    const draft: Draft = { ...signer, juridica: !!(signer.empresa || signer.cif) };
    if (editingIdx != null) {
      setSigners((prev) => prev.map((s, i) => i === editingIdx ? draft : s));
      setEditingIdx(null);
    } else {
      setSigners((prev) => [...prev, draft]);
    }
  };

  const handleSubmit = () => {
    if (files.length === 0) return;
    const finalSigners: ContractSigner[] = validSigners.map((x) => {
      const s = x.signer;
      return {
        nombre: s.nombre.trim(),
        email: s.email.trim().toLowerCase(),
        nif: s.nif.trim().toUpperCase(),
        telefono: s.telefono.trim(),
        cargo: s.cargo?.trim() || undefined,
        empresa: s.juridica && s.empresa ? s.empresa.trim() : undefined,
        cif: s.juridica && s.cif ? s.cif.trim().toUpperCase() : undefined,
        notifications: s.notifications,
      };
    });
    const signedAt = new Date(`${signedDate}T12:00:00`).getTime();
    const baseTitle = title.trim();
    /* Un contrato por PDF · si hay varios, sufijamos con el nombre
       del fichero para distinguirlos en la lista. */
    for (const f of files) {
      const ctTitle = files.length === 1
        ? baseTitle
        : `${baseTitle} · ${f.name.replace(/\.pdf$/i, "")}`;
      const ct = uploadContract({
        agencyId: agency.id,
        title: ctTitle,
        pdfFilename: f.name,
        pdfSize: f.size,
        signers: finalSigners,
        comision: comision ? Number(comision) : undefined,
        duracionMeses: duracionMeses ? Number(duracionMeses) : undefined,
        scopePromotionIds: defaultScopePromotionIds,
        alreadySignedAt: signedAt,
        replacesContractIds: defaultReplacesContractIds,
        actor,
      });
      recordContractSigned(agency.id, actor ?? { name: "Fuera de Byvaro" }, ct.title);
      recordCompanyAny(agency.id, "contract_signed",
        "Contrato archivado como firmado",
        `${ct.title} · firmado fuera de Byvaro`, actor);
    }
    toast.success(
      files.length === 1
        ? "Archivado como firmado"
        : `${files.length} contratos archivados como firmados`,
      { description: finalSigners.length > 0
          ? `${finalSigners.length} firmante${finalSigners.length === 1 ? "" : "s"}`
          : "Sin firmantes declarados" },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" strokeWidth={1.75} />
            <DialogTitle>Archivar contrato firmado</DialogTitle>
          </div>
          <DialogDescription>
            Sube un PDF que ya viene firmado fuera de Byvaro. Lo
            guardamos con trazabilidad (fecha y firmantes) pero no lo
            enviamos a nadie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* PDFs firmados · multi-file */}
          <div>
            <Label>
              {files.length === 0
                ? "Archivos PDF firmados"
                : `${files.length} ${files.length === 1 ? "archivo PDF" : "archivos PDF"}`}
            </Label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              className={cn(
                "mt-1.5 block cursor-pointer rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors",
                dragging ? "border-foreground/40 bg-muted/40" : "border-border bg-muted/20 hover:border-foreground/20",
              )}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                className="sr-only"
              />
              <Upload className="h-5 w-5 text-muted-foreground/60 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground">
                {files.length === 0 ? "Arrastra PDFs firmados aquí o haz click" : "Añadir más archivos"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Puedes subir uno o varios · cada PDF se archiva como un contrato firmado independiente.
              </p>
            </label>

            {/* Toolbar selección · aparece con ≥1 marcado */}
            {files.length > 0 && selectedFiles.size > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2">
                <p className="text-[11.5px] text-foreground tabular-nums">
                  <span className="font-semibold">{selectedFiles.size}</span>{" "}
                  {selectedFiles.size === 1 ? "archivo seleccionado" : "archivos seleccionados"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFiles(new Set())}
                    className="h-7 px-2.5 inline-flex items-center rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectedFiles}
                    className="h-7 px-3 inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold hover:bg-destructive/90 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2} />
                    Quitar {selectedFiles.size}
                  </button>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => {
                  const isSelected = selectedFiles.has(i);
                  return (
                    <li
                      key={`${f.name}-${f.size}-${i}`}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                        isSelected
                          ? "border-foreground/30 bg-foreground/5"
                          : "border-border bg-card hover:bg-muted/30",
                      )}
                    >
                      <div className="relative h-9 w-9 shrink-0">
                        <span className={cn(
                          "absolute inset-0 grid place-items-center transition-opacity duration-150",
                          isSelected ? "opacity-0" : "opacity-100 group-hover:opacity-0",
                        )}>
                          <PdfIcon className="h-7 w-6 text-muted-foreground/80" />
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSelectFile(i)}
                          aria-pressed={isSelected}
                          aria-label={isSelected ? `Deseleccionar ${f.name}` : `Seleccionar ${f.name}`}
                          className={cn(
                            "absolute inset-0 h-9 w-9 rounded-lg border grid place-items-center transition-all duration-150",
                            isSelected
                              ? "opacity-100 bg-foreground border-foreground text-background"
                              : "opacity-0 group-hover:opacity-100 border-border bg-card hover:border-foreground/40 text-transparent hover:text-foreground",
                          )}
                        >
                          {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{formatSize(f.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Quitar ${f.name}`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Título */}
          <div>
            <Label>
              {files.length > 1 ? "Título base (se añadirá el nombre de cada PDF)" : "Título"}
            </Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Fecha + comisión/duración (compacto) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Fecha de firma</Label>
              <div className="relative mt-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <input
                  type="date"
                  value={signedDate}
                  max={toInputDate(Date.now())}
                  onChange={(e) => setSignedDate(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <Label>Comisión (%)</Label>
              <input
                type="number" step="0.1" min="0" max="20"
                value={comision} onChange={(e) => setComision(e.target.value)}
                placeholder="5"
                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <Label>Duración (m)</Label>
              <input
                type="number" step="1" min="0"
                value={duracionMeses} onChange={(e) => setDuracionMeses(e.target.value)}
                placeholder="12"
                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Firmantes · mismo picker */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <Label>Firmantes que firmaron</Label>
            </div>
            {signers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
                <p className="text-sm font-medium text-foreground">Añade al menos un firmante</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm mx-auto">
                  Elige de los contactos conocidos o crea uno nuevo.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {signerValidity.map((v, i) => (
                  <SignerCompact
                    key={i}
                    signer={v.signer}
                    valid={v.valid}
                    missing={v.missing}
                    onEdit={() => { setEditingIdx(i); setPickerOpen(true); }}
                    onRemove={() => setSigners((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => { setEditingIdx(null); setPickerOpen(true); }}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-2.5 hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Añadir firmante
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-full">
            <FileSignature className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
            Archivar como firmado
          </Button>
        </DialogFooter>
      </DialogContent>

      <SignerPickerDialog
        open={pickerOpen}
        onOpenChange={(v) => { setPickerOpen(v); if (!v) setEditingIdx(null); }}
        agency={agency}
        lax
        excludeEmails={new Set(
          signers
            .filter((_, i) => i !== editingIdx)
            .map((s) => s.email.trim().toLowerCase())
            .filter(Boolean),
        )}
        onAdd={handlePickerAdd}
      />
    </Dialog>
  );
}

/* ═════════════ Sub-componentes ═════════════ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

function SignerCompact({
  signer: s, valid, missing, onEdit, onRemove,
}: {
  signer: Draft;
  valid: boolean;
  missing: string[];
  onEdit: () => void;
  onRemove: () => void;
}) {
  const name = s.nombre.trim() || "(sin nombre)";
  return (
    <li className={cn(
      "group rounded-2xl border bg-card",
      valid ? "border-border" : "border-warning/40",
    )}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="h-8 w-8 rounded-full bg-muted/60 grid place-items-center shrink-0 text-[11px] font-semibold text-muted-foreground">
          {initials(name) || "?"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            {valid
              ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" strokeWidth={2.5} />
              : <AlertTriangle className="h-3 w-3 text-warning shrink-0" strokeWidth={2} />
            }
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate">
            {s.email || "Falta email"}{s.cargo ? ` · ${s.cargo}` : ""}
          </p>
          {!valid && <p className="text-[10.5px] text-warning mt-0.5">Falta {missing.join(", ")}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" onClick={onEdit}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.75} />
            Editar
          </button>
          <button type="button" onClick={onRemove}
            className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            aria-label="Quitar firmante"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </li>
  );
}
