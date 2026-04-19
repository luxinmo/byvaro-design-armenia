import { useState } from "react";
import { Shield, Sun, Wifi, Dumbbell, Waves, TreePine, Car, Droplets } from "lucide-react";

const amenities = [
  { icon: Shield, label: "Seguridad 24h" },
  { icon: Sun, label: "Paneles solares" },
  { icon: Wifi, label: "Domótica" },
  { icon: Dumbbell, label: "Gimnasio privado" },
  { icon: Waves, label: "Piscina infinity" },
  { icon: TreePine, label: "Jardines comunes" },
  { icon: Car, label: "Parking privado" },
  { icon: Droplets, label: "Jacuzzi" },
];

export function PromotionDescription() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground mb-1.5">Descripción del proyecto</h2>
        <div className={`text-sm text-muted-foreground leading-relaxed ${!expanded ? "line-clamp-4" : ""}`}>
          <p>
            Se trata de una urbanización única por su proximidad a la ciudad y a los puertos deportivos, que al mismo tiempo ofrece tranquilidad y privacidad en una de las zonas más codiciadas de la costa mediterránea.
          </p>
          <p className="mt-2">
            En toda la costa no encontrará una urbanización más prestigiosa con un estilo más auténtico, un diseño más excepcional y que respete y se integre con su entorno natural y sus alrededores. Cada vivienda ha sido diseñada para maximizar las vistas al mar y la luz natural, con acabados de primera calidad y materiales sostenibles.
          </p>
          <p className="mt-2">
            Las zonas comunes incluyen piscina infinity con vistas panorámicas, gimnasio equipado, jardines paisajísticos, zona de coworking y acceso directo a la playa a través de un sendero privado.
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary font-medium mt-1.5 hover:underline"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2.5">Características y equipamiento</h3>
        <div className="flex flex-wrap gap-1.5">
          {amenities.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-1.5 border border-border/40 rounded-full px-2.5 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
            >
              <a.icon className="h-3 w-3 text-muted-foreground" />
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
