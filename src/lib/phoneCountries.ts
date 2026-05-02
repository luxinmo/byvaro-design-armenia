/**
 * Catálogo de países con prefijo telefónico.
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
 * Bandera · NO se guarda emoji (Windows no los renderiza). El campo
 * `iso` es la fuente de verdad; pásalo a `<Flag iso={c.iso} />`
 * (`src/components/ui/Flag.tsx`) para renderizar la bandera SVG.
 *
 * Para autocompletado: el dropdown busca por nombre (ES y EN), por
 * código ISO o por prefijo (con o sin "+").
 */

export type PhoneCountry = {
  /** Código ISO 3166-1 alpha-2 · alimenta `<Flag iso={c.iso} />`. */
  iso: string;
  /** Nombre en español. */
  name: string;
  /** Nombre en inglés (para búsquedas). */
  nameEn: string;
  /** Prefijo internacional sin el "+". Ej: "34", "971". */
  prefix: string;
};

/* Bandera de fallback si la ISO no está. */
export const DEFAULT_PHONE_COUNTRY_ISO = "ES";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  // ── España y vecinos ──
  { iso: "ES", name: "España",          nameEn: "Spain",          prefix: "34" },
  { iso: "PT", name: "Portugal",        nameEn: "Portugal",       prefix: "351" },
  { iso: "FR", name: "Francia",         nameEn: "France",         prefix: "33" },
  { iso: "AD", name: "Andorra",         nameEn: "Andorra",        prefix: "376" },
  { iso: "GI", name: "Gibraltar",       nameEn: "Gibraltar",      prefix: "350" },

  // ── Europa Occidental ──
  { iso: "GB", name: "Reino Unido",     nameEn: "United Kingdom", prefix: "44" },
  { iso: "IE", name: "Irlanda",         nameEn: "Ireland",        prefix: "353" },
  { iso: "DE", name: "Alemania",        nameEn: "Germany",        prefix: "49" },
  { iso: "NL", name: "Países Bajos",    nameEn: "Netherlands",    prefix: "31" },
  { iso: "BE", name: "Bélgica",         nameEn: "Belgium",        prefix: "32" },
  { iso: "LU", name: "Luxemburgo",      nameEn: "Luxembourg",     prefix: "352" },
  { iso: "CH", name: "Suiza",           nameEn: "Switzerland",    prefix: "41" },
  { iso: "AT", name: "Austria",         nameEn: "Austria",        prefix: "43" },
  { iso: "IT", name: "Italia",          nameEn: "Italy",          prefix: "39" },
  { iso: "MT", name: "Malta",           nameEn: "Malta",          prefix: "356" },
  { iso: "MC", name: "Mónaco",          nameEn: "Monaco",         prefix: "377" },
  { iso: "LI", name: "Liechtenstein",   nameEn: "Liechtenstein",  prefix: "423" },
  { iso: "SM", name: "San Marino",      nameEn: "San Marino",     prefix: "378" },
  { iso: "VA", name: "Ciudad del Vaticano", nameEn: "Vatican",    prefix: "379" },
  { iso: "IM", name: "Isla de Man",     nameEn: "Isle of Man",    prefix: "44" },
  { iso: "JE", name: "Jersey",          nameEn: "Jersey",         prefix: "44" },
  { iso: "GG", name: "Guernsey",        nameEn: "Guernsey",       prefix: "44" },
  { iso: "FO", name: "Islas Feroe",     nameEn: "Faroe Islands",  prefix: "298" },

  // ── Nórdicos y Bálticos ──
  { iso: "SE", name: "Suecia",          nameEn: "Sweden",         prefix: "46" },
  { iso: "NO", name: "Noruega",         nameEn: "Norway",         prefix: "47" },
  { iso: "DK", name: "Dinamarca",       nameEn: "Denmark",        prefix: "45" },
  { iso: "FI", name: "Finlandia",       nameEn: "Finland",        prefix: "358" },
  { iso: "IS", name: "Islandia",        nameEn: "Iceland",        prefix: "354" },
  { iso: "EE", name: "Estonia",         nameEn: "Estonia",        prefix: "372" },
  { iso: "LV", name: "Letonia",         nameEn: "Latvia",         prefix: "371" },
  { iso: "LT", name: "Lituania",        nameEn: "Lithuania",      prefix: "370" },
  { iso: "GL", name: "Groenlandia",     nameEn: "Greenland",      prefix: "299" },
  { iso: "AX", name: "Islas Åland",     nameEn: "Åland Islands",  prefix: "358" },
  { iso: "SJ", name: "Svalbard y Jan Mayen", nameEn: "Svalbard",  prefix: "47" },

  // ── Europa Central / Este / Balcanes ──
  { iso: "PL", name: "Polonia",         nameEn: "Poland",         prefix: "48" },
  { iso: "CZ", name: "Chequia",         nameEn: "Czechia",        prefix: "420" },
  { iso: "SK", name: "Eslovaquia",      nameEn: "Slovakia",       prefix: "421" },
  { iso: "HU", name: "Hungría",         nameEn: "Hungary",        prefix: "36" },
  { iso: "RO", name: "Rumanía",         nameEn: "Romania",        prefix: "40" },
  { iso: "BG", name: "Bulgaria",        nameEn: "Bulgaria",       prefix: "359" },
  { iso: "SI", name: "Eslovenia",       nameEn: "Slovenia",       prefix: "386" },
  { iso: "HR", name: "Croacia",         nameEn: "Croatia",        prefix: "385" },
  { iso: "BA", name: "Bosnia y Herzegovina", nameEn: "Bosnia and Herzegovina", prefix: "387" },
  { iso: "RS", name: "Serbia",          nameEn: "Serbia",         prefix: "381" },
  { iso: "ME", name: "Montenegro",      nameEn: "Montenegro",     prefix: "382" },
  { iso: "MK", name: "Macedonia del Norte", nameEn: "North Macedonia", prefix: "389" },
  { iso: "AL", name: "Albania",         nameEn: "Albania",        prefix: "355" },
  { iso: "XK", name: "Kosovo",          nameEn: "Kosovo",         prefix: "383" },
  { iso: "MD", name: "Moldavia",        nameEn: "Moldova",        prefix: "373" },
  { iso: "CY", name: "Chipre",          nameEn: "Cyprus",         prefix: "357" },
  { iso: "GR", name: "Grecia",          nameEn: "Greece",         prefix: "30" },
  { iso: "TR", name: "Turquía",         nameEn: "Turkey",         prefix: "90" },
  { iso: "RU", name: "Rusia",           nameEn: "Russia",         prefix: "7" },
  { iso: "UA", name: "Ucrania",         nameEn: "Ukraine",        prefix: "380" },
  { iso: "BY", name: "Bielorrusia",     nameEn: "Belarus",        prefix: "375" },

  // ── Cáucaso y Asia Central ──
  { iso: "AM", name: "Armenia",         nameEn: "Armenia",        prefix: "374" },
  { iso: "GE", name: "Georgia",         nameEn: "Georgia",        prefix: "995" },
  { iso: "AZ", name: "Azerbaiyán",      nameEn: "Azerbaijan",     prefix: "994" },
  { iso: "KZ", name: "Kazajistán",      nameEn: "Kazakhstan",     prefix: "7" },
  { iso: "UZ", name: "Uzbekistán",      nameEn: "Uzbekistan",     prefix: "998" },
  { iso: "KG", name: "Kirguistán",      nameEn: "Kyrgyzstan",     prefix: "996" },
  { iso: "TJ", name: "Tayikistán",      nameEn: "Tajikistan",     prefix: "992" },
  { iso: "TM", name: "Turkmenistán",    nameEn: "Turkmenistan",   prefix: "993" },
  { iso: "MN", name: "Mongolia",        nameEn: "Mongolia",       prefix: "976" },
  { iso: "AF", name: "Afganistán",      nameEn: "Afghanistan",    prefix: "93" },

  // ── Oriente Medio ──
  { iso: "AE", name: "Emiratos Árabes Unidos", nameEn: "UAE",     prefix: "971" },
  { iso: "SA", name: "Arabia Saudí",    nameEn: "Saudi Arabia",   prefix: "966" },
  { iso: "QA", name: "Catar",           nameEn: "Qatar",          prefix: "974" },
  { iso: "KW", name: "Kuwait",          nameEn: "Kuwait",         prefix: "965" },
  { iso: "BH", name: "Baréin",          nameEn: "Bahrain",        prefix: "973" },
  { iso: "OM", name: "Omán",            nameEn: "Oman",           prefix: "968" },
  { iso: "IL", name: "Israel",          nameEn: "Israel",         prefix: "972" },
  { iso: "PS", name: "Palestina",       nameEn: "Palestine",      prefix: "970" },
  { iso: "JO", name: "Jordania",        nameEn: "Jordan",         prefix: "962" },
  { iso: "LB", name: "Líbano",          nameEn: "Lebanon",        prefix: "961" },
  { iso: "SY", name: "Siria",           nameEn: "Syria",          prefix: "963" },
  { iso: "IQ", name: "Irak",            nameEn: "Iraq",           prefix: "964" },
  { iso: "IR", name: "Irán",            nameEn: "Iran",           prefix: "98" },
  { iso: "YE", name: "Yemen",           nameEn: "Yemen",          prefix: "967" },

  // ── Magreb y Norte de África ──
  { iso: "EG", name: "Egipto",          nameEn: "Egypt",          prefix: "20" },
  { iso: "MA", name: "Marruecos",       nameEn: "Morocco",        prefix: "212" },
  { iso: "TN", name: "Túnez",           nameEn: "Tunisia",        prefix: "216" },
  { iso: "DZ", name: "Argelia",         nameEn: "Algeria",        prefix: "213" },
  { iso: "LY", name: "Libia",           nameEn: "Libya",          prefix: "218" },
  { iso: "SD", name: "Sudán",           nameEn: "Sudan",          prefix: "249" },
  { iso: "SS", name: "Sudán del Sur",   nameEn: "South Sudan",    prefix: "211" },
  { iso: "EH", name: "Sáhara Occidental", nameEn: "Western Sahara", prefix: "212" },

  // ── África Occidental ──
  { iso: "NG", name: "Nigeria",         nameEn: "Nigeria",        prefix: "234" },
  { iso: "GH", name: "Ghana",           nameEn: "Ghana",          prefix: "233" },
  { iso: "CI", name: "Costa de Marfil", nameEn: "Côte d'Ivoire",  prefix: "225" },
  { iso: "SN", name: "Senegal",         nameEn: "Senegal",        prefix: "221" },
  { iso: "ML", name: "Malí",            nameEn: "Mali",           prefix: "223" },
  { iso: "BF", name: "Burkina Faso",    nameEn: "Burkina Faso",   prefix: "226" },
  { iso: "NE", name: "Níger",           nameEn: "Niger",          prefix: "227" },
  { iso: "TG", name: "Togo",            nameEn: "Togo",           prefix: "228" },
  { iso: "BJ", name: "Benín",           nameEn: "Benin",          prefix: "229" },
  { iso: "GN", name: "Guinea",          nameEn: "Guinea",         prefix: "224" },
  { iso: "GW", name: "Guinea-Bisáu",    nameEn: "Guinea-Bissau",  prefix: "245" },
  { iso: "SL", name: "Sierra Leona",    nameEn: "Sierra Leone",   prefix: "232" },
  { iso: "LR", name: "Liberia",         nameEn: "Liberia",        prefix: "231" },
  { iso: "GM", name: "Gambia",          nameEn: "Gambia",         prefix: "220" },
  { iso: "CV", name: "Cabo Verde",      nameEn: "Cabo Verde",     prefix: "238" },
  { iso: "MR", name: "Mauritania",      nameEn: "Mauritania",     prefix: "222" },
  { iso: "ST", name: "Santo Tomé y Príncipe", nameEn: "São Tomé and Príncipe", prefix: "239" },

  // ── África Central ──
  { iso: "CM", name: "Camerún",         nameEn: "Cameroon",       prefix: "237" },
  { iso: "CF", name: "República Centroafricana", nameEn: "Central African Republic", prefix: "236" },
  { iso: "TD", name: "Chad",            nameEn: "Chad",           prefix: "235" },
  { iso: "GA", name: "Gabón",           nameEn: "Gabon",          prefix: "241" },
  { iso: "CG", name: "República del Congo", nameEn: "Republic of the Congo", prefix: "242" },
  { iso: "CD", name: "Rep. Dem. del Congo", nameEn: "DR Congo",   prefix: "243" },
  { iso: "AO", name: "Angola",          nameEn: "Angola",         prefix: "244" },
  { iso: "GQ", name: "Guinea Ecuatorial", nameEn: "Equatorial Guinea", prefix: "240" },

  // ── África Oriental ──
  { iso: "KE", name: "Kenia",           nameEn: "Kenya",          prefix: "254" },
  { iso: "ET", name: "Etiopía",         nameEn: "Ethiopia",       prefix: "251" },
  { iso: "ER", name: "Eritrea",         nameEn: "Eritrea",        prefix: "291" },
  { iso: "DJ", name: "Yibuti",          nameEn: "Djibouti",       prefix: "253" },
  { iso: "SO", name: "Somalia",         nameEn: "Somalia",        prefix: "252" },
  { iso: "UG", name: "Uganda",          nameEn: "Uganda",         prefix: "256" },
  { iso: "TZ", name: "Tanzania",        nameEn: "Tanzania",       prefix: "255" },
  { iso: "RW", name: "Ruanda",          nameEn: "Rwanda",         prefix: "250" },
  { iso: "BI", name: "Burundi",         nameEn: "Burundi",        prefix: "257" },
  { iso: "MG", name: "Madagascar",      nameEn: "Madagascar",     prefix: "261" },
  { iso: "MU", name: "Mauricio",        nameEn: "Mauritius",      prefix: "230" },
  { iso: "SC", name: "Seychelles",      nameEn: "Seychelles",     prefix: "248" },
  { iso: "KM", name: "Comoras",         nameEn: "Comoros",        prefix: "269" },
  { iso: "RE", name: "Reunión",         nameEn: "Réunion",        prefix: "262" },
  { iso: "YT", name: "Mayotte",         nameEn: "Mayotte",        prefix: "262" },

  // ── África Austral ──
  { iso: "ZA", name: "Sudáfrica",       nameEn: "South Africa",   prefix: "27" },
  { iso: "MZ", name: "Mozambique",      nameEn: "Mozambique",     prefix: "258" },
  { iso: "ZW", name: "Zimbabue",        nameEn: "Zimbabwe",       prefix: "263" },
  { iso: "NA", name: "Namibia",         nameEn: "Namibia",        prefix: "264" },
  { iso: "BW", name: "Botsuana",        nameEn: "Botswana",       prefix: "267" },
  { iso: "ZM", name: "Zambia",          nameEn: "Zambia",         prefix: "260" },
  { iso: "MW", name: "Malaui",          nameEn: "Malawi",         prefix: "265" },
  { iso: "LS", name: "Lesoto",          nameEn: "Lesotho",        prefix: "266" },
  { iso: "SZ", name: "Esuatini",        nameEn: "Eswatini",       prefix: "268" },

  // ── América del Norte ──
  { iso: "US", name: "Estados Unidos",  nameEn: "United States",  prefix: "1" },
  { iso: "CA", name: "Canadá",          nameEn: "Canada",         prefix: "1" },
  { iso: "MX", name: "México",          nameEn: "Mexico",         prefix: "52" },

  // ── América Central ──
  { iso: "GT", name: "Guatemala",       nameEn: "Guatemala",      prefix: "502" },
  { iso: "SV", name: "El Salvador",     nameEn: "El Salvador",    prefix: "503" },
  { iso: "HN", name: "Honduras",        nameEn: "Honduras",       prefix: "504" },
  { iso: "NI", name: "Nicaragua",       nameEn: "Nicaragua",      prefix: "505" },
  { iso: "CR", name: "Costa Rica",      nameEn: "Costa Rica",     prefix: "506" },
  { iso: "PA", name: "Panamá",          nameEn: "Panama",         prefix: "507" },
  { iso: "BZ", name: "Belice",          nameEn: "Belize",         prefix: "501" },

  // ── Caribe (NANP +1) ──
  { iso: "CU", name: "Cuba",            nameEn: "Cuba",           prefix: "53" },
  { iso: "DO", name: "Rep. Dominicana", nameEn: "Dominican Republic", prefix: "1" },
  { iso: "PR", name: "Puerto Rico",     nameEn: "Puerto Rico",    prefix: "1" },
  { iso: "HT", name: "Haití",           nameEn: "Haiti",          prefix: "509" },
  { iso: "JM", name: "Jamaica",         nameEn: "Jamaica",        prefix: "1" },
  { iso: "BS", name: "Bahamas",         nameEn: "Bahamas",        prefix: "1" },
  { iso: "BB", name: "Barbados",        nameEn: "Barbados",       prefix: "1" },
  { iso: "TT", name: "Trinidad y Tobago", nameEn: "Trinidad and Tobago", prefix: "1" },
  { iso: "AG", name: "Antigua y Barbuda", nameEn: "Antigua and Barbuda", prefix: "1" },
  { iso: "DM", name: "Dominica",        nameEn: "Dominica",       prefix: "1" },
  { iso: "GD", name: "Granada",         nameEn: "Grenada",        prefix: "1" },
  { iso: "KN", name: "San Cristóbal y Nieves", nameEn: "Saint Kitts and Nevis", prefix: "1" },
  { iso: "LC", name: "Santa Lucía",     nameEn: "Saint Lucia",    prefix: "1" },
  { iso: "VC", name: "San Vicente y las Granadinas", nameEn: "Saint Vincent", prefix: "1" },
  { iso: "AI", name: "Anguila",         nameEn: "Anguilla",       prefix: "1" },
  { iso: "VG", name: "Islas Vírgenes Británicas", nameEn: "British Virgin Islands", prefix: "1" },
  { iso: "VI", name: "Islas Vírgenes EE.UU.", nameEn: "U.S. Virgin Islands", prefix: "1" },
  { iso: "KY", name: "Islas Caimán",    nameEn: "Cayman Islands", prefix: "1" },
  { iso: "BM", name: "Bermudas",        nameEn: "Bermuda",        prefix: "1" },
  { iso: "TC", name: "Islas Turcas y Caicos", nameEn: "Turks and Caicos", prefix: "1" },
  { iso: "MS", name: "Montserrat",      nameEn: "Montserrat",     prefix: "1" },
  { iso: "AW", name: "Aruba",           nameEn: "Aruba",          prefix: "297" },
  { iso: "CW", name: "Curazao",         nameEn: "Curaçao",        prefix: "599" },
  { iso: "SX", name: "San Martín (Neerlandés)", nameEn: "Sint Maarten", prefix: "1" },
  { iso: "MF", name: "San Martín (Francés)", nameEn: "Saint Martin", prefix: "590" },
  { iso: "BL", name: "San Bartolomé",   nameEn: "Saint Barthélemy", prefix: "590" },
  { iso: "GP", name: "Guadalupe",       nameEn: "Guadeloupe",     prefix: "590" },
  { iso: "MQ", name: "Martinica",       nameEn: "Martinique",     prefix: "596" },
  { iso: "BQ", name: "Caribe Neerlandés", nameEn: "Caribbean Netherlands", prefix: "599" },

  // ── América del Sur ──
  { iso: "BR", name: "Brasil",          nameEn: "Brazil",         prefix: "55" },
  { iso: "AR", name: "Argentina",       nameEn: "Argentina",      prefix: "54" },
  { iso: "CL", name: "Chile",           nameEn: "Chile",          prefix: "56" },
  { iso: "CO", name: "Colombia",        nameEn: "Colombia",       prefix: "57" },
  { iso: "PE", name: "Perú",            nameEn: "Peru",           prefix: "51" },
  { iso: "UY", name: "Uruguay",         nameEn: "Uruguay",        prefix: "598" },
  { iso: "VE", name: "Venezuela",       nameEn: "Venezuela",      prefix: "58" },
  { iso: "BO", name: "Bolivia",         nameEn: "Bolivia",        prefix: "591" },
  { iso: "PY", name: "Paraguay",        nameEn: "Paraguay",       prefix: "595" },
  { iso: "EC", name: "Ecuador",         nameEn: "Ecuador",        prefix: "593" },
  { iso: "GY", name: "Guyana",          nameEn: "Guyana",         prefix: "592" },
  { iso: "SR", name: "Surinam",         nameEn: "Suriname",       prefix: "597" },
  { iso: "GF", name: "Guayana Francesa", nameEn: "French Guiana", prefix: "594" },
  { iso: "FK", name: "Islas Malvinas",  nameEn: "Falkland Islands", prefix: "500" },

  // ── Asia Oriental ──
  { iso: "CN", name: "China",           nameEn: "China",          prefix: "86" },
  { iso: "JP", name: "Japón",           nameEn: "Japan",          prefix: "81" },
  { iso: "KR", name: "Corea del Sur",   nameEn: "South Korea",    prefix: "82" },
  { iso: "KP", name: "Corea del Norte", nameEn: "North Korea",    prefix: "850" },
  { iso: "HK", name: "Hong Kong",       nameEn: "Hong Kong",      prefix: "852" },
  { iso: "MO", name: "Macao",           nameEn: "Macao",          prefix: "853" },
  { iso: "TW", name: "Taiwán",          nameEn: "Taiwan",         prefix: "886" },

  // ── Asia del Sur ──
  { iso: "IN", name: "India",           nameEn: "India",          prefix: "91" },
  { iso: "PK", name: "Pakistán",        nameEn: "Pakistan",       prefix: "92" },
  { iso: "BD", name: "Bangladés",       nameEn: "Bangladesh",     prefix: "880" },
  { iso: "LK", name: "Sri Lanka",       nameEn: "Sri Lanka",      prefix: "94" },
  { iso: "NP", name: "Nepal",           nameEn: "Nepal",          prefix: "977" },
  { iso: "BT", name: "Bután",           nameEn: "Bhutan",         prefix: "975" },
  { iso: "MV", name: "Maldivas",        nameEn: "Maldives",       prefix: "960" },

  // ── Sudeste Asiático ──
  { iso: "ID", name: "Indonesia",       nameEn: "Indonesia",      prefix: "62" },
  { iso: "TH", name: "Tailandia",       nameEn: "Thailand",       prefix: "66" },
  { iso: "VN", name: "Vietnam",         nameEn: "Vietnam",        prefix: "84" },
  { iso: "PH", name: "Filipinas",       nameEn: "Philippines",    prefix: "63" },
  { iso: "MY", name: "Malasia",         nameEn: "Malaysia",       prefix: "60" },
  { iso: "SG", name: "Singapur",        nameEn: "Singapore",      prefix: "65" },
  { iso: "MM", name: "Myanmar",         nameEn: "Myanmar",        prefix: "95" },
  { iso: "KH", name: "Camboya",         nameEn: "Cambodia",       prefix: "855" },
  { iso: "LA", name: "Laos",            nameEn: "Laos",           prefix: "856" },
  { iso: "BN", name: "Brunéi",          nameEn: "Brunei",         prefix: "673" },
  { iso: "TL", name: "Timor Oriental",  nameEn: "Timor-Leste",    prefix: "670" },

  // ── Oceanía ──
  { iso: "AU", name: "Australia",       nameEn: "Australia",      prefix: "61" },
  { iso: "NZ", name: "Nueva Zelanda",   nameEn: "New Zealand",    prefix: "64" },
  { iso: "PG", name: "Papúa Nueva Guinea", nameEn: "Papua New Guinea", prefix: "675" },
  { iso: "FJ", name: "Fiyi",            nameEn: "Fiji",           prefix: "679" },
  { iso: "SB", name: "Islas Salomón",   nameEn: "Solomon Islands", prefix: "677" },
  { iso: "VU", name: "Vanuatu",         nameEn: "Vanuatu",        prefix: "678" },
  { iso: "NC", name: "Nueva Caledonia", nameEn: "New Caledonia",  prefix: "687" },
  { iso: "PF", name: "Polinesia Francesa", nameEn: "French Polynesia", prefix: "689" },
  { iso: "WS", name: "Samoa",           nameEn: "Samoa",          prefix: "685" },
  { iso: "TO", name: "Tonga",           nameEn: "Tonga",          prefix: "676" },
  { iso: "KI", name: "Kiribati",        nameEn: "Kiribati",       prefix: "686" },
  { iso: "NR", name: "Nauru",           nameEn: "Nauru",          prefix: "674" },
  { iso: "TV", name: "Tuvalu",          nameEn: "Tuvalu",         prefix: "688" },
  { iso: "FM", name: "Micronesia",      nameEn: "Micronesia",     prefix: "691" },
  { iso: "MH", name: "Islas Marshall",  nameEn: "Marshall Islands", prefix: "692" },
  { iso: "PW", name: "Palaos",          nameEn: "Palau",          prefix: "680" },
  { iso: "CK", name: "Islas Cook",      nameEn: "Cook Islands",   prefix: "682" },
  { iso: "NU", name: "Niue",            nameEn: "Niue",           prefix: "683" },
  { iso: "TK", name: "Tokelau",         nameEn: "Tokelau",        prefix: "690" },
  { iso: "WF", name: "Wallis y Futuna", nameEn: "Wallis and Futuna", prefix: "681" },
  { iso: "GU", name: "Guam",            nameEn: "Guam",           prefix: "1" },
  { iso: "MP", name: "Islas Marianas del Norte", nameEn: "Northern Mariana Islands", prefix: "1" },
  { iso: "AS", name: "Samoa Americana", nameEn: "American Samoa", prefix: "1" },
  { iso: "NF", name: "Isla Norfolk",    nameEn: "Norfolk Island", prefix: "672" },
  { iso: "CX", name: "Isla de Navidad", nameEn: "Christmas Island", prefix: "61" },
  { iso: "CC", name: "Islas Cocos",     nameEn: "Cocos Islands",  prefix: "61" },
  { iso: "PN", name: "Islas Pitcairn",  nameEn: "Pitcairn Islands", prefix: "64" },

  // ── Atlántico / territorios varios ──
  { iso: "SH", name: "Santa Elena",     nameEn: "Saint Helena",   prefix: "290" },
  { iso: "IO", name: "Territorio Británico del Océano Índico", nameEn: "British Indian Ocean Territory", prefix: "246" },
  { iso: "TF", name: "Tierras Australes y Antárticas Francesas", nameEn: "French Southern Territories", prefix: "262" },
  { iso: "AQ", name: "Antártida",       nameEn: "Antarctica",     prefix: "672" },
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

/** Parsea un teléfono crudo (cualquier formato: "+34 688...", "+34688...",
 *  "688...") en `{ prefix, local }`. Si no detecta país, devuelve el
 *  número entero como local con el prefijo por defecto.
 *
 *  - "+34 688928822" → { prefix: "+34", local: "688928822" }
 *  - "+34688928822"  → { prefix: "+34", local: "688928822" }
 *  - "688928822"     → { prefix: "+34", local: "688928822" } (asume default ES)
 *  - ""              → { prefix: "+34", local: "" } */
export function parsePhone(
  raw: string,
  defaultPrefix = "+34",
): { prefix: string; local: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { prefix: defaultPrefix, local: "" };
  if (trimmed.startsWith("+")) {
    const country = detectCountryFromPhone(trimmed);
    if (country) {
      return { prefix: `+${country.prefix}`, local: stripPrefix(trimmed, country) };
    }
    /* Sin match · partimos por el primer espacio si lo hay. */
    const space = trimmed.indexOf(" ");
    if (space > 0) {
      return {
        prefix: trimmed.slice(0, space),
        local: trimmed.slice(space + 1).replace(/\D/g, ""),
      };
    }
  }
  /* No empieza por "+" · asumimos local sin prefijo · devolvemos el
   *  default. Si el número trae espacios u otros separadores, los
   *  limpiamos para que el guardado quede consistente. */
  return { prefix: defaultPrefix, local: trimmed.replace(/\D/g, "") };
}
