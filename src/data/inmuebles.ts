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
const DEVELOPER_SEED: Inmueble[] = [];

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
