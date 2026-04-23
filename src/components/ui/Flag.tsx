/**
 * Flag · bandera de un país (SVG) o globo mundial de fallback.
 *
 * Reemplaza los emojis `🇪🇸` por SVG servidos desde `/public/flags/`.
 * Ver `src/lib/flags.ts` para el resolver.
 *
 * Uso:
 *   <Flag iso="ES" size={16} />
 *   <Flag iso={null} />      // muestra globo (🌐)
 *   <Flag iso="kz" size={20} title="Kazajistán" />
 */

import { Globe } from "lucide-react";
import { flagUrl, normalizeIso } from "@/lib/flags";
import { cn } from "@/lib/utils";

type Props = {
  iso?: string | null;
  size?: number;
  className?: string;
  title?: string;
  /** Forma · default "rect" (4:3). `circle` recorta circular. */
  shape?: "rect" | "circle";
};

export function Flag({
  iso, size = 16, className, title, shape = "rect",
}: Props) {
  const normalized = normalizeIso(iso);
  const url = normalized ? flagUrl(normalized) : "";

  if (!normalized) {
    return (
      <span
        role="img"
        aria-label={title ?? "Sin país asignado"}
        title={title ?? "Sin país asignado"}
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground/70 shrink-0",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Globe className="h-full w-full" strokeWidth={1.75} />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      title={title ?? normalized.toUpperCase()}
      className={cn(
        "inline-block shrink-0 object-cover",
        shape === "circle" ? "rounded-full" : "rounded-[2px]",
        /* Sombra fina para separar del fondo cuando el país tiene blanco dominante. */
        "ring-1 ring-black/5",
        className,
      )}
      style={{
        width: size,
        height: shape === "circle" ? size : Math.round(size * 0.72),
      }}
      loading="lazy"
      draggable={false}
    />
  );
}
