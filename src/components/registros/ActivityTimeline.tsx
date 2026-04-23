/**
 * ActivityTimeline — cronología vertical del ciclo de vida del registro.
 *
 * Muestra cada `RegistroTimelineEvent` en orden cronológico ascendente
 * (más antiguo arriba) con burbuja de icono + título + actor + tiempo.
 * Eventos `active` llevan un pulse y muestran `waitingDuration`.
 *
 * Generador automático: si el `Registro` no trae timeline, lo
 * sintetizamos desde sus campos (`fecha`, `estado`, `decidedAt`,
 * `responseTime`…) para que la sección no quede vacía nunca.
 */

import {
  Inbox, Cpu, CheckCircle2, XCircle, MessageCircle, Bell, Send,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Registro, RegistroTimelineEvent } from "@/data/records";

const EVENT_META: Record<RegistroTimelineEvent["type"], {
  icon: typeof Inbox;
  defaultTitle: string;
}> = {
  submitted:         { icon: Inbox,         defaultTitle: "Solicitud recibida" },
  auto_check:        { icon: Cpu,           defaultTitle: "Análisis IA de duplicados" },
  decision:          { icon: CheckCircle2,  defaultTitle: "Decisión del promotor" },
  notification:      { icon: Bell,          defaultTitle: "Notificación a la agencia" },
  sent_to_developer: { icon: Send,          defaultTitle: "Cliente registrado" },
};

export function ActivityTimeline({ record }: { record: Registro }) {
  const events = record.timeline ?? synthesizeTimeline(record);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Actividad
      </p>
      <ol className="relative pl-7 space-y-3">
        {/* Línea vertical */}
        <div className="absolute left-[12px] top-2 bottom-2 w-px bg-border/60" aria-hidden />

        {events.map((e) => <Event key={e.id} event={e} />)}
      </ol>
    </div>
  );
}

function Event({ event }: { event: RegistroTimelineEvent }) {
  const meta = EVENT_META[event.type];
  /* Si la decisión fue rechazo, sustituye el icono check por X. */
  const Icon = event.type === "decision" && event.decisionType === "declined"
    ? XCircle
    : event.type === "decision" && event.decisionType === "info_requested"
      ? MessageCircle
      : meta.icon;

  const tone =
    event.status === "active"  ? "primary" :
    event.status === "pending" ? "muted" :
    event.type === "decision" && event.decisionType === "declined" ? "destructive" :
    event.type === "decision" && event.decisionType === "approved" ? "emerald" :
    event.type === "submitted" ? "primary" :
    "default";

  return (
    <li className="relative">
      {/* Burbuja */}
      <span
        className={cn(
          "absolute -left-7 top-0.5 h-6 w-6 rounded-full ring-2 ring-background grid place-items-center",
          tone === "primary"     && "bg-primary/15 text-primary",
          tone === "emerald"     && "bg-success/15 text-success dark:text-success",
          tone === "destructive" && "bg-destructive/15 text-destructive",
          tone === "muted"       && "bg-muted text-muted-foreground/60",
          tone === "default"     && "bg-muted text-foreground",
        )}
      >
        {event.status === "pending" ? (
          <Circle className="h-2.5 w-2.5" />
        ) : (
          <Icon className="h-3 w-3" strokeWidth={2.5} />
        )}
        {event.status === "active" && (
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping" aria-hidden />
        )}
      </span>

      {/* Card */}
      <div className={cn(
        "rounded-xl px-3 py-2 border",
        event.status === "active" ? "border-primary/30 bg-primary/[0.03]" :
        event.status === "pending" ? "border-dashed border-border/60 bg-transparent" :
                                     "border-border/40 bg-card",
      )}>
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-xs font-semibold leading-tight",
            event.status === "pending" ? "text-muted-foreground" : "text-foreground",
          )}>
            {event.title}
          </p>
          <p className="text-[10px] text-muted-foreground tnum shrink-0">
            {event.status === "active" && event.waitingDuration
              ? `Esperando · ${event.waitingDuration}`
              : event.status === "completed"
                ? formatRelative(event.timestamp)
                : ""}
          </p>
        </div>
        {event.description && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {event.description}
          </p>
        )}
        {(event.actor || event.responseTime) && event.status === "completed" && (
          <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            {event.actor && (
              <>
                <span className="font-medium text-foreground">{event.actor}</span>
                {event.actorRole && <span className="text-muted-foreground/70">· {event.actorRole}</span>}
              </>
            )}
            {event.responseTime && (
              <>
                {event.actor && <span className="text-muted-foreground/30">·</span>}
                <span>respondió en {event.responseTime}</span>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

/** Sintetiza eventos a partir de los campos del Registro. */
function synthesizeTimeline(r: Registro): RegistroTimelineEvent[] {
  const out: RegistroTimelineEvent[] = [];

  /* Para directos el evento de alta lo dispara el promotor, no el sistema
   * ni una agencia entrante. Cambia copy, icono sigue siendo `Inbox`. */
  if (r.origen === "direct") {
    out.push({
      id: "ev-submitted",
      type: "submitted",
      title: "Registro creado por el promotor",
      description: `Alta directa de ${r.cliente.nombre}`,
      timestamp: r.fecha,
      status: "completed",
      actor: r.decidedBy ?? "Promotor",
    });
  } else {
    out.push({
      id: "ev-submitted",
      type: "submitted",
      title: "Solicitud recibida",
      description: `Enviada por ${r.cliente.nombre}`,
      timestamp: r.fecha,
      status: "completed",
      actor: "Sistema",
    });
  }

  out.push({
    id: "ev-auto-check",
    type: "auto_check",
    title: "Análisis IA de duplicados",
    description: r.matchPercentage > 0
      ? `Match ${r.matchPercentage}% con un cliente existente.`
      : "Sin coincidencias detectadas.",
    timestamp: r.fecha,
    status: "completed",
    actor: "Sistema",
  });

  if (r.estado === "aprobado" || r.estado === "rechazado") {
    out.push({
      id: "ev-decision",
      type: "decision",
      title: r.estado === "aprobado" ? "Aprobado por el promotor" : "Rechazado por el promotor",
      description: r.decisionNote,
      timestamp: r.decidedAt ?? r.fecha,
      status: "completed",
      actor: r.decidedBy,
      actorRole: r.decidedByRole,
      decisionType: r.estado === "aprobado" ? "approved" : "declined",
      responseTime: r.responseTime,
    });
    out.push({
      id: "ev-notif",
      type: "notification",
      title: r.estado === "aprobado"
        ? "Agencia notificada · cliente apartado"
        : "Agencia notificada · solicitud rechazada",
      timestamp: r.decidedAt ?? r.fecha,
      status: "completed",
      actor: "Sistema",
    });
  } else if (r.estado === "pendiente") {
    out.push({
      id: "ev-decision-pending",
      type: "decision",
      title: "Esperando decisión del promotor",
      timestamp: r.fecha,
      status: "active",
      waitingDuration: relativeWaiting(r.fecha),
    });
    out.push({
      id: "ev-notif-pending",
      type: "notification",
      title: "Notificación a la agencia",
      timestamp: r.fecha,
      status: "pending",
    });
  } else if (r.estado === "duplicado") {
    out.push({
      id: "ev-decision-dup",
      type: "decision",
      title: "Marcado como duplicado",
      timestamp: r.fecha,
      status: "completed",
      decisionType: "declined",
      actor: "Sistema",
    });
  }

  return out;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`;
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch { return iso; }
}

function relativeWaiting(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}min`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "día" : "días"}`;
  } catch { return ""; }
}
