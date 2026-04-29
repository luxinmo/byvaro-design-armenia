/**
 * ColaboradoresMap · vista de mapa para `/colaboradores` (Inmobiliarias).
 *
 * Mirror estructural de `PromocionesMap` (mismo grid: mapa 2/3 +
 * sidebar 1/3, mismos tokens visuales, mismo overlay con contador).
 * Cambia: el dato es `Agency`, los markers usan el logo / iniciales
 * de la agencia, el popup muestra KPIs operativos (registros · ventas
 * · oficinas · rating) y el sidebar lista a las agencias visibles
 * con click → ficha o panel según `agencyHref()`.
 *
 * Geocoder mock · diccionario `cityCoords` con las ciudades de los
 * seeds (`src/data/agencies.ts`). En backend real cada `Agency` traerá
 * `lat`/`lng` desde el endpoint público o se derivará vía Google
 * Places · esta resolución por string desaparece.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, ArrowUpRight, Star, Building2, TrendingUp } from "lucide-react";
import { type Agency } from "@/data/agencies";
import { agencyHref } from "@/lib/agencyNavigation";
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cn } from "@/lib/utils";

/* ─── Geocodificador mock: ciudad / país → [lat, lng] ─── */
const cityCoords: Record<string, [number, number]> = {
  // España
  "Marbella":   [36.5099, -4.8825],
  "Estepona":   [36.4263, -5.1450],
  "Madrid":     [40.4168, -3.7038],
  "Barcelona":  [41.3851,  2.1734],
  "Valencia":   [39.4699, -0.3763],
  "Alicante":   [38.3452, -0.4810],
  "Málaga":     [36.7213, -4.4214],
  // Resto de Europa / mundo
  "Stockholm":  [59.3293, 18.0686],
  "Amsterdam":  [52.3676,  4.9041],
  "Antwerp":    [51.2194,  4.4025],
  "Brussels":   [50.8503,  4.3517],
  "London":     [51.5074, -0.1278],
  "Lisbon":     [38.7223, -9.1393],
  "Porto":      [41.1579, -8.6291],
  "Helsinki":   [60.1699, 24.9384],
  "Nice":       [43.7102,  7.2620],
  "Cannes":     [43.5528,  7.0174],
  "Moscow":     [55.7558, 37.6173],
  "Zurich":     [47.3769,  8.5417],
  "Geneva":     [46.2044,  6.1432],
  "Basel":      [47.5596,  7.5886],
  "Dubai":      [25.2048, 55.2708],
};

/** Resuelve la ciudad principal de la agencia · prioriza la primera
 *  oficina (city limpia) y cae al campo `location` si no matchea. */
function resolveCoords(a: Agency): [number, number] | null {
  const officeCity = a.offices?.[0]?.city;
  if (officeCity && cityCoords[officeCity]) return cityCoords[officeCity];
  const loc = (a.location ?? "").toLowerCase();
  for (const key of Object.keys(cityCoords)) {
    if (loc.includes(key.toLowerCase())) return cityCoords[key];
  }
  return null;
}

/** Marker custom · gota azul Byvaro con iniciales o logo · `highlight`
 *  cambia a gradiente naranja para destacar (top performers). */
function makeAgencyIcon(opts: { initials: string; highlight: boolean }): L.DivIcon {
  const bg = opts.highlight
    ? "linear-gradient(135deg,#f97316,#ef4444)"
    : "hsl(215 72% 55%)";
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:36px;height:36px;
        background:${bg};
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 4px 12px rgba(0,0,0,0.18);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);color:white;font-weight:700;font-size:11px;letter-spacing:0.02em;">
          ${opts.initials}
        </span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
  });
}

/** Auto-fit del viewport a todas las agencias geocodificadas. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useMemo(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 9);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
  }, [points.join(","), map]);
  return null;
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const fmtVolumen = (n: number) =>
  n >= 1_000_000
    ? `€${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`
    : n >= 1_000
      ? `€${Math.round(n / 1_000)}k`
      : `€${Math.round(n)}`;

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
export function ColaboradoresMap({ agencies }: { agencies: Agency[] }) {
  const navigate = useNavigate();

  /* Cada agencia con sus coordenadas (filtra las que no resuelven
   *  porque no tienen oficina en una ciudad del diccionario mock). */
  const geoAgencies = useMemo(() => {
    return agencies
      .map((a) => ({ agency: a, coords: resolveCoords(a) }))
      .filter((x): x is { agency: Agency; coords: [number, number] } => x.coords !== null);
  }, [agencies]);

  const points = geoAgencies.map((g) => g.coords);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-280px)] min-h-[560px]">
      {/* ═══ Mapa ═══ */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
        <MapContainer
          center={[48.0, 8.0]}
          zoom={4}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {geoAgencies.map(({ agency: a, coords }) => {
            const verificada = isAgencyVerified(getAgencyLicenses(a));
            const top = (a.ventasCerradas ?? 0) >= 8 || (a.salesVolume ?? 0) >= 3_000_000;
            const initials = initialsOf(a.name);
            return (
              <Marker
                key={a.id}
                position={coords}
                icon={makeAgencyIcon({ initials, highlight: top })}
              >
                <Popup>
                  <div className="w-[260px] -m-[10px]">
                    {/* Cover · si la agencia tiene `cover` lo pintamos
                        para mantener paridad visual con la card del
                        listing. Caemos a un block neutro si no hay. */}
                    <div className="relative aspect-[16/7] bg-gray-100 overflow-hidden">
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt={a.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100" />
                      )}
                      {top && (
                        <span
                          className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white"
                          style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
                        >
                          <TrendingUp className="h-2.5 w-2.5" /> Top
                        </span>
                      )}
                      {/* Avatar superpuesto · refuerza identidad */}
                      <div className="absolute -bottom-4 left-3 h-10 w-10 rounded-xl border-2 border-white bg-white shadow overflow-hidden">
                        {a.logo ? (
                          <img src={a.logo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-[11px] font-bold bg-blue-600 text-white">
                            {initials}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Contenido */}
                    <div className="p-3 pt-5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 m-0">
                        {a.location}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <h3 className="text-sm font-bold text-gray-900 m-0 truncate">
                          {a.name}
                        </h3>
                        {verificada && <VerifiedBadge size="sm" />}
                      </div>
                      {a.googleRating ? (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-600">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="font-semibold text-gray-900">
                            {a.googleRating.toFixed(1)}
                          </span>
                          <span className="text-gray-400">
                            · {a.googleRatingsTotal ?? 0} reseñas
                          </span>
                        </div>
                      ) : null}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-gray-100">
                        <Stat label="Registros" value={String(a.registrosAportados ?? a.registrations ?? 0)} />
                        <Stat label="Ventas"    value={String(a.ventasCerradas ?? 0)} />
                        <Stat label="Volumen"   value={fmtVolumen(a.salesVolume ?? 0)} />
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(agencyHref(a))}
                        className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-8 rounded-full bg-gray-900 text-white text-[11px] font-semibold hover:bg-gray-800 transition-colors"
                      >
                        Ver inmobiliaria
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Overlay con contador · idéntico a PromocionesMap */}
        <div className="absolute top-3 left-3 bg-card border border-border rounded-full px-3 py-1.5 shadow-soft flex items-center gap-1.5 text-xs font-medium z-[400]">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="tnum">
            <span className="font-bold">{geoAgencies.length}</span> en el mapa
          </span>
          {agencies.length > geoAgencies.length && (
            <span className="text-muted-foreground">
              · {agencies.length - geoAgencies.length} sin coordenadas
            </span>
          )}
        </div>
      </div>

      {/* ═══ Sidebar lista ═══ */}
      <aside className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden flex flex-col">
        <header className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Inmobiliarias en vista</h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {geoAgencies.length} resultados
          </p>
        </header>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {geoAgencies.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-muted-foreground">
              <Building2 className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
              Sin resultados con ubicación en el mapa.
            </div>
          ) : (
            geoAgencies.map(({ agency: a }) => {
              const verificada = isAgencyVerified(getAgencyLicenses(a));
              const top = (a.ventasCerradas ?? 0) >= 8 || (a.salesVolume ?? 0) >= 3_000_000;
              return (
                <article
                  key={a.id}
                  onClick={() => navigate(agencyHref(a))}
                  className={cn(
                    "group flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors cursor-pointer",
                    top && "bg-warning/15",
                  )}
                >
                  <div className="h-12 w-12 rounded-xl bg-cover bg-center ring-1 ring-border/60 shrink-0 overflow-hidden grid place-items-center bg-muted">
                    {a.logo ? (
                      <img src={a.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {initialsOf(a.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
                      {a.location}
                    </p>
                    <div className="flex items-center gap-1">
                      <h4 className="text-[13px] font-semibold truncate">{a.name}</h4>
                      {verificada && <VerifiedBadge size="sm" />}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {a.ventasCerradas ?? 0} ventas · {fmtVolumen(a.salesVolume ?? 0)}
                      {a.googleRating ? ` · ★ ${a.googleRating.toFixed(1)}` : ""}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 m-0 font-semibold">
        {label}
      </p>
      <p className="text-[12.5px] font-bold text-gray-900 mt-0.5 m-0 tabular-nums">
        {value}
      </p>
    </div>
  );
}
