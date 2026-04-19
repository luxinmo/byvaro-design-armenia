import { MapPin, Clock, Car, Train } from "lucide-react";

const distances = [
  { icon: Car, label: "Aeropuerto Alicante", time: "35 min" },
  { icon: Train, label: "Estación AVE", time: "20 min" },
  { icon: MapPin, label: "Centro ciudad", time: "10 min" },
  { icon: MapPin, label: "Playa más cercana", time: "5 min" },
];

export function PromotionLocation({ location }: { location: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
      <div className="p-5">
        <h2 className="text-base font-semibold text-foreground mb-0.5">Ubicación</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {location}, España
        </div>
      </div>

      <div className="h-[180px] bg-muted/20 border-t border-b border-border/40 flex items-center justify-center relative">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-1.5 opacity-20" />
          <p className="text-xs font-medium">Mapa interactivo</p>
          <p className="text-[10px]">Integración con Google Maps disponible</p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-2.5">
        {distances.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <d.icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{d.label}</p>
              <p className="text-sm font-medium text-foreground tabular-nums">{d.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
