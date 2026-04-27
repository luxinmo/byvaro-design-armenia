/**
 * Tab "Documentación" del panel de colaboración.
 *
 * Contiene DOS bloques:
 *
 *   1. Contratos de colaboración · subir PDF, enviar a firmar (Firmafy),
 *      marcar firmado, revocar. Ya diseñado en la fase anterior.
 *
 *   2. Documentos requeridos · el promotor solicita papeles a la
 *      agencia (factura, certificado fiscal, IBAN, modelo trimestral,
 *      seguro, custom). La agencia sube desde su panel (futuro) · aquí
 *      promotor ve el estado (solicitado, subido, aprobado, rechazado)
 *      y revisa.
 *
 * Permisos:
 *   · `collaboration.contracts.view`   → ver bloque contratos.
 *   · `collaboration.contracts.manage` → subir + enviar + revocar.
 *   · `collaboration.documents.manage` → solicitar + aprobar/rechazar.
 */

import { useEffect, useState } from "react";
import {
  FileSignature, Plus, Trash2, Pause, Play, FileText, Download,
  Receipt, Landmark, Shield, ShieldCheck, Sparkles, Check, X,
  ClipboardCheck, Upload, ChevronDown,
} from "lucide-react";
import { PdfIcon } from "@/components/icons/PdfIcon";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import {
  useContractsForAgency, sendContractToSign,
  revokeContract, deleteContract, CONTRACT_STATUS, getDerivedStatus,
  type CollaborationContract,
} from "@/lib/collaborationContracts";
import {
  useAgencyDocRequests, approveDocRequest, rejectDocRequest,
  mockAgencyUpload, deleteDocRequest,
  DOC_STATUS_LABEL, DOC_REQUEST_META,
  type AgencyDocRequest, type DocRequestType,
} from "@/lib/agencyDocRequests";
import { ContractUploadDialog } from "@/components/collaborators/ContractUploadDialog";
import { ContractSignedUploadDialog } from "@/components/collaborators/ContractSignedUploadDialog";
import { ContractNewChoiceDialog } from "@/components/collaborators/ContractNewChoiceDialog";
import { ContractDetailDialog } from "@/components/collaborators/ContractDetailDialog";
import { ContractRowKebab } from "@/components/collaborators/ContractRowKebab";
import { ContractFloatingBar } from "@/components/collaborators/ContractFloatingBar";
import { DocRequestDialog } from "@/components/collaborators/DocRequestDialog";
import { SectionHeader, StateBadge, formatRelative } from "./shared";

interface Props {
  agency: Agency;
  /** Cuando se monta este tab desde el lado AGENCIA (panel del
   *  promotor en `/promotor/:id/panel`), forzamos read-only · la
   *  agencia NO puede subir/enviar/archivar contratos · esos flujos
   *  los inicia siempre el promotor. La agencia solo firma desde el
   *  email de Firmafy. */
  readOnly?: boolean;
}

export function DocumentacionTab({ agency: a, readOnly = false }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const canViewContracts = useHasPermission("collaboration.contracts.view");
  const canManageContracts = useHasPermission("collaboration.contracts.manage") && !readOnly;
  const canManageDocs = useHasPermission("collaboration.documents.manage") && !readOnly;

  const contracts = useContractsForAgency(a.id);
  const docs = useAgencyDocRequests(a.id);

  const confirm = useConfirm();
  const [newChoiceOpen, setNewChoiceOpen] = useState(false);
  const [uploadContractOpen, setUploadContractOpen] = useState(false);
  const [signedUploadOpen, setSignedUploadOpen] = useState(false);
  const [requestDocOpen, setRequestDocOpen] = useState(false);
  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const detailContract = contracts.find((c) => c.id === detailContractId) ?? null;

  /* Split · activos (listado principal) vs archivados (sección al pie). */
  const activeContracts = contracts.filter((c) => !c.archived);
  const archivedContracts = [...contracts.filter((c) => !!c.archived)]
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

  /* Selección múltiple · sobre contratos activos. */
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedContracts((prev) => {
      const valid = new Set(activeContracts.map((c) => c.id));
      return new Set([...prev].filter((id) => valid.has(id)));
    });
  }, [activeContracts]);
  const toggleContract = (id: string) => setSelectedContracts((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearContractSelection = () => setSelectedContracts(new Set());

  return (
    <div className="space-y-6">
      {/* ═══ Contratos de colaboración ═══ */}
      {canViewContracts && (
        <section>
          <SectionHeader
            title="Contratos de colaboración"
            subtitle="Acuerdo firmado que regula la relación · comisión, duración y scope."
            right={canManageContracts && (
              <button
                onClick={() => setNewChoiceOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Nuevo contrato
              </button>
            )}
          />
          {/* Activos */}
          <ContractsList
            contracts={activeContracts}
            actor={actor}
            canManage={canManageContracts}
            onOpenDetail={(id) => setDetailContractId(id)}
            selectedIds={selectedContracts}
            onToggleSelect={toggleContract}
          />

          {/* Archivados · muestra top 3 · link "ver todos (N)" si hay más */}
          {archivedContracts.length > 0 && (
            <ArchivedSection
              contracts={archivedContracts}
              onOpenDetail={(id) => setDetailContractId(id)}
            />
          )}
        </section>
      )}

      {/* ═══ Documentación adicional para pagos ═══ */}
      <section>
        <SectionHeader
          title="Documentación solicitada a la agencia"
          subtitle="Papeles que necesitas para poder pagarle · factura, IBAN, certificados fiscales."
          right={canManageDocs && (
            <button
              onClick={() => setRequestDocOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Solicitar documento
            </button>
          )}
        />
        <DocRequestsList docs={docs} actor={actor} canManage={canManageDocs} />
      </section>

      {/* Dialogs */}
      {/* 1 · popup inicial de elección · qué flujo seguir */}
      <ContractNewChoiceDialog
        open={newChoiceOpen}
        onOpenChange={setNewChoiceOpen}
        onPickSend={() => setUploadContractOpen(true)}
        onPickSigned={() => setSignedUploadOpen(true)}
      />
      {/* 2a · wizard completo · Firmafy */}
      <ContractUploadDialog
        open={uploadContractOpen}
        onOpenChange={setUploadContractOpen}
        agency={a}
        actor={actor}
      />
      {/* 2b · form simple · archivar firmado */}
      <ContractSignedUploadDialog
        open={signedUploadOpen}
        onOpenChange={setSignedUploadOpen}
        agency={a}
        actor={actor}
      />

      <DocRequestDialog
        open={requestDocOpen}
        onOpenChange={setRequestDocOpen}
        agency={a}
        actor={actor}
      />
      <ContractDetailDialog
        open={!!detailContractId}
        onOpenChange={(v) => { if (!v) setDetailContractId(null); }}
        contract={detailContract}
      />

      {/* Pill flotante · aparece con ≥1 contrato seleccionado. */}
      <ContractFloatingBar
        selectedIds={selectedContracts}
        totalVisible={activeContracts.length}
        allVisibleIds={activeContracts.map((c) => c.id)}
        onSelectAll={(ids) => setSelectedContracts(new Set(ids))}
        onClear={clearContractSelection}
      />
    </div>
  );
}

/* ══════ Contratos (list + row) ══════ */

function ContractsList({
  contracts, actor, canManage, onOpenDetail, selectedIds, onToggleSelect,
}: {
  contracts: CollaborationContract[];
  actor: { name: string; email: string };
  canManage: boolean;
  onOpenDetail: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <FileSignature className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">Sin contratos todavía</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {canManage
            ? "Sube el PDF del contrato de colaboración y envíalo a firmar. Byvaro lo manda a la agencia vía Firmafy y te avisa cuando quede firmado."
            : "Solo el promotor o comercializador puede subir el contrato. Cuando lo envíe a firmar, recibirás un email de Firmafy con el link."}
        </p>
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {contracts.map((c) => (
        <ContractRow
          key={c.id}
          contract={c}
          actor={actor}
          canManage={canManage}
          onOpenDetail={() => onOpenDetail(c.id)}
          selected={selectedIds.has(c.id)}
          onToggleSelect={() => onToggleSelect(c.id)}
        />
      ))}
    </ul>
  );
}

function ContractRow({
  contract: c, onOpenDetail, selected, onToggleSelect,
}: {
  contract: CollaborationContract;
  actor: { name: string; email: string };
  canManage: boolean;
  onOpenDetail: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const status = getDerivedStatus(c);
  return (
    <li
      className={cn(
        "group px-3 sm:px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer",
        selected ? "bg-foreground/5" : "hover:bg-muted/20",
      )}
      onClick={onOpenDetail}
    >
      {/* Checkbox a la IZQUIERDA · aparece en hover o cuando está marcado. */}
      <div
        className="w-5 h-9 flex items-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={selected ? "Deseleccionar contrato" : "Seleccionar contrato"}
          className={cn(
            "h-5 w-5 rounded-[6px] border grid place-items-center transition-all duration-150",
            selected
              ? "opacity-100 bg-foreground border-foreground text-background"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 border-border bg-card hover:border-foreground/40 text-transparent hover:text-foreground",
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      </div>
      {/* Icono PDF · siempre visible. */}
      <span className="h-9 w-8 grid place-items-center shrink-0">
        <PdfIcon className="h-8 w-7 text-muted-foreground/80" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate hover:underline">{c.title}</p>
          <StateBadge label={status.label} tone={status.tone} />
        </div>
        <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
          {c.pdfFilename}
          {typeof c.comision === "number" && c.comision > 0 ? ` · ${c.comision}% comisión` : ""}
          {typeof c.duracionMeses === "number" ? (c.duracionMeses === 0 ? " · indefinido" : ` · ${c.duracionMeses}m`) : ""}
          {c.signers.length > 0 ? ` · ${c.signers.length} firmante${c.signers.length === 1 ? "" : "s"}` : ""}
        </p>
        <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">
          Subido {formatRelative(c.createdAt)}
          {c.sentAt ? ` · enviado ${formatRelative(c.sentAt)}` : ""}
          {c.signedAt ? ` · firmado ${formatRelative(c.signedAt)}` : ""}
          {c.createdBy?.name ? ` · por ${c.createdBy.name}` : ""}
        </p>
      </div>
      <div className="pt-0.5 shrink-0">
        <ContractRowKebab contract={c} onOpenDetail={onOpenDetail} />
      </div>
    </li>
  );
}

/* ══════ Sección Archivados · colapsada por defecto · click en el
        header para mostrar/ocultar la lista completa ══════ */
function ArchivedSection({
  contracts, onOpenDetail,
}: {
  contracts: CollaborationContract[];
  onOpenDetail: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40",
          expanded && "border-b border-border/50",
        )}
      >
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Archivados · {contracts.length}
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {expanded ? "Ocultar" : "Ver"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            strokeWidth={1.75}
          />
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border/40">
          {contracts.map((c) => (
            <ArchivedRow key={c.id} contract={c} onOpenDetail={() => onOpenDetail(c.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchivedRow({
  contract: c, onOpenDetail,
}: {
  contract: CollaborationContract;
  onOpenDetail: () => void;
}) {
  const status = getDerivedStatus(c);
  return (
    <li
      className="group px-3 sm:px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onOpenDetail}
    >
      <span className="h-8 w-7 grid place-items-center shrink-0 opacity-60">
        <PdfIcon className="h-7 w-6 text-muted-foreground/60" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-medium text-foreground truncate">{c.title}</p>
          <StateBadge label={status.label} tone={status.tone} />
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {c.pdfFilename}
          {c.archivedAt ? ` · archivado ${formatRelative(c.archivedAt)}` : ""}
        </p>
      </div>
      <ContractRowKebab contract={c} onOpenDetail={onOpenDetail} canSend={false} />
    </li>
  );
}

/* ══════ Documentos solicitados (list + row) ══════ */

const TYPE_ICON: Record<DocRequestType, typeof Receipt> = {
  invoice:       Receipt,
  "fiscal-cert": ClipboardCheck,
  iban:          Landmark,
  "tax-quarter": FileText,
  "rc-insurance":Shield,
  custom:        Sparkles,
};

function DocRequestsList({
  docs, actor, canManage,
}: {
  docs: AgencyDocRequest[];
  actor: { name: string; email: string };
  canManage: boolean;
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <ClipboardCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">No has solicitado documentos todavía</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Algunas empresas piden factura, IBAN o modelos fiscales antes de ejecutar el pago.
          Solicítalo cuando lo necesites · la agencia lo verá en su panel.
        </p>
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {docs.map((d) => (
        <DocRequestRow key={d.id} req={d} actor={actor} canManage={canManage} />
      ))}
    </ul>
  );
}

function DocRequestRow({
  req: d, actor, canManage,
}: {
  req: AgencyDocRequest;
  actor: { name: string; email: string };
  canManage: boolean;
}) {
  const Icon = TYPE_ICON[d.type];
  const status = DOC_STATUS_LABEL[d.status];
  return (
    <li className="px-4 sm:px-5 py-3 flex items-start gap-3">
      <span className="h-9 w-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{d.label}</p>
          <StateBadge label={status.label} tone={status.tone} />
        </div>
        {d.note && (
          <p className="text-[11.5px] text-muted-foreground/90 mt-1 line-clamp-2 leading-snug">{d.note}</p>
        )}
        <p className="text-[10.5px] text-muted-foreground/80 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>Solicitado {formatRelative(d.requestedAt)}</span>
          {d.uploadedAt && (<><span className="text-border">·</span><span>subido {formatRelative(d.uploadedAt)}</span></>)}
          {d.reviewedAt && (<><span className="text-border">·</span><span>revisado {formatRelative(d.reviewedAt)}</span></>)}
          {d.fileName && (<><span className="text-border">·</span><span className="truncate">{d.fileName}</span></>)}
        </p>
        {d.status === "rejected" && d.rejectionReason && (
          <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
            <X className="h-3 w-3 shrink-0" strokeWidth={2} />
            Rechazado: {d.rejectionReason}
          </p>
        )}
      </div>
      {canManage && (
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {d.status === "pending" && (
            <>
              <button
                onClick={() => {
                  mockAgencyUpload(d.id, { name: `${d.type}-${d.agencyId}.pdf`, size: 95_000 });
                  toast.success("Subida simulada", { description: "En prod lo sube la agencia desde su panel" });
                }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Simular que la agencia sube el documento"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                Simular subida
              </button>
              <button
                onClick={() => { deleteDocRequest(d.id); toast.success("Solicitud cancelada"); }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                title="Cancelar solicitud"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
          {d.status === "uploaded" && (
            <>
              <button
                onClick={() => toast.info("Descarga mock · el archivo real vendrá del backend")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Descargar"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Motivo del rechazo (la agencia lo verá):");
                  if (!reason) return;
                  rejectDocRequest(d.id, reason, actor);
                  toast.success("Documento rechazado");
                }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={() => { approveDocRequest(d.id, actor); toast.success("Documento aprobado"); }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Aprobar
              </button>
            </>
          )}
          {d.status === "approved" && (
            <button
              onClick={() => toast.info("Descarga mock · el archivo real vendrá del backend")}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Descargar"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {d.status === "rejected" && (
            <button
              onClick={() => { deleteDocRequest(d.id); toast.success("Solicitud cerrada"); }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              title="Quitar"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
