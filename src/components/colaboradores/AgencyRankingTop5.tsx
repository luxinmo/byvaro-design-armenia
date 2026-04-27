/**
 * AgencyRankingTop5 — ranking simple de agencias por nº de registros
 * (datos reales · seed + creados en localStorage).
 *
 * QUÉ
 * ----
 * Card compacta que tabula el top 5 de agencias del workspace por
 * cantidad de registros aportados (cualquier estado · pendiente,
 * aprobado, rechazado, duplicado · da igual). Es el "leaderboard"
 * pedido en la auditoría Fase 1: simple, dinámico, sin matrices.
 *
 * Pensado para insertarse en `/colaboradores/estadisticas` o donde
 * tenga sentido (ej. Inicio del promotor).
 *
 * CÓMO
 * ----
 * Lee `useCreatedRegistros()` + el seed `registros` y agrupa por
 * `agencyId`. Solo cuenta los que tienen agencia (los `direct` del
 * promotor no entran).
 *
 * TODO(backend): GET /api/agencies/ranking?dim=registros&limit=5 →
 *   { agencyId, name, count, lastActivityAt }[]
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Trophy, ArrowRight } from "lucide-react";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { registros as SEED_REGISTROS } from "@/data/records";
import { agencies as ALL_AGENCIES } from "@/data/agencies";
import { agencyHref } from "@/lib/agencyNavigation";
import { cn } from "@/lib/utils";

export function AgencyRankingTop5({ className }: { className?: string }) {
  const created = useCreatedRegistros();

  const ranking = useMemo(() => {
    const all = [...created, ...SEED_REGISTROS].filter((r) => r.agencyId);
    const counts = new Map<string, number>();
    for (const r of all) {
      const id = r.agencyId!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([id, count]) => {
        const agency = ALL_AGENCIES.find((a) => a.id === id);
        return agency ? { agency, count } : null;
      })
      .filter((x): x is { agency: typeof ALL_AGENCIES[number]; count: number } => !!x)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return rows;
  }, [created]);

  if (ranking.length === 0) return null;
  const max = ranking[0].count;

  return (
    <section className={cn(
      "rounded-2xl border border-border bg-card shadow-soft p-4 sm:p-5",
      className,
    )}>
      <header className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Trophy className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            Top agencias por registros
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Quién aporta más leads · datos en vivo
          </p>
        </div>
      </header>
      <ol className="space-y-2">
        {ranking.map((row, idx) => {
          const pct = Math.round((row.count / max) * 100);
          return (
            <li key={row.agency.id}>
              <Link
                to={agencyHref(row.agency)}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-muted/50 transition-colors"
              >
                <span className="h-6 w-6 rounded-full bg-muted text-foreground/70 grid place-items-center text-[11px] font-semibold shrink-0 tabular-nums">
                  {idx + 1}
                </span>
                {row.agency.logo ? (
                  <img
                    src={row.agency.logo}
                    alt=""
                    className="h-7 w-7 rounded-lg object-cover shrink-0 bg-muted border border-border/50"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                    {row.agency.name}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-foreground tabular-nums shrink-0">
                  {row.count}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
