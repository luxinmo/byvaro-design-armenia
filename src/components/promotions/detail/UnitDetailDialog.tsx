/**
 * UnitDetailDialog · modal centrado ~1000px con toda la info de una
 * unidad.
 *
 * Estructura:
 *   · Sticky header: ref + status chip + idiomas del tour + X.
 *   · Body 2 columnas (md+): izq galería (foto principal + miniaturas
 *     + "Ver plano" / "Tour 360°"), der ficha (precio, specs, cliente
 *     si aplica, amenities de la unidad).
 *   · Sticky bottom bar: acción primaria (Reservar · Editar · Enviar
 *     por email · Iniciar compra) según status + panel de "Opciones"
 *     colapsable (idioma de la ficha, compartir, favoritos…).
 *
 * En móvil/tablet se apila en columnas con las acciones en el bottom
 * bar (mismo patrón que PriceListDialog/SendEmailDialog).
 */

import { useState } from "react";
import {
  X, MapPin, Bed, Bath, Compass, Waves, Calendar,
  Phone, Mail, Send, Pencil, FileText, Image as ImageIcon, Video,
  Play, Lock, Settings, Star, Share2, Download, ShoppingCart,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Unit } from "@/data/units";
import { cn, priceForDisplay, formatPrice } from "@/lib/utils";

interface UnitDetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: Unit | null;
  /** Lista ordenada de unidades para navegación ← → entre ellas. */
  siblings?: Unit[];
  onChangeUnit?: (unitId: string) => void;
  isCollaboratorView?: boolean;
}

const statusMeta: Record<Unit["status"], { label: string; chip: string; dot: string }> = {
  available: { label: "Disponible", chip: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
  reserved: { label: "Reservada", chip: "bg-amber-500/10 text-amber-700 border-amber-500/30", dot: "bg-amber-500" },
  sold: { label: "Vendida", chip: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  withdrawn: { label: "Retirada", chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/60" },
};

function getUnitDisplayId(u: Unit) {
  return u.publicId?.trim() || `${u.block} · ${u.floor === 0 ? "PB" : `P${u.floor}`} ${u.door}`;
}

export function UnitDetailDialog({
  open,
  onOpenChange,
  unit,
  siblings = [],
  onChangeUnit,
  isCollaboratorView = false,
}: UnitDetailDialogProps) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);

  if (!open || !unit) return null;

  const sc = statusMeta[unit.status];
  const pricePerM2 = unit.builtArea > 0 ? Math.round(unit.price / unit.builtArea) : 0;
  const displayId = getUnitDisplayId(unit);

  // Galería mock · 4 fotos seedeadas por el id de la unidad.
  const photos = [
    `https://picsum.photos/seed/${unit.id}-1/1200/800`,
    `https://picsum.photos/seed/${unit.id}-2/1200/800`,
    `https://picsum.photos/seed/${unit.id}-3/1200/800`,
    `https://picsum.photos/seed/${unit.id}-4/1200/800`,
  ];

  // Navegación entre siblings (misma promoción).
  const idx = siblings.findIndex((s) => s.id === unit.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const pricePerM2Label = unit.status === "available" && pricePerM2 > 0 ? `${formatPrice(pricePerM2)}/m²` : null;

  // Amenities mock derivados de los campos booleanos / valores del unit.
  const amenities = [
    ...(unit.hasPool ? [{ icon: Waves, label: "Piscina" }] : []),
    ...(unit.terrace > 0 ? [{ icon: Waves, label: `Terraza ${unit.terrace} m²` }] : []),
    ...(unit.garden > 0 ? [{ icon: Waves, label: `Jardín ${unit.garden} m²` }] : []),
    ...(unit.parcel > 0 ? [{ icon: Waves, label: `Parcela ${unit.parcel} m²` }] : []),
    ...(unit.floor >= 3 ? [{ icon: Waves, label: "Vistas despejadas" }] : []),
  ];

  const surfaces = [
    { label: "Construida", value: `${unit.builtArea} m²` },
    { label: "Útil", value: `${unit.usableArea} m²` },
    ...(unit.terrace > 0 ? [{ label: "Terraza", value: `${unit.terrace} m²` }] : []),
    ...(unit.parcel > 0 ? [{ label: "Parcela", value: `${unit.parcel} m²` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex lg:items-center lg:justify-center lg:p-4">
      {/* Backdrop */}
      <div
        className="hidden lg:block absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Shell · fullscreen móvil/tablet; modal centrado en lg+. */}
      <div className="relative w-full h-full lg:max-w-[1000px] lg:h-[92vh] bg-card lg:border lg:border-border lg:rounded-2xl lg:shadow-soft-lg overflow-hidden flex flex-col">
        {/* Header */}
        <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-5 border-b border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            {/* Navegación ← → entre unidades del mismo bloque */}
            {onChangeUnit && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={!prev}
                  onClick={() => prev && onChangeUnit(prev.id)}
                  className="h-8 w-8 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  aria-label="Unidad anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!next}
                  onClick={() => next && onChangeUnit(next.id)}
                  className="h-8 w-8 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  aria-label="Unidad siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground truncate">{displayId}</h2>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", sc.chip)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                  {sc.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {unit.type} · {unit.bedrooms} dorm · {unit.builtArea} m² · Ref {unit.ref}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body · 2 columnas (md+), 1 col (móvil) */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-0 md:gap-5 p-0 md:p-5">
            {/* Columna izquierda · galería */}
            <section className="md:rounded-2xl md:overflow-hidden md:bg-card md:border md:border-border">
              {/* Foto principal */}
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                <img src={photos[activePhoto]} alt="" className="w-full h-full object-cover" />
                {/* Overlays */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-background/90 backdrop-blur shadow-soft border", sc.chip)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                    {sc.label}
                  </span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                  <button className="h-8 px-3 rounded-full bg-background/90 backdrop-blur text-xs font-medium shadow-soft inline-flex items-center gap-1.5 hover:bg-background transition-colors">
                    <Play className="h-3 w-3" /> Tour 360°
                  </button>
                  <button className="h-8 px-3 rounded-full bg-background/90 backdrop-blur text-xs font-medium shadow-soft inline-flex items-center gap-1.5 hover:bg-background transition-colors">
                    <FileText className="h-3 w-3" /> Plano
                  </button>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-foreground/80 text-background">
                    <ImageIcon className="h-3 w-3" /> {activePhoto + 1} / {photos.length}
                  </span>
                </div>
              </div>
              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-1.5 p-3 bg-card">
                {photos.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={cn(
                      "aspect-[4/3] overflow-hidden rounded-[3px] transition-all",
                      i === activePhoto ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"
                    )}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </section>

            {/* Columna derecha · ficha técnica */}
            <section className="p-3 md:p-0 space-y-4">
              {/* Precio */}
              <div className="bg-card md:border md:border-border md:rounded-2xl md:shadow-soft p-4 md:p-5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Precio</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-[28px] font-bold tracking-tight text-foreground tabular-nums leading-none">
                    {priceForDisplay(unit)}
                  </p>
                  {pricePerM2Label && (
                    <span className="text-xs text-muted-foreground">· {pricePerM2Label}</span>
                  )}
                </div>
                {unit.status === "sold" && unit.clientName && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Vendida a <span className="text-foreground font-medium">{unit.clientName}</span>
                    {unit.agencyName && ` por ${unit.agencyName}`}
                    {unit.soldAt && ` · ${new Date(unit.soldAt).toLocaleDateString("es-ES")}`}
                  </p>
                )}
                {unit.status === "reserved" && unit.clientName && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Reservada para <span className="text-foreground font-medium">{unit.clientName}</span>
                    {unit.reservedAt && ` · ${new Date(unit.reservedAt).toLocaleDateString("es-ES")}`}
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="bg-card md:border md:border-border md:rounded-2xl md:shadow-soft p-4 md:p-5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Ficha técnica</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <SpecRow icon={Bed} label="Dormitorios" value={`${unit.bedrooms}`} />
                  <SpecRow icon={Bath} label="Baños" value={`${unit.bathrooms}`} />
                  <SpecRow icon={Compass} label="Orientación" value={unit.orientation} />
                  <SpecRow icon={MapPin} label="Planta" value={unit.floor === 0 ? "Planta baja" : `Planta ${unit.floor}`} />
                </div>
                <div className="h-px bg-border/60 my-4" />
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Superficies</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {surfaces.map((s) => (
                    <div key={s.label} className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground text-xs">{s.label}</span>
                      <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="bg-card md:border md:border-border md:rounded-2xl md:shadow-soft p-4 md:p-5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Características</p>
                  <div className="flex flex-wrap gap-1.5">
                    {amenities.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-foreground">
                        <a.icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Panel de opciones colapsable */}
        {optionsOpen && (
          <div className="shrink-0 border-t border-border bg-muted/30 px-3 sm:px-5 py-3 flex items-center gap-3 flex-wrap">
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted/60 transition-colors">
              <Star className="h-3 w-3" /> Marcar favorito
            </button>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted/60 transition-colors">
              <Share2 className="h-3 w-3" /> Compartir ficha
            </button>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted/60 transition-colors">
              <Download className="h-3 w-3" /> Descargar ficha
            </button>
            {!isCollaboratorView && unit.status === "available" && (
              <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted/60 transition-colors">
                <Lock className="h-3 w-3" /> Retirar del mercado
              </button>
            )}
          </div>
        )}

        {/* Bottom bar · acción primaria según status + opciones */}
        <div
          className="shrink-0 border-t border-border bg-card p-3 flex items-center gap-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="button"
            onClick={() => setOptionsOpen((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors",
              optionsOpen ? "bg-foreground text-background border-foreground" : "border-border text-foreground hover:bg-muted"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Opciones</span>
          </button>

          {!isCollaboratorView && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Editar</span>
            </button>
          )}

          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Mail className="h-4 w-4" /> <span className="hidden sm:inline">Enviar</span>
          </button>

          {/* Primary CTA según estado */}
          {unit.status === "available" ? (
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-soft"
            >
              <ShoppingCart className="h-4 w-4" />
              Reservar unidad
            </button>
          ) : unit.status === "reserved" ? (
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-soft"
            >
              <Send className="h-4 w-4" />
              Avisar colaboradores
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-muted text-muted-foreground text-sm font-semibold cursor-not-allowed"
            >
              {unit.status === "sold" ? "Unidad vendida" : "Sin acción"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-componentes ────────────────────────────────────────── */
function SpecRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bed;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}
