/**
 * Helpers compartidos por los tabs del panel de colaboración.
 */

import { cn } from "@/lib/utils";

/** Header de sección tipográfico (label uppercase + subtítulo + slot). */
export function SectionHeader({
  title, subtitle, right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** Badge tono semántico · reutilizable para estados de contrato,
 *  pago, documento. */
export function StateBadge({
  label, tone,
}: {
  label: string;
  tone: "muted" | "primary" | "success" | "warning" | "destructive";
}) {
  const cls = {
    muted:       "bg-muted text-muted-foreground border-border",
    primary:     "bg-primary/10 text-primary border-primary/25",
    success:     "bg-success/10 text-success border-success/25",
    warning:     "bg-warning/10 text-warning border-warning/25",
    destructive: "bg-destructive/10 text-destructive border-destructive/25",
  }[tone];
  return (
    <span className={cn(
      "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium",
      cls,
    )}>
      {label}
    </span>
  );
}

export function formatEur(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0 €";
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateShort(ms: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ms));
}

export function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace minutos" : `hace ${hours} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
}
