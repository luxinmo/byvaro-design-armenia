/**
 * AddressAutocomplete · input único estilo Google Maps / Google Places.
 *
 * Muestra un listado de sugerencias mientras el usuario teclea. Al
 * seleccionar una sugerencia, parsea la dirección y la guarda como
 * objeto estructurado `{ pais, provincia, ciudad, direccion }` para que
 * el resto del wizard pueda seguir usando los campos individuales.
 *
 * Implementación actual: sugerencias estáticas curadas (ciudades
 * españolas populares entre promotores, con sus provincias y país).
 * Está pensado para enchufarse a Google Places API / Mapbox en el
 * futuro — la interfaz `Suggestion` no cambia, solo el proveedor.
 *
 * Interacción:
 *   - Focus + typing → filtra sugerencias, dropdown se abre
 *   - Arrow Up/Down → navega entre opciones
 *   - Enter → selecciona la resaltada (o la primera si no hay)
 *   - Esc → cierra el dropdown
 *   - Click fuera → cierra el dropdown
 *   - Texto libre → se guarda como `direccion` sin parsear
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X, Search } from "lucide-react";
import type { DireccionPromocion } from "./types";
import { cn } from "@/lib/utils";

interface Suggestion {
  label: string;        // "Marbella, Málaga, España"
  ciudad: string;
  provincia: string;
  pais: string;
  tipo: "ciudad" | "zona" | "urbanizacion";
}

/* ─── Base de datos local de sugerencias ──────────────────────────── */
const SUGERENCIAS: Suggestion[] = [
  // Costa del Sol
  { ciudad: "Marbella", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Marbella, Málaga, España" },
  { ciudad: "Estepona", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Estepona, Málaga, España" },
  { ciudad: "Benahavís", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Benahavís, Málaga, España" },
  { ciudad: "Málaga", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Málaga (capital), Málaga, España" },
  { ciudad: "Fuengirola", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Fuengirola, Málaga, España" },
  { ciudad: "Mijas", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Mijas, Málaga, España" },
  { ciudad: "Benalmádena", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Benalmádena, Málaga, España" },
  { ciudad: "Nerja", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Nerja, Málaga, España" },
  { ciudad: "Torremolinos", provincia: "Málaga", pais: "España", tipo: "ciudad", label: "Torremolinos, Málaga, España" },
  // Costa Blanca
  { ciudad: "Altea", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Altea, Alicante, España" },
  { ciudad: "Benidorm", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Benidorm, Alicante, España" },
  { ciudad: "Calpe", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Calpe, Alicante, España" },
  { ciudad: "Dénia", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Dénia, Alicante, España" },
  { ciudad: "Jávea", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Jávea (Xàbia), Alicante, España" },
  { ciudad: "Alicante", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Alicante (capital), Alicante, España" },
  { ciudad: "Torrevieja", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Torrevieja, Alicante, España" },
  { ciudad: "Santa Pola", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Santa Pola, Alicante, España" },
  { ciudad: "Orihuela Costa", provincia: "Alicante", pais: "España", tipo: "ciudad", label: "Orihuela Costa, Alicante, España" },
  // Madrid
  { ciudad: "Madrid", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Madrid (capital), Madrid, España" },
  { ciudad: "Las Rozas", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Las Rozas, Madrid, España" },
  { ciudad: "Pozuelo de Alarcón", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Pozuelo de Alarcón, Madrid, España" },
  { ciudad: "Majadahonda", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Majadahonda, Madrid, España" },
  { ciudad: "Alcobendas", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Alcobendas, Madrid, España" },
  { ciudad: "Boadilla del Monte", provincia: "Madrid", pais: "España", tipo: "ciudad", label: "Boadilla del Monte, Madrid, España" },
  // Barcelona
  { ciudad: "Barcelona", provincia: "Barcelona", pais: "España", tipo: "ciudad", label: "Barcelona (capital), Barcelona, España" },
  { ciudad: "Sitges", provincia: "Barcelona", pais: "España", tipo: "ciudad", label: "Sitges, Barcelona, España" },
  { ciudad: "Castelldefels", provincia: "Barcelona", pais: "España", tipo: "ciudad", label: "Castelldefels, Barcelona, España" },
  { ciudad: "Sant Cugat del Vallès", provincia: "Barcelona", pais: "España", tipo: "ciudad", label: "Sant Cugat del Vallès, Barcelona, España" },
  // Baleares
  { ciudad: "Palma", provincia: "Baleares", pais: "España", tipo: "ciudad", label: "Palma de Mallorca, Baleares, España" },
  { ciudad: "Ibiza", provincia: "Baleares", pais: "España", tipo: "ciudad", label: "Ibiza ciudad, Baleares, España" },
  { ciudad: "Santa Eulalia", provincia: "Baleares", pais: "España", tipo: "ciudad", label: "Santa Eulalia del Río, Baleares, España" },
  { ciudad: "Alcúdia", provincia: "Baleares", pais: "España", tipo: "ciudad", label: "Alcúdia, Baleares, España" },
  // Valencia
  { ciudad: "Valencia", provincia: "Valencia", pais: "España", tipo: "ciudad", label: "Valencia (capital), Valencia, España" },
  { ciudad: "Gandía", provincia: "Valencia", pais: "España", tipo: "ciudad", label: "Gandía, Valencia, España" },
  // Canarias
  { ciudad: "Las Palmas de Gran Canaria", provincia: "Las Palmas", pais: "España", tipo: "ciudad", label: "Las Palmas de Gran Canaria, Las Palmas, España" },
  { ciudad: "Adeje", provincia: "Santa Cruz de Tenerife", pais: "España", tipo: "ciudad", label: "Costa Adeje, Santa Cruz de Tenerife, España" },
  // Otros países habituales
  { ciudad: "Lisboa", provincia: "Lisboa", pais: "Portugal", tipo: "ciudad", label: "Lisboa, Portugal" },
  { ciudad: "Porto", provincia: "Porto", pais: "Portugal", tipo: "ciudad", label: "Porto, Portugal" },
  { ciudad: "Andorra la Vella", provincia: "Andorra", pais: "Andorra", tipo: "ciudad", label: "Andorra la Vella, Andorra" },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function filterSuggestions(query: string): Suggestion[] {
  const q = normalize(query.trim());
  if (!q) return SUGERENCIAS.slice(0, 7);
  return SUGERENCIAS
    .filter(s => normalize(s.label).includes(q))
    .slice(0, 8);
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Escribe una ciudad, urbanización o dirección…",
  autoFocus = false,
}: {
  value: DireccionPromocion;
  onChange: (v: DireccionPromocion) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  // El texto visible en el input. Si ya tenemos datos parseados,
  // los recomponemos. Si el usuario ha escrito algo libre (sin match),
  // lo reutilizamos tal cual.
  const [query, setQuery] = useState(() => {
    if (value.ciudad && value.provincia) return `${value.ciudad}, ${value.provincia}${value.pais ? `, ${value.pais}` : ""}`;
    return value.direccion || "";
  });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => filterSuggestions(query), [query]);

  // Click fuera → cierra
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectSuggestion = (s: Suggestion) => {
    setQuery(s.label);
    onChange({
      pais: s.pais,
      provincia: s.provincia,
      ciudad: s.ciudad,
      direccion: value.direccion ?? "",
    });
    setOpen(false);
  };

  const handleChange = (text: string) => {
    setQuery(text);
    setOpen(true);
    setHighlight(0);
    const clean = text.trim();
    // Si el texto coincide exactamente con la ciudad o el label de una
    // sugerencia, la aplicamos completa (pais + provincia + ciudad).
    const match = clean
      ? SUGERENCIAS.find(
          (s) =>
            s.label.toLowerCase() === clean.toLowerCase() ||
            s.ciudad.toLowerCase() === clean.toLowerCase()
        )
      : null;
    if (match) {
      onChange({
        pais: match.pais,
        provincia: match.provincia,
        ciudad: match.ciudad,
        direccion: text,
      });
      return;
    }
    // Texto libre sin match exacto: usamos la primera coma para partir
    // "Ciudad, Provincia, País" manualmente; si no hay comas, asumimos
    // que el usuario está escribiendo una ciudad y hacemos el país por
    // defecto (España) — así `canContinue()` no bloquea por pais/ciudad
    // vacíos y el usuario puede avanzar con texto libre.
    const parts = clean.split(",").map((s) => s.trim()).filter(Boolean);
    const ciudad = parts[0] || "";
    const provincia = parts[1] || "";
    const pais = parts[2] || (ciudad ? "España" : "");
    onChange({ pais, provincia, ciudad, direccion: text });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSuggestion(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange({ pais: "", provincia: "", ciudad: "", direccion: "" });
    setOpen(false);
  };

  const hasParsed = !!(value.ciudad && value.provincia);

  return (
    <div ref={wrapperRef} className="relative">
      <div className={cn(
        "relative flex items-center gap-2 h-12 px-3.5 rounded-xl border bg-card transition-all",
        open ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}>
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-muted-foreground/60"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground"
            aria-label="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chip de dirección parseada */}
      {hasParsed && !open && (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground pl-1 flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5" />
          <span className="tnum">Ciudad: <span className="text-foreground font-medium">{value.ciudad}</span></span>
          <span>·</span>
          <span className="tnum">Provincia: <span className="text-foreground font-medium">{value.provincia}</span></span>
          <span>·</span>
          <span className="tnum">País: <span className="text-foreground font-medium">{value.pais}</span></span>
        </p>
      )}

      {/* Dropdown de sugerencias */}
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-[320px] overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => {
            const selected = i === highlight;
            return (
              <button
                key={s.label}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectSuggestion(s)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border last:border-0",
                  selected ? "bg-primary/10" : "bg-popover hover:bg-muted/60",
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg shrink-0",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground truncate">{s.ciudad}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.provincia} · {s.pais}</p>
                </div>
              </button>
            );
          })}
          <div className="px-3 py-2 text-[10px] text-muted-foreground bg-muted/40 border-t border-border">
            Enter · Flechas ↑↓ para navegar · Esc para cerrar
          </div>
        </div>
      )}

      {/* Nota para conexión a Google Places */}
      {open && suggestions.length === 0 && query.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-popover shadow-lg p-3">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            No encontramos sugerencias para "<span className="font-medium text-foreground">{query}</span>".
            Puedes seguir escribiendo la dirección completa a mano —se guardará tal cual.
          </p>
        </div>
      )}
    </div>
  );
}
