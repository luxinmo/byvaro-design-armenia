/**
 * UnitSimpleEditDialog · Modal simple de edición de unidad desde el
 * wizard. Solo 3 secciones:
 *   - Fotos: usa MultimediaEditor compartido sobre unit.fotosUnidad.
 *     Si no hay fotos propias, hereda las de la promoción.
 *   - Planos: toggle "Usar planos de la promoción" + uploader simple.
 *   - Características: chips heredadas de caracteristicasVivienda,
 *     editables por unidad (unit.caracteristicas).
 */

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Check } from "lucide-react";
import { MultimediaEditor } from "@/components/shared/MultimediaEditor";
import { caracteristicasViviendaOptions } from "./options";
import type { UnitData, WizardState, FotoItem, VideoItem } from "./types";

export function UnitSimpleEditDialog({
  open, onOpenChange, unit, state, onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: UnitData | null;
  state: WizardState;
  onUpdate: (patch: Partial<UnitData>) => void;
}) {
  if (!unit) return null;

  // Fotos efectivas: si la unidad reusa las de promoción, muestra esas
  // como read-only informativas arriba; en el editor solo dejamos las
  // propias de la unidad.
  const useFromPromotion = unit.usarFotosPromocion ?? true;
  const unitFotos = useMemo(
    () => (unit.fotosUnidad || []).filter((f) => !f.id.startsWith("disabled-")),
    [unit.fotosUnidad],
  );
  const unitVideos = unit.videosUnidad || [];

  const toggleCaracteristica = (v: string) => {
    const cur = unit.caracteristicas || [];
    onUpdate({
      caracteristicas: cur.includes(v) ? cur.filter((c) => c !== v) : [...cur, v],
    });
  };

  const resetToPromotion = () => {
    onUpdate({
      caracteristicas: [...(state.caracteristicasVivienda || [])],
    });
  };

  const inheritedCount = state.caracteristicasVivienda?.length ?? 0;
  const unitCount = unit.caracteristicas?.length ?? 0;
  const isInherited = inheritedCount === unitCount &&
    (state.caracteristicasVivienda || []).every((c) => unit.caracteristicas?.includes(c));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-3xl w-[calc(100vw-32px)] h-[calc(100vh-64px)] max-h-[720px] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">
            Editar {unit.nombre}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Fotos, planos y características propias de esta unidad. Lo que no toques se hereda de la promoción.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* ═════ Carpeta Drive · placeholder ═════
               TODO(backend): POST /api/promociones/:id/units/:ref/drive-folder
               crea la carpeta al persistir. Las fotos / planos subidos
               aquí se sincronizan automáticamente. */}
          {unit.ref && (
            <div className="rounded-lg bg-muted/30 border border-dashed border-border px-3 py-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] text-muted-foreground">
                Carpeta Drive: <span className="font-semibold text-foreground">{state.nombrePromocion || "Promoción"} / {unit.ref}</span>
              </p>
            </div>
          )}

          {/* ═════ Fotos ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fotos</h3>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={useFromPromotion}
                  onCheckedChange={(v) => onUpdate({ usarFotosPromocion: v })}
                />
                Usar fotos de la promoción ({state.fotos.length})
              </label>
            </div>
            <MultimediaEditor
              fotos={unitFotos}
              videos={unitVideos}
              onFotosChange={(next: FotoItem[]) => onUpdate({ fotosUnidad: next })}
              onVideosChange={(next: VideoItem[]) => onUpdate({ videosUnidad: next })}
            />
          </section>

          {/* ═════ Planos ═════ */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Plano de la vivienda</h3>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:border-primary/30 transition-colors">
              <Checkbox
                checked={unit.planos}
                onCheckedChange={(v) => onUpdate({ planos: v })}
              />
              <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Plano disponible</p>
                <p className="text-[11px] text-muted-foreground">
                  Activa y sube el plano (JPG / PNG / PDF).
                </p>
              </div>
              {unit.planos && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                  <Check className="h-3 w-3" strokeWidth={2} /> Activado
                </span>
              )}
            </label>
            {unit.planos && (
              <button
                type="button"
                onClick={() => alert("Mock: sube el archivo del plano (PDF o imagen)")}
                className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 flex flex-col items-center gap-1.5 text-center hover:border-primary/40 hover:bg-muted/50 transition-colors"
              >
                <ImageIcon className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                <p className="text-xs font-medium text-muted-foreground">Subir plano de planta</p>
                <p className="text-[10px] text-muted-foreground/70">PDF · JPG · PNG</p>
              </button>
            )}
          </section>

          {/* ═════ Características ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Características</h3>
              {!isInherited && (
                <button
                  type="button"
                  onClick={resetToPromotion}
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  Restablecer a las de la promoción
                </button>
              )}
            </div>
            {isInherited && inheritedCount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Heredadas de la promoción. Haz clic para añadir o quitar para esta unidad.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {caracteristicasViviendaOptions.map((c) => {
                const Icon = c.icon;
                const active = (unit.caracteristicas || []).includes(c.value);
                const inheritedFromPromo = state.caracteristicasVivienda.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCaracteristica(c.value)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                      inheritedFromPromo && !active && "border-dashed",
                    )}
                    title={inheritedFromPromo && !active ? "Disponible en la promoción — activa para añadir a esta unidad" : undefined}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Listo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
