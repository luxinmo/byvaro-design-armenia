/**
 * ContractRowKebab · menú de 3 puntos por fila de contrato.
 *
 * Se implementa con el wrapper canónico `DropdownMenu` de Radix que
 * porta el contenido al body · imprescindible porque el `<ul>` del
 * listado usa `overflow-hidden` (para el radio redondeado) y si el
 * menú no está portaleado, las opciones de abajo quedan recortadas.
 *
 * Acciones contextuales según estado + rol:
 *   · Ver detalle        · siempre.
 *   · Descargar          · siempre (mock).
 *   · Enviar por email   · envía el PDF del contrato por email con
 *                          la agencia preseleccionada como destinatario.
 *   · Enviar a firmar    · solo si `status=draft`.
 *   · Archivar           · mueve a la sub-sección "Archivados".
 *   · Desarchivar        · inverso · solo si `archived=true`.
 *   · Borrar             · destructive · solo para admin · con confirm.
 */

import { useNavigate } from "react-router-dom";
import {
  MoreVertical, Eye, Download, Send, Archive, ArchiveRestore, Trash2, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  sendContractToSign, archiveContract, unarchiveContract, deleteContract,
  type CollaborationContract,
} from "@/lib/collaborationContracts";
import { setPendingAttachments } from "@/lib/pendingAttachments";
import { agencies } from "@/data/agencies";

interface Props {
  contract: CollaborationContract;
  /** Handler que abre el detalle · expuesto por el padre para que lo
   *  controle centralmente (mantiene el state del dialog abierto). */
  onOpenDetail: () => void;
  /** Si el padre no quiere ofrecer "Enviar a firmar" (ej. la lista
   *  de Archivados), se oculta pasando `canSend={false}`. */
  canSend?: boolean;
}

export function ContractRowKebab({ contract: c, onOpenDetail, canSend = true }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const confirm = useConfirm();
  const navigate = useNavigate();

  const isArchived = !!c.archived;
  const isDraft = c.status === "draft";
  const canDelete = isAdmin(user);

  const handleDownload = () => {
    toast.info("Descarga · disponible cuando conectemos el backend");
  };

  const handleSendEmail = () => {
    const agency = agencies.find((a) => a.id === c.agencyId);
    /* Adjunto mock · cuando exista `pdfDataUrl` en el contrato real,
     *  se pasará aquí. TODO(backend): resolver URL firmada del PDF. */
    setPendingAttachments([
      { name: c.pdfFilename, size: c.pdfSize ?? 0, dataUrl: "" },
    ]);
    const params = new URLSearchParams({ compose: "1" });
    const to = agency?.contactoPrincipal?.email;
    if (to) params.set("to", to);
    params.set("subject", c.title);
    navigate(`/emails?${params.toString()}`);
  };

  const handleSendToSign = () => {
    sendContractToSign(c.id, actor);
    toast.success("Enviado a firmar");
  };

  const handleArchive = () => {
    archiveContract(c.id, actor);
    toast.success("Contrato archivado");
  };

  const handleUnarchive = () => {
    unarchiveContract(c.id, actor);
    toast.success("Contrato desarchivado");
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Borrar contrato?",
      description: "Esta acción elimina el registro permanentemente. Si solo quieres quitarlo de la vista, usa 'Archivar'.",
      confirmLabel: "Borrar",
      destructive: true,
    });
    if (!ok) return;
    deleteContract(c.id);
    toast.success("Contrato borrado");
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "data-[state=open]:bg-muted data-[state=open]:text-foreground",
            )}
            aria-label="Más acciones"
          >
            <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[200px] rounded-xl border border-border bg-card shadow-soft-lg py-1"
        >
          <DropdownMenuItem onSelect={onOpenDetail} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDownload} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Descargar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSendEmail} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} /> Enviar por email
          </DropdownMenuItem>
          {canSend && isDraft && (
            <DropdownMenuItem onSelect={handleSendToSign} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
              <Send className="h-3.5 w-3.5" strokeWidth={1.75} /> Enviar a firmar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem onSelect={handleUnarchive} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
              <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} /> Desarchivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={handleArchive} className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md">
              <Archive className="h-3.5 w-3.5" strokeWidth={1.75} /> Archivar
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onSelect={handleDelete}
              className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md text-destructive focus:text-destructive focus:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Borrar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
