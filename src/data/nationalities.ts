/** Nationality list (demonyms in English) used by the client registration dialog.
 *
 *  Bandera · NO se guarda emoji (Windows no los renderiza). El campo
 *  `code` es ISO 3166-1 alpha-2 · pásalo a `<Flag iso={n.code} />`
 *  (`src/components/ui/Flag.tsx`) para renderizar la bandera SVG.
 */
export const NATIONALITIES: { code: string; label: string }[] = [
  { code: "ES", label: "Spanish" },
  { code: "GB", label: "British" },
  { code: "IE", label: "Irish" },
  { code: "FR", label: "French" },
  { code: "DE", label: "German" },
  { code: "IT", label: "Italian" },
  { code: "PT", label: "Portuguese" },
  { code: "NL", label: "Dutch" },
  { code: "BE", label: "Belgian" },
  { code: "LU", label: "Luxembourgish" },
  { code: "CH", label: "Swiss" },
  { code: "AT", label: "Austrian" },
  { code: "DK", label: "Danish" },
  { code: "SE", label: "Swedish" },
  { code: "NO", label: "Norwegian" },
  { code: "FI", label: "Finnish" },
  { code: "IS", label: "Icelandic" },
  { code: "PL", label: "Polish" },
  { code: "CZ", label: "Czech" },
  { code: "SK", label: "Slovak" },
  { code: "HU", label: "Hungarian" },
  { code: "RO", label: "Romanian" },
  { code: "BG", label: "Bulgarian" },
  { code: "GR", label: "Greek" },
  { code: "HR", label: "Croatian" },
  { code: "SI", label: "Slovenian" },
  { code: "RS", label: "Serbian" },
  { code: "EE", label: "Estonian" },
  { code: "LV", label: "Latvian" },
  { code: "LT", label: "Lithuanian" },
  { code: "RU", label: "Russian" },
  { code: "UA", label: "Ukrainian" },
  { code: "TR", label: "Turkish" },
  { code: "MA", label: "Moroccan" },
  { code: "AE", label: "Emirati" },
  { code: "SA", label: "Saudi" },
  { code: "QA", label: "Qatari" },
  { code: "KW", label: "Kuwaiti" },
  { code: "IL", label: "Israeli" },
  { code: "US", label: "American" },
  { code: "CA", label: "Canadian" },
  { code: "MX", label: "Mexican" },
  { code: "BR", label: "Brazilian" },
  { code: "AR", label: "Argentinian" },
  { code: "CL", label: "Chilean" },
  { code: "CO", label: "Colombian" },
  { code: "PE", label: "Peruvian" },
  { code: "VE", label: "Venezuelan" },
  { code: "UY", label: "Uruguayan" },
  { code: "AU", label: "Australian" },
  { code: "NZ", label: "New Zealander" },
  { code: "JP", label: "Japanese" },
  { code: "CN", label: "Chinese" },
  { code: "KR", label: "South Korean" },
  { code: "IN", label: "Indian" },
  { code: "ID", label: "Indonesian" },
  { code: "TH", label: "Thai" },
  { code: "SG", label: "Singaporean" },
  { code: "PH", label: "Filipino" },
  { code: "VN", label: "Vietnamese" },
  { code: "ZA", label: "South African" },
];

/**
 * Resuelve el ISO 3166-1 alpha-2 a partir del nombre de nacionalidad
 * (gentilicio en inglés o español · best-effort).
 *
 * Útil para enriquecer rendering de Registros donde `cliente.nationalityIso`
 * llega vacío (registros antiguos o creados sin selector ENG).
 *
 * Devuelve `{ iso: undefined }` si no encuentra match · el componente
 * `<Flag iso={undefined}>` muestra el globo de fallback.
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
  iso: string | undefined;
} {
  if (!input) return { iso: undefined };
  const norm = input.trim().toLowerCase();
  /* 1. Match directo · label inglés (forma canónica del catálogo). */
  const direct = NATIONALITIES.find((n) => n.label.toLowerCase() === norm);
  if (direct) return { iso: direct.code };
  /* 2. Match por código ISO. */
  const byCode = NATIONALITIES.find((n) => n.code.toLowerCase() === norm);
  if (byCode) return { iso: byCode.code };
  /* 3. Match por alias español → label inglés. */
  const aliasLabel = ALIASES_ES_TO_LABEL[norm];
  if (aliasLabel) {
    const found = NATIONALITIES.find((n) => n.label === aliasLabel);
    if (found) return { iso: found.code };
  }
  return { iso: undefined };
}
