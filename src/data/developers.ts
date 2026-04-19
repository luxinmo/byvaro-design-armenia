export type DeveloperSignal = "fast-selling" | "trusted" | "high-commission" | "high-demand";

export type DeveloperPromotion = {
  name: string;
  location: string;
  units: number;
  available: number;
  priceFrom: number;
  commission: number; // percentage
  collaborating: boolean;
};

export type Developer = {
  id: string;
  name: string;
  logo?: string;
  cover?: string;
  location: string;
  market: string;
  type: "Developer" | "Commercial partner" | "Promoter";
  description: string;
  promotionsActive: number;
  unitsAvailable: number;
  totalInventoryValue: number;
  collaboration: {
    promotionsTogether: number;
    unitsICanSell: number;
  };
  focus: string[];
  signals: DeveloperSignal[];
  country: string;
  promotions: DeveloperPromotion[];
};

export const developers: Developer[] = [
  {
    id: "1",
    name: "Kronos Homes",
    logo: "https://logo.clearbit.com/kronoshomes.com",
    cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=200&fit=crop",
    location: "Madrid, Spain",
    market: "National developer",
    type: "Developer",
    description: "Leading Spanish developer specializing in premium residential projects across major cities. Known for innovative architecture and sustainable building practices.",
    promotionsActive: 6,
    unitsAvailable: 84,
    totalInventoryValue: 52400000,
    collaboration: { promotionsTogether: 3, unitsICanSell: 18 },
    focus: ["Apartments", "Luxury villas", "Penthouses"],
    signals: ["trusted", "high-commission"],
    country: "Spain",
    promotions: [
      { name: "Residencial Mirador", location: "Madrid", units: 48, available: 22, priceFrom: 385000, commission: 3.5, collaborating: true },
      { name: "Costa View Villas", location: "Málaga", units: 16, available: 8, priceFrom: 620000, commission: 4.0, collaborating: true },
      { name: "Skyline Towers", location: "Barcelona", units: 92, available: 54, priceFrom: 310000, commission: 3.0, collaborating: true },
      { name: "Parque Real", location: "Valencia", units: 30, available: 12, priceFrom: 275000, commission: 3.2, collaborating: false },
      { name: "Alto de las Rosas", location: "Sevilla", units: 22, available: 8, priceFrom: 295000, commission: 3.5, collaborating: false },
      { name: "Marina Luz", location: "Alicante", units: 18, available: 6, priceFrom: 340000, commission: 3.8, collaborating: false },
    ],
  },
  {
    id: "2",
    name: "Metrovacesa",
    logo: "https://logo.clearbit.com/metrovacesa.com",
    cover: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=200&fit=crop",
    location: "Madrid, Spain",
    market: "National developer",
    type: "Developer",
    description: "One of Spain's largest real estate developers with over 100 years of history. Strong presence in Madrid, Barcelona and coastal markets with a focus on quality construction.",
    promotionsActive: 9,
    unitsAvailable: 132,
    totalInventoryValue: 78600000,
    collaboration: { promotionsTogether: 5, unitsICanSell: 42 },
    focus: ["Apartments", "Mixed developments", "Resort developments"],
    signals: ["fast-selling", "high-demand"],
    country: "Spain",
    promotions: [
      { name: "Residencial Oasis", location: "Estepona", units: 36, available: 14, priceFrom: 295000, commission: 3.5, collaborating: true },
      { name: "Marina Gardens", location: "Valencia", units: 64, available: 38, priceFrom: 245000, commission: 3.0, collaborating: true },
      { name: "Parque Central", location: "Madrid", units: 80, available: 52, priceFrom: 420000, commission: 2.8, collaborating: true },
      { name: "Brisas del Sur", location: "Sevilla", units: 28, available: 28, priceFrom: 195000, commission: 3.5, collaborating: true },
      { name: "Terrazas de Levante", location: "Alicante", units: 44, available: 20, priceFrom: 215000, commission: 3.2, collaborating: true },
      { name: "Montecarlo Homes", location: "Málaga", units: 32, available: 18, priceFrom: 310000, commission: 3.0, collaborating: false },
      { name: "Vistas del Golf", location: "Marbella", units: 20, available: 10, priceFrom: 485000, commission: 4.0, collaborating: false },
      { name: "Jardín Nuevo", location: "Barcelona", units: 56, available: 32, priceFrom: 380000, commission: 2.5, collaborating: false },
      { name: "Puerta del Sol Res.", location: "Madrid", units: 40, available: 22, priceFrom: 450000, commission: 2.8, collaborating: false },
    ],
  },
  {
    id: "3",
    name: "Taylor Wimpey España",
    logo: "https://logo.clearbit.com/taylorwimpey.com",
    cover: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=200&fit=crop",
    location: "Palma de Mallorca, Spain",
    market: "Resort & coastal specialist",
    type: "Developer",
    description: "British-backed developer focused on premium resort and coastal properties in the Mediterranean. Expert in second-home and international buyer markets.",
    promotionsActive: 4,
    unitsAvailable: 38,
    totalInventoryValue: 31200000,
    collaboration: { promotionsTogether: 2, unitsICanSell: 12 },
    focus: ["Resort developments", "Luxury villas", "Apartments"],
    signals: ["trusted"],
    country: "Spain",
    promotions: [
      { name: "Cala Serena Residences", location: "Mallorca", units: 24, available: 12, priceFrom: 495000, commission: 4.5, collaborating: true },
      { name: "Golf Valley Homes", location: "Marbella", units: 14, available: 6, priceFrom: 780000, commission: 5.0, collaborating: true },
      { name: "Sa Coma Beach Apts", location: "Mallorca", units: 18, available: 10, priceFrom: 395000, commission: 4.0, collaborating: false },
      { name: "Port Adriano Views", location: "Mallorca", units: 12, available: 8, priceFrom: 550000, commission: 4.5, collaborating: false },
    ],
  },
  {
    id: "4",
    name: "Aedas Homes",
    logo: "https://logo.clearbit.com/aedashomes.com",
    cover: "https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&h=200&fit=crop",
    location: "Madrid, Spain",
    market: "National developer",
    type: "Developer",
    description: "Fast-growing national developer with a strong pipeline in Spain's main cities. Recognized for modern design standards and efficient construction processes.",
    promotionsActive: 11,
    unitsAvailable: 210,
    totalInventoryValue: 124000000,
    collaboration: { promotionsTogether: 0, unitsICanSell: 0 },
    focus: ["Apartments", "Penthouses", "Mixed developments"],
    signals: ["high-demand", "fast-selling"],
    country: "Spain",
    promotions: [
      { name: "Residencial Nova", location: "Madrid", units: 60, available: 44, priceFrom: 350000, commission: 2.5, collaborating: false },
      { name: "Terrazas del Mar", location: "Alicante", units: 42, available: 30, priceFrom: 225000, commission: 3.0, collaborating: false },
      { name: "Jardines de Sarriá", location: "Barcelona", units: 28, available: 18, priceFrom: 580000, commission: 2.5, collaborating: false },
    ],
  },
  {
    id: "5",
    name: "Neinor Homes",
    logo: "https://logo.clearbit.com/neinorhomes.com",
    cover: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=200&fit=crop",
    location: "Bilbao, Spain",
    market: "National developer",
    type: "Developer",
    description: "Major Spanish developer with strong presence in the Basque Country, Madrid and Andalusia. Focus on energy-efficient homes and community-oriented developments.",
    promotionsActive: 7,
    unitsAvailable: 96,
    totalInventoryValue: 58900000,
    collaboration: { promotionsTogether: 1, unitsICanSell: 8 },
    focus: ["Apartments", "Townhouses"],
    signals: ["high-commission"],
    country: "Spain",
    promotions: [
      { name: "Alameda Residences", location: "Bilbao", units: 34, available: 18, priceFrom: 275000, commission: 4.0, collaborating: true },
      { name: "Ribera Park", location: "Zaragoza", units: 48, available: 36, priceFrom: 198000, commission: 3.5, collaborating: false },
      { name: "Sierra Blanca Views", location: "Madrid", units: 22, available: 14, priceFrom: 445000, commission: 3.0, collaborating: false },
    ],
  },
  {
    id: "6",
    name: "Vía Célere",
    logo: "https://logo.clearbit.com/viacelere.com",
    cover: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=200&fit=crop",
    location: "Madrid, Spain",
    market: "National developer",
    type: "Developer",
    description: "Innovative developer committed to industrialized construction and sustainability. Delivers modern residential projects with smart home integration across Spain.",
    promotionsActive: 5,
    unitsAvailable: 67,
    totalInventoryValue: 41200000,
    collaboration: { promotionsTogether: 2, unitsICanSell: 14 },
    focus: ["Apartments", "Penthouses"],
    signals: ["trusted", "fast-selling"],
    country: "Spain",
    promotions: [
      { name: "Célere Viridis", location: "Madrid", units: 38, available: 20, priceFrom: 315000, commission: 3.0, collaborating: true },
      { name: "Célere Séptima", location: "Barcelona", units: 29, available: 15, priceFrom: 365000, commission: 3.2, collaborating: true },
      { name: "Célere Natura", location: "Valencia", units: 24, available: 14, priceFrom: 240000, commission: 3.0, collaborating: false },
      { name: "Célere Cortizo", location: "Madrid", units: 32, available: 18, priceFrom: 290000, commission: 2.8, collaborating: false },
      { name: "Célere Elysium", location: "Málaga", units: 20, available: 10, priceFrom: 275000, commission: 3.5, collaborating: false },
    ],
  },
  {
    id: "7",
    name: "Karl Lagerfeld Villas",
    logo: "https://logo.clearbit.com/karl.com",
    cover: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=200&fit=crop",
    location: "Marbella, Spain",
    market: "Ultra-luxury niche",
    type: "Commercial partner",
    description: "Exclusive ultra-luxury branded residences on the Golden Mile. Limited collection of designer villas and penthouses with world-class amenities and concierge services.",
    promotionsActive: 2,
    unitsAvailable: 12,
    totalInventoryValue: 96000000,
    collaboration: { promotionsTogether: 1, unitsICanSell: 4 },
    focus: ["Luxury villas"],
    signals: ["high-commission", "high-demand"],
    country: "Spain",
    promotions: [
      { name: "The Karl Residences", location: "Marbella", units: 8, available: 6, priceFrom: 4200000, commission: 5.0, collaborating: true },
      { name: "Lagerfeld Penthouse Col.", location: "Marbella", units: 4, available: 2, priceFrom: 8500000, commission: 5.5, collaborating: false },
    ],
  },
  {
    id: "8",
    name: "Emaar Properties",
    logo: "https://logo.clearbit.com/emaar.com",
    cover: "https://images.unsplash.com/photo-1582407947092-06087b323657?w=600&h=200&fit=crop",
    location: "Dubai, UAE",
    market: "International developer",
    type: "Developer",
    description: "Global property giant behind iconic developments including Burj Khalifa and Dubai Mall. Expanding European network with premium investment-grade residential projects.",
    promotionsActive: 3,
    unitsAvailable: 45,
    totalInventoryValue: 89000000,
    collaboration: { promotionsTogether: 0, unitsICanSell: 0 },
    focus: ["Apartments", "Luxury villas", "Resort developments"],
    signals: ["high-demand"],
    country: "UAE",
    promotions: [
      { name: "Creek Harbour Tower", location: "Dubai", units: 120, available: 28, priceFrom: 890000, commission: 3.0, collaborating: false },
      { name: "Arabian Ranches III", location: "Dubai", units: 64, available: 17, priceFrom: 1200000, commission: 3.5, collaborating: false },
      { name: "Emaar Beachfront", location: "Dubai", units: 48, available: 12, priceFrom: 1500000, commission: 3.0, collaborating: false },
    ],
  },
  {
    id: "9",
    name: "Habitat Inmobiliaria",
    logo: "https://logo.clearbit.com/habitatinmobiliaria.com",
    cover: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop",
    location: "Málaga, Spain",
    market: "Regional developer",
    type: "Promoter",
    description: "Regional promoter with deep roots in the Costa del Sol. Focused on affordable quality housing for local and national buyers. Strong after-sales reputation.",
    promotionsActive: 3,
    unitsAvailable: 28,
    totalInventoryValue: 14800000,
    collaboration: { promotionsTogether: 3, unitsICanSell: 28 },
    focus: ["Apartments", "Townhouses"],
    signals: ["trusted"],
    country: "Spain",
    promotions: [
      { name: "Jardines del Puerto", location: "Málaga", units: 32, available: 14, priceFrom: 215000, commission: 3.5, collaborating: true },
      { name: "Colinas Verdes", location: "Estepona", units: 18, available: 10, priceFrom: 268000, commission: 3.8, collaborating: true },
      { name: "Plaza Mayor Homes", location: "Torremolinos", units: 24, available: 4, priceFrom: 195000, commission: 3.0, collaborating: true },
    ],
  },
  {
    id: "10",
    name: "Grupo Insur",
    logo: "https://logo.clearbit.com/grupoinsur.com",
    cover: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=200&fit=crop",
    location: "Sevilla, Spain",
    market: "Regional developer",
    type: "Developer",
    description: "Established Andalusian developer with a diversified portfolio across residential, commercial and heritage restoration projects. Over 80 years of market experience.",
    promotionsActive: 4,
    unitsAvailable: 52,
    totalInventoryValue: 27600000,
    collaboration: { promotionsTogether: 0, unitsICanSell: 0 },
    focus: ["Apartments", "Mixed developments"],
    signals: [],
    country: "Spain",
    promotions: [
      { name: "Residencial Triana", location: "Sevilla", units: 40, available: 26, priceFrom: 235000, commission: 3.0, collaborating: false },
      { name: "Parque Alcosa II", location: "Sevilla", units: 28, available: 16, priceFrom: 178000, commission: 3.2, collaborating: false },
      { name: "Torre Macarena", location: "Sevilla", units: 18, available: 6, priceFrom: 310000, commission: 2.8, collaborating: false },
      { name: "Alamillo Gardens", location: "Sevilla", units: 22, available: 14, priceFrom: 255000, commission: 3.0, collaborating: false },
    ],
  },
];