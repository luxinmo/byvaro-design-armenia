/**
 * MarketingRulesBanner · variante VISUAL de alta visibilidad que se
 * coloca ARRIBA del contenido de la ficha. A diferencia de
 * `MarketingRulesCard` (bottom · framing verde/ámbar), este banner
 * es más prominente y pensado para que el promotor DESCUBRA la
 * feature.
 *
 * Estados:
 *   · Sin configurar (0 prohibiciones) · CTA primario azul "Configurar
 *     dónde no quieres que se publique" con fila de favicons de los
 *     portales top.
 *   · Con restricciones · fila de favicons mostrando prohibidos con
 *     overlay Ban + total "N prohibidos · X permitidos" + "Editar".
 *
 * Se oculta a la agencia (readOnly=true) · es un nudge para el
 * promotor · la agencia ya tiene la `MarketingRulesCard` al pie.
 */

import { Megaphone, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelAvatar } from "./ChannelAvatar";
import {
  MARKETING_CHANNELS,
  TOTAL_CHANNELS,
  getMarketingChannel,
} from "@/lib/marketingChannels";
import { useMarketingProhibitions } from "@/lib/marketingRulesStorage";

interface Props {
  promotionId: string;
  onEdit: () => void;
  className?: string;
}

/** Portales "top" que se muestran siempre en el preview · los más
 *  reconocibles del mercado español (aunque estén permitidos). */
const PREVIEW_CHANNEL_IDS = ["idealista", "fotocasa", "kyero", "instagram", "tiktok", "youtube"];

export function MarketingRulesBanner({ promotionId, onEdit, className }: Props) {
  const prohibitedIds = useMarketingProhibitions(promotionId);
  const hasAny = prohibitedIds.length > 0;
  const allowed = TOTAL_CHANNELS - prohibitedIds.length;

  /* Canales a mostrar en el preview:
   *  - Si hay prohibiciones · todos los prohibidos + los top permitidos hasta completar 8.
   *  - Si no hay · solo los top permitidos. */
  const previewChannels = (() => {
    const list: ReturnType<typeof getMarketingChannel>[] = [];
    if (hasAny) {
      for (const id of prohibitedIds) {
        const c = getMarketingChannel(id);
        if (c) list.push(c);
      }
    }
    for (const id of PREVIEW_CHANNEL_IDS) {
      if (list.some((c) => c?.id === id)) continue;
      const c = getMarketingChannel(id);
      if (c) list.push(c);
      if (list.length >= 8) break;
    }
    // Padding con el resto del catálogo hasta 8
    for (const c of MARKETING_CHANNELS) {
      if (list.length >= 8) break;
      if (list.some((x) => x?.id === c.id)) continue;
      list.push(c);
    }
    return list.slice(0, 8);
  })();

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "group relative w-full rounded-2xl border shadow-soft transition-all text-left overflow-hidden",
        "hover:shadow-soft-lg hover:-translate-y-0.5",
        hasAny
          ? "border-warning/40 bg-gradient-to-br from-warning/[0.08] via-warning/[0.04] to-transparent"
          : "border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent",
        className,
      )}
    >
      <div className="flex items-center gap-4 p-4 sm:p-5">
        {/* Icono grande */}
        <div className={cn(
          "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-soft",
          hasAny ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
        )}>
          {hasAny ? <ShieldAlert className="h-5 w-5" strokeWidth={2} /> : <Megaphone className="h-5 w-5" strokeWidth={2} />}
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] sm:text-[15px] font-bold text-foreground leading-tight">
              {hasAny ? "Reglas de marketing activas" : "¿Dónde NO quieres que se publique?"}
            </p>
            {!hasAny && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                Nuevo
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
            {hasAny ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{prohibitedIds.length}</span>
                {" canal" + (prohibitedIds.length === 1 ? "" : "es") + " prohibido" + (prohibitedIds.length === 1 ? "" : "s")} ·{" "}
                <span className="font-semibold text-foreground tabular-nums">{allowed}</span>
                {" permitidos. Click para editar."}
              </>
            ) : (
              "Bloquea portales o redes sociales donde las agencias colaboradoras NO pueden promocionar esta promoción."
            )}
          </p>
        </div>

        {/* CTA visual */}
        <div className={cn(
          "hidden sm:flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 h-9 shrink-0 transition-colors",
          hasAny
            ? "text-warning bg-warning/10 group-hover:bg-warning/20"
            : "text-primary bg-primary/10 group-hover:bg-primary/20",
        )}>
          {hasAny ? "Editar" : "Configurar"}
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
        </div>
      </div>

      {/* Tira de favicons de preview */}
      <div className="flex items-center gap-2 flex-wrap px-4 sm:px-5 pb-4 pt-1 border-t border-border/40">
        <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider font-semibold">
          {hasAny ? "Estado de los canales" : "Catálogo de canales"}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {previewChannels.map((c) => {
            if (!c) return null;
            const isProhibited = prohibitedIds.includes(c.id);
            return (
              <ChannelAvatar
                key={c.id}
                channel={c}
                prohibited={isProhibited}
                size="sm"
              />
            );
          })}
          {!hasAny && (
            <span className="text-[11px] text-muted-foreground font-medium ml-1">
              +{TOTAL_CHANNELS - previewChannels.length} más
            </span>
          )}
        </div>
        {!hasAny && (
          <div className="ml-auto inline-flex items-center gap-1 text-[11px] text-success font-medium">
            <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
            Todos permitidos por defecto
          </div>
        )}
      </div>
    </button>
  );
}
