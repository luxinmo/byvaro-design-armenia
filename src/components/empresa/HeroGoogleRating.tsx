/**
 * HeroGoogleRating · pill compacto con el rating de Google Business
 * para colocar inline al lado del nombre de la empresa en el hero.
 *
 * Sustituye al `<GoogleRatingCard>` grande del body cuando hay rating
 * conectado · si no hay rating, no se renderiza (la CTA de añadirlo
 * vive en el sidebar bajo "Fuerza del perfil"
 * — `<GoogleRatingMissingCard>`).
 *
 * Atribución obligatoria · click abre la URL de la ficha pública de
 * Google Maps · cumple Google Places ToS (link al producto que
 * proporciona los datos).
 */

import { Star, ArrowUpRight } from "lucide-react";
import type { Empresa } from "@/lib/empresa";

export function HeroGoogleRating({ empresa }: { empresa: Empresa }) {
  if (!empresa.googleRating || empresa.googleRating <= 0) return null;

  const rating = empresa.googleRating.toFixed(1);
  const total = empresa.googleRatingsTotal.toLocaleString("es-ES");
  const url = empresa.googleMapsUrl;

  const inner = (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors">
      <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={1.5} />
      <span className="tabular-nums font-semibold">{rating}</span>
      <span className="text-muted-foreground tabular-nums">· {total} {empresa.googleRatingsTotal === 1 ? "reseña" : "reseñas"}</span>
      {url && <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground/70" strokeWidth={1.75} />}
    </span>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" title="Ver ficha en Google Maps">
      {inner}
    </a>
  ) : inner;
}
