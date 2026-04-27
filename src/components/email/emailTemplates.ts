// Email template definitions used by SendEmailDialog.
// Four templates, both audiences (client / collaborator):
//   1. last-unit          → "Última unidad" — only enabled when 1 unit left
//   2. new-launch         → "Nuevo lanzamiento"
//   3. new-availability   → "Nueva disponibilidad"
//   4. blank              → "Sin plantilla" (free-form email, brand header only)

export type Audience = "client" | "collaborator";
export type Language = "es" | "en";

export type TemplateId =
  | "last-unit"
  | "new-launch"
  | "new-availability"
  | "blank";

export type TemplateBlocks = Record<string, string>;

export interface AvailabilityUnit {
  id: string;
  type: string;
  bedrooms: number;
  builtArea: number;
  price: string;
}

export interface RenderOptions {
  includeSignature?: boolean;
  includeAvailability?: boolean;
  availabilityUnits?: AvailabilityUnit[];
  /**
   * Cuando el emisor es una agencia colaboradora, omitimos bloques que
   * identifican a la promoción (showroom, ubicación exacta, plan de pagos,
   * info del proyecto). La agencia NO quiere desvelar en el email qué
   * promoción concreta es — si el cliente pregunta, viene a ella, no al
   * promotor. Ver CLAUDE.md §Vista de Agencia + ADR asociada.
   */
  agencyMode?: boolean;
}

export interface EmailTemplateMeta {
  id: TemplateId;
  /** Audiences this template can be used for (same template, both audiences). */
  audiences: Audience[];
  label: { es: string; en: string };
  description: { es: string; en: string };
  heroImage: string;
  agentAvatar: string;
  supportsAvailability?: boolean;
  supportsSignature?: boolean;
  /** Required exact number of available units (e.g. last-unit needs 1). */
  requiresAvailableCount?: number;
  defaultBlocks: Record<Language, TemplateBlocks>;
  render: (blocks: TemplateBlocks, lang: Language, opts?: RenderOptions) => string;
}

const HERO_PROMOTION =
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&h=800&fit=crop&q=80";
const HERO_UNIT =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&h=900&fit=crop&q=80";
const HERO_LAUNCH =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=900&fit=crop&q=80";
const AGENT_AVATAR =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=96&h=96&fit=crop&crop=faces&q=80";
const BRAND_LOGO_DEFAULT =
  "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=140&fit=crop&q=80";

const baseStyles = `
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a}
  .wrap{padding:24px 12px}
  .container{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb}
  .hero img{width:100%;display:block}
  .px{padding:0 28px}
  .h1{font-size:22px;font-weight:600;letter-spacing:-0.3px;margin:14px 0 4px;color:#0f172a}
  .sub{font-size:13px;color:#64748b;margin:0}
  .body{font-size:14px;line-height:22px;color:#334155;margin:18px 0}
  .pill{display:inline-block;background:#ecfdf5;color:#047857;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;margin-top:14px}
  .pill-warn{display:inline-block;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;margin-top:14px}
  .pill-new{display:inline-block;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;margin-top:14px}
  .stats{width:100%;border-spacing:6px;margin:18px 0 4px}
  .stat{background:#f8fafc;border-radius:10px;padding:12px;text-align:center;width:25%}
  .stat-n{font-size:18px;font-weight:700;margin:0;color:#0f172a}
  .stat-l{font-size:10px;color:#64748b;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.04em}
  .btn{display:inline-block;background:#0f172a;color:#fff!important;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;text-decoration:none}
  .btn-2{display:inline-block;color:#0f172a!important;font-size:13px;padding:11px 20px;border-radius:999px;border:1px solid #e5e7eb;margin-left:8px;text-decoration:none}
  .agent{padding:14px;background:#f8fafc;border-radius:12px;margin:18px 0}
  .footer{padding:18px 28px;background:#fafbfc;color:#94a3b8;font-size:11px;text-align:center;border-top:1px solid #f1f5f9}
  .last-banner{background:linear-gradient(135deg,#fee2e2,#fecaca);border-radius:12px;padding:18px;margin-top:14px;text-align:center}
  .last-banner-n{font-size:28px;font-weight:700;color:#7f1d1d;margin:0;letter-spacing:-0.4px}
  .last-banner-l{font-size:12px;color:#991b1b;margin:4px 0 0;font-weight:500}
  .section{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin:24px 0 10px}
  .brand{padding:20px 28px;border-bottom:1px solid #f1f5f9;background:#fff;text-align:left}
  .brand-logo-img{display:inline-block;height:36px;max-width:140px;width:auto;border-radius:4px;object-fit:contain;vertical-align:middle;background:#fff}
  .brand-divider{display:inline-block;width:1px;height:14px;background:#e5e7eb;margin:0 12px;vertical-align:middle}
  .brand-tag{display:inline-block;font-size:12px;color:#64748b;vertical-align:middle;font-weight:400}
  .units{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  .units th{text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
  .units td{padding:10px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:13px}
  .units td.r{text-align:right;font-weight:600}
  .units tr:last-child td{border-bottom:none}
  .units .ref{font-weight:600;color:#0f172a}
  .units .meta{color:#64748b;font-size:12px}
  .features{width:100%;border-spacing:8px;margin:8px 0 4px}
  .feat{background:#f8fafc;border-radius:10px;padding:12px;width:33.33%;vertical-align:top}
  .feat-i{font-size:16px;margin:0 0 6px;line-height:1}
  .feat-l{font-size:10px;color:#64748b;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600}
  .feat-v{font-size:13px;color:#0f172a;margin:0;font-weight:500;line-height:18px}
  .info-grid{width:100%;border-collapse:separate;border-spacing:0;margin:8px 0}
  .info-grid td{padding:11px 0;border-top:1px solid #f1f5f9;font-size:13px;color:#0f172a;vertical-align:top}
  .info-grid td.k{color:#64748b;width:42%;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600}
  .info-grid tr:first-child td{border-top:none}
  .pay-card{background:#f8fafc;border-radius:12px;padding:16px;margin:8px 0}
  .pay-row{display:table;width:100%;padding:6px 0}
  .pay-pct{display:table-cell;width:60px;font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.3px}
  .pay-txt{display:table-cell;font-size:13px;color:#334155;padding-left:12px;vertical-align:middle}
  .pay-txt small{display:block;color:#64748b;font-size:11px;margin-top:2px}
  .showroom{background:#eff6ff;border:1px solid #dbeafe;border-radius:12px;padding:16px;margin:8px 0;display:table;width:100%;box-sizing:border-box}
  .showroom-i{display:table-cell;width:40px;font-size:22px;vertical-align:top;line-height:1}
  .showroom-c{display:table-cell;padding-left:8px;vertical-align:top}
  .showroom-t{font-size:13px;font-weight:600;color:#1e3a8a;margin:0 0 3px}
  .showroom-d{font-size:12px;color:#1e40af;margin:0;line-height:18px}
  .closing{font-size:14px;line-height:22px;color:#334155;margin:18px 0;font-style:italic;padding:14px 16px;background:#fafbfc;border-left:3px solid #0f172a;border-radius:0 8px 8px 0}
  [contenteditable="true"]{outline:none;border-radius:6px;transition:background 0.15s,box-shadow 0.15s}
  [contenteditable="true"]:hover{background:rgba(245,158,11,0.06);box-shadow:inset 0 0 0 1px rgba(245,158,11,0.25)}
  [contenteditable="true"]:focus{background:rgba(245,158,11,0.10);box-shadow:inset 0 0 0 2px rgba(245,158,11,0.55)}
`;

const wrap = (inner: string) => `
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyles}</style></head>
<body><div class="wrap"><div class="container">${inner}</div></div></body></html>`;

const brandHeader = (b: TemplateBlocks, lang: Language) => `
  <div class="brand">
    <img class="brand-logo-img" src="${b.brandLogo || BRAND_LOGO_DEFAULT}" alt="${b.brandName || "Luxinmo"}" />
    <span class="brand-divider"></span>
    <span class="brand-tag" data-block="brandTagline">${b.brandTagline || (lang === "es" ? "Promotor inmobiliario" : "Real estate developer")}</span>
  </div>`;

const agentBlock = (b: TemplateBlocks) => `
  <div class="agent">
    <table style="width:100%"><tr>
      <td style="width:48px"><img src="${AGENT_AVATAR}" width="48" height="48" style="border-radius:50%;display:block"></td>
      <td style="padding-left:14px">
        <p style="margin:0;font-size:14px;font-weight:600" data-block="agentName">${b.agentName || ""}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#64748b" data-block="agentRole">${b.agentRole || ""}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#64748b" data-block="agentContact">${b.agentContact || ""}</p>
      </td>
    </tr></table>
  </div>`;

const availabilityBlock = (units: AvailabilityUnit[], lang: Language) => {
  if (!units || units.length === 0) return "";
  const rows = units
    .map(
      u => `
        <tr>
          <td><span class="ref">${u.id}</span><br><span class="meta">${u.type}</span></td>
          <td>${u.bedrooms} ${lang === "es" ? "hab" : "br"} · ${u.builtArea} m²</td>
          <td class="r">${u.price}</td>
        </tr>`,
    )
    .join("");
  return `
    <p class="section">${lang === "es" ? `Unidades disponibles (${units.length})` : `Available units (${units.length})`}</p>
    <table class="units">
      <thead>
        <tr>
          <th>${lang === "es" ? "Unidad" : "Unit"}</th>
          <th>${lang === "es" ? "Características" : "Features"}</th>
          <th style="text-align:right">${lang === "es" ? "Precio" : "Price"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const featuresBlock = (b: TemplateBlocks, lang: Language) => `
  <p class="section">${lang === "es" ? "Lo que más nos gusta" : "What we love about it"}</p>
  <table class="features"><tr>
    <td class="feat"><p class="feat-i">🏖️</p><p class="feat-l">${lang === "es" ? "Ubicación" : "Location"}</p><p class="feat-v" data-block="featLocation">${b.featLocation || ""}</p></td>
    <td class="feat"><p class="feat-i">🏊</p><p class="feat-l">${lang === "es" ? "Zonas comunes" : "Amenities"}</p><p class="feat-v" data-block="featAmenities">${b.featAmenities || ""}</p></td>
    <td class="feat"><p class="feat-i">✨</p><p class="feat-l">${lang === "es" ? "Calidades" : "Finishes"}</p><p class="feat-v" data-block="featFinishes">${b.featFinishes || ""}</p></td>
  </tr></table>`;

const projectInfoBlock = (b: TemplateBlocks, lang: Language) => `
  <p class="section">${lang === "es" ? "Información del proyecto" : "Project information"}</p>
  <table class="info-grid" role="presentation">
    <tr><td class="k">${lang === "es" ? "Ubicación" : "Location"}</td><td data-block="infoLocation">${b.infoLocation || ""}</td></tr>
    <tr><td class="k">${lang === "es" ? "Estado de obra" : "Construction status"}</td><td data-block="infoStatus">${b.infoStatus || ""}</td></tr>
    <tr><td class="k">${lang === "es" ? "Fecha de entrega" : "Delivery date"}</td><td data-block="infoDelivery">${b.infoDelivery || ""}</td></tr>
    <tr><td class="k">${lang === "es" ? "Tipologías" : "Property types"}</td><td data-block="infoTypes">${b.infoTypes || ""}</td></tr>
    <tr><td class="k">${lang === "es" ? "Rango de precios" : "Price range"}</td><td data-block="infoPriceRange">${b.infoPriceRange || ""}</td></tr>
  </table>`;

const showroomBlock = (b: TemplateBlocks, lang: Language) => `
  <div class="showroom">
    <span class="showroom-i">📍</span>
    <div class="showroom-c">
      <p class="showroom-t" data-block="showroomTitle">${b.showroomTitle || (lang === "es" ? "Show room disponible" : "Show room available")}</p>
      <p class="showroom-d" data-block="showroomDesc">${b.showroomDesc || ""}</p>
    </div>
  </div>`;

const paymentBlock = (b: TemplateBlocks, lang: Language) => `
  <p class="section">${lang === "es" ? "Forma de pago" : "Payment plan"}</p>
  <div class="pay-card">
    <div class="pay-row"><span class="pay-pct" data-block="payPct1">${b.payPct1 || "10%"}</span><span class="pay-txt" data-block="payTxt1">${b.payTxt1 || ""}</span></div>
    <div class="pay-row"><span class="pay-pct" data-block="payPct2">${b.payPct2 || "20%"}</span><span class="pay-txt" data-block="payTxt2">${b.payTxt2 || ""}</span></div>
    <div class="pay-row"><span class="pay-pct" data-block="payPct3">${b.payPct3 || "70%"}</span><span class="pay-txt" data-block="payTxt3">${b.payTxt3 || ""}</span></div>
  </div>`;

const closingBlock = (b: TemplateBlocks) => `
  <p class="closing" data-block="closing">${b.closing || ""}</p>`;

// ---------- Default blocks ----------

const brandDefaults = {
  es: {
    brandName: "Luxinmo",
    brandTagline: "Promotor inmobiliario",
    brandLogo: BRAND_LOGO_DEFAULT,
    agentName: "Laura Martín",
    agentRole: "Luxinmo · Asesora comercial",
    agentContact: "+34 600 000 000 · laura@mycompany.com",
  },
  en: {
    brandName: "Luxinmo",
    brandTagline: "Real estate developer",
    brandLogo: BRAND_LOGO_DEFAULT,
    agentName: "Laura Martín",
    agentRole: "Luxinmo · Sales advisor",
    agentContact: "+34 600 000 000 · laura@mycompany.com",
  },
};

// Shared commercial blocks (location, features, status, payment, showroom, closing)
const commercialDefaults = {
  es: {
    featLocation: "Primera línea de playa, a 5 min del puerto y 35 min del aeropuerto de Alicante",
    featAmenities: "Piscina infinita, gimnasio, spa, jardines y zona chill-out con vistas al mar",
    featFinishes: "Cocina equipada Bosch, suelos porcelánicos, aerotermia y domótica integrada",
    infoLocation: "Torrevieja (Alicante) · Costa Blanca Sur",
    infoStatus: "Cimentación finalizada · 35% de obra ejecutada",
    infoDelivery: "Q2 2026 (junio 2026)",
    infoTypes: "Apartamentos de 1, 2 y 3 dormitorios · Áticos con solárium",
    infoPriceRange: "Desde € 215.000 hasta € 410.000",
    showroomTitle: "Show room y piso piloto disponibles",
    showroomDesc: "Visitas concertadas de lunes a sábado en nuestra oficina de obra. Reserva tu cita y vive el proyecto antes que nadie.",
    payPct1: "10%",
    payTxt1: "A la firma del contrato de reserva<small>Reserva inicial de 6.000 € incluida</small>",
    payPct2: "20%",
    payTxt2: "Durante la construcción<small>Repartido en pagos trimestrales hasta entrega</small>",
    payPct3: "70%",
    payTxt3: "A la entrega de llaves<small>Financiación bancaria preacordada con Sabadell y BBVA</small>",
    closing: "Estaré encantada de organizar una visita o resolver cualquier duda. Esta promoción está teniendo una excelente acogida y las mejores unidades se están reservando rápido.",
  },
  en: {
    featLocation: "Beachfront location · 5 min from the marina, 35 min from Alicante airport",
    featAmenities: "Infinity pool, gym, spa, gardens and chill-out area with sea views",
    featFinishes: "Bosch fitted kitchen, porcelain floors, aerothermal heating and smart home",
    infoLocation: "Torrevieja (Alicante) · Costa Blanca South",
    infoStatus: "Foundations completed · 35% of construction executed",
    infoDelivery: "Q2 2026 (June 2026)",
    infoTypes: "1, 2 and 3 bedroom apartments · Penthouses with solarium",
    infoPriceRange: "From € 215,000 to € 410,000",
    showroomTitle: "Show room and pilot apartment available",
    showroomDesc: "Scheduled visits Monday to Saturday at our on-site sales office. Book your appointment and experience the project firsthand.",
    payPct1: "10%",
    payTxt1: "Upon signing reservation contract<small>Initial € 6,000 reservation included</small>",
    payPct2: "20%",
    payTxt2: "During construction<small>Split in quarterly payments until delivery</small>",
    payPct3: "70%",
    payTxt3: "Upon key handover<small>Mortgage pre-approved with Sabadell and BBVA</small>",
    closing: "I'd be delighted to arrange a visit or answer any questions. This development is receiving excellent feedback and the best units are reserving fast.",
  },
};

const lastUnitDefaults = {
  es: {
    title: "Última unidad disponible · Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · Entrega Q2 2026",
    body: "Te avisamos de que solo queda <strong>1 unidad disponible</strong> en esta promoción. Un ático de 3 dormitorios con orientación sureste, terraza de 42 m² y vistas al mar. Si tienes algún cliente interesado, este es el momento de cerrar la operación — la promoción está prácticamente vendida.",
    cta: "Reservar ahora",
    cta2: "Ver ficha completa",
  },
  en: {
    title: "Last unit available · Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · Delivery Q2 2026",
    body: "Heads up — only <strong>1 unit is left</strong> in this development. A 3-bedroom penthouse, south-east facing, with a 42 m² terrace and sea views. If you have an interested client, this is the moment to close the deal — the project is virtually sold out.",
    cta: "Reserve now",
    cta2: "View full listing",
  },
};

const newLaunchDefaults = {
  es: {
    title: "Nuevo lanzamiento: Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · Entrega Q2 2026 · Por Luxinmo",
    body: "Nos complace presentarte nuestra nueva promoción residencial en primera línea de playa. <strong>44 viviendas</strong> de diseño contemporáneo, con calidades premium y zonas comunes de hotel boutique. Pre-reserva abierta a <strong>precios de lanzamiento</strong> con descuento del 5% durante las primeras 4 semanas.",
    cta: "Ver disponibilidad completa",
    cta2: "Descargar brochure",
    statAvail: "44",
    statRes: "0",
    statSold: "0",
    statBuilt: "35%",
  },
  en: {
    title: "New launch: Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · Delivery Q2 2026 · By Luxinmo",
    body: "We're excited to introduce our new beachfront residential development. <strong>44 contemporary homes</strong> with premium finishes and boutique-hotel-style amenities. Pre-bookings open at <strong>launch pricing</strong> with a 5% discount during the first 4 weeks.",
    cta: "View full availability",
    cta2: "Download brochure",
    statAvail: "44",
    statRes: "0",
    statSold: "0",
    statBuilt: "35%",
  },
};

const newAvailabilityDefaults = {
  es: {
    title: "Nueva disponibilidad · Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · Por Luxinmo",
    body: "Hemos liberado <strong>nuevas unidades</strong> en Mar Azul Residences tras la última fase de comercialización. Disponemos de tipologías de 2 y 3 dormitorios con las mejores orientaciones y áticos con solárium privado. Inventario actualizado a continuación.",
    cta: "Ver inventario completo",
  },
  en: {
    title: "New availability · Mar Azul Residences",
    subtitle: "Torrevieja, Alicante · By Luxinmo",
    body: "We've released <strong>new units</strong> at Mar Azul Residences after the latest sales phase. 2 and 3 bedroom layouts with the best orientations and penthouses with private solarium are now available. Updated inventory below.",
    cta: "View full inventory",
  },
};

const blankDefaults = {
  es: {
    title: "Asunto del email",
    body: "Escribe aquí tu mensaje. Esta plantilla en blanco solo incluye la cabecera de marca y tu firma — el resto es tuyo.",
  },
  en: {
    title: "Email subject",
    body: "Write your message here. This blank template only includes the brand header and your signature — everything else is up to you.",
  },
};

// ---------- Templates ----------

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: "last-unit",
    audiences: ["client", "collaborator"],
    label: { es: "Última unidad", en: "Last unit" },
    description: {
      es: "Aviso de urgencia · Solo activa cuando queda 1 unidad disponible",
      en: "Urgency notice · Only enabled when 1 unit is left",
    },
    heroImage: HERO_UNIT,
    agentAvatar: AGENT_AVATAR,
    supportsAvailability: false,
    supportsSignature: true,
    requiresAvailableCount: 1,
    defaultBlocks: {
      es: { ...lastUnitDefaults.es, ...commercialDefaults.es, ...brandDefaults.es },
      en: { ...lastUnitDefaults.en, ...commercialDefaults.en, ...brandDefaults.en },
    },
    render: (b, lang, opts = {}) => {
      const showPromotionDetails = !opts.agencyMode;
      return wrap(`
        ${brandHeader(b, lang)}
        <div class="hero"><img src="${HERO_UNIT}" alt=""></div>
        <div class="px" style="padding-top:18px">
          <span class="pill-warn">⚠ ${lang === "es" ? "Última unidad" : "Last unit"}</span>
          <h1 class="h1" data-block="title">${b.title}</h1>
          <p class="sub" data-block="subtitle">${b.subtitle}</p>
          <div class="last-banner">
            <p class="last-banner-n">1</p>
            <p class="last-banner-l">${lang === "es" ? "unidad disponible" : "unit available"}</p>
          </div>
          <p class="body" data-block="body">${b.body}</p>
          ${showPromotionDetails ? featuresBlock(b, lang) : ""}
          ${showPromotionDetails ? projectInfoBlock(b, lang) : ""}
          ${showPromotionDetails ? showroomBlock(b, lang) : ""}
          ${showPromotionDetails ? paymentBlock(b, lang) : ""}
          ${closingBlock(b)}
          <p style="margin:22px 0;text-align:center">
            <a class="btn" href="#" data-block="cta">${b.cta}</a>
            ${opts.agencyMode ? "" : `<a class="btn-2" href="#" data-block="cta2">${b.cta2}</a>`}
          </p>
          ${opts.includeSignature !== false ? agentBlock(b) : ""}
        </div>
        <div class="footer">© ${b.brandName}</div>
      `);
    },
  },
  {
    id: "new-launch",
    audiences: ["client", "collaborator"],
    label: { es: "Nuevo lanzamiento", en: "New launch" },
    description: {
      es: "Anuncio inicial de una nueva promoción a la venta",
      en: "Initial announcement of a new development on the market",
    },
    heroImage: HERO_LAUNCH,
    agentAvatar: AGENT_AVATAR,
    supportsAvailability: true,
    supportsSignature: true,
    defaultBlocks: {
      es: { ...newLaunchDefaults.es, ...commercialDefaults.es, ...brandDefaults.es },
      en: { ...newLaunchDefaults.en, ...commercialDefaults.en, ...brandDefaults.en },
    },
    render: (b, lang, opts = {}) =>
      wrap(`
        ${brandHeader(b, lang)}
        <div class="hero"><img src="${HERO_LAUNCH}" alt=""></div>
        <div class="px" style="padding-top:18px">
          <span class="pill-new">✨ ${lang === "es" ? "Nuevo lanzamiento" : "New launch"}</span>
          <h1 class="h1" data-block="title">${b.title}</h1>
          <p class="sub" data-block="subtitle">${b.subtitle}</p>
          <table class="stats"><tr>
            <td class="stat"><p class="stat-n" data-block="statAvail">${b.statAvail}</p><p class="stat-l">${lang === "es" ? "Disp." : "Available"}</p></td>
            <td class="stat"><p class="stat-n" data-block="statRes">${b.statRes}</p><p class="stat-l">${lang === "es" ? "Reserv." : "Reserved"}</p></td>
            <td class="stat"><p class="stat-n" data-block="statSold">${b.statSold}</p><p class="stat-l">${lang === "es" ? "Vendidas" : "Sold"}</p></td>
            <td class="stat"><p class="stat-n" data-block="statBuilt">${b.statBuilt}</p><p class="stat-l">${lang === "es" ? "Const." : "Built"}</p></td>
          </tr></table>
          <p class="body" data-block="body">${b.body}</p>
          ${featuresBlock(b, lang)}
          ${projectInfoBlock(b, lang)}
          ${showroomBlock(b, lang)}
          ${paymentBlock(b, lang)}
          ${opts.includeAvailability !== false ? availabilityBlock(opts.availabilityUnits || [], lang) : ""}
          ${closingBlock(b)}
          <p style="margin:22px 0;text-align:center">
            <a class="btn" href="#" data-block="cta">${b.cta}</a>
            <a class="btn-2" href="#" data-block="cta2">${b.cta2}</a>
          </p>
          ${opts.includeSignature !== false ? agentBlock(b) : ""}
        </div>
        <div class="footer">${lang === "es" ? `Compartido por · ${b.brandName}` : `Shared by · ${b.brandName}`}</div>
      `),
  },
  {
    id: "new-availability",
    audiences: ["client", "collaborator"],
    label: { es: "Nueva disponibilidad", en: "New availability" },
    description: {
      es: "Aviso de unidades nuevas liberadas en una promoción ya activa",
      en: "Notice of newly released units in an already active development",
    },
    heroImage: HERO_PROMOTION,
    agentAvatar: AGENT_AVATAR,
    supportsAvailability: true,
    supportsSignature: true,
    defaultBlocks: {
      es: { ...newAvailabilityDefaults.es, ...commercialDefaults.es, ...brandDefaults.es },
      en: { ...newAvailabilityDefaults.en, ...commercialDefaults.en, ...brandDefaults.en },
    },
    render: (b, lang, opts = {}) => {
      /* En agencyMode ocultamos los bloques que "doxean" la promoción
       * (ubicación exacta, info del proyecto, showroom con dirección, plan
       * de pagos). El cliente no debe poder llegar al promotor directo
       * desde este email — si quiere más info, contacta a la agencia. */
      const showPromotionDetails = !opts.agencyMode;
      const pillLabel = opts.agencyMode
        ? (lang === "es" ? "Oportunidad disponible" : "Available opportunity")
        : (lang === "es" ? "Nueva disponibilidad" : "New availability");
      return wrap(`
        ${brandHeader(b, lang)}
        <div class="hero"><img src="${HERO_PROMOTION}" alt=""></div>
        <div class="px" style="padding-top:18px">
          <span class="pill">● ${pillLabel}</span>
          <h1 class="h1" data-block="title">${b.title}</h1>
          <p class="sub" data-block="subtitle">${b.subtitle}</p>
          <p class="body" data-block="body">${b.body}</p>
          ${opts.includeAvailability !== false ? availabilityBlock(opts.availabilityUnits || [], lang) : ""}
          ${showPromotionDetails ? featuresBlock(b, lang) : ""}
          ${showPromotionDetails ? projectInfoBlock(b, lang) : ""}
          ${showPromotionDetails ? showroomBlock(b, lang) : ""}
          ${showPromotionDetails ? paymentBlock(b, lang) : ""}
          ${closingBlock(b)}
          <p style="margin:22px 0;text-align:center"><a class="btn" href="#" data-block="cta">${b.cta}</a></p>
          ${opts.includeSignature !== false ? agentBlock(b) : ""}
        </div>
        <div class="footer">${lang === "es" ? `Compartido por · ${b.brandName}` : `Shared by · ${b.brandName}`}</div>
      `);
    },
  },
  {
    id: "blank",
    audiences: ["client", "collaborator"],
    label: { es: "Sin plantilla", en: "Blank" },
    description: {
      es: "Email libre con cabecera de marca y firma — sin contenido predefinido",
      en: "Free-form email with brand header and signature — no preset content",
    },
    heroImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=600&fit=crop&q=80",
    agentAvatar: AGENT_AVATAR,
    supportsAvailability: false,
    supportsSignature: true,
    defaultBlocks: {
      es: { ...blankDefaults.es, ...brandDefaults.es },
      en: { ...blankDefaults.en, ...brandDefaults.en },
    },
    render: (b, lang, opts = {}) =>
      wrap(`
        ${brandHeader(b, lang)}
        <div class="px" style="padding-top:24px;padding-bottom:8px">
          <h1 class="h1" data-block="title">${b.title}</h1>
          <p class="body" data-block="body">${b.body}</p>
          ${opts.includeSignature !== false ? agentBlock(b) : ""}
        </div>
        <div class="footer">© ${b.brandName}</div>
      `),
  },
];

export function getTemplate(id: TemplateId): EmailTemplateMeta {
  return EMAIL_TEMPLATES.find(t => t.id === id)!;
}

export function getTemplatesByAudience(audience: Audience) {
  return EMAIL_TEMPLATES.filter(t => t.audiences.includes(audience));
}
