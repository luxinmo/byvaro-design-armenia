/**
 * Tab "Documentos" de la ficha de contacto.
 *
 * Funcionalidad:
 *  - Lista por categoría (Identidad / Legal / Comercial / Otros)
 *  - Subir archivo real (FileReader → dataUrl, max 1.5 MB)
 *  - Vista previa inline (img / pdf / fallback)
 *  - Descarga real (dataUrl)
 *  - Selección múltiple → enviar por email o WhatsApp
 *  - Eliminar (solo locales)
 *
 * Email: pone los adjuntos en `pendingAttachments` y navega al composer.
 * WhatsApp: si hay setup activo, crea un mensaje document por cada
 *   adjunto en la conversación del agente actual.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, IdCard, Briefcase, Folder, Upload, Download,
  Trash2, Search, FileType, Eye, Mail, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setPendingAttachments } from "@/lib/pendingAttachments";
import {
  loadAddedDocuments, removeDocument,
} from "@/components/contacts/contactDocumentsStorage";
import { loadWhatsAppSetup } from "@/lib/whatsappStorage";
import {
  recordDocumentDeleted, recordWhatsAppSent, recordEvent,
} from "@/components/contacts/contactEventsStorage";
import { useCurrentUser } from "@/lib/currentUser";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import { WhatsAppShareDialog, type SharePayload } from "./WhatsAppShareDialog";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { ContactDetail, ContactDocumentEntry } from "@/components/contacts/types";

type DocItem = ContactDocumentEntry & { dataUrl?: string; local?: boolean };

const CATEGORY_META: Record<ContactDocumentEntry["category"], {
  label: string;
  icon: typeof FileText;
  color: string;
}> = {
  id:         { label: "Identidad",  icon: IdCard,    color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  legal:      { label: "Legal",      icon: FileText,  color: "bg-warning/15 text-warning dark:text-warning" },
  commercial: { label: "Comercial",  icon: Briefcase, color: "bg-success/15 text-success dark:text-success" },
  other:      { label: "Otros",      icon: Folder,    color: "bg-muted text-muted-foreground" },
};

const FILTER_OPTIONS: { value: "all" | ContactDocumentEntry["category"]; label: string }[] = [
  { value: "all",        label: "Todos" },
  { value: "id",         label: "Identidad" },
  { value: "legal",      label: "Legal" },
  { value: "commercial", label: "Comercial" },
  { value: "other",      label: "Otros" },
];

type Props = {
  detail: ContactDetail;
  /** WhatsApp es ahora un modal — pedimos al padre que lo abra al
   *  finalizar un envío al propio contacto (antes navegaba al tab). */
  onOpenWhatsApp?: () => void;
};

export function ContactDocumentsTab({ detail, onOpenWhatsApp }: Props) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [version, setVersion] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [filter, setFilter] = useState<"all" | ContactDocumentEntry["category"]>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [waShareOpen, setWaShareOpen] = useState(false);
  const [waSharePayload, setWaSharePayload] = useState<SharePayload[]>([]);

  /* mock + locales (locales primero). */
  const all = useMemo<DocItem[]>(() => {
    const local = loadAddedDocuments(detail.id).map((d) => ({ ...d, local: true }));
    return [...local, ...detail.documents.map((d) => ({ ...d, local: false }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id, detail.documents, version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((d) => {
      if (filter !== "all" && d.category !== filter) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, filter, query]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: all.length, id: 0, legal: 0, commercial: 0, other: 0 };
    for (const d of all) m[d.category] = (m[d.category] ?? 0) + 1;
    return m;
  }, [all]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedDocs = useMemo(
    () => all.filter((d) => selected.has(d.id)),
    [all, selected],
  );
  const sendableDocs = selectedDocs.filter((d) => !!d.dataUrl);

  const handleDownload = (doc: DocItem) => {
    if (!doc.dataUrl) {
      toast.info("Documento del seed mock — no hay archivo real para descargar.");
      return;
    }
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleRemove = async (doc: DocItem) => {
    if (!doc.local) {
      toast.info("Documento del seed mock — no se puede eliminar (es de demostración).");
      return;
    }
    const ok = await confirm({
      title: "¿Eliminar documento?",
      description: `Se eliminará "${doc.name}". Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    removeDocument(detail.id, doc.id);
    recordDocumentDeleted(detail.id, { name: user.name, email: user.email }, doc.name);
    setSelected((prev) => {
      const next = new Set(prev); next.delete(doc.id); return next;
    });
    setVersion((v) => v + 1);
    toast.success("Documento eliminado");
  };

  /* Helper: log de evento "email_sent" en el contacto actual cuando
   *  se inicia el envío desde su ficha. (Si el usuario cambia el
   *  destinatario en el composer, el evento se dispara en el contacto
   *  destino al confirmar el envío real desde GmailInterface.) */
  const recordEmailInitiation = () => {
    recordEvent(detail.id, {
      type: "email_sent",
      title: sendableDocs.length === 1
        ? `Email iniciado con adjunto: ${sendableDocs[0].name}`
        : `Email iniciado con ${sendableDocs.length} adjuntos`,
      actor: user.name,
      actorEmail: user.email,
    });
  };

  /* ── Enviar por email ── Adjuntos van precargados en el composer.
   *  Destinatario VACÍO: el usuario decide a quién mandar (puede ser
   *  el contacto actual, otro distinto, o varios). */
  const sendByEmail = () => {
    if (sendableDocs.length === 0) {
      toast.error("Los documentos seleccionados son demo, no se pueden enviar.");
      return;
    }
    if (sendableDocs.length < selectedDocs.length) {
      toast.info(`${selectedDocs.length - sendableDocs.length} documentos demo serán omitidos.`);
    }
    setPendingAttachments(sendableDocs.map((d) => ({
      name: d.name,
      size: d.size,
      dataUrl: d.dataUrl!,
    })));
    const params = new URLSearchParams({ compose: "1" });
    if (sendableDocs.length === 1) {
      params.set("subject", sendableDocs[0].name.replace(/\.[^.]+$/, ""));
    }
    recordEmailInitiation();
    navigate(`/emails?${params.toString()}`);
    clearSelection();
  };

  /* ── Enviar por WhatsApp ── Abre el dialog para que el usuario elija
   *  uno o varios destinatarios (por defecto el contacto actual). */
  const sendByWhatsApp = () => {
    const setup = loadWhatsAppSetup();
    if (!setup) {
      toast.error("WhatsApp no configurado · ve a Ajustes");
      return;
    }
    if (sendableDocs.length === 0) {
      toast.error("Los documentos seleccionados son demo, no se pueden enviar.");
      return;
    }
    if (sendableDocs.length < selectedDocs.length) {
      toast.info(`${selectedDocs.length - sendableDocs.length} documentos demo serán omitidos.`);
    }
    setWaSharePayload(sendableDocs.map((d) => ({
      name: d.name,
      size: d.size,
      dataUrl: d.dataUrl!,
    })));
    setWaShareOpen(true);
  };

  const onWhatsAppSent = (recipientIds: string[]) => {
    /* Audit log en cada destinatario. */
    const by = { name: user.name, email: user.email };
    const summary = sendableDocs.length === 1
      ? sendableDocs[0].name
      : `${sendableDocs.length} documentos: ${sendableDocs.slice(0, 2).map((d) => d.name).join(", ")}${sendableDocs.length > 2 ? "…" : ""}`;
    recipientIds.forEach((rid) => recordWhatsAppSent(rid, by, summary));
    clearSelection();
    /* Si el envío incluye al contacto actual, abrimos el modal. */
    if (recipientIds.includes(detail.id)) {
      onOpenWhatsApp?.();
    }
  };

  return (
    <div className="space-y-5">
      {/* Header con stats + acción */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-5">
          <Stat value={counts.all} label="Total" />
          <Stat value={counts.id} label="Identidad" />
          <Stat value={counts.legal} label="Legal" />
          <Stat value={counts.commercial} label="Comercial" />
        </div>
        <Button onClick={() => setUploadOpen(true)} size="sm" className="rounded-full">
          <Upload className="h-3.5 w-3.5" /> Subir documento
        </Button>
      </div>

      {/* Buscador + filtros por categoría */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar documento…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map((o) => {
            const active = filter === o.value;
            const count = counts[o.value] ?? 0;
            return (
              <button
                key={o.value}
                onClick={() => setFilter(o.value)}
                className={cn(
                  "h-8 px-3 rounded-full text-xs font-medium transition-colors border inline-flex items-center gap-1.5",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground",
                )}
              >
                {o.label}
                {count > 0 && (
                  <span className={cn(
                    "tnum text-[10px]",
                    active ? "text-background/70" : "text-muted-foreground/70",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        all.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} />
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {query ? `Sin coincidencias para "${query}"` : "Sin documentos en esta categoría"}
            </p>
          </div>
        )
      ) : (
        <div className={cn("space-y-2", selected.size > 0 && "pb-24")}>
          {filtered.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              selected={selected.has(d.id)}
              onToggleSelect={() => toggleSelected(d.id)}
              onPreview={() => setPreviewDoc(d)}
              onDownload={() => handleDownload(d)}
              onRemove={() => handleRemove(d)}
            />
          ))}
        </div>
      )}

      {/* ══════ Barra flotante de selección ══════ */}
      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          sendableCount={sendableDocs.length}
          onClear={clearSelection}
          onEmail={sendByEmail}
          onWhatsApp={sendByWhatsApp}
        />
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contactId={detail.id}
        onSaved={() => setVersion((v) => v + 1)}
      />

      <DocumentPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        document={previewDoc}
      />

      <WhatsAppShareDialog
        open={waShareOpen}
        onOpenChange={setWaShareOpen}
        defaultContactId={detail.id}
        attachments={waSharePayload}
        onSent={onWhatsAppSent}
      />
    </div>
  );
}

/* ══════ Sub-componentes ══════ */

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-foreground tnum">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
    </div>
  );
}

function DocumentRow({
  doc, selected, onToggleSelect, onPreview, onDownload, onRemove,
}: {
  doc: DocItem;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const meta = CATEGORY_META[doc.category];
  const Icon = meta.icon;
  const date = new Date(doc.uploadedAt);
  const dateLabel = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <article className={cn(
      "rounded-2xl border shadow-soft p-3.5 flex items-center gap-3 transition-all",
      selected
        ? "bg-foreground/5 border-foreground/30 shadow-soft-lg"
        : "bg-card border-border/40 hover:shadow-soft-lg",
    )}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "h-5 w-5 rounded-md border grid place-items-center transition-colors shrink-0",
          selected
            ? "bg-foreground border-foreground text-background"
            : "border-border hover:border-foreground/40",
        )}
        aria-label={selected ? "Deseleccionar" : "Seleccionar"}
      >
        {selected && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M3 8l3.5 3.5L13 5" />
          </svg>
        )}
      </button>

      {/* Icono categoría — click → preview */}
      <button
        onClick={onPreview}
        className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0 hover:opacity-80 transition-opacity", meta.color)}
        title="Vista previa"
        aria-label="Vista previa"
      >
        <Icon className="h-4 w-4" />
      </button>

      {/* Nombre + meta — click → preview */}
      <button
        onClick={onPreview}
        className="flex-1 min-w-0 text-left"
        title="Vista previa"
      >
        <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-2">
          <span className="truncate">{doc.name}</span>
          {!doc.local && (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5 shrink-0">
              demo
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
          <FileType className="h-3 w-3" />
          <span>{meta.label}</span>
          <span className="text-border" aria-hidden>·</span>
          <span className="tnum">{formatBytes(doc.size)}</span>
          <span className="text-border" aria-hidden>·</span>
          <span>{dateLabel}</span>
          <span className="text-border" aria-hidden>·</span>
          <span>{doc.uploadedBy}</span>
        </p>
      </button>

      {/* Acciones */}
      <div className="flex items-center gap-1 shrink-0">
        <IconBtn icon={Eye} onClick={onPreview} title="Vista previa" />
        <IconBtn icon={Download} onClick={onDownload} title="Descargar" />
        <IconBtn icon={Trash2} onClick={onRemove} title="Eliminar" destructive />
      </div>
    </article>
  );
}

function IconBtn({
  icon: Icon, onClick, title, destructive,
}: { icon: React.ComponentType<{ className?: string }>; onClick: () => void; title: string; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "h-9 w-9 rounded-xl grid place-items-center transition-colors",
        destructive
          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function SelectionBar({
  count, sendableCount, onClear, onEmail, onWhatsApp,
}: {
  count: number;
  sendableCount: number;
  onClear: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
}) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 z-40 max-w-[calc(100vw-2rem)]">
      <div className="bg-foreground text-background shadow-soft-lg rounded-full pl-3 pr-1.5 py-1.5 flex items-center gap-2">
        <span className="text-xs font-medium pl-1">
          <strong className="tnum">{count}</strong> {count === 1 ? "seleccionado" : "seleccionados"}
          {sendableCount < count && (
            <span className="text-background/60 ml-1.5 text-[10.5px]">({count - sendableCount} demo)</span>
          )}
        </span>
        <div className="h-5 w-px bg-background/20" />
        <button
          onClick={onEmail}
          disabled={sendableCount === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium hover:bg-background/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Enviar por email"
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </button>
        <button
          onClick={onWhatsApp}
          disabled={sendableCount === 0}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium hover:bg-background/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Enviar por WhatsApp"
        >
          <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
        </button>
        <button
          onClick={onClear}
          className="h-8 w-8 rounded-full grid place-items-center hover:bg-background/10 transition-colors"
          title="Cancelar selección"
          aria-label="Cancelar selección"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <FileText className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin documentos todavía</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Sube DNI, contratos, ofertas o cualquier archivo asociado a este contacto.
      </p>
      <Button onClick={onUpload} size="sm" className="rounded-full mt-4">
        <Upload className="h-3.5 w-3.5" /> Subir documento
      </Button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
