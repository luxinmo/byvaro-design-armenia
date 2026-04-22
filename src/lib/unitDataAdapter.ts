/**
 * Adapter bidireccional UnitData (wizard) ↔ Unit (ficha).
 *
 * Vive en `src/lib/` para poder ser consumido tanto desde el wizard
 * (CrearUnidadesStep) como desde la ficha de promoción (PromocionDetalle)
 * sin duplicar la lógica.
 *
 * El `promotionId` lo inyecta el llamante porque puede ser el ID mock
 * de la promoción o el id interno del wizard (`__wizard_draft__`).
 */

import type { UnitData, SubtipoUnidad } from "@/components/crear-promocion/types";
import type { Unit } from "@/data/units";

const subtipoToType: Record<SubtipoUnidad, string> = {
  apartamento: "Apartamento",
  loft: "Loft",
  penthouse: "Ático",
  duplex: "Dúplex",
  triplex: "Tríplex",
  planta_baja: "Estudio",
};
const typeToSubtipo: Record<string, SubtipoUnidad> = {
  "Apartamento": "apartamento",
  "Loft": "loft",
  "Ático": "penthouse",
  "Dúplex": "duplex",
  "Tríplex": "triplex",
  "Estudio": "planta_baja",
};

function extractBlock(nombre: string): string {
  const m = nombre.match(/^(B\d+(?:-E\d+)?)-/);
  return m?.[1] ?? "principal";
}
function extractDoor(nombre: string): string {
  const m = nombre.match(/([A-Z])$/);
  return m?.[1] ?? "";
}

export function unitDataToUnit(u: UnitData, promotionId: string): Unit {
  return {
    id: u.id,
    ref: u.ref || u.idInterna || u.id,
    promotionId,
    block: extractBlock(u.nombre),
    floor: u.planta ?? 0,
    door: extractDoor(u.nombre),
    publicId: u.nombre,
    type: subtipoToType[u.subtipo ?? "apartamento"] ?? "Apartamento",
    bedrooms: u.dormitorios ?? 0,
    bathrooms: u.banos ?? 0,
    builtArea: u.superficieConstruida ?? 0,
    usableArea: u.superficieUtil ?? 0,
    terrace: u.superficieTerraza ?? 0,
    garden: 0,
    parcel: u.parcela ?? 0,
    hasPool: u.piscinaPrivada ?? false,
    orientation: u.orientacion ?? "Sur",
    price: u.precio ?? 0,
    status: u.status ?? "available",
    clientName: u.clientName,
    agencyName: u.agencyName,
    reservedAt: u.reservedAt,
    soldAt: u.soldAt,
    descripcionOverride: u.descripcionOverride,
    caracteristicasOverride: u.caracteristicasOverride,
    hitosPagoOverride: u.hitosPagoOverride,
    deliveryYearOverride: u.deliveryYearOverride,
    energyCertOverride: u.energyCertOverride,
  };
}

export function mergeUnitIntoUnitData(existing: UnitData, unit: Unit): UnitData {
  return {
    ...existing,
    dormitorios: unit.bedrooms,
    banos: unit.bathrooms,
    superficieConstruida: unit.builtArea,
    superficieUtil: unit.usableArea,
    superficieTerraza: unit.terrace,
    parcela: unit.parcel,
    piscinaPrivada: unit.hasPool,
    planta: unit.floor,
    orientacion: unit.orientation,
    precio: unit.price,
    status: unit.status,
    subtipo: typeToSubtipo[unit.type] ?? existing.subtipo,
    ref: unit.ref,
    idInterna: unit.ref,
    nombre: unit.publicId || existing.nombre,
    clientName: unit.clientName,
    agencyName: unit.agencyName,
    reservedAt: unit.reservedAt,
    soldAt: unit.soldAt,
  };
}
