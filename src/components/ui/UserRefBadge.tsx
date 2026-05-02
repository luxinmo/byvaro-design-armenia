/**
 * UserRefBadge · muestra la public_ref de un usuario con icono lock
 * (inmutable) + botón copiar al portapapeles.
 *
 * Uso · `<UserRefBadge userId={member.id} />` o
 *       `<UserRefBadge ref="US1234567" />` cuando ya tienes la ref.
 *
 * Aspecto · pill compacta con tracking-wider y formato visual
 * `US·123·4567` para legibilidad humana. El valor canónico (sin
 * separador) es lo que se copia al portapapeles · listo para
 * pegarse en URLs, búsquedas y emails.
 */

import { useState } from "react";
import { Lock, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useUserPublicRef, formatUserRef } from "@/lib/userPublicRef";
import { cn } from "@/lib/utils";

interface Props {
  /** Si tienes el userId (UUID), pulla la ref del cache. */
  userId?: string | null;
  /** Si ya tienes la ref pública, pásala directamente. */
  ref?: string | null;
  /** Clases adicionales al wrapper. */
  className?: string;
  /** "sm" más compacto · "md" default. */
  size?: "sm" | "md";
}

export function UserRefBadge({ userId, ref, className, size = "md" }: Props) {
  const fromHook = useUserPublicRef(userId ?? null);
  const value = ref ?? fromHook;
  const [copied, setCopied] = useState(false);

  if (!value) return null;
  const display = formatUserRef(value);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Referencia copiada", { description: value });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Referencia pública del usuario · clic para copiar · inmutable"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors group",
        size === "sm"
          ? "h-6 px-2 text-[10px]"
          : "h-7 px-2.5 text-[11px]",
        className,
      )}
    >
      <Lock className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", "text-muted-foreground/70 shrink-0")} />
      <span className="font-mono font-semibold text-foreground/80 tracking-wider tabular-nums">
        {display}
      </span>
      {copied
        ? <Check className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", "text-success shrink-0")} />
        : <Copy className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", "text-muted-foreground/50 group-hover:text-foreground/70 shrink-0")} />}
    </button>
  );
}
