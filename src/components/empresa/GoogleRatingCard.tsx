/**
 * GoogleRatingCard · muestra el rating de Google Business de la empresa.
 *
 * Los datos vienen del modelo `Empresa`:
 *   - googlePlaceId
 *   - googleRating (0-5)
 *   - googleRatingsTotal
 *   - googleFetchedAt (ISO)
 *   - googleMapsUrl
 *
 * En modo edit, el promotor pega la URL de su ficha de Google Maps. El
 * backend extrae el `place_id` y dispara el primer fetch. En modo view,
 * solo mostramos el rating + atribución obligatoria "Basado en reseñas
 * de Google" (requerido por los ToS de Places API).
 *
 * TODO(backend):
 *   POST /api/empresa/google-place  { mapsUrl } → { placeId, ... }
 *   GET  /api/empresa/google-refresh → cron semanal (respetar TTL 30d ToS)
 */
import { Star, MapPin, RefreshCw, ArrowUpRight } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

interface Props {
  empresa: Empresa;
  viewMode: "edit" | "preview";
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}

function relativeDays(iso: string): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff < 7) return `hace ${diff} días`;
  if (diff < 30) return `hace ${Math.round(diff / 7)} sem`;
  return `hace ${Math.round(diff / 30)} meses`;
}

export function GoogleRatingCard({ empresa, viewMode, update }: Props) {
  const hasRating = empresa.googleRating > 0;
  const connected = !!empresa.googlePlaceId;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className="px-4 sm:px-5 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Reseñas de Google
          </p>
          <h3 className="text-sm font-semibold text-foreground leading-tight mt-0.5">
            Rating público de tu ficha Google Business
          </h3>
        </div>
        {connected && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
            Actualizado {relativeDays(empresa.googleFetchedAt)}
          </span>
        )}
      </header>

      <div className="px-4 sm:px-5 pb-4">
        {hasRating ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border">
                <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                  {empresa.googleRating.toFixed(1)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const filled = i <= Math.round(empresa.googleRating);
                    return (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4",
                          filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                        )}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {empresa.googleRatingsTotal.toLocaleString("es-ES")}{" "}
                  {empresa.googleRatingsTotal === 1 ? "reseña" : "reseñas"}
                </p>
              </div>
            </div>

            {empresa.googleMapsUrl && (
              <a
                href={empresa.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MapPin className="h-3 w-3" strokeWidth={1.75} />
                Ver en Google Maps
                <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Sin ficha conectada</p>
            <p className="text-[11px] text-muted-foreground/80">
              Pega la URL de tu ficha de Google Maps para mostrar el rating público
              junto a tu perfil y en emails a colaboradores.
            </p>
          </div>
        )}

        {/* Modo edición: input para pegar la URL de Maps */}
        {viewMode === "edit" && (
          <div className="mt-3 space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              URL de tu ficha Google Maps
            </label>
            <input
              type="url"
              value={empresa.googleMapsUrl}
              onChange={(e) => update("googleMapsUrl", e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60"
            />
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
              Al guardar, el sistema resolverá el <code className="px-1 rounded bg-muted">place_id</code> y
              traerá el rating y el nº de reseñas automáticamente. Se refresca cada semana.
            </p>
          </div>
        )}

        {/* Atribución obligatoria (ToS Google Places API) */}
        {hasRating && (
          <p className="mt-3 text-[10px] text-muted-foreground/70">
            Basado en reseñas públicas de Google. Actualizado automáticamente.
          </p>
        )}
      </div>
    </section>
  );
}
