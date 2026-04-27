/**
 * HeroStatsStrip · cuatro/cinco cifras grandes justo debajo del hero
 * para comunicar credibilidad de un vistazo.
 *
 * Layout según `entityType` (NO según quién mira):
 *   - "developer" (ficha de un promotor / comercializador, sea propia
 *     o vista por una agencia desde /promotor/:id):
 *       Años · Promociones · Unidades en venta · Importe en venta · Colaboradores
 *
 *   - "agency" (ficha de una agencia, sea propia o vista por un
 *     promotor desde /colaboradores/:id):
 *       Años · Oficinas · Equipo · Unidades vendidas
 *
 * Decisión: lo que cambia los KPIs es QUÉ entidad muestras, NO si
 * eres dueño o visitante. Eso garantiza que /empresa preview-mode y
 * /promotor/:id (visitor agencia) muestran exactamente las mismas
 * cifras del promotor.
 *
 * Los conteos se calculan en `useEmpresaStats()` desde los datasets
 * reales · NUNCA campos manuales editables.
 */

import { Calendar, Building, Home, Coins, Users, MapPin, Handshake } from "lucide-react";
import type { EmpresaStats } from "@/lib/empresaStats";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Compacta el importe a un valor legible:
 *   €1.250.000 → "€1,3M" · €450.000 → "€450k" · 0 → "€0". */
function formatCurrencyCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "€0";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000)}k`;
  }
  return `€${Math.round(value)}`;
}

export function HeroStatsStrip({
  stats,
  entityType = "developer",
  hideColaboradores = false,
}: {
  stats: EmpresaStats;
  /** Tipo de entidad cuya ficha se está mostrando · NO depende de
   *  quién mira (visitor vs owner). Promotor → KPIs de portfolio,
   *  agencia → KPIs operativos. */
  entityType?: "developer" | "agency";
  /** Esconde el tile "Colaboradores" del set developer · es métrica
   *  interna del propio promotor, no se muestra ni a un visitante
   *  externo (vista usuario) ni a la agencia. CLAUDE.md regla "Mirror
   *  del panel del promotor desde la agencia". */
  hideColaboradores?: boolean;
}) {
  const developerItems: Stat[] = [
    { label: "Años activos", value: stats.aniosOperando > 0 ? String(stats.aniosOperando) : "—", icon: Calendar },
    { label: "Promociones", value: String(stats.promociones), icon: Building },
    { label: "Unidades en venta", value: String(stats.unidadesEnVenta), icon: Home },
    { label: "Importe en venta", value: formatCurrencyCompact(stats.importeEnVenta), icon: Coins },
    ...(hideColaboradores
      ? []
      : [{ label: "Colaboradores", value: String(stats.agencias), icon: Handshake }]),
  ];
  const agencyItems: Stat[] = [
    { label: "Años activos", value: stats.aniosOperando > 0 ? String(stats.aniosOperando) : "—", icon: Calendar },
    { label: "Oficinas", value: String(stats.oficinas), icon: MapPin },
    { label: "Equipo", value: String(stats.agentes), icon: Users },
    { label: "Unidades vendidas", value: String(stats.unidadesVendidas), icon: Home },
  ];
  const items = entityType === "developer" ? developerItems : agencyItems;

  // Grid columns adapt to tile count: agency (4) / developer (5).
  const colsClass = items.length === 5
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className={cn("grid divide-x divide-y sm:divide-y-0 divide-border", colsClass)}>
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col items-start gap-2 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[18px] sm:text-[20px] font-semibold leading-none tracking-tight tnum text-foreground")}>
                  {s.value}
                </p>
                <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider mt-1.5">
                  {s.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
