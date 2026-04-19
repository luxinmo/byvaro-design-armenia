export type Agency = {
  id: string;
  name: string;
  logo?: string;
  cover?: string;
  location: string;
  type: "Agency" | "Broker" | "Network";
  description: string;
  visitsCount: number;
  registrations: number;
  salesVolume: number;
  collaboratingSince?: string;
  status: "active" | "pending" | "inactive" | "expired";
  offices: { city: string; address: string }[];
  /** Which promotions this agency collaborates in (by id) */
  promotionsCollaborating: string[];
  /** Total promotions from this developer the agency has access to */
  totalPromotionsAvailable: number;
  /** Is this a new request for collaboration? */
  isNewRequest?: boolean;
};

export const agencies: Agency[] = [
  {
    id: "ag-1",
    name: "Prime Properties Costa del Sol",
    logo: "https://ui-avatars.com/api/?name=PP&background=3b82f6&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=200&fit=crop",
    location: "Marbella, Spain",
    type: "Agency",
    description: "Boutique real estate agency specializing in luxury properties along the Costa del Sol. Strong network of international buyers.",
    visitsCount: 42,
    registrations: 14,
    salesVolume: 2350000,
    collaboratingSince: "Mar 2025",
    status: "active",
    offices: [
      { city: "Marbella", address: "Av. Ricardo Soriano, 72, 29601 Marbella" },
      { city: "Estepona", address: "Calle Real, 15, 29680 Estepona" },
    ],
    promotionsCollaborating: ["dev-1", "dev-2"],
    totalPromotionsAvailable: 4,
  },
  {
    id: "ag-2",
    name: "Nordic Home Finders",
    logo: "https://ui-avatars.com/api/?name=NH&background=10b981&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=200&fit=crop",
    location: "Stockholm, Sweden",
    type: "Broker",
    description: "Leading Scandinavian broker connecting Nordic buyers with Spanish coastal properties. Specialized in relocation services.",
    visitsCount: 78,
    registrations: 22,
    salesVolume: 4120000,
    collaboratingSince: "Jan 2025",
    status: "active",
    offices: [
      { city: "Stockholm", address: "Birger Jarlsgatan 44, 114 29 Stockholm" },
    ],
    promotionsCollaborating: ["dev-1", "dev-2", "dev-3", "dev-4"],
    totalPromotionsAvailable: 4,
  },
  {
    id: "ag-3",
    name: "Dutch & Belgian Realty",
    logo: "https://ui-avatars.com/api/?name=DB&background=f59e0b&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop",
    location: "Amsterdam, Netherlands",
    type: "Network",
    description: "Pan-Benelux real estate network with offices in Amsterdam, Brussels and Antwerp. Focused on second-home buyers.",
    visitsCount: 31,
    registrations: 8,
    salesVolume: 890000,
    collaboratingSince: "Feb 2026",
    status: "active",
    offices: [
      { city: "Amsterdam", address: "Herengracht 180, 1016 BR Amsterdam" },
      { city: "Brussels", address: "Avenue Louise 54, 1050 Bruxelles" },
      { city: "Antwerp", address: "Meir 85, 2000 Antwerpen" },
    ],
    promotionsCollaborating: ["dev-2", "dev-3"],
    totalPromotionsAvailable: 4,
  },
  {
    id: "ag-4",
    name: "Meridian Real Estate Group",
    logo: "https://ui-avatars.com/api/?name=MR&background=ef4444&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1464938050520-ef2571e0d6d2?w=600&h=200&fit=crop",
    location: "London, UK",
    type: "Agency",
    description: "UK-based agency specializing in Mediterranean property investments. Previous collaboration contract has expired.",
    visitsCount: 15,
    registrations: 5,
    salesVolume: 620000,
    collaboratingSince: "Jun 2024",
    status: "expired",
    offices: [
      { city: "London", address: "32 Mayfair Place, W1J 8JR London" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
  },
  {
    id: "ag-5",
    name: "Iberia Luxury Homes",
    logo: "https://ui-avatars.com/api/?name=IL&background=8b5cf6&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&h=200&fit=crop",
    location: "Lisbon, Portugal",
    type: "Agency",
    description: "Portuguese luxury agency expanding into Spanish market. Requesting collaboration for the first time.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Lisbon", address: "Av. da Liberdade 110, 1250-146 Lisboa" },
      { city: "Porto", address: "Rua de Santa Catarina 200, 4000-451 Porto" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
  },
  {
    id: "ag-6",
    name: "Baltic Property Partners",
    logo: "https://ui-avatars.com/api/?name=BP&background=06b6d4&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=200&fit=crop",
    location: "Helsinki, Finland",
    type: "Broker",
    description: "Finnish brokerage with strong Baltic network seeking partnership on Costa Blanca developments.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Helsinki", address: "Mannerheimintie 14, 00100 Helsinki" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
  },
];
