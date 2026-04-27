/** Nationality list (demonyms in English) used by the client registration dialog. */
export const NATIONALITIES: { code: string; label: string; flag: string }[] = [
  { code: "ES", label: "Spanish", flag: "🇪🇸" },
  { code: "GB", label: "British", flag: "🇬🇧" },
  { code: "IE", label: "Irish", flag: "🇮🇪" },
  { code: "FR", label: "French", flag: "🇫🇷" },
  { code: "DE", label: "German", flag: "🇩🇪" },
  { code: "IT", label: "Italian", flag: "🇮🇹" },
  { code: "PT", label: "Portuguese", flag: "🇵🇹" },
  { code: "NL", label: "Dutch", flag: "🇳🇱" },
  { code: "BE", label: "Belgian", flag: "🇧🇪" },
  { code: "LU", label: "Luxembourgish", flag: "🇱🇺" },
  { code: "CH", label: "Swiss", flag: "🇨🇭" },
  { code: "AT", label: "Austrian", flag: "🇦🇹" },
  { code: "DK", label: "Danish", flag: "🇩🇰" },
  { code: "SE", label: "Swedish", flag: "🇸🇪" },
  { code: "NO", label: "Norwegian", flag: "🇳🇴" },
  { code: "FI", label: "Finnish", flag: "🇫🇮" },
  { code: "IS", label: "Icelandic", flag: "🇮🇸" },
  { code: "PL", label: "Polish", flag: "🇵🇱" },
  { code: "CZ", label: "Czech", flag: "🇨🇿" },
  { code: "SK", label: "Slovak", flag: "🇸🇰" },
  { code: "HU", label: "Hungarian", flag: "🇭🇺" },
  { code: "RO", label: "Romanian", flag: "🇷🇴" },
  { code: "BG", label: "Bulgarian", flag: "🇧🇬" },
  { code: "GR", label: "Greek", flag: "🇬🇷" },
  { code: "HR", label: "Croatian", flag: "🇭🇷" },
  { code: "SI", label: "Slovenian", flag: "🇸🇮" },
  { code: "RS", label: "Serbian", flag: "🇷🇸" },
  { code: "EE", label: "Estonian", flag: "🇪🇪" },
  { code: "LV", label: "Latvian", flag: "🇱🇻" },
  { code: "LT", label: "Lithuanian", flag: "🇱🇹" },
  { code: "RU", label: "Russian", flag: "🇷🇺" },
  { code: "UA", label: "Ukrainian", flag: "🇺🇦" },
  { code: "TR", label: "Turkish", flag: "🇹🇷" },
  { code: "MA", label: "Moroccan", flag: "🇲🇦" },
  { code: "AE", label: "Emirati", flag: "🇦🇪" },
  { code: "SA", label: "Saudi", flag: "🇸🇦" },
  { code: "QA", label: "Qatari", flag: "🇶🇦" },
  { code: "KW", label: "Kuwaiti", flag: "🇰🇼" },
  { code: "IL", label: "Israeli", flag: "🇮🇱" },
  { code: "US", label: "American", flag: "🇺🇸" },
  { code: "CA", label: "Canadian", flag: "🇨🇦" },
  { code: "MX", label: "Mexican", flag: "🇲🇽" },
  { code: "BR", label: "Brazilian", flag: "🇧🇷" },
  { code: "AR", label: "Argentinian", flag: "🇦🇷" },
  { code: "CL", label: "Chilean", flag: "🇨🇱" },
  { code: "CO", label: "Colombian", flag: "🇨🇴" },
  { code: "PE", label: "Peruvian", flag: "🇵🇪" },
  { code: "VE", label: "Venezuelan", flag: "🇻🇪" },
  { code: "UY", label: "Uruguayan", flag: "🇺🇾" },
  { code: "AU", label: "Australian", flag: "🇦🇺" },
  { code: "NZ", label: "New Zealander", flag: "🇳🇿" },
  { code: "JP", label: "Japanese", flag: "🇯🇵" },
  { code: "CN", label: "Chinese", flag: "🇨🇳" },
  { code: "KR", label: "South Korean", flag: "🇰🇷" },
  { code: "IN", label: "Indian", flag: "🇮🇳" },
  { code: "ID", label: "Indonesian", flag: "🇮🇩" },
  { code: "TH", label: "Thai", flag: "🇹🇭" },
  { code: "SG", label: "Singaporean", flag: "🇸🇬" },
  { code: "PH", label: "Filipino", flag: "🇵🇭" },
  { code: "VN", label: "Vietnamese", flag: "🇻🇳" },
  { code: "ZA", label: "South African", flag: "🇿🇦" },
];

/**
 * Resuelve la bandera (emoji) y el código ISO a partir del nombre de
 * nacionalidad (gentilicio en inglés o español · best-effort).
 *
 * Útil para enriquecer rendering de Registros donde `cliente.flag`
 * llega vacío (registros antiguos o creados sin selector ENG).
 *
 * Devuelve `{ flag: undefined, iso: undefined }` si no encuentra match.
 */
const ALIASES_ES_TO_LABEL: Record<string, string> = {
  "español": "Spanish", "española": "Spanish", "spanish": "Spanish",
  "francés": "French", "francesa": "French",
  "alemán": "German", "alemana": "German",
  "italiano": "Italian", "italiana": "Italian",
  "portugués": "Portuguese", "portuguesa": "Portuguese",
  "inglés": "British", "inglesa": "British", "británico": "British", "británica": "British",
  "estadounidense": "American", "americano": "American", "americana": "American",
  "ruso": "Russian", "rusa": "Russian",
  "marroquí": "Moroccan",
  "argentino": "Argentinian", "argentina": "Argentinian",
  "mexicano": "Mexican", "mexicana": "Mexican",
  "chino": "Chinese", "china": "Chinese",
  "holandés": "Dutch", "holandesa": "Dutch", "neerlandés": "Dutch", "neerlandesa": "Dutch",
  "belga": "Belgian", "suizo": "Swiss", "suiza": "Swiss",
};

export function resolveNationality(input: string | undefined): {
  flag: string | undefined;
  iso: string | undefined;
} {
  if (!input) return { flag: undefined, iso: undefined };
  const norm = input.trim().toLowerCase();
  /* 1. Match directo · label inglés (forma canónica del catálogo). */
  const direct = NATIONALITIES.find((n) => n.label.toLowerCase() === norm);
  if (direct) return { flag: direct.flag, iso: direct.code };
  /* 2. Match por código ISO. */
  const byCode = NATIONALITIES.find((n) => n.code.toLowerCase() === norm);
  if (byCode) return { flag: byCode.flag, iso: byCode.code };
  /* 3. Match por alias español → label inglés. */
  const aliasLabel = ALIASES_ES_TO_LABEL[norm];
  if (aliasLabel) {
    const found = NATIONALITIES.find((n) => n.label === aliasLabel);
    if (found) return { flag: found.flag, iso: found.code };
  }
  return { flag: undefined, iso: undefined };
}
