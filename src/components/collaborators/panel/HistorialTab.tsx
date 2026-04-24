/**
 * Tab "Historial" del panel de colaboración.
 *
 * Timeline cross-empresa entre el promotor y la agencia: invitaciones,
 * registros, visitas, contratos, ventas, incidencias. Es la misma
 * información que la página stand-alone `/colaboradores/:id/historial`
 * (`ColaboradorHistorial.tsx`), pero integrada dentro del panel.
 *
 * REGLA DE ORO · ver CLAUDE.md §"Historial entre empresas":
 *   - Solo admin del promotor puede verlo.
 *   - Arriba se declara "Confidencial · solo admin".
 */

import { useMemo } from "react";
import {
  Bot, Handshake, MailPlus, CheckCircle2, XCircle, Clock,
  PauseCircle, PlayCircle, FileText, FileSignature, Home, CalendarCheck,
  AlertTriangle, Sparkles, Shield, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import {
  useCompanyEvents, useCanViewCompanyHistory,
  type CompanyEvent, type CompanyEventType,
} from "@/lib/companyEvents";
import { getAvatarUrlByName } from "@/lib/team";

const EVENT_META: Record<CompanyEventType, { icon: LucideIcon; iconClass: string }> = {
  invitation_sent:        { icon: MailPlus,       iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  invitation_accepted:    { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  invitation_rejected:    { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  invitation_cancelled:   { icon: XCircle,        iconClass: "bg-muted text-muted-foreground" },
  invitation_expired:     { icon: Clock,          iconClass: "bg-muted text-muted-foreground" },
  request_received:       { icon: MailPlus,       iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  request_approved:       { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  request_rejected:       { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  collaboration_paused:   { icon: PauseCircle,    iconClass: "bg-warning/15 text-warning dark:text-warning" },
  collaboration_resumed:  { icon: PlayCircle,     iconClass: "bg-success/15 text-success dark:text-success" },
  collaboration_ended:    { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  registration_created:   { icon: FileText,       iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  registration_approved:  { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  registration_rejected:  { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  registration_expired:   { icon: Clock,          iconClass: "bg-muted text-muted-foreground" },
  visit_scheduled:        { icon: CalendarCheck,  iconClass: "bg-warning/15 text-warning dark:text-warning" },
  visit_completed:        { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  visit_cancelled:        { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  offer_sent:             { icon: FileText,       iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  offer_rejected:         { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  sale_reserved:          { icon: Home,           iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  sale_contracted:        { icon: FileSignature,  iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  sale_completed:         { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  sale_cancelled:         { icon: XCircle,        iconClass: "bg-destructive/15 text-destructive" },
  contract_sent:          { icon: FileSignature,  iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  contract_signed:        { icon: CheckCircle2,   iconClass: "bg-success/15 text-success dark:text-success" },
  incident_duplicate:     { icon: AlertTriangle,  iconClass: "bg-warning/15 text-warning dark:text-warning" },
  incident_cancellation:  { icon: AlertTriangle,  iconClass: "bg-warning/15 text-warning dark:text-warning" },
  incident_claim:         { icon: AlertTriangle,  iconClass: "bg-warning/15 text-warning dark:text-warning" },
  custom:                 { icon: Sparkles,       iconClass: "bg-muted text-muted-foreground" },
};

function dayLabel(day: string): string {
  const d = new Date(day);
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (day === iso(today)) return "Hoy";
  if (day === iso(yest)) return "Ayer";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function timeOnly(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

interface Props {
  agency: Agency;
}

export function HistorialTab({ agency: a }: Props) {
  const canView = useCanViewCompanyHistory();
  const events = useCompanyEvents(a.id);

  const groups = useMemo(() => {
    const map = new Map<string, CompanyEvent[]>();
    for (const e of events) {
      const day = e.happenedAt.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
        <Shield className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-foreground">Sin acceso</p>
        <p className="text-xs text-muted-foreground mt-1">
          Solo los administradores de tu empresa pueden ver este historial.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner confidencial */}
      <div className="rounded-2xl border border-warning/25 bg-warning/5 px-4 py-3 flex items-start gap-3">
        <Shield className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Confidencial · solo administradores</p>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Invitaciones, registros, visitas, contratos y ventas entre tu empresa y {a.name}.
            Los agentes del equipo y la propia agencia NO ven este historial.
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground mb-1">Sin eventos registrados aún</p>
          <p className="text-xs text-muted-foreground">
            En cuanto haya una invitación, registro, visita o contrato con {a.name} aparecerá aquí.
          </p>
        </div>
      ) : (
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
                  {items.map((e) => <EventItem key={e.id} event={e} />)}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventItem({ event: e }: { event: CompanyEvent }) {
  const meta = EVENT_META[e.type] ?? EVENT_META.custom;
  const Icon = meta.icon;
  const isSystem = !!e.by?.system || e.by?.name === "Sistema" || !e.by;

  return (
    <li className="relative">
      <div className="absolute -left-[36px] top-0">
        <div className={cn(
          "ring-4 ring-background rounded-full h-7 w-7 grid place-items-center",
          meta.iconClass,
        )}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>

      <div className={cn(
        "rounded-xl px-3.5 py-2 border shadow-soft",
        isSystem ? "bg-muted/30 border-dashed border-border/60" : "bg-card border-border/40",
      )}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{e.title}</p>
          <p className="text-[10.5px] text-muted-foreground tnum shrink-0">{timeOnly(e.happenedAt)}</p>
        </div>
        {e.description && (
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{e.description}</p>
        )}
        {(e.related?.promotionName || e.related?.clientName) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-muted-foreground">
            {e.related?.promotionName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                <Handshake className="h-2.5 w-2.5" />
                {e.related.promotionName}
              </span>
            )}
            {e.related?.clientName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
                {e.related.clientName}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <ActorAvatar actor={e.by?.name} isSystem={isSystem} />
          <p className="text-[10.5px] text-muted-foreground">
            {e.by?.name ?? "Sistema"}
            {e.by?.email && !isSystem ? ` · ${e.by.email}` : ""}
          </p>
        </div>
      </div>
    </li>
  );
}

function ActorAvatar({ actor, isSystem }: { actor?: string; isSystem: boolean }) {
  if (isSystem) {
    return (
      <div className="h-4 w-4 rounded-full bg-foreground text-background grid place-items-center shrink-0">
        <Bot className="h-2.5 w-2.5" />
      </div>
    );
  }
  if (!actor) return null;
  const initials = actor.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();
  const url = getAvatarUrlByName(actor);
  return (
    <div className="h-4 w-4 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-[8px] shrink-0 overflow-hidden">
      <img
        src={url}
        alt={actor}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.currentTarget.parentElement as HTMLElement).textContent = initials;
        }}
      />
    </div>
  );
}
