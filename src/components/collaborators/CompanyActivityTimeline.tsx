/**
 * CompanyActivityTimeline · historial cross-empresa entre el
 * promotor y una agencia colaboradora.
 *
 * REGLA DE ORO (ver CLAUDE.md §"Historial entre empresas"):
 *   - SOLO admin del promotor.
 *   - La página declara explícitamente la restricción al usuario
 *     ("solo visible para administradores"). No se oculta en
 *     silencio: se menciona.
 *   - La agencia colaboradora NUNCA ve este timeline, ni siquiera
 *     sobre sí misma — contiene decisiones internas del promotor.
 *
 * TODO(backend): GET /api/agencies/:id/events · paginado server-side
 * con RLS + JWT claim role=admin.
 */

import { useMemo } from "react";
import {
  Handshake, MailPlus, CheckCircle2, XCircle, Clock, PauseCircle, PlayCircle,
  FileText, FileSignature, Home, CalendarCheck, AlertTriangle, Sparkles, Bot,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCompanyEvents, useCanViewCompanyHistory,
  type CompanyEvent, type CompanyEventType,
} from "@/lib/companyEvents";

const iconByType: Record<CompanyEventType, LucideIcon> = {
  invitation_sent:        MailPlus,
  invitation_accepted:    CheckCircle2,
  invitation_rejected:    XCircle,
  invitation_cancelled:   XCircle,
  invitation_expired:     Clock,
  request_received:       MailPlus,
  request_approved:       CheckCircle2,
  request_rejected:       XCircle,
  collaboration_paused:   PauseCircle,
  collaboration_resumed:  PlayCircle,
  collaboration_ended:    XCircle,
  registration_created:   FileText,
  registration_approved:  CheckCircle2,
  registration_rejected:  XCircle,
  registration_expired:   Clock,
  visit_scheduled:        CalendarCheck,
  visit_completed:        CheckCircle2,
  visit_cancelled:        XCircle,
  offer_sent:             FileText,
  offer_rejected:         XCircle,
  sale_reserved:          Home,
  sale_contracted:        FileSignature,
  sale_completed:         CheckCircle2,
  sale_cancelled:         XCircle,
  contract_sent:          FileSignature,
  contract_signed:        CheckCircle2,
  incident_duplicate:     AlertTriangle,
  incident_cancellation:  AlertTriangle,
  incident_claim:         AlertTriangle,
  custom:                 Sparkles,
};

const toneByType: Record<CompanyEventType, "success" | "destructive" | "warning" | "muted" | "primary"> = {
  invitation_sent:        "primary",
  invitation_accepted:    "success",
  invitation_rejected:    "destructive",
  invitation_cancelled:   "muted",
  invitation_expired:     "muted",
  request_received:       "primary",
  request_approved:       "success",
  request_rejected:       "destructive",
  collaboration_paused:   "warning",
  collaboration_resumed:  "success",
  collaboration_ended:    "destructive",
  registration_created:   "primary",
  registration_approved:  "success",
  registration_rejected:  "destructive",
  registration_expired:   "muted",
  visit_scheduled:        "primary",
  visit_completed:        "success",
  visit_cancelled:        "destructive",
  offer_sent:             "primary",
  offer_rejected:         "destructive",
  sale_reserved:          "primary",
  sale_contracted:        "primary",
  sale_completed:         "success",
  sale_cancelled:         "destructive",
  contract_sent:          "primary",
  contract_signed:        "success",
  incident_duplicate:     "warning",
  incident_cancellation:  "warning",
  incident_claim:         "warning",
  custom:                 "muted",
};

const toneClass = {
  success:     "bg-success/10 text-success border-success/30",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  warning:     "bg-warning/10 text-warning border-warning/30",
  muted:       "bg-muted text-muted-foreground border-border",
  primary:     "bg-primary/10 text-primary border-primary/30",
} as const;

function formatHappenedAt(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function CompanyActivityTimeline({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const canView = useCanViewCompanyHistory();
  const events = useCompanyEvents(agencyId);

  const grouped = useMemo(() => events, [events]);

  /* Guard defensivo · aunque el tab esté oculto, si alguien logra
   * renderizar el componente sin permisos no mostramos contenido. */
  if (!canView) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center">
        <Handshake className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-foreground">Contenido confidencial</p>
        <p className="text-xs text-muted-foreground mt-1">
          Solo los administradores del promotor pueden ver el historial de esta agencia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner explícito · la regla de oro dice que no se oculta en
          silencio, se declara en la UI para transparencia interna. */}
      <div className="rounded-2xl border border-warning/25 bg-warning/5 px-4 py-3 flex items-start gap-3">
        <Bot className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Historial confidencial · solo administradores</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Este timeline contiene toda la actividad comercial entre tu empresa y {agencyName}
            (invitaciones, registros, visitas, contratos, ventas). Los agentes de tu equipo y la
            propia agencia NO pueden verlo. Tampoco se comparte fuera de Byvaro.
          </p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">Sin eventos registrados aún</p>
          <p className="text-xs text-muted-foreground">
            En cuanto haya una invitación, registro, visita o contrato con {agencyName} aparecerá aquí.
          </p>
        </div>
      ) : (
        <ol className="space-y-0 relative">
          {grouped.map((e, i) => (
            <TimelineRow key={e.id} event={e} isFirst={i === 0} isLast={i === grouped.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({ event: e, isLast }: { event: CompanyEvent; isFirst: boolean; isLast: boolean }) {
  const Icon = iconByType[e.type] ?? Sparkles;
  const tone = toneByType[e.type] ?? "muted";
  const actor = e.by?.name ?? "Sistema";
  const isBot = !!e.by?.system || actor === "Sistema";

  return (
    <li className="relative flex gap-4 pb-5">
      {/* Rail vertical */}
      {!isLast && (
        <span className="absolute left-[19px] top-10 bottom-0 w-px bg-border" aria-hidden />
      )}
      {/* Nodo */}
      <span className={cn(
        "relative z-10 h-10 w-10 rounded-full grid place-items-center border shrink-0",
        toneClass[tone],
      )}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      {/* Contenido */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-foreground leading-tight">{e.title}</p>
          <time className="text-[11px] text-muted-foreground tabular-nums shrink-0" dateTime={e.happenedAt}>
            {formatHappenedAt(e.happenedAt)}
          </time>
        </div>
        {e.description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{e.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
          <span className={cn(
            "inline-flex items-center gap-1",
            isBot && "italic opacity-80",
          )}>
            {isBot ? <Bot className="h-3 w-3" strokeWidth={1.75} /> : null}
            {actor}
            {e.by?.email && !isBot ? ` · ${e.by.email}` : null}
          </span>
          {e.related?.promotionName && (
            <>
              <span className="text-border">·</span>
              <span>Promo: {e.related.promotionName}</span>
            </>
          )}
          {e.related?.clientName && (
            <>
              <span className="text-border">·</span>
              <span>Cliente: {e.related.clientName}</span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
