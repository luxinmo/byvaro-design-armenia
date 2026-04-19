// Mock pool of company-wide sales offices that the developer can attach to a promotion.
export type CompanyOffice = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  whatsapp?: string;
  coverUrl?: string;
};

export const companyOffices: CompanyOffice[] = [
  {
    id: "co-1",
    name: "Oficina Central Marbella",
    address: "Av. del Mar 15",
    city: "Marbella",
    province: "Málaga",
    phone: "+34 952 123 456",
    email: "marbella@mycompany.com",
    whatsapp: "+34 652 123 456",
    coverUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop",
  },
  {
    id: "co-2",
    name: "Showroom Puerto Banús",
    address: "Puerto Banús, Local 8",
    city: "Marbella",
    province: "Málaga",
    phone: "+34 952 654 321",
    email: "banus@mycompany.com",
    whatsapp: "+34 652 654 321",
    coverUrl: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=600&h=400&fit=crop",
  },
  {
    id: "co-3",
    name: "Sales Office Jávea",
    address: "Av. del Plá 12",
    city: "Jávea",
    province: "Alicante",
    phone: "+34 965 123 456",
    email: "javea@mycompany.com",
    whatsapp: "+34 665 123 456",
    coverUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&h=400&fit=crop",
  },
  {
    id: "co-4",
    name: "Madrid HQ",
    address: "Paseo de la Castellana 89",
    city: "Madrid",
    province: "Madrid",
    phone: "+34 910 123 456",
    email: "madrid@mycompany.com",
    coverUrl: "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=600&h=400&fit=crop",
  },
  {
    id: "co-5",
    name: "Costa Blanca Office",
    address: "C/ del Sol 22",
    city: "Torrevieja",
    province: "Alicante",
    phone: "+34 966 100 200",
    email: "torrevieja@mycompany.com",
  },
  {
    id: "co-6",
    name: "Mijas Showroom",
    address: "Av. de Mijas 5",
    city: "Mijas",
    province: "Málaga",
    phone: "+34 952 555 010",
    email: "mijas@mycompany.com",
    coverUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600&h=400&fit=crop",
  },
];
