/**
 * PromocionesMap · vista de mapa para /promociones
 *
 * Usa Leaflet + OpenStreetMap. Markers por promoción con popup con datos.
 * Layout: mapa a la izquierda 2/3, sidebar scrollable con cards a la derecha 1/3.
 *
 * Para el prototipo, las coordenadas de las promociones se derivan del campo
 * `location` (ej. "Marbella, Costa del Sol") usando un diccionario hardcoded
 * con las ciudades españolas más comunes. En producción, esto debería venir
 * del backend como campos `lat` y `lng` geocodificados.
 */

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, ArrowUpRight, Flame } from "lucide-react";
import type { DevPromotion } from "@/data/developerPromotions";
import { cn } from "@/lib/utils";

/* ─── Geocodificador mock: ciudad → [lat, lng] ─── */
const cityCoords: Record<string, [number, number]> = {
  "Marbella": [36.5099, -4.8825],
  "Altea": [38.5987, -0.0532],
  "Jávea": [38.7902, 0.1654],
  "Finestrat": [38.5670, -0.2188],
  "Mijas": [36.5951, -4.6372],
  "Valencia": [39.4699, -0.3763],
  "Alicante": [38.3452, -0.4810],
  "Madrid": [40.4168, -3.7038],
  "Barcelona": [41.3851, 2.1734],
  "Sevilla": [37.3891, -5.9845],
  "Málaga": [36.7213, -4.4214],
  "Benidorm": [38.5342, -0.1317],
  "Estepona": [36.4263, -5.1450],
  "Costa del Sol": [36.5099, -4.8825],
  "Costa Blanca": [38.3452, -0.4810],
};

function resolveCoords(location: string): [number, number] | null {
  for (const key of Object.keys(cityCoords)) {
    if (location.toLowerCase().includes(key.toLowerCase())) return cityCoords[key];
  }
  return null;
}

/* ─── Icono personalizado Byvaro (div con CSS) ─── */
function makeBrandedIcon(highlight = false): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:34px;height:34px;
        background:${highlight ? "linear-gradient(135deg,#f97316,#ef4444)" : "hsl(215 72% 55%)"};
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 4px 12px rgba(0,0,0,0.15);
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="transform:rotate(45deg);color:white;font-weight:700;font-size:11px;">🏠</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

/* ─── Auto-fit bounds a los markers visibles ─── */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [points.join(","), map]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
export function PromocionesMap({ promotions: promos }: { promotions: DevPromotion[] }) {
  // Cada promo con sus coordenadas (filtra las que no resuelven)
  const geoPromos = useMemo(() => {
    return promos
      .map(p => ({ promo: p, coords: resolveCoords(p.location) }))
      .filter((x): x is { promo: DevPromotion; coords: [number, number] } => x.coords !== null);
  }, [promos]);

  const points = geoPromos.map(g => g.coords);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-280px)] min-h-[560px]">
      {/* Mapa */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
        <MapContainer
          center={[40.0, -3.5]}
          zoom={6}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {geoPromos.map(({ promo, coords }) => {
            const trending = (promo.activity?.trend ?? 0) >= 50;
            return (
              <Marker
                key={promo.id}
                position={coords}
                icon={makeBrandedIcon(trending)}
              >
                <Popup>
                  <div className="w-[260px] -m-[10px]">
                    {/* Imagen de portada */}
                    {promo.image && (
                      <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                        <img
                          src={promo.image}
                          alt={promo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {trending && (
                          <span
                            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white"
                            style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
                          >
                            <Flame className="h-2.5 w-2.5" /> Trending
                          </span>
                        )}
                        {promo.badge && (
                          <span className="absolute top-2 left-2 bg-white/95 backdrop-blur text-[9px] font-bold uppercase tracking-wider text-gray-900 px-2 py-0.5 rounded-full shadow">
                            {promo.badge === "new" ? "Nueva" : "Últimas"}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Contenido */}
                    <div className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 m-0">
                        {promo.location}
                      </p>
                      <h3 className="text-sm font-bold text-gray-900 mt-0.5 m-0">{promo.name}</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 mb-2 m-0">
                        {promo.developer} · Entrega {promo.delivery}
                      </p>
                      <p className="text-sm font-bold text-gray-900 m-0">
                        {formatPrice(promo.priceMin)}
                        {promo.priceMax > promo.priceMin && (
                          <span className="text-gray-400 font-normal">
                            {" — "}
                            {formatPrice(promo.priceMax)}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                        <span><span className="font-semibold text-gray-900">{promo.availableUnits}/{promo.totalUnits}</span> dispon.</span>
                        <span><span className="font-semibold text-gray-900">{promo.commission}%</span> com.</span>
                        {promo.constructionProgress !== undefined && (
                          <span><span className="font-semibold text-gray-900">{promo.constructionProgress}%</span> obra</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Overlay con contador */}
        <div className="absolute top-3 left-3 bg-card border border-border rounded-full px-3 py-1.5 shadow-soft flex items-center gap-1.5 text-xs font-medium z-[400]">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="tnum"><span className="font-bold">{geoPromos.length}</span> en el mapa</span>
          {promos.length > geoPromos.length && (
            <span className="text-muted-foreground">· {promos.length - geoPromos.length} sin coordenadas</span>
          )}
        </div>
      </div>

      {/* Sidebar con lista */}
      <aside className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden flex flex-col">
        <header className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Promociones en vista</h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">{geoPromos.length} resultados</p>
        </header>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {geoPromos.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted-foreground">
              Sin resultados con ubicación en el mapa.
            </div>
          ) : (
            geoPromos.map(({ promo }) => {
              const trending = (promo.activity?.trend ?? 0) >= 50;
              return (
                <article
                  key={promo.id}
                  className={cn(
                    "group flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer",
                    trending && "bg-warning/30"
                  )}
                >
                  <div
                    className="h-14 w-14 rounded-xl bg-cover bg-center ring-1 ring-border/60 shrink-0"
                    style={{ backgroundImage: promo.image ? `url(${promo.image})` : undefined }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
                        {promo.location}
                      </p>
                      {trending && (
                        <Flame className="h-3 w-3 text-orange-500 shrink-0" />
                      )}
                    </div>
                    <h4 className="text-[13px] font-semibold truncate">{promo.name}</h4>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      Desde {formatPrice(promo.priceMin)} · {promo.commission}% comisión
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
