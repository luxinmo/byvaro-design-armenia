/**
 * PromotionHero · cabecera visual de la ficha de promoción.
 *
 * Responsabilidades:
 *   1. Galería en mosaico 2×2 + hero grande (1 imagen principal + 4 thumbnails).
 *      El último thumbnail muestra un overlay "+N fotos" que (en el producto
 *      final) abriría un lightbox.
 *   2. Badge contextual en la imagen principal: "Alta demanda" · "Exclusiva" ·
 *      "Nueva", derivado de `promotion.badge`.
 *   3. Título de la promoción + código interno + ubicación + tipos de
 *      propiedad + promotor responsable.
 *   4. Barra de acciones del promotor: Compartir · Imprimir · Crear landing +
 *      toggle favorito.
 *
 * Props:
 *   - promotion: objeto `Promotion` (ver src/data/promotions.ts) con todos los
 *     datos ya cargados.
 *
 * Dependencias:
 *   - `@/data/promotions`  → tipo `Promotion` (shape de la promoción).
 *   - `@/components/ui/button` → primitiva Button Byvaro (pill por defecto tras
 *     la adaptación fase 2). Variantes usadas: `outline` + `ghost`.
 *   - `lucide-react`     → iconos (MapPin, Share2, Heart, Printer, ExternalLink).
 *
 * Tokens Byvaro usados (todos HSL en src/index.css):
 *   - bg-card / text-foreground / text-muted-foreground / border-border
 *   - bg-primary/10 text-primary (para badges "Nueva")
 *   - bg-destructive/10 text-destructive (para badges "Alta demanda")
 *   - bg-accent/10 text-accent-foreground (para badges "Exclusiva")
 *   - shadow-soft · rounded-2xl (panel galería) · rounded-full (pills)
 *
 * TODOs:
 *   - TODO(ui): lightbox al hacer click en cualquier imagen de la galería.
 *   - TODO(backend): endpoint GET /api/promociones/:id/gallery (5+ imágenes
 *     con metadata — alt, orden, tipo). Ahora mockeado con Unsplash.
 *   - TODO(feature): persistir favorito — POST /api/me/favorites/:id.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Promotion } from "@/data/promotions";
import { getPromoterDisplayName } from "@/lib/promotionRole";
import { getPropertyTypeLabel } from "@/lib/propertyTypes";
import { useCurrentUser } from "@/lib/currentUser";
import { developerHref } from "@/lib/developerNavigation";
import { MapPin, Share2, Heart, Printer, ExternalLink, ArrowUpRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/promotions/detail/ImageLightbox";

/**
 * Badges contextuales con tokens HSL Byvaro (no hex ni Tailwind crudos).
 * Los labels incluyen emojis ligeros — coherente con los badges del listado
 * `src/pages/Promociones.tsx` y las cards del microsite.
 */
const badgeStyles: Record<NonNullable<Promotion["badge"]>, string> = {
  hot: "bg-destructive/10 text-destructive border border-destructive/20",
  exclusive: "bg-accent/10 text-accent-foreground border border-accent/20",
  new: "bg-primary/10 text-primary border border-primary/20",
};

const badgeLabels: Record<NonNullable<Promotion["badge"]>, string> = {
  hot: "🔥 Alta demanda",
  exclusive: "⭐ Exclusiva",
  new: "✨ Nueva",
};

export function PromotionHero({ promotion: p }: { promotion: Promotion }) {
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  const promoterHref = developerHref(currentUser, { fromPromoId: p.id });
  // Mock de imágenes — en producción vendrán de `GET /api/promociones/:id/gallery`.
  const galleryImages = [
    p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&h=1000&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&h=800&fit=crop",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&h=800&fit=crop",
  ];

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const openLightbox = (i: number) => { setLightboxIdx(i); setLightboxOpen(true); };
  const hiddenCount = Math.max(0, galleryImages.length - 5);

  return (
    <div className="space-y-4">
      {/* ═════ Galería en mosaico ═════ */}
      <div className="relative">
        <div className="grid grid-cols-4 grid-rows-2 gap-1.5 h-[340px] rounded-2xl overflow-hidden shadow-soft">
          {/* Imagen principal: ocupa 2×2 */}
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden"
          >
            <img src={galleryImages[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            {p.badge && (
              <span
                className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-sm ${badgeStyles[p.badge]}`}
              >
                {badgeLabels[p.badge]}
              </span>
            )}
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
          </button>

          {/* 3 thumbnails intermedios */}
          {galleryImages.slice(1, 4).map((src, i) => (
            <button
              type="button"
              key={i}
              onClick={() => openLightbox(i + 1)}
              className="overflow-hidden cursor-pointer group"
            >
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </button>
          ))}

          {/* Último thumbnail con overlay "+N fotos" (solo si sobran) */}
          <button
            type="button"
            onClick={() => openLightbox(4)}
            className="relative overflow-hidden cursor-pointer group"
          >
            <img src={galleryImages[4]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            {hiddenCount > 0 && (
              <div className="absolute inset-0 bg-foreground/55 flex items-center justify-center">
                <span className="text-background text-xs font-semibold">+{hiddenCount} fotos</span>
              </div>
            )}
          </button>
        </div>

        {/* CTA flotante · "Ver todas las fotos" */}
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-background/95 backdrop-blur border border-border text-xs font-semibold text-foreground hover:bg-background shadow-soft-lg transition-colors"
        >
          <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
          Ver todas las fotos ({galleryImages.length})
        </button>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        photos={galleryImages}
        initialIndex={lightboxIdx}
        title={p.name}
        subtitle={p.location}
      />

      {/* ═════ Título + acciones ═════ */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
              {p.name}
            </h1>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 tnum">
              {p.code}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm">{p.location}, España</span>
            <span className="text-xs text-border">·</span>
            <span className="text-sm">{p.propertyTypes.map(getPropertyTypeLabel).join(", ")}</span>
          </div>
          {(() => {
            const promoter = getPromoterDisplayName(p);
            if (!promoter) return null;
            // Solo la agencia clica al promotor · el propio promotor no
            // se enlaza a sí mismo. El destino lo decide developerHref:
            // panel operativo si hay colaboración, ficha pública si no.
            return (
              <p className="text-xs text-muted-foreground mt-1">
                Desarrollado por{" "}
                {isAgencyUser ? (
                  <Link
                    to={promoterHref}
                    className="font-medium text-foreground inline-flex items-center gap-0.5 hover:underline underline-offset-2 group"
                  >
                    {promoter}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{promoter}</span>
                )}
              </p>
            );
          })()}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3 w-3" /> Compartir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Printer className="h-3 w-3" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ExternalLink className="h-3 w-3" /> Crear mi landing
          </Button>
          <Button variant="ghost" size="icon" aria-label="Añadir a favoritos">
            <Heart className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
