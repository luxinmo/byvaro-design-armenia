/**
 * MarketingRulesSidebarCard · tarjeta en el RAIL derecho de la ficha,
 * debajo de "Acciones rápidas". Sustituye al banner prominente y al
 * pill del header.
 *
 * Comportamiento:
 *   · Sin configurar · anillo primary con `animate-pulse` + badge
 *     "Nuevo" · microdescripción invitando al promotor a configurar.
 *   · Configurado · estado estático · sin animación · muestra el
 *     resumen actual (todo permitido / N prohibidos / solo uso
 *     interno). La animación nunca vuelve.
 *
 * "Configurado" se marca cuando el promotor:
 *   1. Pulsa Guardar en el dialog, O
 *   2. Pulsa "Permitir todo" en el dialog, O
 *   3. Pulsa "Prohibir todo" en el dialog.
 *
 * Los tres caminos llaman a `setMarketingConfigured(id, true)` desde
 * `MarketingRulesDialog`. La lectura reactiva se hace con
 * `useMarketingConfigured(id)`.
 *
 * La agencia NO ve esta card (readOnly oculto) · ella tiene
 * `MarketingRulesCard` en el contenido principal.
 */

import { Megaphone, ArrowRight, CheckCircle2, ShieldAlert, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMarketingProhibitions,
  useMarketingConfigured,
} from "@/lib/marketingRulesStorage";
import { TOTAL_CHANNELS } from "@/lib/marketingChannels";

interface Props {
  promotionId: string;
  onEdit: () => void;
  className?: string;
}

export function MarketingRulesSidebarCard({ promotionId, onEdit, className }: Props) {
  const prohibitedIds = useMarketingProhibitions(promotionId);
  const configured = useMarketingConfigured(promotionId);
  const hasAny = prohibitedIds.length > 0;
  const allProhibited = prohibitedIds.length === TOTAL_CHANNELS;

  /* Cuatro estados:
   *   · unconfigured · primera vez · llamada de atención animada.
   *   · none  · configurado + nada prohibido (verde sobrio).
   *   · some  · configurado + N prohibidos (ámbar sobrio).
   *   · all   · configurado + todo prohibido / solo uso interno. */
  const state: "unconfigured" | "none" | "some" | "all" =
    !configured ? "unconfigured"
    : allProhibited ? "all"
    : hasAny ? "some"
    : "none";

  /* Clases por estado · sin colores saturados salvo la animación de
   * primera vez (ring primary pulsando). Los estados configurados
   * llevan un tono sutil de acento para marcar el resultado. */
  const wrapCls = (() => {
    switch (state) {
      case "unconfigured":
        return "border-primary/30 bg-card hover:border-primary/50 ring-2 ring-primary/30 animate-pulse";
      case "all":
        return "border-border bg-card hover:border-destructive/30";
      case "some":
        return "border-border bg-card hover:border-warning/30";
      case "none":
      default:
        return "border-border bg-card hover:border-success/30";
    }
  })();

  const iconBoxCls = (() => {
    switch (state) {
      case "unconfigured": return "bg-primary/10 text-primary";
      case "all":          return "bg-destructive/10 text-destructive";
      case "some":         return "bg-warning/10 text-warning";
      case "none":
      default:             return "bg-success/10 text-success";
    }
  })();

  const Icon = (() => {
    switch (state) {
      case "unconfigured": return Megaphone;
      case "all":          return Lock;
      case "some":         return ShieldAlert;
      case "none":
      default:             return CheckCircle2;
    }
  })();

  const title = (() => {
    switch (state) {
      case "unconfigured": return "Reglas de marketing";
      case "all":          return "Solo uso interno";
      case "some":         return `${prohibitedIds.length} canal${prohibitedIds.length === 1 ? "" : "es"} prohibido${prohibitedIds.length === 1 ? "" : "s"}`;
      case "none":
      default:             return "Marketing libre";
    }
  })();

  const description = (() => {
    switch (state) {
      case "unconfigured": return "Define dónde pueden o no publicar las agencias.";
      case "all":          return "Ningún canal externo permitido.";
      case "some":         return `${TOTAL_CHANNELS - prohibitedIds.length} permitidos · ${prohibitedIds.length} bloqueados.`;
      case "none":
      default:             return "Permitido en portales y redes.";
    }
  })();

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "group w-full rounded-2xl border shadow-soft transition-all text-left",
        "hover:shadow-soft-lg",
        wrapCls,
        className,
      )}
      aria-label={state === "unconfigured" ? "Configurar reglas de marketing" : "Editar reglas de marketing"}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            iconBoxCls,
          )}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[12.5px] font-semibold text-foreground leading-tight">
                {title}
              </p>
              {state === "unconfigured" && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-primary text-primary-foreground px-1.5 py-0.5">
                  <Sparkles className="h-2 w-2" strokeWidth={2.5} />
                  Nuevo
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {description}
            </p>
          </div>
          <ArrowRight
            className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:text-foreground transition-all"
            strokeWidth={2}
          />
        </div>
      </div>
    </button>
  );
}
