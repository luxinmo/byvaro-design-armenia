/**
 * ContractFloatingBar · pill flotante centrado abajo que aparece al
 * seleccionar ≥1 contrato. Réplica del patrón de selección múltiple
 * de `AgenciasTabStats` para mantener consistencia cross-producto.
 *
 * En móvil sube a `bottom-[72px]` para no chocar con `MobileBottomNav`.
 *
 * Acciones (de más habitual a menos):
 *   · `N seleccionado(s)`  · counter pill interno.
 *   · `Seleccionar todo`   · selecciona todos los visibles.
 *   · `Limpiar`            · deselecciona.
 *   · `Enviar email`       · abre `/emails?compose=1` con los PDFs pre-adjuntos
 *                            y las agencias destinatarias precargadas.
 *   · `Enviar a firmar`    · solo si hay drafts · dispara Firmafy para todos.
 *   · `Archivar`           · mueve los seleccionados a Archivados.
 *   · `Borrar` (admin)     · solo para rol admin · confirm + delete permanente.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Archive, Trash2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import {
  archiveContract, deleteContract, sendContractToSign,
  getAllContracts,
} from "@/lib/collaborationContracts";
import { setPendingAttachments } from "@/lib/pendingAttachments";
import { agencies } from "@/data/agencies";

interface Props {
  /** IDs seleccionados. */
  selectedIds: Set<string>;
  /** Total visible en la página actual (para "Seleccionar todo"). */
  totalVisible: number;
  /** Devuelve los IDs visibles para select-all. */
  allVisibleIds: string[];
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
}

export function ContractFloatingBar({
  selectedIds, totalVisible, allVisibleIds, onSelectAll, onClear,
}: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const confirm = useConfirm();
  const navigate = useNavigate();
  const canDelete = isAdmin(user);

  const count = selectedIds.size;

  /* Solo los drafts son enviables a firma. */
  const draftCount = useMemo(() => {
    if (count === 0) return 0;
    const all = getAllContracts();
    const idSet = selectedIds;
    return all.filter((c) => idSet.has(c.id) && c.status === "draft").length;
  }, [selectedIds, count]);

  if (count === 0) return null;

  const allSelected = allVisibleIds.every((id) => selectedIds.has(id));

  const bulkSendEmail = () => {
    const all = getAllContracts();
    const selected = all.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    setPendingAttachments(selected.map((c) => ({
      name: c.pdfFilename,
      size: c.pdfSize ?? 0,
      dataUrl: "",
    })));
    /* Destinatarios únicos a partir del email de contacto principal de
     *  las agencias seleccionadas · si ninguna tiene email disponible
     *  el composer abre sin `to` y el usuario elige manualmente. */
    const emails = new Set<string>();
    for (const c of selected) {
      const email = agencies.find((a) => a.id === c.agencyId)?.contactoPrincipal?.email;
      if (email) emails.add(email);
    }
    const params = new URLSearchParams({ compose: "1" });
    if (emails.size > 0) params.set("to", Array.from(emails).join(","));
    if (selected.length === 1) params.set("subject", selected[0].title);
    onClear();
    navigate(`/emails?${params.toString()}`);
  };

  const bulkSendToSign = async () => {
    if (draftCount === 0) return;
    const skipped = count - draftCount;
    if (skipped > 0) {
      const ok = await confirm({
        title: `¿Enviar ${draftCount} a firmar?`,
        description: `${skipped} ${skipped === 1 ? "contrato" : "contratos"} ya no están en borrador · se omitirán.`,
        confirmLabel: `Enviar ${draftCount}`,
      });
      if (!ok) return;
    }
    const all = getAllContracts();
    all.forEach((c) => {
      if (selectedIds.has(c.id) && c.status === "draft") {
        sendContractToSign(c.id, actor);
      }
    });
    toast.success(`${draftCount} ${draftCount === 1 ? "contrato enviado" : "contratos enviados"} a firmar`);
    onClear();
  };

  const bulkArchive = () => {
    selectedIds.forEach((id) => archiveContract(id, actor));
    toast.success(`${count} ${count === 1 ? "contrato archivado" : "contratos archivados"}`);
    onClear();
  };

  const bulkDelete = async () => {
    const ok = await confirm({
      title: `¿Borrar ${count} ${count === 1 ? "contrato" : "contratos"}?`,
      description: "Se eliminan permanentemente. Para quitarlos de la vista sin perderlos, usa 'Archivar'.",
      confirmLabel: `Borrar ${count}`,
      destructive: true,
    });
    if (!ok) return;
    selectedIds.forEach((id) => deleteContract(id));
    toast.success(`${count} ${count === 1 ? "contrato borrado" : "contratos borrados"}`);
    onClear();
  };

  return (
    <div className="fixed bottom-[72px] sm:bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-full bg-foreground text-background shadow-soft-lg border border-foreground/20 px-2 py-1.5 flex items-center gap-1.5 max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)] overflow-x-auto">
      <span className="h-7 px-3 inline-flex items-center rounded-full bg-background/15 text-[11.5px] font-semibold tabular-nums whitespace-nowrap shrink-0">
        {count} {count === 1 ? "seleccionado" : "seleccionados"}
      </span>
      {!allSelected && totalVisible > count && (
        <button
          onClick={() => onSelectAll(allVisibleIds)}
          className="hidden sm:inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors whitespace-nowrap shrink-0"
          title={`Seleccionar los ${totalVisible} visibles`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
          Seleccionar todo ({totalVisible})
        </button>
      )}
      <button
        onClick={onClear}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
        Limpiar
      </button>
      <span className="w-px h-5 bg-background/20 mx-1 shrink-0" aria-hidden />
      <button
        onClick={bulkSendEmail}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background text-foreground text-[11.5px] font-semibold hover:bg-background/90 transition-colors whitespace-nowrap shrink-0"
      >
        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
        Enviar email
      </button>
      {draftCount > 0 && (
        <button
          onClick={bulkSendToSign}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors whitespace-nowrap shrink-0"
          title={`Enviar a firmar ${draftCount} borrador${draftCount === 1 ? "" : "es"}`}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          Enviar a firmar {draftCount < count ? `(${draftCount})` : ""}
        </button>
      )}
      <button
        onClick={bulkArchive}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors whitespace-nowrap shrink-0"
      >
        <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
        Archivar {count}
      </button>
      {canDelete && (
        <button
          onClick={bulkDelete}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-destructive-foreground hover:bg-destructive/40 text-[11.5px] font-medium transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Borrar
        </button>
      )}
    </div>
  );
}
