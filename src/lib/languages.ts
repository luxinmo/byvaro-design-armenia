/**
 * Catálogo de idiomas con su código BCP 47 corto y bandera del país
 * más representativo. Pensado para multi-select con chips visuales
 * (en la ficha de contacto, importer, etc).
 */

export type Language = {
  /** Código corto (BCP 47 base): "es", "en", "fr"… (mayúscula). */
  code: string;
  /** Nombre en español. */
  name: string;
  /** Bandera emoji · se mantiene como fallback pero preferir `<Flag iso={countryIso}>` . */
  flag: string;
  /** ISO 3166-1 alpha-2 del país más representativo del idioma.
   *  Se usa con `<Flag iso={countryIso} />` (ver src/components/ui/Flag.tsx). */
  countryIso: string;
};

export const LANGUAGES: Language[] = [
  { code: "ES", name: "Español",          flag: "🇪🇸", countryIso: "ES" },
  { code: "EN", name: "Inglés",           flag: "🇬🇧", countryIso: "GB" },
  { code: "FR", name: "Francés",          flag: "🇫🇷", countryIso: "FR" },
  { code: "DE", name: "Alemán",           flag: "🇩🇪", countryIso: "DE" },
  { code: "IT", name: "Italiano",         flag: "🇮🇹", countryIso: "IT" },
  { code: "PT", name: "Portugués",        flag: "🇵🇹", countryIso: "PT" },
  { code: "NL", name: "Neerlandés",       flag: "🇳🇱", countryIso: "NL" },
  { code: "RU", name: "Ruso",             flag: "🇷🇺", countryIso: "RU" },
  { code: "UK", name: "Ucraniano",        flag: "🇺🇦", countryIso: "UA" },
  { code: "PL", name: "Polaco",           flag: "🇵🇱", countryIso: "PL" },
  { code: "RO", name: "Rumano",           flag: "🇷🇴", countryIso: "RO" },
  { code: "SV", name: "Sueco",            flag: "🇸🇪", countryIso: "SE" },
  { code: "NO", name: "Noruego",          flag: "🇳🇴", countryIso: "NO" },
  { code: "DA", name: "Danés",            flag: "🇩🇰", countryIso: "DK" },
  { code: "FI", name: "Finés",            flag: "🇫🇮", countryIso: "FI" },
  { code: "TR", name: "Turco",            flag: "🇹🇷", countryIso: "TR" },
  { code: "HY", name: "Armenio",          flag: "🇦🇲", countryIso: "AM" },
  { code: "KA", name: "Georgiano",        flag: "🇬🇪", countryIso: "GE" },
  { code: "AR", name: "Árabe",            flag: "🇸🇦", countryIso: "SA" },
  { code: "HE", name: "Hebreo",           flag: "🇮🇱", countryIso: "IL" },
  { code: "ZH", name: "Chino",            flag: "🇨🇳", countryIso: "CN" },
  { code: "JA", name: "Japonés",          flag: "🇯🇵", countryIso: "JP" },
  { code: "KO", name: "Coreano",          flag: "🇰🇷", countryIso: "KR" },
];

export function findLanguageByCode(code: string): Language | undefined {
  const upper = code.toUpperCase();
  return LANGUAGES.find((l) => l.code === upper);
}

/** Bandera emoji para un código — fallback 🏳️ si el código es desconocido. */
export function languageFlag(code: string): string {
  return findLanguageByCode(code)?.flag ?? "🏳️";
}

/** Nombre en español del idioma — fallback al propio código. */
export function languageName(code: string): string {
  return findLanguageByCode(code)?.name ?? code;
}
