/**
 * Tab "Ventas" del panel de colaboración.
 *
 * Pipeline de ventas iniciadas por clientes de esta agencia sobre
 * tus promociones. Mock determinista · backend:
 *   GET /api/agencias/:id/sales?stage=iniciada|reserva|contrato|escritura|entregada|cancelada
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, Home, FileSignature, KeySquare, XCircle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { formatEur, formatDateShort } from "./shared";

interface Props {
  agency: Agency;
}

interface MockSale {
  id: string;
  client: string;
  promoId: string;
  promoName: string;
  unit: string;
  stage: "iniciada" | "reserva" | "contrato" | "escritura" | "entregada" | "cancelada";
  amount: number;
  startedAt: number;
  agent?: string;
}

export function VentasTab({ agency: a }: Props) {
  const sales: MockSale[] = useMemo(() => {
    const now = Date.now();
    const base: Record<string, MockSale[]> = {
      "ag-1": [
        { id: "s1", client: "Carlos Ortega",          promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 02-A", stage: "reserva",   amount: 980_000,   startedAt: now - 4 * 86400e3,  agent: "Laura Sánchez" },
        { id: "s2", client: "Laura Fernández",        promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 01-2",  stage: "contrato",  amount: 720_000,   startedAt: now - 12 * 86400e3, agent: "Diego Romero" },
        { id: "s3", client: "Nuria Blanco",           promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 11-C", stage: "iniciada",  amount: 1_120_000, startedAt: now - 2 * 86400e3,  agent: "Laura Sánchez" },
        { id: "s4", client: "Miguel Ángel Torres",    promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 03-1",  stage: "escritura", amount: 680_000,   startedAt: now - 28 * 86400e3, agent: "Diego Romero" },
        { id: "s5", client: "Pablo Molina",           promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 07-A", stage: "entregada", amount: 1_050_000, startedAt: now - 60 * 86400e3, agent: "Laura Sánchez" },
        { id: "s6", client: "Diego Fuentes",          promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 08-2",  stage: "cancelada", amount: 700_000,   startedAt: now - 18 * 86400e3, agent: "Diego Romero" },
      ],
      "ag-2": [
        { id: "s1", client: "Lars Nilsson",           promoId: "dev-1", promoName: "Villa Serena",     unit: "Villa 03-C", stage: "contrato", amount: 1_100_000, startedAt: now - 6 * 86400e3,  agent: "Sofia Bergman" },
        { id: "s2", client: "Astrid Olsen",           promoId: "dev-2", promoName: "Villas del Pinar", unit: "Apt. 07-2",  stage: "reserva",  amount: 690_000,   startedAt: now - 14 * 86400e3, agent: "Erik Lindqvist" },
      ],
    };
    return (base[a.id] ?? []).sort((x, y) => y.startedAt - x.startedAt);
  }, [a.id]);

  const kpi = useMemo(() => {
    const enCurso = sales.filter((s) => ["iniciada", "reserva", "contrato", "escritura"].includes(s.stage)).length;
    const cerradas = sales.filter((s) => s.stage === "entregada").length;
    const totalCerradas = sales.filter((s) => s.stage === "entregada").reduce((sum, s) => sum + s.amount, 0);
    return { enCurso, cerradas, totalCerradas };
  }, [sales]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="En curso" value={kpi.enCurso} icon={TrendingUp} tone={kpi.enCurso > 0 ? "primary" : "muted"} />
        <KpiTile label="Cerradas" value={kpi.cerradas} icon={KeySquare} tone="success" />
        <KpiTile label="Volumen cerradas" value={formatEur(kpi.totalCerradas)} icon={Home} tone="success" />
      </div>

      {sales.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin ventas todavía" body="Cuando arranque una venta con clientes de esta agencia aparecerá aquí." />
      ) : (
        <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
          {sales.map((s) => <SaleRow key={s.id} sale={s} />)}
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
  tone: "primary" | "success" | "muted";
}) {
  const iconCls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    muted:   "bg-muted text-muted-foreground",
  }[tone];
  const valueCls = {
    primary: "text-primary",
    success: "text-success",
    muted:   "text-muted-foreground",
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

function SaleRow({ sale: s }: { sale: MockSale }) {
  const stageMeta: Record<MockSale["stage"], { label: string; cls: string; icon: typeof TrendingUp; pct: number }> = {
    iniciada:  { label: "Iniciada",   cls: "border-muted-foreground/20 bg-muted/40 text-muted-foreground", icon: TrendingUp,    pct: 20 },
    reserva:   { label: "Reserva",    cls: "border-primary/25 bg-primary/10 text-primary",                 icon: Home,          pct: 40 },
    contrato:  { label: "Contrato",   cls: "border-primary/25 bg-primary/10 text-primary",                 icon: FileSignature, pct: 60 },
    escritura: { label: "Escritura",  cls: "border-primary/25 bg-primary/10 text-primary",                 icon: FileSignature, pct: 80 },
    entregada: { label: "Entregada",  cls: "border-success/25 bg-success/10 text-success",                 icon: KeySquare,     pct: 100 },
    cancelada: { label: "Cancelada",  cls: "border-destructive/25 bg-destructive/10 text-destructive",     icon: XCircle,       pct: 0 },
  };
  const meta = stageMeta[s.stage];
  const StageIcon = meta.icon;
  const iconBgCls = {
    iniciada:  "bg-muted text-muted-foreground",
    reserva:   "bg-primary/10 text-primary",
    contrato:  "bg-primary/10 text-primary",
    escritura: "bg-primary/10 text-primary",
    entregada: "bg-success/10 text-success",
    cancelada: "bg-destructive/10 text-destructive",
  }[s.stage];

  return (
    <li>
      <Link
        to={`/ventas?id=${s.id}`}
        className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
      >
        <span className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", iconBgCls)}>
          <StageIcon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{s.client}</p>
            <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium", meta.cls)}>
              {meta.label}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
            {s.promoName}
            {" · "}{s.unit}
            {s.agent ? ` · ${s.agent}` : ""}
          </p>
          {s.stage !== "cancelada" && (
            <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", s.stage === "entregada" ? "bg-success" : "bg-primary")}
                style={{ width: `${meta.pct}%` }}
              />
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-foreground tabular-nums">{formatEur(s.amount)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateShort(s.startedAt)}</p>
        </div>
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
