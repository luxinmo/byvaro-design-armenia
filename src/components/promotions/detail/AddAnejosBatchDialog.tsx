/**
 * AddAnejosBatchDialog · rescate del popup "Añadir anejos" del wizard
 * (`CrearUnidadesStep.tsx` → AddAnejosDialog) para usarse también desde
 * la ficha de promoción. Misma UX: dos filas con icono + label +
 * descripción + stepper inline, footer con "Cancelar / Añadir N".
 *
 * Diferencias respecto al wizard:
 *  - Aquí no trabajamos con deltas contra un estado agregado; creamos
 *    registros `Anejo` reales vía `addAnejo()` con publicId auto
 *    (P{n+1}, T{n+1}) y precio por defecto = precio del último anejo
 *    del mismo tipo (o 0 si es el primero · el promotor lo edita luego
 *    desde el kebab).
 *  - El toggle "visibleToAgencies" por defecto es `true`; se configura
 *    por fila desde el kebab de la tabla.
 *
 * Para edición individual (cambiar precio/publicId/visibilidad de un
 * anejo existente) se sigue usando `AnejoFormDialog`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Car, Archive, Plus, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnejoTipo, Anejo } from "@/data/anejos";

export type AnejoBatchPayload = {
  parking: { count: number; price: number };
  trastero: { count: number; price: number };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Anejos ya existentes · se usan para calcular siguiente publicId
   *  y precio por defecto. */
  existing: Anejo[];
  /** Tipo inicialmente destacado (coincide con el segmento activo en
   *  la toolbar). Ambos tipos siguen siendo seleccionables. */
  defaultTipo?: AnejoTipo;
  onConfirm: (payload: AnejoBatchPayload) => void;
}

export function AddAnejosBatchDialog({
  open, onOpenChange, existing, defaultTipo = "parking", onConfirm,
}: Props) {
  const [values, setValues] = useState<{ parking: number; trastero: number }>({ parking: 0, trastero: 0 });
  const [prices, setPrices] = useState<{ parking: string; trastero: string }>({ parking: "", trastero: "" });

  const { currentCounts, suggestedPrice } = useMemo(() => {
    const parkings = existing.filter((a) => a.tipo === "parking");
    const trasteros = existing.filter((a) => a.tipo === "trastero");
    return {
      currentCounts: { parking: parkings.length, trastero: trasteros.length },
      /** Sugerimos el precio del último anejo existente del tipo; si
       *  no hay todavía, queda vacío y el promotor lo rellena. */
      suggestedPrice: {
        parking:  parkings[0]?.precio ?? 0,
        trastero: trasteros[0]?.precio ?? 0,
      },
    };
  }, [existing]);

  useEffect(() => {
    if (!open) return;
    setValues({
      parking:  defaultTipo === "parking"  ? 1 : 0,
      trastero: defaultTipo === "trastero" ? 1 : 0,
    });
    setPrices({
      parking:  suggestedPrice.parking  > 0 ? String(suggestedPrice.parking)  : "",
      trastero: suggestedPrice.trastero > 0 ? String(suggestedPrice.trastero) : "",
    });
  }, [open, defaultTipo, suggestedPrice.parking, suggestedPrice.trastero]);

  const parsePrice = (raw: string): number => {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const totalDelta = values.parking + values.trastero;
  /* Permitir confirmar solo si cada tipo con cantidad > 0 tiene
     precio > 0 · evita crear anejos a 0 € sin querer. */
  const canSubmit =
    totalDelta > 0 &&
    (values.parking  === 0 || parsePrice(prices.parking)  > 0) &&
    (values.trastero === 0 || parsePrice(prices.trastero) > 0);

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
            Suma plazas de parking o trasteros. Cada uno tendrá su precio individual (editable después).
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 flex flex-col gap-2">
          {options.map((o) => {
            const curr = currentCounts[o.key];
            const val = values[o.key];
            const selected = val > 0;
            const Icon = o.icon;
            return (
              <div
                key={o.key}
                className={cn(
                  "rounded-2xl border px-4 py-3 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border bg-card",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {curr > 0 ? `${curr} ya existente${curr === 1 ? "" : "s"} · suma más` : o.description}
                    </p>
                  </div>
                  <InlineStepper
                    value={val}
                    onChange={(v) => setValues((p) => ({ ...p, [o.key]: v }))}
                  />
                </div>

                {/* Input de precio · aparece solo si la cantidad > 0.
                    El precio se aplica a todos los que se añaden en este lote. */}
                {selected && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground shrink-0">
                      Precio unitario
                    </label>
                    <div className="relative flex-1">
                      <input
                        value={prices[o.key]}
                        onChange={(e) => setPrices((p) => ({ ...p, [o.key]: e.target.value }))}
                        inputMode="numeric"
                        placeholder={o.key === "parking" ? "18000" : "6500"}
                        className="w-full h-9 px-3 pr-8 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        €
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Aviso · ID y precio editables después */}
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Los IDs (P1, P2… · T1, T2…) se generan automáticamente.
              Puedes cambiar el <strong className="text-foreground font-semibold">ID</strong> y el
              {" "}<strong className="text-foreground font-semibold">precio</strong> individualmente después,
              desde el kebab de cada fila en la tabla.
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground mt-1">
            {totalDelta > 0
              ? <>Se añadirán <span className="tnum text-primary font-semibold">{totalDelta}</span> anejo{totalDelta > 1 ? "s" : ""}.</>
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
            onClick={() => {
              onConfirm({
                parking:  { count: values.parking,  price: parsePrice(prices.parking) },
                trastero: { count: values.trastero, price: parsePrice(prices.trastero) },
              });
              onOpenChange(false);
            }}
            disabled={!canSubmit}
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

/* ───── InlineStepper local · mismo comportamiento que el del wizard ───── */
function InlineStepper({
  value, min = 0, onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="h-3 w-3" strokeWidth={1.5} />
      </button>
      <span className="w-6 text-center text-xs font-semibold text-foreground tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground active:scale-95"
      >
        <Plus className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}
