/**
 * V4 · Configuración de un bloque (escaleras + plantas + viviendas).
 *
 * Pantalla única que pide los 3 datos del bloque actual.
 * Si hay varios bloques, esta misma pantalla se reitera por cada uno
 * con su nombre editable arriba ("Bloque 1", renombrable).
 */

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Stepper } from "./Stepper";
import { LIMITES } from "./types";

export function BloqueConfigV4({
  blockName,
  isMultiBlock,
  bloqueIdx,
  totalBloques,
  escaleras,
  plantas,
  viviendas,
  onRename,
  onEscalerasChange,
  onPlantasChange,
  onViviendasChange,
}: {
  blockName: string;
  isMultiBlock: boolean;
  bloqueIdx: number;
  totalBloques: number;
  escaleras: number;
  plantas: number;
  viviendas: number;
  onRename: (name: string) => void;
  onEscalerasChange: (n: number) => void;
  onPlantasChange: (n: number) => void;
  onViviendasChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(blockName);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== blockName) onRename(trimmed);
    else setDraftName(blockName);
    setEditing(false);
  };

  return (
    <div className="flex flex-col items-center text-center">
      {isMultiBlock && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Bloque {bloqueIdx + 1} de {totalBloques}
        </p>
      )}

      {/* Header con nombre editable · solo si multi-bloque */}
      {isMultiBlock ? (
        <div className="mt-2 flex items-center gap-2">
          {editing ? (
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setDraftName(blockName);
                  setEditing(false);
                }
              }}
              autoFocus
              className="text-[20px] sm:text-[22px] font-bold text-foreground tracking-tight bg-transparent border-b-2 border-primary outline-none px-1 max-w-[260px]"
            />
          ) : (
            <>
              <h2 className="text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight">
                {blockName}
              </h2>
              <button
                type="button"
                onClick={() => { setDraftName(blockName); setEditing(true); }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                title="Renombrar bloque"
                aria-label="Renombrar bloque"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      ) : (
        <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight">
          Configura el edificio
        </h2>
      )}

      <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
        {isMultiBlock
          ? "Define la estructura de este bloque. Cada bloque puede tener distinta cantidad de plantas o escaleras."
          : "Indica las escaleras, plantas y viviendas por planta."}
      </p>

      {/* 3 inputs · uno por línea · stepper sm para que entre todo */}
      <div className="mt-5 w-full max-w-md flex flex-col gap-2.5">
        <InputRow label="Escaleras">
          <Stepper
            value={escaleras}
            onChange={onEscalerasChange}
            min={LIMITES.escaleras.min}
            max={LIMITES.escaleras.max}
            variant="sm"
            ariaLabel="Escaleras"
          />
        </InputRow>
        <InputRow label="Plantas sobre rasante">
          <Stepper
            value={plantas}
            onChange={onPlantasChange}
            min={LIMITES.plantas.min}
            max={LIMITES.plantas.max}
            variant="sm"
            ariaLabel="Plantas"
          />
        </InputRow>
        <InputRow label="Viviendas por planta">
          <Stepper
            value={viviendas}
            onChange={onViviendasChange}
            min={LIMITES.viviendas.min}
            max={LIMITES.viviendas.max}
            variant="sm"
            ariaLabel="Viviendas por planta"
          />
        </InputRow>
      </div>
    </div>
  );
}

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-[13px] font-medium text-foreground text-left">{label}</span>
      {children}
    </div>
  );
}
