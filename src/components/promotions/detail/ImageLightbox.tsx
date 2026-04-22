/**
 * ImageLightbox · visor de galería fullscreen reutilizable.
 *
 * Extraído del antiguo lightbox embebido en `UnitDetailDialog.tsx` para
 * reutilizar la misma UX en la ficha de promoción (`PromotionHero`) y en
 * cualquier futura ficha que necesite ver fotos en grande.
 *
 * UX:
 *   - Overlay negro full-viewport con cierre por X, tecla Escape o click
 *     fuera (gestionado por Radix).
 *   - Top bar con título/subtítulo opcional + contador "N de M".
 *   - Imagen principal con transición de zoom ligero al cambiar.
 *   - Arrows prev/next (circulares · ciclo de índices).
 *   - Strip de thumbnails abajo con el activo resaltado.
 *   - Keyboard: ← → cicla · Escape cierra (vía Radix).
 *
 * Props:
 *   - open / onOpenChange · control externo del estado.
 *   - photos · array de URLs (1+). Si vacío, no renderiza.
 *   - initialIndex · índice de partida al abrir (default 0).
 *   - title · línea principal arriba (ej. "Villa Serena").
 *   - subtitle · línea secundaria (ej. "Tipo 2A · 142 m²").
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageLightbox({
  open, onOpenChange, photos, initialIndex = 0, title, subtitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: string[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
}) {
  const [idx, setIdx] = useState(initialIndex);

  /* Sincroniza el índice cuando el consumidor cambia initialIndex
   *  al abrir (ej. click en thumbnail #3). */
  useEffect(() => {
    if (open) setIdx(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open || photos.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx(i => (i - 1 + photos.length) % photos.length);
      else if (e.key === "ArrowRight") setIdx(i => (i + 1) % photos.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, photos.length]);

  if (photos.length === 0) return null;

  const goPrev = () => setIdx(i => (i - 1 + photos.length) % photos.length);
  const goNext = () => setIdx(i => (i + 1) % photos.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-[100vw] w-screen h-screen sm:max-w-[100vw] sm:h-screen rounded-none border-0 bg-black/95 flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{title ?? "Galería de fotos"}</DialogTitle>
          <DialogDescription>
            {subtitle ?? `Imagen ${idx + 1} de ${photos.length}`}
          </DialogDescription>
        </DialogHeader>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 z-10">
          <div className="text-white min-w-0">
            {title && <p className="text-sm font-medium truncate">{title}{subtitle ? ` · ${subtitle}` : ""}</p>}
            <p className="text-[10px] text-white/60 tabular-nums">{idx + 1} de {photos.length}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        {/* Main image */}
        <div className="flex-1 flex items-center justify-center relative px-4 sm:px-12 min-h-0">
          <img
            key={idx}
            src={photos[idx]}
            alt={`Foto ${idx + 1}`}
            className="max-w-full max-h-full object-contain animate-in fade-in-0 zoom-in-95 duration-200"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Bottom thumbnails */}
        {photos.length > 1 && (
          <div className="px-5 py-4 overflow-x-auto shrink-0">
            <div className="flex gap-2 justify-center min-w-max">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "h-14 w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                    i === idx ? "border-white" : "border-transparent opacity-50 hover:opacity-100",
                  )}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
