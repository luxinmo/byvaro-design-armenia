/**
 * ImageCropModal · editor de foto con zoom + recorte + shape selector.
 *
 * Inspirado en el modal "Editar foto" estilo LinkedIn / Slack:
 *   - Imagen en un contenedor con overlay de recorte (círculo o
 *     rectángulo según `shape`).
 *   - Slider inferior para zoom (1x–3x).
 *   - Drag (mouse/touch) para reposicionar.
 *   - Botones: "Cambiar foto" (abre file picker) · "Eliminar" · "Aplicar".
 *   - Para logo: toggle de forma redondo / cuadrado (persistido en
 *     empresa.logoShape).
 *   - Al aplicar: se genera un dataURL recortado al tamaño de salida
 *     configurado (512x512 para logo, 1200x500 para cover).
 *
 * Implementación pura HTML5 canvas + transforms CSS, sin libs extras.
 */

import { useEffect, useRef, useState } from "react";
import {
  X, ZoomIn, ZoomOut, Move, Check, Trash2, Upload, Circle, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CropShape = "circle" | "square" | "rectangle";
export interface CropParams { zoom: number; posX: number; posY: number }

interface Props {
  open: boolean;
  onClose: () => void;
  /** Callback de aplicar · devuelve la imagen recortada lista para
   *  mostrar (`croppedDataUrl`), la imagen ORIGINAL sin recortar
   *  (`sourceDataUrl`) y los parámetros del crop · al volver a abrir
   *  con esos datos el modal restaura exactamente el encuadre. */
  onApply: (croppedDataUrl: string, sourceDataUrl: string, crop: CropParams) => void;
  onRemove?: () => void;
  initialImage?: string;                            // dataURL o URL
  /** Imagen original (sin recortar) si existe · si la pasas, se usa
   *  como punto de partida en lugar de `initialImage`. */
  initialSource?: string;
  /** Crop guardado · zoom + posX + posY · usado para restaurar la
   *  vista al volver a abrir el editor. */
  initialCrop?: CropParams;
  shape: CropShape;                                 // recorte inicial
  allowShapeSwitch?: boolean;                       // solo para logo
  onShapeChange?: (shape: "circle" | "square") => void;
  title?: string;
  outputSize?: { width: number; height: number };   // tamaño canvas salida
  aspectRatio?: number;                             // para shape=rectangle (w/h)
}

export function ImageCropModal({
  open, onClose, onApply, onRemove, initialImage, initialSource, initialCrop,
  shape, allowShapeSwitch, onShapeChange,
  title = "Editar foto",
  outputSize = { width: 512, height: 512 },
  aspectRatio = 1,
}: Props) {
  /* Imagen ORIGINAL · es la fuente de verdad para reabrir y reajustar.
   * Si el padre pasó `initialSource` la usamos; si no, caemos a
   * `initialImage` (legacy o URL externa donde no separamos source y
   * crop · el comportamiento es el mismo que antes). */
  const [imgSrc, setImgSrc] = useState<string | undefined>(initialSource ?? initialImage);
  const [currentShape, setCurrentShape] = useState<CropShape>(shape);
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [position, setPosition] = useState({
    x: initialCrop?.posX ?? 0,
    y: initialCrop?.posY ?? 0,
  });
  const [dragging, setDragging] = useState(false);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; startX: number; startY: number }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /* Reset solo al abrir el modal · NO en cada cambio de `initialImage`
   * o `shape`. Antes el efecto se disparaba al togglear redondo↔cuadrado
   * (porque `shape` viaja por el padre vía `update("logoShape", …)`),
   * y machacaba `imgSrc` con `initialImage` perdiendo la foto recién
   * subida. Ahora el toggle de forma solo cambia el overlay del recorte;
   * la imagen y posición permanecen intactas hasta que el usuario
   * pulse Aplicar / Eliminar / Cerrar. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setImgSrc(initialSource ?? initialImage);
      setCurrentShape(shape);
      setZoom(initialCrop?.zoom ?? 1);
      setPosition({ x: initialCrop?.posX ?? 0, y: initialCrop?.posY ?? 0 });
    }
    wasOpen.current = open;
  }, [open, initialImage, initialSource, initialCrop, shape]);

  /* Dimensiones naturales de la imagen */
  useEffect(() => {
    if (!imgSrc) { setImgDims(null); return; }
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imgSrc;
  }, [imgSrc]);

  /* ESC para cerrar */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isRectangle = currentShape === "rectangle";
  const innerPadding = 24 * 2; /* `px-6` a cada lado */
  /* Ancho del modal · 560 para circle/square · más ancho para
   * rectangle (cover) para dejar holgura alrededor del recorte. */
  const modalMaxWidth = isRectangle ? 900 : 560;
  const maxContentWidth = modalMaxWidth - innerPadding;
  /* `containerWidth × containerHeight` es el espacio VISIBLE de la
   * imagen — el usuario ve toda la imagen aquí y puede arrastrarla.
   * `cropW × cropH` es el RECORTE real (lo que se guarda) · queda
   * centrado dentro del contenedor con margen oscurecido alrededor.
   * Para circle/square el recorte coincide con el contenedor (no hay
   * margen visible) · para rectangle dejamos margen para que el
   * usuario vea el "antes y después". */
  let containerWidth: number;
  let containerHeight: number;
  let cropW: number;
  let cropH: number;
  if (isRectangle) {
    containerWidth = maxContentWidth;     // 852
    containerHeight = 320;                // alto generoso para arrastrar
    /* Recorte: ocupa el ancho con un margen de 50px a cada lado,
     * altura derivada del aspect ratio. Si no cabe verticalmente,
     * recalcula desde la altura. */
    const horizMargin = 50;
    cropW = containerWidth - 2 * horizMargin;
    cropH = cropW / aspectRatio;
    const maxCropH = containerHeight - 2 * 40;
    if (cropH > maxCropH) {
      cropH = maxCropH;
      cropW = cropH * aspectRatio;
    }
  } else {
    const desired = 340;
    containerWidth = Math.min(desired, maxContentWidth);
    containerHeight = containerWidth;
    cropW = containerWidth;
    cropH = containerHeight;
  }
  const cropLeft = (containerWidth - cropW) / 2;
  const cropTop = (containerHeight - cropH) / 2;

  /* ─── Drag handlers ─── */
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, startX: position.x, startY: position.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    setPosition({
      x: dragStart.current.startX + (e.clientX - dragStart.current.x),
      y: dragStart.current.startY + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => { setDragging(false); dragStart.current = undefined; };

  /* ─── Touch handlers ─── */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX, y: t.clientY, startX: position.x, startY: position.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !dragStart.current) return;
    const t = e.touches[0];
    setPosition({
      x: dragStart.current.startX + (t.clientX - dragStart.current.x),
      y: dragStart.current.startY + (t.clientY - dragStart.current.y),
    });
  };

  /* ─── File upload ─── */
  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(f);
  };

  /* ─── Apply: render a canvas y devolver dataURL ───
   * Se devuelve TANTO la imagen recortada lista para mostrar como la
   * imagen ORIGINAL sin recortar (`imgSrc`) y los parámetros de
   * recorte. Así el padre puede persistir las tres cosas y, al
   * reabrir el editor, restaurar exactamente el encuadre · el usuario
   * puede reajustar sin perder material. */
  const handleApply = () => {
    if (!imgSrc || !imgDims || !containerRef.current) return;
    const canvas = document.createElement("canvas");
    const outW = isRectangle ? outputSize.width : 512;
    const outH = isRectangle ? outputSize.height : 512;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      /* Escala efectiva (image source → display): cover relativo al
       * CONTENEDOR (la imagen llena el espacio visible) por el zoom. */
      const scaleCover = Math.max(containerWidth / img.width, containerHeight / img.height);
      const scale = scaleCover * zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const imgLeft = (containerWidth - drawW) / 2 + position.x;
      const imgTop = (containerHeight - drawH) / 2 + position.y;

      /* Origen en coords de imagen del RECORTE (no del contenedor).
       * Para circle/square el recorte coincide con el contenedor (cropLeft=0). */
      const srcX = (cropLeft - imgLeft) / scale;
      const srcY = (cropTop - imgTop) / scale;
      const srcW = cropW / scale;
      const srcH = cropH / scale;

      if (currentShape === "circle") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      if (currentShape === "circle") ctx.restore();

      const croppedDataUrl = canvas.toDataURL("image/png", 0.92);
      onApply(croppedDataUrl, imgSrc!, { zoom, posX: position.x, posY: position.y });
      onClose();
    };
    img.src = imgSrc;
  };

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        className="bg-card rounded-2xl border border-border shadow-lg w-full flex flex-col"
        style={{ maxWidth: modalMaxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            {allowShapeSwitch && (
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentShape("circle");
                    onShapeChange?.("circle");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
                    currentShape === "circle"
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Circle className="h-3 w-3" /> Redondo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentShape("square");
                    onShapeChange?.("square");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
                    currentShape === "square"
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Square className="h-3 w-3" /> Cuadrado
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors grid place-items-center"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Canvas container */}
        <div className="px-6 pt-5 pb-3">
          {!imgSrc ? (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors"
              style={{ height: containerHeight }}
            >
              <Upload className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-[13px] font-semibold text-foreground">Subir una foto</span>
              <span className="text-[11px] text-muted-foreground">PNG, JPG o WebP · máx. 5 MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          ) : (
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-2xl bg-black/80 mx-auto select-none"
              style={{ height: containerHeight, width: containerWidth, cursor: dragging ? "grabbing" : "grab" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onMouseUp}
            >
              {/* Imagen · CRÍTICO: w-full h-full + object-cover.
                  Antes era `minWidth/minHeight: 100%` con `max: none`
                  · eso renderiza la imagen a su tamaño natural cuando
                  era más grande que el contenedor, NO a cover.
                  Resultado: lo visible en el modal NO coincidía con
                  lo que el canvas en `handleApply` sampleaba (que
                  asume cover-scaling). Con `w-full h-full
                  object-cover` el box siempre mide igual que el
                  contenedor y el contenido se cover-escala dentro,
                  igual que el canvas · WYSIWYG. */}
              <img
                src={imgSrc}
                alt=""
                draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                  objectFit: "cover",
                }}
              />
              {/* Overlay oscurece las zonas FUERA del recorte. Para
                  rectangle: 4 bandas (top/bottom/left/right) · para
                  circle: radial gradient · para square: nada (el
                  recorte ocupa todo el contenedor). Lo que el usuario
                  ve dentro del rectángulo discontinuo es exactamente
                  lo que se guarda. */}
              {currentShape === "rectangle" && (
                <>
                  <div className="absolute pointer-events-none bg-black/55" style={{ left: 0, right: 0, top: 0, height: cropTop }} />
                  <div className="absolute pointer-events-none bg-black/55" style={{ left: 0, right: 0, bottom: 0, height: cropTop }} />
                  <div className="absolute pointer-events-none bg-black/55" style={{ left: 0, top: cropTop, width: cropLeft, height: cropH }} />
                  <div className="absolute pointer-events-none bg-black/55" style={{ right: 0, top: cropTop, width: cropLeft, height: cropH }} />
                </>
              )}
              {currentShape === "circle" && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at center, transparent 0 calc(${Math.min(cropW, cropH) / 2}px - 1px), rgba(0,0,0,0.55) calc(${Math.min(cropW, cropH) / 2}px))`,
                  }}
                />
              )}
              {/* Guía de recorte · marca el área que se guardará. */}
              <div
                className={cn(
                  "absolute pointer-events-none border-[2px] border-dashed border-white/90",
                  currentShape === "circle" ? "rounded-full" : "rounded-xl",
                )}
                style={{
                  left: cropLeft,
                  top: cropTop,
                  width: cropW,
                  height: cropH,
                }}
              />
              {/* Icono drag centro abajo */}
              <div className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-white/80 text-foreground grid place-items-center pointer-events-none shadow-soft">
                <Move className="h-3.5 w-3.5" />
              </div>
            </div>
          )}
        </div>

        {/* Zoom slider · zoom mínimo = 1 (cover · la imagen siempre
            llena el recorte sin huecos transparentes). Zoom máximo 3.
            Para "ver menos zoom" el usuario reposiciona arrastrando ·
            con cover el recorte siempre captura algo, no hay zonas
            vacías. */}
        {imgSrc && (
          <div className="px-6 py-3 flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full bg-muted accent-primary"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[12.5px] font-semibold text-primary hover:underline"
          >
            Cambiar foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="flex items-center gap-2">
            {onRemove && imgSrc && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-[12.5px] font-semibold text-destructive hover:bg-destructive/5 rounded-full transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={!imgSrc}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
