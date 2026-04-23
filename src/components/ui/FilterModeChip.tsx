/**
 * FilterModeChip · chip de filtro con modo AND / OR / EXCLUDE.
 *
 * Patrón:
 *   - Click en un chip "off" → pasa a "or" (modo por defecto)
 *   - Click en un chip seleccionado → apaga (vuelve a "off")
 *   - Hover sobre un chip seleccionado → popover negro arriba con
 *     [and] [or] [exclude] para cambiar el modo sin apagarlo
 *
 * El popover se renderiza vía `createPortal` al `document.body` con
 * posición calculada desde el rect del chip — así no lo recorta el
 * contenedor padre cuando el chip está cerca de un borde (drawer con
 * overflow-auto, por ejemplo). También se asegura de no salirse del
 * viewport horizontalmente.
 *
 * Estados visuales del chip:
 *   - off      → card + border normal, gris
 *   - or       → primary (azul) con Check
 *   - and      → primary (azul) con "&"
 *   - exclude  → destructive (rojo) con Minus + line-through
 *
 * Reutilizable en cualquier filtro que acepte 3 modos por opción.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipMode = "off" | "and" | "or" | "exclude";

interface Props {
  label: string;
  /** Dot de color opcional (ej. `bg-warning`). */
  color?: string;
  mode: ChipMode;
  onModeChange: (mode: ChipMode) => void;
  /** Texto del popover en cada modo (para i18n). */
  labels?: { and: string; or: string; exclude: string };
}

const MODE_STYLES: Record<ChipMode, string> = {
  off: "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
  or: "bg-primary/10 border-primary/30 text-primary",
  and: "bg-primary/10 border-primary/30 text-primary",
  exclude: "bg-destructive/10 border-destructive/30 text-destructive line-through decoration-destructive/60",
};

/** Margen mínimo al borde del viewport. */
const EDGE_MARGIN = 8;
/** Ancho aproximado del popover (and · or · exclude). */
const POPOVER_APPROX_WIDTH = 220;

export function FilterModeChip({
  label,
  color,
  mode,
  onModeChange,
  labels = { and: "and", or: "or", exclude: "exclude" },
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [hoverChip, setHoverChip] = useState(false);
  const [hoverPopover, setHoverPopover] = useState(false);
  const showPopover = mode !== "off" && (hoverChip || hoverPopover);

  /* Posición calculada del popover (en coords del viewport, fixed). */
  const [pos, setPos] = useState<{ top: number; left: number; arrowOffset: number } | null>(null);

  useLayoutEffect(() => {
    if (!showPopover || !buttonRef.current) return;
    const update = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = popoverRef.current?.offsetWidth ?? POPOVER_APPROX_WIDTH;
      const popoverHeight = popoverRef.current?.offsetHeight ?? 36;

      // Centro horizontal del chip
      const chipCenterX = rect.left + rect.width / 2;
      // Posición ideal del popover (left = centro - mitad ancho)
      let left = chipCenterX - popoverWidth / 2;

      // Clamping al viewport
      const maxLeft = window.innerWidth - popoverWidth - EDGE_MARGIN;
      const minLeft = EDGE_MARGIN;
      const clampedLeft = Math.max(minLeft, Math.min(left, maxLeft));

      // La flecha debe seguir apuntando al centro del chip aunque
      // hayamos desplazado el popover. Calculamos su offset relativo
      // al popover (en px desde el borde izquierdo del popover).
      const arrowOffset = chipCenterX - clampedLeft;

      // Posición vertical: arriba del chip con un margen de 8px
      const top = rect.top - popoverHeight - 8;

      setPos({ top, left: clampedLeft, arrowOffset });
    };
    update();
    // Recompute al hacer scroll dentro del drawer u otros contenedores
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showPopover]);

  /* Cierre con un pequeño delay para permitir mover el cursor del
   * chip al popover sin que se cierre. */
  const closeTimer = useRef<number | null>(null);
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setHoverChip(false);
      setHoverPopover(false);
    }, 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        cancelClose();
        setHoverChip(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onModeChange(mode === "off" ? "or" : "off")}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors whitespace-nowrap",
          MODE_STYLES[mode],
        )}
      >
        {mode === "and" && <span className="text-[11px] font-bold leading-none">&</span>}
        {mode === "or" && <Check className="h-3 w-3" strokeWidth={3} />}
        {mode === "exclude" && <Minus className="h-3 w-3" strokeWidth={3} />}
        {color && (
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              color,
              mode === "exclude" && "opacity-50",
            )}
          />
        )}
        {label}
      </button>

      {showPopover && pos &&
        createPortal(
          <div
            ref={popoverRef}
            data-filter-mode-popover
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
            onMouseEnter={() => {
              cancelClose();
              setHoverPopover(true);
            }}
            onMouseLeave={scheduleClose}
          >
            <div className="bg-foreground text-background rounded-full p-1 shadow-soft-lg inline-flex items-center gap-0.5 text-[12.5px] whitespace-nowrap">
              <ModeButton active={mode === "and"} onClick={() => onModeChange("and")}>
                {labels.and}
              </ModeButton>
              <ModeButton active={mode === "or"} onClick={() => onModeChange("or")}>
                {labels.or}
              </ModeButton>
              <ModeButton active={mode === "exclude"} onClick={() => onModeChange("exclude")}>
                {labels.exclude}
              </ModeButton>
            </div>
            {/* Flechita apuntando al centro del chip (offset dinámico). */}
            <div
              aria-hidden
              style={{ left: pos.arrowOffset }}
              className="absolute -bottom-1 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-foreground"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-full transition-colors font-medium",
        active
          ? "bg-background/15 text-background"
          : "text-background/70 hover:bg-background/10 hover:text-background",
      )}
    >
      {children}
    </button>
  );
}
