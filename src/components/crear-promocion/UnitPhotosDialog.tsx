/**
 * UnitPhotosDialog · Modal ligero centrado SOLO en fotos de la unidad.
 *
 * Estructura visual (orden):
 *   1. Fotos PROPIAS de esta unidad · grid 4-5 cols · cada thumb del
 *      mismo tamaño que las heredadas. Botón "+ Añadir foto" inline en
 *      el grid (no abre otro dialog · file picker directo).
 *   2. Fotos HEREDADAS de la promoción · mismo grid · click toggle
 *      excluir/activar individualmente.
 *   3. Footer · botón "Aceptar" cierra.
 *
 * Sin nested dialog (antes usaba `MultimediaEditor` que abre su propio
 * ModalShell · dialog-inside-dialog). Aquí el uploader es inline.
 */

import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/Switch";
import { Check, ImageIcon, Plus, Loader2, Star, Lock, Unlock, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadPromotionImage } from "@/lib/storage";
import { ensureDraftPersisted } from "@/lib/promotionDrafts";
import type { UnitData, WizardState, FotoItem, FotoCategoria } from "./types";

export function UnitPhotosDialog({
  open,
  onOpenChange,
  unit,
  state,
  uploadScopeId,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: UnitData | null;
  state: WizardState;
  uploadScopeId?: string;
  onUpdate: (patch: Partial<UnitData>) => void;
}) {
  /* ── Hooks ANTES de cualquier early return (Rules of Hooks). ── */
  const fotosUnidadArr = unit?.fotosUnidad ?? [];
  const ownFotos = useMemo<FotoItem[]>(
    () => fotosUnidadArr.filter((f) => !f.id.startsWith("disabled-")),
    [fotosUnidadArr],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  if (!unit) return null;

  const includeHereditary = unit.usarFotosPromocion ?? true;
  const isDisabled = (promoFotoId: string) =>
    fotosUnidadArr.some((f) => f.id === `disabled-${promoFotoId}`);
  const excludedCount = fotosUnidadArr.filter((f) => f.id.startsWith("disabled-")).length;
  const promoFotos = state.fotos ?? [];

  const toggleHerited = (promoFotoId: string) => {
    if (isDisabled(promoFotoId)) {
      onUpdate({ fotosUnidad: fotosUnidadArr.filter((f) => f.id !== `disabled-${promoFotoId}`) });
    } else {
      onUpdate({
        fotosUnidad: [
          ...fotosUnidadArr,
          {
            id: `disabled-${promoFotoId}`, url: "", nombre: "",
            categoria: "otra" as FotoCategoria,
            esPrincipal: false, bloqueada: false, orden: 0,
          },
        ],
      });
    }
  };

  /* Sentinels (heredadas excluidas) viven al final · cuando reordenamos
   * o mutamos las propias, los preservamos sin tocar. */
  const sentinels = fotosUnidadArr.filter((f) => f.id.startsWith("disabled-"));
  const persistOwn = (next: FotoItem[]) => {
    onUpdate({ fotosUnidad: [...next, ...sentinels] });
  };

  const removeOwnFoto = (id: string) => {
    persistOwn(ownFotos.filter((f) => f.id !== id));
  };

  const setPrincipal = (id: string) => {
    /* Mueve la nueva principal al primer puesto · cara de la unidad. */
    const target = ownFotos.find((f) => f.id === id);
    if (!target) return;
    const rest = ownFotos.filter((f) => f.id !== id);
    const next = [{ ...target, esPrincipal: true }, ...rest.map((f) => ({ ...f, esPrincipal: false }))]
      .map((f, i) => ({ ...f, orden: i }));
    persistOwn(next);
  };

  const toggleLock = (id: string) => {
    persistOwn(ownFotos.map((f) => (f.id === id ? { ...f, bloqueada: !f.bloqueada } : f)));
  };

  /* Drag & drop · reordena `ownFotos` según el índice destino. */
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...ownFotos];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setDragIdx(idx);
    persistOwn(next.map((f, i) => ({ ...f, orden: i })));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!uploadScopeId) {
      toast.error("Guarda el borrador antes de subir fotos");
      return;
    }
    setUploading(true);
    try {
      /* Asegura que el draft existe en DB antes de subir (sin esto la
       * RLS de storage rechaza si el autosave no ha persistido aún). */
      if (uploadScopeId.startsWith("d-")) {
        const ensured = await ensureDraftPersisted(uploadScopeId);
        if (!ensured.ok) throw new Error(ensured.error ?? "No se pudo preparar el borrador");
      }
      const results = await Promise.allSettled(
        Array.from(files).map(async (file, i) => {
          const url = await uploadPromotionImage(uploadScopeId, file, "unit");
          const item: FotoItem = {
            id: `foto-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            url,
            nombre: file.name.replace(/\.[^.]+$/, ""),
            categoria: "otra" as FotoCategoria,
            esPrincipal: ownFotos.length === 0 && i === 0,
            bloqueada: false,
            orden: fotosUnidadArr.length + i,
          };
          return item;
        }),
      );
      const ok = results.filter((r): r is PromiseFulfilledResult<FotoItem> => r.status === "fulfilled").map((r) => r.value);
      const fail = results.length - ok.length;
      if (ok.length > 0) {
        persistOwn([...ownFotos, ...ok]);
        toast.success(`${ok.length} ${ok.length === 1 ? "foto subida" : "fotos subidas"}`);
      }
      if (fail > 0) {
        const first = (results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined)?.reason;
        const msg = first instanceof Error ? first.message : String(first);
        toast.error(`${fail} ${fail === 1 ? "foto falló" : "fotos fallaron"}`, { description: msg.slice(0, 140) });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" strokeWidth={1.7} />
            Fotos de {unit.nombre}
          </DialogTitle>
          <DialogDescription>
            Sube fotos específicas de esta unidad o gestiona qué fotos de la promoción se heredan.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input · uploader inline sin dialog secundario */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col gap-6 mt-2">
          {/* ═══════════ 1 · Fotos propias ═══════════ */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Fotos propias de esta unidad
              </p>
              <span className="text-[11px] text-muted-foreground tnum">
                {ownFotos.length} {ownFotos.length === 1 ? "foto" : "fotos"}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {ownFotos.map((foto, idx) => (
                <div
                  key={foto.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={() => setDragIdx(null)}
                  className={cn(
                    "group relative aspect-[4/3] rounded-lg overflow-hidden border bg-card transition-all",
                    dragIdx === idx ? "border-primary shadow-soft-lg opacity-70" : "border-border",
                    foto.esPrincipal && "ring-2 ring-primary/40",
                  )}
                >
                  <img src={foto.url} alt={foto.nombre || ""} className="w-full h-full object-cover" loading="lazy" />

                  {/* Mover · drag handle (esquina superior izquierda) */}
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-background/85 backdrop-blur-sm text-muted-foreground cursor-grab"
                         title="Arrastrar para reordenar">
                      <GripVertical className="h-3 w-3" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* Acciones · star / lock / delete (esquina superior derecha) */}
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setPrincipal(foto.id)}
                      title={foto.esPrincipal ? "Imagen principal" : "Establecer como principal"}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md backdrop-blur-sm transition-colors",
                        foto.esPrincipal
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/85 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Star className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLock(foto.id)}
                      title={foto.bloqueada ? "Desbloquear exportación" : "Bloquear exportación"}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md backdrop-blur-sm transition-colors",
                        foto.bloqueada
                          ? "bg-destructive/80 text-destructive-foreground"
                          : "bg-background/85 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {foto.bloqueada
                        ? <Lock className="h-3 w-3" strokeWidth={1.5} />
                        : <Unlock className="h-3 w-3" strokeWidth={1.5} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOwnFoto(foto.id)}
                      aria-label="Eliminar foto"
                      className="flex h-5 w-5 items-center justify-center rounded-md bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>

                  {foto.esPrincipal && (
                    <span className="absolute bottom-1 left-1 text-[8.5px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      PRINCIPAL
                    </span>
                  )}
                </div>
              ))}
              {/* "+" tile · mismo tamaño que las heredadas y propias */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "aspect-[4/3] rounded-lg border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors",
                  uploading
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-primary/50 hover:text-foreground hover:bg-muted/40",
                )}
              >
                {uploading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" strokeWidth={1.8} />}
                <span className="text-[10.5px]">{uploading ? "Subiendo…" : "Añadir"}</span>
              </button>
            </div>
          </section>

          {/* ═══════════ 2 · Fotos heredadas ═══════════ */}
          {promoFotos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Heredadas de la promoción
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {includeHereditary
                      ? `${promoFotos.length - excludedCount}/${promoFotos.length} activas · click para excluir individualmente`
                      : "Esta unidad NO heredará ninguna foto de la promoción"}
                  </p>
                </div>
                <Switch
                  checked={includeHereditary}
                  onCheckedChange={(v) => onUpdate({ usarFotosPromocion: v })}
                  ariaLabel="Incluir fotos de la promoción"
                />
              </div>

              {includeHereditary && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {promoFotos.map((foto) => {
                    const disabled = isDisabled(foto.id);
                    return (
                      <button
                        key={foto.id}
                        type="button"
                        onClick={() => toggleHerited(foto.id)}
                        className={cn(
                          "relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
                          disabled ? "border-border opacity-40 grayscale" : "border-primary",
                        )}
                        title={disabled ? "Activar para esta unidad" : "Excluir para esta unidad"}
                      >
                        <img src={foto.url} alt={foto.nombre || ""} className="w-full h-full object-cover" loading="lazy" />
                        {!disabled && (
                          <span className="absolute top-1 right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground shadow">
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
          >
            Aceptar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
