/**
 * ContractUploadDialog · wizard 3 pasos para subir contrato y
 * enviarlo a firmar (Firmafy).
 *
 *   Paso 1 · Documento     · PDF + título + comisión + duración.
 *   Paso 2 · Firmantes     · añadir via `SignerPickerDialog`,
 *                            compact-hover cards, drag-reorder,
 *                            toggle firma por orden.
 *   Paso 3 · Envío         · idioma, asunto/mensaje (cambian al
 *                            elegir idioma), expiración opcional.
 *
 * Stepper sticky en el header · "Atrás" + "Continuar" / "Enviar"
 * en el footer. Estado compartido entre pasos. Al enviar desde el
 * paso 3 se llama a `uploadContract` + `sendContractToSign`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import {
  FileSignature, Upload, X, Plus, Mail, AtSign, Phone, IdCard,
  Building2, Check, ArrowLeft, ArrowRight, Send, Clock, Pencil,
  GripVertical, CheckCircle2, AlertTriangle, Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import {
  uploadContract, sendContractToSign,
  type ContractSigner, type CollaborationContract,
} from "@/lib/collaborationContracts";
import { recordContractSent, recordCompanyAny } from "@/lib/companyEvents";
import { SignerPickerDialog } from "./SignerPickerDialog";

/* ═════════════ Validaciones ═════════════ */

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

type Draft = ContractSigner & { juridica?: boolean };
type Lang = NonNullable<CollaborationContract["language"]>;
type Step = "documento" | "firmantes" | "envio";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "documento",  label: "Documento" },
  { id: "firmantes",  label: "Firmantes" },
  { id: "envio",      label: "Envío" },
];

const LANGUAGES: Array<{ value: Lang; label: string }> = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "ca", label: "Català" },
];

/** Plantillas por idioma · title y message por defecto. */
const EMAIL_TEMPLATES: Record<Lang, { subject: (agencyName: string) => string; message: string }> = {
  es: {
    subject: (a) => `Contrato de colaboración · ${a}`,
    message:
`Hola,

Te enviamos el contrato de colaboración para firma digital. Revísalo y, si todo encaja, firma desde el enlace que acompaña este mensaje. La firma es legal y vinculante · se realiza mediante OTP por SMS.

Gracias por tu tiempo.`,
  },
  en: {
    subject: (a) => `Collaboration agreement · ${a}`,
    message:
`Hi,

Please find attached the collaboration agreement for digital signature. Review it and, if everything is correct, sign through the link in this message. The signature is legal and binding · performed via SMS OTP.

Thanks for your time.`,
  },
  fr: {
    subject: (a) => `Contrat de collaboration · ${a}`,
    message:
`Bonjour,

Veuillez trouver ci-joint le contrat de collaboration pour signature numérique. Si tout est correct, signez via le lien joint à ce message. La signature est légale et contraignante · elle est effectuée par OTP par SMS.

Merci pour votre temps.`,
  },
  it: {
    subject: (a) => `Contratto di collaborazione · ${a}`,
    message:
`Ciao,

In allegato il contratto di collaborazione per la firma digitale. Se tutto è corretto, firma tramite il link allegato a questo messaggio. La firma è legale e vincolante · avviene tramite OTP via SMS.

Grazie per il tuo tempo.`,
  },
  ca: {
    subject: (a) => `Contracte de col·laboració · ${a}`,
    message:
`Hola,

T'enviem el contracte de col·laboració per a firma digital. Revisa'l i, si tot encaixa, firma des de l'enllaç que acompanya aquest missatge. La firma és legal i vinculant · es realitza mitjançant OTP per SMS.

Gràcies pel teu temps.`,
  },
};

const EMPTY_SIGNER: Draft = {
  nombre: "", nif: "", email: "", telefono: "",
  cargo: "", notifications: "email,sms",
};

/* ═════════════ Helpers de validación ═════════════ */

function signerMissingFields(s: Draft): string[] {
  const out: string[] = [];
  if (!s.nombre.trim()) out.push("nombre");
  if (!isValidEmail(s.email)) out.push("email");
  if (!isValidNif(s.nif)) out.push("NIF");
  if (s.notifications !== "email" && !isValidPhone(s.telefono)) out.push("teléfono");
  return out;
}

/* ════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency: Agency;
  actor?: { name: string; email: string };
}

export function ContractUploadDialog({ open, onOpenChange, agency, actor }: Props) {
  const [step, setStep] = useState<Step>("documento");

  /* Paso 1 · Documento */
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [comision, setComision] = useState<string>("");
  const [duracionMeses, setDuracionMeses] = useState<string>("12");
  const [dragging, setDragging] = useState(false);

  /* Paso 2 · Firmantes */
  const [signers, setSigners] = useState<Draft[]>([]);
  const [signerPriority, setSignerPriority] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  /* Paso 3 · Envío */
  const [language, setLanguage] = useState<Lang>("es");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [expirationEnabled, setExpirationEnabled] = useState(true);
  const [expiresDateStr, setExpiresDateStr] = useState(""); // yyyy-mm-dd
  const [expiresTimeStr, setExpiresTimeStr] = useState("23:00");

  /* Reset al abrir · defaults sensatos. */
  useEffect(() => {
    if (!open) return;
    setStep("documento");
    setFile(null);
    setTitle(`Contrato de colaboración · ${agency.name}`);
    setComision(agency.comisionMedia ? String(agency.comisionMedia) : "");
    setDuracionMeses("12");
    setSigners([]);
    setSignerPriority(false);
    setLanguage("es");
    setSubject(EMAIL_TEMPLATES.es.subject(agency.name));
    setMessage(EMAIL_TEMPLATES.es.message);
    /* Expiración default · 30 días a las 23:00 */
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setExpiresDateStr(d.toISOString().slice(0, 10));
    setExpiresTimeStr("23:00");
    setExpirationEnabled(true);
    setDragging(false);
    setEditingIdx(null);
  }, [open, agency.id, agency.name, agency.comisionMedia]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Solo se permiten archivos PDF."); return;
    }
    setFile(f);
  };

  /* ─── Idioma · cambio silencioso si no has editado el texto ─── */
  const handleLangChange = (next: Lang) => {
    const prev = language;
    const prevSubject = EMAIL_TEMPLATES[prev].subject(agency.name);
    const prevMessage = EMAIL_TEMPLATES[prev].message;
    const nextSubject = EMAIL_TEMPLATES[next].subject(agency.name);
    const nextMessage = EMAIL_TEMPLATES[next].message;
    /* Si el valor actual coincide con el default del idioma anterior,
       actualizamos al default del nuevo idioma. Si el usuario lo editó
       manualmente, lo respetamos (se queda en el idioma anterior · el
       usuario verá el desajuste y decidirá). */
    if (subject === prevSubject) setSubject(nextSubject);
    if (message === prevMessage) setMessage(nextMessage);
    setLanguage(next);
  };

  /* ─── Firmantes · add/update/remove/reorder ─── */
  const handlePickerAdd = (signer: ContractSigner) => {
    const draft: Draft = { ...signer, juridica: !!(signer.empresa || signer.cif) };
    if (editingIdx != null) {
      setSigners((prev) => prev.map((s, i) => i === editingIdx ? draft : s));
      setEditingIdx(null);
    } else {
      setSigners((prev) => [...prev, draft]);
    }
  };
  const handleEditSigner = (idx: number) => {
    setEditingIdx(idx);
    setPickerOpen(true);
  };
  const handleRemoveSigner = (idx: number) =>
    setSigners((prev) => prev.filter((_, i) => i !== idx));
  const handleReorderSigners = (fromIdx: number, toIdx: number) => {
    setSigners((prev) => {
      if (fromIdx === toIdx) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  /* ─── Validación por paso ─── */
  const signerValidity = useMemo(
    () => signers.map((s) => ({ signer: s, missing: signerMissingFields(s), valid: signerMissingFields(s).length === 0 })),
    [signers],
  );
  const validSigners = signerValidity.filter((x) => x.valid);
  const canContinueStep1 = !!file && title.trim().length > 0;
  const canContinueStep2 = validSigners.length > 0;
  const canSendStep3 = subject.trim().length > 0 && message.trim().length > 0;

  const expiresAtMs = useMemo(() => {
    if (!expirationEnabled || !expiresDateStr) return null;
    const t = expiresTimeStr || "23:00";
    const ms = new Date(`${expiresDateStr}T${t}:00`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [expirationEnabled, expiresDateStr, expiresTimeStr]);

  /* ─── Payload final de firmantes (común a ambos flujos) ─── */
  const buildFinalSigners = (): ContractSigner[] =>
    validSigners.map((x, i) => {
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
        orderIndex: signerPriority ? i : undefined,
      };
    });

  /* ─── A · Enviar a firmar via Firmafy (flujo normal) ─── */
  const handleSendToFirmafy = () => {
    if (!file) return;
    const finalSigners = buildFinalSigners();
    const ct = uploadContract({
      agencyId: agency.id,
      title: title.trim(),
      pdfFilename: file.name,
      pdfSize: file.size,
      signers: finalSigners,
      comision: comision ? Number(comision) : undefined,
      duracionMeses: duracionMeses ? Number(duracionMeses) : undefined,
      subject: subject.trim() || undefined,
      message: message.trim() || undefined,
      language,
      signerPriority,
      expiresAt: expiresAtMs ?? undefined,
      actor,
    });
    sendContractToSign(ct.id, actor);
    recordContractSent(agency.id, actor ?? { name: "Sistema" }, ct.title);
    recordCompanyAny(agency.id, "contract_sent", "Contrato enviado a firmar",
      `${ct.title} · firmantes: ${finalSigners.map((s) => s.email).join(", ")}`, actor);
    toast.success("Contrato enviado a firmar", {
      description: finalSigners.map((s) => s.email).join(", "),
    });
    onOpenChange(false);
  };


  /* ─── Navegación wizard ─── */
  const goNext = () => {
    if (step === "documento" && canContinueStep1) setStep("firmantes");
    else if (step === "firmantes" && canContinueStep2) setStep("envio");
  };
  const goBack = () => {
    if (step === "firmantes") setStep("documento");
    else if (step === "envio") setStep("firmantes");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">

        {/* ══════ Header + stepper ══════ */}
        <header className="px-5 sm:px-6 pt-5 pb-3 border-b border-border/60 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nuevo contrato · {agency.name}
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-foreground mt-0.5 leading-tight">
              {step === "documento"  ? "Sube el documento"
               : step === "firmantes" ? "Elige los firmantes"
               : "Configura el envío"}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>
        <Stepper current={step} />

        {/* ══════ Body ══════ */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {step === "documento"  && (
            <StepDocumento
              file={file} onFile={pickFile} dragging={dragging} setDragging={setDragging}
              title={title} setTitle={setTitle}
              comision={comision} setComision={setComision}
              duracion={duracionMeses} setDuracion={setDuracionMeses}
            />
          )}
          {step === "firmantes" && (
            <StepFirmantes
              validity={signerValidity}
              signerPriority={signerPriority} setSignerPriority={setSignerPriority}
              onAdd={() => { setEditingIdx(null); setPickerOpen(true); }}
              onEdit={handleEditSigner}
              onRemove={handleRemoveSigner}
              onReorder={handleReorderSigners}
            />
          )}
          {step === "envio" && (
            <StepEnvio
              language={language} onLanguageChange={handleLangChange}
              subject={subject} setSubject={setSubject}
              message={message} setMessage={setMessage}
              expirationEnabled={expirationEnabled} setExpirationEnabled={setExpirationEnabled}
              expiresDateStr={expiresDateStr} setExpiresDateStr={setExpiresDateStr}
              expiresTimeStr={expiresTimeStr} setExpiresTimeStr={setExpiresTimeStr}
              signerCount={validSigners.length}
              signerPriority={signerPriority}
            />
          )}
        </div>

        {/* ══════ Footer ══════ */}
        <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center gap-2 shrink-0 bg-card">
          {step !== "documento" ? (
            <Button variant="outline" onClick={goBack} className="rounded-full">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
              Atrás
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              Cancelar
            </Button>
          )}
          <div className="flex-1" />
          {step !== "envio" ? (
            <Button
              onClick={goNext}
              disabled={(step === "documento" && !canContinueStep1) || (step === "firmantes" && !canContinueStep2)}
              className="rounded-full"
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" strokeWidth={1.75} />
            </Button>
          ) : (
            <Button onClick={handleSendToFirmafy} disabled={!canSendStep3} className="rounded-full">
              <Send className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
              Enviar a firmar
            </Button>
          )}
        </footer>
      </DialogContent>

      {/* Picker anidado · añadir o editar firmante */}
      <SignerPickerDialog
        open={pickerOpen}
        onOpenChange={(v) => { setPickerOpen(v); if (!v) setEditingIdx(null); }}
        agency={agency}
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

/* ══════════════════════════════════════════════════════════════════
 * Stepper
 * ════════════════════════════════════════════════════════════════ */

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <nav className="px-5 sm:px-6 pt-3 pb-2 border-b border-border/60 bg-muted/10">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isPast = i < idx;
          const isCurrent = i === idx;
          return (
            <li key={s.id} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold tabular-nums shrink-0",
                  isPast
                    ? "bg-foreground text-background"
                    : isCurrent
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                )}>
                  {isPast ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className={cn(
                  "text-[11.5px] font-medium truncate",
                  isCurrent ? "text-foreground" : isPast ? "text-muted-foreground" : "text-muted-foreground/60",
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-1",
                  isPast ? "bg-foreground/40" : "bg-border",
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Paso 1 · Documento
 * ════════════════════════════════════════════════════════════════ */

function StepDocumento({
  file, onFile, dragging, setDragging,
  title, setTitle, comision, setComision, duracion, setDuracion,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  title: string; setTitle: (v: string) => void;
  comision: string; setComision: (v: string) => void;
  duracion: string; setDuracion: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Archivo PDF</Label>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0] ?? null); }}
          className={cn(
            "mt-1.5 block cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-foreground/40 bg-muted/40" : "border-border bg-muted/20 hover:border-foreground/20",
          )}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {file ? (
            <div className="flex items-center gap-3 justify-center">
              <span className="h-10 w-10 rounded-lg bg-foreground/5 grid place-items-center">
                <FileSignature className="h-5 w-5 text-foreground" strokeWidth={1.75} />
              </span>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onFile(null); }}
                className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                aria-label="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground">Arrastra el PDF aquí o haz click</p>
              <p className="text-[11px] text-muted-foreground mt-1">Formato A4 · máx 20 MB</p>
            </>
          )}
        </label>
      </div>

      <div>
        <Label>Título del contrato</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Comisión (%)</Label>
          <input
            type="number" step="0.1" min="0" max="20"
            value={comision} onChange={(e) => setComision(e.target.value)}
            placeholder="5"
            className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-[10.5px] text-muted-foreground mt-1">Pre-rellenado con la comisión media de la agencia.</p>
        </div>
        <div>
          <Label>Duración (meses)</Label>
          <input
            type="number" step="1" min="0"
            value={duracion} onChange={(e) => setDuracion(e.target.value)}
            placeholder="12"
            className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-[10.5px] text-muted-foreground mt-1">Usa <span className="text-foreground font-medium">0</span> para indefinido.</p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Paso 2 · Firmantes
 * ════════════════════════════════════════════════════════════════ */

function StepFirmantes({
  validity, signerPriority, setSignerPriority, onAdd, onEdit, onRemove, onReorder,
}: {
  validity: Array<{ signer: Draft; missing: string[]; valid: boolean }>;
  signerPriority: boolean;
  setSignerPriority: (v: boolean) => void;
  onAdd: () => void;
  onEdit: (idx: number) => void;
  onRemove: (idx: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const count = validity.length;
  return (
    <div className="space-y-3">
      {/* Header · toggle firma por orden solo si ≥2 firmantes */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11.5px] text-muted-foreground">
          Quién debe firmar este contrato. Añade todos los apoderados necesarios.
        </p>
        {count >= 2 && (
          <label className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-border bg-card cursor-pointer select-none">
            <Switch checked={signerPriority} onCheckedChange={setSignerPriority} />
            <span className="text-[11.5px] font-medium text-foreground">Firma por orden</span>
          </label>
        )}
      </div>

      {signerPriority && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          Arrastra los firmantes para cambiar el orden · el siguiente solo recibe el aviso cuando el anterior haya firmado.
        </p>
      )}

      {/* Lista de firmantes · compact con hover-to-edit */}
      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <IdCard className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">Añade el primer firmante</p>
          <p className="text-[11.5px] text-muted-foreground mt-1 max-w-sm mx-auto">
            Elige de los contactos conocidos (contacto principal, firmantes previos) o crea uno nuevo.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {validity.map((v, i) => (
            <SignerCompact
              key={i}
              index={i}
              signer={v.signer}
              missing={v.missing}
              valid={v.valid}
              showOrder={signerPriority}
              draggable={signerPriority}
              onEdit={() => onEdit(i)}
              onRemove={() => onRemove(i)}
              onDropFrom={(fromIdx) => onReorder(fromIdx, i)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-3 hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Añadir firmante
      </button>
    </div>
  );
}

function SignerCompact({
  index, signer: s, missing, valid, showOrder, draggable,
  onEdit, onRemove, onDropFrom,
}: {
  index: number;
  signer: Draft;
  missing: string[];
  valid: boolean;
  showOrder: boolean;
  draggable: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDropFrom: (fromIdx: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const name = s.nombre.trim() || "(sin nombre)";

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/x-signer-index", String(index));
    setDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!draggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!draggable) return;
    e.preventDefault();
    setDragOver(false);
    setDragging(false);
    const from = Number(e.dataTransfer.getData("text/x-signer-index"));
    if (Number.isFinite(from)) onDropFrom(from);
  };

  return (
    <li
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={() => { setDragging(false); setDragOver(false); }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "group rounded-2xl border bg-card transition-all",
        dragging ? "opacity-50" : "",
        dragOver ? "border-foreground ring-2 ring-foreground/10" : !valid ? "border-warning/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Drag handle + orden */}
        {showOrder ? (
          <span
            className="h-8 w-8 rounded-full bg-foreground text-background grid place-items-center shrink-0 text-[11px] font-bold tabular-nums cursor-grab active:cursor-grabbing"
            title="Arrastra para reordenar"
          >
            {index + 1}
          </span>
        ) : (
          <span className="h-8 w-8 rounded-full bg-muted/60 grid place-items-center shrink-0 text-[11px] font-semibold text-muted-foreground">
            {initials(name) || (index + 1)}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            {valid
              ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" strokeWidth={2.5} />
              : <AlertTriangle className="h-3 w-3 text-warning shrink-0" strokeWidth={2} />
            }
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate">
            {s.email || "Falta email"}
            {s.cargo ? ` · ${s.cargo}` : ""}
          </p>
          {!valid && (
            <p className="text-[10.5px] text-warning mt-0.5">Falta {missing.join(", ")}</p>
          )}
        </div>

        {/* Acciones · hover-reveal edit, siempre visible remove */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.75} />
            Editar
          </button>
          <button
            type="button"
            onClick={onRemove}
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

/* ══════════════════════════════════════════════════════════════════
 * Paso 3 · Envío
 * ════════════════════════════════════════════════════════════════ */

function StepEnvio({
  language, onLanguageChange, subject, setSubject, message, setMessage,
  expirationEnabled, setExpirationEnabled,
  expiresDateStr, setExpiresDateStr,
  expiresTimeStr, setExpiresTimeStr,
  signerCount, signerPriority,
}: {
  language: Lang;
  onLanguageChange: (l: Lang) => void;
  subject: string; setSubject: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  expirationEnabled: boolean; setExpirationEnabled: (v: boolean) => void;
  expiresDateStr: string; setExpiresDateStr: (v: string) => void;
  expiresTimeStr: string; setExpiresTimeStr: (v: string) => void;
  signerCount: number;
  signerPriority: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-muted-foreground">
        Se enviará a <span className="text-foreground font-medium">{signerCount} {signerCount === 1 ? "firmante" : "firmantes"}</span>
        {signerPriority ? ", en el orden que has indicado." : ", todos a la vez."}
      </p>

      {/* Idioma */}
      <div>
        <Label>Idioma del email</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => onLanguageChange(lang.value)}
              className={cn(
                "h-8 px-3 rounded-full text-[12px] font-medium transition-colors",
                language === lang.value
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-foreground hover:bg-muted",
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asunto */}
      <div>
        <Label>Asunto</Label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Mensaje */}
      <div>
        <Label>Mensaje</Label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          className="mt-1.5 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Expiración */}
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <label className="flex items-start justify-between gap-3 cursor-pointer">
          <div className="min-w-0 pr-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
              Fecha de expiración
            </p>
            <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
              Los firmantes tienen hasta esa fecha para firmar. Si la desactivas,
              usaremos 30 días por defecto.
            </p>
          </div>
          <Switch checked={expirationEnabled} onCheckedChange={setExpirationEnabled} />
        </label>
        {expirationEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="relative">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
              <input
                type="date"
                value={expiresDateStr}
                min={today}
                onChange={(e) => setExpiresDateStr(e.target.value)}
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="relative">
              <Clock className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
              <input
                type="time"
                value={expiresTimeStr}
                onChange={(e) => setExpiresTimeStr(e.target.value)}
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Sub-utils
 * ════════════════════════════════════════════════════════════════ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}
