/**
 * /ajustes/facturacion/uso — Métricas de uso detalladas + tendencias.
 */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: number;
  unit?: string;
  delta: number;
  description?: string;
};

const METRICS: Metric[] = [
  { label: "Promociones activas", value: 12, delta: 2, description: "+2 vs mes anterior" },
  { label: "Contactos en CRM", value: 1248, delta: 134, description: "+134 nuevos este mes" },
  { label: "Registros gestionados", value: 89, delta: -8, description: "-8 vs mes anterior" },
  { label: "Visitas confirmadas", value: 38, delta: 12 },
  { label: "Emails enviados", value: 327, delta: 45, description: "Tope mensual: 5.000" },
  { label: "Almacenamiento (GB)", value: 2.4, unit: " GB", delta: 0.3, description: "De 50 GB" },
  { label: "Llamadas API", value: 18432, delta: 2104, description: "Webhooks + integraciones" },
  { label: "Microsites publicados", value: 8, delta: 1 },
];

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-ES").format(n);
}

export default function AjustesFacturacionUso() {
  return (
    <SettingsScreen
      title="Uso del producto"
      description="Métricas detalladas del uso de Byvaro en tu workspace este mes. Útil para entender la evolución y planificar el upgrade de plan."
    >
      <SettingsCard title="Métricas del mes" description="Comparativa con el mes anterior.">
        <div className="grid grid-cols-2 gap-4">
          {METRICS.map((m) => {
            const Icon = m.delta > 0 ? TrendingUp : m.delta < 0 ? TrendingDown : Minus;
            const trendColor = m.delta > 0 ? "text-emerald-600" : m.delta < 0 ? "text-destructive" : "text-muted-foreground";
            return (
              <div key={m.label} className="rounded-xl border border-border/40 p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground tnum mt-1">
                  {formatNumber(m.value)}{m.unit}
                </p>
                <div className={cn("flex items-center gap-1 mt-1 text-[11px] font-medium", trendColor)}>
                  <Icon className="h-3 w-3" />
                  {m.delta > 0 ? "+" : ""}{formatNumber(m.delta)}{m.unit}
                  {m.description && <span className="text-muted-foreground font-normal ml-1">· {m.description}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Próxima factura" description="Estimación basada en el uso actual y el plan vigente.">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">1 mayo 2026</p>
          <p className="text-3xl font-bold tracking-tight text-foreground tnum">249,00 €</p>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
