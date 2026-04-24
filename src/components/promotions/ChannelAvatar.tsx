/**
 * ChannelAvatar · avatar de un canal de marketing con favicon real +
 * fallback al icono Lucide del catálogo. Se usa en MarketingRulesDialog,
 * MarketingRulesCard y MarketingRulesSidebarCard.
 *
 * Estados visuales:
 *   · prohibited=false · fondo muted, favicon en color original.
 *   · prohibited=true  · overlay rojo translúcido + icono Ban encima
 *                        del favicon (el promotor lo ve como
 *                        "tachado") · mantenemos el favicon visible
 *                        para que el canal siga reconocible.
 *
 * Manejo de carga · onError de la <img> oculta el favicon y deja
 * visible solo el icono Lucide (ya renderizado debajo). Así nunca
 * se ve un avatar vacío aunque Google Favicons falle.
 */

import { useState } from "react";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { channelFaviconUrl, type MarketingChannel } from "@/lib/marketingChannels";

interface Props {
  channel: MarketingChannel;
  prohibited?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props["size"]>, { wrap: string; icon: string; ban: string; px: number }> = {
  sm: { wrap: "h-7 w-7 rounded-lg",    icon: "h-3.5 w-3.5", ban: "h-3 w-3",     px: 32 },
  md: { wrap: "h-9 w-9 rounded-xl",    icon: "h-4 w-4",     ban: "h-3.5 w-3.5", px: 48 },
  lg: { wrap: "h-12 w-12 rounded-xl",  icon: "h-5 w-5",     ban: "h-4 w-4",     px: 64 },
};

export function ChannelAvatar({ channel, prohibited = false, size = "md", className }: Props) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const s = SIZE_CLASSES[size];
  const favicon = channelFaviconUrl(channel, s.px);
  const Icon = channel.icon;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 overflow-hidden border",
        s.wrap,
        prohibited
          ? "bg-destructive/10 border-destructive/30"
          : "bg-card border-border",
        className,
      )}
      aria-hidden
    >
      {/* Icono Lucide base · siempre montado · visible si falla el favicon */}
      <Icon
        className={cn(
          s.icon,
          prohibited ? "text-destructive/60" : "text-muted-foreground/70",
        )}
        strokeWidth={1.75}
      />

      {/* Favicon real encima · se oculta on-error */}
      {favicon && !faviconFailed && (
        <img
          src={favicon}
          alt=""
          loading="lazy"
          onError={() => setFaviconFailed(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-contain p-1.5",
            prohibited && "opacity-60",
          )}
        />
      )}

      {/* Overlay de prohibición · icono Ban pegado esquina inferior derecha */}
      {prohibited && (
        <span className="absolute -bottom-0.5 -right-0.5 bg-destructive rounded-full p-0.5 shadow-sm">
          <Ban className={cn(s.ban, "text-white")} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}
