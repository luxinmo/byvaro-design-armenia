/**
 * Resumen · pantalla final del paso · lista de filas clave : valor : Editar.
 * Editar lleva al sub-step correspondiente. CTA primaria "Continuar".
 */

import { Pencil, ArrowRight } from "lucide-react";
import { computeTotalViviendas } from "./types";
import type { ModeloSimple, SubStep } from "./types";

const PB_LABEL: Record<ModeloSimple["plantaBaja"], string> = {
  sin: "Sin uso residencial",
  locales: "Locales comerciales",
  viviendas: "Viviendas (bajos)",
};

export function Resumen({
  modelo,
  onEdit,
  onContinue,
}: {
  modelo: ModeloSimple;
  onEdit: (s: SubStep) => void;
  onContinue: () => void;
}) {
  const { total, groundUnits } = computeTotalViviendas(modelo);

  const filas: Array<{ label: string; value: string; goto: SubStep }> = [
    { label: "Plantas sobre rasante", value: `${modelo.plantas}`, goto: 0 },
    { label: "Viviendas por planta", value: `${modelo.viviendas}`, goto: 1 },
    {
      label: "Estructura",
      value: modelo.estructura === "simple"
        ? "1 escalera · 1 bloque"
        : `${modelo.escaleras} ${modelo.escaleras === 1 ? "escalera" : "escaleras"} · ${modelo.bloques} ${modelo.bloques === 1 ? "bloque" : "bloques"}`,
      goto: 2,
    },
    { label: "Planta baja", value: PB_LABEL[modelo.plantaBaja], goto: 3 },
  ];

  return (
    <div className="flex flex-col items-center text-center max-w-xl mx-auto">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Resumen
      </p>
      <h2 className="mt-3 text-[26px] sm:text-[28px] leading-tight font-bold text-foreground tracking-tight">
        Confirma la configuración
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Revísalo o edita cualquier campo antes de continuar.
      </p>

      <div className="mt-10 w-full rounded-2xl border border-border bg-card overflow-hidden">
        {filas.map((f, i) => (
          <div
            key={f.goto}
            className={cnSep(i, filas.length)}
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] text-muted-foreground">{f.label}</p>
              <p className="text-[14px] font-medium text-foreground mt-0.5">{f.value}</p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(f.goto)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline shrink-0"
            >
              <Pencil className="h-3 w-3" strokeWidth={2} />
              Editar
            </button>
          </div>
        ))}

        {/* Fila destacada · total */}
        <div className="px-5 py-5 bg-primary/5 border-t border-primary/15 flex items-center justify-between gap-4">
          <span className="text-[13px] font-semibold text-foreground">Total de viviendas</span>
          <span className="text-[28px] leading-none font-bold text-foreground tracking-tight tnum">
            {total}
          </span>
        </div>
        {groundUnits > 0 && (
          <div className="px-5 py-2 bg-primary/5 text-[11px] text-muted-foreground text-right border-t border-primary/10">
            Incluye {groundUnits} {groundUnits === 1 ? "bajo" : "bajos"} en planta 0
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-8 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-foreground text-background text-[14px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
      >
        Continuar al paso 4
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function cnSep(i: number, total: number): string {
  return [
    "px-5 py-4 flex items-center gap-4",
    i < total - 1 ? "border-b border-border/60" : "",
  ].filter(Boolean).join(" ");
}
