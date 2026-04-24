/**
 * ContractScopePickerDialog · popup previo al flujo de subida de
 * contrato. Pregunta qué promociones va a cubrir ese contrato.
 *
 *   · "Todas las promociones" (blanket) · scopePromotionIds vacío
 *     · cubre todo automáticamente, incluso futuras.
 *   · "Solo las seleccionadas" · multi-select entre las promociones
 *     ACTIVAS que la agencia tiene compartidas.
 *
 * Al confirmar, llama a `onContinue(ids)` donde `ids` es:
 *   · `undefined` → blanket (todas).
 *   · `string[]`  → solo las seleccionadas.
 *
 * El caller suele abrir a continuación el `ContractNewChoiceDialog`
 * (enviar a firmar vs archivar firmado) con el scope ya resuelto.
 */

import { useEffect, useState } from "react";
import { Check, Home, Layers, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PromoOption {
  id: string;
  name: string;
  location?: string;
  comision?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyName: string;
  /** Promociones activas compartidas con esta agencia · son las
   *  únicas que tiene sentido cubrir específicamente. */
  promos: PromoOption[];
  /** Preselección · útil al llegar desde una card específica. */
  defaultSelectedIds?: string[];
  /** Devuelve los ids · `undefined` = todas (blanket). */
  onContinue: (scopeIds: string[] | undefined) => void;
}

export function ContractScopePickerDialog({
  open, onOpenChange, agencyName, promos, defaultSelectedIds, onContinue,
}: Props) {
  const [mode, setMode] = useState<"all" | "pick">(
    defaultSelectedIds && defaultSelectedIds.length > 0 ? "pick" : "all",
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelectedIds ?? []),
  );

  /* Al abrir, resetea con los defaults frescos. */
  useEffect(() => {
    if (!open) return;
    const pre = new Set(defaultSelectedIds ?? []);
    setSelected(pre);
    setMode(pre.size > 0 ? "pick" : "all");
  }, [open, defaultSelectedIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canContinue = mode === "all" || selected.size > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(mode === "all" ? undefined : Array.from(selected));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 sm:rounded-3xl max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 pr-12 sm:pr-14 border-b border-border/60">
          <DialogTitle className="text-base sm:text-lg font-semibold">
            ¿Qué promociones cubre el contrato?
          </DialogTitle>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Define el alcance con {agencyName}. Luego eliges si lo envías a firmar o lo subes ya firmado.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-3">
          {/* Opción · todas (blanket) */}
          <ModeOption
            active={mode === "all"}
            onClick={() => setMode("all")}
            icon={Layers}
            title="Todas las promociones"
            subtitle="Contrato marco · cubre las actuales y cualquier promoción futura que compartas con esta agencia."
          />

          {/* Opción · solo las seleccionadas */}
          <ModeOption
            active={mode === "pick"}
            onClick={() => setMode("pick")}
            icon={Home}
            title="Solo las seleccionadas"
            subtitle={
              promos.length === 0
                ? "Esta agencia no tiene aún promociones activas compartidas."
                : `Elige entre las ${promos.length} promociones activas compartidas.`
            }
            disabled={promos.length === 0}
          />

          {/* Lista de promociones · visible solo cuando el modo es "pick" */}
          {mode === "pick" && promos.length > 0 && (
            <ul className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
              {promos.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                        isSel ? "bg-foreground/5" : "hover:bg-muted/30",
                      )}
                    >
                      <span className={cn(
                        "h-5 w-5 rounded-[6px] border grid place-items-center shrink-0 transition-all",
                        isSel
                          ? "bg-foreground border-foreground text-background"
                          : "bg-card border-border text-transparent",
                      )}>
                        {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {(p.location || typeof p.comision === "number") && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.location}
                            {p.location && typeof p.comision === "number" ? " · " : ""}
                            {typeof p.comision === "number" ? `Comisión ${p.comision}%` : ""}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center justify-between gap-2 bg-muted/10">
          <p className="text-[11.5px] text-muted-foreground">
            {mode === "all"
              ? "Cubre todas las promociones"
              : selected.size === 0
                ? "Elige al menos una"
                : `${selected.size} promoción${selected.size === 1 ? "" : "es"} cubiertas`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors",
                canContinue
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              Continuar
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  active, onClick, icon: Icon, title, subtitle, disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition-all",
        disabled && "opacity-50 cursor-not-allowed",
        active
          ? "border-foreground bg-foreground/[0.04]"
          : "border-border bg-card hover:bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          "h-9 w-9 rounded-xl grid place-items-center shrink-0",
          active ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
        <span className={cn(
          "h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 grid place-items-center transition-colors",
          active ? "bg-foreground border-foreground" : "bg-card border-border",
        )}>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
        </span>
      </div>
    </button>
  );
}
