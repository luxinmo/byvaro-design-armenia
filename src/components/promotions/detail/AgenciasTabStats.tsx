/**
 * AgenciasTabStats · contenido de la tab "Agencias" dentro de una
 * promoción. Enfoque analítico puro: KPIs agregados + top agencias
 * por rendimiento. Las acciones (invitar, ver pendientes, abrir
 * estadísticas detalladas) viven en la cabecera con botones suaves.
 *
 * La lista de agencias colaborando NO se muestra aquí · vive en
 * `/colaboradores` (o en el drawer de pendientes cuando están a la
 * espera). Aquí el promotor solo quiere saber cómo rinde su red
 * comercial en esta promoción.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, ArrowUpRight, Users, Inbox, Plus, TrendingUp,
  Eye, FileText, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agencies } from "@/data/agencies";
import { useTotalAgenciasPendientes } from "./AgenciasPendientesDialog";
import type { Promotion } from "@/data/promotions";

function formatEur(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0 €";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K€`;
  return `${n} €`;
}

interface Props {
  promotion: Promotion;
  canShare: boolean;
  onInvitar: () => void;
  onOpenStats: () => void;
  onOpenPendientes: () => void;
}

export function AgenciasTabStats({ promotion: p, canShare, onInvitar, onOpenStats, onOpenPendientes }: Props) {
  const navigate = useNavigate();
  const { total: totalPendientes, invitacionesCount, solicitudesCount } = useTotalAgenciasPendientes(p.id);

  const agenciasEnPromo = useMemo(
    () => agencies.filter((a) => a.promotionsCollaborating?.includes(p.id) && !a.solicitudPendiente),
    [p.id],
  );

  /* KPIs agregados para esta promoción · calculados sobre los
   * campos históricos de cada Agency. En backend estos datos saldrán
   * del `GET /api/promociones/:id/stats`. */
  const kpis = useMemo(() => {
    const totales = agenciasEnPromo.reduce(
      (acc, a) => {
        acc.visitas    += a.visitsCount ?? 0;
        acc.registros  += a.registrations ?? a.registrosAportados ?? 0;
        acc.ventas     += a.ventasCerradas ?? 0;
        acc.volumen    += a.salesVolume ?? 0;
        return acc;
      },
      { visitas: 0, registros: 0, ventas: 0, volumen: 0 },
    );
    const conversion = totales.registros > 0
      ? Math.round((totales.ventas / totales.registros) * 100)
      : 0;
    return { ...totales, conversion };
  }, [agenciasEnPromo]);

  /* Top 3 agencias por ventas cerradas (descendente). */
  const topAgencias = useMemo(() => {
    return [...agenciasEnPromo]
      .sort((a, b) => (b.ventasCerradas ?? 0) - (a.ventasCerradas ?? 0))
      .slice(0, 3);
  }, [agenciasEnPromo]);

  return (
    <div className="space-y-5">
      {/* Header · encabezado suave + acciones ghost */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Rendimiento de tu red
          </p>
          <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
            {agenciasEnPromo.length} {agenciasEnPromo.length === 1 ? "agencia" : "agencias"} colaborando
          </h2>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {totalPendientes > 0 && (
            <button
              onClick={onOpenPendientes}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-foreground hover:bg-muted transition-colors"
              title={`${solicitudesCount} solicitud${solicitudesCount === 1 ? "" : "es"} · ${invitacionesCount} invitacion${invitacionesCount === 1 ? "" : "es"}`}
            >
              <Inbox className="h-3.5 w-3.5" strokeWidth={1.75} />
              Pendientes
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-foreground text-background text-[10px] font-bold tabular-nums">
                {totalPendientes}
              </span>
            </button>
          )}
          <button
            onClick={onOpenStats}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Detalle
          </button>
          {canShare && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors ml-1"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Invitar agencia
            </button>
          )}
        </div>
      </header>

      {/* KPIs · 4 métricas clave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Eye}        label="Visitas"    value={kpis.visitas} tone="primary" />
        <KpiCard icon={FileText}   label="Registros"  value={kpis.registros} tone="muted" />
        <KpiCard icon={Home}       label="Ventas"     value={kpis.ventas} tone="success" />
        <KpiCard icon={TrendingUp} label="Conversión" value={`${kpis.conversion}%`} tone="warning" sub={formatEur(kpis.volumen)} />
      </div>

      {/* Top agencias · ranking muy compacto */}
      {agenciasEnPromo.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="px-4 sm:px-5 py-3 border-b border-border/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Top agencias en esta promoción</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ordenadas por ventas cerradas.</p>
            </div>
            <button
              onClick={() => navigate("/colaboradores")}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Ver todas <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="divide-y divide-border/50">
            {topAgencias.map((a, i) => {
              const ventas = a.ventasCerradas ?? 0;
              const registros = a.registrations ?? a.registrosAportados ?? 0;
              const conversion = registros > 0 ? Math.round((ventas / registros) * 100) : 0;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/colaboradores/${a.id}`)}
                >
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-muted overflow-hidden shrink-0">
                    {a.logo ? (
                      <img src={a.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-muted-foreground">
                        <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.location}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 tabular-nums">
                    <span className="hidden sm:inline">
                      <span className="text-foreground font-semibold">{registros}</span> reg.
                    </span>
                    <span>
                      <span className="text-foreground font-semibold">{ventas}</span> ventas
                    </span>
                    <span className="hidden md:inline">
                      <span className={cn("font-semibold", conversion > 0 ? "text-success" : "text-muted-foreground")}>
                        {conversion}%
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Empty state · sin colaboradoras todavía */}
      {agenciasEnPromo.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground mb-1">Aún no colabora ninguna agencia</p>
          <p className="text-xs text-muted-foreground mb-4">
            Cuando invites a una agencia y acepte, verás aquí sus métricas agregadas para esta promoción.
          </p>
          {canShare && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Invitar agencia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  tone: "primary" | "success" | "warning" | "muted";
  sub?: string;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    muted:   "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center", toneClass)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2.5">{label}</p>
      <p className="text-[22px] font-bold tabular-nums leading-none mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}
