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

import { CheckCircle2, Megaphone, Ban, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketingProhibitions } from "@/lib/marketingRulesStorage";
import { TOTAL_CHANNELS } from "@/lib/marketingChannels";

interface Props {
  promotionId: string;
  readOnly?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MarketingRulesPill({ promotionId, readOnly = false, onClick, className }: Props) {
  const prohibitedIds = useMarketingProhibitions(promotionId);
  const hasAny = prohibitedIds.length > 0;
  const allProhibited = prohibitedIds.length === TOTAL_CHANNELS;
  const tone: "none" | "some" | "all" = !hasAny ? "none" : allProhibited ? "all" : "some";
  const Comp = readOnly ? "div" : "button";

  const toneCls =
    tone === "all"
      ? "bg-destructive/10 text-destructive hover:bg-destructive/15 border border-destructive/20"
      : tone === "some"
      ? "bg-warning/10 text-warning hover:bg-warning/15 border border-warning/20"
      : "bg-success/10 text-success hover:bg-success/15 border border-success/20";

  return (
    <Comp
      type={readOnly ? undefined : "button"}
      onClick={readOnly ? undefined : onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-semibold transition-colors",
        toneCls,
        !readOnly && "cursor-pointer",
        className,
      )}
      aria-label={tone === "all"
        ? "Solo uso interno · publicación prohibida en todos los canales"
        : tone === "some"
        ? `${prohibitedIds.length} canales de marketing prohibidos`
        : "Marketing permitido en todos los canales"}
    >
      {tone === "all" ? (
        <>
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span>Solo uso interno</span>
        </>
      ) : tone === "some" ? (
        <>
          <Ban className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span className="tabular-nums">{prohibitedIds.length}</span>
          <span>prohibido{prohibitedIds.length === 1 ? "" : "s"}</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span>Marketing libre</span>
          {!readOnly && <Megaphone className="h-2.5 w-2.5 opacity-60 ml-0.5" strokeWidth={2} />}
        </>
      )}
    </Comp>
  );
}
