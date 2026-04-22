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
import { Info, Trash2, Plus, Archive, Car } from "lucide-react";
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
  return {
    id: "unit-x",
    ref: "",
    nombre: "",
    dormitorios: 2, banos: 2,
    superficieConstruida: 80, superficieUtil: 65, superficieTerraza: 12,
    parcela: 0,
    precio: 250000, planta: 0, orientacion: "Sur",
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
  return [
    baseUnit({
      id: "unit-1",
      ref: `${prefix}-0001`,
      nombre: isIndependiente ? "Villa 1" : "V1",
      dormitorios: 3, superficieConstruida: 150, superficieUtil: 120,
      superficieTerraza: 25, precio: 350000,
      parcela: isIndependiente ? 400 : 0,
      piscinaPrivada: isIndependiente && state.piscinaPrivadaPorDefecto,
      parking: state.parkings > 0, trastero: state.trasteros > 0,
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
          dormitorios: 3, superficieConstruida: 150, superficieUtil: 120,
          superficieTerraza: 25, precio: 350000,
          parcela: isIndependiente ? 400 : (tipologia.tipo === "pareados" ? 250 : 150),
          piscinaPrivada: isIndependiente && state.piscinaPrivadaPorDefecto,
          orientacion: orientaciones[counter % orientaciones.length],
          parking: state.parkings > 0, trastero: state.trasteros > 0,
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
  switch (subtipo) {
    case "penthouse":   return { dormitorios: 3, banos: 2, superficieConstruida: 140, superficieUtil: 110, superficieTerraza: 40, precio: 520000 };
    case "duplex":      return { dormitorios: 3, banos: 2, superficieConstruida: 130, superficieUtil: 105, superficieTerraza: 20, precio: 420000 };
    case "triplex":     return { dormitorios: 4, banos: 3, superficieConstruida: 180, superficieUtil: 145, superficieTerraza: 30, precio: 620000 };
    case "loft":        return { dormitorios: 1, banos: 1, superficieConstruida: 60,  superficieUtil: 52,  superficieTerraza: 0,  precio: 210000 };
    case "planta_baja": return { dormitorios: 2, banos: 2, superficieConstruida: 90,  superficieUtil: 75,  superficieTerraza: 10, precio: 290000 };
    case "apartamento":
    default:            return { dormitorios: 2, banos: 2, superficieConstruida: 80,  superficieUtil: 65,  superficieTerraza: 12, precio: 250000 };
  }
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
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";
  const isEdificio = state.tipo === "plurifamiliar" || state.tipo === "mixto";
  const isMultipleUnifamiliar = state.tipo === "unifamiliar" && state.subUni === "varias";

  const [addOpen, setAddOpen] = useState(false);
  const [addAnejosOpen, setAddAnejosOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);

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
    // obligatorios, los rellenamos con los defaults.
    const needsMigration = state.unidades.some(
      (u) => !u.ref || u.parcela === undefined || u.piscinaPrivada === undefined || !u.status,
    );
    if (needsMigration) {
      const prefix = promoRefPrefix(state);
      update(
        "unidades",
        state.unidades.map((u, i) => ({
          ...u,
          ref: u.ref || u.idInterna || `${prefix}-${String(i + 1).padStart(4, "0")}`,
          parcela: u.parcela ?? 0,
          piscinaPrivada: u.piscinaPrivada ?? false,
          status: u.status ?? "available",
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

    const newUnits: UnitData[] = [];
    (Object.entries(deltas) as [SubVarias, number][]).forEach(([tipo, delta]) => {
      const startIdx = existingByTipo[tipo] ?? 0;
      for (let i = 0; i < delta; i++) {
        newUnits.push(
          baseUnit({
            id: `unit-${now}-${offset}`,
            nombre: unifamiliarLabelFor(startIdx + i, tipo),
            dormitorios: 3, superficieConstruida: 150, superficieUtil: 120,
            superficieTerraza: 25, precio: 350000,
            orientacion: orientaciones[offset % orientaciones.length],
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
  const addMoreAnejos = (deltas: { parking: number; trastero: number }) => {
    if (deltas.parking > 0) update("parkings", state.parkings + deltas.parking);
    if (deltas.trastero > 0) update("trasteros", state.trasteros + deltas.trastero);
    setAddAnejosOpen(false);
  };

  const removeTrastero = (idx: number) => {
    // Descuenta solo del pool de adicionales (no toca los ligados a vivienda).
    update("trasteros", Math.max(0, state.trasteros - 1));
    const next = [...state.trasteroPrecios];
    next.splice(idx, 1);
    update("trasteroPrecios", next);
  };
  const removeParking = (idx: number) => {
    update("parkings", Math.max(0, state.parkings - 1));
    const next = [...state.parkingPrecios];
    next.splice(idx, 1);
    update("parkingPrecios", next);
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
        hideExternalActions
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

        {parkingsAdicionales === 0 && trasterosAdicionales === 0 ? (
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
                onChangePrice={setParkingPrecio}
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
                onChangePrice={setTrasteroPrecio}
                onRemove={removeTrastero}
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

      {/* Popup Añadir anejos */}
      <AddAnejosDialog
        open={addAnejosOpen}
        onOpenChange={setAddAnejosOpen}
        current={{ parking: parkingsAdicionales, trastero: trasterosAdicionales }}
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
    </div>
  );
}

/* ═══════════ Anejos sueltos: lista vertical con precio individual ═══════════ */
function AnejoList({
  icon: Icon, title, subtitle, idPrefix, count, prices, defaultPrice, onChangePrice, onRemove,
}: {
  icon: typeof Archive;
  title: string;
  subtitle?: string;
  idPrefix: "T" | "P";
  count: number;
  prices: number[];
  defaultPrice: number;
  onChangePrice: (idx: number, v: number) => void;
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
            return (
              <div key={id} className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-semibold text-foreground tnum">{id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Precio</span>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => onChangePrice(i, Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 w-28 rounded-lg border border-border bg-card text-sm tnum px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
function AddAnejosDialog({
  open, onOpenChange, current, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: { parking: number; trastero: number };
  onConfirm: (deltas: { parking: number; trastero: number }) => void;
}) {
  const [values, setValues] = useState<{ parking: number; trastero: number }>(current);
  useEffect(() => { if (open) setValues(current); }, [open, current.parking, current.trastero]); // eslint-disable-line react-hooks/exhaustive-deps

  const deltaP = Math.max(0, values.parking - current.parking);
  const deltaT = Math.max(0, values.trastero - current.trastero);
  const totalDelta = deltaP + deltaT;

  const options: {
    key: "parking" | "trastero";
    icon: typeof Car;
    label: string;
    description: string;
  }[] = [
    { key: "parking",  icon: Car,     label: "Plaza de parking", description: "Plaza suelta con precio propio" },
    { key: "trastero", icon: Archive, label: "Trastero",         description: "Trastero suelto con precio propio" },
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
            onClick={() => onConfirm({ parking: deltaP, trastero: deltaT })}
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
