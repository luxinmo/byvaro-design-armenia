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

import { useState } from "react";
import { CheckCircle2, ShieldAlert, Pencil, Ban, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketingProhibitions } from "@/lib/marketingRulesStorage";
import { getMarketingChannel, channelFaviconUrl, TOTAL_CHANNELS, type MarketingChannel } from "@/lib/marketingChannels";

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
  const allProhibited = prohibitedIds.length === TOTAL_CHANNELS;

  /* Tres estados visuales:
   *   · NONE (verde)   · todo permitido.
   *   · SOME (ámbar)   · lista de canales prohibidos con favicon.
   *   · ALL  (rojo)    · sólo uso interno · una frase, sin chips. */
  const tone: "none" | "some" | "all" = !hasAny ? "none" : allProhibited ? "all" : "some";

  const containerCls =
    tone === "all"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "some"
      ? "border-warning/30 bg-warning/5"
      : "border-success/30 bg-success/5";

  const iconBoxCls =
    tone === "all"
      ? "bg-destructive/15 text-destructive"
      : tone === "some"
      ? "bg-warning/15 text-warning"
      : "bg-success/15 text-success";

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-soft overflow-hidden",
        containerCls,
        className,
      )}
    >
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", iconBoxCls)}>
            {tone === "all" ? <Lock className="h-4 w-4" strokeWidth={2} /> :
             tone === "some" ? <ShieldAlert className="h-4 w-4" strokeWidth={2} /> :
             <CheckCircle2 className="h-4 w-4" strokeWidth={2} />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13.5px] font-semibold text-foreground leading-tight">
                Marketing y publicación
              </p>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5",
                tone === "all" ? "bg-destructive/15 text-destructive"
                  : tone === "some" ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success",
              )}>
                {tone === "all" ? "Solo uso interno"
                  : tone === "some" ? `${prohibitedIds.length} restricción${prohibitedIds.length === 1 ? "" : "es"}`
                  : "Sin restricciones"}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              {tone === "all"
                ? "No está permitido publicar en ningún canal externo. Esta promoción es de uso interno."
                : tone === "some"
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

        {/* Chips de canales prohibidos · neutros · favicon real del
            portal + nombre en color normal + Ban como única señal de
            prohibición. Si el favicon falla cae al icono Lucide del
            catálogo (no a un genérico "inventado"). */}
        {tone === "some" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {prohibitedIds.map((id) => {
              const channel = getMarketingChannel(id);
              if (!channel) {
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card text-[11px] font-semibold text-foreground px-2 py-0.5">
                    <Ban className="h-2.5 w-2.5 text-destructive" strokeWidth={2.5} />
                    {id}
                  </span>
                );
              }
              return <ProhibitedChannelChip key={id} channel={channel} />;
            })}
          </div>
        )}

        {/* Nota legal · aplica tanto a "some" como a "all" (ambos casos
            imponen obligación contractual a la agencia). */}
        {tone !== "none" && (
          <div className={cn(
            "mt-3 pt-3 border-t",
            tone === "all" ? "border-destructive/20" : "border-warning/20",
          )}>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              <span className={cn(
                "font-semibold",
                tone === "all" ? "text-destructive" : "text-warning",
              )}>Importante:</span>{" "}
              La violación de esta regla puede llevar a la extinción del contrato de colaboración.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ProhibitedChannelChip · favicon real + nombre + Ban
   · el favicon viene de Google Favicons (channelFaviconUrl) y llena
     16×16px dentro del chip · fallback al icono Lucide del catálogo
     si Google no sirve uno.
   ═══════════════════════════════════════════════════════════════════ */
function ProhibitedChannelChip({ channel }: { channel: MarketingChannel }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const favicon = channelFaviconUrl(channel, 32);
  const Icon = channel.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-1.5 pr-2 py-1">
      {favicon && !faviconFailed ? (
        <img
          src={favicon}
          alt=""
          loading="lazy"
          onError={() => setFaviconFailed(true)}
          className="h-4 w-4 rounded-[3px] object-contain shrink-0"
        />
      ) : (
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
      )}
      <span className="text-[11px] font-semibold text-foreground leading-tight">
        {channel.label}
      </span>
      <Ban className="h-2.5 w-2.5 text-destructive shrink-0" strokeWidth={2.5} aria-label="Prohibido" />
    </span>
  );
}
