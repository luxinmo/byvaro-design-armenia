/**
 * UnitMultimediaModal · Modal por unidad para gestionar toda su
 * multimedia (fotos, vídeos, planos, documentos).
 *
 * 4 secciones colapsables:
 *   - Fotografías: toggle "heredar fotos de la promoción", grid de
 *     promo-fotos seleccionables (disabled-IDs en fotosUnidad[]),
 *     fotos propias con mock-add.
 *   - Vídeos: listado heredado de promoción (solo lectura) + propios
 *     añadibles por URL.
 *   - Planos: placeholder (herencia de promoción).
 *   - Documentos: brochure + memoria de calidades heredados.
 *
 * Port adaptado de figgy-friend-forge/src/components/create-promotion/
 * UnitMultimediaModal.tsx — sin shadcn Dialog, con modal ligero inline
 * de Byvaro y tokens HSL.
 */

import { useState } from "react";
import {
  X, Image as ImageIcon, Video, FileText, Upload, Check, Plus,
  ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FotoItem, VideoItem, UnitData } from "./types";

const inputBase =
  "rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

interface Props {
  open: boolean;
  onClose: () => void;
  unit: UnitData;
  promotionFotos: FotoItem[];
  promotionVideos: VideoItem[];
  onUpdate: (data: Partial<UnitData>) => void;
}

function Section({
  title, icon: Icon, count, children, defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 tnum">
            {count}
          </span>
        )}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export function UnitMultimediaModal({
  open, onClose, unit, promotionFotos, promotionVideos, onUpdate,
}: Props) {
  const [videoUrl, setVideoUrl] = useState("");

  if (!open) return null;

  /* ── Fotos ── */
  const togglePromocionFoto = (fotoId: string) => {
    const current = unit.fotosUnidad || [];
    const isDisabled = current.some((f) => f.id === `disabled-${fotoId}`);
    if (isDisabled) {
      onUpdate({ fotosUnidad: current.filter((f) => f.id !== `disabled-${fotoId}`) });
    } else {
      onUpdate({
        fotosUnidad: [
          ...current,
          { id: `disabled-${fotoId}`, url: "", nombre: "", categoria: "otra", esPrincipal: false, bloqueada: false, orden: 0 },
        ],
      });
    }
  };
  const isPromoFotoDisabled = (fotoId: string) =>
    (unit.fotosUnidad || []).some((f) => f.id === `disabled-${fotoId}`);

  const addMockUnitPhoto = () => {
    const newPhoto: FotoItem = {
      id: `unit-foto-${Date.now()}`,
      url: `https://picsum.photos/400/300?random=${Date.now()}`,
      nombre: `Foto unidad ${(unit.fotosUnidad || []).filter((f) => !f.id.startsWith("disabled-")).length + 1}`,
      categoria: "otra",
      esPrincipal: false,
      bloqueada: false,
      orden: (unit.fotosUnidad || []).length,
    };
    onUpdate({ fotosUnidad: [...(unit.fotosUnidad || []), newPhoto] });
  };

  const removeUnitPhoto = (id: string) => {
    onUpdate({ fotosUnidad: (unit.fotosUnidad || []).filter((f) => f.id !== id) });
  };

  const unitOnlyFotos = (unit.fotosUnidad || []).filter((f) => !f.id.startsWith("disabled-"));

  /* ── Videos ── */
  const addVideo = () => {
    if (!videoUrl) return;
    const newVideo: VideoItem = {
      id: `unit-video-${Date.now()}`,
      tipo: "youtube",
      url: videoUrl,
      nombre: videoUrl,
    };
    onUpdate({ videosUnidad: [...(unit.videosUnidad || []), newVideo] });
    setVideoUrl("");
  };

  const removeVideo = (id: string) => {
    onUpdate({ videosUnidad: (unit.videosUnidad || []).filter((v) => v.id !== id) });
  };

  const activePromoFotos = promotionFotos.filter((f) => !isPromoFotoDisabled(f.id)).length;
  const totalFotos = (unit.usarFotosPromocion ? activePromoFotos : 0) + unitOnlyFotos.length;
  const totalVideos = promotionVideos.length + (unit.videosUnidad || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl bg-card border border-border shadow-soft-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Multimedia — {unit.nombre}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestiona todas las fotos, vídeos, planos y documentos de esta unidad
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* ═════ FOTOS ═════ */}
          <Section title="Fotografías" icon={ImageIcon} count={totalFotos}>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Heredar fotos de la promoción</p>
                <button
                  type="button"
                  onClick={() => onUpdate({ usarFotosPromocion: !unit.usarFotosPromocion })}
                  className={cn(
                    "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                    unit.usarFotosPromocion
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {unit.usarFotosPromocion ? "Activado" : "Desactivado"}
                </button>
              </div>

              {unit.usarFotosPromocion && promotionFotos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                    Fotos de promoción · {activePromoFotos}/{promotionFotos.length} activas
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {promotionFotos.map((foto) => {
                      const disabled = isPromoFotoDisabled(foto.id);
                      return (
                        <button
                          key={foto.id}
                          type="button"
                          onClick={() => togglePromocionFoto(foto.id)}
                          className={cn(
                            "relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all",
                            disabled ? "border-border opacity-40 grayscale" : "border-primary",
                          )}
                        >
                          <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" loading="lazy" />
                          {!disabled && (
                            <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2} />
                            </div>
                          )}
                          {disabled && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <X className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  Fotos propias de la unidad · {unitOnlyFotos.length}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {unitOnlyFotos.map((foto) => (
                    <div
                      key={foto.id}
                      className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border group"
                    >
                      <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => removeUnitPhoto(foto.id)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Quitar foto"
                      >
                        <X className="h-3 w-3 text-destructive-foreground" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMockUnitPhoto}
                    className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Upload className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-[10px] font-medium">Subir</span>
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* ═════ VÍDEOS ═════ */}
          <Section title="Vídeos" icon={Video} count={totalVideos}>
            <div className="space-y-3">
              {promotionVideos.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                    De la promoción (heredados)
                  </p>
                  <div className="space-y-1.5">
                    {promotionVideos.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <Video className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        <span className="truncate flex-1">{v.nombre || v.url}</span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          Promoción
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  De la unidad
                </p>
                <div className="space-y-1.5">
                  {(unit.videosUnidad || []).map((v) => (
                    <div
                      key={v.id}
                      className="rounded-lg border border-border px-3 py-2 flex items-center gap-2 text-xs text-foreground"
                    >
                      <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <span className="truncate flex-1">{v.nombre || v.url}</span>
                      <button
                        type="button"
                        onClick={() => removeVideo(v.id)}
                        aria-label="Quitar video"
                        className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="URL de YouTube o Vimeo..."
                      className={cn(inputBase, "pl-8 h-8 w-full")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addVideo}
                    disabled={!videoUrl}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3 w-3" /> Añadir
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* ═════ PLANOS ═════ */}
          <Section title="Planos" icon={FileText} count={0} defaultOpen={false}>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 text-xs text-muted-foreground">
                Hereda planos de la promoción. Puedes subir planos específicos para esta unidad.
              </div>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border px-4 py-6 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                Subir planos de la unidad
              </button>
            </div>
          </Section>

          {/* ═════ DOCUMENTOS ═════ */}
          <Section title="Documentos" icon={FileText} count={2} defaultOpen={false}>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 text-xs text-muted-foreground">
                Brochure y memoria de calidades. Hereda de la promoción o sube documentos específicos.
              </div>
              <div className="space-y-2">
                {[
                  { title: "Brochure", subtitle: "Heredado de la promoción" },
                  { title: "Memoria de calidades", subtitle: "Heredado de la promoción" },
                ].map((d) => (
                  <div key={d.title} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">{d.title}</p>
                      <p className="text-[10px] text-muted-foreground">{d.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Upload className="h-3 w-3" /> Sustituir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors shadow-soft"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
