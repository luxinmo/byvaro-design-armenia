/**
 * OriginsList — lista cronológica de orígenes acumulados de un Contact.
 *
 * Reemplaza la idea de "un solo source" con una narrativa rica: cómo
 * llegó este contacto, cuántos canales lo trajeron, cuándo. Va en el
 * tab Resumen de la ficha de contacto.
 */

import {
  Building2, Globe, Phone, MessageCircle, MapPin, Mail,
  Handshake, Upload, Sparkles, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Contact, ContactOrigin } from "./types";

const ICON_BY_SOURCE: Record<ContactOrigin["source"], React.ComponentType<{ className?: string }>> = {
  idealista:    Building2,
  fotocasa:     Building2,
  habitaclia:   Building2,
  microsite:    Globe,
  referral:     Sparkles,
  agency:       Handshake,
  whatsapp:     MessageCircle,
  walkin:       MapPin,
  call:         Phone,
  registration: Handshake,
  import:       Upload,
  direct:       Mail,
};

export function OriginsList({ contact, className }: { contact: Contact; className?: string }) {
  const sorted = [...contact.origins].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  if (sorted.length === 0) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const distinctChannels = new Set(sorted.map((o) => o.source)).size;

  /* Días entre primer y último contacto · solo si hay más de uno. */
  const span = sorted.length > 1
    ? Math.floor(
        (new Date(last.occurredAt).getTime() - new Date(first.occurredAt).getTime())
        / (1000 * 60 * 60 * 24),
      )
    : 0;

  return (
    <section className={cn(
      "rounded-2xl border border-border bg-card p-4 sm:p-5",
      className,
    )}>
      <header className="flex items-center gap-2.5 mb-4">
        <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            Cómo nos conoció
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sorted.length === 1
              ? "1 canal"
              : `${distinctChannels} canal${distinctChannels === 1 ? "" : "es"} · ${span} día${span === 1 ? "" : "s"} entre primer y último contacto`}
          </p>
        </div>
      </header>

      <ol className="space-y-2">
        {sorted.map((o, idx) => {
          const Icon = ICON_BY_SOURCE[o.source] ?? Mail;
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;
          return (
            <li
              key={`${o.source}-${o.occurredAt}-${idx}`}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5"
            >
              <span className="h-7 w-7 rounded-lg bg-card border border-border/50 text-muted-foreground grid place-items-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] tabular-nums text-muted-foreground/70 font-medium">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground truncate">
                    {o.label}
                  </span>
                  {isFirst && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
                      Primer contacto
                    </span>
                  )}
                  {isLast && !isFirst && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 text-success text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
                      Último
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(o.occurredAt), "d MMM yyyy", { locale: es })}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
