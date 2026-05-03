/**
 * PreviewPane · panel sticky derecho con el edificio en vivo + stats.
 *
 * Stats calculados desde el modelo simple via `computeTotalViviendas`.
 * En F1 el edificio es un placeholder · F2 conecta `BuildingViz`.
 */

import type { ModeloSimple } from "./types";
import { computeTotalViviendas } from "./types";
import { BuildingViz } from "./BuildingViz";

export function PreviewPane({ modelo }: { modelo: ModeloSimple }) {
  const { total, groundUnits } = computeTotalViviendas(modelo);

  return (
    /* Sin caja · diseño limpio, "floating" · header + edificio que
     * crece para llenar el espacio disponible · meta abajo. La altura
     * total se cap a 100vh - chrome (topbar + footer del wizard) para
     * que NUNCA cause scroll. El edificio (F2 · BuildingViz) usará
     * flex-1 con min-h-0 para escalarse al espacio disponible.  */
    /* Layout vertical · cap por max-h vinculado al viewport · NUNCA
       overflowea la pantalla. El edificio (`BuildingViz`) se centra
       en el espacio sobrante; si el edificio es más alto que el
       espacio, su propio overflow-auto interno permite scroll local. */
    <div className="flex flex-col h-full lg:h-[calc(100vh-260px)] lg:max-h-[calc(100vh-260px)]">
      {/* Header compacto · eyebrow + total + sublabel en bloque tight. */}
      <header className="text-center pb-2 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Vista previa
        </p>
        <p className="text-[32px] leading-none font-bold text-foreground tracking-tight tnum mt-1.5">
          {total}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {total === 1 ? "vivienda en total" : "viviendas en total"}
        </p>
      </header>

      {/* Edificio · ocupa todo el espacio vertical sobrante.
         BuildingViz internamente tiene overflow-auto si la
         configuración (muchos bloques anchos) excede el ancho. */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-1">
        <BuildingViz modelo={modelo} />
      </div>

      {/* Meta · una sola línea limpia debajo del edificio */}
      <footer className="text-center pt-2 shrink-0">
        <p className="text-[10.5px] text-muted-foreground tnum">
          {modelo.plantas}P · {modelo.viviendas} viv/planta ·{" "}
          {modelo.escaleras} esc · {modelo.bloques} {modelo.bloques === 1 ? "bloque" : "bloques"}
          {groundUnits > 0 && (
            <span className="text-foreground/80"> · <span className="font-medium">+{groundUnits}</span> bajos</span>
          )}
        </p>
      </footer>
    </div>
  );
}
