/**
 * ContractDetailDialog · detalle completo de un contrato · inspirado
 * en la pantalla de detalle de Firmafy · adaptado al design system
 * de Byvaro.
 *
 * Secciones:
 *   1. Header · icono + filename + CSV destacado + botón cerrar.
 *   2. Metadata grid 2-col · descripción, creador, estado,
 *      creación, vencimiento (editable), tipo de envío, firma por
 *      orden, notificación (editable).
 *   3. Sidebar · tarjeta Documento Original (descarga + tamaño) +
 *      botón "Finalizar Envío" · visible solo en estado `draft`.
 *   4. Firmantes · accordion · cada firmante muestra DNI, email
 *      (editable), móvil (editable), tipo envío, estado, 4 botones
 *      para reenviar por canal, URL de firma y timeline "Seguimiento"
 *      con 5 pasos.
 *   5. Histórico del envío · accordion colapsado por defecto con
 *      todos los `events[]` del contrato.
 *
 * Acciones UI:
 *   - Editar email/móvil de un firmante → `EditSignerFieldDialog`.
 *   - Extender vencimiento → `ExtendExpirationDialog`.
 *   - Reenviar por canal → action directa sobre storage.
 *   - Forzar estado → confirm dialog simple.
 *   - Finalizar Envío (en draft) → envía a firmar.
 */

import { useMemo, useState } from "react";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText, X, Download, Pencil, Mail, Phone, Smartphone,
  ChevronDown, ChevronUp, Clock, ExternalLink, CheckCircle2,
  Send, Mailbox, MessageSquare, ShieldCheck, CircleDashed,
  Sparkles, FileSignature, AlertTriangle, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import {
  sendContractToSign, revokeContract,
  resendToSigner, updateContractSigner, extendContractExpiration,
  forceContractStatus,
  CONTRACT_STATUS, getDerivedStatus,
  type CollaborationContract, type ContractSigner, type ContractStatus,
  type ContractEvent,
} from "@/lib/collaborationContracts";
import { EditSignerFieldDialog } from "./EditSignerFieldDialog";
import { ExtendExpirationDialog } from "./ExtendExpirationDialog";

/* ═════════════ Helpers ═════════════ */

function formatDateTime(ms?: number): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(ms));
}

function formatSize(bytes?: number): string {
  if (!bytes) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace minutos" : `hace ${hours} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(ms));
}

const SHIPMENT_LABEL: Record<NonNullable<CollaborationContract["shipmentType"]>, string> = {
  form:  "Firma con Formulario",
  link:  "Link directo",
  email: "Email con PDF",
  sms:   "SMS con link",
};

const SIGNER_SHIPMENT_LABEL: Record<ContractSigner["notifications"], string> = {
  email:       "Email",
  sms:         "SMS",
  "email,sms": "Email + SMS",
};

/* ════════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: CollaborationContract | null;
}

export function ContractDetailDialog({ open, onOpenChange, contract }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const canManage = useHasPermission("collaboration.contracts.manage");

  /* Mantener el contrato "congelado" mientras el dialog está cerrándose
     para que la animación de salida no parpadee. */
  const [editingField, setEditingField] = useState<null | {
    signerIndex: number;
    field: "email" | "telefono";
    currentValue: string;
  }>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* Acordeón de firmantes · por defecto el primero abierto. */
  const [openSigners, setOpenSigners] = useState<Record<number, boolean>>({ 0: true });

  if (!contract) return null;
  const c = contract;
  const status = getDerivedStatus(c);
  const isDraft = c.status === "draft";

  const toneClasses = {
    muted:       "bg-muted text-muted-foreground border-border",
    primary:     "bg-primary/10 text-primary border-primary/25",
    success:     "bg-success/10 text-success border-success/25",
    warning:     "bg-warning/10 text-warning border-warning/25",
    destructive: "bg-destructive/10 text-destructive border-destructive/25",
  }[status.tone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        {/* ══════ Header ══════ */}
        <header className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-border/60">
          <span className="h-9 w-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Contrato de colaboración
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-foreground truncate leading-tight mt-0.5">
              {c.pdfFilename}
            </h2>
            {c.csv && (
              <p className="text-[11px] text-muted-foreground/90 mt-1 font-mono truncate">
                CSV <span className="text-foreground">{c.csv}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        {/* ══════ Body con scroll interno ══════ */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
            {/* ─── Metadata grid ─── */}
            <div className="space-y-3">
              <MetaGrid contract={c} status={status} toneClasses={toneClasses}
                canManage={canManage} actor={actor}
                onExtend={() => setExtendOpen(true)}
              />
            </div>

            {/* ─── Sidebar documento ─── */}
            <aside className="space-y-3">
              <DocumentCard contract={c} canManage={canManage} actor={actor} />
            </aside>
          </div>

          {/* ─── Firmantes ─── */}
          <section className="mt-6">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Firmantes · {c.signers.length}
            </h3>
            <ul className="space-y-2">
              {c.signers.map((s, i) => (
                <SignerCard
                  key={i}
                  signer={s}
                  index={i}
                  expanded={!!openSigners[i]}
                  onToggle={() => setOpenSigners((m) => ({ ...m, [i]: !m[i] }))}
                  canManage={canManage && c.status !== "signed" && c.status !== "revoked"}
                  onEditField={(field, currentValue) =>
                    setEditingField({ signerIndex: i, field, currentValue })}
                  onResend={(channel) => {
                    resendToSigner(c.id, i, channel, actor);
                    toast.success(`Reenviado por ${channel.toUpperCase()}`);
                  }}
                />
              ))}
            </ul>
          </section>

          {/* ─── Histórico del envío ─── */}
          <section className="mt-6">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-sm font-medium text-foreground">Histórico del envío</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">· {c.events.length}</span>
              </span>
              {historyOpen
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {historyOpen && (
              <div className="mt-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <EventsList events={c.events} />
              </div>
            )}
          </section>
        </div>

        {/* ══════ Footer con acciones primarias ══════ */}
        {canManage && (
          <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center justify-end gap-2 flex-wrap shrink-0 bg-card">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    revokeContract(c.id, actor);
                    toast.success("Borrador descartado");
                    onOpenChange(false);
                  }}
                  className="rounded-full"
                >
                  Descartar
                </Button>
                <Button
                  onClick={() => {
                    sendContractToSign(c.id, actor);
                    toast.success("Enviado a firmar", {
                      description: c.signers.map((s) => s.email).join(", "),
                    });
                  }}
                  className="rounded-full"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />
                  Enviar a firmar
                </Button>
              </>
            )}
            {(c.status === "sent" || c.status === "viewed") && (
              <Button
                variant="outline"
                onClick={() => {
                  revokeContract(c.id, actor);
                  toast.success("Contrato revocado");
                }}
                className="rounded-full"
              >
                Revocar envío
              </Button>
            )}
          </footer>
        )}
      </DialogContent>

      {/* ══ Sub-dialogs ══ */}
      {editingField && (
        <EditSignerFieldDialog
          open
          onOpenChange={(v) => { if (!v) setEditingField(null); }}
          contractId={c.id}
          signerIndex={editingField.signerIndex}
          field={editingField.field}
          currentValue={editingField.currentValue}
          onSaved={() => setEditingField(null)}
        />
      )}
      <ExtendExpirationDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        contractId={c.id}
        currentExpiresAt={c.expiresAt}
      />
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Metadata grid
 * ════════════════════════════════════════════════════════════════ */

function MetaGrid({
  contract: c, status, toneClasses, canManage, actor, onExtend,
}: {
  contract: CollaborationContract;
  status: { label: string; tone: string };
  toneClasses: string;
  canManage: boolean;
  actor: { name: string; email: string };
  onExtend: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
      <MetaRow label="Descripción">
        <span className="text-foreground">{c.title}</span>
      </MetaRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
        <MetaRow label="Creador">
          <span className="text-foreground">{c.createdBy?.name ?? "—"}</span>
        </MetaRow>
        <MetaRow
          label="Estado"
          action={canManage && c.status !== "signed" ? (
            <ChangeStatusMenu contract={c} actor={actor} />
          ) : undefined}
        >
          <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[10.5px] font-medium", toneClasses)}>
            {status.label}
          </span>
        </MetaRow>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
        <MetaRow label="Fecha de creación">
          <span className="text-foreground tabular-nums">{formatDateTime(c.createdAt)}</span>
        </MetaRow>
        <MetaRow
          label="Fecha de vencimiento"
          action={canManage && c.status !== "signed" && c.status !== "revoked" ? (
            <IconEditButton onClick={onExtend} title="Extender vencimiento" />
          ) : undefined}
        >
          <span className="text-foreground tabular-nums">
            {c.expiresAt ? formatDateTime(c.expiresAt) : "—"}
          </span>
        </MetaRow>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
        <MetaRow label="Tipo de envío">
          <span className="text-foreground">
            {c.shipmentType ? SHIPMENT_LABEL[c.shipmentType] : "—"}
          </span>
        </MetaRow>
        <MetaRow label="Firmar por orden">
          <span className={c.signerPriority ? "text-foreground" : "text-muted-foreground"}>
            {c.signerPriority ? "Sí" : "—"}
          </span>
        </MetaRow>
      </div>
      <MetaRow label="Notificación">
        <span className={c.notificationEmail ? "text-foreground" : "text-muted-foreground"}>
          {c.notificationEmail ?? c.createdBy?.email ?? "—"}
        </span>
      </MetaRow>
    </div>
  );
}

function MetaRow({
  label, children, action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-[13px] mt-0.5 truncate">{children}</div>
      </div>
      {action}
    </div>
  );
}

function IconEditButton({
  onClick, title,
}: {
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
    >
      <Pencil className="h-3 w-3" strokeWidth={1.75} />
    </button>
  );
}

function ChangeStatusMenu({
  contract: c, actor,
}: {
  contract: CollaborationContract;
  actor: { name: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  const options: ContractStatus[] = ["draft", "sent", "viewed", "signed", "expired", "revoked"];
  return (
    <div className="relative">
      <IconEditButton onClick={() => setOpen((v) => !v)} title="Forzar estado" />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-border bg-card shadow-soft-lg py-1">
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Cambiar estado
            </p>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  forceContractStatus(c.id, opt, actor, "Cambio manual desde detalle");
                  toast.success(`Estado cambiado a ${CONTRACT_STATUS[opt].label}`);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] text-left hover:bg-muted/40 transition-colors",
                  c.status === opt ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {CONTRACT_STATUS[opt].label}
                {c.status === opt && <CheckCircle2 className="h-3 w-3 text-foreground" strokeWidth={2} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Documento original · sidebar
 * ════════════════════════════════════════════════════════════════ */

function DocumentCard({
  contract: c, canManage, actor,
}: {
  contract: CollaborationContract;
  canManage: boolean;
  actor: { name: string; email: string };
}) {
  const isDraft = c.status === "draft";
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Documento original
      </p>
      <div className="mt-3 h-20 w-16 rounded-lg bg-muted grid place-items-center shrink-0">
        <FileText className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.25} />
      </div>
      <button
        onClick={() => toast.info("Descarga · disponible cuando conectemos el backend")}
        className="mt-2 inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Download className="h-3 w-3" strokeWidth={1.75} />
        Descargar
      </button>
      <p className="text-[10.5px] text-muted-foreground tabular-nums mt-1.5">
        ({formatSize(c.pdfSize)})
      </p>

      {c.docSignedUrl && (
        <>
          <div className="my-3 h-px w-full bg-border/60" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Documento firmado
          </p>
          <button
            onClick={() => toast.info("Descarga · disponible cuando conectemos el backend")}
            className="mt-2 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-foreground text-background text-[11px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <ShieldCheck className="h-3 w-3" strokeWidth={2} />
            PDF firmado
          </button>
          {c.docAuditUrl && (
            <button
              onClick={() => toast.info("Traza de auditoría · disponible cuando conectemos el backend")}
              className="mt-1.5 text-[10.5px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Traza legal
            </button>
          )}
        </>
      )}

      {canManage && isDraft && (
        <>
          <div className="my-3 h-px w-full bg-border/60" />
          <button
            onClick={() => {
              sendContractToSign(c.id, actor);
              toast.success("Enviado a firmar");
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-[11.5px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <Send className="h-3 w-3" strokeWidth={2} />
            Finalizar envío
          </button>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
            Envía el contrato a los firmantes definitivamente.
          </p>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Firmante · card acordeón
 * ════════════════════════════════════════════════════════════════ */

function SignerCard({
  signer: s, index, expanded, onToggle, canManage, onEditField, onResend,
}: {
  signer: ContractSigner;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEditField: (field: "email" | "telefono", currentValue: string) => void;
  onResend: (channel: "email" | "sms" | "whatsapp" | "otp") => void;
}) {
  const signed = s.signerStatus === "signed" || !!s.signedAt;
  const statusLabel = signed
    ? "Firmado"
    : s.signerStatus === "rejected"
      ? "Rechazó firma"
      : "Pendiente de firma";
  const statusTone = signed ? "success" : s.signerStatus === "rejected" ? "destructive" : "warning";
  const toneClasses = {
    success:     "bg-success/10 text-success border-success/25",
    warning:     "bg-warning/10 text-warning border-warning/25",
    destructive: "bg-destructive/10 text-destructive border-destructive/25",
  }[statusTone];

  return (
    <li className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="h-8 w-8 rounded-lg bg-muted/60 grid place-items-center shrink-0 text-[11px] font-semibold text-muted-foreground">
          {s.nombre.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || `F${index + 1}`}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            Firmante {index + 1}: {s.nombre || "(sin nombre)"}
          </p>
          <p className="text-[11.5px] text-muted-foreground truncate">
            {s.email} · {s.telefono}
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10.5px] font-medium shrink-0", toneClasses)}>
          {signed
            ? <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
            : <Clock className="h-2.5 w-2.5" strokeWidth={2} />}
          {statusLabel}
        </span>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" strokeWidth={1.75} />
          : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" strokeWidth={1.75} />}
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 py-3 space-y-3">
          {/* Datos identidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldRow label="DNI" value={s.nif} />
            <FieldRow
              label="Email"
              value={s.email}
              onEdit={canManage ? () => onEditField("email", s.email) : undefined}
            />
            <FieldRow
              label="Móvil"
              value={s.telefono}
              onEdit={canManage ? () => onEditField("telefono", s.telefono) : undefined}
            />
          </div>

          {/* Meta firmante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Tipo de envío" value={SIGNER_SHIPMENT_LABEL[s.notifications]} />
            <FieldRow label="Cargo" value={s.cargo || "—"} />
          </div>

          {/* Reenviar solicitud */}
          {canManage && !signed && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Reenviar solicitud
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <ChannelButton icon={Mailbox}       label="Email"    onClick={() => onResend("email")} />
                <ChannelButton icon={Smartphone}    label="SMS"      onClick={() => onResend("sms")} />
                <ChannelButton icon={MessageSquare} label="WhatsApp" onClick={() => onResend("whatsapp")} />
                <ChannelButton icon={ShieldCheck}   label="OTP"      onClick={() => onResend("otp")} primary />
              </div>
            </div>
          )}

          {/* URL de firma */}
          {s.signUrl && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Enlace de firma
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="flex-1 text-[11.5px] text-muted-foreground font-mono truncate">
                  {s.signUrl}
                </p>
                <button
                  onClick={() => { navigator.clipboard.writeText(s.signUrl ?? ""); toast.success("Enlace copiado"); }}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copiar"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.75} />
                </button>
                <a
                  href={s.signUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Abrir"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                </a>
              </div>
            </div>
          )}

          {/* Seguimiento timeline */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Seguimiento del envío
            </p>
            <SignerTimeline signer={s} />
          </div>
        </div>
      )}
    </li>
  );
}

function FieldRow({
  label, value, onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-[13px] text-foreground mt-0.5 truncate font-mono">{value}</p>
      </div>
      {onEdit && <IconEditButton onClick={onEdit} title={`Editar ${label.toLowerCase()}`} />}
    </div>
  );
}

function ChannelButton({
  icon: Icon, label, onClick, primary,
}: {
  icon: typeof Mailbox;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Reenviar por ${label}`}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-medium transition-colors",
        primary
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "border border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

/* ══════ Timeline de seguimiento del firmante ══════ */
function SignerTimeline({ signer: s }: { signer: ContractSigner }) {
  const steps: Array<{ key: string; label: string; icon: typeof Mail; at?: number }> = [
    { key: "sent",      label: "Enviado",           icon: Send,         at: s.tracking?.sentAt },
    { key: "delivered", label: "Entregado",         icon: Mail,         at: s.tracking?.deliveredAt },
    { key: "opened",    label: "Leído",             icon: Mailbox,      at: s.tracking?.openedAt },
    { key: "read-doc",  label: "Lectura documento", icon: FileText,     at: s.tracking?.documentReadAt },
    { key: "signed",    label: "Firmado",           icon: FileSignature,at: s.signedAt },
  ];
  return (
    <ol className="flex items-start gap-0 overflow-x-auto">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done = typeof step.at === "number";
        const isLast = i === steps.length - 1;
        return (
          <li key={step.key} className="flex-1 min-w-[68px] flex items-start">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full grid place-items-center relative z-10 border",
                done
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground/60 border-border",
              )}>
                <Icon className="h-3.5 w-3.5" strokeWidth={done ? 2 : 1.5} />
              </div>
              <p className={cn(
                "text-[10px] font-medium mt-1.5 text-center",
                done ? "text-foreground" : "text-muted-foreground/60",
              )}>
                {step.label}
              </p>
              {done && step.at && (
                <p className="text-[9.5px] text-muted-foreground/80 tabular-nums mt-0.5">
                  {formatDateTime(step.at)}
                </p>
              )}
            </div>
            {!isLast && (
              <div className={cn(
                "h-px flex-1 mt-4",
                done ? "bg-foreground/40" : "bg-border",
              )} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Histórico del envío
 * ════════════════════════════════════════════════════════════════ */

const EVENT_ICON: Partial<Record<ContractEvent["type"], typeof FileText>> = {
  uploaded: FileText,
  sent:     Send,
  viewed:   Mailbox,
  signed:   FileSignature,
  expired:  Clock,
  revoked:  X,
};

function EventsList({ events }: { events: ContractEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>;
  }
  const sorted = [...events].sort((a, b) => b.at - a.at);
  return (
    <ul className="space-y-2">
      {sorted.map((e) => {
        const Icon = EVENT_ICON[e.type] ?? Sparkles;
        return (
          <li key={e.id} className="flex items-start gap-2.5">
            <span className="h-6 w-6 rounded-full bg-background border border-border grid place-items-center shrink-0 mt-0.5">
              <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">
                {labelForEvent(e.type)}
              </p>
              {e.note && (
                <p className="text-[11px] text-muted-foreground leading-snug">{e.note}</p>
              )}
              <p className="text-[10.5px] text-muted-foreground/80 tabular-nums mt-0.5">
                {formatDateTime(e.at)}
                {e.by?.name ? ` · ${e.by.name}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function labelForEvent(t: ContractEvent["type"]): string {
  return ({
    uploaded: "Contrato subido",
    sent:     "Enviado a firmar",
    viewed:   "Firmante abrió el documento",
    signed:   "Contrato firmado",
    expired:  "Contrato expirado",
    revoked:  "Contrato revocado",
  } as Record<string, string>)[t] ?? t;
}
