/**
 * PhoneInput · selector de país (bandera + prefijo) + número local.
 *
 * - Por defecto España (+34).
 * - El selector de país abre un popover con buscador (por nombre,
 *   prefijo o ISO).
 * - El input solo permite dígitos y espacios para el número local.
 * - El valor expuesto al padre es el teléfono completo formateado:
 *   `+34 600 000 000`.
 *
 * Si recibes un valor inicial con prefijo, lo detectamos y separamos
 * automáticamente para que el dropdown se posicione correctamente.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES, DEFAULT_PHONE_COUNTRY_ISO,
  detectCountryFromPhone, findCountryByIso, stripPrefix, buildPhone,
  type PhoneCountry,
} from "@/lib/phoneCountries";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function PhoneInput({ value, onChange, placeholder = "600 000 000", autoFocus }: Props) {
  /* Detecta el país a partir del valor inicial. Si no se reconoce,
   * cae al país por defecto (España). */
  const initialCountry = useMemo(
    () => (value ? detectCountryFromPhone(value) : undefined)
        ?? findCountryByIso(DEFAULT_PHONE_COUNTRY_ISO)
        ?? PHONE_COUNTRIES[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // solo en mount; cambios posteriores los gestiona el state
  );

  const [country, setCountry] = useState<PhoneCountry>(initialCountry);
  const [local, setLocal] = useState<string>(() =>
    value ? stripPrefix(value, initialCountry) : "",
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  /* Sincroniza el valor expuesto cada vez que cambian country o local. */
  useEffect(() => {
    onChange(buildPhone(country, local));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, local]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    const cleanQ = q.replace(/^\+/, "");
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.prefix.startsWith(cleanQ),
    );
  }, [query]);

  const pickCountry = (c: PhoneCountry) => {
    setCountry(c);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex items-stretch gap-1.5">
      {/* Selector de país */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-border bg-card text-sm hover:border-foreground/30 transition-colors shrink-0"
            aria-label={`País: ${country.name}`}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-xs font-medium text-foreground tnum">+{country.prefix}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden">
          <div className="border-b border-border/60 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar país, prefijo o ISO…"
                className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
              />
            </div>
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic text-center py-3">
                Sin coincidencias
              </p>
            ) : filtered.map((c) => (
              <button
                key={c.iso}
                type="button"
                onClick={() => pickCountry(c)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                  country.iso === c.iso
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/40",
                )}
              >
                <span className="text-base leading-none shrink-0">{c.flag}</span>
                <span className="flex-1 text-xs truncate">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tnum shrink-0">+{c.prefix}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Número local */}
      <input
        type="tel"
        inputMode="tel"
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/[^\d\s]/g, ""))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary tnum"
      />
    </div>
  );
}
