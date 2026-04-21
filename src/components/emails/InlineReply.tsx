/**
 * InlineReply · Editor enriquecido estilo Gmail.
 *
 * Layout:
 *   [Avatar]  [Reply ↓]  [Destinatarios]           [🖼 attach overlay]
 *             Body editor (contentEditable)
 *             [···] toggle para mostrar/ocultar la cita
 *             ━━━━━━━━━━━━━━━━━━━━━━━━━━
 *             [Toolbar de formato · pill centrado]
 *             ⚠ Warning confidencial (si destinatario externo)
 *             [Enviar+archivar] [Enviar▼] [AI] [Aa] [✏] [📎] [🔗] [😊] [🖼] [🔒] [✍] [📅] [⋮] [🗑]
 *
 * - El quote HTML (<div class="byvaro-quote">) se oculta por defecto
 *   vía CSS; el botón ··· alterna su visibilidad.
 * - La firma (<!--byvaro-signature-->) se mantiene inline al final
 *   del body para que el Signature picker la pueda reemplazar.
 * - Aviso confidencial: si el destinatario termina en dominio distinto
 *   al del remitente (heurística mock).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, Link2, Paperclip, Image as ImageIcon, Smile,
  Trash2, X, Reply, ChevronDown, MoreHorizontal, AlignLeft,
  List, ListOrdered, Quote, Strikethrough, RemoveFormatting,
  Sparkles, Type, Lock, PenLine, CalendarClock, AlertTriangle,
  Palette, CornerUpLeft, CornerUpRight, Send as SendIcon, Archive,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  EmailSignature,
  applySignature,
  stripSignature,
} from "./signatures";

export type InlineDraft = {
  to: string;
  subject: string;
  bodyHtml: string;
};

interface Props {
  mode: "reply" | "replyAll" | "forward";
  draft: InlineDraft;
  onChange: (next: InlineDraft) => void;
  onClose: () => void;
  onSend: () => void;
  /** Email del usuario actual (para avatar + heurística de confidencial). */
  fromEmail?: string;
  /** Nombre del usuario (para iniciales del avatar). */
  fromName?: string;
  signatures: EmailSignature[];
  activeSignatureId: string | null;
  onChangeSignature: (id: string | null) => void;
  onOpenSignatureManager: () => void;
  /** Cambio de modo Reply → ReplyAll → Forward desde el header. */
  onChangeMode?: (mode: "reply" | "replyAll" | "forward") => void;
}

const MODE_LABEL = {
  reply: "Responder",
  replyAll: "Responder a todos",
  forward: "Reenviar",
} as const;

export default function InlineReply({
  mode,
  draft,
  onChange,
  onClose,
  onSend,
  fromEmail,
  fromName,
  signatures,
  activeSignatureId,
  onChangeSignature,
  onOpenSignatureManager,
  onChangeMode,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [showQuote, setShowQuote] = useState(false);
  const [confidentialDismissed, setConfidentialDismissed] = useState(false);
  const isInitialized = useRef(false);

  /* ══════ Avatar + destinatarios ══════ */

  const avatarInitials = useMemo(() => {
    const source = fromName ?? fromEmail ?? "?";
    return source
      .split(/[\s@]+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [fromName, fromEmail]);

  const recipientList = draft.to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  /** Estado del input "añadir destinatario" al final de los chips. */
  const [recipientDraft, setRecipientDraft] = useState("");

  const myDomain = useMemo(
    () => (fromEmail?.split("@")[1] ?? "").toLowerCase(),
    [fromEmail],
  );
  const isExternal = (email: string) => {
    const d = email.split("@")[1]?.toLowerCase() ?? "";
    return d && d !== myDomain;
  };

  const removeRecipient = (email: string) => {
    const next = recipientList.filter((r) => r !== email).join(", ");
    onChange({ ...draft, to: next });
  };

  const addRecipient = () => {
    const clean = recipientDraft.trim().replace(/,$/, "");
    if (!clean) return;
    if (recipientList.includes(clean)) {
      setRecipientDraft("");
      return;
    }
    const next = [...recipientList, clean].join(", ");
    onChange({ ...draft, to: next });
    setRecipientDraft("");
  };

  /* ══════ Aviso confidencial · heurística simple ══════
   * Si hay destinatario cuyo dominio difiere del de la cuenta activa,
   * mostramos el warning (sólo una vez; se puede cerrar). */
  const externalRecipients = useMemo(
    () => recipientList.filter(isExternal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.to, myDomain],
  );

  const showConfidentialWarning =
    !confidentialDismissed && externalRecipients.length > 0 && mode !== "forward";

  /* ══════ Lifecycle ══════ */

  useEffect(() => {
    if (!editorRef.current || isInitialized.current) return;
    editorRef.current.innerHTML = draft.bodyHtml || "";
    isInitialized.current = true;
    editorRef.current.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editorRef.current, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swapSignature = (id: string | null) => {
    onChangeSignature(id);
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    const sig = id ? signatures.find((s) => s.id === id)?.html ?? null : null;
    const next = applySignature(current, sig);
    editorRef.current.innerHTML = next;
    onChange({ ...draft, bodyHtml: next });
  };

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    sync();
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = window.prompt("Introduce la URL");
    if (url) exec("createLink", url);
  };

  const sync = () => {
    if (editorRef.current) onChange({ ...draft, bodyHtml: editorRef.current.innerHTML });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const oversize = incoming.find((f) => f.size > 25 * 1024 * 1024);
    if (oversize) {
      toast.error(`${oversize.name} supera el límite de 25 MB`);
      return;
    }
    setFiles((prev) => [...prev, ...incoming]);
    toast.success(
      `${incoming.length} archivo${incoming.length > 1 ? "s" : ""} adjuntado${incoming.length > 1 ? "s" : ""}`,
    );
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const sendAndArchive = () => {
    onSend();
    // El padre decide la acción real — aquí solo señalamos la intención
    toast.success("Mensaje enviado y archivado");
  };

  return (
    <div className="mt-6 flex items-start gap-3">
      {/* Avatar izquierdo — estilo Gmail */}
      <div className="hidden sm:flex shrink-0 mt-1">
        <div className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-xs tnum">
          {avatarInitials}
        </div>
      </div>

      {/* Tarjeta del editor */}
      <div className="flex-1 min-w-0 border border-border rounded-2xl bg-card overflow-hidden shadow-soft">
        {/* Header: Mode dropdown + destinatarios como chips */}
        <div className="flex items-start gap-2 px-4 pt-3 pb-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Cambiar tipo de respuesta"
                className="h-7 inline-flex items-center gap-1 px-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0 mt-0.5"
              >
                <Reply className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-1 rounded-2xl border-border shadow-soft-lg">
              {(["reply", "replyAll", "forward"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChangeMode?.(m)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2",
                    m === mode && "bg-muted",
                  )}
                >
                  {m === "forward" ? <PenLine className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
                  {MODE_LABEL[m]}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Chips destinatarios */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              Para
            </span>
            {recipientList.map((email) => {
              const external = isExternal(email);
              return (
                <span
                  key={email}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-xs max-w-full",
                    external
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : "bg-muted text-foreground border border-border",
                  )}
                  title={external ? "Destinatario externo a tu organización" : undefined}
                >
                  <span className={cn("truncate", external && "underline decoration-dotted")}>
                    {email}
                  </span>
                  <button
                    onClick={() => removeRecipient(email)}
                    title="Quitar destinatario"
                    className="h-4 w-4 rounded-full hover:bg-background/60 flex items-center justify-center shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <input
              value={recipientDraft}
              onChange={(e) => setRecipientDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                  e.preventDefault();
                  addRecipient();
                }
                if (e.key === "Backspace" && !recipientDraft && recipientList.length > 0) {
                  removeRecipient(recipientList[recipientList.length - 1]);
                }
              }}
              onBlur={() => recipientDraft && addRecipient()}
              placeholder={recipientList.length === 0 ? "Añadir destinatarios" : ""}
              className="flex-1 min-w-[120px] bg-transparent outline-none text-xs h-6 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Subject (solo forward) */}
        {mode === "forward" && (
          <div className="flex items-center px-4 py-1.5 border-t border-border gap-3">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Asunto</span>
            <input
              value={draft.subject}
              onChange={(e) => onChange({ ...draft, subject: e.target.value })}
              placeholder="Asunto"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
        )}

        {/* Editor + placeholder estilo Gmail */}
        <div className="relative px-4">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={sync}
            data-show-quote={showQuote ? "1" : "0"}
            className={cn(
              "min-h-[140px] max-h-[420px] overflow-y-auto py-2 text-sm outline-none prose prose-sm max-w-none [&_*]:max-w-full",
              /* Cuando showQuote = false, ocultamos el bloque citado vía CSS */
              "[&[data-show-quote=\"0\"]_.byvaro-quote]:hidden",
            )}
          />

          {/* Placeholder custom "Pulsa / para usar IA" — solo si editor vacío */}
          {(!draft.bodyHtml || draft.bodyHtml.replace(/<[^>]*>/g, "").trim() === "") && (
            <div className="pointer-events-none absolute left-4 top-2 text-sm text-muted-foreground">
              Pulsa <kbd className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">/</kbd> para usar Ayúdame a escribir
            </div>
          )}
        </div>

        {/* Toggle del quote — solo si hay cita */}
        {draft.bodyHtml.includes("byvaro-quote") && (
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowQuote((v) => !v)}
              title={showQuote ? "Ocultar contenido citado" : "Mostrar contenido citado"}
              className="h-6 w-10 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Attachments */}
        {files.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted rounded-full pl-3 pr-1 py-1 text-xs">
                <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate max-w-[180px]">{f.name}</span>
                <span className="text-muted-foreground">{formatSize(f.size)}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="h-5 w-5 rounded-full hover:bg-background flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Toolbar formato — pill centrada estilo Gmail. En viewports
         * estrechos hace scroll horizontal dentro del pill para no
         * desbordar la tarjeta. */}
        <div className="px-4 pb-2 overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-0.5 px-1.5 h-9 rounded-full bg-muted/60 w-max">
            <FmtButton title="Deshacer" onClick={() => exec("undo")} icon={<CornerUpLeft className="h-3.5 w-3.5" />} />
            <FmtButton title="Rehacer" onClick={() => exec("redo")} icon={<CornerUpRight className="h-3.5 w-3.5" />} />
            <Divider />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Fuente"
                  className="h-7 px-2 rounded-md hover:bg-background inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  Sans Serif <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-40 p-1 rounded-xl border-border shadow-soft-lg">
                {["Sans Serif", "Serif", "Monospace"].map((f) => (
                  <button
                    key={f}
                    onClick={() => exec("fontName", f)}
                    className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-muted"
                  >
                    {f}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Tamaño de texto"
                  className="h-7 w-8 rounded-md hover:bg-background inline-flex items-center justify-center text-muted-foreground"
                >
                  <Type className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-40 p-1 rounded-xl border-border shadow-soft-lg">
                {[
                  { label: "Pequeño", v: "2" },
                  { label: "Normal", v: "3" },
                  { label: "Grande", v: "5" },
                  { label: "Enorme", v: "7" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => exec("fontSize", o.v)}
                    className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-muted"
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Divider />
            <FmtButton title="Negrita" onClick={() => exec("bold")} icon={<Bold className="h-3.5 w-3.5" />} />
            <FmtButton title="Cursiva" onClick={() => exec("italic")} icon={<Italic className="h-3.5 w-3.5" />} />
            <FmtButton title="Subrayado" onClick={() => exec("underline")} icon={<Underline className="h-3.5 w-3.5" />} />
            <FmtButton
              title="Color"
              onClick={() => {
                const color = window.prompt("Color (hex o nombre)", "#0F172A");
                if (color) exec("foreColor", color);
              }}
              icon={<Palette className="h-3.5 w-3.5" />}
            />
            <Divider />
            <FmtButton title="Alinear" onClick={() => exec("justifyLeft")} icon={<AlignLeft className="h-3.5 w-3.5" />} />
            <FmtButton title="Lista numerada" onClick={() => exec("insertOrderedList")} icon={<ListOrdered className="h-3.5 w-3.5" />} />
            <FmtButton title="Lista" onClick={() => exec("insertUnorderedList")} icon={<List className="h-3.5 w-3.5" />} />
            <Divider />
            <FmtButton title="Cita" onClick={() => exec("formatBlock", "blockquote")} icon={<Quote className="h-3.5 w-3.5" />} />
            <FmtButton title="Tachado" onClick={() => exec("strikeThrough")} icon={<Strikethrough className="h-3.5 w-3.5" />} />
            <FmtButton title="Limpiar formato" onClick={() => exec("removeFormat")} icon={<RemoveFormatting className="h-3.5 w-3.5" />} />
          </div>
        </div>

        {/* Warning confidencial — fila amarilla tipo Gmail. Padding lateral
         * alineado con el resto del editor (px-4). */}
        {showConfidentialWarning && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="flex-1 leading-snug">
              <strong>Ten cuidado si vas a compartir información confidencial.</strong>{" "}
              {externalRecipients.join(", ")} no pertenece a tu organización.
            </p>
            <button
              onClick={() => setConfidentialDismissed(true)}
              title="Ocultar aviso"
              className="h-6 w-6 rounded-full hover:bg-amber-200 flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Footer · acciones */}
        <div className="flex items-center gap-1 px-3 h-14 border-t border-border bg-muted/20">
          {/* Enviar — split button con opciones (Enviar · Enviar+archivar · Programar) */}
          <div className="inline-flex items-stretch rounded-full overflow-hidden shadow-soft">
            <button
              onClick={onSend}
              className="h-8 px-4 bg-foreground text-background text-sm font-medium hover:bg-foreground/90 inline-flex items-center"
            >
              Enviar
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Opciones de envío"
                  className="h-8 w-7 bg-foreground text-background hover:bg-foreground/90 inline-flex items-center justify-center border-l border-background/20"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1 rounded-2xl border-border shadow-soft-lg">
                <button
                  onClick={onSend}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                >
                  <SendIcon className="h-4 w-4 text-muted-foreground" />
                  Enviar
                </button>
                <button
                  onClick={sendAndArchive}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  Enviar y archivar
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => toast.info("Programar envío — próximamente")}
                  className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                >
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Programar envío
                </button>
              </PopoverContent>
            </Popover>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          <IconBtn
            onClick={() => toast.info("Ayúdame a escribir — próximamente")}
            title="Ayúdame a escribir"
            bgClass="bg-foreground text-background hover:bg-foreground/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </IconBtn>

          {/* Signature picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Firma"
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <PenLine className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1 rounded-2xl border-border shadow-soft-lg">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Insertar firma
              </div>
              {signatures.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aún no hay firmas.</p>
              )}
              {signatures.map((s) => (
                <button
                  key={s.id}
                  onClick={() => swapSignature(s.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2",
                    activeSignatureId === s.id && "bg-muted",
                  )}
                >
                  <span className="flex-1 truncate">{s.name}</span>
                  {activeSignatureId === s.id && (
                    <span className="text-[10px] text-emerald-600 font-semibold">ACTIVA</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => swapSignature(null)}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground"
              >
                Sin firma
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={onOpenSignatureManager}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted text-foreground"
              >
                Gestionar firmas…
              </button>
            </PopoverContent>
          </Popover>

          <IconBtn
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar archivo"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={insertLink} title="Insertar enlace">
            <Link2 className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={() => imageInputRef.current?.click()}
            title="Insertar imagen"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={() => toast.info("Selector de emoji — próximamente")}
            title="Emoji"
          >
            <Smile className="h-3.5 w-3.5" />
          </IconBtn>

          <div className="w-px h-6 bg-border mx-1" />

          <IconBtn
            onClick={() => toast.info("Modo confidencial — próximamente")}
            title="Modo confidencial"
          >
            <Lock className="h-3.5 w-3.5" />
          </IconBtn>

          <div className="flex-1" />

          <button
            onClick={onClose}
            title="Descartar"
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════ Sub-componentes ══════ */

function FmtButton({
  title,
  onClick,
  icon,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-border mx-0.5" aria-hidden />;
}

function IconBtn({
  onClick,
  title,
  children,
  bgClass,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  bgClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
        bgClass ?? "hover:bg-muted text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export { stripSignature };
