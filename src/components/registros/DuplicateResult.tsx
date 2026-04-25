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

import { Check, X, AlertTriangle, ArrowRight, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MatchRing } from "./MatchRing";
import type { Registro } from "@/data/records";

type Props = {
  record: Registro;
  /** Callback opcional · si se pasa, aparece el botón "No es duplicado"
   *  que permite al promotor descartar el match (feedback loop IA). */
  onDismissMatch?: () => void;
};

export function DuplicateResult({ record, onDismissMatch }: Props) {
  const navigate = useNavigate();
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
      isWarning && "border-warning/30 bg-warning/30 dark:bg-warning/5",
      isSafe    && "border-success/30 bg-success/30 dark:bg-success/5",
    )}>
      {/* Header con anillo + título */}
      <div className="flex items-center gap-3">
        <MatchRing pct={pct} size={14} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-bold",
            isDanger  && "text-destructive",
            isWarning && "text-warning dark:text-warning",
            isSafe    && "text-success dark:text-success",
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

      {/* Tabla side-by-side · en mobile (≤640px) las celdas se hacen
       *  más compactas para evitar truncado agresivo de los valores. */}
      <div className="rounded-lg border border-border/40 overflow-hidden bg-card">
        <div className="grid grid-cols-[80px_1fr_1fr_24px] sm:grid-cols-[1fr_1fr_1fr_28px] bg-muted/40 px-2.5 sm:px-3 py-1.5 gap-2 sm:gap-3">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Campo</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Solicitud</span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Existente</span>
          <span aria-hidden />
        </div>
        {fields.map((f) => (
          <div
            key={f.field}
            className="grid grid-cols-[80px_1fr_1fr_24px] sm:grid-cols-[1fr_1fr_1fr_28px] items-center px-2.5 sm:px-3 py-2 gap-2 sm:gap-3 border-t border-border/30"
          >
            <span className="text-[10px] text-muted-foreground font-medium truncate">{f.field}</span>
            <span className="text-[11px] sm:text-xs font-semibold text-foreground break-words" title={f.newValue}>
              {f.newValue}
            </span>
            <span className={cn(
              "text-[11px] sm:text-xs break-words",
              f.match ? "text-foreground font-medium" : "text-muted-foreground",
            )} title={f.existingValue}>
              {f.existingValue || "—"}
            </span>
            <div className="flex justify-center">
              {f.neutral ? (
                // Campo informativo · sin indicador de coincidencia.
                <span aria-hidden />
              ) : f.match ? (
                <span className="h-5 w-5 rounded-full bg-success/15 grid place-items-center">
                  <Check className="h-3 w-3 text-success dark:text-success" strokeWidth={2.5} />
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
          isWarning ? "bg-warning/40 dark:bg-warning/5" :
                      "bg-success/40 dark:bg-success/5",
        )}>
          <AlertTriangle className={cn(
            "h-3.5 w-3.5 mt-0.5 shrink-0",
            isDanger  && "text-destructive",
            isWarning && "text-warning dark:text-warning",
            isSafe    && "text-success dark:text-success",
          )} />
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-[11px] leading-relaxed font-medium",
              isDanger  && "text-destructive/90",
              isWarning && "text-warning dark:text-warning",
              isSafe    && "text-success dark:text-success",
            )}>
              {record.recommendation}
            </p>
            {record.matchWith && (
              <button
                type="button"
                className="text-[11px] font-semibold text-foreground hover:underline mt-1 inline-flex items-center gap-1"
                onClick={() => {
                  /* Deep-link a `/contactos` con el email (o nombre)
                   *  del contacto coincidente como query. La página
                   *  `Contactos.tsx` lee `?q=` y precarga el search.
                   *  TODO(backend): cuando Contact tenga `id` en el
                   *  matchCliente, navegar directo a `/contactos/:id`. */
                  const q = record.matchCliente?.email
                    ?? record.matchCliente?.nombre
                    ?? "";
                  navigate(`/contactos?q=${encodeURIComponent(q)}`);
                }}
              >
                Ver histórico del cliente <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feedback loop · el promotor puede descartar el match si
          conoce que son personas distintas (ej. hermanos con mismo
          apellido y dirección) · señal de entrenamiento para la IA. */}
      {onDismissMatch && (
        <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ¿La IA se ha equivocado? Descarta el match para que aprenda.
          </p>
          <button
            type="button"
            onClick={onDismissMatch}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            No es duplicado
          </button>
        </div>
      )}
    </div>
  );
}

/** Si el registro viene de colaborador, enmascara el teléfono
 *  dejando prefijo + últimos 4 dígitos (regla de privacidad: la
 *  agencia posee el contacto hasta que se aprueba el registro). */
function maskPhoneIfCollab(telefono: string, origen: Registro["origen"]): string {
  if (origen === "direct") return telefono;
  const digits = telefono.replace(/\D/g, "");
  if (digits.length <= 4) return telefono;
  const last4 = digits.slice(-4);
  const prefix = telefono.match(/^\+\d+/)?.[0];
  return prefix ? `${prefix} ··· ··· ${last4}` : `··· ··· ${last4}`;
}

/** Construye las filas de la tabla a partir de cliente vs matchCliente.
 *  DNI ya no se muestra (no se pide en fase registro · ver
 *  CLAUDE.md + types/promotion-config.ts::CondicionRegistro). El
 *  teléfono del registro entrante se enmascara si es colaborador.
 *  La nacionalidad NO se evalúa como coincidencia (millones comparten
 *  el mismo país · es contexto, no señal de duplicado) · se marca
 *  como `neutral`. */
function buildMatchFields(r: Registro): Array<{
  field: string;
  newValue: string;
  existingValue: string;
  match: boolean;
  /** Si true, no se pinta ni check ni X · el campo es informativo. */
  neutral?: boolean;
}> {
  const m = r.matchCliente ?? {};
  const maskedPhone = maskPhoneIfCollab(r.cliente.telefono, r.origen);
  // Nacionalidad con bandera · si matchCliente no trae flag propia
  // pero la nacionalidad coincide, reutilizamos la del entrante.
  const natNew = r.cliente.flag
    ? `${r.cliente.flag} ${r.cliente.nacionalidad}`
    : r.cliente.nacionalidad;
  const existingFlag = m.flag
    ?? (m.nacionalidad === r.cliente.nacionalidad ? r.cliente.flag : undefined);
  const natExisting = m.nacionalidad
    ? (existingFlag ? `${existingFlag} ${m.nacionalidad}` : m.nacionalidad)
    : "";
  return [
    { field: "Nombre",       newValue: r.cliente.nombre,       existingValue: m.nombre       ?? "", match: m.nombre       === r.cliente.nombre },
    { field: "Teléfono",     newValue: maskedPhone,            existingValue: m.telefono     ?? "", match: m.telefono     === r.cliente.telefono },
    { field: "Nacionalidad", newValue: natNew,                 existingValue: natExisting,         match: false, neutral: true },
  ];
}
