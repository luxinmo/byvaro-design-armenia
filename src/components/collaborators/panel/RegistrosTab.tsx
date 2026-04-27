/**
 * Tab "Registros" del panel de colaboración.
 *
 * Registros de clientes que la agencia ha aportado sobre tus
 * promociones. Cada registro es un cliente que la agencia declara
 * "suyo" · entra a validarse por el detector de duplicados (cruce
 * con contactos del promotor y registros previos).
 *
 * Mock determinista · backend:
 *   GET /api/agencias/:id/registrations?status=pending|approved|rejected|expired
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText, CheckCircle2, Clock, XCircle, AlertTriangle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { Flag } from "@/components/ui/Flag";
import { formatDateShort } from "./shared";
import { useCurrentUser } from "@/lib/currentUser";

interface Props {
  agency: Agency;
  /** Mismo patrón que VisitasTab · si está set, filtramos a los
   *  registros de ese agente. Mock matchea por nombre. Backend
   *  filtrará por agent_id. */
  restrictToUserId?: string;
}

interface MockRegistro {
  id: string;
  client: string;
  promoId: string;
  promoName: string;
  status: "pendiente" | "aprobado" | "rechazado" | "caducado";
  createdAt: number;
  resolvedAt?: number;
  matchPercentage?: number;   // % del detector de duplicados
  rejectionReason?: string;
  agent?: string;
  nationality?: string;
}

export function RegistrosTab({ agency: a, restrictToUserId }: Props) {
  const currentUserName = useCurrentUser().name;
  const registros: MockRegistro[] = useMemo(() => {
    const now = Date.now();
    const base: Record<string, MockRegistro[]> = {
      "ag-1": [
        { id: "r1",  client: "María García",      promoId: "dev-1", promoName: "Villa Serena",     status: "aprobado",  createdAt: now - 35 * 86400e3, resolvedAt: now - 34 * 86400e3, matchPercentage: 0,  agent: "Laura Sánchez", nationality: "ES" },
        { id: "r2",  client: "Pedro Sánchez",     promoId: "dev-2", promoName: "Villas del Pinar", status: "aprobado",  createdAt: now - 28 * 86400e3, resolvedAt: now - 27 * 86400e3, matchPercentage: 12, agent: "Diego Romero", nationality: "ES" },
        { id: "r3",  client: "Isabel Ruiz",       promoId: "dev-1", promoName: "Villa Serena",     status: "pendiente", createdAt: now - 2 * 86400e3,  matchPercentage: 0,  agent: "Laura Sánchez", nationality: "FR" },
        { id: "r4",  client: "Carlos Ortega",     promoId: "dev-1", promoName: "Villa Serena",     status: "aprobado",  createdAt: now - 20 * 86400e3, resolvedAt: now - 19 * 86400e3, matchPercentage: 0,  agent: "Laura Sánchez", nationality: "ES" },
        { id: "r5",  client: "Lucía Romero",      promoId: "dev-2", promoName: "Villas del Pinar", status: "pendiente", createdAt: now - 1 * 86400e3,  matchPercentage: 72, agent: "Diego Romero", nationality: "IT" },
        { id: "r6",  client: "Ana Gómez",         promoId: "dev-1", promoName: "Villa Serena",     status: "rechazado", createdAt: now - 45 * 86400e3, resolvedAt: now - 44 * 86400e3, matchPercentage: 88, rejectionReason: "Duplicado · cliente ya en contactos", agent: "Laura Sánchez", nationality: "ES" },
        { id: "r7",  client: "Javier Peña",       promoId: "dev-2", promoName: "Villas del Pinar", status: "caducado",  createdAt: now - 120 * 86400e3, resolvedAt: now - 30 * 86400e3, matchPercentage: 0, agent: "Diego Romero", nationality: "ES" },
        { id: "r8",  client: "Nadia Ibáñez",      promoId: "dev-1", promoName: "Villa Serena",     status: "aprobado",  createdAt: now - 15 * 86400e3, resolvedAt: now - 14 * 86400e3, matchPercentage: 0,  agent: "Laura Sánchez", nationality: "MA" },
      ],
      "ag-2": [
        { id: "r1",  client: "Erik Lindqvist",    promoId: "dev-1", promoName: "Villa Serena",     status: "aprobado",  createdAt: now - 25 * 86400e3, resolvedAt: now - 24 * 86400e3, matchPercentage: 0,  agent: "Sofia Bergman",   nationality: "SE" },
        { id: "r2",  client: "Lars Nilsson",      promoId: "dev-1", promoName: "Villa Serena",     status: "aprobado",  createdAt: now - 18 * 86400e3, resolvedAt: now - 17 * 86400e3, matchPercentage: 18, agent: "Sofia Bergman",   nationality: "SE" },
        { id: "r3",  client: "Astrid Olsen",      promoId: "dev-2", promoName: "Villas del Pinar", status: "aprobado",  createdAt: now - 30 * 86400e3, resolvedAt: now - 29 * 86400e3, matchPercentage: 0,  agent: "Erik Lindqvist",  nationality: "DK" },
        { id: "r4",  client: "Ingrid Hansen",     promoId: "dev-1", promoName: "Villa Serena",     status: "pendiente", createdAt: now - 3 * 86400e3,  matchPercentage: 35, agent: "Sofia Bergman",   nationality: "NO" },
      ],
    };
    const all = base[a.id] ?? [];
    const filtered = restrictToUserId ? all.filter((r) => r.agent === currentUserName) : all;
    return filtered.sort((x, y) => y.createdAt - x.createdAt);
  }, [a.id, restrictToUserId, currentUserName]);

  const kpi = useMemo(() => ({
    pendientes:  registros.filter((r) => r.status === "pendiente").length,
    aprobados:   registros.filter((r) => r.status === "aprobado").length,
    rechazados:  registros.filter((r) => r.status === "rechazado").length,
    caducados:   registros.filter((r) => r.status === "caducado").length,
  }), [registros]);

  const conversion = kpi.aprobados > 0
    ? Math.round((kpi.aprobados / (kpi.aprobados + kpi.rechazados + kpi.caducados)) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Pendientes" value={kpi.pendientes} icon={Clock}         tone={kpi.pendientes > 0 ? "primary" : "muted"} />
        <KpiTile label="Aprobados"  value={kpi.aprobados}  icon={CheckCircle2}  tone="success" />
        <KpiTile label="Rechazados" value={kpi.rechazados} icon={XCircle}       tone={kpi.rechazados > 0 ? "destructive" : "muted"} />
        <KpiTile label="Aprobación" value={`${conversion}%`} icon={FileText}    tone={conversion >= 70 ? "success" : conversion >= 40 ? "primary" : "muted"} />
      </div>

      {registros.length === 0 ? (
        <EmptyState icon={FileText} title="Sin registros todavía" body="Cuando la agencia registre un cliente aparecerá aquí para validarlo." />
      ) : (
        <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
          {registros.map((r) => <RegistroRow key={r.id} registro={r} />)}
        </ul>
      )}
    </div>
  );
}

function KpiTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number | string;
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

function RegistroRow({ registro: r }: { registro: MockRegistro }) {
  const statusMeta = {
    pendiente:  { label: "Pendiente", cls: "border-primary/25 bg-primary/10 text-primary",                 icon: Clock },
    aprobado:   { label: "Aprobado",  cls: "border-success/25 bg-success/10 text-success",                 icon: CheckCircle2 },
    rechazado:  { label: "Rechazado", cls: "border-destructive/25 bg-destructive/10 text-destructive",     icon: XCircle },
    caducado:   { label: "Caducado",  cls: "border-muted-foreground/20 bg-muted/40 text-muted-foreground", icon: Clock },
  }[r.status];
  const StatusIcon = statusMeta.icon;
  const hasMatch = typeof r.matchPercentage === "number" && r.matchPercentage >= 50;

  return (
    <li>
      <Link
        to={`/registros?id=${r.id}`}
        className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <span className="h-9 w-9 rounded-xl bg-muted/60 grid place-items-center shrink-0">
          <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{r.client}</p>
            {r.nationality && (
              <span className="inline-flex items-center gap-1 h-5 pl-1 pr-2 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
                <Flag iso={r.nationality} size={12} />
                {r.nationality}
              </span>
            )}
            {hasMatch && (
              <span className={cn(
                "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-medium",
                r.matchPercentage! >= 80
                  ? "border-destructive/25 bg-destructive/10 text-destructive"
                  : "border-warning/30 bg-warning/10 text-warning",
              )}>
                <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
                Duplicado {r.matchPercentage}%
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
            {r.promoName}
            {r.agent ? ` · ${r.agent}` : ""}
            {" · "}{formatDateShort(r.createdAt)}
          </p>
          {r.rejectionReason && (
            <p className="text-[10.5px] text-destructive mt-0.5 truncate">
              {r.rejectionReason}
            </p>
          )}
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
