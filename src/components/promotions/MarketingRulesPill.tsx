/**
 * MarketingRulesPill · variante COMPACTA para colocar junto al
 * heading / chips de estado de la promoción. Siempre visible.
 *
 * Estados:
 *   · Sin configurar · gris discreto con icono Megaphone ·
 *     "Marketing · configurar".
 *   · Permitido todo · verde con CheckCircle2 · "Marketing: libre".
 *   · Con restricciones · ámbar con Ban + contador · "N prohibidos".
 *
 * El promotor lo clicka para abrir el dialog. La agencia lo ve como
 * pill informativo no clickable (readOnly).
 */

import { CheckCircle2, Megaphone, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketingProhibitions } from "@/lib/marketingRulesStorage";

interface Props {
  promotionId: string;
  readOnly?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MarketingRulesPill({ promotionId, readOnly = false, onClick, className }: Props) {
  const prohibitedIds = useMarketingProhibitions(promotionId);
  const hasAny = prohibitedIds.length > 0;
  const Comp = readOnly ? "div" : "button";

  return (
    <Comp
      type={readOnly ? undefined : "button"}
      onClick={readOnly ? undefined : onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-semibold transition-colors",
        hasAny
          ? "bg-warning/10 text-warning hover:bg-warning/15 border border-warning/20"
          : "bg-success/10 text-success hover:bg-success/15 border border-success/20",
        !readOnly && "cursor-pointer",
        className,
      )}
      aria-label={hasAny
        ? `${prohibitedIds.length} canales de marketing prohibidos`
        : "Marketing permitido en todos los canales"}
    >
      {hasAny ? (
        <>
          <Ban className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span className="tabular-nums">{prohibitedIds.length}</span>
          <span>prohibido{prohibitedIds.length === 1 ? "" : "s"}</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span>Marketing libre</span>
        </>
      )}
      {!readOnly && !hasAny && (
        <Megaphone className="h-2.5 w-2.5 opacity-60 ml-0.5" strokeWidth={2} />
      )}
    </Comp>
  );
}
