/**
 * UnitPhotosEditDialog · modal de edición de FOTOS de una unidad en la
 * ficha de promoción. Se abre desde "Editar unidad" en
 * `UnitDetailDialog`, desde el kebab "Editar" de la lista, y desde
 * "Editar fotos" / "✎" de la galería hero.
 *
 * UX · reutiliza el MISMO `MultimediaEditor` del wizard de Crear
 * Promoción (`src/components/shared/MultimediaEditor`). Un único
 * editor de imágenes en todo el producto · drag-drop, marcar
 * principal, categorías, bloquear, eliminar, añadir fotos/vídeos.
 *
 * Conversión · el tipo `Unit.photos` es `string[]` (URLs puras), y
 * `MultimediaEditor` trabaja con `FotoItem[]` (con id, categoría,
 * bloqueo, etc). Usamos los helpers `urlsToFotoItems` y
 * `fotoItemsToUrls` del propio editor para que el dato persistido en
 * `Unit.photos` quede plano y el backend reciba lo mismo que hoy.
 *
 * Persistencia · al pulsar "Guardar", se escribe `Unit.photos =
 * fotoItemsToUrls(localFotos)` via `onSave(unitId, photos)`.
 *
 * TODO(backend): `POST /api/units/:id/photos` para upload real (hoy
 * el MultimediaEditor usa Unsplash seeds como stand-in). Ver también
 * `Unit.photos` en `src/data/units.ts`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Images, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  MultimediaEditor,
  urlsToFotoItems,
  fotoItemsToUrls,
} from "@/components/shared/MultimediaEditor";
import type { FotoItem, VideoItem } from "@/components/crear-promocion/types";
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

export function UnitPhotosEditDialog({ open, onOpenChange, unit, initialPhotos, onSave }: Props) {
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  /* Vídeos · no los persistimos aún en Unit, pero MultimediaEditor los
   * pide · los mantenemos en memoria por si el promotor quiere usar la
   * UI (queda como estado local hasta que Unit tenga campo videos). */
  const [videos, setVideos] = useState<VideoItem[]>([]);

  /* Baseline al abrir · precarga lo que ya hay (unit.photos o el
   * fallback mock) para que el promotor edite sobre lo visible. */
  useEffect(() => {
    if (!open || !unit) return;
    const seed = (unit.photos && unit.photos.length > 0) ? unit.photos : initialPhotos;
    setFotos(urlsToFotoItems(seed));
    setVideos([]);
  }, [open, unit, initialPhotos]);

  const dirty = useMemo(() => {
    if (!unit) return false;
    const baseline = unit.photos ?? initialPhotos;
    const current = fotoItemsToUrls(fotos);
    if (current.length !== baseline.length) return true;
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== baseline[i]) return true;
    }
    return false;
  }, [fotos, unit, initialPhotos]);

  if (!unit) return null;

  const unitLabel = unit.publicId?.trim() || `${unit.floor}º${unit.door}`;

  const handleSave = () => {
    const urls = fotoItemsToUrls(fotos);
    onSave(unit.id, urls);
    onOpenChange(false);
    toast.success(`Fotos guardadas · ${urls.length} total`);
  };

  const handleReset = () => {
    const baseline = unit.photos ?? initialPhotos;
    setFotos(urlsToFotoItems(baseline));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden max-h-[92vh] flex flex-col">
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
                Mismo editor que usas al crear la promoción. Arrastra para
                reordenar, marca una foto como principal, categoriza y bloquea
                las que no deben cambiar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <MultimediaEditor
            fotos={fotos}
            videos={videos}
            onFotosChange={setFotos}
            onVideosChange={setVideos}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
              <XIcon className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            {dirty && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Deshacer cambios
              </button>
            )}
          </div>
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
