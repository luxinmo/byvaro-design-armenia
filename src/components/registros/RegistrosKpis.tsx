/**
 * RegistrosKpis — strip de 6 KPIs en el header de /registros.
 *
 * Cada KPI = icono cuadrado + número grande + label corto.
 * Layout horizontal en desktop · scroll horizontal en mobile.
 *
 * Datos derivados del array completo de Registros (no del filtrado),
 * para que los counters sean siempre el estado real del workspace.
 */

import { Clock, Eye, TrendingUp, CalendarDays, Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Registro } from "@/data/records";

type Props = {
  records: Registro[];
};

export function RegistrosKpis({ records }: Props) {
  const stats = computeStats(records);

  const items = [
    { icon: Clock,        value: stats.pending,      label: "Pendientes", tone: "amber"     as const },
    { icon: Eye,          value: stats.visits,       label: "Visitas",    tone: "primary"   as const },
    { icon: TrendingUp,   value: stats.weekly,       label: "Esta semana", tone: "emerald"  as const },
    { icon: CalendarDays, value: stats.avgResponse,  label: "Resp. media", tone: "muted"    as const, isText: true },
    { icon: Check,        value: stats.approved,     label: "Registrados", tone: "emerald"  as const },
    { icon: Ban,          value: stats.declined,     label: "Rechazados", tone: "destructive" as const },
  ];

  return (
    <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1 -mb-1">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "h-9 w-9 rounded-xl grid place-items-center shrink-0",
              it.tone === "amber"       && "bg-warning/15 text-warning dark:text-warning",
              it.tone === "primary"     && "bg-primary/10 text-primary",
              it.tone === "emerald"     && "bg-success/15 text-success dark:text-success",
              it.tone === "destructive" && "bg-destructive/10 text-destructive",
              it.tone === "muted"       && "bg-muted text-muted-foreground",
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={cn(
                "font-bold leading-none tnum truncate",
                it.isText ? "text-sm" : "text-lg",
                it.tone === "amber"       && "text-warning dark:text-warning",
                it.tone === "primary"     && "text-primary",
                it.tone === "emerald"     && "text-success dark:text-success",
                it.tone === "destructive" && "text-destructive",
                it.tone === "muted"       && "text-foreground",
              )}>
                {it.value}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                {it.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function computeStats(records: Registro[]) {
  const pending  = records.filter((r) => r.estado === "pendiente").length;
  const visits   = records.filter((r) => r.tipo === "registration_visit").length;
  const approved = records.filter((r) => r.estado === "aprobado").length;
  const declined = records.filter((r) => r.estado === "rechazado").length;

  /* Esta semana = últimos 7 días desde now. */
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekly = records.filter((r) => new Date(r.fecha).getTime() > weekAgo).length;

  /* Resp. media = promedio de responseTime declarado en aprobados.
   *  Mock: si hay al menos 1, mostramos un valor representativo.
   *  En producción, el backend lo calcula como AVG(decided_at - created_at). */
  const withResp = records.filter((r) => r.responseTime);
  const avgResponse = withResp.length > 0 ? avgResponseTime(withResp) : "—";

  return { pending, visits, weekly, approved, declined, avgResponse };
}

/** Promedia "1h 24min" + "3h 12min" → "2h 18min". Heurística simple. */
function avgResponseTime(records: Registro[]): string {
  let totalMin = 0;
  let n = 0;
  for (const r of records) {
    const mins = parseResponseTime(r.responseTime ?? "");
    if (mins > 0) { totalMin += mins; n += 1; }
  }
  if (n === 0) return "—";
  const avg = Math.round(totalMin / n);
  const h = Math.floor(avg / 60);
  const m = avg % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function parseResponseTime(s: string): number {
  /* "1h 24min" → 84. "45min" → 45. "2h" → 120. */
  const hMatch = s.match(/(\d+)\s*h/);
  const mMatch = s.match(/(\d+)\s*min/);
  const h = hMatch ? parseInt(hMatch[1], 10) : 0;
  const m = mMatch ? parseInt(mMatch[1], 10) : 0;
  return h * 60 + m;
}
