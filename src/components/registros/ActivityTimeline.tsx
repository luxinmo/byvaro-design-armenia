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
import { findTeamMember, getMemberAvatarUrl } from "@/lib/team";
import { agencies } from "@/data/agencies";

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

export function ActivityTimeline({
  record,
  viewerIsAgency = false,
}: {
  record: Registro;
  /** Filtrado server-style · cuando el viewer es agencia, ocultamos
   *  eventos internos del workspace del promotor (análisis IA,
   *  notificación pendiente al propio agency, etc). Privacy
   *  cross-tenant. */
  viewerIsAgency?: boolean;
}) {
  // Orden inverso · el evento más reciente arriba (patrón feed tipo
  // notificaciones · el usuario espera ver lo nuevo primero).
  const raw = record.timeline ?? synthesizeTimeline(record);
  /* Adapta el timeline para la vista de agencia (envío en lugar de
   *  recepción + neutraliza referencias a "el promotor" porque puede
   *  ser una comercializadora u owner). Filtra eventos internos del
   *  workspace anfitrión (análisis IA, notificación pending). */
  const events = [...(viewerIsAgency ? buildAgencyTimeline(raw) : raw)].reverse();

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Actividad
      </p>
      <ol className="relative pl-7 space-y-3">
        {/* Línea vertical */}
        <div className="absolute left-[12px] top-2 bottom-2 w-px bg-border/60" aria-hidden />

        {events.map((e) => <Event key={e.id} event={e} record={record} />)}
      </ol>
    </div>
  );
}

/** Resuelve el avatar del actor del evento · usa datos reales cuando
 *  los hay (audit.actor · decidedByUserId → TEAM_MEMBERS · contacto
 *  principal de la agencia) y cae a pravatar determinista en el resto.
 *  Devuelve null para eventos del sistema (se pinta un bot). */
function resolveActorAvatar(event: RegistroTimelineEvent, record: Registro): string | null {
  // Sistema → sin foto (se pinta icono bot)
  if (event.actor === "Sistema") return null;
  // Submitted · colaborador · email real del audit si existe, sino el
  // del contacto principal de la agencia (seed).
  if (event.type === "submitted") {
    if (record.audit?.actor.email) {
      return `https://i.pravatar.cc/150?u=${encodeURIComponent(record.audit.actor.email)}`;
    }
    if (record.origen === "collaborator" && record.agencyId) {
      const ag = agencies.find((a) => a.id === record.agencyId);
      if (ag?.contactoPrincipal?.email) {
        return `https://i.pravatar.cc/150?u=${encodeURIComponent(ag.contactoPrincipal.email)}`;
      }
    }
  }
  // Decision · miembro del equipo del promotor.
  if (event.type === "decision" && record.decidedByUserId) {
    const m = findTeamMember(record.decidedByUserId);
    if (m) return getMemberAvatarUrl(m);
  }
  // Fallback · pravatar determinista por nombre (si hay actor).
  if (event.actor) return `https://i.pravatar.cc/150?u=${encodeURIComponent(event.actor)}`;
  return null;
}

function Event({ event, record }: { event: RegistroTimelineEvent; record: Registro }) {
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

      {/* Card · contenido a la izquierda · actor (foto + nombre) a la derecha */}
      <div className={cn(
        "rounded-xl px-3 py-2 border flex items-start gap-3",
        event.status === "active" ? "border-primary/30 bg-primary/[0.03]" :
        event.status === "pending" ? "border-dashed border-border/60 bg-transparent" :
                                     "border-border/40 bg-card",
      )}>
        {/* Izquierda · título + descripción + tiempo */}
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-xs font-semibold leading-tight",
            event.status === "pending" ? "text-muted-foreground" : "text-foreground",
          )}>
            {event.title}
          </p>
          {event.description && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {event.description}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground tnum mt-1">
            {event.status === "active" && event.waitingDuration
              ? `Esperando · ${event.waitingDuration}`
              : event.status === "completed"
                ? formatRelative(event.timestamp)
                : event.status === "pending"
                  ? "Pendiente"
                  : ""}
            {event.responseTime && <span> · respondió en {event.responseTime}</span>}
          </p>
        </div>

        {/* Derecha · actor (foto + nombre) si hay · bot si es Sistema */}
        {event.actor && event.status !== "pending" && (
          <div className="shrink-0 flex flex-col items-end text-right min-w-0 max-w-[110px]">
            <ActorAvatar event={event} record={record} />
            <p className="text-[10px] font-medium text-foreground truncate mt-1 max-w-full">
              {event.actor}
            </p>
            {event.actorRole && (
              <p className="text-[9.5px] text-muted-foreground truncate max-w-full">
                {event.actorRole}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function ActorAvatar({ event, record }: { event: RegistroTimelineEvent; record: Registro }) {
  const url = resolveActorAvatar(event, record);
  if (event.actor === "Sistema" || !url) {
    return (
      <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] font-bold text-muted-foreground">
        {event.actor === "Sistema" ? <Cpu className="h-3.5 w-3.5" /> : "?"}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-7 w-7 rounded-full object-cover bg-muted"
    />
  );
}

/**
 * Adapta un timeline genérico al punto de vista de la agencia que
 * envió el registro:
 *
 *   · Filtra `auto_check` (análisis IA · interno del workspace destino).
 *   · Filtra `notification` (backflow interno · la agencia ES la
 *     destinataria de las notifs decididas, redundante con el evento
 *     de decisión).
 *   · Reescribe "Solicitud recibida" → "Solicitud enviada" desde el
 *     punto de vista de la agencia.
 *   · Inserta evento sintético "Entregada al destinatario" 30s después
 *     de la creación · confirmación de recepción al lado opuesto.
 *     TODO(backend): cuando exista el evento real de delivery
 *     (webhook + ack del owningParty), reemplazar con el timestamp real.
 *   · Neutraliza "del promotor" en títulos · usa "destinatario" porque
 *     en Phase 2 el lado opuesto puede ser owner o comercializadora.
 */
function buildAgencyTimeline(raw: RegistroTimelineEvent[]): RegistroTimelineEvent[] {
  const out: RegistroTimelineEvent[] = [];
  for (const e of raw) {
    if (e.type === "auto_check") continue;
    if (e.type === "notification") continue;

    if (e.type === "submitted") {
      out.push({ ...e, title: "Solicitud enviada" });
      /* Sintético · entrega al destinatario · timestamp = +30s.
         Mock hasta que el backend emita el evento real de delivery. */
      const deliveredAt = new Date(
        new Date(e.timestamp).getTime() + 30 * 1000,
      ).toISOString();
      out.push({
        id: "ev-delivered-to-owner",
        type: "sent_to_developer",
        title: "Entregada al destinatario",
        timestamp: deliveredAt,
        status: "completed",
        actor: "Sistema",
      });
      continue;
    }

    if (e.type === "decision") {
      let title = e.title;
      /* "Esperando decisión del promotor" → "Esperando decisión".
         "Aprobado/Rechazado por el promotor" → "Aprobado/Rechazado". */
      title = title.replace(/\s+del\s+promotor/i, "");
      title = title.replace(/\s+por\s+el\s+promotor/i, "");
      out.push({ ...e, title });
      continue;
    }

    out.push(e);
  }
  return out;
}

/** Sintetiza eventos a partir de los campos del Registro. */
function synthesizeTimeline(r: Registro): RegistroTimelineEvent[] {
  const out: RegistroTimelineEvent[] = [];

  /* Para directos el evento de alta lo dispara el promotor, no el sistema. */
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
    /* Colaborador · el actor es un HUMANO de la agencia · preferir
     * `audit.actor` (huella real capturada al enviar) · fallback al
     * contacto principal de la agencia · fallback final al nombre de
     * la agencia. Nunca "Sistema" · el sistema solo enruta. */
    const agency = r.agencyId ? agencies.find((a) => a.id === r.agencyId) : undefined;
    const senderName =
      r.audit?.actor.name
      ?? agency?.contactoPrincipal?.nombre
      ?? agency?.name
      ?? "Agente colaborador";
    const senderRole =
      agency?.contactoPrincipal?.rol
      ?? (agency?.name ? `Agente · ${agency.name}` : "Agente colaborador");
    out.push({
      id: "ev-submitted",
      type: "submitted",
      title: "Solicitud recibida",
      description: agency
        ? `Enviada desde ${agency.name}`
        : undefined,
      timestamp: r.fecha,
      status: "completed",
      actor: senderName,
      actorRole: senderRole,
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
    /* Resolver el nombre/cargo a partir del userId (fuente única) · si
     * no existe el id, caemos al snapshot legacy en `decidedBy`. */
    const decidedMember = r.decidedByUserId
      ? findTeamMember(r.decidedByUserId)
      : undefined;
    out.push({
      id: "ev-decision",
      type: "decision",
      title: r.estado === "aprobado" ? "Aprobado por el promotor" : "Rechazado por el promotor",
      description: r.decisionNote,
      timestamp: r.decidedAt ?? r.fecha,
      status: "completed",
      actor: decidedMember?.name ?? r.decidedBy,
      actorRole: decidedMember?.jobTitle ?? r.decidedByRole,
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
