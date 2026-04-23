/**
 * Tab "Emails" de la ficha de contacto.
 *
 * Vista de RESUMEN de actividad de email con este contacto. NO es un
 * cliente de email — los correos siempre se leen en `/emails`. Aquí
 * solo enseñamos métricas y CTAs.
 *
 * Qué se muestra (spec del producto):
 *   · Banner si hay emails NUEVOS (recibidos no respondidos).
 *   · Counters globales: enviados / recibidos / entregados / abiertos.
 *   · Desglose por usuario que ha enviado emails a este contacto
 *     (avatar + nombre + count).
 *   · CTA "Abrir en Emails →" que lleva a `/emails?contact=:id`.
 *
 * Cualquier click sobre cualquier card → `/emails?contact=:id`.
 * NUNCA mostramos el contenido de un email aquí.
 *
 * Datos: derivados de `loadMergedEvents(detail.id, detail.timeline)`
 * filtrando por categoría "emails". Mismo audit log que el Historial.
 *
 * TODO(backend): GET /api/contacts/:id/email-stats
 *   → { total, sent, received, delivered, opened, byUser[], unreadCount }
 * TODO(ui · /emails): aceptar `?contact=:id` y filtrar la vista a los
 *   correos hacia/desde ese contacto.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Mail, Send, MailCheck, MailOpen, Inbox, ArrowRight, Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrlByName } from "@/lib/team";
import { loadMergedEvents } from "@/components/contacts/contactEventsStorage";
import {
  EVENT_CATEGORY,
  type ContactDetail, type ContactTimelineEvent,
} from "@/components/contacts/types";

export function ContactEmailsTab({ detail }: { detail: ContactDetail }) {
  /* Eventos email del audit log — locales + mock. */
  const emailEvents = useMemo(() => {
    const all = loadMergedEvents(detail.id, detail.timeline);
    return all.filter((e) => EVENT_CATEGORY[e.type] === "emails");
  }, [detail.id, detail.timeline]);

  const stats = useMemo(() => statsFromEvents(emailEvents), [emailEvents]);
  const byUser = useMemo(() => groupSentByUser(emailEvents), [emailEvents]);
  const newCount = useMemo(() => countNew(emailEvents), [emailEvents]);

  const filterHref = `/emails?contact=${encodeURIComponent(detail.id)}`;

  if (emailEvents.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
          <Mail className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Sin actividad de email</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
          Los emails enviados desde el cliente Byvaro a este contacto, y
          los que él te envíe, aparecerán aquí.
        </p>
        <Link
          to="/emails?compose=1&to="
          className="inline-flex items-center gap-1.5 mt-5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
        >
          <Send className="h-3.5 w-3.5" /> Enviar primer email
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Banner: hay emails nuevos */}
      {newCount > 0 && (
        <Link
          to={filterHref}
          className="block rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 sm:p-5 hover:bg-blue-500/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 grid place-items-center text-blue-700 dark:text-blue-400 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {newCount} {newCount === 1 ? "email nuevo" : "emails nuevos"} sin leer
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Ábrelos en el cliente de Emails para responder.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      )}

      {/* Stats globales */}
      <Link
        to={filterHref}
        className="block bg-card border border-border/40 rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Actividad de email
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
            Abrir en Emails <ArrowRight className="h-3 w-3" />
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBlock icon={Send}      label="Enviados"   value={stats.sent}      tone="blue" />
          <StatBlock icon={Inbox}     label="Recibidos"  value={stats.received}  tone="blue" />
          <StatBlock icon={MailCheck} label="Entregados" value={stats.delivered} tone="emerald" />
          <StatBlock icon={MailOpen}  label="Abiertos"   value={stats.opened}    tone="violet" />
        </div>
      </Link>

      {/* Desglose por usuario que envió */}
      {byUser.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Enviados por usuario
          </h3>
          <ul className="space-y-1.5">
            {byUser.map((u) => (
              <li key={u.name}>
                <Link
                  to={filterHref}
                  className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-xl hover:bg-muted/40 transition-colors group"
                >
                  <UserAvatar name={u.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {u.sent} {u.sent === 1 ? "email enviado" : "emails enviados"}
                      {u.lastAt && ` · último ${formatRelative(u.lastAt)}`}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 group-hover:text-foreground transition-colors" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA grande final */}
      <Link
        to={filterHref}
        className="flex items-center justify-center gap-2 h-11 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
      >
        Ver todos los emails con este contacto
        <ArrowRight className="h-4 w-4" />
      </Link>

    </div>
  );
}

/* ══════ Helpers ══════ */

function statsFromEvents(events: ContactTimelineEvent[]) {
  return {
    sent:      events.filter((e) => e.type === "email_sent").length,
    received:  events.filter((e) => e.type === "email_received").length,
    delivered: events.filter((e) => e.type === "email_delivered").length,
    opened:    events.filter((e) => e.type === "email_opened").length,
  };
}

/** Agrupa los `email_sent` por actor (usuario que envió). */
function groupSentByUser(events: ContactTimelineEvent[]) {
  const map = new Map<string, { name: string; sent: number; lastAt: string }>();
  for (const e of events) {
    if (e.type !== "email_sent") continue;
    if (!e.actor || e.actor === "Sistema") continue;
    const cur = map.get(e.actor) ?? { name: e.actor, sent: 0, lastAt: e.timestamp };
    cur.sent += 1;
    if (e.timestamp > cur.lastAt) cur.lastAt = e.timestamp;
    map.set(e.actor, cur);
  }
  return [...map.values()].sort((a, b) => b.sent - a.sent);
}

/** "Nuevos" = email_received en las últimas 48h sin email_sent posterior. */
function countNew(events: ContactTimelineEvent[]): number {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const lastSent = events
    .filter((e) => e.type === "email_sent")
    .reduce((max, e) => Math.max(max, new Date(e.timestamp).getTime()), 0);
  return events.filter((e) => {
    if (e.type !== "email_received") return false;
    const t = new Date(e.timestamp).getTime();
    return t > cutoff && t > lastSent;
  }).length;
}

/* ══════ Sub-componentes ══════ */

function StatBlock({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  tone: "blue" | "emerald" | "violet";
}) {
  const cls =
    tone === "blue"    ? "text-blue-700 dark:text-blue-400 bg-blue-500/10" :
    tone === "emerald" ? "text-success dark:text-success bg-success/10" :
                         "text-violet-700 dark:text-violet-400 bg-violet-500/10";
  return (
    <div className="rounded-xl border border-border/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", cls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-2xl font-semibold tnum text-foreground">{value}</p>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";
  const url = getAvatarUrlByName(name);
  return (
    <div className="h-9 w-9 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-xs shrink-0 overflow-hidden">
      <img
        src={url}
        alt={name}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.currentTarget.parentElement as HTMLElement).textContent = initials;
        }}
      />
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} días`;
    if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
    return `hace ${Math.floor(days / 30)} meses`;
  } catch { return iso; }
}
