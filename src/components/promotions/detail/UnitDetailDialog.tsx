import { useState, useMemo } from "react";
import { Unit, UnitStatus, PromotionContext } from "@/data/units";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bed, Bath, Maximize, Building2, Waves, Eye,
  ChevronLeft, ChevronRight, Download, Send, Pencil, Bookmark,
  FileText, Image as ImageIcon, Video, MapPin, Calendar,
  TreePine, Car, Package, Shield, Dumbbell,
  Sparkles, Share2, Heart, Award,
  Ruler,
} from "lucide-react";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";

import { formatPrice as sharedFormatPrice, priceForDisplay } from "@/lib/utils";

const formatPrice = sharedFormatPrice;

function getUnitDisplayId(unit: Pick<Unit, "publicId" | "floor" | "door">) {
  return unit.publicId?.trim() || `${unit.floor}º${unit.door}`;
}

// Tokens Byvaro (HSL) · excepción amber para "reservada" documentada en CLAUDE.md.
const statusConfig: Record<UnitStatus, { label: string; class: string; dotClass: string }> = {
  available: { label: "Disponible", class: "bg-primary/10 text-primary border-primary/20",            dotClass: "bg-primary" },
  reserved:  { label: "Reservada",  class: "bg-warning/10 text-warning border-warning/20",     dotClass: "bg-warning" },
  sold:      { label: "Vendida",    class: "bg-destructive/10 text-destructive border-destructive/20", dotClass: "bg-destructive" },
  withdrawn: { label: "Retirada",   class: "bg-muted text-muted-foreground border-border",            dotClass: "bg-muted-foreground/60" },
};

interface UnitDetailDialogProps {
  unit: Unit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCollaboratorView?: boolean;
  onEdit?: (unit: Unit) => void;
  onUpdateUnit?: (unitId: string, updates: Partial<Unit>) => void;
  /** Contexto heredado de la promoción · dirección, amenities, plan
   *  de pagos, descripción, certificado, año entrega. */
  promotionCtx?: PromotionContext;
}

export function UnitDetailDialog({ unit, open, onOpenChange, isCollaboratorView = false, onEdit, onUpdateUnit, promotionCtx }: UnitDetailDialogProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [sendOpen, setSendOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  /* ── Datos heredados de la promoción (con fallback a valores por
        defecto si no se inyecta contexto) ─────────────────────────── */
  const ctx: PromotionContext = promotionCtx ?? {};
  const city = ctx.ciudad ?? "—";
  const region = [ctx.provincia, ctx.pais].filter(Boolean).join(" · ") || "";
  const heritedDescription = ctx.descripcion ?? "";
  const heritedChars = ctx.caracteristicas ?? [];
  const heritedHitos = ctx.hitosPago ?? [];
  const heritedEnergyCert = ctx.energyCert ?? "";
  const heritedDeliveryYear = ctx.deliveryYear ?? "";
  const amenities = ctx.amenities ?? {};

  const update = (patch: Partial<Unit>) => {
    if (unit && onUpdateUnit) onUpdateUnit(unit.id, patch);
  };

  const photos = useMemo(() => {
    if (!unit) return [];
    return Array.from({ length: 10 }, (_, i) => `https://picsum.photos/seed/${unit.id}-${i}/1600/1000`);
  }, [unit]);

  if (!unit) return null;

  const sc = statusConfig[unit.status] ?? statusConfig.available;
  const pricePerM2 = Math.round(unit.price / unit.builtArea);
  const displayId = getUnitDisplayId(unit);
  const isUni = ["Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"].includes(unit.type);

  /* ── Valores finales · override > heredado ─────────────────────── */
  const effectiveDescription = unit.descripcionOverride ?? heritedDescription;
  const hasDescriptionOverride = unit.descripcionOverride !== undefined;
  const effectiveChars = unit.caracteristicasOverride ?? heritedChars;
  const hasCharsOverride = unit.caracteristicasOverride !== undefined;
  const effectiveHitos = unit.hitosPagoOverride ?? heritedHitos;
  const hasHitosOverride = unit.hitosPagoOverride !== undefined;
  const effectiveEnergyCert = unit.energyCertOverride ?? heritedEnergyCert;
  const effectiveDeliveryYear = unit.deliveryYearOverride ?? heritedDeliveryYear;

  /* Jardín y parcela son lo mismo en este modelo: se muestra un único
     campo "Parcela" para independientes / bajos. El campo `garden`
     legacy se suma al `parcel` si ambos > 0 (compat datos antiguos). */
  const parcelaTotal = (unit.parcel || 0) + (unit.garden || 0);

  const surfaces = [
    { label: "Construida", value: unit.builtArea, icon: Maximize },
    { label: "Útil", value: unit.usableArea, icon: Ruler },
    ...(unit.terrace > 0 ? [{ label: "Terraza", value: unit.terrace, icon: TreePine }] : []),
    ...(parcelaTotal > 0 ? [{ label: "Parcela", value: parcelaTotal, icon: MapPin }] : []),
  ];

  /* Plan de pagos · usa el heredado; si está vacío cae en el fallback
     estándar 10/20/40/30. Cada hito se formatea contra el precio de la
     unidad. */
  const paymentPlanBase = effectiveHitos.length > 0
    ? effectiveHitos.map((h, i) => ({
        label: h.descripcion || `Hito ${i + 1}`,
        percent: h.porcentaje,
        amount: unit.price * (h.porcentaje / 100),
        when: "",
      }))
    : [
        { label: "Reserva", percent: 10, amount: unit.price * 0.10, when: "A la firma" },
        { label: "Contrato", percent: 20, amount: unit.price * 0.20, when: "30 días" },
        { label: "Durante obra", percent: 40, amount: unit.price * 0.40, when: "Hitos de obra" },
        { label: "Entrega de llaves", percent: 30, amount: unit.price * 0.30, when: "Escritura" },
      ];
  const paymentPlan = paymentPlanBase;

  /* Exteriores reales derivados de flags (no inventados). */
  const exteriorFeatures = [
    ...(unit.hasPool ? [{ label: "Piscina privada", icon: Waves }] : []),
    ...(parcelaTotal > 0 ? [{ label: `Parcela ${parcelaTotal} m²`, icon: MapPin }] : []),
    { label: "Plaza de garaje", icon: Car },
    { label: "Trastero incluido", icon: Package },
  ];

  /* Comunes reales de la promoción. */
  const communityFeatures = [
    ...(amenities.piscinaComunitaria ? [{ label: "Piscina comunitaria", icon: Waves }] : []),
    ...(amenities.piscinaInterna ? [{ label: "Piscina interna", icon: Waves }] : []),
    ...(amenities.zonaSpa ? [{ label: "Zona SPA", icon: Sparkles }] : []),
    ...(amenities.zonaInfantil ? [{ label: "Zona infantil", icon: TreePine }] : []),
    ...(amenities.urbanizacionCerrada ? [{ label: "Urbanización cerrada", icon: Shield }] : []),
  ];

  const goPrev = () => setActiveIdx(i => (i - 1 + photos.length) % photos.length);
  const goNext = () => setActiveIdx(i => (i + 1) % photos.length);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 max-w-[1200px] w-[calc(100vw-32px)] h-[calc(100vh-48px)] sm:h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-background border border-border/40"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Ficha de {displayId}</DialogTitle>
            <DialogDescription>Detalle completo de la unidad {displayId}</DialogDescription>
          </DialogHeader>

          {/* Sticky header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm shrink-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                {sc.label}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground tracking-tight truncate">{displayId} · {unit.type}</h2>
                <p className="text-[10px] text-muted-foreground truncate">Ref: {unit.ref} · Residencial Vista Mar</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0 pr-8">
              {/* Edición · sólo para admin/promotor Y sólo si la unidad
                  no está vendida o retirada (el precio y los datos son
                  inmutables una vez cerrada la operación). */}
              {!isCollaboratorView && unit.status !== "sold" && unit.status !== "withdrawn" && (
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(v => !v)}
                  className="rounded-full h-8 text-xs gap-1.5 border-border/60"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {editMode ? "Listo" : "Editar"}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                <Heart className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              {unit.status === "available" && (
                <div className="text-right ml-2">
                  <p className="text-base font-bold text-foreground tabular-nums leading-none">{formatPrice(unit.price)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatPrice(pricePerM2)}/m²</p>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Edit mode banner */}
            {editMode && (
              <div className="px-5 sm:px-6 pt-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-warning">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="font-medium">Modo edición activo</span>
                    <span className="hidden sm:inline text-warning/70">· los cambios se guardan automáticamente al salir del campo</span>
                  </div>
                  <Button size="sm" onClick={() => setEditMode(false)} className="rounded-full h-7 text-[10px] px-3">
                    Listo
                  </Button>
                </div>
              </div>
            )}

            {/* HERO gallery — Airbnb style mosaic */}
            <div className="px-5 sm:px-6 pt-5">
              <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[280px] sm:h-[420px] rounded-2xl overflow-hidden">
                {/* Main photo */}
                <button
                  onClick={() => { setActiveIdx(0); setLightboxOpen(true); }}
                  className="col-span-4 sm:col-span-2 row-span-2 relative group overflow-hidden bg-muted"
                >
                  <img
                    src={photos[0]}
                    alt={`${displayId} principal`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-left text-white pointer-events-none">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium opacity-90 mb-1">
                      <Award className="h-3 w-3" strokeWidth={2} /> Edición exclusiva
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{unit.type} {displayId}</h1>
                    <p className="text-[11px] sm:text-xs opacity-90 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" strokeWidth={1.5} /> {city}{region && `, ${region.split(" · ")[0]}`}
                    </p>
                  </div>
                </button>

                {/* 4 secondary photos */}
                {photos.slice(1, 5).map((p, i) => (
                  <div key={i} className="hidden sm:block relative group overflow-hidden bg-muted">
                    <button
                      onClick={() => { setActiveIdx(i + 1); setLightboxOpen(true); }}
                      className="block w-full h-full"
                    >
                      <img
                        src={p}
                        alt={`${displayId} foto ${i + 2}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </button>
                    {editMode && (
                      <button
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                        aria-label="Eliminar foto"
                      >
                        <span className="text-base leading-none">×</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Action bar under gallery */}
              <div className="flex items-center justify-between mt-3 mb-4">
                <button
                  onClick={() => { setActiveIdx(0); setLightboxOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-card border border-border/60 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                >
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Ver todas las fotos ({photos.length})
                </button>
                <div className="hidden sm:flex items-center gap-2">
                  {editMode && (
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                      <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.5} /> Subir fotos
                    </button>
                  )}
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                    <Video className="h-3.5 w-3.5" strokeWidth={1.5} /> Vídeo
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Tour 360°
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> Mapa
                  </button>
                </div>
              </div>
            </div>

            {/* Quick highlights bar */}
            <div className="px-5 sm:px-6 py-4 border-b border-border/40 bg-card">
              <div className="grid grid-cols-3 gap-3 max-w-2xl">
                <Highlight icon={Bed} value={String(unit.bedrooms)} label="Dormitorios"
                  editMode={editMode} type="number" onChange={(v) => update({ bedrooms: Number(v) || 0 })} />
                <Highlight icon={Bath} value={String(unit.bathrooms)} label="Baños"
                  editMode={editMode} type="number" onChange={(v) => update({ bathrooms: Number(v) || 0 })} />
                <Highlight
                  icon={isUni ? MapPin : Building2}
                  value={isUni ? String(unit.parcel) : String(unit.floor)}
                  suffix={isUni ? "m²" : "ª"}
                  label={isUni ? "Parcela" : "Planta"}
                  editMode={editMode}
                  type="number"
                  onChange={(v) => update(isUni ? { parcel: Number(v) || 0 } : { floor: Number(v) || 0 })}
                />
              </div>
            </div>

            {/* Content grid */}
            <div className="px-5 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
              {/* LEFT: details */}
              <div className="space-y-8 min-w-0">
                {/* Description · heredada de la promoción con override por unidad */}
                <Section
                  title="Sobre esta vivienda"
                  subtitle="Descripción"
                  right={
                    !isCollaboratorView && editMode ? (
                      hasDescriptionOverride ? (
                        <button
                          type="button"
                          onClick={() => update({ descripcionOverride: undefined })}
                          className="text-[10px] text-primary font-medium hover:underline"
                        >
                          Restablecer a la de la promoción
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => update({ descripcionOverride: heritedDescription || "" })}
                          className="text-[10px] text-primary font-medium hover:underline"
                        >
                          Personalizar para esta unidad
                        </button>
                      )
                    ) : undefined
                  }
                >
                  {editMode && hasDescriptionOverride ? (
                    <textarea
                      value={unit.descripcionOverride ?? ""}
                      onChange={(e) => update({ descripcionOverride: e.target.value })}
                      rows={6}
                      className="w-full text-sm text-foreground/85 leading-relaxed bg-muted/30 rounded-xl border border-border/40 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      placeholder="Descripción personalizada de la vivienda..."
                    />
                  ) : (
                    <div className="space-y-3 text-sm text-foreground/85 leading-relaxed">
                      {effectiveDescription ? (
                        <p className="whitespace-pre-line">{effectiveDescription}</p>
                      ) : (
                        <p className="text-muted-foreground/70 italic">
                          Sin descripción todavía · añade una en el paso "Descripción" de la promoción o personalízala aquí.
                        </p>
                      )}
                      {hasDescriptionOverride && !editMode && (
                        <p className="text-[10px] text-primary">✓ Descripción personalizada para esta unidad</p>
                      )}
                    </div>
                  )}
                </Section>

                {/* Surfaces · jardín y parcela unificados en un solo campo */}
                <Section title="Superficies" subtitle="Distribución">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <SurfaceCard label="Construida" value={unit.builtArea} icon={Maximize}
                      editMode={editMode} onChange={(v) => update({ builtArea: v })} />
                    <SurfaceCard label="Útil" value={unit.usableArea} icon={Ruler}
                      editMode={editMode} onChange={(v) => update({ usableArea: v })} />
                    <SurfaceCard label="Terraza" value={unit.terrace} icon={TreePine}
                      editMode={editMode} onChange={(v) => update({ terrace: v })} hideIfZero={!editMode} />
                    <SurfaceCard label="Parcela / Jardín" value={parcelaTotal} icon={MapPin}
                      editMode={editMode} onChange={(v) => update({ parcel: v, garden: 0 })} hideIfZero={!editMode} />
                  </div>
                </Section>

                {/* Technical details */}
                <Section title="Información técnica" subtitle="Detalles">
                  <div className="rounded-2xl border border-border/40 bg-card divide-y divide-border/40 overflow-hidden">
                    <DetailRow label="Tipología" value={unit.type}
                      editMode={editMode} onChange={(v) => update({ type: v })}
                      options={["Apartamento", "Ático", "Dúplex", "Estudio", "Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"]} />
                    <DetailRow label="Orientación" value={unit.orientation}
                      editMode={editMode} onChange={(v) => update({ orientation: v })}
                      options={["Norte", "Sur", "Este", "Oeste", "Noreste", "Noroeste", "Sureste", "Suroeste"]} />
                    <DetailRow label="Bloque" value={unit.block || ""}
                      editMode={editMode} onChange={(v) => update({ block: v })} />
                    <DetailRow label="Planta" value={String(unit.floor)}
                      editMode={editMode} type="number" onChange={(v) => update({ floor: Number(v) || 0 })} />
                    <DetailRow label="Puerta" value={unit.door || ""}
                      editMode={editMode} onChange={(v) => update({ door: v })} />
                    <DetailRow label="Referencia interna" value={unit.ref}
                      editMode={editMode} onChange={(v) => update({ ref: v })} />
                    <DetailRow label="ID pública" value={unit.publicId || ""}
                      editMode={editMode} onChange={(v) => update({ publicId: v })} />
                    <DetailRow label="Estado" value={unit.status}
                      editMode={editMode} onChange={(v) => update({ status: v as UnitStatus })}
                      options={["available", "reserved", "sold", "withdrawn"]} />
                    <DetailRow label="Certificación energética"
                      value={effectiveEnergyCert || "—"}
                      editMode={editMode}
                      onChange={(v) => update({ energyCertOverride: v })}
                      options={["A", "B", "C", "D", "E", "F", "G"]}
                      badge={editMode ? undefined : "energy"}
                      inherited={unit.energyCertOverride === undefined && !!heritedEnergyCert} />
                    <DetailRow label="Año de entrega"
                      value={effectiveDeliveryYear || "—"}
                      editMode={editMode && isUni}
                      onChange={(v) => update({ deliveryYearOverride: v })}
                      inherited={unit.deliveryYearOverride === undefined && !!heritedDeliveryYear} />
                  </div>
                </Section>

                {/* Floor plan placeholder */}
                <Section title="Plano de la vivienda" subtitle="Distribución">
                  <div className="rounded-2xl border border-border/40 bg-muted/30 aspect-[16/10] overflow-hidden flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2 opacity-40" strokeWidth={1.2} />
                    <p className="text-sm font-medium">Plano de planta</p>
                    <p className="text-xs mt-1">{unit.builtArea} m² · {unit.bedrooms} dormitorios · {unit.bathrooms} baños</p>
                    {editMode ? (
                      <Button variant="default" size="sm" className="mt-3 rounded-full text-xs gap-1.5 h-8">
                        <ImageIcon className="h-3 w-3" strokeWidth={1.5} /> Subir plano
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="mt-3 rounded-full text-xs gap-1.5 h-8 border-border/60">
                        <Download className="h-3 w-3" strokeWidth={1.5} /> Descargar plano
                      </Button>
                    )}
                  </div>
                </Section>

                {/* Features · heredadas de la promoción con override opcional.
                     Interior = caracteristicasVivienda (heredadas/override).
                     Exterior = derivados reales de la unidad (piscina, parcela…).
                     Comunes = amenidades reales de la promoción. */}
                <Section
                  title="Características"
                  subtitle="Equipamiento"
                  right={
                    !isCollaboratorView && editMode ? (
                      hasCharsOverride ? (
                        <button
                          type="button"
                          onClick={() => update({ caracteristicasOverride: undefined })}
                          className="text-[10px] text-primary font-medium hover:underline"
                        >
                          Restablecer a las de la promoción
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => update({ caracteristicasOverride: [...heritedChars] })}
                          className="text-[10px] text-primary font-medium hover:underline"
                        >
                          Personalizar para esta unidad
                        </button>
                      )
                    ) : undefined
                  }
                >
                  <div className="space-y-5">
                    <FeatureGroup
                      title={hasCharsOverride ? "Interior (personalizado)" : "Interior"}
                      items={effectiveChars}
                      editMode={editMode && hasCharsOverride}
                      onChange={(items) => update({ caracteristicasOverride: items })}
                    />
                    {exteriorFeatures.length > 0 && (
                      <FeatureGroup
                        title="Exterior y extras"
                        items={exteriorFeatures.map(f => f.label)}
                      />
                    )}
                    {communityFeatures.length > 0 && (
                      <FeatureGroup
                        title="Zonas comunes"
                        items={communityFeatures.map(f => f.label)}
                      />
                    )}
                  </div>
                </Section>

                {/* Payment plan · heredado de la promoción + override opcional
                     (útil sobre todo para unifamiliar independiente). */}
                {!isCollaboratorView && unit.status !== "sold" && unit.status !== "withdrawn" && (
                  <Section
                    title="Plan de pagos"
                    subtitle="Financiación"
                    right={
                      !isCollaboratorView && editMode ? (
                        hasHitosOverride ? (
                          <button
                            type="button"
                            onClick={() => update({ hitosPagoOverride: undefined })}
                            className="text-[10px] text-primary font-medium hover:underline"
                          >
                            Restablecer al de la promoción
                          </button>
                        ) : isUni ? (
                          <button
                            type="button"
                            onClick={() => update({ hitosPagoOverride: heritedHitos.length > 0 ? [...heritedHitos] : paymentPlan.map(p => ({ porcentaje: p.percent, descripcion: p.label })) })}
                            className="text-[10px] text-primary font-medium hover:underline"
                          >
                            Personalizar para esta villa
                          </button>
                        ) : undefined
                      ) : undefined
                    }
                  >
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3">
                      {paymentPlan.map((p, i) => (
                        <div key={`${p.label}-${i}`} className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.label}</p>
                            {p.when && <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{p.when}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(p.amount)}</p>
                            <p className="text-[10px] text-muted-foreground">{p.percent}%</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-3 border-t border-border/40">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</span>
                        <span className="text-base font-bold text-foreground tabular-nums">{formatPrice(unit.price)}</span>
                      </div>
                      {hasHitosOverride && (
                        <p className="text-[10px] text-primary pt-1">✓ Plan personalizado para esta unidad</p>
                      )}
                    </div>
                  </Section>
                )}

                {/* Ubicación · dirección real de la promoción (read-only en
                     ficha de unidad; se edita en la ficha de promoción). */}
                <Section title="Ubicación" subtitle="Entorno">
                  <div className="rounded-2xl border border-border/40 bg-muted/30 aspect-[16/9] overflow-hidden relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <MapPin className="h-10 w-10 mb-2 opacity-50" strokeWidth={1.2} />
                      <p className="text-sm font-medium text-foreground">{city}</p>
                      {region && <p className="text-xs mt-1">{region}</p>}
                    </div>
                  </div>
                  {/* Puntos de interés · placeholder Google Maps.
                      TODO(backend): integrar Google Places API para obtener
                      distancias a playa, centro, aeropuerto, golf, montaña y
                      supermercado. El orden refleja la prioridad turística:
                      si una categoría no existe cerca, se muestra con X. */}
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 mt-3">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
                      Puntos de interés cercanos
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[
                        { label: "Playa" },
                        { label: "Centro" },
                        { label: "Aeropuerto" },
                        { label: "Golf" },
                        { label: "Montaña" },
                        { label: "Supermercado" },
                      ].map((p) => (
                        <div key={p.label} className="flex flex-col items-center gap-1 rounded-lg bg-card border border-border/40 px-2 py-2">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.label}</span>
                          <span className="text-xs font-medium text-muted-foreground/60">—</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                      Próximamente · distancias calculadas automáticamente con Google Maps
                    </p>
                  </div>
                </Section>

                {/* Resources */}
                <Section title="Recursos descargables" subtitle="Documentación">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <ResourceTile icon={FileText} label="Brochure" editMode={editMode} />
                    <ResourceTile icon={FileText} label="Plano" editMode={editMode} />
                    <ResourceTile icon={ImageIcon} label="Fotos" count={photos.length} editMode={editMode} />
                    <ResourceTile icon={Video} label="Vídeo tour" editMode={editMode} />
                  </div>
                </Section>

                {/* Status info */}
                {unit.status === "reserved" && !isCollaboratorView && (
                  <div className="rounded-2xl bg-warning/10 border border-warning/25 px-4 py-3 text-xs space-y-1.5">
                    {editMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-warning font-medium shrink-0">Cliente:</span>
                          <input
                            defaultValue={unit.clientName || ""}
                            onBlur={(e) => update({ clientName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-warning/40"
                            placeholder="Nombre del cliente"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-warning font-medium shrink-0">Agencia:</span>
                          <input
                            defaultValue={unit.agencyName || ""}
                            onBlur={(e) => update({ agencyName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-warning/40"
                            placeholder="Agencia"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-warning font-medium shrink-0">Fecha:</span>
                          <input
                            type="date"
                            defaultValue={unit.reservedAt || ""}
                            onBlur={(e) => update({ reservedAt: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-warning/40"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-warning">Reservada por {unit.clientName}</p>
                        {unit.agencyName && <p className="text-warning">vía {unit.agencyName}</p>}
                        {unit.reservedAt && <p className="text-warning inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {unit.reservedAt}</p>}
                      </>
                    )}
                  </div>
                )}
                {unit.status === "sold" && !isCollaboratorView && (
                  <div className="rounded-2xl bg-destructive/5 border border-destructive/20 px-4 py-3 text-xs space-y-1.5">
                    {editMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-destructive font-medium shrink-0">Cliente:</span>
                          <input
                            defaultValue={unit.clientName || ""}
                            onBlur={(e) => update({ clientName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-destructive/30"
                            placeholder="Nombre del cliente"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-destructive font-medium shrink-0">Agencia:</span>
                          <input
                            defaultValue={unit.agencyName || ""}
                            onBlur={(e) => update({ agencyName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-destructive/30"
                            placeholder="Agencia"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-destructive font-medium shrink-0">Fecha:</span>
                          <input
                            type="date"
                            defaultValue={unit.soldAt || ""}
                            onBlur={(e) => update({ soldAt: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-destructive/30"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-destructive">Vendida a {unit.clientName}</p>
                        {unit.agencyName && <p className="text-destructive/80">vía {unit.agencyName}</p>}
                        {unit.soldAt && <p className="text-destructive/60 inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {unit.soldAt}</p>}
                      </>
                    )}
                  </div>
                )}
              </div>


              {/* RIGHT: price + actions */}
              <aside className="space-y-3 lg:sticky lg:top-3 self-start">
                <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Precio</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                      {sc.label}
                    </span>
                  </div>
                  {editMode ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <input
                          type="number"
                          defaultValue={unit.price}
                          onBlur={(e) => update({ price: Number(e.target.value) || 0 })}
                          className="text-2xl font-bold text-foreground tracking-tight tabular-nums bg-muted/40 rounded-md px-2 py-1 w-full outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <span className="text-base font-semibold text-muted-foreground">€</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">Precio total · escribe el importe</p>
                    </div>
                  ) : unit.status === "available" ? (
                    <>
                      <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">{formatPrice(unit.price)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatPrice(pricePerM2)}/m² · {unit.builtArea} m²</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-muted-foreground/60 tracking-tight tabular-nums">—</p>
                      <p className="text-xs text-muted-foreground mt-1">{unit.builtArea} m² construidos</p>
                    </>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40">
                    <MiniStat icon={Bed} value={unit.bedrooms} />
                    <MiniStat icon={Bath} value={unit.bathrooms} />
                    <MiniStat icon={Maximize} value={`${unit.builtArea}m²`} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {unit.status !== "sold" && unit.status !== "withdrawn" && (
                    <Button onClick={() => setSendOpen(true)} className="rounded-full h-10 text-xs gap-1.5">
                      <Send className="h-3.5 w-3.5" strokeWidth={1.5} /> Enviar inmueble
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full h-10 text-xs gap-1.5 border-border/60">
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Descargar ficha PDF
                  </Button>
                  {!isCollaboratorView && unit.status !== "sold" && unit.status !== "withdrawn" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => onEdit?.(unit)}
                        className="rounded-full h-10 text-xs gap-1.5 border-border/60"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> Editar unidad
                      </Button>
                      {unit.status === "available" && (
                        <Button variant="secondary" className="rounded-full h-10 text-xs gap-1.5">
                          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.5} /> Reservar
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Carpeta Drive de la unidad · placeholder hasta integración.
                    TODO(backend): crear carpeta Drive con el `ref` de la
                    unidad dentro de la carpeta de la promoción al persistir
                    la unidad; sincronizar fotos/planos subidos aquí. */}
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Carpeta Drive</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border text-muted-foreground shrink-0">
                      <FileText className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {ctx.nombrePromocion ?? "Promoción"} / {unit.ref}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Fotos y planos sincronizados aquí</p>
                    </div>
                  </div>
                </div>

              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox fullscreen gallery */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="p-0 max-w-[100vw] w-screen h-screen sm:max-w-[100vw] sm:h-screen rounded-none border-0 bg-black/95 flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Galería de fotos</DialogTitle>
            <DialogDescription>Galería completa de la unidad {displayId}</DialogDescription>
          </DialogHeader>

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0 z-10">
            <div className="text-white">
              <p className="text-sm font-medium">{displayId} · {unit.type}</p>
              <p className="text-[10px] text-white/60">{activeIdx + 1} de {photos.length}</p>
            </div>
            <button
              onClick={() => setLightboxOpen(false)}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>

          {/* Main image */}
          <div className="flex-1 flex items-center justify-center relative px-4 sm:px-12 min-h-0">
            <img
              src={photos[activeIdx]}
              alt={`Foto ${activeIdx + 1}`}
              className="max-w-full max-h-full object-contain"
            />
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
          </div>

          {/* Bottom thumbnails */}
          <div className="px-5 py-4 overflow-x-auto shrink-0">
            <div className="flex gap-2 justify-center">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "h-14 w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                    i === activeIdx ? "border-white" : "border-transparent opacity-50 hover:opacity-100"
                  )}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SendEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        defaultAudience="client"
        mode="unit"
        promotionId={unit.promotionId}
        unitId={unit.id}
      />
    </>
  );
}


function Section({ title, subtitle, right, children }: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          {subtitle && <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-0.5">{subtitle}</p>}
          <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Highlight({ icon: Icon, value, label, suffix, editMode, type, onChange }: {
  icon: typeof Bed; value: string; label: string; suffix?: string;
  editMode?: boolean; type?: string; onChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        {editMode && onChange ? (
          <input
            type={type || "text"}
            defaultValue={value}
            onBlur={(e) => onChange(e.target.value)}
            className="text-sm font-semibold text-foreground tabular-nums leading-tight bg-muted/40 rounded-md px-2 py-0.5 w-full max-w-[80px] outline-none focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <p className="text-sm font-semibold text-foreground tabular-nums leading-tight">
            {value}{suffix ? ` ${suffix}` : ""}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function FeatureGroup({ title, items, editMode, onChange }: {
  title: string; items: string[]; editMode?: boolean; onChange?: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  if (!editMode && items.length === 0) return null;
  const removeAt = (i: number) => onChange?.(items.filter((_, idx) => idx !== i));
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange?.([...items, t]);
    setDraft("");
  };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((label, i) => (
          <span key={`${label}-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-muted/60 text-foreground border border-border/40">
            {label}
            {editMode && (
              <button onClick={() => removeAt(i)} className="text-muted-foreground hover:text-destructive leading-none" aria-label="Quitar">
                ×
              </button>
            )}
          </span>
        ))}
        {editMode && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted/30 border border-dashed border-border/60">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="Añadir…"
              className="bg-transparent outline-none text-xs w-24"
            />
            <button onClick={add} className="text-primary hover:opacity-80 text-xs font-medium">+</button>
          </span>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, badge, editMode, type, onChange, options, inherited }: {
  label: string; value: string; badge?: "energy";
  editMode?: boolean; type?: string; onChange?: (v: string) => void; options?: string[];
  /** Si true, muestra un pequeño indicador "heredado" junto al valor. */
  inherited?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {editMode && onChange ? (
        options ? (
          <select
            defaultValue={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-foreground font-medium bg-muted/40 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 max-w-[180px]"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type || "text"}
            defaultValue={value}
            onBlur={(e) => onChange(e.target.value)}
            className="text-foreground font-medium bg-muted/40 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 text-right max-w-[180px]"
          />
        )
      ) : badge === "energy" ? (
        <div className="flex items-center gap-1.5">
          {inherited && <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">heredado</span>}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
            {value}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0">
          {inherited && <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider shrink-0">heredado</span>}
          <span className="text-foreground font-medium truncate">{value}</span>
        </div>
      )}
    </div>
  );
}

function SurfaceCard({ label, value, icon: Icon, editMode, onChange, hideIfZero }: {
  label: string; value: number; icon: typeof Bed;
  editMode?: boolean; onChange?: (v: number) => void; hideIfZero?: boolean;
}) {
  if (hideIfZero && value === 0) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      {editMode && onChange ? (
        <div className="flex items-baseline gap-1 mt-1">
          <input
            type="number"
            defaultValue={value}
            onBlur={(e) => onChange(Number(e.target.value) || 0)}
            className="text-base font-semibold text-foreground tabular-nums bg-muted/40 rounded-md px-2 py-0.5 w-20 outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs font-normal text-muted-foreground">m²</span>
        </div>
      ) : (
        <p className="text-base font-semibold text-foreground mt-1 tabular-nums">
          {value} <span className="text-xs font-normal text-muted-foreground">m²</span>
        </p>
      )}
    </div>
  );
}

function ResourceTile({ icon: Icon, label, count, editMode }: {
  icon: typeof Bed; label: string; count?: number; editMode?: boolean;
}) {
  return (
    <button className="flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors text-left">
      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      <span className="text-xs font-medium text-foreground">
        {label}{count !== undefined ? ` (${count})` : ""}
      </span>
      {editMode && (
        <span className="text-[10px] text-primary font-medium mt-0.5">+ Subir</span>
      )}
    </button>
  );
}

function MiniStat({ icon: Icon, value }: { icon: typeof Bed; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
      <span className="text-xs font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

