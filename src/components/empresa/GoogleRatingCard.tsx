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

/* Validación mínima de URL de Google Maps · permisivo a propósito.
 *  Acepta `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`,
 *  `goo.gl/maps`. El backend valida en serio cuando llegue. */
function isPlausibleMapsUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const u = url.toLowerCase().trim();
  if (!/^https?:\/\//.test(u)) return false;
  return /google\./.test(u) || /goo\.gl/.test(u);
}

/* Hash determinístico string → int para generar rating mock
 *  reproducible (la misma URL devuelve siempre los mismos valores). */
function hashStringToInt(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
                          filled ? "fill-warning text-warning" : "text-muted-foreground/30",
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

        {/* Modo edición · input + botón Conectar + Desactivar.
            El click "Conectar" simula el fetch del backend (en mock
            genera rating/total deterministic desde la URL · al
            conectar real, el endpoint hace request a Google Places
            API y devuelve los valores reales). */}
        {viewMode === "edit" && (
          <div className="mt-3 space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              Enlace a tu ficha Google Maps
            </label>
            <div className="flex gap-2">
              <input
                id="google-maps-url-input"
                type="url"
                value={empresa.googleMapsUrl}
                onChange={(e) => update("googleMapsUrl", e.target.value)}
                placeholder="Pega aquí el enlace de tu ficha"
                className="flex-1 min-w-0 h-9 px-3 text-xs bg-background border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60"
              />
              {/* Botón SIEMPRE visible · disabled si el input está
                  vacío. */}
              <button
                type="button"
                disabled={!empresa.googleMapsUrl?.trim()}
                onClick={() => {
                  /* MOCK · usamos los valores del seed (4.7 · 312
                   *  reseñas) para que el demo refleje tu Google real
                   *  sin tener que parsear nada.
                   *  TODO(backend): POST /api/empresa/google-place
                   *    { mapsUrl } · resolverá place_id real, hará
                   *    fetch a Places API y devolverá los valores
                   *    actualizados. Cron semanal refresca rating. */
                  const seed = hashStringToInt(empresa.googleMapsUrl);
                  update("googlePlaceId", `MOCK_${seed.toString(36)}`);
                  update("googleRating", 4.7);
                  update("googleRatingsTotal", 312);
                  update("googleFetchedAt", new Date().toISOString());
                }}
                className="h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Conectar
              </button>
            </div>
            <details className="group">
              <summary className="text-[11px] text-primary hover:underline cursor-pointer list-none inline-flex items-center gap-1">
                <span className="group-open:hidden">¿Cómo obtengo el enlace?</span>
                <span className="hidden group-open:inline">Ocultar pasos</span>
              </summary>
              <ol className="mt-2 ml-4 text-[11px] text-muted-foreground leading-relaxed list-decimal space-y-0.5">
                <li>Abre <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="underline hover:text-foreground">Google Maps</a> y busca tu empresa.</li>
                <li>Pulsa en el botón <b>Compartir</b>.</li>
                <li>Copia el enlace y pégalo arriba.</li>
              </ol>
            </details>
            {(empresa.googleRating > 0 || empresa.googlePlaceId) && (
              <button
                type="button"
                onClick={() => {
                  /* TODO(backend): DELETE /api/empresa/google-place */
                  update("googleMapsUrl", "");
                  update("googlePlaceId", "");
                  update("googleRating", 0);
                  update("googleRatingsTotal", 0);
                  update("googleFetchedAt", "");
                }}
                className="text-[11px] text-destructive/80 hover:text-destructive hover:underline transition-colors"
              >
                Desactivar conexión
              </button>
            )}
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
              Refrescamos los datos automáticamente cada semana desde Google.
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
