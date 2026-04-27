/**
 * Catálogo de idiomas con su código BCP 47 corto y el ISO 3166-1
 * alpha-2 del país más representativo (para servir la bandera SVG
 * desde `public/flags/` vía `<Flag iso={countryIso} />`).
 *
 * Pensado para multi-select con chips visuales (ficha de contacto,
 * importer, etc).
 *
 * NUNCA emojis · Windows no renderiza los emoji de bandera (Segoe UI
 * Emoji no incluye regional indicators). Usa siempre el componente
 * `<Flag>` de `src/components/ui/Flag.tsx`.
 */

export type Language = {
  /** Código corto (BCP 47 base): "ES", "EN", "FR"… (mayúscula). */
  code: string;
  /** Nombre en español. */
  name: string;
  /** ISO 3166-1 alpha-2 del país más representativo del idioma.
   *  Se usa con `<Flag iso={countryIso} />` (ver src/components/ui/Flag.tsx). */
  countryIso: string;
};

export const LANGUAGES: Language[] = [
  { code: "ES", name: "Español",          countryIso: "ES" },
  { code: "EN", name: "Inglés",           countryIso: "GB" },
  { code: "FR", name: "Francés",          countryIso: "FR" },
  { code: "DE", name: "Alemán",           countryIso: "DE" },
  { code: "IT", name: "Italiano",         countryIso: "IT" },
  { code: "PT", name: "Portugués",        countryIso: "PT" },
  { code: "NL", name: "Neerlandés",       countryIso: "NL" },
  { code: "RU", name: "Ruso",             countryIso: "RU" },
  { code: "UK", name: "Ucraniano",        countryIso: "UA" },
  { code: "PL", name: "Polaco",           countryIso: "PL" },
  { code: "RO", name: "Rumano",           countryIso: "RO" },
  { code: "SV", name: "Sueco",            countryIso: "SE" },
  { code: "NO", name: "Noruego",          countryIso: "NO" },
  { code: "DA", name: "Danés",            countryIso: "DK" },
  { code: "FI", name: "Finés",            countryIso: "FI" },
  { code: "TR", name: "Turco",            countryIso: "TR" },
  { code: "HY", name: "Armenio",          countryIso: "AM" },
  { code: "KA", name: "Georgiano",        countryIso: "GE" },
  { code: "AR", name: "Árabe",            countryIso: "SA" },
  { code: "HE", name: "Hebreo",           countryIso: "IL" },
  { code: "ZH", name: "Chino",            countryIso: "CN" },
  { code: "JA", name: "Japonés",          countryIso: "JP" },
  { code: "KO", name: "Coreano",          countryIso: "KR" },
];

export function findLanguageByCode(code: string): Language | undefined {
  const upper = code.toUpperCase();
  return LANGUAGES.find((l) => l.code === upper);
}

/** ISO del país representativo · pásalo a `<Flag iso={languageCountryIso(code)} />`. */
export function languageCountryIso(code: string): string | undefined {
  return findLanguageByCode(code)?.countryIso;
}

/** Nombre en español del idioma — fallback al propio código. */
export function languageName(code: string): string {
  return findLanguageByCode(code)?.name ?? code;
}

/** Idiomas prioritarios en el sector real estate (Costa del Sol /
 *  Costa Blanca) · siempre se renderizan primero en cualquier lista
 *  derivada (ficha pública, hero, ZonasEspecialidadesCard). El resto
 *  conserva el orden de aparición. */
export const TOP_LANGUAGES = ["ES", "EN", "FR", "DE", "RU"] as const;

/** Ordena una lista de códigos de idioma poniendo los TOP_LANGUAGES
 *  primero (en su orden), y el resto preserva su orden original.
 *  Devuelve una nueva lista · no muta. Case-insensitive en input. */
export function sortLanguagesByImportance(codes: string[]): string[] {
  const upper = codes.map((c) => c.toUpperCase());
  const seen = new Set<string>();
  const top: string[] = [];
  for (const t of TOP_LANGUAGES) {
    if (upper.includes(t) && !seen.has(t)) {
      top.push(t);
      seen.add(t);
    }
  }
  const rest = upper.filter((c) => !seen.has(c));
  return [...top, ...rest];
}
