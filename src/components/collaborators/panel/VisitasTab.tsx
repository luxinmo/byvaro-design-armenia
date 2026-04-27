/**
 * Tab "Visitas" del panel de colaboración.
 *
 * Lista de visitas que clientes de esta agencia han tenido o tienen
 * programadas sobre tus promociones. Mock determinista por agencia ·
 * backend: `GET /api/agencias/:id/visits?status=scheduled|completed|cancelled`.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, Star, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";

interface Props {
  agency: Agency;
  /** Si está set, filtra las visitas a las del agente con este id /
   *  nombre. Lo usa el panel del lado AGENCIA cuando un member abre
   *  el panel del promotor · ve solo sus propias visitas. Admin pasa
   *  undefined y ve todas las del equipo.
   *  Mock: matchea contra el nombre del agente porque la seed actual
   *  usa nombre, no id. TODO(backend): cuando exista API real,
   *  filtrar server-side por `WHERE agent_id = :restrictToUserId`. */
  restrictToUserId?: string;
}

interface MockVisit {
  id: string;
  when: number;
  client: string;
  promoId: string;
  promoName: string;
  unit: string;
  status: "programada" | "realizada" | "cancelada";
  outcome?: "interesado" | "ofrece" | "no-interesa";
  rating?: number;
  agent?: string;
}

export function VisitasTab({ agency: a, restrictToUserId }: Props) {
  const currentUserName = useCurrentUser().name;
  const visits: MockVisit[] = useMemo(() => {
    const now = Date.now();
    const base: Record<string, MockVisit[]> = {
      "ag-1": [
        { id: "v1", when: now + 2 * 86400e3,  client: "María García",   promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 12-B", status: "programada", agent: "Laura Sánchez" },
        { id: "v2", when: now + 5 * 86400e3,  client: "Pedro Sánchez",  promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 04-2",  status: "programada", agent: "Diego Romero" },
        { id: "v3", when: now + 8 * 86400e3,  client: "Isabel Ruiz",    promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 08-C", status: "programada", agent: "Laura Sánchez" },
        { id: "v4", when: now - 4 * 86400e3,  client: "Carlos Ortega",  promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 02-A", status: "realizada", outcome: "ofrece",     rating: 5, agent: "Laura Sánchez" },
        { id: "v5", when: now - 9 * 86400e3,  client: "Lucía Romero",   promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 06-1",  status: "realizada", outcome: "interesado", rating: 4, agent: "Diego Romero" },
        { id: "v6", when: now - 12 * 86400e3, client: "Nadia Ibáñez",   promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 05-B", status: "cancelada", agent: "Laura Sánchez" },
        { id: "v7", when: now - 20 * 86400e3, client: "Javier Peña",    promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 02-3",  status: "realizada", outcome: "no-interesa", rating: 2, agent: "Diego Romero" },
      ],
      "ag-2": [
        { id: "v1", when: now + 3 * 86400e3,  client: "Erik Lindqvist", promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 14-A", status: "programada", agent: "Sofia Bergman" },
        { id: "v2", when: now - 6 * 86400e3,  client: "Lars Nilsson",   promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 03-C", status: "realizada", outcome: "ofrece",     rating: 5, agent: "Sofia Bergman" },
        { id: "v3", when: now - 14 * 86400e3, client: "Astrid Olsen",   promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 07-2",  status: "realizada", outcome: "interesado", rating: 4, agent: "Erik Lindqvist" },
      ],
    };
    const all = (base[a.id] ?? []);
    /* Filtrado por agente · si `restrictToUserId` está set, solo
     *  vemos visitas asignadas a ese user. Mock: matcheamos por
     *  nombre porque la seed usa nombres. Backend usará agent_id. */
    const filtered = restrictToUserId
      ? all.filter((v) => v.agent === currentUserName)
      : all;
    return filtered.sort((x, y) => {
      const xFuture = x.when > Date.now(); const yFuture = y.when > Date.now();
      if (xFuture && !yFuture) return -1;
      if (!xFuture && yFuture) return 1;
      return xFuture ? x.when - y.when : y.when - x.when;
    });
  }, [a.id, restrictToUserId, currentUserName]);

  const kpi = useMemo(() => {
    const now = Date.now();
    return {
      programadas: visits.filter((v) => v.status === "programada" && v.when >= now).length,
      realizadas:  visits.filter((v) => v.status === "realizada").length,
      canceladas:  visits.filter((v) => v.status === "cancelada").length,
    };
  }, [visits]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="Programadas" value={kpi.programadas} icon={Calendar}     tone={kpi.programadas > 0 ? "primary" : "muted"} />
        <KpiTile label="Realizadas"  value={kpi.realizadas}  icon={CheckCircle2} tone="success" />
        <KpiTile label="Canceladas"  value={kpi.canceladas}  icon={XCircle}      tone={kpi.canceladas > 0 ? "destructive" : "muted"} />
      </div>

      {visits.length === 0 ? (
        <EmptyState icon={Calendar} title="Sin visitas todavía" body="Cuando esta agencia programe o realice una visita aparecerá aquí." />
      ) : (
        <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
          {visits.map((v) => <VisitRow key={v.id} visit={v} />)}
        </ul>
      )}
    </div>
  );
}

function KpiTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "primary" | "success" | "destructive" | "muted";
}) {
  const iconCls = {
    primary:     "bg-primary/10 text-primary",
    success:     "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    muted:       "bg-muted text-muted-foreground",
  }[tone];
  const valueCls = {
    primary:     "text-primary",
    success:     "text-success",
    destructive: "text-destructive",
    muted:       "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-7 w-7 rounded-lg grid place-items-center shrink-0", iconCls)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <p className={cn("text-[22px] font-bold tabular-nums leading-none mt-2", valueCls)}>
        {value}
      </p>
    </div>
  );
}

function VisitRow({ visit: v }: { visit: MockVisit }) {
  const d = new Date(v.when);
  const dd = d.getDate();
  const mm = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const isFuture = v.when > Date.now();
  const statusMeta = {
    programada: isFuture
      ? { label: time, cls: "border-primary/25 bg-primary/10 text-primary", icon: Clock }
      : { label: "Sin evaluar", cls: "border-warning/30 bg-warning/10 text-warning", icon: AlertTriangle },
    realizada:  { label: "Realizada", cls: "border-success/25 bg-success/10 text-success", icon: CheckCircle2 },
    cancelada:  { label: "Cancelada", cls: "border-destructive/25 bg-destructive/10 text-destructive", icon: XCircle },
  }[v.status];
  const StatusIcon = statusMeta.icon;
  const outcomeLabel = v.outcome ? {
    interesado: "Interesado",
    ofrece:     "Hizo oferta",
    "no-interesa": "No interesa",
  }[v.outcome] : null;

  return (
    <li>
      <Link
        to={`/calendario?id=${v.id}`}
        className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <div className="shrink-0 h-11 w-11 rounded-lg bg-muted/60 grid place-items-center">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{mm}</p>
            <p className="text-sm font-bold text-foreground leading-none tabular-nums mt-0.5">{dd}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{v.client}</p>
            {outcomeLabel && (
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
                {outcomeLabel}
              </span>
            )}
            {typeof v.rating === "number" && v.rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10.5px] text-foreground tabular-nums">
                <Star className="h-2.5 w-2.5 fill-foreground" strokeWidth={0} />
                {v.rating}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
            {v.promoName}
            {" · "}{v.unit}
            {v.agent ? ` · ${v.agent}` : ""}
          </p>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-medium shrink-0",
          statusMeta.cls,
        )}>
          <StatusIcon className="h-2.5 w-2.5" strokeWidth={2} />
          {statusMeta.label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
      </Link>
    </li>
  );
}

function EmptyState({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[320px] mx-auto">{body}</p>
    </div>
  );
}
