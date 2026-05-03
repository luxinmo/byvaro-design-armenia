/**
 * Tipos internos del paso "Configuración del edificio v2".
 *
 * Modelo SIMPLIFICADO · `escaleras` y `bloques` son globales (todos
 * los bloques tienen las mismas escaleras). Internamente se mappean
 * al WizardState canónico que usa `numBloques: number` y
 * `escalerasPorBloque: number[]` (escribimos el mismo valor en cada
 * slot del array). Ver `mappers.ts`.
 */

import type { WizardState } from "../types";

export type SubStep = 0 | 1 | 2 | 3 | 4;
// 0=Plantas · 1=Viviendas · 2=Estructura · 3=Planta baja · 4=Resumen

export type EstructuraEdificio = "simple" | "multiple";
export type UsoPlantaBaja = "sin" | "locales" | "viviendas";

export interface ModeloSimple {
  plantas: number;       // 1..50
  viviendas: number;     // 1..20 (por planta, por escalera)
  escaleras: number;     // 1..6 (global)
  bloques: number;       // 1..4 (global)
  estructura: EstructuraEdificio;
  plantaBaja: UsoPlantaBaja;
}

export const LIMITES = {
  plantas: { min: 1, max: 50 },
  viviendas: { min: 1, max: 20 },
  escaleras: { min: 1, max: 6 },
  bloques: { min: 1, max: 4 },
} as const;

/** Adapta el WizardState canónico a `ModeloSimple` para que las
 *  preguntas trabajen con un shape limpio sin saber del array. */
export function wizardToSimple(s: WizardState): ModeloSimple {
  const escaleras = s.escalerasPorBloque[0] ?? 1;
  const estructura: EstructuraEdificio =
    s.numBloques > 1 || escaleras > 1 ? "multiple" : "simple";
  const plantaBaja: UsoPlantaBaja =
    s.plantaBajaTipo === "locales" ? "locales"
    : s.plantaBajaTipo === "viviendas" ? "viviendas"
    : "sin";
  return {
    plantas: s.plantas || 1,
    viviendas: s.aptosPorPlanta || 1,
    escaleras: Math.max(1, escaleras),
    bloques: Math.max(1, s.numBloques),
    estructura,
    plantaBaja,
  };
}

/** Patch parcial del WizardState a partir de cambios en el modelo
 *  simple. El caller usa `update(key, value)` para aplicar. */
export type WizardPatch = Partial<{
  plantas: number;
  aptosPorPlanta: number;
  numBloques: number;
  escalerasPorBloque: number[];
  plantaBajaTipo: WizardState["plantaBajaTipo"];
}>;

export function simpleToWizardPatch(m: Partial<ModeloSimple>, current: WizardState): WizardPatch {
  const patch: WizardPatch = {};
  if (m.plantas !== undefined) patch.plantas = m.plantas;
  if (m.viviendas !== undefined) patch.aptosPorPlanta = m.viviendas;
  if (m.bloques !== undefined) patch.numBloques = m.bloques;
  if (m.escaleras !== undefined || m.bloques !== undefined) {
    const escs = m.escaleras ?? current.escalerasPorBloque[0] ?? 1;
    const bls = m.bloques ?? current.numBloques;
    patch.escalerasPorBloque = Array.from({ length: bls }, () => escs);
  }
  if (m.estructura !== undefined) {
    if (m.estructura === "simple") {
      patch.numBloques = 1;
      patch.escalerasPorBloque = [1];
    }
  }
  if (m.plantaBaja !== undefined) {
    patch.plantaBajaTipo =
      m.plantaBaja === "sin" ? null
      : m.plantaBaja;
  }
  return patch;
}

/** Cálculo canónico del total de viviendas según el modelo. */
export function computeTotalViviendas(m: ModeloSimple): {
  groundUnits: number;
  upperUnits: number;
  total: number;
} {
  const upperUnits = m.plantas * m.viviendas * m.escaleras * m.bloques;
  const groundUnits = m.plantaBaja === "viviendas"
    ? m.viviendas * m.escaleras * m.bloques
    : 0;
  return { upperUnits, groundUnits, total: upperUnits + groundUnits };
}
