/**
 * MarketingRulesCard · tarjeta en la ficha de la promoción que informa
 * de las reglas de marketing vigentes. Ve igual el promotor y la
 * agencia colaboradora.
 *
 * Estados visuales:
 *   · VERDE  · 0 prohibiciones · "Permitido publicar en portales y
 *              redes sociales".
 *   · ÁMBAR  · ≥1 prohibición · "Permitido publicar en portales y
 *              redes sociales EXCEPTO: <chips con icono Ban>" + nota
 *              legal "la violación puede llevar a la extinción del
 *              contrato".
 *
 * El promotor recibe un botón "Editar" en la esquina que abre
 * `MarketingRulesDialog`. La agencia no lo ve (viewAsCollaborator).
 *
 * Estabilidad visual · usa `hsl(var(--success))` para el caso verde y
 * `hsl(var(--warning))` para el caso ámbar · nunca colores hardcoded.
 */

import { Ban, CheckCircle2, Megaphone, ShieldAlert, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketingProhibitions } from "@/lib/marketingRulesStorage";
import { getMarketingChannel } from "@/lib/marketingChannels";

interface Props {
  promotionId: string;
  /** Si true, se oculta el botón "Editar" (vista de agencia). */
  readOnly?: boolean;
  /** Callback al pulsar "Editar" · solo usado si !readOnly. */
  onEdit?: () => void;
  className?: string;
}

export function MarketingRulesCard({ promotionId, readOnly = false, onEdit, className }: Props) {
  const prohibitedIds = useMarketingProhibitions(promotionId);
  const hasAny = prohibitedIds.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-soft overflow-hidden",
        hasAny
          ? "border-warning/30 bg-warning/5"
          : "border-success/30 bg-success/5",
        className,
      )}
    >
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            hasAny ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
          )}>
            {hasAny ? <ShieldAlert className="h-4 w-4" strokeWidth={2} /> : <CheckCircle2 className="h-4 w-4" strokeWidth={2} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13.5px] font-semibold text-foreground leading-tight">
                Marketing y publicación
              </p>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5",
                hasAny ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
              )}>
                {hasAny ? `${prohibitedIds.length} restricción${prohibitedIds.length === 1 ? "" : "es"}` : "Sin restricciones"}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              {hasAny
                ? "Permitido publicar en portales y redes sociales excepto en los canales listados."
                : "Permitido publicar en portales y redes sociales."}
            </p>
          </div>

          {!readOnly && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Pencil className="h-3 w-3" strokeWidth={2} />
              Editar
            </button>
          )}
        </div>

        {/* Chips de canales prohibidos */}
        {hasAny && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {prohibitedIds.map((id) => {
              const channel = getMarketingChannel(id);
              const label = channel?.label ?? id;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5"
                >
                  <Ban className="h-2.5 w-2.5" strokeWidth={2.5} />
                  {label}
                </span>
              );
            })}
          </div>
        )}

        {/* Nota legal · solo cuando hay restricciones */}
        {hasAny && (
          <div className="mt-3 pt-3 border-t border-warning/20">
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              <span className="font-semibold text-warning">Importante:</span>{" "}
              La violación de esta regla puede llevar a la extinción del contrato de colaboración.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
