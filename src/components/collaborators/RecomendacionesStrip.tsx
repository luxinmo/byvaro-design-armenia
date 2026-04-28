/**
 * RecomendacionesStrip · bloque de "Byvaro te sugiere" en
 * `/colaboradores`.
 *
 * Strip horizontal con las agencias que el motor de Byvaro recomienda
 * al promotor · agencias activas en sus zonas con buen track record con
 * las que todavía no colabora.
 *
 * ⚠️ Privacidad: los números son agregados. Nunca identificamos a
 * otros promotores detrás de las métricas.
 *
 * TODO(backend): `GET /api/colaboradores/recomendaciones` — ver
 * `docs/backend-integration.md` §4.1.
 */

import { Sparkles, Star, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { RecommendedAgency } from "@/data/agencyRecommendations";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";

export function RecomendacionesStrip({
  items, onInvitar,
}: {
  items: RecommendedAgency[];
  /** Abre el flujo de invitación con la agencia sugerida como contexto. */
  onInvitar: (rec: RecommendedAgency) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-8 mt-8">
      <div className="max-w-content mx-auto">
        <header className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
              Byvaro te sugiere
            </p>
            <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
              Agencias activas en tu zona con buen track record
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[640px]">
              Basado en tus promociones, las nacionalidades que captas y la
              actividad agregada en Byvaro. Nunca se identifica a otros
              promotores.
            </p>
          </div>
        </header>

        <div className="relative -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-6 lg:px-8 pb-2">
            <ul className="flex gap-3 snap-x snap-mandatory">
              {items.map((rec) => (
                <li key={rec.id} className="shrink-0 w-[280px] snap-start">
                  <Card rec={rec} onInvitar={() => onInvitar(rec)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ rec, onInvitar }: { rec: RecommendedAgency; onInvitar: () => void }) {
  return (
    <article className="h-full rounded-2xl border border-border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col">
      {/* Header · logo + nombre + rating */}
      <div className="flex items-start gap-3">
        <img
          src={rec.logo}
          alt=""
          className="h-11 w-11 rounded-xl bg-muted shrink-0 object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-foreground leading-tight truncate">
            {rec.name}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{rec.location}</p>
        </div>
        {rec.googleRating != null && (
          <span className="inline-flex items-center gap-0.5 shrink-0 text-[11px] font-semibold text-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
            <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={0} />
            {rec.googleRating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Mercados + tipo */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {rec.mercados.slice(0, 4).map((m) => (
          <Flag key={m} iso={m} size={14} shape="rect" title={m} />
        ))}
        {rec.mercados.length > 4 && (
          <span className="text-[10px] text-muted-foreground font-medium">+{rec.mercados.length - 4}</span>
        )}
        <span className="ml-auto text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {rec.type === "Agency" ? "Agencia" : rec.type === "Broker" ? "Broker" : "Red"}
        </span>
      </div>

      {/* Razón principal */}
      <p className="mt-3 text-[12.5px] font-medium text-foreground leading-snug">
        {rec.razon}
      </p>

      {/* Señales · pills */}
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        <Pill icon={ShieldCheck}>{rec.signal.aprobacionPct}% apr.</Pill>
        <Pill icon={TrendingUp}>{rec.signal.conversionPct}% conv.</Pill>
        <Pill icon={Users}>{rec.signal.promotoresActivos} promotores</Pill>
      </div>

      {/* Spacer + CTA */}
      <div className="flex-1" />
      <button
        onClick={onInvitar}
        className="mt-3 w-full h-9 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
      >
        Invitar a colaborar
      </button>
    </article>
  );
}

function Pill({
  icon: Icon, children,
}: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground",
      "bg-muted rounded-full px-2 py-0.5",
    )}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.25} />
      {children}
    </span>
  );
}
