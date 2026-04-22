/**
 * DuplicateResult — bloque de resultado de la IA de duplicados en el
 * detalle de un Registro pendiente.
 *
 * Estructura (réplica de Lovable adaptada a tokens Byvaro):
 *  · MatchRing grande + título por nivel + sub-texto contextual.
 *  · Tabla side-by-side: Campo · Solicitud · Existente · ✓/✗.
 *  · Recomendación con CTA "Ver histórico del cliente →" si hay
 *    `existingClient` (link al contacto duplicado).
 *
 * Solo se renderiza para registros con `matchPercentage > 0`. Para
 * "sin coincidencias" la pantalla padre muestra otro empty state.
 */

import { Check, X, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchRing } from "./MatchRing";
import type { Registro } from "@/data/records";

export function DuplicateResult({ record }: { record: Registro }) {
  if (!record.matchCliente || record.matchPercentage === 0) return null;

  const pct = record.matchPercentage;
  const isDanger  = pct >= 70;
  const isWarning = pct >= 40 && pct < 70;
  const isSafe    = pct < 40;

  const fields = buildMatchFields(record);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      isDanger  && "border-destructive/30 bg-destructive/5",
      isWarning && "border-amber-300/40 bg-amber-50/30 dark:bg-amber-500/5",
      isSafe    && "border-emerald-300/40 bg-emerald-50/30 dark:bg-emerald-500/5",
    )}>
      {/* Header con anillo + título */}
      <div className="flex items-center gap-3">
        <MatchRing pct={pct} size={14} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-bold",
            isDanger  && "text-destructive",
            isWarning && "text-amber-700 dark:text-amber-400",
            isSafe    && "text-emerald-700 dark:text-emerald-400",
          )}>
            {isDanger  ? "Posible duplicado detectado" :
             isWarning ? "Coincidencia parcial" :
                         "Sin coincidencias relevantes"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {record.matchWith ?? (isDanger
              ? "Coincide con un cliente previo."
              : isWarning ? "Algunos datos coinciden con un cliente existente."
              : "La IA no detecta duplicados.")}
          </p>
        </div>
      </div>

      {/* Tabla side-by-side */}
      <div className="rounded-lg border border-border/40 overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_1fr_1fr_28px] bg-muted/40 px-3 py-1.5">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Campo</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Solicitud</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Existente</span>
          <span aria-hidden />
        </div>
        {fields.map((f) => (
          <div
            key={f.field}
            className="grid grid-cols-[1fr_1fr_1fr_28px] items-center px-3 py-2 border-t border-border/30"
          >
            <span className="text-[10px] text-muted-foreground font-medium">{f.field}</span>
            <span className="text-xs font-semibold text-foreground truncate" title={f.newValue}>
              {f.newValue}
            </span>
            <span className={cn(
              "text-xs truncate",
              f.match ? "text-foreground font-medium" : "text-muted-foreground",
            )} title={f.existingValue}>
              {f.existingValue || "—"}
            </span>
            <div className="flex justify-center">
              {f.match ? (
                <span className="h-5 w-5 rounded-full bg-emerald-500/15 grid place-items-center">
                  <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400" strokeWidth={2.5} />
                </span>
              ) : (
                <span className="h-5 w-5 rounded-full bg-muted grid place-items-center">
                  <X className="h-3 w-3 text-muted-foreground/50" strokeWidth={2.5} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recomendación */}
      {record.recommendation && (
        <div className={cn(
          "flex items-start gap-2 rounded-lg px-3 py-2.5",
          isDanger  ? "bg-destructive/5"   :
          isWarning ? "bg-amber-100/40 dark:bg-amber-500/5" :
                      "bg-emerald-100/40 dark:bg-emerald-500/5",
        )}>
          <AlertTriangle className={cn(
            "h-3.5 w-3.5 mt-0.5 shrink-0",
            isDanger  && "text-destructive",
            isWarning && "text-amber-700 dark:text-amber-400",
            isSafe    && "text-emerald-700 dark:text-emerald-400",
          )} />
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-[11px] leading-relaxed font-medium",
              isDanger  && "text-destructive/90",
              isWarning && "text-amber-800 dark:text-amber-300",
              isSafe    && "text-emerald-800 dark:text-emerald-300",
            )}>
              {record.recommendation}
            </p>
            {record.matchWith && (
              <button
                type="button"
                className="text-[11px] font-semibold text-foreground hover:underline mt-1 inline-flex items-center gap-1"
                onClick={() => {
                  /* TODO(ui): cuando exista el deep-link al contacto
                   * dueño del duplicado, navegar a /contactos/:id. */
                }}
              >
                Ver histórico del cliente <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Construye las filas de la tabla a partir de cliente vs matchCliente. */
function buildMatchFields(r: Registro): Array<{
  field: string;
  newValue: string;
  existingValue: string;
  match: boolean;
}> {
  const m = r.matchCliente ?? {};
  return [
    { field: "Nombre",       newValue: r.cliente.nombre,       existingValue: m.nombre       ?? "", match: m.nombre       === r.cliente.nombre },
    { field: "Email",        newValue: r.cliente.email,        existingValue: m.email        ?? "", match: m.email        === r.cliente.email },
    { field: "Teléfono",     newValue: r.cliente.telefono,     existingValue: m.telefono     ?? "", match: m.telefono     === r.cliente.telefono },
    { field: "DNI / NIE",    newValue: r.cliente.dni,          existingValue: m.dni          ?? "", match: m.dni          === r.cliente.dni },
    { field: "Nacionalidad", newValue: r.cliente.nacionalidad, existingValue: m.nacionalidad ?? "", match: m.nacionalidad === r.cliente.nacionalidad },
  ];
}
