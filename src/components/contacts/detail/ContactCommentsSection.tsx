/**
 * Sección de comentarios internos del contacto.
 *
 * Diseñado para usarse dentro del tab Comunicaciones (sub-tab Comentarios)
 * pero también es reutilizable en cualquier sitio (Inicio, sidebar, etc).
 *
 * Funcionalidad:
 *  - Editor inline arriba: textarea + Enter para enviar / Shift+Enter
 *    para salto de línea + botón Enviar.
 *  - Lista cronológica descendente (más recientes arriba).
 *  - Edición y eliminación inline (solo el autor del comentario).
 *  - Adjuntos: hoy solo nombre + size (mock); botón presente para futuro.
 *  - Mergea comentarios del seed mock con los añadidos localmente.
 */

import { useMemo, useRef, useState } from "react";
import {
  Send, MoreHorizontal, Pencil, Trash2, X, Check, MessageSquare, Bot,
} from "lucide-react";
import { getAvatarUrlByName } from "@/lib/team";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import {
  addComment, removeComment, updateComment, loadAllComments,
} from "@/components/contacts/contactCommentsStorage";
import { recordCommentAdded } from "@/components/contacts/contactEventsStorage";
import type { ContactDetail, ContactCommentEntry } from "@/components/contacts/types";

type Props = {
  detail: ContactDetail;
  /** Si true, mostramos un titular y empty state propio. False cuando
   *  ya está dentro de otra cabecera (ej. ContactCommunicationsTab). */
  showHeader?: boolean;
};

export function ContactCommentsSection({ detail, showHeader = false }: Props) {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const comments = useMemo(
    () => loadAllComments(detail.id, detail.comments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail.id, detail.comments, version],
  );

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    const comment: ContactCommentEntry = {
      id: `c-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content,
      timestamp: new Date().toISOString(),
    };
    addComment(detail.id, comment);
    recordCommentAdded(detail.id, { name: user.name, email: user.email }, content, "user");
    setDraft("");
    setVersion((v) => v + 1);
    /* Auto-scroll al editor para que se vea el toast pero no perdamos
     * el contexto. */
    draftRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey || true)) {
      /* Enter normal envía. Shift+Enter salto de línea. */
      e.preventDefault();
      send();
    }
  };

  const handleEdit = (commentId: string, newContent: string) => {
    updateComment(detail.id, commentId, newContent);
    setVersion((v) => v + 1);
    toast.success("Comentario actualizado");
  };

  const handleDelete = async (commentId: string) => {
    const ok = await confirm({
      title: "¿Eliminar comentario?",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    removeComment(detail.id, commentId);
    setVersion((v) => v + 1);
    toast.success("Comentario eliminado");
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            Comentarios internos
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Notas privadas del equipo. El cliente nunca las ve.
          </p>
        </div>
      )}

      {/* ── Editor ── */}
      <div className="bg-card border border-border/40 rounded-2xl p-3 shadow-soft">
        <div className="flex items-start gap-3">
          <Avatar name={user.name} size={32} />
          <div className="flex-1 min-w-0 space-y-2">
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribe una nota interna…"
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] text-muted-foreground">
                Enter para enviar · Shift+Enter para salto de línea
              </p>
              <Button
                onClick={send}
                disabled={!draft.trim()}
                size="sm"
                className="rounded-full h-8"
              >
                <Send className="h-3 w-3" /> Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      {comments.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <div className="h-10 w-10 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-2">
            <MessageSquare className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-foreground">Sin comentarios todavía</p>
          <p className="text-[11.5px] text-muted-foreground mt-1 max-w-sm mx-auto">
            Sé el primero en dejar una nota interna sobre este contacto.
          </p>
        </div>
      ) : (
        <Timeline
          comments={comments}
          currentUserId={user.id}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TIMELINE · línea vertical + avatares en la línea + cards a la dcha,
   con separadores por día (Hoy / Ayer / 22 abril).
   ══════════════════════════════════════════════════════════════════ */

function Timeline({
  comments, currentUserId, onEdit, onDelete,
}: {
  comments: ContactCommentEntry[];
  currentUserId: string;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  /* Agrupamos por día (yyyy-mm-dd) preservando el orden ya descendente. */
  const groups = useMemo(() => {
    const map = new Map<string, ContactCommentEntry[]>();
    for (const c of comments) {
      const day = c.timestamp.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(c);
    }
    return [...map.entries()];
  }, [comments]);

  return (
    <div className="relative pl-9">
      {/* Línea vertical continua a la izquierda */}
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" aria-hidden />

      <div className="space-y-5">
        {groups.map(([day, items]) => (
          <section key={day} className="space-y-2.5">
            {/* Separador de día */}
            <div className="-ml-9 flex items-center gap-2">
              <span className="bg-card border border-border/60 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {dayLabel(day)}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <ul className="space-y-2.5">
              {items.map((c) => (
                <TimelineItem
                  key={c.id}
                  comment={c}
                  isMine={c.authorId === currentUserId}
                  onEdit={(content) => onEdit(c.id, content)}
                  onDelete={() => onDelete(c.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function TimelineItem({
  comment, isMine, onEdit, onDelete,
}: {
  comment: ContactCommentEntry;
  isMine: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);

  const saveEdit = () => {
    const clean = editValue.trim();
    if (!clean || clean === comment.content) {
      setEditing(false);
      setEditValue(comment.content);
      return;
    }
    onEdit(clean);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue(comment.content);
  };

  const isSystem = comment.kind === "system";

  return (
    <li className="relative group">
      {/* Avatar montado sobre la línea vertical (a -36px del padre con pl-9).
       *  Tooltip nativo con el nombre del autor al pasar el ratón. */}
      <div
        className="absolute -left-[36px] top-0 cursor-help"
        title={isSystem ? "Comentario automático del sistema" : comment.authorName}
      >
        <div className="ring-4 ring-background rounded-full">
          {isSystem
            ? <SystemAvatar size={28} />
            : <Avatar name={comment.authorName} size={28} />}
        </div>
      </div>

      {/* Card con el comentario · estilo distinto para system */}
      <div className={cn(
        "rounded-xl px-3.5 py-2.5 shadow-soft border",
        isSystem
          ? "bg-muted/40 border-dashed border-border/60"
          : "bg-card border-border/40",
      )}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            "text-xs font-semibold inline-flex items-center gap-1.5",
            isSystem ? "text-muted-foreground" : "text-foreground",
          )}>
            {isSystem ? (
              <>
                <Bot className="h-3 w-3" />
                Sistema
              </>
            ) : (
              <>
                {comment.authorName}
                {isMine && <span className="text-muted-foreground font-normal">· tú</span>}
              </>
            )}
          </p>
          <p className="text-[10.5px] text-muted-foreground tnum">{timeOnly(comment.timestamp)}</p>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") cancelEdit();
              }}
              autoFocus
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
            />
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={cancelEdit}
                className="h-7 px-3 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={!editValue.trim()}
                className="h-7 px-3 rounded-full text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words leading-relaxed">
            {comment.content}
          </p>
        )}

        {comment.attachments && comment.attachments.length > 0 && !editing && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {comment.attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[10.5px] bg-muted/60 border border-border/40 rounded-full px-2 py-0.5 text-muted-foreground"
              >
                <Pencil className="h-2.5 w-2.5" />
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Menú ⋯ flotante a la derecha del card, solo si es del usuario,
       *  no es del sistema y no está editando */}
      {isMine && !isSystem && !editing && (
        <div className="absolute top-1.5 right-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Acciones"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={4}
              className="w-[140px] p-1 rounded-xl border-border shadow-soft-lg"
            >
              <button
                onClick={() => setEditing(true)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-foreground hover:bg-muted/40 transition-colors"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" /> Editar
              </button>
              <button
                onClick={onDelete}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </li>
  );
}

function dayLabel(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Hoy";
  if (d.getTime() === yesterday.getTime()) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/* ══════ Sub-componentes ══════ */

function Avatar({ name, size }: { name: string; size: number }) {
  const [errored, setErrored] = useState(false);
  const initials = name.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";
  const url = getAvatarUrlByName(name);

  return (
    <div
      className="rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {errored ? (
        <span>{initials}</span>
      ) : (
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

/** Avatar especial para comentarios "system": icono Bot, sin foto. */
function SystemAvatar({ size }: { size: number }) {
  return (
    <div
      className="rounded-full bg-foreground text-background grid place-items-center shrink-0"
      style={{ width: size, height: size }}
    >
      <Bot style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.75} />
    </div>
  );
}

