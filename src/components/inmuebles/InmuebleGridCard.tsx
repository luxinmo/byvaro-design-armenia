/**
 * InmuebleGridCard — Card vertical para vista cuadrícula del listado
 * `/inmuebles`. Foto protagonista (16:10), info debajo. Pensada para
 * 2-4 cards por fila en desktop (≥lg → 4 cols, sm → 2, móvil → 1).
 *
 * Compagina con `InmuebleListCard` (variante densa, horizontal). El
 * usuario alterna entre las dos con `<ViewToggle>` en el header.
 */

import { useNavigate } from "react-router-dom";
import {
  MapPin, BedDouble, Bath, Ruler, Camera, Star, Share2, MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/Tag";
import {
  type Inmueble,
  INMUEBLE_TYPE_LABEL,
  INMUEBLE_OPERATION_LABEL,
  INMUEBLE_STATUS_LABEL,
} from "@/data/inmuebles";
import { findTeamMember, getMemberAvatarUrl, memberInitials } from "@/lib/team";

type Props = {
  inmueble: Inmueble;
  onToggleFavorite?: (id: string) => void;
  onMore?: (id: string) => void;
};

function formatPrice(price: number, op: Inmueble["operation"]): string {
  const formatted = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(price);
  return op === "alquiler" || op === "alquiler-vacacional"
    ? `${formatted} € /mes`
    : `${formatted} €`;
}

function statusVariant(s: Inmueble["status"]): "success" | "warning" | "muted" | "danger" {
  switch (s) {
    case "disponible": return "success";
    case "reservado": return "warning";
    case "vendido":
    case "alquilado": return "muted";
    case "retirado": return "danger";
  }
}

export function InmuebleGridCard({ inmueble: i, onToggleFavorite, onMore }: Props) {
  const navigate = useNavigate();
  const owner = i.ownerMemberId ? findTeamMember(i.ownerMemberId) : undefined;
  const photo = i.photos[0];

  const handleOpen = () => navigate(`/inmuebles/${i.id}`);

  return (
    <article
      onClick={handleOpen}
      className="group flex flex-col rounded-2xl border border-border bg-card shadow-soft overflow-hidden hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {/* ── Galería · 16:10 ── */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={`${INMUEBLE_TYPE_LABEL[i.type]} en ${i.city}`}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground">
            <Camera className="h-8 w-8" />
          </div>
        )}

        {/* gradiente para legibilidad de overlays inferiores */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

        {/* favorito · top-left */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(i.id);
          }}
          className={cn(
            "absolute top-3 left-3 h-8 w-8 rounded-full backdrop-blur-sm grid place-items-center transition-colors",
            i.isFavorite
              ? "bg-warning text-background"
              : "bg-background/85 text-muted-foreground hover:text-foreground hover:bg-background",
          )}
          aria-label={i.isFavorite ? "Quitar favorito" : "Marcar favorito"}
        >
          <Star className={cn("h-4 w-4", i.isFavorite && "fill-current")} strokeWidth={i.isFavorite ? 0 : 1.75} />
        </button>

        {/* operación · top-right · siempre visible, no depende del status */}
        <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-background/90 backdrop-blur-sm text-foreground text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 shadow-soft">
          {INMUEBLE_OPERATION_LABEL[i.operation]}
        </span>

        {/* contador de fotos · bottom-left */}
        {i.photos.length > 1 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-foreground/85 text-background text-[10px] font-medium px-2 py-0.5 backdrop-blur-sm">
            <Camera className="h-3 w-3" />
            {i.photos.length}
          </span>
        )}

        {/* precio + status · bottom-right */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <Tag variant={statusVariant(i.status)} size="sm" shape="pill" className="shadow-soft">
            {INMUEBLE_STATUS_LABEL[i.status]}
          </Tag>
          <span className="rounded-full bg-background/95 backdrop-blur-sm text-foreground tnum font-semibold text-sm px-3 py-1 shadow-soft">
            {formatPrice(i.price, i.operation)}
          </span>
        </div>
      </div>

      {/* ── Bloque info ── */}
      <div className="flex flex-col flex-1 p-4">
        {/* eyebrow */}
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
          <span className="text-foreground">{INMUEBLE_TYPE_LABEL[i.type]}</span>
          <span>·</span>
          <span className="tnum">Ref. {i.reference}</span>
        </div>

        {/* dirección */}
        <h3 className="text-sm font-semibold text-foreground leading-snug truncate mb-0.5">
          {i.address}
        </h3>
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-3">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{i.city}{i.branchLabel ? ` · ${i.branchLabel}` : ""}</span>
        </p>

        {/* specs · dos filas máx, ocultando vacíos */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
          {typeof i.bedrooms === "number" && i.bedrooms > 0 && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              <b className="text-foreground tnum font-semibold">{i.bedrooms}</b>
            </span>
          )}
          {typeof i.bathrooms === "number" && (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              <b className="text-foreground tnum font-semibold">{i.bathrooms}</b>
            </span>
          )}
          {typeof i.usefulArea === "number" && (
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              <b className="text-foreground tnum font-semibold">{i.usefulArea}</b> m²
            </span>
          )}
        </div>

        {/* descripción · 2 líneas */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {i.description}
        </p>

        {/* tags · máx 2 + chip "+N" si sobran */}
        {i.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {i.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted text-foreground text-[10px] font-medium px-2 py-0.5"
              >
                {t}
              </span>
            ))}
            {i.tags.length > 2 && (
              <span className="rounded-full bg-muted/60 text-muted-foreground text-[10px] font-medium px-2 py-0.5">
                +{i.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* footer · share + agent + more */}
        <div className="mt-auto pt-3 border-t border-border/60 flex items-center justify-between">
          {i.shareWithNetwork ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-success">
              <Share2 className="h-3 w-3" /> Red
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <Share2 className="h-3 w-3" /> Interno
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {owner && (
              <div title={owner.name}>
                {owner.avatarUrl ? (
                  <img
                    src={getMemberAvatarUrl(owner)}
                    alt={owner.name}
                    className="h-6 w-6 rounded-full object-cover ring-2 ring-card"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary/15 text-primary grid place-items-center text-[9px] font-semibold ring-2 ring-card">
                    {memberInitials(owner)}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMore?.(i.id);
              }}
              className="h-7 w-7 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Más acciones"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
