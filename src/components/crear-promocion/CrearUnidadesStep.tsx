/**
 * CrearUnidadesStep · Paso "Crear unidades" del wizard.
 *
 * Layout:
 *   1. Cabecera con contador + botón "+ Añadir más unidades" (popup
 *      contextual: subVariasOptions para unifamiliar varias;
 *      subtipoUnidadOptions para plurifamiliar).
 *   2. Anejos sueltos · cada Tn / Pn como fila propia con precio propio
 *      + botón "+ Añadir anejos" (popup con parking/trastero).
 *   3. Vista de disponibilidad reutilizando el mismo
 *      `PromotionAvailabilityFull` de la ficha de promoción, en modo
 *      controlado (units + onUnitsChange). Un adapter convierte
 *      UnitData ↔ Unit y preserva los campos ampliados del wizard.
 */

import { useEffect, useMemo, useState } from "react";
import { Info, Trash2, Plus, Archive, Car, Sun, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { InlineStepper } from "./SharedWidgets";
import {
  caracteristicasViviendaOptions, zonasComOptions,
  subtipoUnidadOptions, subVariasOptions,
} from "./options";
import type {
  WizardState, UnitData, SubtipoUnidad, TipoVista, SubVarias,
} from "./types";
import { PromotionAvailabilityFull } from "@/components/promotions/detail/PromotionAvailabilityFull";
import type { Unit } from "@/data/units";
import { UnitSimpleEditDialog } from "./UnitSimpleEditDialog";
import { UnitPhotosDialog } from "./UnitPhotosDialog";
import { uploadPromotionImage } from "@/lib/storage";
import { ensureDraftPersisted } from "@/lib/promotionDrafts";
import { toast } from "sonner";

const orientaciones = ["Norte", "Sur", "Este", "Oeste", "NE", "NO", "SE", "SO"];

const WIZARD_PROMO_ID = "__wizard_draft__";

/* ═══════════ Generadores ═══════════ */
function unitLabel(planta: number, totalPlantas: number, letter: string, prefix: string, plantaBajaTipo: string | null): string {
  if (planta === 0 && plantaBajaTipo === "viviendas") return `${prefix}Bajo ${letter}`;
  if (planta === totalPlantas) return `${prefix}Ático ${letter}`;
  return `${prefix}${planta}º${letter}`;
}

function unifamiliarLabelFor(index: number, tipo: SubVarias): string {
  if (tipo === "independiente") return `Villa ${index + 1}`;
  if (tipo === "adosados") return `Adosado ${index + 1}`;
  return `Pareado ${index + 1}`;
}

function baseUnit(partial: Partial<UnitData>): UnitData {
  /* Todos los campos numéricos arrancan en 0 / vacío · el user los
   * rellena · sin defaults inventados que confundan ("¿precio 250k
   * lo puse yo o vino de fábrica?"). El status sigue en "available"
   * porque es el estado inicial real, no un valor inventado. */
  return {
    id: "unit-x",
    ref: "",
    nombre: "",
    dormitorios: 0, banos: 0,
    superficieConstruida: 0, superficieUtil: 0, superficieTerraza: 0,
    parcela: 0,
    precio: 0, planta: 0, orientacion: "",
    parking: false, trastero: false,
    piscinaPrivada: false,
    status: "available",
    vistas: [],
    fotosMode: null, planos: false, subtipo: null,
    idInterna: "",
    caracteristicas: [],
    usarFotosPromocion: true,
    fotosUnidad: [], videosUnidad: [],
    ...partial,
  };
}

/** Prefijo de referencia de promoción derivado del nombre.
 *  Ej. "Altea Hills Residences" → "AHR"; en su defecto "PROM". */
function promoRefPrefix(state: WizardState): string {
  if (state.refPromocion) return state.refPromocion.toUpperCase();
  const name = state.nombrePromocion?.trim();
  if (!name) return "PROM";
  const initials = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return initials || "PROM";
}

/** Genera el siguiente número de referencia (p.ej. "AHR-0017") */
function nextRef(state: WizardState, offset: number): string {
  const prefix = promoRefPrefix(state);
  const n = state.unidades.length + offset + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

function generateEdificio(state: WizardState): UnitData[] {
  const hasVistas = state.caracteristicasVivienda?.includes("vistas_mar") ?? false;
  const startFloor = state.plantaBajaTipo === "viviendas" ? 0 : 1;
  const floorEnd = state.plantaBajaTipo === "viviendas" ? state.plantas - 1 : state.plantas;
  const units: UnitData[] = [];
  let counter = 1;
  const totalEsc = state.escalerasPorBloque.reduce((s, n) => s + n, 0);
  const totalUnits = (floorEnd - startFloor + 1) * state.aptosPorPlanta * totalEsc;
  const hasParking = state.parkings >= totalUnits;
  const hasTrastero = state.trasteros >= totalUnits;
  const prefix = promoRefPrefix(state);

  for (let b = 0; b < state.numBloques; b++) {
    const escaleras = state.escalerasPorBloque[b] || 1;
    for (let e = 0; e < escaleras; e++) {
      const bLabel = state.numBloques > 1 ? `B${b + 1}` : "";
      const eLabel = escaleras > 1 ? `E${e + 1}` : "";
      const parts = [bLabel, eLabel].filter(Boolean).join("-");
      const namePrefix = parts ? `${parts}-` : "";

      for (let p = startFloor; p <= floorEnd; p++) {
        for (let u = 1; u <= state.aptosPorPlanta; u++) {
          const letter = String.fromCharCode(64 + u);
          const subtipo: SubtipoUnidad =
            p === 0 && state.plantaBajaTipo === "viviendas" ? "planta_baja" :
              p === floorEnd ? "penthouse" : "apartamento";
          // Parcela solo para bajos (subtipo planta_baja).
          const parcela = subtipo === "planta_baja" ? 30 : 0;
          units.push(
            baseUnit({
              id: `unit-${counter}`,
              ref: `${prefix}-${String(counter).padStart(4, "0")}`,
              nombre: unitLabel(p, floorEnd, letter, namePrefix, state.plantaBajaTipo),
              planta: p,
              orientacion: orientaciones[(counter - 1) % orientaciones.length],
              parking: hasParking,
              trastero: hasTrastero,
              vistas: hasVistas ? (["mar"] as TipoVista[]) : [],
              subtipo,
              parcela,
              caracteristicas: [...(state.caracteristicasVivienda || [])],
            }),
          );
          counter++;
        }
      }
    }
  }
  return units;
}

function generateSingleUnit(state: WizardState): UnitData[] {
  const prefix = promoRefPrefix(state);
  const isIndependiente = state.subVarias === "independiente";
  /* Si el user definió "Parcela desde X m²" en V5, usamos ese mínimo
   * como default · si no, fallback razonable. */
  const parcelDefault = state.promotionDefaults?.plot?.minSizeSqm
    ?? (isIndependiente ? 400 : 0);
  /* Defaults de V5 (extras-v5) · prioritarios sobre los flags legacy
   * `piscinaPrivadaPorDefecto`/`parkings`/`trasteros` que ya no se
   * configuran (el user los configura en V5). */
  const promoHasPool = state.promotionDefaults?.privatePool?.enabled
    ?? state.piscinaPrivadaPorDefecto;
  const promoHasParking = (state.promotionDefaults?.parking?.enabled ?? false)
    || state.parkings > 0;
  const promoHasStorage = (state.promotionDefaults?.storageRoom?.enabled ?? false)
    || state.trasteros > 0;
  return [
    baseUnit({
      id: "unit-1",
      ref: `${prefix}-0001`,
      nombre: isIndependiente ? "Villa 1" : "V1",
      tipologiaUnifamiliar: state.subVarias ?? undefined,
      /* Sin precio/dormitorios/m² hardcoded · el user rellena. Los
       * únicos defaults que sí mantenemos son los que vienen de pasos
       * previos del wizard (parcela del V5, parking/trastero/piscina
       * del extras, vistas/caracteristicas del info-básica). */
      parcela: parcelDefault,
      piscinaPrivada: promoHasPool && isIndependiente,
      parking: promoHasParking,
      trastero: promoHasStorage,
      vistas: state.caracteristicasVivienda?.includes("vistas_mar") ? (["mar"] as TipoVista[]) : [],
      caracteristicas: [...(state.caracteristicasVivienda || [])],
    }),
  ];
}

function generateMultipleUnifamiliar(state: WizardState): UnitData[] {
  const units: UnitData[] = [];
  const prefix = promoRefPrefix(state);
  let counter = 0;
  const countersByTipo: Record<string, number> = {};
  /* "Parcela desde X m²" del V5 (si el user lo configuró) · default
   * compartido para todas las tipologías · si no se definió, cae a
   * heurística por tipo. */
  const minPlot = state.promotionDefaults?.plot?.minSizeSqm;
  /* Defaults de V5 · prioritarios sobre los flags legacy. */
  const promoHasPool = state.promotionDefaults?.privatePool?.enabled
    ?? state.piscinaPrivadaPorDefecto;
  const promoHasParking = (state.promotionDefaults?.parking?.enabled ?? false)
    || state.parkings > 0;
  const promoHasStorage = (state.promotionDefaults?.storageRoom?.enabled ?? false)
    || state.trasteros > 0;
  for (const tipologia of state.tipologiasSeleccionadas) {
    const isIndependiente = tipologia.tipo === "independiente";
    for (let i = 0; i < tipologia.cantidad; i++) {
      const idx = countersByTipo[tipologia.tipo] ?? 0;
      countersByTipo[tipologia.tipo] = idx + 1;
      units.push(
        baseUnit({
          id: `unit-${counter + 1}`,
          ref: `${prefix}-${String(counter + 1).padStart(4, "0")}`,
          nombre: unifamiliarLabelFor(idx, tipologia.tipo),
          tipologiaUnifamiliar: tipologia.tipo,
          /* Sin defaults inventados · solo lo configurado en pasos previos. */
          parcela: minPlot ?? (isIndependiente ? 400 : (tipologia.tipo === "pareados" ? 250 : 150)),
          piscinaPrivada: promoHasPool && isIndependiente,
          orientacion: orientaciones[counter % orientaciones.length],
          parking: promoHasParking,
          trastero: promoHasStorage,
          vistas: state.caracteristicasVivienda?.includes("vistas_mar") ? (["mar"] as TipoVista[]) : [],
          caracteristicas: [...(state.caracteristicasVivienda || [])],
        }),
      );
      counter++;
    }
  }
  if (units.length === 0) return generateSingleUnit(state);
  return units;
}

function defaultsForSubtipo(subtipo: SubtipoUnidad): Partial<UnitData> {
  /* Solo dejamos `parcela` para `planta_baja` (los bajos suelen tener
   * jardín · es info estructural, no inventada). El resto de campos
   * los rellena el user · sin precios/dormitorios/m² hardcoded. */
  if (subtipo === "planta_baja") return { parcela: 30 };
  return {};
}

/* ═══════════ Adapters UnitData ↔ Unit ═══════════ */
const subtipoToType: Record<SubtipoUnidad, string> = {
  apartamento: "Apartamento",
  loft: "Loft",
  penthouse: "Ático",
  duplex: "Dúplex",
  triplex: "Tríplex",
  planta_baja: "Estudio",
};
/* Etiquetas para promociones unifamiliares · usadas en la columna
 * "Tipo" del catálogo cuando la unidad es una villa (no aplica el
 * subtipo plurifamiliar). */
const tipologiaUnifamiliarToType: Record<SubVarias, string> = {
  independiente: "Independiente",
  pareados: "Pareada",
  adosados: "Adosada",
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
// `door` se mantiene solo para el tipo Unit legacy (se deriva, no se edita).
function extractDoor(nombre: string): string {
  const m = nombre.match(/([A-Z])$/);
  return m?.[1] ?? "";
}

function unitDataToUnit(u: UnitData): Unit {
  // Normaliza campos nuevos que pueden faltar en drafts antiguos del
  // localStorage (migrados al vuelo — evita crashes en statusConfig,
  // precio sin unidades, etc.).
  return {
    id: u.id,
    ref: u.ref || u.idInterna || u.id,
    promotionId: WIZARD_PROMO_ID,
    block: extractBlock(u.nombre),
    floor: u.planta ?? 0,
    door: extractDoor(u.nombre),
    publicId: u.nombre,
    /* Prioridad · si es unifamiliar (tiene `tipologiaUnifamiliar`),
     * usamos su etiqueta. Si es plurifamiliar/mixto, derivamos del
     * subtipo. Sin nada → "Sin tipo" para que no mienta con
     * "Apartamento" por defecto. */
    type: u.tipologiaUnifamiliar
      ? tipologiaUnifamiliarToType[u.tipologiaUnifamiliar]
      : (u.subtipo ? subtipoToType[u.subtipo] : "Sin tipo"),
    bedrooms: u.dormitorios ?? 0,
    bathrooms: u.banos ?? 0,
    builtArea: u.superficieConstruida ?? 0,
    usableArea: u.superficieUtil ?? 0,
    terrace: u.superficieTerraza ?? 0,
    garden: 0,
    parcel: u.parcela ?? 0,
    hasPool: u.piscinaPrivada ?? false,
    hasParking: u.parking ?? false,
    hasStorage: u.trastero ?? false,
    hasSolarium: u.solarium ?? false,
    hasBasement: u.sotano ?? false,
    /* REGLA · NO defaultear a "Sur" cuando el user no marcó
     * orientación · vacío significa "no definida" · evita pintar
     * "Sur" en el listado/ficha como si lo hubiera elegido. */
    orientation: u.orientacion ?? "",
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

function mergeUnitIntoUnitData(existing: UnitData, unit: Unit): UnitData {
  return {
    ...existing,
    dormitorios: unit.bedrooms,
    banos: unit.bathrooms,
    superficieConstruida: unit.builtArea,
    superficieUtil: unit.usableArea,
    superficieTerraza: unit.terrace,
    parcela: unit.parcel,
    piscinaPrivada: unit.hasPool,
    parking: unit.hasParking,
    trastero: unit.hasStorage,
    solarium: unit.hasSolarium,
    sotano: unit.hasBasement,
    planta: unit.floor,
    orientacion: unit.orientation,
    precio: unit.price,
    status: unit.status,
    subtipo: typeToSubtipo[unit.type] ?? existing.subtipo,
    ref: unit.ref,
    idInterna: unit.ref, // mantenemos alias por ahora
    nombre: unit.publicId || existing.nombre,
    clientName: unit.clientName,
    agencyName: unit.agencyName,
    reservedAt: unit.reservedAt,
    soldAt: unit.soldAt,
  };
}

/* ═══════════ Summary de características ═══════════ */
function CharacteristicsSummary({ state }: { state: WizardState }) {
  const [expanded, setExpanded] = useState(false);
  const selected = caracteristicasViviendaOptions.filter((c) =>
    state.caracteristicasVivienda.includes(c.value),
  );
  const zonas = state.urbanizacion
    ? zonasComOptions.filter((z) => state.zonasComunes.includes(z.value))
    : [];
  const all = [...selected, ...zonas];
  if (all.length === 0) return null;
  const preview = all.slice(0, 4);
  const remaining = all.length - preview.length;

  return (
    <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Características seleccionadas
        </p>
        {all.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-primary font-medium hover:underline"
          >
            {expanded ? "Ver menos" : `Ver más (+${remaining})`}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {(expanded ? all : preview).map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-[10px] font-medium text-primary"
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ Step principal ═══════════ */
export function CrearUnidadesStep({
  state,
  update,
  uploadScopeId,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  uploadScopeId?: string;
}) {
  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";
  const isEdificio = state.tipo === "plurifamiliar" || state.tipo === "mixto";
  const isMultipleUnifamiliar = state.tipo === "unifamiliar" && state.subUni === "varias";

  const [addOpen, setAddOpen] = useState(false);
  const [addAnejosOpen, setAddAnejosOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  /* Modal ligero solo-fotos · disparado al click del thumbnail. */
  const [editPhotosUnitId, setEditPhotosUnitId] = useState<string | null>(null);

  // Auto-generar al entrar si aún no hay unidades + migrar drafts
  // antiguos que no tengan los campos nuevos (ref, parcela, status,
  // piscinaPrivada). Evita crashes al renderizar la tabla.
  useEffect(() => {
    if (state.unidades.length === 0) {
      if (isSingleHome) update("unidades", generateSingleUnit(state));
      else if (isMultipleUnifamiliar) update("unidades", generateMultipleUnifamiliar(state));
      else if (isEdificio) update("unidades", generateEdificio(state));
      return;
    }
    // Chequeo de migración: si alguna unidad no tiene los campos nuevos
    // obligatorios, los rellenamos con los defaults. También migramos
    // `tipologiaUnifamiliar` (campo nuevo · ver adapter unitDataToUnit)
    // en drafts unifamiliar pre-existentes que no lo tenían y mostraban
    // "Sin tipo" / "Apartamento" en la columna Tipo.
    const isUnifamiliar = state.tipo === "unifamiliar";
    const needsTipologiaMigration = isUnifamiliar
      && state.unidades.some((u) => !u.tipologiaUnifamiliar);
    const needsMigration = needsTipologiaMigration || state.unidades.some(
      (u) => !u.ref || u.parcela === undefined || u.piscinaPrivada === undefined || !u.status,
    );
    if (needsMigration) {
      const prefix = promoRefPrefix(state);
      /* Para multifamiliar villas, mapeamos por orden las tipologías
       * seleccionadas a las unidades existentes (idéntico orden de
       * generación) · para single villa todas reciben state.subVarias. */
      const tipologiasOrdered: SubVarias[] = [];
      if (isMultipleUnifamiliar) {
        for (const t of state.tipologiasSeleccionadas) {
          for (let i = 0; i < t.cantidad; i++) tipologiasOrdered.push(t.tipo);
        }
      }
      const minPlot = state.promotionDefaults?.plot?.minSizeSqm;
      const v5HasPool = state.promotionDefaults?.privatePool?.enabled ?? false;
      update(
        "unidades",
        state.unidades.map((u, i) => ({
          ...u,
          ref: u.ref || u.idInterna || `${prefix}-${String(i + 1).padStart(4, "0")}`,
          /* Si el user puso "Parcela desde X" en V5 y la unidad
           * estaba en 0 (sin asignar), aplicamos el valor por defecto. */
          parcela: u.parcela && u.parcela > 0 ? u.parcela : (minPlot ?? 0),
          /* Si V5 dice que hay piscina privada y es independiente,
           * propagamos · si la unidad ya tenía piscina, mantener. */
          piscinaPrivada: u.piscinaPrivada
            || (v5HasPool && (u.tipologiaUnifamiliar === "independiente" || state.subVarias === "independiente")),
          status: u.status ?? "available",
          tipologiaUnifamiliar: u.tipologiaUnifamiliar
            ?? (isSingleHome ? (state.subVarias ?? undefined) : undefined)
            ?? (isMultipleUnifamiliar ? tipologiasOrdered[i] : undefined),
          /* Si pasamos de plurifamiliar a unifamiliar (draft con
           * subtipos viejos como "penthouse"/"apartamento") · limpiamos
           * el subtipo · no aplica a villas y rompe el adapter
           * unitDataToUnit cuando tipologiaUnifamiliar también está
           * vacío (cae al subtipoToType y muestra "Ático"). */
          subtipo: isUnifamiliar ? null : u.subtipo,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Derivar Unit[] desde UnitData[] para la vista ─── */
  const unitsForView = useMemo(
    () => state.unidades.map(unitDataToUnit),
    [state.unidades],
  );

  /* ─── Al cambiar Unit[] desde la vista, merge con UnitData existente ─── */
  const handleUnitsChange = (nextUnits: Unit[]) => {
    const byId = new Map(nextUnits.map((u) => [u.id, u]));
    const nextData = state.unidades
      .filter((u) => byId.has(u.id))
      .map((u) => mergeUnitIntoUnitData(u, byId.get(u.id)!));
    update("unidades", nextData);
  };

  /* ─── Popup "Añadir más unidades" ─── */
  const addMoreForUnifamiliar = (deltas: Record<SubVarias, number>) => {
    const now = Date.now();
    let offset = state.unidades.length;
    const existingByTipo: Record<string, number> = {};
    state.unidades.forEach((u) => {
      if (u.nombre.startsWith("Villa")) existingByTipo["independiente"] = (existingByTipo["independiente"] ?? 0) + 1;
      else if (u.nombre.startsWith("Adosado")) existingByTipo["adosados"] = (existingByTipo["adosados"] ?? 0) + 1;
      else if (u.nombre.startsWith("Pareado")) existingByTipo["pareados"] = (existingByTipo["pareados"] ?? 0) + 1;
      else if (u.nombre.startsWith("V")) existingByTipo["independiente"] = (existingByTipo["independiente"] ?? 0) + 1;
    });

    /* Defaults heredados de los pasos previos del wizard ·
     * tipología viene del paso sub_varias, parcela del V5,
     * piscina/parking/trastero de extras-V5 (boolean por unidad). */
    const minPlot = state.promotionDefaults?.plot?.minSizeSqm;
    const promoHasPool = state.promotionDefaults?.privatePool?.enabled ?? false;
    const promoHasParking = (state.promotionDefaults?.parking?.enabled ?? false) || state.parkings > 0;
    const promoHasStorage = (state.promotionDefaults?.storageRoom?.enabled ?? false) || state.trasteros > 0;
    const newUnits: UnitData[] = [];
    (Object.entries(deltas) as [SubVarias, number][]).forEach(([tipo, delta]) => {
      const startIdx = existingByTipo[tipo] ?? 0;
      const isIndependiente = tipo === "independiente";
      for (let i = 0; i < delta; i++) {
        newUnits.push(
          baseUnit({
            id: `unit-${now}-${offset}`,
            nombre: unifamiliarLabelFor(startIdx + i, tipo),
            /* CRÍTICO · sin esto la unidad sale como "Sin tipo" /
             * "Apartamento" porque unitDataToUnit cae en el default. */
            tipologiaUnifamiliar: tipo,
            /* Sin defaults inventados de precio/dormitorios/m² · el
             * user los rellena en la tabla. Solo dejamos los que vienen
             * configurados en pasos previos. */
            parcela: minPlot ?? (isIndependiente ? 400 : (tipo === "pareados" ? 250 : 150)),
            piscinaPrivada: promoHasPool && isIndependiente,
            parking: promoHasParking,
            trastero: promoHasStorage,
            orientacion: orientaciones[offset % orientaciones.length],
            vistas: state.caracteristicasVivienda?.includes("vistas_mar") ? (["mar"] as TipoVista[]) : [],
            caracteristicas: [...(state.caracteristicasVivienda || [])],
          }),
        );
        offset++;
      }
    });

    const nextTipologias = [...state.tipologiasSeleccionadas];
    (Object.entries(deltas) as [SubVarias, number][]).forEach(([tipo, delta]) => {
      if (delta <= 0) return;
      const idx = nextTipologias.findIndex((t) => t.tipo === tipo);
      if (idx >= 0) nextTipologias[idx] = { ...nextTipologias[idx], cantidad: nextTipologias[idx].cantidad + delta };
      else nextTipologias.push({ tipo, cantidad: delta });
    });
    update("tipologiasSeleccionadas", nextTipologias);
    update("unidades", [...state.unidades, ...newUnits]);
    setAddOpen(false);
  };

  const addMoreForEdificio = (deltas: Record<SubtipoUnidad, number>) => {
    const now = Date.now();
    let offset = state.unidades.length;
    /* Defaults heredados de los pasos previos · igual que en
     * generateEdificio para que las unidades añadidas no sean
     * inconsistentes con las generadas iniciales. */
    const promoHasParking = (state.promotionDefaults?.parking?.enabled ?? false) || state.parkings > 0;
    const promoHasStorage = (state.promotionDefaults?.storageRoom?.enabled ?? false) || state.trasteros > 0;
    const newUnits: UnitData[] = [];
    (Object.entries(deltas) as [SubtipoUnidad, number][]).forEach(([subtipo, delta]) => {
      const label = subtipoUnidadOptions.find((o) => o.value === subtipo)?.label ?? "Unidad";
      const defaults = defaultsForSubtipo(subtipo);
      for (let i = 0; i < delta; i++) {
        newUnits.push(
          baseUnit({
            id: `unit-${now}-${offset}`,
            nombre: `${label} ${offset + 1}`,
            subtipo,
            orientacion: orientaciones[offset % orientaciones.length],
            parking: promoHasParking,
            trastero: promoHasStorage,
            vistas: state.caracteristicasVivienda?.includes("vistas_mar") ? (["mar"] as TipoVista[]) : [],
            caracteristicas: [...(state.caracteristicasVivienda || [])],
            ...defaults,
          }),
        );
        offset++;
      }
    });
    update("unidades", [...state.unidades, ...newUnits]);
    setAddOpen(false);
  };

  /* ─── Anejos sueltos ─── */
  const totalViviendas = state.unidades.length;
  const trasterosAdicionales = useMemo(() => {
    if (!state.trasterosIncluidosPrecio) return state.trasteros;
    return Math.max(0, state.trasteros - totalViviendas * state.trasterosIncluidosPorVivienda);
  }, [state.trasteros, state.trasterosIncluidosPrecio, state.trasterosIncluidosPorVivienda, totalViviendas]);
  const parkingsAdicionales = useMemo(() => {
    if (!state.parkingsIncluidosPrecio) return state.parkings;
    return Math.max(0, state.parkings - totalViviendas * state.parkingsIncluidosPorVivienda);
  }, [state.parkings, state.parkingsIncluidosPrecio, state.parkingsIncluidosPorVivienda, totalViviendas]);

  useEffect(() => {
    const cur = state.trasteroPrecios;
    if (cur.length === trasterosAdicionales) return;
    const next = [...cur];
    while (next.length < trasterosAdicionales) next.push(state.trasteroPrecio);
    while (next.length > trasterosAdicionales) next.pop();
    update("trasteroPrecios", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trasterosAdicionales]);
  useEffect(() => {
    const cur = state.parkingPrecios;
    if (cur.length === parkingsAdicionales) return;
    const next = [...cur];
    while (next.length < parkingsAdicionales) next.push(state.parkingPrecio);
    while (next.length > parkingsAdicionales) next.pop();
    update("parkingPrecios", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkingsAdicionales]);
  /* Sync precios para solárium y sótano · mismo patrón. Defensivo
   * contra drafts legacy sin estos campos · si falta el array,
   * usamos []. */
  useEffect(() => {
    const cur = state.solariumPrecios ?? [];
    const target = state.solariums ?? 0;
    if (cur.length === target) return;
    const next = [...cur];
    while (next.length < target) next.push(state.solariumPrecio ?? 0);
    while (next.length > target) next.pop();
    update("solariumPrecios", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.solariums]);
  useEffect(() => {
    const cur = state.sotanoPrecios ?? [];
    const target = state.sotanos ?? 0;
    if (cur.length === target) return;
    const next = [...cur];
    while (next.length < target) next.push(state.sotanoPrecio ?? 0);
    while (next.length > target) next.pop();
    update("sotanoPrecios", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sotanos]);

  const setTrasteroPrecio = (idx: number, v: number) => {
    const next = [...state.trasteroPrecios];
    next[idx] = v;
    update("trasteroPrecios", next);
  };
  const setParkingPrecio = (idx: number, v: number) => {
    const next = [...state.parkingPrecios];
    next[idx] = v;
    update("parkingPrecios", next);
  };
  const addMoreAnejos = (deltas: { parking: number; trastero: number; solarium: number; sotano: number }) => {
    /* `state.trasteros` / `state.parkings` representan TOTAL · sueltos
     * = total - bundled. Si total < bundled (caso V5 que no auto-rellena
     * el campo legacy), un simple `+= delta` se queda absorbido por el
     * bundled y no aparece en la lista de sueltos. Llevamos primero al
     * floor del bundled para que el delta vaya íntegro a los sueltos. */
    if (deltas.trastero > 0) {
      const bundled = state.trasterosIncluidosPrecio
        ? totalViviendas * state.trasterosIncluidosPorVivienda
        : 0;
      const floor = Math.max(state.trasteros, bundled);
      update("trasteros", floor + deltas.trastero);
    }
    if (deltas.parking > 0) {
      const bundled = state.parkingsIncluidosPrecio
        ? totalViviendas * state.parkingsIncluidosPorVivienda
        : 0;
      const floor = Math.max(state.parkings, bundled);
      update("parkings", floor + deltas.parking);
    }
    if (deltas.solarium > 0) update("solariums", (state.solariums ?? 0) + deltas.solarium);
    if (deltas.sotano > 0) update("sotanos", (state.sotanos ?? 0) + deltas.sotano);
    setAddAnejosOpen(false);
  };

  const removeTrastero = (idx: number) => {
    // Descuenta solo del pool de adicionales (no toca los ligados a vivienda).
    update("trasteros", Math.max(0, state.trasteros - 1));
    const next = [...state.trasteroPrecios];
    next.splice(idx, 1);
    update("trasteroPrecios", next);
    const nextA = [...(state.trasteroAsignaciones ?? [])];
    nextA.splice(idx, 1);
    update("trasteroAsignaciones", nextA);
  };
  const removeParking = (idx: number) => {
    update("parkings", Math.max(0, state.parkings - 1));
    const next = [...state.parkingPrecios];
    next.splice(idx, 1);
    update("parkingPrecios", next);
    const nextA = [...(state.parkingAsignaciones ?? [])];
    nextA.splice(idx, 1);
    update("parkingAsignaciones", nextA);
  };
  /* Setters de asignación · array paralelo a precios. */
  const makeSetAsignacion = (key: "trasteroAsignaciones" | "parkingAsignaciones" | "solariumAsignaciones" | "sotanoAsignaciones") =>
    (idx: number, unitId: string) => {
      const cur = (state[key] ?? []) as string[];
      const next = [...cur];
      while (next.length <= idx) next.push("");
      next[idx] = unitId;
      update(key, next);
    };
  const setTrasteroAsignacion = makeSetAsignacion("trasteroAsignaciones");
  const setParkingAsignacion = makeSetAsignacion("parkingAsignaciones");
  const setSolariumAsignacion = makeSetAsignacion("solariumAsignaciones");
  const setSotanoAsignacion = makeSetAsignacion("sotanoAsignaciones");

  /* Lista de unidades disponibles para asignar (id + label). */
  const unitsForSelect = useMemo(
    () => state.unidades.map((u) => ({ id: u.id, label: u.nombre || u.ref || u.id })),
    [state.unidades],
  );

  const setSolariumPrecio = (idx: number, v: number) => {
    const next = [...(state.solariumPrecios ?? [])];
    next[idx] = v;
    update("solariumPrecios", next);
  };
  const removeSolarium = (idx: number) => {
    update("solariums", Math.max(0, (state.solariums ?? 0) - 1));
    const next = [...(state.solariumPrecios ?? [])];
    next.splice(idx, 1);
    update("solariumPrecios", next);
    const nextA = [...(state.solariumAsignaciones ?? [])];
    nextA.splice(idx, 1);
    update("solariumAsignaciones", nextA);
  };
  const setSotanoPrecio = (idx: number, v: number) => {
    const next = [...(state.sotanoPrecios ?? [])];
    next[idx] = v;
    update("sotanoPrecios", next);
  };
  const removeSotano = (idx: number) => {
    update("sotanos", Math.max(0, (state.sotanos ?? 0) - 1));
    const next = [...(state.sotanoPrecios ?? [])];
    next.splice(idx, 1);
    update("sotanoPrecios", next);
    const nextA = [...(state.sotanoAsignaciones ?? [])];
    nextA.splice(idx, 1);
    update("sotanoAsignaciones", nextA);
  };

  /* Cantidades actuales por tipo, para prefillar el popup. */
  const currentByUnifamiliar = useMemo(() => {
    const map: Record<SubVarias, number> = { independiente: 0, adosados: 0, pareados: 0 };
    state.tipologiasSeleccionadas.forEach((t) => {
      map[t.tipo] = (map[t.tipo] ?? 0) + t.cantidad;
    });
    return map;
  }, [state.tipologiasSeleccionadas]);

  const currentBySubtipo = useMemo(() => {
    const map: Record<string, number> = {};
    state.unidades.forEach((u) => {
      if (u.subtipo) map[u.subtipo] = (map[u.subtipo] ?? 0) + 1;
    });
    return map as Record<SubtipoUnidad, number>;
  }, [state.unidades]);

  return (
    <div className="flex flex-col gap-4">
      {/* ═════ Barra superior ═════ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {totalViviendas} unidad{totalViviendas === 1 ? "" : "es"}
        </p>
        <button
          type="button"
          onClick={() => {
            // Si empezó como "una sola vivienda", lo convertimos a
            // "varias viviendas" transparentemente al querer añadir
            // más. Sembramos la tipología actual (si existe) en
            // tipologiasSeleccionadas para no perder la cuenta.
            if (isSingleHome) {
              const seedTipo = state.subVarias ?? "independiente";
              const seed = state.tipologiasSeleccionadas.length > 0
                ? state.tipologiasSeleccionadas
                : [{ tipo: seedTipo, cantidad: state.unidades.length || 1 }];
              update("subUni", "varias");
              update("tipologiasSeleccionadas", seed);
            }
            setAddOpen(true);
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Añadir más unidades
        </button>
      </div>


      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 flex items-start gap-2 text-xs text-foreground leading-relaxed">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <p className="font-medium text-foreground">¿Imágenes y descripción iguales para todas las unidades?</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Selecciona varias con el checkbox y usa <span className="font-medium text-foreground">Edición masiva</span> para cambiar los campos necesarios en todas a la vez.
          </p>
        </div>
      </div>

      {/* ═════ Disponibilidad (componente compartido con la ficha) ═════ */}
      <PromotionAvailabilityFull
        promotionId={WIZARD_PROMO_ID}
        units={unitsForView}
        onUnitsChange={handleUnitsChange}
        onEditUnit={(id) => setEditUnitId(id)}
        onEditUnitPhotos={(id) => setEditPhotosUnitId(id)}
        onReorderUnits={(orderedIds) => {
          /* Reordena `state.unidades` siguiendo el array de ids que
           * llega del drag handle · ids no presentes (no debería pasar
           * pero por defensiva) se mantienen al final. */
          const byId = new Map(state.unidades.map((u) => [u.id, u]));
          const reordered = orderedIds
            .map((id) => byId.get(id))
            .filter((u): u is typeof state.unidades[0] => !!u);
          const missing = state.unidades.filter((u) => !orderedIds.includes(u.id));
          update("unidades", [...reordered, ...missing]);
        }}
        hideExternalActions
        defaultBulkEditAll
        onUploadFile={async (unitId, kind, file) => {
          if (!uploadScopeId) {
            toast.error("Guarda el borrador antes de subir archivos");
            return;
          }
          try {
            if (uploadScopeId.startsWith("d-")) {
              const ensured = await ensureDraftPersisted(uploadScopeId);
              if (!ensured.ok) throw new Error(ensured.error ?? "No se pudo preparar el borrador");
            }
            const url = await uploadPromotionImage(uploadScopeId, file, "unit");
            const next = state.unidades.map((x) => {
              if (x.id !== unitId) return x;
              if (kind === "plano") return { ...x, planoUrls: [...(x.planoUrls ?? []), url] };
              if (kind === "memoria") return { ...x, memoriaUrls: [...(x.memoriaUrls ?? []), url] };
              return { ...x, brochureUrls: [...(x.brochureUrls ?? []), url] };
            });
            update("unidades", next);
            const labels = { plano: "Plano", memoria: "Memoria de calidades", brochure: "Brochure" };
            toast.success(`${labels[kind]} subido`);
          } catch (e) {
            toast.error("Error al subir archivo", {
              description: e instanceof Error ? e.message : "Inténtalo de nuevo",
            });
          }
        }}
        getUnitPhoto={(u) => {
          /* Foto propia de la unidad (subida desde su modal de edición)
           * tiene prioridad · si no, cae al fallback de fotos heredadas
           * de la promoción que se resuelve en el componente. */
          const data = state.unidades.find((x) => x.id === u.id);
          const own = (data?.fotosUnidad ?? []).find((f) => !f.id.startsWith("disabled-"));
          return own?.url;
        }}
        promotionCtx={{
          ciudad: state.direccionPromocion.ciudad,
          provincia: state.direccionPromocion.provincia,
          pais: state.direccionPromocion.pais,
          nombrePromocion: state.nombrePromocion,
          deliveryYear: state.fechaEntrega ?? state.trimestreEntrega ?? undefined,
          energyCert: state.certificadoEnergetico,
          descripcion: state.descripcion,
          caracteristicas: state.caracteristicasVivienda,
          hitosPago: state.hitosPago,
          importeReserva: state.importeReserva,
          amenities: {
            piscinaComunitaria: state.piscinaComunitaria,
            piscinaInterna: state.piscinaInterna,
            zonaSpa: state.zonaSpa,
            zonaInfantil: state.zonaInfantil,
            urbanizacionCerrada: state.urbanizacionCerrada,
          },
          fotos: state.fotos.map((f) => f.url),
        }}
      />

      {/* ═════ Anejos sueltos ═════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Anejos sueltos
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              Plazas y trasteros que se venden por separado, con su propio precio
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddAnejosOpen(true)}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Añadir anejos
          </button>
        </div>

        {parkingsAdicionales === 0 && trasterosAdicionales === 0 && (state.solariums ?? 0) === 0 && (state.sotanos ?? 0) === 0 ? (
          <button
            type="button"
            onClick={() => setAddAnejosOpen(true)}
            className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 flex flex-col items-center gap-2 text-center hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <div className="flex gap-1.5">
              <Car className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
              <Archive className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">No hay anejos sueltos todavía</p>
            <p className="text-[10px] text-muted-foreground/70">Añade plazas de parking o trasteros con precio propio</p>
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            {parkingsAdicionales > 0 && (
              <AnejoList
                icon={Car}
                title="Plazas de parking sueltas"
                subtitle="No incluidas en el precio de la vivienda"
                idPrefix="P"
                count={parkingsAdicionales}
                prices={state.parkingPrecios}
                defaultPrice={state.parkingPrecio}
                assignments={state.parkingAsignaciones ?? []}
                units={unitsForSelect}
                onChangePrice={setParkingPrecio}
                onChangeAssignment={setParkingAsignacion}
                onRemove={removeParking}
              />
            )}
            {trasterosAdicionales > 0 && (
              <AnejoList
                icon={Archive}
                title="Trasteros sueltos"
                subtitle="No incluidos en el precio de la vivienda"
                idPrefix="T"
                count={trasterosAdicionales}
                prices={state.trasteroPrecios}
                defaultPrice={state.trasteroPrecio}
                assignments={state.trasteroAsignaciones ?? []}
                units={unitsForSelect}
                onChangePrice={setTrasteroPrecio}
                onChangeAssignment={setTrasteroAsignacion}
                onRemove={removeTrastero}
              />
            )}
            {(state.solariums ?? 0) > 0 && (
              <AnejoList
                icon={Sun}
                title="Solariums sueltos"
                subtitle="No incluidos en el precio de la vivienda"
                idPrefix="S"
                count={state.solariums ?? 0}
                prices={state.solariumPrecios ?? []}
                defaultPrice={state.solariumPrecio ?? 0}
                assignments={state.solariumAsignaciones ?? []}
                units={unitsForSelect}
                onChangePrice={setSolariumPrecio}
                onChangeAssignment={setSolariumAsignacion}
                onRemove={removeSolarium}
              />
            )}
            {(state.sotanos ?? 0) > 0 && (
              <AnejoList
                icon={Layers}
                title="Sótanos sueltos"
                subtitle="No incluidos en el precio de la vivienda"
                idPrefix="B"
                count={state.sotanos ?? 0}
                prices={state.sotanoPrecios ?? []}
                defaultPrice={state.sotanoPrecio ?? 0}
                assignments={state.sotanoAsignaciones ?? []}
                units={unitsForSelect}
                onChangePrice={setSotanoPrecio}
                onChangeAssignment={setSotanoAsignacion}
                onRemove={removeSotano}
              />
            )}
          </div>
        )}
      </div>

      {/* Popup Añadir más unidades · contextual */}
      {isMultipleUnifamiliar ? (
        <AddMoreUnifamiliarDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          current={currentByUnifamiliar}
          onConfirm={addMoreForUnifamiliar}
        />
      ) : (
        <AddMoreEdificioDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          current={currentBySubtipo}
          onConfirm={addMoreForEdificio}
        />
      )}

      {/* Popup Añadir anejos · solárium/sótano solo en unifamiliar */}
      <AddAnejosDialog
        open={addAnejosOpen}
        onOpenChange={setAddAnejosOpen}
        showUnifamiliarOnly={state.tipo === "unifamiliar"}
        current={{
          parking: parkingsAdicionales,
          trastero: trasterosAdicionales,
          solarium: state.solariums ?? 0,
          sotano: state.sotanos ?? 0,
        }}
        onConfirm={addMoreAnejos}
      />

      {/* Modal simple de edición de unidad (fotos, planos, características) */}
      <UnitSimpleEditDialog
        open={editUnitId !== null}
        onOpenChange={(v) => { if (!v) setEditUnitId(null); }}
        unit={editUnitId ? state.unidades.find((u) => u.id === editUnitId) ?? null : null}
        state={state}
        onUpdate={(patch) => {
          if (!editUnitId) return;
          update(
            "unidades",
            state.unidades.map((u) => (u.id === editUnitId ? { ...u, ...patch } : u)),
          );
        }}
      />

      {/* Modal ligero · solo fotos · disparado al click del thumbnail */}
      <UnitPhotosDialog
        open={editPhotosUnitId !== null}
        onOpenChange={(v) => { if (!v) setEditPhotosUnitId(null); }}
        unit={editPhotosUnitId ? state.unidades.find((u) => u.id === editPhotosUnitId) ?? null : null}
        state={state}
        uploadScopeId={uploadScopeId}
        onUpdate={(patch) => {
          if (!editPhotosUnitId) return;
          update(
            "unidades",
            state.unidades.map((u) => (u.id === editPhotosUnitId ? { ...u, ...patch } : u)),
          );
        }}
      />
    </div>
  );
}

/* ═══════════ Anejos sueltos: lista vertical con precio individual ═══════════ */
function AnejoList({
  icon: Icon, title, subtitle, idPrefix, count, prices, defaultPrice, assignments, units, onChangePrice, onChangeAssignment, onRemove,
}: {
  icon: typeof Archive;
  title: string;
  subtitle?: string;
  idPrefix: "T" | "P" | "S" | "B";
  count: number;
  prices: number[];
  defaultPrice: number;
  /** ID de la unidad asignada · "" / undefined = sin asignar. Mismo
   *  índice que `prices`. */
  assignments: string[];
  /** Lista de unidades disponibles para asignar (id + nombre/publicId). */
  units: { id: string; label: string }[];
  onChangePrice: (idx: number, v: number) => void;
  onChangeAssignment: (idx: number, unitId: string) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/80">{subtitle}</p>}
        </div>
        <span className="text-[10px] text-muted-foreground tnum">{count} unidades</span>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-col divide-y divide-border">
          {Array.from({ length: count }, (_, i) => {
            const id = `${idPrefix}${i + 1}`;
            const value = prices[i] ?? defaultPrice;
            const assignedTo = assignments[i] ?? "";
            return (
              <div key={id} className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold text-foreground tnum">{id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                  {/* Selector de unidad asignada */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Vivienda</span>
                    <select
                      value={assignedTo}
                      onChange={(e) => onChangeAssignment(i, e.target.value)}
                      className="h-8 rounded-lg border border-border bg-card text-xs px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-w-[120px]"
                    >
                      <option value="">Sin asignar</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Precio</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      /* Formato es-ES con miles · "100.000" en vez de
                       * "100000". Empty string cuando 0 · evita el bug
                       * de "20" al teclear "2" sobre "0". */
                      value={value > 0 ? value.toLocaleString("es-ES") : ""}
                      placeholder="0"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, "");
                        onChangePrice(i, digits === "" ? 0 : Number(digits));
                      }}
                      className="h-8 w-28 rounded-lg border border-border bg-card text-sm tnum px-2 text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <span className="text-xs text-muted-foreground ml-0.5">€</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Eliminar ${id}`}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ AddMore: unifamiliar ═══════════ */
function AddMoreUnifamiliarDialog({
  open, onOpenChange, current, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: Record<SubVarias, number>;
  onConfirm: (deltas: Record<SubVarias, number>) => void;
}) {
  const [values, setValues] = useState<Record<SubVarias, number>>(current);
  useEffect(() => { if (open) setValues(current); }, [open, current]);

  const total = subVariasOptions.reduce((s, o) => s + (values[o.value] ?? 0), 0);
  const totalDelta = subVariasOptions.reduce(
    (s, o) => s + Math.max(0, (values[o.value] ?? 0) - (current[o.value] ?? 0)),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg w-[calc(100vw-32px)] overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Añadir más unidades</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajusta la cantidad de cada tipología. Las ya creadas se mantienen.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {subVariasOptions.map((o) => {
            const curr = current[o.value] ?? 0;
            const val = values[o.value] ?? 0;
            const selected = val > 0;
            const Icon = o.icon;
            return (
              <div
                key={o.value}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card",
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.description}</p>
                </div>
                <InlineStepper
                  value={val}
                  min={curr}
                  onChange={(v) => setValues((p) => ({ ...p, [o.value]: v }))}
                />
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-1">
            Total: <span className="tnum font-semibold text-foreground">{total}</span> viviendas
            {totalDelta > 0 && <> · se añadirán <span className="tnum text-primary font-semibold">{totalDelta}</span></>}
          </p>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const deltas = subVariasOptions.reduce((acc, o) => {
                acc[o.value] = Math.max(0, (values[o.value] ?? 0) - (current[o.value] ?? 0));
                return acc;
              }, {} as Record<SubVarias, number>);
              onConfirm(deltas);
            }}
            disabled={totalDelta === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Añadir {totalDelta || ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════ AddMore: edificio / plurifamiliar ═══════════ */
function AddMoreEdificioDialog({
  open, onOpenChange, current, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: Record<SubtipoUnidad, number>;
  onConfirm: (deltas: Record<SubtipoUnidad, number>) => void;
}) {
  const [values, setValues] = useState<Record<SubtipoUnidad, number>>(() => ({ ...current }));
  useEffect(() => { if (open) setValues({ ...current }); }, [open, current]);

  const total = subtipoUnidadOptions.reduce((s, o) => s + (values[o.value] ?? 0), 0);
  const totalDelta = subtipoUnidadOptions.reduce(
    (s, o) => s + Math.max(0, (values[o.value] ?? 0) - (current[o.value] ?? 0)),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg w-[calc(100vw-32px)] overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Añadir más unidades</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Elige cuántas sumar por subtipo. Las ya creadas se mantienen.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {subtipoUnidadOptions.map((o) => {
            const curr = current[o.value] ?? 0;
            const val = values[o.value] ?? 0;
            const selected = val > 0;
            return (
              <div
                key={o.value}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                  {curr > 0 && (
                    <p className="text-[10px] text-muted-foreground">Ya existen {curr} · puedes añadir más</p>
                  )}
                </div>
                <InlineStepper
                  value={val}
                  min={curr}
                  onChange={(v) => setValues((p) => ({ ...p, [o.value]: v }))}
                />
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-1">
            Total: <span className="tnum font-semibold text-foreground">{total}</span> unidades
            {totalDelta > 0 && <> · se añadirán <span className="tnum text-primary font-semibold">{totalDelta}</span></>}
          </p>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const deltas = subtipoUnidadOptions.reduce((acc, o) => {
                acc[o.value] = Math.max(0, (values[o.value] ?? 0) - (current[o.value] ?? 0));
                return acc;
              }, {} as Record<SubtipoUnidad, number>);
              onConfirm(deltas);
            }}
            disabled={totalDelta === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Añadir {totalDelta || ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════ AddAnejos: elegir trastero / parking + cantidades ═══════════ */
type AnejoKey = "parking" | "trastero" | "solarium" | "sotano";

function AddAnejosDialog({
  open, onOpenChange, current, onConfirm, showUnifamiliarOnly,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: { parking: number; trastero: number; solarium: number; sotano: number };
  onConfirm: (deltas: { parking: number; trastero: number; solarium: number; sotano: number }) => void;
  showUnifamiliarOnly: boolean;
}) {
  const [values, setValues] = useState<typeof current>(current);
  useEffect(() => { if (open) setValues(current); }, [open, current.parking, current.trastero, current.solarium, current.sotano]); // eslint-disable-line react-hooks/exhaustive-deps

  const deltaP = Math.max(0, values.parking - current.parking);
  const deltaT = Math.max(0, values.trastero - current.trastero);
  const deltaS = Math.max(0, values.solarium - current.solarium);
  const deltaB = Math.max(0, values.sotano - current.sotano);
  const totalDelta = deltaP + deltaT + deltaS + deltaB;

  const options: {
    key: AnejoKey;
    icon: typeof Car;
    label: string;
    description: string;
  }[] = [
    { key: "parking",  icon: Car,     label: "Plaza de parking", description: "Plaza suelta con precio propio" },
    { key: "trastero", icon: Archive, label: "Trastero",         description: "Trastero suelto con precio propio" },
    ...(showUnifamiliarOnly ? [
      { key: "solarium" as AnejoKey, icon: Sun,    label: "Solárium", description: "Terraza superior accesible · precio propio" },
      { key: "sotano" as AnejoKey,   icon: Layers, label: "Sótano",   description: "Sótano de la villa · precio propio" },
    ] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg w-[calc(100vw-32px)] overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Añadir anejos</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Suma plazas de parking o trasteros. Cada uno tendrá su precio individual.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-2">
          {options.map((o) => {
            const curr = current[o.key];
            const val = values[o.key];
            const selected = val > 0;
            const Icon = o.icon;
            return (
              <div
                key={o.key}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card",
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {curr > 0 ? `${curr} ya añadid${curr === 1 ? "o" : "os"} · suma más` : o.description}
                  </p>
                </div>
                <InlineStepper
                  value={val}
                  min={curr}
                  onChange={(v) => setValues((p) => ({ ...p, [o.key]: v }))}
                />
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalDelta > 0
              ? <>Se añadirán <span className="tnum text-primary font-semibold">{totalDelta}</span> anejo{totalDelta > 1 ? "s" : ""}</>
              : "Aumenta las cantidades para añadir."}
          </p>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ parking: deltaP, trastero: deltaT, solarium: deltaS, sotano: deltaB })}
            disabled={totalDelta === 0}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Añadir {totalDelta || ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
