/**
 * PhotoCropModal · subir + recortar foto de perfil (avatar).
 *
 * Flujo:
 *   1. Usuario abre el modal y o bien sube un archivo o trabaja sobre
 *      la imagen existente.
 *   2. Ajusta zoom (slider nativo) y posiciona arrastrando con el ratón.
 *   3. Al confirmar, renderizamos la sección visible en un canvas 512×512
 *      y devolvemos el data URL (JPEG) al padre.
 *
 * Decisiones de diseño:
 *   - No usamos `<Slider>` Radix — con un `input[type=range]` nativo
 *     con estilo Tailwind se consigue el mismo UX y evita dependencia.
 *   - La máscara circular se implementa con SVG + `<mask>` (overlay
 *     oscuro con hueco circular + stroke punteado).
 *   - El resultado se codifica a data URL (JPEG q=0.92). Pensado para
 *     avatares: <200 KB tras recorte 512×512.
 *   - Tokens del proyecto: rounded-2xl paneles · rounded-xl inner ·
 *     rounded-full pills · text-muted-foreground / text-primary / etc.
 *
 * TODO(backend): cuando haya storage (Vercel Blob / S3), añadir prop
 *   `onUpload(file) → URL` y guardar la URL en vez del data URL.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Check, Move, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  /** Avatar actual (para editarlo en vez de subir nuevo). */
  currentImage?: string;
};

/** Tamaño del canvas de salida · potencia de 2 para cacheo + nitidez razonable. */
const OUTPUT_SIZE = 512;
/** Tamaño del viewport del preview (pixeles CSS) · el SVG-máscara encaja aquí. */
const VIEWPORT_SIZE = 360;

export function PhotoCropModal({ open, onClose, onSave, currentImage }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(currentImage ?? null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) {
      setImageSrc(currentImage ?? null);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    }
  }, [open, currentImage]);

  /* ─── Input de archivo ─── */
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  /* ─── Drag para reposicionar ─── */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
  }, [pos]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);
  const stopDrag = useCallback(() => setDragging(false), []);

  /* ─── Drag táctil (móvil) ─── */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    setDragging(true);
    dragStart.current = { x: t.clientX, y: t.clientY };
    posStart.current = { ...pos };
  }, [pos]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    if (!t) return;
    setPos({
      x: posStart.current.x + (t.clientX - dragStart.current.x),
      y: posStart.current.y + (t.clientY - dragStart.current.y),
    });
  }, [dragging]);

  /* ─── Confirmar: rasterizar a un canvas circular 512×512 ─── */
  const applyCrop = () => {
    const img = imgRef.current;
    if (!img || !imageSrc) {
      onSave("");
      onClose();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* La imagen del preview está a `object-fit: cover` dentro del viewport,
     * escalada por `zoom` y trasladada por `pos`. Reproducimos la misma
     * transform en el canvas de salida, luego clippeamos con un círculo. */
    const scale = OUTPUT_SIZE / VIEWPORT_SIZE;
    ctx.save();
    /* Máscara circular */
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    /* Calcular el rect de object-fit: cover para luego aplicar pan/zoom */
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const ratio = Math.max(VIEWPORT_SIZE / iw, VIEWPORT_SIZE / ih);
    const drawW = iw * ratio * zoom;
    const drawH = ih * ratio * zoom;
    const drawX = (VIEWPORT_SIZE - drawW) / 2 + pos.x;
    const drawY = (VIEWPORT_SIZE - drawH) / 2 + pos.y;
    ctx.drawImage(img, drawX * scale, drawY * scale, drawW * scale, drawH * scale);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onSave(dataUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[440px] p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-sm font-bold">Editar foto de perfil</DialogTitle>
          <DialogDescription className="sr-only">Sube y ajusta tu foto de perfil</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Preview área con máscara circular */}
          <div
            className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-move select-none flex items-center justify-center bg-foreground/95"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, maxWidth: "100%" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={stopDrag}
          >
            {/* Máscara SVG circular */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <mask id="cropMask">
                    <rect width="400" height="400" fill="white" />
                    <circle cx="200" cy="200" r="160" fill="black" />
                  </mask>
                </defs>
                <rect width="400" height="400" fill="rgba(0,0,0,0.55)" mask="url(#cropMask)" />
                <circle cx="200" cy="200" r="160" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
            </div>

            {imageSrc ? (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Preview"
                className="absolute pointer-events-none"
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                draggable={false}
              />
            ) : (
              <div className="z-20 flex flex-col items-center gap-2 text-white/50 text-xs">
                <Camera className="h-8 w-8" />
                <span>Sube una foto para empezar</span>
              </div>
            )}

            {imageSrc && (
              <div className="absolute bottom-3 right-3 z-20 bg-card/80 backdrop-blur-sm rounded-full p-1.5">
                <Move className="h-3.5 w-3.5 text-foreground/70" />
              </div>
            )}
          </div>

          {/* Zoom slider */}
          {imageSrc && (
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className={cn(
                  "flex-1 h-1 rounded-full appearance-none bg-muted outline-none cursor-pointer",
                  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
                  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground",
                  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
                  "[&::-webkit-slider-thumb]:shadow-soft",
                )}
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-primary font-medium hover:underline"
            >
              {imageSrc ? "Cambiar archivo" : "Subir foto"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <div className="flex items-center gap-2">
              {imageSrc && (
                <button
                  type="button"
                  onClick={() => {
                    setImageSrc(null);
                    setZoom(1);
                    setPos({ x: 0, y: 0 });
                  }}
                  className="text-xs text-destructive font-medium hover:underline"
                >
                  Eliminar
                </button>
              )}
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                disabled={!imageSrc}
                onClick={applyCrop}
              >
                <Check className="h-3.5 w-3.5" /> Aplicar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
