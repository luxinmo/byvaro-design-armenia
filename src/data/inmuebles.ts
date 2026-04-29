/**
 * inmuebles.ts — Modelo + seeds del catálogo de inmuebles.
 *
 * Un "inmueble" es una unidad individual del catálogo del workspace
 * (piso, casa, local…) que el equipo gestiona de forma autónoma —
 * NO está acoplado a una promoción. Cada workspace (promotor o
 * agencia) crea los suyos. Para que un inmueble sea visible al resto
 * de la red, el dueño tiene que activar `shareWithNetwork`; mientras
 * tanto es de uso interno.
 *
 * REGLA DE ORO · "Datos del workspace son por tenant" — los inmuebles
 * de cada org viven en su propia clave de localStorage. Ver
 * `src/lib/inmueblesStorage.ts` (storage + hook) y la entrada
 * "Inmuebles · scoped por organización" en MEMORY.md.
 *
 * TODO(backend): tabla `inmuebles` con `organization_id` + RLS por
 * JWT. `GET /api/inmuebles` ya devuelve scoped al workspace; el
 * endpoint público de red filtra por `share_with_network = true`.
 */

export type InmuebleType =
  | "piso"
  | "casa"
  | "atico"
  | "duplex"
  | "estudio"
  | "local"
  | "oficina"
  | "nave"
  | "parking"
  | "trastero"
  | "terreno";

export type InmuebleOperation =
  | "venta"
  | "alquiler"
  | "alquiler-vacacional"
  | "traspaso";

export type InmuebleStatus =
  | "disponible"
  | "reservado"
  | "vendido"
  | "alquilado"
  | "retirado";

export interface Inmueble {
  id: string;
  /** Workspace dueño · matches `currentWorkspaceKey(user)`. */
  organizationId: string;
  /** Código interno · libre, lo introduce el creador. */
  reference: string;

  type: InmuebleType;
  operation: InmuebleOperation;
  status: InmuebleStatus;

  /** EUR — para alquiler es € / mes. */
  price: number;

  /** Calle / urbanización. */
  address: string;
  city: string;
  province: string;

  bedrooms?: number;
  bathrooms?: number;
  /** m² útiles. */
  usefulArea?: number;
  /** m² construidos. */
  builtArea?: number;

  /** Oficina / sucursal a la que pertenece (display only en el mock). */
  branchLabel?: string;

  /** Miembro responsable del inmueble · id de TeamMember del workspace. */
  ownerMemberId?: string;

  /** URLs de fotos. La primera es la portada. */
  photos: string[];

  description: string;

  /** Etiquetas libres (categoría comercial, segmento…). */
  tags: string[];

  /**
   * Si true, el inmueble es visible para colaboradores externos
   * (otras agencias / promotores de la red). Si false, uso interno.
   */
  shareWithNetwork: boolean;

  /** Favorito del workspace dueño · UI rail de la card. */
  isFavorite?: boolean;

  createdAt: string;
  updatedAt: string;
}

/* ─── Helpers de label ──────────────────────────────────────────── */

export const INMUEBLE_TYPE_LABEL: Record<InmuebleType, string> = {
  piso: "Piso",
  casa: "Casa",
  atico: "Ático",
  duplex: "Dúplex",
  estudio: "Estudio",
  local: "Local",
  oficina: "Oficina",
  nave: "Nave",
  parking: "Parking",
  trastero: "Trastero",
  terreno: "Terreno",
};

export const INMUEBLE_OPERATION_LABEL: Record<InmuebleOperation, string> = {
  "venta": "Venta",
  "alquiler": "Alquiler",
  "alquiler-vacacional": "Alquiler vacacional",
  "traspaso": "Traspaso",
};

export const INMUEBLE_STATUS_LABEL: Record<InmuebleStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  alquilado: "Alquilado",
  retirado: "Retirado",
};

/* ─── Seeds por workspace ───────────────────────────────────────────
 *
 * El seed se aplica sólo si la clave de localStorage del workspace
 * está vacía · una vez creado/editado/borrado un inmueble se persiste
 * y los seeds dejan de aplicarse para ese workspace.
 */

/* Curated · Unsplash IDs estables, sin huellas de foto fake. */
const PH = {
  pisoLujo:    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&h=600&fit=crop",
  pisoCentro:  "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&h=600&fit=crop",
  pisoLuminoso:"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&h=600&fit=crop",
  pisoReform:  "https://images.unsplash.com/photo-1565182999561-18d7dc61c393?w=900&h=600&fit=crop",
  atico:       "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&h=600&fit=crop",
  aticoTerr:   "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&h=600&fit=crop",
  villa:       "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&h=600&fit=crop",
  villaPiscina:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&h=600&fit=crop",
  casaCampo:   "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=900&h=600&fit=crop",
  duplex:      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&h=600&fit=crop",
  loft:        "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=900&h=600&fit=crop",
  estudio:     "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&h=600&fit=crop",
  estudioMod:  "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=900&h=600&fit=crop",
  local:       "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=600&fit=crop",
  localResto:  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=600&fit=crop",
  oficina:     "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=600&fit=crop",
  oficinaModer:"https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=900&h=600&fit=crop",
  nave:        "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=900&h=600&fit=crop",
  parking:     "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=900&h=600&fit=crop",
  trastero:    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",
  terreno:     "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&h=600&fit=crop",
  ibiza:       "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=900&h=600&fit=crop",
  mallorca:    "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=900&h=600&fit=crop",
};

/** Inmuebles demo del workspace developer (Luxinmo) · catálogo amplio
 *  diseñado para validar todos los tipos, operaciones y estados.
 *  Mezcla zonas (Costa Blanca · Madrid · Barcelona · Baleares · Costa
 *  del Sol · Valencia) y rangos de precio (89k → 4.5M). */
const DEVELOPER_SEED: Inmueble[] = [
  /* ─── Costa Blanca · core de la cartera Luxinmo ─── */
  {
    id: "inm-dev-1",
    organizationId: "developer-default",
    reference: "7813",
    type: "piso",
    operation: "venta",
    status: "disponible",
    price: 699_000,
    address: "Avda. de las Naciones 12",
    city: "Alicante",
    province: "Alicante",
    bedrooms: 3, bathrooms: 2, usefulArea: 100, builtArea: 121,
    branchLabel: "Luxinmo · Altea",
    ownerMemberId: "u1",
    photos: [PH.pisoLujo],
    description:
      "Vivienda recién reformada en urbanización exclusiva con piscina y zonas deportivas. Tres dormitorios, dos baños y salón abierto con acceso a una terraza con vistas al mar.",
    tags: ["B.B+", "Vista mar"],
    shareWithNetwork: true,
    isFavorite: true,
    createdAt: "2026-04-12T10:00:00Z",
    updatedAt: "2026-04-22T16:30:00Z",
  },
  {
    id: "inm-dev-2",
    organizationId: "developer-default",
    reference: "7820",
    type: "atico",
    operation: "venta",
    status: "reservado",
    price: 1_250_000,
    address: "Paseo Marítimo 88",
    city: "Altea",
    province: "Alicante",
    bedrooms: 4, bathrooms: 3, usefulArea: 180, builtArea: 215,
    branchLabel: "Luxinmo · Altea",
    ownerMemberId: "u2",
    photos: [PH.atico, PH.aticoTerr],
    description:
      "Ático dúplex con terraza panorámica de 90 m² y piscina privada. Acabados de lujo, garaje doble incluido y trastero. Listo para entrar a vivir.",
    tags: ["Premium", "Vista mar", "Piscina privada"],
    shareWithNetwork: true,
    createdAt: "2026-03-20T11:00:00Z",
    updatedAt: "2026-04-19T09:15:00Z",
  },
  {
    id: "inm-dev-3",
    organizationId: "developer-default",
    reference: "7855",
    type: "casa",
    operation: "venta",
    status: "disponible",
    price: 2_450_000,
    address: "Urb. Sierra Cortina 24",
    city: "Finestrat",
    province: "Alicante",
    bedrooms: 5, bathrooms: 4, usefulArea: 320, builtArea: 410,
    branchLabel: "Luxinmo · Benidorm",
    ownerMemberId: "u7",
    photos: [PH.villaPiscina, PH.villa],
    description:
      "Villa moderna de obra reciente con piscina infinity, jardín mediterráneo y vistas al skyline de Benidorm. Cinco dormitorios en suite, sala de cine y bodega.",
    tags: ["Premium", "Obra reciente", "Piscina infinity"],
    shareWithNetwork: false,
    createdAt: "2026-02-08T14:20:00Z",
    updatedAt: "2026-04-23T18:00:00Z",
  },
  {
    id: "inm-dev-4",
    organizationId: "developer-default",
    reference: "7902",
    type: "local",
    operation: "alquiler",
    status: "disponible",
    price: 3_200,
    address: "Calle Mayor 47",
    city: "Alicante",
    province: "Alicante",
    usefulArea: 145, builtArea: 160,
    branchLabel: "Luxinmo · Altea",
    ownerMemberId: "u3",
    photos: [PH.local],
    description:
      "Local comercial a pie de calle en zona de alto tránsito peatonal. Esquinero, dos fachadas, instalación eléctrica y A/C reciente.",
    tags: ["Centro", "A pie de calle", "Esquinero"],
    shareWithNetwork: true,
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-04-15T12:00:00Z",
  },
  {
    id: "inm-dev-5",
    organizationId: "developer-default",
    reference: "7948",
    type: "duplex",
    operation: "alquiler-vacacional",
    status: "disponible",
    price: 4_800,
    address: "Playa de la Albir 7",
    city: "Alfaz del Pi",
    province: "Alicante",
    bedrooms: 3, bathrooms: 2, usefulArea: 130, builtArea: 150,
    branchLabel: "Luxinmo · Altea",
    ownerMemberId: "u2",
    photos: [PH.duplex],
    description:
      "Dúplex frente a la playa con dos terrazas, parking privado y acceso directo al paseo marítimo. Disponible para temporadas de verano.",
    tags: ["Frente al mar", "Temporada"],
    shareWithNetwork: false,
    createdAt: "2026-04-10T16:40:00Z",
    updatedAt: "2026-04-25T10:00:00Z",
  },

  /* ─── Madrid · expansión interior ─── */
  {
    id: "inm-dev-6",
    organizationId: "developer-default",
    reference: "M-201",
    type: "piso",
    operation: "venta",
    status: "disponible",
    price: 1_180_000,
    address: "Calle Velázquez 64, planta 5ª",
    city: "Madrid",
    province: "Madrid",
    bedrooms: 4, bathrooms: 3, usefulArea: 165, builtArea: 192,
    branchLabel: "Luxinmo · Madrid",
    ownerMemberId: "u1",
    photos: [PH.pisoCentro, PH.pisoLuminoso],
    description:
      "Piso señorial en pleno barrio de Salamanca, edificio rehabilitado con portero físico y dos ascensores. Techos altos, suelos hidráulicos originales y cuatro dormitorios exteriores.",
    tags: ["Barrio Salamanca", "Señorial", "Reformado"],
    shareWithNetwork: true,
    createdAt: "2026-03-02T10:00:00Z",
    updatedAt: "2026-04-26T11:00:00Z",
  },
  {
    id: "inm-dev-7",
    organizationId: "developer-default",
    reference: "M-218",
    type: "oficina",
    operation: "alquiler",
    status: "disponible",
    price: 5_500,
    address: "Paseo de la Castellana 142",
    city: "Madrid",
    province: "Madrid",
    usefulArea: 240, builtArea: 280,
    branchLabel: "Luxinmo · Madrid",
    ownerMemberId: "u7",
    photos: [PH.oficinaModer, PH.oficina],
    description:
      "Oficina corporativa en torre AAA con certificación LEED Gold. Open space para 30 puestos, dos salas de reunión, office y dos plazas de parking. Recepción 24/7.",
    tags: ["Castellana", "AAA", "LEED Gold"],
    shareWithNetwork: true,
    createdAt: "2026-03-15T09:30:00Z",
    updatedAt: "2026-04-20T14:20:00Z",
  },

  /* ─── Barcelona · pied-à-terre y singulares ─── */
  {
    id: "inm-dev-8",
    organizationId: "developer-default",
    reference: "B-104",
    type: "piso",
    operation: "venta",
    status: "disponible",
    price: 845_000,
    address: "Carrer Pau Claris 124",
    city: "Barcelona",
    province: "Barcelona",
    bedrooms: 2, bathrooms: 2, usefulArea: 95, builtArea: 110,
    branchLabel: "Luxinmo · Barcelona",
    ownerMemberId: "u2",
    photos: [PH.loft, PH.pisoReform],
    description:
      "Piso modernista en finca de 1908 totalmente rehabilitada. Suelo de mosaico hidráulico, galería interior, dos balcones a calle y acabados contemporáneos.",
    tags: ["Eixample", "Modernista", "Rehabilitado"],
    shareWithNetwork: true,
    createdAt: "2026-02-22T12:00:00Z",
    updatedAt: "2026-04-18T17:30:00Z",
  },
  {
    id: "inm-dev-9",
    organizationId: "developer-default",
    reference: "B-119",
    type: "parking",
    operation: "venta",
    status: "vendido",
    price: 38_000,
    address: "Carrer Provença 286",
    city: "Barcelona",
    province: "Barcelona",
    usefulArea: 12,
    branchLabel: "Luxinmo · Barcelona",
    ownerMemberId: "u3",
    photos: [PH.parking],
    description:
      "Plaza de parking grande en garaje vigilado. Acceso por mando con cámara de matrícula. Ideal para SUV o coche eléctrico (toma instalada).",
    tags: ["Carga eléctrica", "Vigilado"],
    shareWithNetwork: false,
    createdAt: "2026-01-10T10:00:00Z",
    updatedAt: "2026-03-28T16:00:00Z",
  },

  /* ─── Baleares · Mallorca + Ibiza ─── */
  {
    id: "inm-dev-10",
    organizationId: "developer-default",
    reference: "I-007",
    type: "casa",
    operation: "venta",
    status: "disponible",
    price: 4_500_000,
    address: "Cami de Cala Conta 12",
    city: "Sant Josep",
    province: "Baleares",
    bedrooms: 6, bathrooms: 5, usefulArea: 410, builtArea: 510,
    branchLabel: "Luxinmo · Ibiza",
    ownerMemberId: "u1",
    photos: [PH.ibiza, PH.villaPiscina],
    description:
      "Villa contemporánea sobre acantilado con vistas a Es Vedrà. Seis suites, piscina infinity climatizada, gimnasio, spa y casa de invitados independiente. Parcela de 4.000 m².",
    tags: ["Premium", "Frente al mar", "Es Vedrà"],
    shareWithNetwork: true,
    isFavorite: true,
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-04-25T09:00:00Z",
  },
  {
    id: "inm-dev-11",
    organizationId: "developer-default",
    reference: "M-PMI-44",
    type: "casa",
    operation: "venta",
    status: "disponible",
    price: 1_690_000,
    address: "Carrer del Camp 18",
    city: "Sóller",
    province: "Baleares",
    bedrooms: 4, bathrooms: 3, usefulArea: 245, builtArea: 290,
    branchLabel: "Luxinmo · Ibiza",
    ownerMemberId: "u7",
    photos: [PH.casaCampo, PH.mallorca],
    description:
      "Casa tradicional mallorquina rehabilitada en el valle de Sóller. Vigas de madera originales, cocina office, jardín de cítricos y piscina. Tranquilidad absoluta a 10 min del puerto.",
    tags: ["Tradicional", "Valle Sóller", "Cítricos"],
    shareWithNetwork: true,
    createdAt: "2026-03-08T11:00:00Z",
    updatedAt: "2026-04-22T13:45:00Z",
  },

  /* ─── Costa del Sol · terreno + traspaso ─── */
  {
    id: "inm-dev-12",
    organizationId: "developer-default",
    reference: "MLG-T-03",
    type: "terreno",
    operation: "venta",
    status: "disponible",
    price: 880_000,
    address: "Cerros del Águila, parcela 14",
    city: "Mijas",
    province: "Málaga",
    usefulArea: 2_400,
    branchLabel: "Luxinmo · Marbella",
    ownerMemberId: "u3",
    photos: [PH.terreno],
    description:
      "Parcela urbana edificable de 2.400 m² con licencia para vivienda unifamiliar de 600 m² construidos. Vistas despejadas al Mediterráneo y a Fuengirola. Todos los suministros a pie de parcela.",
    tags: ["Urbano", "Vista mar", "Licencia lista"],
    shareWithNetwork: true,
    createdAt: "2026-03-25T15:00:00Z",
    updatedAt: "2026-04-21T10:00:00Z",
  },
  {
    id: "inm-dev-13",
    organizationId: "developer-default",
    reference: "MAD-TR-01",
    type: "local",
    operation: "traspaso",
    status: "disponible",
    price: 95_000,
    address: "Calle Espíritu Santo 22",
    city: "Madrid",
    province: "Madrid",
    usefulArea: 110, builtArea: 125,
    branchLabel: "Luxinmo · Madrid",
    ownerMemberId: "u2",
    photos: [PH.localResto],
    description:
      "Traspaso de restaurante en pleno Malasaña con licencia C3 (cocina completa). 38 plazas en sala, terraza autorizada de 12 plazas y mobiliario reciente incluido.",
    tags: ["Malasaña", "Licencia C3", "Terraza"],
    shareWithNetwork: false,
    createdAt: "2026-04-08T11:00:00Z",
    updatedAt: "2026-04-26T18:00:00Z",
  },

  /* ─── Valencia · entrada de gama / inversión ─── */
  {
    id: "inm-dev-14",
    organizationId: "developer-default",
    reference: "VLC-129",
    type: "estudio",
    operation: "alquiler",
    status: "alquilado",
    price: 780,
    address: "Carrer del Doctor Moliner 18",
    city: "Valencia",
    province: "Valencia",
    bedrooms: 0, bathrooms: 1, usefulArea: 32, builtArea: 38,
    branchLabel: "Luxinmo · Valencia",
    ownerMemberId: "u3",
    photos: [PH.estudioMod],
    description:
      "Estudio amueblado en zona universitaria, recién reformado. Cocina americana, baño con plato de ducha y altillo de descanso. Comunidad con bicicletero.",
    tags: ["Universitario", "Amueblado", "Reformado"],
    shareWithNetwork: false,
    createdAt: "2026-01-20T09:00:00Z",
    updatedAt: "2026-04-15T10:00:00Z",
  },
  {
    id: "inm-dev-15",
    organizationId: "developer-default",
    reference: "VLC-148",
    type: "nave",
    operation: "venta",
    status: "disponible",
    price: 540_000,
    address: "Polígono Fuente del Jarro, calle 7",
    city: "Paterna",
    province: "Valencia",
    usefulArea: 850, builtArea: 920,
    branchLabel: "Luxinmo · Valencia",
    ownerMemberId: "u7",
    photos: [PH.nave],
    description:
      "Nave industrial diáfana en polígono consolidado. Altura libre 8 m, dos muelles de carga, oficina entreplanta de 80 m² y patio de maniobra propio.",
    tags: ["Polígono", "Muelle carga", "Diáfana"],
    shareWithNetwork: true,
    createdAt: "2026-03-12T08:00:00Z",
    updatedAt: "2026-04-19T16:00:00Z",
  },
  {
    id: "inm-dev-16",
    organizationId: "developer-default",
    reference: "ALC-RT-09",
    type: "trastero",
    operation: "venta",
    status: "retirado",
    price: 18_500,
    address: "Av. Constitución 11, sótano",
    city: "Alicante",
    province: "Alicante",
    usefulArea: 14,
    branchLabel: "Luxinmo · Altea",
    ownerMemberId: "u3",
    photos: [PH.trastero],
    description:
      "Trastero seco y bien ventilado en edificio residencial. Acceso por ascensor desde planta baja. Retirado a petición del propietario hasta nueva tasación.",
    tags: ["Sótano", "Ascensor"],
    shareWithNetwork: false,
    createdAt: "2026-02-14T10:00:00Z",
    updatedAt: "2026-04-10T11:00:00Z",
  },
];

/** Inmuebles demo para una agencia genérica · variedad de tipos /
 *  operaciones / estados para validar el listado. */
function buildAgencySeed(workspaceKey: string): Inmueble[] {
  return [
    {
      id: `inm-${workspaceKey}-1`,
      organizationId: workspaceKey,
      reference: "A-1042",
      type: "piso",
      operation: "venta",
      status: "disponible",
      price: 285_000,
      address: "Calle Castaños 18",
      city: "Alicante",
      province: "Alicante",
      bedrooms: 2, bathrooms: 1, usefulArea: 78, builtArea: 92,
      branchLabel: "Oficina central",
      photos: [PH.pisoCentro],
      description:
        "Piso reformado en pleno centro, edificio rehabilitado con ascensor. Cocina americana, salón luminoso y dos dormitorios exteriores.",
      tags: ["Centro", "Reformado"],
      shareWithNetwork: true,
      createdAt: "2026-04-05T09:00:00Z",
      updatedAt: "2026-04-20T11:00:00Z",
    },
    {
      id: `inm-${workspaceKey}-2`,
      organizationId: workspaceKey,
      reference: "A-1058",
      type: "oficina",
      operation: "alquiler",
      status: "disponible",
      price: 1_950,
      address: "Avda. de la Estación 22, planta 4ª",
      city: "Alicante",
      province: "Alicante",
      usefulArea: 110, builtArea: 125,
      branchLabel: "Oficina central",
      photos: [PH.oficina],
      description:
        "Oficina diáfana con cinco despachos modulares, sala de reuniones y office. Edificio con conserjería 24 h y dos plazas de parking incluidas.",
      tags: ["Diáfana", "Estación"],
      shareWithNetwork: false,
      createdAt: "2026-03-28T13:00:00Z",
      updatedAt: "2026-04-22T15:30:00Z",
    },
    {
      id: `inm-${workspaceKey}-3`,
      organizationId: workspaceKey,
      reference: "A-1071",
      type: "casa",
      operation: "venta",
      status: "disponible",
      price: 540_000,
      address: "Calle Olivos 4",
      city: "San Juan de Alicante",
      province: "Alicante",
      bedrooms: 4, bathrooms: 3, usefulArea: 210, builtArea: 245,
      branchLabel: "Oficina central",
      photos: [PH.villa],
      description:
        "Chalet independiente con jardín de 400 m², piscina y barbacoa. Cuatro dormitorios, garaje para dos coches y zona de servicio.",
      tags: ["Piscina", "Jardín"],
      shareWithNetwork: true,
      isFavorite: true,
      createdAt: "2026-02-14T10:00:00Z",
      updatedAt: "2026-04-12T09:00:00Z",
    },
    {
      id: `inm-${workspaceKey}-4`,
      organizationId: workspaceKey,
      reference: "A-1085",
      type: "atico",
      operation: "venta",
      status: "reservado",
      price: 720_000,
      address: "Avda. de Niza 14",
      city: "Alicante",
      province: "Alicante",
      bedrooms: 3, bathrooms: 2, usefulArea: 115, builtArea: 138,
      branchLabel: "Oficina central",
      photos: [PH.aticoTerr],
      description:
        "Ático con terraza envolvente de 50 m² en primera línea de la Playa de San Juan. Solárium privado, dos plazas de parking y trastero. Comunidad con piscina y zonas verdes.",
      tags: ["Primera línea", "Solárium", "Reservado"],
      shareWithNetwork: true,
      createdAt: "2026-03-12T10:00:00Z",
      updatedAt: "2026-04-23T17:30:00Z",
    },
    {
      id: `inm-${workspaceKey}-5`,
      organizationId: workspaceKey,
      reference: "A-1098",
      type: "estudio",
      operation: "alquiler",
      status: "alquilado",
      price: 690,
      address: "Calle San Vicente 41",
      city: "Alicante",
      province: "Alicante",
      bedrooms: 0, bathrooms: 1, usefulArea: 36, builtArea: 42,
      branchLabel: "Oficina central",
      photos: [PH.estudio],
      description:
        "Estudio amueblado en zona céntrica, ideal para inversión. Reformado en 2025, cocina equipada con vitro y horno. Buena rentabilidad histórica (≈5,2% bruto).",
      tags: ["Inversión", "Amueblado", "Renta"],
      shareWithNetwork: false,
      createdAt: "2026-01-25T09:00:00Z",
      updatedAt: "2026-04-08T16:00:00Z",
    },
    {
      id: `inm-${workspaceKey}-6`,
      organizationId: workspaceKey,
      reference: "A-1110",
      type: "local",
      operation: "alquiler",
      status: "disponible",
      price: 2_400,
      address: "Plaza Calvo Sotelo 9",
      city: "Alicante",
      province: "Alicante",
      usefulArea: 95, builtArea: 108,
      branchLabel: "Oficina central",
      photos: [PH.local],
      description:
        "Local en plaza céntrica con escaparate de 7 m, salida de humos instalada y aseo accesible. Ideal hostelería o tienda gourmet.",
      tags: ["Plaza", "Salida humos"],
      shareWithNetwork: true,
      createdAt: "2026-04-02T11:00:00Z",
      updatedAt: "2026-04-21T13:00:00Z",
    },
    {
      id: `inm-${workspaceKey}-7`,
      organizationId: workspaceKey,
      reference: "A-1124",
      type: "duplex",
      operation: "alquiler-vacacional",
      status: "disponible",
      price: 3_900,
      address: "Cabo de las Huertas, urb. Las Lomas 7",
      city: "Alicante",
      province: "Alicante",
      bedrooms: 3, bathrooms: 2, usefulArea: 145, builtArea: 165,
      branchLabel: "Oficina central",
      photos: [PH.duplex],
      description:
        "Dúplex con jardín privado y piscina comunitaria a 200 m de la cala. Cuatro plazas, sábanas y lavandería incluidas. Disponible junio-septiembre.",
      tags: ["Cabo Huertas", "Piscina", "Temporada"],
      shareWithNetwork: true,
      createdAt: "2026-03-30T14:00:00Z",
      updatedAt: "2026-04-25T11:30:00Z",
    },
    {
      id: `inm-${workspaceKey}-8`,
      organizationId: workspaceKey,
      reference: "A-1138",
      type: "trastero",
      operation: "venta",
      status: "disponible",
      price: 9_500,
      address: "Calle Pintor Aparicio 8, sótano -1",
      city: "Alicante",
      province: "Alicante",
      usefulArea: 8,
      branchLabel: "Oficina central",
      photos: [PH.trastero],
      description:
        "Trastero compacto en edificio residencial, acceso por ascensor. Comunidad con vigilancia y videoportero.",
      tags: ["Centro", "Ascensor"],
      shareWithNetwork: false,
      createdAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-22T12:00:00Z",
    },
  ];
}

/**
 * Devuelve el seed correcto para un workspace.
 * - `developer-default` → DEVELOPER_SEED.
 * - `agency-<id>` → 3 inmuebles genéricos (no diferenciamos por agencia
 *   en el mock; cada agencia arranca con el mismo set demo).
 */
export function seedInmueblesForWorkspace(workspaceKey: string): Inmueble[] {
  if (workspaceKey === "developer-default") return DEVELOPER_SEED;
  if (workspaceKey.startsWith("agency-")) return buildAgencySeed(workspaceKey);
  return [];
}
