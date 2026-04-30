import { seedRef } from "@/lib/publicRef";

export type UnitStatus = "available" | "reserved" | "sold" | "withdrawn";

export type Unit = {
  id: string;
  ref: string; // internal auto-generated reference
  promotionId: string;
  block: string;
  floor: number;
  door: string;
  publicId?: string; // user-defined visible ID (optional)
  type: string;
  bedrooms: number;
  bathrooms: number;
  builtArea: number;
  usableArea: number;
  terrace: number;
  garden: number;
  parcel: number;
  hasPool: boolean;
  orientation: string;
  price: number;
  status: UnitStatus;
  clientName?: string;
  agencyName?: string;
  reservedAt?: string;
  soldAt?: string;
  // Overrides opcionales · si undefined, la ficha muestra el valor
  // heredado de la promoción.
  descripcionOverride?: string;
  caracteristicasOverride?: string[];
  hitosPagoOverride?: { porcentaje: number; descripcion: string }[];
  deliveryYearOverride?: string;
  energyCertOverride?: string;
  /** Fotos propias de la unidad. Si `undefined`, la ficha usa un
   *  fallback mock (Picsum). Primera foto = principal.
   *  TODO(backend): POST /api/units/:id/photos (upload multipart) →
   *    { url } · PATCH /api/units/:id { photos: string[] } para
   *    reordenar / borrar. */
  photos?: string[];
};

/** Contexto de promoción inyectado en la ficha de unidad para mostrar
 *  valores heredados (dirección, amenities, plan de pagos, descripción,
 *  certificado, año entrega, características globales). */
export type PromotionContext = {
  ciudad?: string;
  provincia?: string;
  pais?: string;
  nombrePromocion?: string;
  /** Año de entrega global (p. ej. "2026" o "Q2 2026"). */
  deliveryYear?: string;
  energyCert?: string;
  descripcion?: string;
  caracteristicas?: string[];
  hitosPago?: { porcentaje: number; descripcion: string }[];
  importeReserva?: number;
  amenities?: {
    piscinaComunitaria?: boolean;
    piscinaInterna?: boolean;
    zonaSpa?: boolean;
    zonaInfantil?: boolean;
    urbanizacionCerrada?: boolean;
  };
};

function generateUnits(promotionId: string, totalUnits: number, availableUnits: number, priceMin: number, priceMax: number): Unit[] {
  const blocks = totalUnits > 20 ? ["11A", "11B"] : ["11A"];
  const types = ["Apartamento", "Ático", "Dúplex", "Estudio"];
  const orientations = ["Norte", "Sur", "Este", "Oeste", "Sureste", "Suroeste"];
  const clientNames = ["María García", "Carlos López", "Ana Martín", "Pedro Sánchez", "Laura Fernández", "Miguel Torres", "Isabel Ruiz", "David Moreno"];
  const agencyNames = ["RE/MAX Costa", "Engel & Völkers", "Keller Williams", "Century 21"];

  const units: Unit[] = [];
  let unitIndex = 0;
  const soldCount = totalUnits - availableUnits;
  const reservedCount = Math.min(Math.floor(soldCount * 0.3), availableUnits > 2 ? 3 : 1);
  const withdrawnCount = Math.min(2, Math.floor(totalUnits * 0.05));
  const actuallySold = soldCount - reservedCount - withdrawnCount;

  for (const block of blocks) {
    const unitsInBlock = Math.ceil(totalUnits / blocks.length);
    const floors = Math.ceil(unitsInBlock / 4);

    for (let floor = 0; floor < floors; floor++) {
      const doorsOnFloor = Math.min(4, unitsInBlock - floor * 4);
      const doorLabels = ["A", "B", "C", "D"];

      for (let d = 0; d < doorsOnFloor; d++) {
        if (unitIndex >= totalUnits) break;

        const typeIdx = (floor + d) % types.length;
        const isAtico = floor === floors - 1;
        const bedrooms = isAtico ? 3 + (d % 2) : 1 + (d % 3);
        const bathrooms = Math.max(1, bedrooms - (d % 2));
        const builtArea = 55 + bedrooms * 25 + (isAtico ? 30 : 0);
        const terrace = isAtico ? 40 + d * 5 : 8 + d * 3;
        const garden = floor === 0 ? 20 + d * 10 : 0;
        const parcel = floor === 0 && garden > 0 ? garden + 30 : 0;
        const priceFactor = (builtArea - 55) / 200;
        const price = Math.round(priceMin + (priceMax - priceMin) * priceFactor);

        let status: UnitStatus = "available";
        if (unitIndex < actuallySold) {
          status = "sold";
        } else if (unitIndex < actuallySold + reservedCount) {
          status = "reserved";
        } else if (unitIndex < actuallySold + reservedCount + withdrawnCount) {
          status = "withdrawn";
        }

        const unitId = `${promotionId}-${block}-${floor}${doorLabels[d]}`;
        const unitRef = seedRef("unit", unitId);

        units.push({
          id: unitId,
          ref: unitRef,
          promotionId,
          block,
          floor,
          door: doorLabels[d],
          publicId: `${floor}º${doorLabels[d]}`,
          type: isAtico ? "Ático" : types[typeIdx],
          bedrooms,
          bathrooms,
          builtArea,
          usableArea: Math.round(builtArea * 0.85),
          terrace,
          garden,
          parcel,
          hasPool: isAtico || (floor === 0 && garden > 30),
          orientation: orientations[(floor + d) % orientations.length],
          price,
          status,
          clientName: status === "sold" || status === "reserved" ? clientNames[unitIndex % clientNames.length] : undefined,
          agencyName: status === "sold" || status === "reserved" ? agencyNames[unitIndex % agencyNames.length] : undefined,
          reservedAt: status === "reserved" ? "2025-01-15" : undefined,
          soldAt: status === "sold" ? "2024-11-20" : undefined,
        });

        unitIndex++;
      }
    }
  }

  return units;
}

// Generate units for all promotions
export const unitsByPromotion: Record<string, Unit[]> = {
  "1": generateUnits("1", 48, 12, 344000, 1400000),
  "2": generateUnits("2", 32, 3, 385000, 920000),
  "3": generateUnits("3", 24, 18, 890000, 2100000),
  "4": generateUnits("4", 80, 34, 265000, 580000),
  "5": generateUnits("5", 56, 1, 310000, 490000),
  "6": generateUnits("6", 16, 9, 720000, 1800000),
  "8": generateUnits("8", 40, 0, 550000, 1200000),
  "dev-2": generateUnits("dev-2", 12, 6, 680000, 1100000),
  "dev-3": generateUnits("dev-3", 36, 24, 290000, 520000),
  "dev-4": generateUnits("dev-4", 28, 18, 345000, 780000),
  "dev-5": generateUnits("dev-5", 44, 30, 215000, 410000),
};
