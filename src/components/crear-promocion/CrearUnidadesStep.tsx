/**
 * CrearUnidadesStep · Paso "Crear unidades" del wizard.
 *
 * Al montar (si unidades === []), genera automáticamente la lista
 * basándose en la configuración previa:
 *   - unifamiliar + una_sola  → 1 unidad
 *   - unifamiliar + varias    → una por cada tipología × cantidad
 *   - plurifamiliar / mixto   → bloques × escaleras × plantas × aptos
 *
 * Después el usuario puede hacer clic en cualquier unidad para editar
 * nombre, subtipo, orientación, superficies, dormitorios, baños,
 * precio, vistas, parking/trastero, características y multimedia
 * (modal aparte).
 *
 * Port adaptado de figgy-friend-forge/src/components/create-promotion/
 * StepCrearUnidades.tsx — sin shadcn, con tokens Byvaro.
 */

import { useEffect, useMemo, useState } from "react";
import { Pencil, Check, X, Info, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  caracteristicasViviendaOptions, zonasComOptions,
  subtipoUnidadOptions, tipoVistaOptions,
} from "./options";
import type {
  WizardState, UnitData, SubtipoUnidad, TipoVista, SubVarias,
} from "./types";
import { UnitMultimediaModal } from "./UnitMultimediaModal";

const inputBase =
  "rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";
const selectBase =
  "appearance-none rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%239ca3af%22><path%20d=%22M5.23%207.21a.75.75%200%200%201%201.06.02L10%2011.06l3.71-3.83a.75.75%200%201%201%201.08%201.04l-4.25%204.39a.75.75%200%200%201-1.08%200L5.21%208.27a.75.75%200%200%201%20.02-1.06z%22/></svg>')] bg-[length:14px_14px] bg-[right_6px_center] bg-no-repeat pr-7";

const orientaciones = ["Norte", "Sur", "Este", "Oeste", "NE", "NO", "SE", "SO"];

/* ═══════════ Generadores ═══════════ */
function unitLabel(planta: number, totalPlantas: number, letter: string, prefix: string, plantaBajaTipo: string | null): string {
  if (planta === 0 && plantaBajaTipo === "viviendas") return `${prefix}Bajo ${letter}`;
  if (planta === totalPlantas) return `${prefix}Ático ${letter}`;
  return `${prefix}${planta}º${letter}`;
}

function unifamiliarLabel(index: number, subVarias: SubVarias | null): string {
  if (subVarias === "independiente") return `Villa ${index + 1}`;
  return `V${index + 1}`;
}

function baseUnit(partial: Partial<UnitData>): UnitData {
  return {
    id: "unit-x",
    nombre: "",
    dormitorios: 2, banos: 2,
    superficieConstruida: 80, superficieUtil: 65, superficieTerraza: 12,
    precio: 250000, planta: 0, orientacion: "Sur",
    parking: false, trastero: false, vistas: [],
    fotosMode: null, planos: false, subtipo: null,
    idInterna: "",
    caracteristicas: [],
    usarFotosPromocion: true,
    fotosUnidad: [], videosUnidad: [],
    ...partial,
  };
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

  for (let b = 0; b < state.numBloques; b++) {
    const escaleras = state.escalerasPorBloque[b] || 1;
    for (let e = 0; e < escaleras; e++) {
      const bLabel = state.numBloques > 1 ? `B${b + 1}` : "";
      const eLabel = escaleras > 1 ? `E${e + 1}` : "";
      const parts = [bLabel, eLabel].filter(Boolean).join("-");
      const prefix = parts ? `${parts}-` : "";

      for (let p = startFloor; p <= floorEnd; p++) {
        for (let u = 1; u <= state.aptosPorPlanta; u++) {
          const letter = String.fromCharCode(64 + u);
          const subtipo: SubtipoUnidad =
            p === 0 && state.plantaBajaTipo === "viviendas" ? "planta_baja" :
              p === floorEnd ? "penthouse" : "apartamento";
          units.push(
            baseUnit({
              id: `unit-${counter}`,
              nombre: unitLabel(p, floorEnd, letter, prefix, state.plantaBajaTipo),
              planta: p,
              orientacion: orientaciones[(counter - 1) % orientaciones.length],
              parking: hasParking,
              trastero: hasTrastero,
              vistas: hasVistas ? (["mar"] as TipoVista[]) : [],
              subtipo,
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
  return [
    baseUnit({
      id: "unit-1",
      nombre: state.subVarias === "independiente" ? "Villa 1" : "V1",
      dormitorios: 3, superficieConstruida: 150, superficieUtil: 120,
      superficieTerraza: 25, precio: 350000,
      parking: state.parkings > 0, trastero: state.trasteros > 0,
      vistas: state.caracteristicasVivienda?.includes("vistas_mar") ? (["mar"] as TipoVista[]) : [],
      caracteristicas: [...(state.caracteristicasVivienda || [])],
    }),
  ];
}

function generateMultipleUnifamiliar(state: WizardState): UnitData[] {
  const units: UnitData[] = [];
  let counter = 0;
  for (const tipologia of state.tipologiasSeleccionadas) {
    for (let i = 0; i < tipologia.cantidad; i++) {
      units.push(
        baseUnit({
          id: `unit-${counter + 1}`,
          nombre: unifamiliarLabel(counter, tipologia.tipo),
          dormitorios: 3, superficieConstruida: 150, superficieUtil: 120,
          superficieTerraza: 25, precio: 350000,
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<UnitData | null>(null);
  const [multimediaUnitId, setMultimediaUnitId] = useState<string | null>(null);

  // Auto-generar al entrar si aún no hay unidades
  useEffect(() => {
    if (state.unidades.length > 0) return;
    if (isSingleHome) update("unidades", generateSingleUnit(state));
    else if (isMultipleUnifamiliar) update("unidades", generateMultipleUnifamiliar(state));
    else if (isEdificio) update("unidades", generateEdificio(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (u: UnitData) => { setEditingId(u.id); setEditData({ ...u }); };
  const saveEdit = () => {
    if (!editData) return;
    update("unidades", state.unidades.map((u) => (u.id === editData.id ? editData : u)));
    setEditingId(null);
    setEditData(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditData(null); };
  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  const plantaOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    if (state.plantaBajaTipo === "viviendas") opts.push({ value: 0, label: "Planta Baja" });
    const endFloor = state.plantaBajaTipo === "viviendas" ? state.plantas - 1 : state.plantas;
    for (let i = 1; i < endFloor; i++) opts.push({ value: i, label: `Planta ${i}` });
    opts.push({ value: endFloor, label: `Ático (P${endFloor})` });
    return opts;
  }, [state.plantas, state.plantaBajaTipo]);

  const toggleVista = (v: TipoVista) => {
    if (!editData) return;
    const cur = editData.vistas || [];
    setEditData({ ...editData, vistas: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const toggleCaracteristica = (v: string) => {
    if (!editData) return;
    const cur = editData.caracteristicas || [];
    setEditData({ ...editData, caracteristicas: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const multimediaUnit = multimediaUnitId ? state.unidades.find((u) => u.id === multimediaUnitId) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isSingleHome ? "Configura los datos de tu vivienda" : `${state.unidades.length} unidades generadas automáticamente`}
        </p>
      </div>

      <CharacteristicsSummary state={state} />

      <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground leading-relaxed">
        <Info className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
        Haz clic en cualquier unidad para editar sus datos, subir multimedia y ajustar características.
      </div>

      <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
        {state.unidades.map((unit) => {
          const isEditing = editingId === unit.id;

          if (isEditing && editData) {
            return (
              <div key={unit.id} className="rounded-xl border-2 border-primary bg-card px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={editData.nombre}
                    onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                    className={cn(inputBase, "h-7 w-48 text-xs font-semibold px-2")}
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={saveEdit}
                      aria-label="Guardar cambios"
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Check className="h-3 w-3" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      aria-label="Cancelar"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Row 1: Planta + Subtipo + Orientación */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {isEdificio && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground">Planta</span>
                      <select
                        value={editData.planta}
                        onChange={(e) => setEditData({ ...editData, planta: Number(e.target.value) })}
                        className={cn(selectBase, "h-7 px-2 text-xs")}
                      >
                        {plantaOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Subtipo</span>
                    <select
                      value={editData.subtipo || "apartamento"}
                      onChange={(e) => setEditData({ ...editData, subtipo: e.target.value as SubtipoUnidad })}
                      className={cn(selectBase, "h-7 px-2 text-xs")}
                    >
                      {subtipoUnidadOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Orientación</span>
                    <select
                      value={editData.orientacion}
                      onChange={(e) => setEditData({ ...editData, orientacion: e.target.value })}
                      className={cn(selectBase, "h-7 px-2 text-xs")}
                    >
                      {orientaciones.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Superficies */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "m² construidos", key: "superficieConstruida" },
                    { label: "m² útiles", key: "superficieUtil" },
                    { label: "m² terraza", key: "superficieTerraza" },
                  ] as const).map((field) => (
                    <div key={field.key} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{field.label}</span>
                      <input
                        type="number"
                        value={editData[field.key]}
                        onChange={(e) => setEditData({ ...editData, [field.key]: Number(e.target.value) })}
                        className={cn(inputBase, "h-7 text-xs px-2 tnum")}
                      />
                    </div>
                  ))}
                </div>

                {/* Row 3: Dorm + Baños + Precio */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Dormitorios</span>
                    <input
                      type="number"
                      value={editData.dormitorios}
                      onChange={(e) => setEditData({ ...editData, dormitorios: Number(e.target.value) })}
                      className={cn(inputBase, "h-7 text-xs px-2 tnum")}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Baños</span>
                    <input
                      type="number"
                      value={editData.banos}
                      onChange={(e) => setEditData({ ...editData, banos: Number(e.target.value) })}
                      className={cn(inputBase, "h-7 text-xs px-2 tnum")}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Precio (€)</span>
                    <input
                      type="number"
                      value={editData.precio}
                      onChange={(e) => setEditData({ ...editData, precio: Number(e.target.value) })}
                      className={cn(inputBase, "h-7 text-xs px-2 tnum")}
                    />
                  </div>
                </div>

                {/* Vistas */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">Vistas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tipoVistaOptions.map((v) => {
                      const active = (editData.vistas || []).includes(v.value);
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => toggleVista(v.value)}
                          className={cn(
                            "rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles parking/trastero */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "parking" as const, label: "Parking" },
                    { key: "trastero" as const, label: "Trastero" },
                  ]).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setEditData({ ...editData, [t.key]: !editData[t.key] })}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        editData[t.key] ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {t.label}: {editData[t.key] ? "Sí" : "No"}
                    </button>
                  ))}
                </div>

                {/* Características */}
                <div className="flex flex-col gap-1 pt-2 border-t border-border">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Características
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {caracteristicasViviendaOptions.map((c) => {
                      const Icon = c.icon;
                      const active = (editData.caracteristicas || []).includes(c.value);
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => toggleCaracteristica(c.value)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground/70 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-3 w-3" strokeWidth={1.5} />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Multimedia */}
                <button
                  type="button"
                  onClick={() => { saveEdit(); setMultimediaUnitId(unit.id); }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Multimedia (fotos, vídeos, planos, docs)
                </button>
              </div>
            );
          }

          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => startEdit(unit)}
              className="group rounded-xl border border-border bg-card px-4 py-2.5 flex items-center justify-between gap-3 hover:border-primary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground w-24 shrink-0 truncate">
                  {unit.nombre}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {unit.subtipo && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                      {subtipoUnidadOptions.find((s) => s.value === unit.subtipo)?.label}
                    </span>
                  )}
                  <span className="tnum">{unit.dormitorios}D · {unit.banos}B</span>
                  <span className="text-border">|</span>
                  <span className="tnum">{unit.superficieConstruida}m²</span>
                  {isEdificio && (
                    <>
                      <span className="text-border">|</span>
                      <span className="tnum">P{unit.planta}</span>
                    </>
                  )}
                  <span className="text-border">|</span>
                  <span>{unit.orientacion}</span>
                  {unit.vistas.length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-primary">{unit.vistas.length} vista{unit.vistas.length > 1 ? "s" : ""}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-foreground tnum">{formatPrice(unit.precio)}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal multimedia por unidad */}
      {multimediaUnit && (
        <UnitMultimediaModal
          open={!!multimediaUnitId}
          onClose={() => setMultimediaUnitId(null)}
          unit={multimediaUnit}
          promotionFotos={state.fotos}
          promotionVideos={state.videos}
          onUpdate={(data) => {
            update(
              "unidades",
              state.unidades.map((u) => (u.id === multimediaUnitId ? { ...u, ...data } : u)),
            );
          }}
        />
      )}
    </div>
  );
}
