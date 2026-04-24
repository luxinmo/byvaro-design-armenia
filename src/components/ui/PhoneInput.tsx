/**
 * PhoneInput · campo único con bandera clicable + número internacional.
 *
 * UX:
 * - Un SOLO campo visual (contenedor) con:
 *     · izquierda · botón flag/globo clicable (abre dropdown).
 *     · derecha · input de texto donde el usuario escribe el teléfono
 *       completo con prefijo (ej. `+34 600 000 000` · también acepta
 *       `0034…`).
 * - Flag auto-detectada a partir del prefijo que escribe el usuario.
 * - Si borra el prefijo → flag desaparece y aparece el globo 🌐.
 * - Al clicar el flag/globo → popover con buscador para elegir país.
 *   Resuelve la ambigüedad de prefijos compartidos (Canadá/USA +1,
 *   Kazajistán/Rusia +7) — el país elegido queda "pineado" hasta que
 *   el usuario vuelva a cambiar los dígitos del prefijo.
 *
 * Valor expuesto (prop `onChange`):
 *   string · el teléfono tal y como lo escribe el usuario,
 *   normalizado: "+34 600 000 000" (con `+` y espacio tras el prefijo
 *   si hay prefijo reconocido · si no, el texto raw).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flag } from "@/components/ui/Flag";
import {
  PHONE_COUNTRIES, detectCountryFromPhone, findCountryByIso,
  type PhoneCountry,
} from "@/lib/phoneCountries";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Opcional · fija una bandera inicial cuando el value viene vacío.
   *  Default: sin bandera (globo). */
  defaultIso?: string;
  className?: string;
};

/* Normaliza lo que escribe el usuario a un raw digito-string.
 * Si empieza con "00", lo tratamos como "+". Mantenemos el `+` inicial. */
function toRawWithPlus(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const stripped = trimmed.replace(/[^\d+]/g, "");
  /* "0034…" → "+34…" */
  if (stripped.startsWith("00")) return "+" + stripped.slice(2);
  if (stripped.startsWith("+")) return "+" + stripped.slice(1).replace(/\+/g, "");
  return stripped; // sin + · no forzamos prefijo hasta que el usuario lo ponga
}

/* Formatea raw → display "+PPP NNNNNNN" si detectamos prefijo. */
function formatDisplay(raw: string, country?: PhoneCountry): string {
  if (!raw) return "";
  if (!country) return raw;
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith(country.prefix)
    ? digits.slice(country.prefix.length)
    : digits;
  return local ? `+${country.prefix} ${local}` : `+${country.prefix}`;
}

export function PhoneInput({
  value, onChange, placeholder = "+34 600 000 000", autoFocus, defaultIso, className,
}: Props) {
  /* ─── Estado local de texto · controla lo que se ve escrito. ─── */
  const [text, setText] = useState<string>(value);
  /* País "pinneado" por el usuario (override a la detección automática).
   * Se resetea cuando el usuario cambia los dígitos del prefijo. */
  const [pinnedIso, setPinnedIso] = useState<string | null>(defaultIso ?? null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ─── Sincroniza desde la prop `value` cuando cambia desde fuera. ─── */
  useEffect(() => {
    if (value !== text) setText(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* ─── País actual (pinned > detectado > undefined) ─── */
  const detected = useMemo(() => detectCountryFromPhone(text), [text]);
  const country = useMemo(() => {
    if (pinnedIso) {
      const c = findCountryByIso(pinnedIso);
      if (c) {
        /* Si el usuario borra el prefijo o escribe otro distinto, el
         * pinned deja de aplicar — el detectado manda. */
        const digits = text.replace(/\D/g, "");
        if (digits.startsWith(c.prefix)) return c;
      }
    }
    return detected;
  }, [pinnedIso, detected, text]);

  /* ─── Cambios de texto del usuario ─── */
  const handleTextChange = (v: string) => {
    const raw = toRawWithPlus(v);
    setText(raw);
    onChange(raw);
    /* Si los dígitos del prefijo cambian, limpiamos el pinned. */
    if (pinnedIso) {
      const pinned = findCountryByIso(pinnedIso);
      const digits = raw.replace(/\D/g, "");
      if (pinned && !digits.startsWith(pinned.prefix)) {
        setPinnedIso(null);
      }
    }
  };

  /* ─── Usuario elige un país del dropdown ─── */
  const pickCountry = (c: PhoneCountry) => {
    setPinnedIso(c.iso);
    setOpen(false);
    setQuery("");
    /* Reescribimos el prefijo del texto manteniendo el número local. */
    const current = text.replace(/\D/g, "");
    /* Detectamos el prefijo anterior (si lo había) para poder quitarlo. */
    const prev = detected;
    const local = prev && current.startsWith(prev.prefix)
      ? current.slice(prev.prefix.length)
      : current;
    const next = local ? `+${c.prefix} ${local}` : `+${c.prefix}`;
    setText(next);
    onChange(next);
    /* Devolvemos el foco al input para que siga escribiendo cómodo. */
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /* ─── Filtro del dropdown ─── */
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

  /* ─── Display · si hay país detectado, formateamos con "+PP …". ─── */
  const display = country ? formatDisplay(text, country) : text;

  return (
    <div
      className={cn(
        "flex items-stretch h-10 rounded-xl border border-border bg-card overflow-hidden transition-colors",
        "focus-within:border-primary",
        className,
      )}
    >
      {/* Botón flag/globo · abre dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={country ? `País: ${country.name}` : "Elegir país"}
            className="inline-flex items-center gap-1.5 px-2.5 border-r border-border/70 hover:bg-muted/40 transition-colors shrink-0"
          >
            <Flag iso={country?.iso ?? null} size={20} title={country?.name} />
            {/* Flecha minimalista para indicar que es clicable */}
            <svg className="h-3 w-3 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[300px] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden"
          /* Fix scroll-jump al abrir · el input de búsqueda llevaba
             autoFocus natural del HTML + Radix intentaba enfocar el
             primer focusable al montarse → el browser hacía
             scrollIntoView para "ver" el input y el dialog saltaba.
             Bloqueamos el auto-focus de Radix sin tocar el scroll
             interno ni el scroll manual con rueda/touch. El usuario
             puede clicar el input para escribir. */
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-border/60 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar país, prefijo o ISO…"
                className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
              />
            </div>
          </div>
          <div
            className="max-h-[300px] overflow-y-auto overscroll-contain py-1"
            /* Fix scroll · cuando el Popover está dentro de un Dialog,
               Radix aplica scroll-lock global (react-remove-scroll) y
               los wheel/touch events no llegan al elemento con
               overflow del popover. Stop-propagation para que el
               scroll de ESTE contenedor funcione aunque el body esté
               bloqueado. */
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic text-center py-3">
                Sin coincidencias
              </p>
            ) : filtered.map((c) => {
              const ambiguous = PHONE_COUNTRIES.filter((x) => x.prefix === c.prefix).length > 1;
              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => pickCountry(c)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                    country?.iso === c.iso
                      ? "bg-muted text-foreground"
                      : "text-foreground hover:bg-muted/40",
                  )}
                >
                  <Flag iso={c.iso} size={18} />
                  <span className="flex-1 text-xs truncate">
                    {c.name}
                    {ambiguous && (
                      <span className="text-[9px] text-warning font-semibold ml-1.5 uppercase tracking-wider">
                        (comparte prefijo)
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground tnum shrink-0">+{c.prefix}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Input unificado · el usuario ve "+34 600 000 000" o lo que escribió */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        value={display}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none tnum placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
