/**
 * SettingsScreen + SettingsCard · primitivas para construir páginas
 * dentro del SettingsShell.
 *
 * Uso típico:
 *
 *   <SettingsScreen title="Etiquetas" description="…">
 *     <SettingsCard title="Etiquetas de la organización" footer={<Button>+ Nueva</Button>}>
 *       …filas…
 *     </SettingsCard>
 *   </SettingsScreen>
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsScreen({
  title,
  description,
  actions,
  children,
  maxWidth,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Override del ancho máximo · default 860px (lectura cómoda).
   *  Páginas con KPI strips o grids de 3+ cards (ej. /ajustes/
   *  facturacion/plan) pueden pasar "wide" para 1080px · evita
   *  que las cajas queden estranguladas. */
  maxWidth?: "default" | "wide";
}) {
  return (
    <div className={cn(
      "w-full",
      maxWidth === "wide" ? "max-w-[1080px]" : "max-w-[860px]",
    )}>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>

      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-card rounded-2xl border border-border/40 shadow-soft overflow-hidden",
        className,
      )}
    >
      {(title || description) && (
        <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/40">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </header>
      )}
      <div className="p-5 sm:p-6">{children}</div>
      {footer && (
        <footer className="px-5 sm:px-6 py-3.5 bg-muted/30 border-t border-border/40">{footer}</footer>
      )}
    </section>
  );
}
