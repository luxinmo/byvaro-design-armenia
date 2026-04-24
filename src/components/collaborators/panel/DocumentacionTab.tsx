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

import { useState } from "react";
import {
  FileSignature, Plus, Trash2, Pause, Play, FileText, Download,
  Receipt, Landmark, Shield, ShieldCheck, Sparkles, Check, X,
  ClipboardCheck, Upload,
} from "lucide-react";
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
import { DocRequestDialog } from "@/components/collaborators/DocRequestDialog";
import { SectionHeader, StateBadge, formatRelative } from "./shared";

interface Props {
  agency: Agency;
}

export function DocumentacionTab({ agency: a }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const canViewContracts = useHasPermission("collaboration.contracts.view");
  const canManageContracts = useHasPermission("collaboration.contracts.manage");
  const canManageDocs = useHasPermission("collaboration.documents.manage");

  const contracts = useContractsForAgency(a.id);
  const docs = useAgencyDocRequests(a.id);

  const [newChoiceOpen, setNewChoiceOpen] = useState(false);
  const [uploadContractOpen, setUploadContractOpen] = useState(false);
  const [signedUploadOpen, setSignedUploadOpen] = useState(false);
  const [requestDocOpen, setRequestDocOpen] = useState(false);
  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const detailContract = contracts.find((c) => c.id === detailContractId) ?? null;

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
          <ContractsList
            contracts={contracts}
            actor={actor}
            canManage={canManageContracts}
            onOpenDetail={(id) => setDetailContractId(id)}
          />
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
    </div>
  );
}

/* ══════ Contratos (list + row) ══════ */

function ContractsList({
  contracts, actor, canManage, onOpenDetail,
}: {
  contracts: CollaborationContract[];
  actor: { name: string; email: string };
  canManage: boolean;
  onOpenDetail: (id: string) => void;
}) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <FileSignature className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">Sin contratos todavía</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Sube el PDF del contrato de colaboración y envíalo a firmar. Byvaro lo manda a la
          agencia vía Firmafy y te avisa cuando quede firmado.
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
        />
      ))}
    </ul>
  );
}

function ContractRow({
  contract: c, actor, canManage, onOpenDetail,
}: {
  contract: CollaborationContract;
  actor: { name: string; email: string };
  canManage: boolean;
  onOpenDetail: () => void;
}) {
  const status = getDerivedStatus(c);
  return (
    <li
      className="px-4 sm:px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={onOpenDetail}
    >
      <span className="h-9 w-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
        <FileSignature className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
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
      {canManage && (
        <div
          className="flex items-center gap-1 shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {c.status === "draft" && (
            <>
              <button
                onClick={() => { sendContractToSign(c.id, actor); toast.success("Enviado a firmar"); }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} />
                Enviar a firmar
              </button>
              <button
                onClick={() => { deleteContract(c.id); toast.success("Borrador eliminado"); }}
                className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                title="Eliminar borrador"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
          {(c.status === "sent" || c.status === "viewed") && (
            <button
              onClick={() => { revokeContract(c.id, actor); toast.success("Contrato revocado"); }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              title="Revocar envío"
            >
              <Pause className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {(c.status === "signed" || c.status === "expired" || c.status === "revoked") && (
            <button
              onClick={() => { deleteContract(c.id); toast.success("Contrato retirado"); }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              title="Quitar de la lista"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
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
