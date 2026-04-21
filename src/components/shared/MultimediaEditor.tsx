/**
 * MultimediaEditor · Editor visual compartido de fotos + vídeos.
 *
 * Usado desde:
 *   - Wizard Crear Promoción (MultimediaStep) con state.fotos / state.videos
 *   - Ficha de promoción (EditMultimediaDialog) adaptando string[]
 *
 * API única basada en los tipos canónicos FotoItem / VideoItem para que
 * ambos consumidores compartan UI, iconografía, categorías y flags.
 */

import { useState } from "react";
import {
  ImageIcon, Upload, Star, Lock, Unlock, Trash2, GripVertical,
  Youtube, Video, Eye, Plus, AlertTriangle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FotoItem, VideoItem, FotoCategoria } from "@/components/crear-promocion/types";

const fotoCategorias: { value: FotoCategoria; label: string }[] = [
  { value: "fachada", label: "Fachada" },
  { value: "cocina", label: "Cocina" },
  { value: "salon", label: "Salón" },
  { value: "dormitorio", label: "Dormitorio" },
  { value: "bano", label: "Baño" },
  { value: "jardin", label: "Jardín" },
  { value: "piscina", label: "Piscina" },
  { value: "vistas", label: "Vistas" },
  { value: "terraza", label: "Terraza" },
  { value: "zonas_comunes", label: "Zonas comunes" },
  { value: "parking", label: "Parking" },
  { value: "otra", label: "Otra" },
];

const mockUnsplashIds = [
  "1600585154340-be6161a56a0c", "1502672023488-70e25813eb80",
  "1564013799919-ab600027ffc6", "1501183638710-841dd1904471",
  "1600607687939-ce8a6c25118c", "1613490493576-7fde63acd811",
];

const inputBase =
  "rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

function ModalShell({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-soft-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MultimediaEditor({
  fotos,
  videos,
  onFotosChange,
  onVideosChange,
  showCollaborationWarning = false,
}: {
  fotos: FotoItem[];
  videos: VideoItem[];
  onFotosChange: (next: FotoItem[]) => void;
  onVideosChange: (next: VideoItem[]) => void;
  showCollaborationWarning?: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoType, setVideoType] = useState<"youtube" | "video" | "vimeo360">("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoNombre, setVideoNombre] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  /* ─── Fotos ─── */
  const addMockPhotos = () => {
    const base = fotos.length;
    const seeds = mockUnsplashIds.slice(0, 3);
    const newPhotos: FotoItem[] = seeds.map((seed, i) => ({
      id: `foto-${Date.now()}-${i}`,
      url: `https://images.unsplash.com/photo-${seed}?w=400&q=80`,
      nombre: `Imagen ${base + i + 1}`,
      categoria: "otra" as FotoCategoria,
      esPrincipal: base === 0 && i === 0,
      bloqueada: false,
      orden: base + i,
    }));
    onFotosChange([...fotos, ...newPhotos]);
    setUploadOpen(false);
  };

  const setPrincipal = (id: string) =>
    onFotosChange(fotos.map((f) => ({ ...f, esPrincipal: f.id === id })));
  const toggleLock = (id: string) =>
    onFotosChange(fotos.map((f) => (f.id === id ? { ...f, bloqueada: !f.bloqueada } : f)));
  const setCategoria = (id: string, cat: FotoCategoria) =>
    onFotosChange(fotos.map((f) => (f.id === id ? { ...f, categoria: cat } : f)));
  const removePhoto = (id: string) =>
    onFotosChange(fotos.filter((f) => f.id !== id));

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...fotos];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    onFotosChange(next.map((f, i) => ({ ...f, orden: i })));
    setDragIdx(idx);
  };

  /* ─── Videos ─── */
  const addVideo = () => {
    if (videoType !== "video" && !videoUrl) return;
    const newVideo: VideoItem = {
      id: `video-${Date.now()}`,
      tipo: videoType,
      url: videoUrl || "[archivo local]",
      nombre: videoNombre || (videoType === "youtube" ? "YouTube" : videoType === "vimeo360" ? "360° Vimeo" : "Video"),
    };
    onVideosChange([...videos, newVideo]);
    setVideoUrl("");
    setVideoNombre("");
    setVideoOpen(false);
  };

  const removeVideo = (id: string) => onVideosChange(videos.filter((v) => v.id !== id));

  return (
    <div className="flex flex-col gap-5">
      {showCollaborationWarning && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 flex gap-2 text-xs text-amber-700 leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>
            <strong>Importante:</strong> Si vas a compartir imágenes con agencias colaboradoras, asegúrate de no subir fotografías con marca de agua. Las imágenes bloqueadas no se exportarán.
          </span>
        </div>
      )}

      {/* ═════ FOTOGRAFÍAS ═════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Fotografías{fotos.length > 0 ? ` · ${fotos.length}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="h-3 w-3" strokeWidth={1.5} />
            Subir imágenes
          </button>
        </div>

        {fotos.length === 0 ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 flex flex-col items-center gap-2 text-center hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" strokeWidth={1} />
            <p className="text-sm font-medium text-muted-foreground">Arrastra fotos aquí o haz clic para subir</p>
            <p className="text-xs text-muted-foreground/60">JPG, PNG o WEBP · Máximo 10 MB por imagen</p>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fotos.map((foto, idx) => (
              <div
                key={foto.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => setDragIdx(null)}
                className={cn(
                  "group relative rounded-xl border bg-card overflow-hidden transition-all",
                  dragIdx === idx ? "border-primary shadow-soft-lg opacity-70" : "border-border",
                  foto.esPrincipal && "ring-2 ring-primary/40",
                )}
              >
                <div className="aspect-square bg-muted relative">
                  {foto.url ? (
                    <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
                    </div>
                  )}

                  <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-background/85 backdrop-blur-sm text-muted-foreground cursor-grab">
                      <GripVertical className="h-3 w-3" strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setPrincipal(foto.id)}
                      title={foto.esPrincipal ? "Imagen principal" : "Establecer como principal"}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-colors",
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
                        "flex h-6 w-6 items-center justify-center rounded-md backdrop-blur-sm transition-colors",
                        foto.bloqueada
                          ? "bg-destructive/80 text-destructive-foreground"
                          : "bg-background/85 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {foto.bloqueada ? <Lock className="h-3 w-3" strokeWidth={1.5} /> : <Unlock className="h-3 w-3" strokeWidth={1.5} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(foto.id)}
                      aria-label="Eliminar foto"
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>

                  {foto.esPrincipal && (
                    <div className="absolute bottom-1.5 left-1.5">
                      <span className="text-[9px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        PRINCIPAL
                      </span>
                    </div>
                  )}
                  {foto.bloqueada && (
                    <div className="absolute bottom-1.5 right-1.5">
                      <span className="text-[9px] font-semibold bg-destructive/80 text-destructive-foreground px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                        Bloqueada
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-2.5 py-2 flex flex-col gap-1">
                  <p className="text-xs font-medium text-foreground truncate">{foto.nombre}</p>
                  <select
                    value={foto.categoria}
                    onChange={(e) => setCategoria(foto.id, e.target.value as FotoCategoria)}
                    className="h-5 rounded border-none bg-transparent text-[10px] text-muted-foreground p-0 focus:outline-none cursor-pointer"
                  >
                    {fotoCategorias.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═════ VIDEOS ═════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Videos{videos.length > 0 ? ` · ${videos.length}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Añadir video
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground text-center">
            No se han añadido videos. Puedes añadir YouTube, subir video (hasta 300 MB) o 360° Vimeo.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {videos.map((vid) => (
              <div key={vid.id} className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                  {vid.tipo === "youtube" && <Youtube className="h-4 w-4" strokeWidth={1.5} />}
                  {vid.tipo === "video" && <Video className="h-4 w-4" strokeWidth={1.5} />}
                  {vid.tipo === "vimeo360" && <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{vid.nombre}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{vid.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeVideo(vid.id)}
                  aria-label="Eliminar video"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal subir fotos */}
      <ModalShell open={uploadOpen} onClose={() => setUploadOpen(false)} title="Subir fotografías">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex gap-2 text-xs text-amber-700 leading-relaxed">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>No subas imágenes con marca de agua si vas a compartirlas con colaboradores.</span>
          </div>
          <button
            type="button"
            onClick={addMockPhotos}
            className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 flex flex-col items-center gap-2 text-center hover:border-primary/40 hover:bg-muted/50 transition-colors"
          >
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1} />
            <p className="text-sm font-medium text-muted-foreground">Arrastra fotos aquí o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground/60">JPG, PNG o WEBP · Máximo 10 MB por imagen</p>
          </button>
        </div>
      </ModalShell>

      {/* Modal añadir video */}
      <ModalShell open={videoOpen} onClose={() => setVideoOpen(false)} title="Añadir video">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {([
              { value: "youtube" as const, label: "YouTube", icon: Youtube },
              { value: "video" as const, label: "Subir video", icon: Video },
              { value: "vimeo360" as const, label: "360° Vimeo", icon: Eye },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVideoType(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors flex-1 justify-center",
                  videoType === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {opt.label}
              </button>
            ))}
          </div>

          {videoType === "video" ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 flex flex-col items-center gap-2 text-center">
              <Video className="h-8 w-8 text-muted-foreground/40" strokeWidth={1} />
              <p className="text-xs font-medium text-muted-foreground">Arrastra un video o haz clic</p>
              <p className="text-[10px] text-muted-foreground/60">MP4 · Máximo 300 MB</p>
            </div>
          ) : (
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={videoType === "youtube" ? "https://youtube.com/watch?v=..." : "https://vimeo.com/..."}
              className={cn(inputBase, "h-9 px-3")}
            />
          )}

          <input
            value={videoNombre}
            onChange={(e) => setVideoNombre(e.target.value)}
            placeholder="Nombre del video (opcional)"
            className={cn(inputBase, "h-9 px-3")}
          />

          <button
            type="button"
            onClick={addVideo}
            disabled={videoType !== "video" && !videoUrl}
            className="inline-flex items-center justify-center h-9 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Añadir
          </button>
        </div>
      </ModalShell>
    </div>
  );
}

/* Helper para consumidores que trabajan con string[] de URLs (ficha legacy). */
export function urlsToFotoItems(urls: string[]): FotoItem[] {
  return urls.map((url, i) => ({
    id: `foto-legacy-${i}`,
    url,
    nombre: `Imagen ${i + 1}`,
    categoria: "otra",
    esPrincipal: i === 0,
    bloqueada: false,
    orden: i,
  }));
}

export function fotoItemsToUrls(items: FotoItem[]): string[] {
  return items.slice().sort((a, b) => a.orden - b.orden).map((f) => f.url);
}
