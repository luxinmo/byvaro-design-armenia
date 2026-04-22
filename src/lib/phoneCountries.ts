/**
 * Catálogo de países con prefijo telefónico y bandera.
 *
 * Curado para los mercados típicos de Byvaro (España + UE + Oriente
 * Medio + Latam + Cáucaso + apartados internacionales). Ordenado por
 * tracción esperada: España primero, luego UE, etc.
 *
 * Para autocompletado: el dropdown del PhoneInput busca por nombre
 * del país (ES y EN), por código ISO o por prefijo (con o sin "+").
 */

export type PhoneCountry = {
  /** Código ISO 3166-1 alpha-2. */
  iso: string;
  /** Nombre en español. */
  name: string;
  /** Nombre en inglés (para búsquedas). */
  nameEn: string;
  /** Prefijo internacional sin el "+". Ej: "34", "971". */
  prefix: string;
  /** Emoji bandera. */
  flag: string;
};

/* Bandera de fallback si la ISO no está. */
export const DEFAULT_PHONE_COUNTRY_ISO = "ES";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  // ── España y vecinos ──
  { iso: "ES", name: "España",          nameEn: "Spain",        prefix: "34",  flag: "🇪🇸" },
  { iso: "PT", name: "Portugal",        nameEn: "Portugal",     prefix: "351", flag: "🇵🇹" },
  { iso: "FR", name: "Francia",         nameEn: "France",       prefix: "33",  flag: "🇫🇷" },
  { iso: "AD", name: "Andorra",         nameEn: "Andorra",      prefix: "376", flag: "🇦🇩" },

  // ── Europa Occidental ──
  { iso: "GB", name: "Reino Unido",     nameEn: "United Kingdom", prefix: "44",  flag: "🇬🇧" },
  { iso: "IE", name: "Irlanda",         nameEn: "Ireland",      prefix: "353", flag: "🇮🇪" },
  { iso: "DE", name: "Alemania",        nameEn: "Germany",      prefix: "49",  flag: "🇩🇪" },
  { iso: "NL", name: "Países Bajos",    nameEn: "Netherlands",  prefix: "31",  flag: "🇳🇱" },
  { iso: "BE", name: "Bélgica",         nameEn: "Belgium",      prefix: "32",  flag: "🇧🇪" },
  { iso: "LU", name: "Luxemburgo",      nameEn: "Luxembourg",   prefix: "352", flag: "🇱🇺" },
  { iso: "CH", name: "Suiza",           nameEn: "Switzerland",  prefix: "41",  flag: "🇨🇭" },
  { iso: "AT", name: "Austria",         nameEn: "Austria",      prefix: "43",  flag: "🇦🇹" },
  { iso: "IT", name: "Italia",          nameEn: "Italy",        prefix: "39",  flag: "🇮🇹" },
  { iso: "MT", name: "Malta",           nameEn: "Malta",        prefix: "356", flag: "🇲🇹" },

  // ── Nórdicos ──
  { iso: "SE", name: "Suecia",          nameEn: "Sweden",       prefix: "46",  flag: "🇸🇪" },
  { iso: "NO", name: "Noruega",         nameEn: "Norway",       prefix: "47",  flag: "🇳🇴" },
  { iso: "DK", name: "Dinamarca",       nameEn: "Denmark",      prefix: "45",  flag: "🇩🇰" },
  { iso: "FI", name: "Finlandia",       nameEn: "Finland",      prefix: "358", flag: "🇫🇮" },
  { iso: "IS", name: "Islandia",        nameEn: "Iceland",      prefix: "354", flag: "🇮🇸" },

  // ── Europa Central / Este ──
  { iso: "PL", name: "Polonia",         nameEn: "Poland",       prefix: "48",  flag: "🇵🇱" },
  { iso: "CZ", name: "Chequia",         nameEn: "Czechia",      prefix: "420", flag: "🇨🇿" },
  { iso: "HU", name: "Hungría",         nameEn: "Hungary",      prefix: "36",  flag: "🇭🇺" },
  { iso: "RO", name: "Rumanía",         nameEn: "Romania",      prefix: "40",  flag: "🇷🇴" },
  { iso: "BG", name: "Bulgaria",        nameEn: "Bulgaria",     prefix: "359", flag: "🇧🇬" },
  { iso: "GR", name: "Grecia",          nameEn: "Greece",       prefix: "30",  flag: "🇬🇷" },
  { iso: "TR", name: "Turquía",         nameEn: "Turkey",       prefix: "90",  flag: "🇹🇷" },
  { iso: "RU", name: "Rusia",           nameEn: "Russia",       prefix: "7",   flag: "🇷🇺" },
  { iso: "UA", name: "Ucrania",         nameEn: "Ukraine",      prefix: "380", flag: "🇺🇦" },
  { iso: "BY", name: "Bielorrusia",     nameEn: "Belarus",      prefix: "375", flag: "🇧🇾" },

  // ── Cáucaso y Asia Central ──
  { iso: "AM", name: "Armenia",         nameEn: "Armenia",      prefix: "374", flag: "🇦🇲" },
  { iso: "GE", name: "Georgia",         nameEn: "Georgia",      prefix: "995", flag: "🇬🇪" },
  { iso: "AZ", name: "Azerbaiyán",      nameEn: "Azerbaijan",   prefix: "994", flag: "🇦🇿" },
  { iso: "KZ", name: "Kazajstán",       nameEn: "Kazakhstan",   prefix: "7",   flag: "🇰🇿" },

  // ── Oriente Medio y Magreb ──
  { iso: "AE", name: "Emiratos Árabes", nameEn: "UAE",          prefix: "971", flag: "🇦🇪" },
  { iso: "SA", name: "Arabia Saudí",    nameEn: "Saudi Arabia", prefix: "966", flag: "🇸🇦" },
  { iso: "QA", name: "Catar",           nameEn: "Qatar",        prefix: "974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait",          nameEn: "Kuwait",       prefix: "965", flag: "🇰🇼" },
  { iso: "BH", name: "Baréin",          nameEn: "Bahrain",      prefix: "973", flag: "🇧🇭" },
  { iso: "OM", name: "Omán",            nameEn: "Oman",         prefix: "968", flag: "🇴🇲" },
  { iso: "IL", name: "Israel",          nameEn: "Israel",       prefix: "972", flag: "🇮🇱" },
  { iso: "EG", name: "Egipto",          nameEn: "Egypt",        prefix: "20",  flag: "🇪🇬" },
  { iso: "MA", name: "Marruecos",       nameEn: "Morocco",      prefix: "212", flag: "🇲🇦" },
  { iso: "TN", name: "Túnez",           nameEn: "Tunisia",      prefix: "216", flag: "🇹🇳" },
  { iso: "DZ", name: "Argelia",         nameEn: "Algeria",      prefix: "213", flag: "🇩🇿" },

  // ── América ──
  { iso: "US", name: "Estados Unidos",  nameEn: "United States", prefix: "1",   flag: "🇺🇸" },
  { iso: "CA", name: "Canadá",          nameEn: "Canada",       prefix: "1",   flag: "🇨🇦" },
  { iso: "MX", name: "México",          nameEn: "Mexico",       prefix: "52",  flag: "🇲🇽" },
  { iso: "BR", name: "Brasil",          nameEn: "Brazil",       prefix: "55",  flag: "🇧🇷" },
  { iso: "AR", name: "Argentina",       nameEn: "Argentina",    prefix: "54",  flag: "🇦🇷" },
  { iso: "CL", name: "Chile",           nameEn: "Chile",        prefix: "56",  flag: "🇨🇱" },
  { iso: "CO", name: "Colombia",        nameEn: "Colombia",     prefix: "57",  flag: "🇨🇴" },
  { iso: "PE", name: "Perú",            nameEn: "Peru",         prefix: "51",  flag: "🇵🇪" },
  { iso: "UY", name: "Uruguay",         nameEn: "Uruguay",      prefix: "598", flag: "🇺🇾" },
  { iso: "VE", name: "Venezuela",       nameEn: "Venezuela",    prefix: "58",  flag: "🇻🇪" },

  // ── Asia-Pacífico ──
  { iso: "CN", name: "China",           nameEn: "China",        prefix: "86",  flag: "🇨🇳" },
  { iso: "JP", name: "Japón",           nameEn: "Japan",        prefix: "81",  flag: "🇯🇵" },
  { iso: "KR", name: "Corea del Sur",   nameEn: "South Korea",  prefix: "82",  flag: "🇰🇷" },
  { iso: "IN", name: "India",           nameEn: "India",        prefix: "91",  flag: "🇮🇳" },
  { iso: "ID", name: "Indonesia",       nameEn: "Indonesia",    prefix: "62",  flag: "🇮🇩" },
  { iso: "TH", name: "Tailandia",       nameEn: "Thailand",     prefix: "66",  flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam",         nameEn: "Vietnam",      prefix: "84",  flag: "🇻🇳" },
  { iso: "PH", name: "Filipinas",       nameEn: "Philippines",  prefix: "63",  flag: "🇵🇭" },
  { iso: "MY", name: "Malasia",         nameEn: "Malaysia",     prefix: "60",  flag: "🇲🇾" },
  { iso: "SG", name: "Singapur",        nameEn: "Singapore",    prefix: "65",  flag: "🇸🇬" },
  { iso: "HK", name: "Hong Kong",       nameEn: "Hong Kong",    prefix: "852", flag: "🇭🇰" },
  { iso: "TW", name: "Taiwán",          nameEn: "Taiwan",       prefix: "886", flag: "🇹🇼" },
  { iso: "PK", name: "Pakistán",        nameEn: "Pakistan",     prefix: "92",  flag: "🇵🇰" },

  // ── Oceanía y África ──
  { iso: "AU", name: "Australia",       nameEn: "Australia",    prefix: "61",  flag: "🇦🇺" },
  { iso: "NZ", name: "Nueva Zelanda",   nameEn: "New Zealand",  prefix: "64",  flag: "🇳🇿" },
  { iso: "ZA", name: "Sudáfrica",       nameEn: "South Africa", prefix: "27",  flag: "🇿🇦" },
  { iso: "NG", name: "Nigeria",         nameEn: "Nigeria",      prefix: "234", flag: "🇳🇬" },
  { iso: "KE", name: "Kenia",           nameEn: "Kenya",        prefix: "254", flag: "🇰🇪" },
];

/** Devuelve el país por iso (case-insensitive). */
export function findCountryByIso(iso: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.iso === iso.toUpperCase());
}

/**
 * Detecta el país a partir de un teléfono que empieza con "+".
 * Empareja con el prefijo más largo posible (ej: "+1 600..." es US,
 * pero "+44 7..." es GB y no AD aunque empiece con "4").
 */
export function detectCountryFromPhone(phone: string): PhoneCountry | undefined {
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return undefined;
  /* Ordenamos por longitud de prefijo descendente para emparejar el
   * prefijo más específico primero (ej. "351" antes que "35"). */
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((c) => cleaned.startsWith(c.prefix));
}

/** Quita el prefijo del número, devolviendo solo el local. */
export function stripPrefix(phone: string, country: PhoneCountry): string {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.startsWith(country.prefix) ? cleaned.slice(country.prefix.length) : cleaned;
}

/** Reconstruye el teléfono completo con el formato `+PREFIX NUMBER`. */
export function buildPhone(country: PhoneCountry, localNumber: string): string {
  const local = localNumber.replace(/\D/g, "");
  return local ? `+${country.prefix} ${local}` : "";
}
