/**
 * Catálogo de países con prefijo telefónico y bandera.
 *
 * Cobertura ISO 3166-1 · incluye estados soberanos + territorios
 * dependientes con prefijo propio. Ordenado por regiones con España
 * primero (mercado principal de Byvaro) y luego UE → nórdicos →
 * Europa Central/Este → Cáucaso/Asia Central → Oriente Medio → África
 * → América → Asia-Pacífico → Oceanía → Caribe → territorios.
 *
 * Muchas entradas del NANP (EEUU, Canadá, Puerto Rico, Jamaica, etc.)
 * comparten prefijo "+1" · el detector marca `ambiguous` cuando el
 * prefijo tiene ≥2 matches para que el admin elija manualmente.
 *
 * Para autocompletado: el dropdown busca por nombre (ES y EN), por
 * código ISO o por prefijo (con o sin "+").
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
  { iso: "ES", name: "España",          nameEn: "Spain",          prefix: "34",  flag: "🇪🇸" },
  { iso: "PT", name: "Portugal",        nameEn: "Portugal",       prefix: "351", flag: "🇵🇹" },
  { iso: "FR", name: "Francia",         nameEn: "France",         prefix: "33",  flag: "🇫🇷" },
  { iso: "AD", name: "Andorra",         nameEn: "Andorra",        prefix: "376", flag: "🇦🇩" },
  { iso: "GI", name: "Gibraltar",       nameEn: "Gibraltar",      prefix: "350", flag: "🇬🇮" },

  // ── Europa Occidental ──
  { iso: "GB", name: "Reino Unido",     nameEn: "United Kingdom", prefix: "44",  flag: "🇬🇧" },
  { iso: "IE", name: "Irlanda",         nameEn: "Ireland",        prefix: "353", flag: "🇮🇪" },
  { iso: "DE", name: "Alemania",        nameEn: "Germany",        prefix: "49",  flag: "🇩🇪" },
  { iso: "NL", name: "Países Bajos",    nameEn: "Netherlands",    prefix: "31",  flag: "🇳🇱" },
  { iso: "BE", name: "Bélgica",         nameEn: "Belgium",        prefix: "32",  flag: "🇧🇪" },
  { iso: "LU", name: "Luxemburgo",      nameEn: "Luxembourg",     prefix: "352", flag: "🇱🇺" },
  { iso: "CH", name: "Suiza",           nameEn: "Switzerland",    prefix: "41",  flag: "🇨🇭" },
  { iso: "AT", name: "Austria",         nameEn: "Austria",        prefix: "43",  flag: "🇦🇹" },
  { iso: "IT", name: "Italia",          nameEn: "Italy",          prefix: "39",  flag: "🇮🇹" },
  { iso: "MT", name: "Malta",           nameEn: "Malta",          prefix: "356", flag: "🇲🇹" },
  { iso: "MC", name: "Mónaco",          nameEn: "Monaco",         prefix: "377", flag: "🇲🇨" },
  { iso: "LI", name: "Liechtenstein",   nameEn: "Liechtenstein",  prefix: "423", flag: "🇱🇮" },
  { iso: "SM", name: "San Marino",      nameEn: "San Marino",     prefix: "378", flag: "🇸🇲" },
  { iso: "VA", name: "Ciudad del Vaticano", nameEn: "Vatican",    prefix: "379", flag: "🇻🇦" },
  { iso: "IM", name: "Isla de Man",     nameEn: "Isle of Man",    prefix: "44",  flag: "🇮🇲" },
  { iso: "JE", name: "Jersey",          nameEn: "Jersey",         prefix: "44",  flag: "🇯🇪" },
  { iso: "GG", name: "Guernsey",        nameEn: "Guernsey",       prefix: "44",  flag: "🇬🇬" },
  { iso: "FO", name: "Islas Feroe",     nameEn: "Faroe Islands",  prefix: "298", flag: "🇫🇴" },

  // ── Nórdicos y Bálticos ──
  { iso: "SE", name: "Suecia",          nameEn: "Sweden",         prefix: "46",  flag: "🇸🇪" },
  { iso: "NO", name: "Noruega",         nameEn: "Norway",         prefix: "47",  flag: "🇳🇴" },
  { iso: "DK", name: "Dinamarca",       nameEn: "Denmark",        prefix: "45",  flag: "🇩🇰" },
  { iso: "FI", name: "Finlandia",       nameEn: "Finland",        prefix: "358", flag: "🇫🇮" },
  { iso: "IS", name: "Islandia",        nameEn: "Iceland",        prefix: "354", flag: "🇮🇸" },
  { iso: "EE", name: "Estonia",         nameEn: "Estonia",        prefix: "372", flag: "🇪🇪" },
  { iso: "LV", name: "Letonia",         nameEn: "Latvia",         prefix: "371", flag: "🇱🇻" },
  { iso: "LT", name: "Lituania",        nameEn: "Lithuania",      prefix: "370", flag: "🇱🇹" },
  { iso: "GL", name: "Groenlandia",     nameEn: "Greenland",      prefix: "299", flag: "🇬🇱" },
  { iso: "AX", name: "Islas Åland",     nameEn: "Åland Islands",  prefix: "358", flag: "🇦🇽" },
  { iso: "SJ", name: "Svalbard y Jan Mayen", nameEn: "Svalbard",  prefix: "47",  flag: "🇸🇯" },

  // ── Europa Central / Este / Balcanes ──
  { iso: "PL", name: "Polonia",         nameEn: "Poland",         prefix: "48",  flag: "🇵🇱" },
  { iso: "CZ", name: "Chequia",         nameEn: "Czechia",        prefix: "420", flag: "🇨🇿" },
  { iso: "SK", name: "Eslovaquia",      nameEn: "Slovakia",       prefix: "421", flag: "🇸🇰" },
  { iso: "HU", name: "Hungría",         nameEn: "Hungary",        prefix: "36",  flag: "🇭🇺" },
  { iso: "RO", name: "Rumanía",         nameEn: "Romania",        prefix: "40",  flag: "🇷🇴" },
  { iso: "BG", name: "Bulgaria",        nameEn: "Bulgaria",       prefix: "359", flag: "🇧🇬" },
  { iso: "SI", name: "Eslovenia",       nameEn: "Slovenia",       prefix: "386", flag: "🇸🇮" },
  { iso: "HR", name: "Croacia",         nameEn: "Croatia",        prefix: "385", flag: "🇭🇷" },
  { iso: "BA", name: "Bosnia y Herzegovina", nameEn: "Bosnia and Herzegovina", prefix: "387", flag: "🇧🇦" },
  { iso: "RS", name: "Serbia",          nameEn: "Serbia",         prefix: "381", flag: "🇷🇸" },
  { iso: "ME", name: "Montenegro",      nameEn: "Montenegro",     prefix: "382", flag: "🇲🇪" },
  { iso: "MK", name: "Macedonia del Norte", nameEn: "North Macedonia", prefix: "389", flag: "🇲🇰" },
  { iso: "AL", name: "Albania",         nameEn: "Albania",        prefix: "355", flag: "🇦🇱" },
  { iso: "XK", name: "Kosovo",          nameEn: "Kosovo",         prefix: "383", flag: "🇽🇰" },
  { iso: "MD", name: "Moldavia",        nameEn: "Moldova",        prefix: "373", flag: "🇲🇩" },
  { iso: "CY", name: "Chipre",          nameEn: "Cyprus",         prefix: "357", flag: "🇨🇾" },
  { iso: "GR", name: "Grecia",          nameEn: "Greece",         prefix: "30",  flag: "🇬🇷" },
  { iso: "TR", name: "Turquía",         nameEn: "Turkey",         prefix: "90",  flag: "🇹🇷" },
  { iso: "RU", name: "Rusia",           nameEn: "Russia",         prefix: "7",   flag: "🇷🇺" },
  { iso: "UA", name: "Ucrania",         nameEn: "Ukraine",        prefix: "380", flag: "🇺🇦" },
  { iso: "BY", name: "Bielorrusia",     nameEn: "Belarus",        prefix: "375", flag: "🇧🇾" },

  // ── Cáucaso y Asia Central ──
  { iso: "AM", name: "Armenia",         nameEn: "Armenia",        prefix: "374", flag: "🇦🇲" },
  { iso: "GE", name: "Georgia",         nameEn: "Georgia",        prefix: "995", flag: "🇬🇪" },
  { iso: "AZ", name: "Azerbaiyán",      nameEn: "Azerbaijan",     prefix: "994", flag: "🇦🇿" },
  { iso: "KZ", name: "Kazajistán",      nameEn: "Kazakhstan",     prefix: "7",   flag: "🇰🇿" },
  { iso: "UZ", name: "Uzbekistán",      nameEn: "Uzbekistan",     prefix: "998", flag: "🇺🇿" },
  { iso: "KG", name: "Kirguistán",      nameEn: "Kyrgyzstan",     prefix: "996", flag: "🇰🇬" },
  { iso: "TJ", name: "Tayikistán",      nameEn: "Tajikistan",     prefix: "992", flag: "🇹🇯" },
  { iso: "TM", name: "Turkmenistán",    nameEn: "Turkmenistan",   prefix: "993", flag: "🇹🇲" },
  { iso: "MN", name: "Mongolia",        nameEn: "Mongolia",       prefix: "976", flag: "🇲🇳" },
  { iso: "AF", name: "Afganistán",      nameEn: "Afghanistan",    prefix: "93",  flag: "🇦🇫" },

  // ── Oriente Medio ──
  { iso: "AE", name: "Emiratos Árabes Unidos", nameEn: "UAE",     prefix: "971", flag: "🇦🇪" },
  { iso: "SA", name: "Arabia Saudí",    nameEn: "Saudi Arabia",   prefix: "966", flag: "🇸🇦" },
  { iso: "QA", name: "Catar",           nameEn: "Qatar",          prefix: "974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait",          nameEn: "Kuwait",         prefix: "965", flag: "🇰🇼" },
  { iso: "BH", name: "Baréin",          nameEn: "Bahrain",        prefix: "973", flag: "🇧🇭" },
  { iso: "OM", name: "Omán",            nameEn: "Oman",           prefix: "968", flag: "🇴🇲" },
  { iso: "IL", name: "Israel",          nameEn: "Israel",         prefix: "972", flag: "🇮🇱" },
  { iso: "PS", name: "Palestina",       nameEn: "Palestine",      prefix: "970", flag: "🇵🇸" },
  { iso: "JO", name: "Jordania",        nameEn: "Jordan",         prefix: "962", flag: "🇯🇴" },
  { iso: "LB", name: "Líbano",          nameEn: "Lebanon",        prefix: "961", flag: "🇱🇧" },
  { iso: "SY", name: "Siria",           nameEn: "Syria",          prefix: "963", flag: "🇸🇾" },
  { iso: "IQ", name: "Irak",            nameEn: "Iraq",           prefix: "964", flag: "🇮🇶" },
  { iso: "IR", name: "Irán",            nameEn: "Iran",           prefix: "98",  flag: "🇮🇷" },
  { iso: "YE", name: "Yemen",           nameEn: "Yemen",          prefix: "967", flag: "🇾🇪" },

  // ── Magreb y Norte de África ──
  { iso: "EG", name: "Egipto",          nameEn: "Egypt",          prefix: "20",  flag: "🇪🇬" },
  { iso: "MA", name: "Marruecos",       nameEn: "Morocco",        prefix: "212", flag: "🇲🇦" },
  { iso: "TN", name: "Túnez",           nameEn: "Tunisia",        prefix: "216", flag: "🇹🇳" },
  { iso: "DZ", name: "Argelia",         nameEn: "Algeria",        prefix: "213", flag: "🇩🇿" },
  { iso: "LY", name: "Libia",           nameEn: "Libya",          prefix: "218", flag: "🇱🇾" },
  { iso: "SD", name: "Sudán",           nameEn: "Sudan",          prefix: "249", flag: "🇸🇩" },
  { iso: "SS", name: "Sudán del Sur",   nameEn: "South Sudan",    prefix: "211", flag: "🇸🇸" },
  { iso: "EH", name: "Sáhara Occidental", nameEn: "Western Sahara", prefix: "212", flag: "🇪🇭" },

  // ── África Occidental ──
  { iso: "NG", name: "Nigeria",         nameEn: "Nigeria",        prefix: "234", flag: "🇳🇬" },
  { iso: "GH", name: "Ghana",           nameEn: "Ghana",          prefix: "233", flag: "🇬🇭" },
  { iso: "CI", name: "Costa de Marfil", nameEn: "Côte d'Ivoire",  prefix: "225", flag: "🇨🇮" },
  { iso: "SN", name: "Senegal",         nameEn: "Senegal",        prefix: "221", flag: "🇸🇳" },
  { iso: "ML", name: "Malí",            nameEn: "Mali",           prefix: "223", flag: "🇲🇱" },
  { iso: "BF", name: "Burkina Faso",    nameEn: "Burkina Faso",   prefix: "226", flag: "🇧🇫" },
  { iso: "NE", name: "Níger",           nameEn: "Niger",          prefix: "227", flag: "🇳🇪" },
  { iso: "TG", name: "Togo",            nameEn: "Togo",           prefix: "228", flag: "🇹🇬" },
  { iso: "BJ", name: "Benín",           nameEn: "Benin",          prefix: "229", flag: "🇧🇯" },
  { iso: "GN", name: "Guinea",          nameEn: "Guinea",         prefix: "224", flag: "🇬🇳" },
  { iso: "GW", name: "Guinea-Bisáu",    nameEn: "Guinea-Bissau",  prefix: "245", flag: "🇬🇼" },
  { iso: "SL", name: "Sierra Leona",    nameEn: "Sierra Leone",   prefix: "232", flag: "🇸🇱" },
  { iso: "LR", name: "Liberia",         nameEn: "Liberia",        prefix: "231", flag: "🇱🇷" },
  { iso: "GM", name: "Gambia",          nameEn: "Gambia",         prefix: "220", flag: "🇬🇲" },
  { iso: "CV", name: "Cabo Verde",      nameEn: "Cabo Verde",     prefix: "238", flag: "🇨🇻" },
  { iso: "MR", name: "Mauritania",      nameEn: "Mauritania",     prefix: "222", flag: "🇲🇷" },
  { iso: "ST", name: "Santo Tomé y Príncipe", nameEn: "São Tomé and Príncipe", prefix: "239", flag: "🇸🇹" },

  // ── África Central ──
  { iso: "CM", name: "Camerún",         nameEn: "Cameroon",       prefix: "237", flag: "🇨🇲" },
  { iso: "CF", name: "República Centroafricana", nameEn: "Central African Republic", prefix: "236", flag: "🇨🇫" },
  { iso: "TD", name: "Chad",            nameEn: "Chad",           prefix: "235", flag: "🇹🇩" },
  { iso: "GA", name: "Gabón",           nameEn: "Gabon",          prefix: "241", flag: "🇬🇦" },
  { iso: "CG", name: "República del Congo", nameEn: "Republic of the Congo", prefix: "242", flag: "🇨🇬" },
  { iso: "CD", name: "Rep. Dem. del Congo", nameEn: "DR Congo",   prefix: "243", flag: "🇨🇩" },
  { iso: "AO", name: "Angola",          nameEn: "Angola",         prefix: "244", flag: "🇦🇴" },
  { iso: "GQ", name: "Guinea Ecuatorial", nameEn: "Equatorial Guinea", prefix: "240", flag: "🇬🇶" },

  // ── África Oriental ──
  { iso: "KE", name: "Kenia",           nameEn: "Kenya",          prefix: "254", flag: "🇰🇪" },
  { iso: "ET", name: "Etiopía",         nameEn: "Ethiopia",       prefix: "251", flag: "🇪🇹" },
  { iso: "ER", name: "Eritrea",         nameEn: "Eritrea",        prefix: "291", flag: "🇪🇷" },
  { iso: "DJ", name: "Yibuti",          nameEn: "Djibouti",       prefix: "253", flag: "🇩🇯" },
  { iso: "SO", name: "Somalia",         nameEn: "Somalia",        prefix: "252", flag: "🇸🇴" },
  { iso: "UG", name: "Uganda",          nameEn: "Uganda",         prefix: "256", flag: "🇺🇬" },
  { iso: "TZ", name: "Tanzania",        nameEn: "Tanzania",       prefix: "255", flag: "🇹🇿" },
  { iso: "RW", name: "Ruanda",          nameEn: "Rwanda",         prefix: "250", flag: "🇷🇼" },
  { iso: "BI", name: "Burundi",         nameEn: "Burundi",        prefix: "257", flag: "🇧🇮" },
  { iso: "MG", name: "Madagascar",      nameEn: "Madagascar",     prefix: "261", flag: "🇲🇬" },
  { iso: "MU", name: "Mauricio",        nameEn: "Mauritius",      prefix: "230", flag: "🇲🇺" },
  { iso: "SC", name: "Seychelles",      nameEn: "Seychelles",     prefix: "248", flag: "🇸🇨" },
  { iso: "KM", name: "Comoras",         nameEn: "Comoros",        prefix: "269", flag: "🇰🇲" },
  { iso: "RE", name: "Reunión",         nameEn: "Réunion",        prefix: "262", flag: "🇷🇪" },
  { iso: "YT", name: "Mayotte",         nameEn: "Mayotte",        prefix: "262", flag: "🇾🇹" },

  // ── África Austral ──
  { iso: "ZA", name: "Sudáfrica",       nameEn: "South Africa",   prefix: "27",  flag: "🇿🇦" },
  { iso: "MZ", name: "Mozambique",      nameEn: "Mozambique",     prefix: "258", flag: "🇲🇿" },
  { iso: "ZW", name: "Zimbabue",        nameEn: "Zimbabwe",       prefix: "263", flag: "🇿🇼" },
  { iso: "NA", name: "Namibia",         nameEn: "Namibia",        prefix: "264", flag: "🇳🇦" },
  { iso: "BW", name: "Botsuana",        nameEn: "Botswana",       prefix: "267", flag: "🇧🇼" },
  { iso: "ZM", name: "Zambia",          nameEn: "Zambia",         prefix: "260", flag: "🇿🇲" },
  { iso: "MW", name: "Malaui",          nameEn: "Malawi",         prefix: "265", flag: "🇲🇼" },
  { iso: "LS", name: "Lesoto",          nameEn: "Lesotho",        prefix: "266", flag: "🇱🇸" },
  { iso: "SZ", name: "Esuatini",        nameEn: "Eswatini",       prefix: "268", flag: "🇸🇿" },

  // ── América del Norte ──
  { iso: "US", name: "Estados Unidos",  nameEn: "United States",  prefix: "1",   flag: "🇺🇸" },
  { iso: "CA", name: "Canadá",          nameEn: "Canada",         prefix: "1",   flag: "🇨🇦" },
  { iso: "MX", name: "México",          nameEn: "Mexico",         prefix: "52",  flag: "🇲🇽" },

  // ── América Central ──
  { iso: "GT", name: "Guatemala",       nameEn: "Guatemala",      prefix: "502", flag: "🇬🇹" },
  { iso: "SV", name: "El Salvador",     nameEn: "El Salvador",    prefix: "503", flag: "🇸🇻" },
  { iso: "HN", name: "Honduras",        nameEn: "Honduras",       prefix: "504", flag: "🇭🇳" },
  { iso: "NI", name: "Nicaragua",       nameEn: "Nicaragua",      prefix: "505", flag: "🇳🇮" },
  { iso: "CR", name: "Costa Rica",      nameEn: "Costa Rica",     prefix: "506", flag: "🇨🇷" },
  { iso: "PA", name: "Panamá",          nameEn: "Panama",         prefix: "507", flag: "🇵🇦" },
  { iso: "BZ", name: "Belice",          nameEn: "Belize",         prefix: "501", flag: "🇧🇿" },

  // ── Caribe (NANP +1) ──
  { iso: "CU", name: "Cuba",            nameEn: "Cuba",           prefix: "53",  flag: "🇨🇺" },
  { iso: "DO", name: "Rep. Dominicana", nameEn: "Dominican Republic", prefix: "1", flag: "🇩🇴" },
  { iso: "PR", name: "Puerto Rico",     nameEn: "Puerto Rico",    prefix: "1",   flag: "🇵🇷" },
  { iso: "HT", name: "Haití",           nameEn: "Haiti",          prefix: "509", flag: "🇭🇹" },
  { iso: "JM", name: "Jamaica",         nameEn: "Jamaica",        prefix: "1",   flag: "🇯🇲" },
  { iso: "BS", name: "Bahamas",         nameEn: "Bahamas",        prefix: "1",   flag: "🇧🇸" },
  { iso: "BB", name: "Barbados",        nameEn: "Barbados",       prefix: "1",   flag: "🇧🇧" },
  { iso: "TT", name: "Trinidad y Tobago", nameEn: "Trinidad and Tobago", prefix: "1", flag: "🇹🇹" },
  { iso: "AG", name: "Antigua y Barbuda", nameEn: "Antigua and Barbuda", prefix: "1", flag: "🇦🇬" },
  { iso: "DM", name: "Dominica",        nameEn: "Dominica",       prefix: "1",   flag: "🇩🇲" },
  { iso: "GD", name: "Granada",         nameEn: "Grenada",        prefix: "1",   flag: "🇬🇩" },
  { iso: "KN", name: "San Cristóbal y Nieves", nameEn: "Saint Kitts and Nevis", prefix: "1", flag: "🇰🇳" },
  { iso: "LC", name: "Santa Lucía",     nameEn: "Saint Lucia",    prefix: "1",   flag: "🇱🇨" },
  { iso: "VC", name: "San Vicente y las Granadinas", nameEn: "Saint Vincent", prefix: "1", flag: "🇻🇨" },
  { iso: "AI", name: "Anguila",         nameEn: "Anguilla",       prefix: "1",   flag: "🇦🇮" },
  { iso: "VG", name: "Islas Vírgenes Británicas", nameEn: "British Virgin Islands", prefix: "1", flag: "🇻🇬" },
  { iso: "VI", name: "Islas Vírgenes EE.UU.", nameEn: "U.S. Virgin Islands", prefix: "1", flag: "🇻🇮" },
  { iso: "KY", name: "Islas Caimán",    nameEn: "Cayman Islands", prefix: "1",   flag: "🇰🇾" },
  { iso: "BM", name: "Bermudas",        nameEn: "Bermuda",        prefix: "1",   flag: "🇧🇲" },
  { iso: "TC", name: "Islas Turcas y Caicos", nameEn: "Turks and Caicos", prefix: "1", flag: "🇹🇨" },
  { iso: "MS", name: "Montserrat",      nameEn: "Montserrat",     prefix: "1",   flag: "🇲🇸" },
  { iso: "AW", name: "Aruba",           nameEn: "Aruba",          prefix: "297", flag: "🇦🇼" },
  { iso: "CW", name: "Curazao",         nameEn: "Curaçao",        prefix: "599", flag: "🇨🇼" },
  { iso: "SX", name: "San Martín (Neerlandés)", nameEn: "Sint Maarten", prefix: "1", flag: "🇸🇽" },
  { iso: "MF", name: "San Martín (Francés)", nameEn: "Saint Martin", prefix: "590", flag: "🇲🇫" },
  { iso: "BL", name: "San Bartolomé",   nameEn: "Saint Barthélemy", prefix: "590", flag: "🇧🇱" },
  { iso: "GP", name: "Guadalupe",       nameEn: "Guadeloupe",     prefix: "590", flag: "🇬🇵" },
  { iso: "MQ", name: "Martinica",       nameEn: "Martinique",     prefix: "596", flag: "🇲🇶" },
  { iso: "BQ", name: "Caribe Neerlandés", nameEn: "Caribbean Netherlands", prefix: "599", flag: "🇧🇶" },

  // ── América del Sur ──
  { iso: "BR", name: "Brasil",          nameEn: "Brazil",         prefix: "55",  flag: "🇧🇷" },
  { iso: "AR", name: "Argentina",       nameEn: "Argentina",      prefix: "54",  flag: "🇦🇷" },
  { iso: "CL", name: "Chile",           nameEn: "Chile",          prefix: "56",  flag: "🇨🇱" },
  { iso: "CO", name: "Colombia",        nameEn: "Colombia",       prefix: "57",  flag: "🇨🇴" },
  { iso: "PE", name: "Perú",            nameEn: "Peru",           prefix: "51",  flag: "🇵🇪" },
  { iso: "UY", name: "Uruguay",         nameEn: "Uruguay",        prefix: "598", flag: "🇺🇾" },
  { iso: "VE", name: "Venezuela",       nameEn: "Venezuela",      prefix: "58",  flag: "🇻🇪" },
  { iso: "BO", name: "Bolivia",         nameEn: "Bolivia",        prefix: "591", flag: "🇧🇴" },
  { iso: "PY", name: "Paraguay",        nameEn: "Paraguay",       prefix: "595", flag: "🇵🇾" },
  { iso: "EC", name: "Ecuador",         nameEn: "Ecuador",        prefix: "593", flag: "🇪🇨" },
  { iso: "GY", name: "Guyana",          nameEn: "Guyana",         prefix: "592", flag: "🇬🇾" },
  { iso: "SR", name: "Surinam",         nameEn: "Suriname",       prefix: "597", flag: "🇸🇷" },
  { iso: "GF", name: "Guayana Francesa", nameEn: "French Guiana", prefix: "594", flag: "🇬🇫" },
  { iso: "FK", name: "Islas Malvinas",  nameEn: "Falkland Islands", prefix: "500", flag: "🇫🇰" },

  // ── Asia Oriental ──
  { iso: "CN", name: "China",           nameEn: "China",          prefix: "86",  flag: "🇨🇳" },
  { iso: "JP", name: "Japón",           nameEn: "Japan",          prefix: "81",  flag: "🇯🇵" },
  { iso: "KR", name: "Corea del Sur",   nameEn: "South Korea",    prefix: "82",  flag: "🇰🇷" },
  { iso: "KP", name: "Corea del Norte", nameEn: "North Korea",    prefix: "850", flag: "🇰🇵" },
  { iso: "HK", name: "Hong Kong",       nameEn: "Hong Kong",      prefix: "852", flag: "🇭🇰" },
  { iso: "MO", name: "Macao",           nameEn: "Macao",          prefix: "853", flag: "🇲🇴" },
  { iso: "TW", name: "Taiwán",          nameEn: "Taiwan",         prefix: "886", flag: "🇹🇼" },

  // ── Asia del Sur ──
  { iso: "IN", name: "India",           nameEn: "India",          prefix: "91",  flag: "🇮🇳" },
  { iso: "PK", name: "Pakistán",        nameEn: "Pakistan",       prefix: "92",  flag: "🇵🇰" },
  { iso: "BD", name: "Bangladés",       nameEn: "Bangladesh",     prefix: "880", flag: "🇧🇩" },
  { iso: "LK", name: "Sri Lanka",       nameEn: "Sri Lanka",      prefix: "94",  flag: "🇱🇰" },
  { iso: "NP", name: "Nepal",           nameEn: "Nepal",          prefix: "977", flag: "🇳🇵" },
  { iso: "BT", name: "Bután",           nameEn: "Bhutan",         prefix: "975", flag: "🇧🇹" },
  { iso: "MV", name: "Maldivas",        nameEn: "Maldives",       prefix: "960", flag: "🇲🇻" },

  // ── Sudeste Asiático ──
  { iso: "ID", name: "Indonesia",       nameEn: "Indonesia",      prefix: "62",  flag: "🇮🇩" },
  { iso: "TH", name: "Tailandia",       nameEn: "Thailand",       prefix: "66",  flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam",         nameEn: "Vietnam",        prefix: "84",  flag: "🇻🇳" },
  { iso: "PH", name: "Filipinas",       nameEn: "Philippines",    prefix: "63",  flag: "🇵🇭" },
  { iso: "MY", name: "Malasia",         nameEn: "Malaysia",       prefix: "60",  flag: "🇲🇾" },
  { iso: "SG", name: "Singapur",        nameEn: "Singapore",      prefix: "65",  flag: "🇸🇬" },
  { iso: "MM", name: "Myanmar",         nameEn: "Myanmar",        prefix: "95",  flag: "🇲🇲" },
  { iso: "KH", name: "Camboya",         nameEn: "Cambodia",       prefix: "855", flag: "🇰🇭" },
  { iso: "LA", name: "Laos",            nameEn: "Laos",           prefix: "856", flag: "🇱🇦" },
  { iso: "BN", name: "Brunéi",          nameEn: "Brunei",         prefix: "673", flag: "🇧🇳" },
  { iso: "TL", name: "Timor Oriental",  nameEn: "Timor-Leste",    prefix: "670", flag: "🇹🇱" },

  // ── Oceanía ──
  { iso: "AU", name: "Australia",       nameEn: "Australia",      prefix: "61",  flag: "🇦🇺" },
  { iso: "NZ", name: "Nueva Zelanda",   nameEn: "New Zealand",    prefix: "64",  flag: "🇳🇿" },
  { iso: "PG", name: "Papúa Nueva Guinea", nameEn: "Papua New Guinea", prefix: "675", flag: "🇵🇬" },
  { iso: "FJ", name: "Fiyi",            nameEn: "Fiji",           prefix: "679", flag: "🇫🇯" },
  { iso: "SB", name: "Islas Salomón",   nameEn: "Solomon Islands", prefix: "677", flag: "🇸🇧" },
  { iso: "VU", name: "Vanuatu",         nameEn: "Vanuatu",        prefix: "678", flag: "🇻🇺" },
  { iso: "NC", name: "Nueva Caledonia", nameEn: "New Caledonia",  prefix: "687", flag: "🇳🇨" },
  { iso: "PF", name: "Polinesia Francesa", nameEn: "French Polynesia", prefix: "689", flag: "🇵🇫" },
  { iso: "WS", name: "Samoa",           nameEn: "Samoa",          prefix: "685", flag: "🇼🇸" },
  { iso: "TO", name: "Tonga",           nameEn: "Tonga",          prefix: "676", flag: "🇹🇴" },
  { iso: "KI", name: "Kiribati",        nameEn: "Kiribati",       prefix: "686", flag: "🇰🇮" },
  { iso: "NR", name: "Nauru",           nameEn: "Nauru",          prefix: "674", flag: "🇳🇷" },
  { iso: "TV", name: "Tuvalu",          nameEn: "Tuvalu",         prefix: "688", flag: "🇹🇻" },
  { iso: "FM", name: "Micronesia",      nameEn: "Micronesia",     prefix: "691", flag: "🇫🇲" },
  { iso: "MH", name: "Islas Marshall",  nameEn: "Marshall Islands", prefix: "692", flag: "🇲🇭" },
  { iso: "PW", name: "Palaos",          nameEn: "Palau",          prefix: "680", flag: "🇵🇼" },
  { iso: "CK", name: "Islas Cook",      nameEn: "Cook Islands",   prefix: "682", flag: "🇨🇰" },
  { iso: "NU", name: "Niue",            nameEn: "Niue",           prefix: "683", flag: "🇳🇺" },
  { iso: "TK", name: "Tokelau",         nameEn: "Tokelau",        prefix: "690", flag: "🇹🇰" },
  { iso: "WF", name: "Wallis y Futuna", nameEn: "Wallis and Futuna", prefix: "681", flag: "🇼🇫" },
  { iso: "GU", name: "Guam",            nameEn: "Guam",           prefix: "1",   flag: "🇬🇺" },
  { iso: "MP", name: "Islas Marianas del Norte", nameEn: "Northern Mariana Islands", prefix: "1", flag: "🇲🇵" },
  { iso: "AS", name: "Samoa Americana", nameEn: "American Samoa", prefix: "1",   flag: "🇦🇸" },
  { iso: "NF", name: "Isla Norfolk",    nameEn: "Norfolk Island", prefix: "672", flag: "🇳🇫" },
  { iso: "CX", name: "Isla de Navidad", nameEn: "Christmas Island", prefix: "61", flag: "🇨🇽" },
  { iso: "CC", name: "Islas Cocos",     nameEn: "Cocos Islands",  prefix: "61",  flag: "🇨🇨" },
  { iso: "PN", name: "Islas Pitcairn",  nameEn: "Pitcairn Islands", prefix: "64", flag: "🇵🇳" },

  // ── Atlántico / territorios varios ──
  { iso: "SH", name: "Santa Elena",     nameEn: "Saint Helena",   prefix: "290", flag: "🇸🇭" },
  { iso: "IO", name: "Territorio Británico del Océano Índico", nameEn: "British Indian Ocean Territory", prefix: "246", flag: "🇮🇴" },
  { iso: "TF", name: "Tierras Australes y Antárticas Francesas", nameEn: "French Southern Territories", prefix: "262", flag: "🇹🇫" },
  { iso: "AQ", name: "Antártida",       nameEn: "Antarctica",     prefix: "672", flag: "🇦🇶" },
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
