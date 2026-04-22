/**
 * Catálogo de idiomas con su código BCP 47 corto y bandera del país
 * más representativo. Pensado para multi-select con chips visuales
 * (en la ficha de contacto, importer, etc).
 */

export type Language = {
  /** Código corto (BCP 47 base): "es", "en", "fr"… */
  code: string;
  /** Nombre en español. */
  name: string;
  /** Bandera emoji. */
  flag: string;
};

export const LANGUAGES: Language[] = [
  { code: "ES", name: "Español",          flag: "🇪🇸" },
  { code: "EN", name: "Inglés",           flag: "🇬🇧" },
  { code: "FR", name: "Francés",          flag: "🇫🇷" },
  { code: "DE", name: "Alemán",           flag: "🇩🇪" },
  { code: "IT", name: "Italiano",         flag: "🇮🇹" },
  { code: "PT", name: "Portugués",        flag: "🇵🇹" },
  { code: "NL", name: "Neerlandés",       flag: "🇳🇱" },
  { code: "RU", name: "Ruso",             flag: "🇷🇺" },
  { code: "UK", name: "Ucraniano",        flag: "🇺🇦" },
  { code: "PL", name: "Polaco",           flag: "🇵🇱" },
  { code: "RO", name: "Rumano",           flag: "🇷🇴" },
  { code: "SV", name: "Sueco",            flag: "🇸🇪" },
  { code: "NO", name: "Noruego",          flag: "🇳🇴" },
  { code: "DA", name: "Danés",            flag: "🇩🇰" },
  { code: "FI", name: "Finés",            flag: "🇫🇮" },
  { code: "TR", name: "Turco",            flag: "🇹🇷" },
  { code: "HY", name: "Armenio",          flag: "🇦🇲" },
  { code: "KA", name: "Georgiano",        flag: "🇬🇪" },
  { code: "AR", name: "Árabe",            flag: "🇸🇦" },
  { code: "HE", name: "Hebreo",           flag: "🇮🇱" },
  { code: "ZH", name: "Chino",            flag: "🇨🇳" },
  { code: "JA", name: "Japonés",          flag: "🇯🇵" },
  { code: "KO", name: "Coreano",          flag: "🇰🇷" },
];

export function findLanguageByCode(code: string): Language | undefined {
  const upper = code.toUpperCase();
  return LANGUAGES.find((l) => l.code === upper);
}
