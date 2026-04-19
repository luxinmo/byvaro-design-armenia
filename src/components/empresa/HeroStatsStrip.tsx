/**
 * HeroStatsStrip · cuatro cifras grandes justo debajo del hero para
 * comunicar credibilidad de un vistazo (Años · Promociones · Unidades
 * vendidas · Agencias colaboradoras).
 *
 * Diseño: row de 4 tiles con border divider entre ellos, mobile → 2x2.
 * Color del número acentuado con el colorCorporativo cuando está
 * definido (fallback a var(--primary)).
 */

import { Calendar, Tag, Building2, Handshake } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function HeroStatsStrip({ empresa }: { empresa: Empresa }) {
  const stats: Stat[] = [
    { label: "Años activos", value: empresa.aniosOperando || "—", icon: Calendar },
    { label: "Promociones", value: empresa.promocionesCount || "0", icon: Tag },
    { label: "Unidades vendidas", value: empresa.unidadesVendidas || "0", icon: Building2 },
    { label: "Agencias", value: empresa.agenciasColaboradoras || "0", icon: Handshake },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col items-start gap-2 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className={cn("text-[26px] sm:text-[30px] font-bold leading-none tracking-tight tnum text-foreground")}>
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
