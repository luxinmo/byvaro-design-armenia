/**
 * OriginsPill — pill compacto para listado de contactos.
 *
 *   "Idealista" · si solo tiene 1 canal
 *   "Idealista +2" · si tiene 3 canales en total
 *
 * Tooltip con los últimos 3 orígenes. Click no hace nada · es solo
 * info.
 */

import { cn } from "@/lib/utils";
import { distinctChannelCount } from "@/lib/contactOrigins";
import type { Contact } from "./types";

export function OriginsPill({ contact, className }: { contact: Contact; className?: string }) {
  const distinct = distinctChannelCount(contact);
  const primary = contact.primarySource;
  if (!primary) return null;

  const extra = distinct > 1 ? distinct - 1 : 0;
  /* Tooltip: últimos 3 orígenes (más recientes) por fecha desc. */
  const recent = [...contact.origins]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 3);
  const tooltip = recent.map((o) => `${o.label} · ${new Date(o.occurredAt).toLocaleDateString("es-ES")}`).join("\n");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/50 text-muted-foreground text-[10.5px] font-medium px-2 h-5 max-w-[160px]",
        className,
      )}
      title={tooltip}
    >
      <span className="truncate">{primary.label}</span>
      {extra > 0 && (
        <span className="text-foreground/70 font-semibold tabular-nums shrink-0">+{extra}</span>
      )}
    </span>
  );
}
