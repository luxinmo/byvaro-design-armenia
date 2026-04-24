/**
 * ShareMultiPromosDialog · popup para compartir una o varias promociones
 * con UNA agencia concreta.
 *
 * Dos modos (tipo toggle):
 *   · "Todas las publicadas" · invita automáticamente a todas las
 *     promociones activas del promotor que la agencia aún NO tiene.
 *   · "Seleccionar una a una" · lista con checkboxes · el promotor
 *     elige cuáles.
 *
 * **No pide comisión ni duración** · cada invitación se manda con la
 * comisión y duración por defecto que la promoción ya tiene configuradas
 * en su `collaboration` (o `commission` como fallback). Esto evita que
 * el promotor tenga que rellenar el mismo formulario cada vez · la
 * config vive en la ficha de la promoción, no aquí.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Home, Layers, Send, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import { useInvitaciones } from "@/lib/invitaciones";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency: Agency;
}

type Mode = "all" | "pick";

const REQUIRED_FIELDS = ["Nombre completo", "Últimas 4 cifras del teléfono", "Nacionalidad"];

/** Duración por defecto de la colaboración en meses si la promoción
 *  no especifica nada · fallback razonable. */
const DEFAULT_DURATION_MONTHS = 12;

/** Devuelve la comisión a ofertar para una promoción · prioriza la
 *  config de la promoción (comisionInternacional porque la agencia
 *  suele captar internacional) y cae al campo suelto `commission`. */
function promoCommission(p: DevPromotion): number {
  if (p.collaboration?.comisionInternacional && p.collaboration.comisionInternacional > 0) {
    return p.collaboration.comisionInternacional;
  }
  if (typeof p.commission === "number" && p.commission > 0) return p.commission;
  return 5;
}

export function ShareMultiPromosDialog({ open, onOpenChange, agency: a }: Props) {
  const { invitar } = useInvitaciones();

  /* Solo promociones REALMENTE publicables y compartibles:
   *   · status === "active" (no archivada/incompleta)
   *   · canShareWithAgencies !== false (el promotor no desactivó la
   *     compartición expresamente)
   *   · la agencia aún NO la tiene en su cartera.
   *  Las que tengan `missingSteps` o flags bloqueantes quedan fuera ·
   *  no tiene sentido invitar a algo que no está listo. */
  const unshared = useMemo(() => {
    const sharedIds = new Set(a.promotionsCollaborating ?? []);
    return developerOnlyPromotions.filter((p) => {
      if (p.status !== "active") return false;
      if (p.canShareWithAgencies === false) return false;
      if (sharedIds.has(p.id)) return false;
      return true;
    });
  }, [a.promotionsCollaborating]);

  const [mode, setMode] = useState<Mode>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setMode("all");
    setSelected(new Set());
  }, [open]);

  const effectiveList = useMemo(() => {
    if (mode === "all") return unshared;
    return unshared.filter((p) => selected.has(p.id));
  }, [mode, unshared, selected]);

  const canSend = effectiveList.length > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onSend = () => {
    if (!canSend) return;
    effectiveList.forEach((p) => {
      invitar({
        emailAgencia: a.contactoPrincipal?.email ?? `contacto@${a.id}.mock`,
        nombreAgencia: a.name,
        agencyId: a.id,
        mensajePersonalizado: "",
        comisionOfrecida: promoCommission(p),
        idiomaEmail: "es",
        promocionId: p.id,
        promocionNombre: p.name,
        duracionMeses: DEFAULT_DURATION_MONTHS,
        datosRequeridos: REQUIRED_FIELDS,
      });
    });
    toast.success(
      effectiveList.length === 1
        ? `Invitación enviada a ${a.name}`
        : `${effectiveList.length} invitaciones enviadas a ${a.name}`,
      {
        description: "Cada invitación lleva la comisión y duración configuradas en la promoción.",
      },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[92vh] flex flex-col sm:rounded-3xl overflow-hidden">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 pr-12 sm:pr-14 border-b border-border/60">
          <DialogTitle className="text-base sm:text-lg font-semibold">
            Compartir promociones con {a.name}
          </DialogTitle>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {unshared.length === 0
              ? "La agencia ya colabora en todas tus promociones activas."
              : `${unshared.length} promoción${unshared.length === 1 ? "" : "es"} activa${unshared.length === 1 ? "" : "s"} por compartir.`}
          </p>
        </DialogHeader>

        {unshared.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Home className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Todo compartido</p>
            <p className="text-[11.5px] text-muted-foreground mt-1 max-w-sm mx-auto">
              Cuando publiques una nueva promoción activa podrás invitar a {a.name} desde aquí.
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-4 inline-flex items-center gap-1 h-9 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
              {/* Modo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ModeOption
                  active={mode === "all"}
                  onClick={() => setMode("all")}
                  icon={Layers}
                  title={`Todas las publicadas (${unshared.length})`}
                  subtitle="Envía una invitación a la agencia por cada promoción activa que aún no tiene."
                />
                <ModeOption
                  active={mode === "pick"}
                  onClick={() => setMode("pick")}
                  icon={Home}
                  title="Seleccionar una a una"
                  subtitle="Marca solo las promociones que quieras compartir con esta agencia."
                />
              </div>

              {/* Lista · visible cuando modo es "pick" */}
              {mode === "pick" && (
                <ul className="rounded-2xl border border-border bg-card divide-y divide-border/50 overflow-hidden">
                  {unshared.map((p) => {
                    const isSel = selected.has(p.id);
                    const com = promoCommission(p);
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
                            <p className="text-[11px] text-muted-foreground truncate">{p.location}</p>
                          </div>
                          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/60 text-[11px] font-semibold tabular-nums text-foreground shrink-0">
                            {com}%
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Nota · cada invitación usa la config ya guardada en la promoción */}
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                Se envían con la comisión y duración que ya tienes configuradas en cada promoción. Si quieres cambiarlas, hazlo en la ficha de la promoción antes de invitar.
              </p>
            </div>

            <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center justify-between gap-2 bg-muted/10">
              <p className="text-[11.5px] text-muted-foreground">
                {mode === "all"
                  ? `Se enviarán ${unshared.length} invitaciones`
                  : selected.size === 0
                    ? "Elige al menos una promoción"
                    : `Se enviarán ${selected.size} ${selected.size === 1 ? "invitación" : "invitaciones"}`}
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
                  onClick={onSend}
                  disabled={!canSend}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors",
                    canSend
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={2} />
                  {mode === "all"
                    ? `Enviar ${unshared.length}`
                    : selected.size > 0
                      ? `Enviar ${selected.size}`
                      : "Enviar"}
                  <ArrowRight className="h-3.5 w-3.5 opacity-70" strokeWidth={2.25} />
                </button>
              </div>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  active, onClick, icon: Icon, title, subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border p-4 transition-all",
        active ? "border-foreground bg-foreground/[0.04]" : "border-border bg-card hover:bg-muted/30",
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
