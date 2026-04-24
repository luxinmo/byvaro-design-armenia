/**
 * UnitPhotosEditDialog · modal de edición de FOTOS de una unidad en la
 * ficha de promoción. Se abre desde "Editar unidad" en
 * `UnitDetailDialog` o desde "Subir fotos" en la galería hero.
 *
 * Funcional · no placeholder:
 *   · Upload desde el dispositivo · FileReader a dataURL local (mock).
 *     TODO(backend): POST /api/units/:id/photos (multipart) → { url }.
 *   · Borrado por foto.
 *   · Reordenación por drag-and-drop (HTML5 nativo · sin libs externas).
 *   · Marcar como principal · mueve la foto al índice 0.
 *   · Save · persiste vía `onUpdateUnit(unitId, { photos })`.
 *
 * Fallback · si la unit aún no tiene `photos` propias, pre-cargamos las
 * fotos actuales (mock picsum) como baseline editable. Así la primera
 * edición "captura" el estado visible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ImageIcon, Upload, Trash2, Star, GripVertical, X as XIcon, Images,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Unit } from "@/data/units";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: Unit | null;
  /** Fotos actualmente visibles en la galería (para pre-cargar si la
   *  unit aún no tiene `photos` propias). */
  initialPhotos: string[];
  onSave: (unitId: string, photos: string[]) => void;
}

const MAX_PHOTOS = 20;
/** Tipos aceptados en el input · los mismos que la tab Multimedia
 *  del wizard (`MultimediaEditor`). */
const ACCEPT_TYPES = "image/jpeg,image/png,image/webp,image/avif";

export function UnitPhotosEditDialog({ open, onOpenChange, unit, initialPhotos, onSave }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Al abrir · resetea al estado actual (unit.photos o initialPhotos). */
  useEffect(() => {
    if (!open || !unit) return;
    const seed = (unit.photos && unit.photos.length > 0) ? unit.photos : initialPhotos;
    setPhotos(seed.slice());
    setDragIdx(null);
    setDragOverIdx(null);
  }, [open, unit, initialPhotos]);

  const dirty = useMemo(() => {
    if (!unit) return false;
    const baseline = unit.photos ?? initialPhotos;
    if (photos.length !== baseline.length) return true;
    for (let i = 0; i < photos.length; i++) {
      if (photos[i] !== baseline[i]) return true;
    }
    return false;
  }, [photos, unit, initialPhotos]);

  if (!unit) return null;

  /* ── Handlers ──────────────────────────────────────────────────── */

  const handleUploadClick = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos por unidad`);
      return;
    }

    const toRead = Array.from(files).slice(0, remaining);
    if (toRead.length < files.length) {
      toast.warning(`Solo se añadirán ${toRead.length} de ${files.length} · máximo ${MAX_PHOTOS} fotos`);
    }

    let pending = toRead.length;
    const nextPhotos = [...photos];
    toRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === "string" ? reader.result : "";
        if (url) nextPhotos.push(url);
        pending -= 1;
        if (pending === 0) setPhotos(nextPhotos);
      };
      reader.onerror = () => {
        toast.error(`No se pudo leer ${file.name}`);
        pending -= 1;
        if (pending === 0) setPhotos(nextPhotos);
      };
      reader.readAsDataURL(file);
    });

    // Reset input para permitir subir el mismo archivo otra vez.
    e.target.value = "";
  };

  const handleDelete = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSetPrincipal = (idx: number) => {
    if (idx === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
  };

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    if (from == null || from === idx) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [picked] = next.splice(from, 1);
      next.splice(idx, 0, picked);
      return next;
    });
  };

  const handleSave = () => {
    onSave(unit.id, photos);
    onOpenChange(false);
    toast.success(`Fotos de la unidad guardadas · ${photos.length} en total`);
  };

  const handleReset = () => {
    const baseline = unit.photos ?? initialPhotos;
    setPhotos(baseline.slice());
  };

  const unitLabel = unit.publicId?.trim() || `${unit.floor}º${unit.door}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Images className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[17px] font-semibold leading-tight">
                Editar fotos de la unidad
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                <span className="font-medium text-foreground">{unit.type} {unitLabel}</span>
                {" · "}
                Sube, reordena y elige la foto principal. La primera foto es la que
                se muestra como portada.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Toolbar · contador + upload */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{photos.length}</span>
              {" / "}
              <span className="tabular-nums">{MAX_PHOTOS}</span> fotos
              {photos.length > 0 && (
                <span className="ml-1.5 text-muted-foreground/70">
                  · arrastra para reordenar
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Deshacer cambios
                </button>
              )}
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={photos.length >= MAX_PHOTOS}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="h-3 w-3" strokeWidth={2.5} />
                Subir fotos
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_TYPES}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Grid de fotos · drag-drop para reordenar */}
          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((url, idx) => {
                const isDraggedOver = dragOverIdx === idx && dragIdx !== idx;
                const isPrincipal = idx === 0;
                return (
                  <li
                    key={`${url.slice(0, 30)}-${idx}`}
                    draggable
                    onDragStart={handleDragStart(idx)}
                    onDragOver={handleDragOver(idx)}
                    onDragLeave={() => setDragOverIdx((prev) => (prev === idx ? null : prev))}
                    onDrop={handleDrop(idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={cn(
                      "group relative aspect-[4/3] rounded-xl overflow-hidden border bg-muted cursor-move transition-all",
                      isPrincipal ? "border-primary ring-2 ring-primary/20" : "border-border",
                      isDraggedOver && "ring-2 ring-primary scale-[1.02]",
                      dragIdx === idx && "opacity-50",
                    )}
                  >
                    <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" draggable={false} />

                    {/* Handle drag · visible al hover */}
                    <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <GripVertical className="h-3 w-3" strokeWidth={2} />
                    </div>

                    {/* Badge principal */}
                    {isPrincipal && (
                      <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shadow-soft">
                        <Star className="h-2 w-2 fill-current" strokeWidth={2.5} />
                        Principal
                      </div>
                    )}

                    {/* Acciones · delete + set principal · visibles al hover */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent">
                      {!isPrincipal && (
                        <button
                          type="button"
                          onClick={() => handleSetPrincipal(idx)}
                          className="inline-flex items-center gap-1 rounded-full bg-card/90 backdrop-blur text-[10px] font-semibold text-foreground px-2 py-0.5 hover:bg-card transition-colors"
                          title="Marcar como principal"
                        >
                          <Star className="h-2.5 w-2.5" strokeWidth={2} />
                          Principal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        className={cn(
                          "inline-flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors shadow-soft",
                          isPrincipal && "ml-auto",
                        )}
                        title="Eliminar foto"
                        aria-label={`Eliminar foto ${idx + 1}`}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Número de foto · esquina inferior izquierda */}
                    <div className="absolute bottom-2 left-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white text-[9px] font-semibold tabular-nums h-5 min-w-[20px] px-1.5">
                      {idx + 1}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            /* Empty state · arrastra o sube */
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 px-6 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-foreground">Sin fotos</p>
              <p className="text-[11.5px] text-muted-foreground mt-1 mb-4">
                Sube fotos para esta unidad. La primera será la portada.
              </p>
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                Subir fotos
              </button>
            </div>
          )}

          {/* Nota sobre upload · se sube localmente (mock) hasta backend */}
          <p className="text-[10.5px] text-muted-foreground text-center">
            Formatos · JPG · PNG · WebP · AVIF. Las fotos se guardan en el
            navegador (mock) hasta que se conecte el backend de storage.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-border bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
            <XIcon className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty}
            className="rounded-full"
          >
            Guardar fotos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
