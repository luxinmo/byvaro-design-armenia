/**
 * InmuebleListCard — Card horizontal del listado `/inmuebles`.
 *
 * Composición canónica Byvaro: foto + bloque central + rail de
 * acciones a la derecha. Reactiva a hover (eleva 2px + sombra).
 * Mobile-first: en <sm> apila la foto encima del contenido y mueve
 * el rail de acciones a esquina superior derecha de la foto.
 *
 * Estados visuales del chip de status:
 *   · disponible → Tag success
 *   · reservado  → Tag warning
 *   · vendido / alquilado → Tag muted
 *   · retirado   → Tag danger
 */

import { useNavigate } from "react-router-dom";
import {
  MapPin, BedDouble, Bath, Ruler, Square, Building2, Camera, Star,
  Share2, Plus, MoreVertical,
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
  const formatted = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(price);
  if (op === "alquiler" || op === "alquiler-vacacional") {
    return `${formatted} € /mes`;
  }
  return `${formatted} €`;
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

export function InmuebleListCard({ inmueble: i, onToggleFavorite, onMore }: Props) {
  const navigate = useNavigate();
  const owner = i.ownerMemberId ? findTeamMember(i.ownerMemberId) : undefined;
  const photo = i.photos[0];

  const handleOpen = () => navigate(`/inmuebles/${i.id}`);

  return (
    <article
      onClick={handleOpen}
      className="group rounded-2xl border border-border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">

        {/* ── Galería ── */}
        <div className="relative shrink-0 w-full sm:w-48 h-44 sm:h-36 rounded-xl overflow-hidden bg-muted">
          {photo ? (
            <img
              src={photo}
              alt={`${INMUEBLE_TYPE_LABEL[i.type]} en ${i.city}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              <Camera className="h-6 w-6" />
            </div>
          )}
          {i.photos.length > 1 && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-foreground/85 text-background text-[10px] font-medium px-2 py-0.5 backdrop-blur-sm">
              <Camera className="h-3 w-3" />
              {i.photos.length}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(i.id);
            }}
            className={cn(
              "absolute top-2 right-2 h-7 w-7 rounded-full backdrop-blur-sm grid place-items-center transition-colors",
              i.isFavorite
                ? "bg-warning text-background"
                : "bg-background/85 text-muted-foreground hover:text-foreground hover:bg-background",
            )}
            aria-label={i.isFavorite ? "Quitar favorito" : "Marcar favorito"}
          >
            <Star
              className={cn("h-3.5 w-3.5", i.isFavorite && "fill-current")}
              strokeWidth={i.isFavorite ? 0 : 1.75}
            />
          </button>
        </div>

        {/* ── Bloque central ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
            <span className="text-foreground">
              {INMUEBLE_TYPE_LABEL[i.type]} · {INMUEBLE_OPERATION_LABEL[i.operation]}
            </span>
            <span>·</span>
            <span className="tnum">Ref. {i.reference}</span>
          </div>

          {/* Precio + estado */}
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="text-[19px] font-semibold text-foreground tnum leading-tight">
              {formatPrice(i.price, i.operation)}
            </h3>
            <Tag variant={statusVariant(i.status)} size="sm" shape="pill">
              {INMUEBLE_STATUS_LABEL[i.status]}
            </Tag>
          </div>

          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mb-3">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{i.address}, {i.city}</span>
          </p>

          {/* Specs */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-2.5">
            {typeof i.bedrooms === "number" && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" />
                <b className="text-foreground tnum font-semibold">{i.bedrooms}</b> hab
              </span>
            )}
            {typeof i.bathrooms === "number" && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5" />
                <b className="text-foreground tnum font-semibold">{i.bathrooms}</b> baños
              </span>
            )}
            {typeof i.usefulArea === "number" && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                <b className="text-foreground tnum font-semibold">{i.usefulArea}</b> m² útiles
              </span>
            )}
            {typeof i.builtArea === "number" && (
              <span className="inline-flex items-center gap-1">
                <Square className="h-3.5 w-3.5" />
                <b className="text-foreground tnum font-semibold">{i.builtArea}</b> m² const.
              </span>
            )}
            {i.branchLabel && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {i.branchLabel}
              </span>
            )}
          </div>

          {/* Descripción */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {i.description}
          </p>

          {/* Footer · tags + colab */}
          <div className="mt-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {i.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted text-foreground text-[11px] font-medium px-2 py-0.5"
                >
                  {t}
                </span>
              ))}
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" /> Etiqueta
              </button>
            </div>
            {i.shareWithNetwork ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success">
                <Share2 className="h-3 w-3" />
                Compartido con la red
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Share2 className="h-3 w-3" />
                Uso interno
              </span>
            )}
          </div>
        </div>

        {/* ── Rail de acciones (desktop) ── */}
        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMore?.(i.id);
            }}
            className="h-8 w-8 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Más acciones"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {owner && (
            <div title={owner.name}>
              {owner.avatarUrl ? (
                <img
                  src={getMemberAvatarUrl(owner)}
                  alt={owner.name}
                  className="h-7 w-7 rounded-full object-cover ring-2 ring-card"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary grid place-items-center text-[10px] font-semibold ring-2 ring-card">
                  {memberInitials(owner)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
