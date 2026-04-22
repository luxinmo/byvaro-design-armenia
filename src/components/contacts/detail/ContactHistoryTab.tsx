/**
 * Tab "Historial" de la ficha de contacto.
 *
 * Audit log unificado: muestra TODO lo que ha pasado con el contacto
 * (creación, ediciones, asignaciones, vínculos, visitas, comentarios,
 * emails, whatsapps, documentos…) en orden cronológico descendente.
 *
 * Sub-pills filtran por categoría:
 *   Todo · Comentarios · Emails · WhatsApp · Web · Sistema
 *
 * Datos = mock determinista (precargado) + locales (recordEvent desde
 * cualquier acción de la app). Ver contactEventsStorage.
 */

import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, MessageSquare, Mail, MailCheck, MailOpen, Globe, Settings,
  Calendar as CalendarIcon, CheckCircle2, XCircle, FileText, Trash2,
  UserPlus, UserMinus, Heart, Tag, BadgeCheck, ClipboardList,
  Pencil, Plus, ArrowRight, Bot, Send, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { getAvatarUrlByName } from "@/lib/team";
import { useCurrentUser } from "@/lib/currentUser";
import {
  loadMergedEvents,
  recordCommentAdded,
} from "@/components/contacts/contactEventsStorage";
import { addComment } from "@/components/contacts/contactCommentsStorage";
import {
  EVENT_CATEGORY,
  type ContactDetail,
  type ContactTimelineEvent,
  type ContactTimelineEventType,
  type TimelineCategory,
  type ContactCommentEntry,
} from "@/components/contacts/types";

const SUB_TABS: { id: TimelineCategory; label: string; icon: typeof Sparkles }[] = [
  { id: "all",      label: "Todo",        icon: Sparkles },
  { id: "comments", label: "Comentarios", icon: MessageSquare },
  { id: "emails",   label: "Emails",      icon: Mail },
  { id: "whatsapp", label: "WhatsApp",    icon: WhatsAppIcon as typeof Sparkles },
  { id: "web",      label: "Web",         icon: Globe },
  { id: "system",   label: "Sistema",     icon: Settings },
];

/** Icono y color por tipo de evento. */
const EVENT_META: Record<ContactTimelineEventType, {
  icon: typeof Sparkles;
  iconClass: string;
}> = {
  lead_entry:        { icon: Sparkles,       iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  contact_created:   { icon: Plus,           iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  contact_edited:    { icon: Pencil,         iconClass: "bg-muted text-muted-foreground" },
  contact_deleted:   { icon: Trash2,         iconClass: "bg-destructive/15 text-destructive" },
  assignee_added:    { icon: UserPlus,       iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  assignee_removed:  { icon: UserMinus,      iconClass: "bg-muted text-muted-foreground" },
  relation_linked:   { icon: Heart,          iconClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  relation_unlinked: { icon: Heart,          iconClass: "bg-muted text-muted-foreground" },
  tag_added:         { icon: Tag,            iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  tag_removed:       { icon: Tag,            iconClass: "bg-muted text-muted-foreground" },
  status_changed:    { icon: BadgeCheck,     iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  visit_scheduled:   { icon: CalendarIcon,   iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  visit_done:        { icon: CheckCircle2,   iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  visit_cancelled:   { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  visit_evaluated:   { icon: CheckCircle2,   iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  email_sent:        { icon: Send,           iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  email_received:    { icon: Mail,           iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  email_delivered:   { icon: MailCheck,      iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  email_opened:      { icon: MailOpen,       iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  whatsapp_sent:     { icon: WhatsAppIcon as typeof Sparkles, iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  whatsapp_received: { icon: WhatsAppIcon as typeof Sparkles, iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  call:              { icon: Sparkles,       iconClass: "bg-muted text-muted-foreground" },
  comment:           { icon: MessageSquare,  iconClass: "bg-foreground/5 text-foreground" },
  registration:      { icon: ClipboardList,  iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  web_activity:      { icon: Globe,          iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  document_uploaded: { icon: FileText,       iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  document_deleted:  { icon: Trash2,         iconClass: "bg-destructive/15 text-destructive" },
  system_change:     { icon: Settings,       iconClass: "bg-muted text-muted-foreground" },
};

export function ContactHistoryTab({ detail }: { detail: ContactDetail }) {
  const [category, setCategory] = useState<TimelineCategory>("all");
  /* Bump para forzar re-render tras añadir un comentario nuevo. */
  const [version, setVersion] = useState(0);

  /* Combina mock + locales, ya ordenado descendentemente. */
  const allEvents = useMemo(
    () => loadMergedEvents(detail.id, detail.timeline),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail.id, detail.timeline, version],
  );

  const filtered = useMemo(() => {
    if (category === "all") return allEvents;
    return allEvents.filter((e) => EVENT_CATEGORY[e.type] === category);
  }, [allEvents, category]);

  /* Agrupar por día para mostrar separadores temporales. */
  const groups = useMemo(() => {
    const map = new Map<string, ContactTimelineEvent[]>();
    for (const e of filtered) {
      const day = e.timestamp.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  /* Conteos por categoría para los badges de cada sub-pill. */
  const counts = useMemo(() => {
    const c: Record<TimelineCategory, number> = {
      all: allEvents.length,
      comments: 0, emails: 0, whatsapp: 0, web: 0, system: 0,
    };
    for (const e of allEvents) {
      const cat = EVENT_CATEGORY[e.type];
      if (cat !== "all") c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [allEvents]);

  return (
    <div className="space-y-4">
      {/* Sub-pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = category === t.id;
          const count = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => setCategory(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
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

      {/* Editor de comentarios — visible en "Todo" y "Comentarios".
       *  Permite dejar una nota interna sin salir del Historial (ya no
       *  hay tab Comentarios separado). */}
      {(category === "all" || category === "comments") && (
        <CommentComposer
          contactId={detail.id}
          onSent={() => setVersion((v) => v + 1)}
        />
      )}

      {/* Timeline */}
      {filtered.length === 0 ? (
        <EmptyState category={category} />
      ) : (
        <Timeline groups={groups} contactId={detail.id} />
      )}
    </div>
  );
}

/* ══════ Editor inline de comentarios ══════ */

function CommentComposer({
  contactId,
  onSent,
}: {
  contactId: string;
  onSent: () => void;
}) {
  const user = useCurrentUser();
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

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
    addComment(contactId, comment);
    recordCommentAdded(
      contactId,
      { name: user.name, email: user.email },
      content,
      "user",
    );
    setDraft("");
    onSent();
    ref.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-3 shadow-soft">
      <div className="flex items-start gap-3">
        <ComposerAvatar name={user.name} />
        <div className="flex-1 min-w-0 space-y-2">
          <textarea
            ref={ref}
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
  );
}

function ComposerAvatar({ name }: { name: string }) {
  const [errored, setErrored] = useState(false);
  const initials = name.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";
  const url = getAvatarUrlByName(name);
  return (
    <div className="h-8 w-8 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-[11px] shrink-0 overflow-hidden">
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

/* ══════ Sub-componentes ══════ */

function Timeline({
  groups, contactId,
}: {
  groups: [string, ContactTimelineEvent[]][];
  contactId: string;
}) {
  return (
    <div className="relative pl-9">
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" aria-hidden />

      <div className="space-y-5">
        {groups.map(([day, items]) => (
          <section key={day} className="space-y-2.5">
            <div className="-ml-9 flex items-center gap-2">
              <span className="bg-card border border-border/60 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {dayLabel(day)}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <ul className="space-y-2">
              {items.map((e) => <EventItem key={e.id} event={e} contactId={contactId} />)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function EventItem({
  event, contactId,
}: {
  event: ContactTimelineEvent;
  contactId: string;
}) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  const isSystem = event.actor === "Sistema" || !event.actor;

  /* Eventos de email son clickables → llevan SIEMPRE al cliente de
   * email filtrado por este contacto. Nunca a `?tab=emails` (esa pestaña
   * es solo el resumen de stats; los correos se leen en /emails). */
  const isEmailEvent =
    event.type === "email_sent" || event.type === "email_received" ||
    event.type === "email_delivered" || event.type === "email_opened";
  const emailHref = isEmailEvent
    ? `/emails?contact=${encodeURIComponent(contactId)}`
    : null;

  const cardClasses = cn(
    "rounded-xl px-3.5 py-2 border shadow-soft",
    isSystem
      ? "bg-muted/30 border-dashed border-border/60"
      : "bg-card border-border/40",
    emailHref && "hover:border-foreground/30 hover:shadow-soft-lg transition-all",
  );

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {event.title}
        </p>
        <p className="text-[10.5px] text-muted-foreground tnum shrink-0">{timeOnly(event.timestamp)}</p>
      </div>
      {event.description && (
        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
          {event.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-1.5">
        {event.actor && (
          <>
            <ActorAvatar event={event} />
            <p className="text-[10.5px] text-muted-foreground">
              {event.actor}
            </p>
          </>
        )}
        {emailHref && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-foreground font-medium">
            Abrir <ExternalLink className="h-3 w-3" />
          </span>
        )}
      </div>
    </>
  );

  return (
    <li className="relative">
      {/* Burbuja en la línea */}
      <div className="absolute -left-[36px] top-0">
        <div className={cn(
          "ring-4 ring-background rounded-full h-7 w-7 grid place-items-center",
          meta.iconClass,
        )}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>

      {/* Card — link real si es un evento de email. */}
      {emailHref ? (
        <Link to={emailHref} className={cn("block", cardClasses)}>
          {inner}
        </Link>
      ) : (
        <div className={cardClasses}>{inner}</div>
      )}
    </li>
  );
}

function ActorAvatar({ event }: { event: ContactTimelineEvent }) {
  const isSystem = event.actor === "Sistema";
  if (isSystem) {
    return (
      <div className="h-4 w-4 rounded-full bg-foreground text-background grid place-items-center shrink-0">
        <Bot className="h-2.5 w-2.5" />
      </div>
    );
  }
  if (!event.actor) return null;
  const initials = event.actor.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();
  const url = getAvatarUrlByName(event.actor);
  return (
    <div className="h-4 w-4 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-[8px] shrink-0 overflow-hidden">
      <img
        src={url}
        alt={event.actor}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.currentTarget.parentElement as HTMLElement).textContent = initials;
        }}
      />
    </div>
  );
}

function EmptyState({ category }: { category: TimelineCategory }) {
  const labels: Record<TimelineCategory, string> = {
    all: "Aún no hay actividad registrada en este contacto.",
    comments: "Sin comentarios todavía.",
    emails: "Sin emails registrados con este contacto.",
    whatsapp: "Sin mensajes de WhatsApp.",
    web: "Sin actividad web detectada.",
    system: "Sin cambios de sistema registrados.",
  };
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
        <ArrowRight className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin actividad</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
        {labels[category]}
      </p>
    </div>
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
