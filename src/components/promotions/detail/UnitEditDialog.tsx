/**
 * UnitEditDialog · Modal de edición COMPLETO de una unidad en la ficha
 * de promoción. Usa el MISMO `UnitSimpleEditDialog` del wizard de
 * Crear Promoción (un único editor de unidades en el producto),
 * adaptando `Unit` ↔ `UnitData` en la frontera.
 *
 * La idea: el promotor ve exactamente lo mismo al editar una unidad
 * desde la ficha que al crearla en el wizard. Campos, secciones, UX.
 *
 * Cómo funciona:
 *   1. Al abrir, traducimos el `Unit` de la ficha a un `UnitData`
 *      (shape del wizard).
 *   2. Montamos un `WizardState` sintético con las partes heredadas
 *      que sí tenemos en la ficha (promotionCtx + promotionPhotos).
 *   3. Cada `onUpdate(patch)` que emita el dialog se traduce de
 *      `Partial<UnitData>` a `Partial<Unit>` y se propaga vía
 *      `onUpdateUnit(id, patch)` · exactamente el mismo flujo que ya
 *      usa la edición inline del ficha (auto-save por campo).
 *
 * TODO(backend):
 *   - Cuando persista al backend, el PATCH /api/units/:id acepta el
 *     shape `Unit` · la traducción de abajo ya lo deja plano.
 *   - Algunos campos (parking, trastero, piscinaPrivada, subtipo,
 *     videosUnidad, planoUrls) viven hoy solo en el shape del wizard
 *     · migrarlos a `Unit` cuando añadamos esos campos al shape
 *     canónico de la ficha.
 */

import { useMemo, useState } from "react";
import type { Unit, PromotionContext } from "@/data/units";
import type {
  UnitData, WizardState, SubtipoUnidad, TipoPromocion, PlantaBajaTipo, SubUni,
} from "@/components/crear-promocion/types";
import { defaultWizardState } from "@/components/crear-promocion/types";
import { UnitSimpleEditDialog } from "@/components/crear-promocion/UnitSimpleEditDialog";
import { urlsToFotoItems, fotoItemsToUrls } from "@/components/shared/MultimediaEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: Unit | null;
  /** Contexto heredado de la promoción (descripcion, caracteristicas,
   *  hitosPago, nombrePromocion…) para alimentar la parte "heredado" del
   *  dialog. */
  promotionCtx?: PromotionContext;
  /** Fotos de la promoción · alimentan el toggle "usar fotos heredadas"
   *  del dialog. Si el promotor las tiene vacías, el editor cae a las
   *  fotos propias de la unit. */
  promotionPhotos?: string[];
  /** Hints sobre la estructura del edificio para poblar el selector de
   *  planta · opcional · si se omiten usamos defaults razonables
   *  (plurifamiliar, 10 plantas, sin plantaBaja). */
  tipo?: TipoPromocion;
  plantas?: number;
  plantaBajaTipo?: PlantaBajaTipo;
  subUni?: SubUni;
  onUpdateUnit: (unitId: string, patch: Partial<Unit>) => void;
}

export function UnitEditDialog({
  open, onOpenChange, unit, promotionCtx, promotionPhotos,
  tipo, plantas, plantaBajaTipo, subUni, onUpdateUnit,
}: Props) {
  /* ─── Traducción Unit → UnitData ────────────────────────────────── */
  const unitData: UnitData | null = useMemo(() => {
    if (!unit) return null;
    const basePhotos = (unit.photos && unit.photos.length > 0)
      ? unit.photos
      : (promotionPhotos && promotionPhotos.length > 0 ? [] : []);
    return {
      id: unit.id,
      ref: unit.ref,
      nombre: unit.publicId?.trim() || `${unit.floor}º${unit.door}`,
      dormitorios: unit.bedrooms,
      banos: unit.bathrooms,
      superficieConstruida: unit.builtArea,
      superficieUtil: unit.usableArea,
      superficieTerraza: unit.terrace,
      parcela: unit.parcel,
      precio: unit.price,
      planta: unit.floor,
      orientacion: unit.orientation,
      parking: false, // no existe en Unit · se ignora en el round-trip
      trastero: false,
      piscinaPrivada: unit.hasPool,
      status: unit.status,
      vistas: [],
      fotosMode: "heredadas",
      planos: false,
      subtipo: "apartamento" as SubtipoUnidad,
      idInterna: unit.ref,
      caracteristicas: unit.caracteristicasOverride ?? (promotionCtx?.caracteristicas ?? []),
      usarFotosPromocion: !unit.photos || unit.photos.length === 0,
      fotosUnidad: urlsToFotoItems(basePhotos),
      videosUnidad: [],
      descripcionOverride: unit.descripcionOverride,
      caracteristicasOverride: unit.caracteristicasOverride,
      hitosPagoOverride: unit.hitosPagoOverride,
      deliveryYearOverride: unit.deliveryYearOverride,
      energyCertOverride: unit.energyCertOverride,
      clientName: unit.clientName,
      agencyName: unit.agencyName,
      reservedAt: unit.reservedAt,
      soldAt: unit.soldAt,
    };
  }, [unit, promotionCtx?.caracteristicas, promotionPhotos]);

  /* ─── WizardState sintético con lo heredado ─────────────────────── */
  const state: WizardState = useMemo(() => ({
    ...defaultWizardState,
    tipo: tipo ?? "plurifamiliar",
    subUni: subUni ?? null,
    plantas: plantas ?? 10,
    plantaBajaTipo: plantaBajaTipo ?? null,
    nombrePromocion: promotionCtx?.nombrePromocion ?? "Promoción",
    descripcion: promotionCtx?.descripcion ?? "",
    caracteristicasVivienda: promotionCtx?.caracteristicas ?? [],
    hitosPago: promotionCtx?.hitosPago ?? [],
    fotos: urlsToFotoItems(promotionPhotos ?? []),
    videos: [],
  }), [tipo, subUni, plantas, plantaBajaTipo, promotionCtx, promotionPhotos]);

  /* ─── onUpdate · traduce Partial<UnitData> → Partial<Unit> ─────── */
  const handleUpdate = (patch: Partial<UnitData>) => {
    if (!unit) return;
    const unitPatch: Partial<Unit> = {};
    if ("nombre" in patch)                 unitPatch.publicId = patch.nombre ?? "";
    if ("dormitorios" in patch)            unitPatch.bedrooms = patch.dormitorios ?? 0;
    if ("banos" in patch)                  unitPatch.bathrooms = patch.banos ?? 0;
    if ("superficieConstruida" in patch)   unitPatch.builtArea = patch.superficieConstruida ?? 0;
    if ("superficieUtil" in patch)         unitPatch.usableArea = patch.superficieUtil ?? 0;
    if ("superficieTerraza" in patch)      unitPatch.terrace = patch.superficieTerraza ?? 0;
    if ("parcela" in patch)                unitPatch.parcel = patch.parcela ?? 0;
    if ("precio" in patch)                 unitPatch.price = patch.precio ?? 0;
    if ("planta" in patch)                 unitPatch.floor = patch.planta ?? 0;
    if ("orientacion" in patch)            unitPatch.orientation = patch.orientacion ?? "";
    if ("piscinaPrivada" in patch)         unitPatch.hasPool = patch.piscinaPrivada ?? false;
    if ("status" in patch)                 unitPatch.status = patch.status ?? "available";
    if ("descripcionOverride" in patch)    unitPatch.descripcionOverride = patch.descripcionOverride;
    if ("caracteristicasOverride" in patch) unitPatch.caracteristicasOverride = patch.caracteristicasOverride;
    if ("hitosPagoOverride" in patch)      unitPatch.hitosPagoOverride = patch.hitosPagoOverride;
    if ("deliveryYearOverride" in patch)   unitPatch.deliveryYearOverride = patch.deliveryYearOverride;
    if ("energyCertOverride" in patch)     unitPatch.energyCertOverride = patch.energyCertOverride;

    /* caracteristicas (sin suffix Override) · si difiere de las
     * heredadas, se guarda como override · si vuelve a coincidir,
     * borra el override (para volver a heredar). */
    if ("caracteristicas" in patch) {
      const newChars = patch.caracteristicas ?? [];
      const inherited = promotionCtx?.caracteristicas ?? [];
      const same = newChars.length === inherited.length && newChars.every((c) => inherited.includes(c));
      unitPatch.caracteristicasOverride = same ? undefined : [...newChars];
    }

    /* fotosUnidad (FotoItem[]) → photos (string[]) · si vacío, se
     * borra el override y la ficha hereda el fallback mock. */
    if ("fotosUnidad" in patch) {
      const urls = fotoItemsToUrls((patch.fotosUnidad ?? []).filter((f) => !f.id.startsWith("disabled-")));
      unitPatch.photos = urls.length > 0 ? urls : undefined;
    }

    // Campos que no tienen sitio en Unit hoy (parking, trastero, subtipo,
    // videosUnidad, planoUrls, vistas, fotosMode, usarFotosPromocion,
    // fase) se ignoran intencionadamente hasta que se añadan al shape.
    if (Object.keys(unitPatch).length > 0) onUpdateUnit(unit.id, unitPatch);
  };

  return (
    <UnitSimpleEditDialog
      open={open}
      onOpenChange={onOpenChange}
      unit={unitData}
      state={state}
      onUpdate={handleUpdate}
    />
  );
}
