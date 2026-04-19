/**
 * BrandLogo · marca Byvaro unificada.
 *
 * Dos variantes:
 *   - "icon"     → isotipo cuadrado (byvaro-icon.svg), 360×360 viewBox.
 *                  Usar en avatars, favicons, esquinas pequeñas.
 *   - "wordmark" → logotipo horizontal (byvaro-logo.svg), 935×243 viewBox.
 *                  Usar en headers, splash de login, footers.
 *   - "lockup"   → icon + wordmark juntos (sidebar, mobile header).
 *
 * Dependencias:
 *   - `src/assets/byvaro-icon.svg`  (Vite resuelve como URL al build)
 *   - `src/assets/byvaro-logo.svg`  (ídem)
 *   - `@/lib/utils` → helper `cn` para componer clases Tailwind.
 *
 * Las SVG vienen con color `#1D74E7` hardcoded (color primario Byvaro).
 * Si necesitas cambiar el tinte, usa `filter` en CSS o reemplaza el SVG
 * por una versión con `currentColor`.
 *
 * Uso:
 *   <BrandLogo variant="lockup" />
 *   <BrandLogo variant="icon" className="h-8 w-8 rounded-xl" />
 *   <BrandLogo variant="wordmark" className="h-5" />
 */

import byvaroIcon from "@/assets/byvaro-icon.svg";
import byvaroWordmark from "@/assets/byvaro-logo.svg";
import { cn } from "@/lib/utils";

type Variant = "icon" | "wordmark" | "lockup";

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  /** solo aplica a `icon` y `lockup`: tamaño del cuadrado (default 32px) */
  iconSize?: number;
  /** solo aplica a `wordmark` y `lockup`: alto del wordmark (default 18px) */
  wordmarkHeight?: number;
}

export function BrandLogo({
  variant = "lockup",
  className,
  iconSize = 32,
  wordmarkHeight = 18,
}: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <img
        src={byvaroIcon}
        alt="Byvaro"
        width={iconSize}
        height={iconSize}
        className={cn("shrink-0", className)}
      />
    );
  }

  if (variant === "wordmark") {
    return (
      <img
        src={byvaroWordmark}
        alt="Byvaro"
        height={wordmarkHeight}
        className={cn("shrink-0", className)}
        style={{ height: wordmarkHeight }}
      />
    );
  }

  // lockup
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={byvaroIcon}
        alt=""
        aria-hidden="true"
        width={iconSize}
        height={iconSize}
        className="shrink-0 rounded-xl"
      />
      <img
        src={byvaroWordmark}
        alt="Byvaro"
        className="shrink-0"
        style={{ height: wordmarkHeight }}
      />
    </div>
  );
}
