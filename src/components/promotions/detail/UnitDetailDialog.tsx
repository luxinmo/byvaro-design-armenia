import { useState, useMemo } from "react";
import { Unit, UnitStatus } from "@/data/units";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Compass, Bed, Bath, Maximize, Building2, Waves, Eye, Sun,
  ChevronLeft, ChevronRight, Download, Send, Pencil, Bookmark,
  FileText, Image as ImageIcon, Video, MapPin, Calendar, Tag,
  TreePine, Car, Package, Shield, Wifi, Dumbbell, Wind, Snowflake,
  Sparkles, CheckCircle2, Phone, Mail, Share2, Heart, Star, Award,
  Zap, Home, Layers, Ruler,
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
  reserved:  { label: "Reservada",  class: "bg-amber-500/10 text-amber-700 border-amber-500/20",     dotClass: "bg-amber-500" },
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
}

type ExtraFields = {
  description: string;
  city: string;
  region: string;
  energyCert: string;
  deliveryYear: string;
  pois: { label: string; value: string }[];
  contactName: string;
  contactRole: string;
  contactInitials: string;
  features: { interior: string[]; exterior: string[]; community: string[] };
};

export function UnitDetailDialog({ unit, open, onOpenChange, isCollaboratorView = false, onEdit, onUpdateUnit }: UnitDetailDialogProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [sendOpen, setSendOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [extras, setExtras] = useState<ExtraFields>({
    description: "",
    city: "Marbella",
    region: "Málaga · Costa del Sol",
    energyCert: "A",
    deliveryYear: "2026",
    pois: [
      { label: "Playa", value: "350 m" },
      { label: "Centro", value: "2,5 km" },
      { label: "Aeropuerto", value: "45 km" },
      { label: "Golf", value: "800 m" },
    ],
    contactName: "María Rodríguez",
    contactRole: "Asesora comercial",
    contactInitials: "MR",
    features: {
      interior: ["Cocina equipada", "Aire acondicionado", "Calefacción central", "Suelo radiante", "Domótica integrada", "Armarios empotrados", "Doble acristalamiento", "Ventilación cruzada"],
      exterior: ["Plaza de garaje", "Trastero incluido"],
      community: ["Seguridad 24h", "Piscina comunitaria", "Gimnasio privado", "Zonas verdes", "Coworking", "Spa & Sauna"],
    },
  });

  const updateExtra = <K extends keyof ExtraFields>(key: K, value: ExtraFields[K]) => {
    setExtras(prev => ({ ...prev, [key]: value }));
  };

  const update = (patch: Partial<Unit>) => {
    if (unit && onUpdateUnit) onUpdateUnit(unit.id, patch);
  };

  const photos = useMemo(() => {
    if (!unit) return [];
    return Array.from({ length: 10 }, (_, i) => `https://picsum.photos/seed/${unit.id}-${i}/1600/1000`);
  }, [unit]);

  if (!unit) return null;

  const sc = statusConfig[unit.status];
  const pricePerM2 = Math.round(unit.price / unit.builtArea);
  const displayId = getUnitDisplayId(unit);
  const isUni = ["Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"].includes(unit.type);

  const surfaces = [
    { label: "Construida", value: unit.builtArea, icon: Maximize },
    { label: "Útil", value: unit.usableArea, icon: Ruler },
    ...(unit.terrace > 0 ? [{ label: "Terraza", value: unit.terrace, icon: TreePine }] : []),
    ...(unit.garden > 0 ? [{ label: "Jardín", value: unit.garden, icon: TreePine }] : []),
    ...(unit.parcel > 0 ? [{ label: "Parcela", value: unit.parcel, icon: MapPin }] : []),
  ];

  const interiorFeatures = [
    { label: "Cocina equipada", icon: Package },
    { label: "Aire acondicionado", icon: Snowflake },
    { label: "Calefacción central", icon: Sun },
    { label: "Suelo radiante", icon: Zap },
    { label: "Domótica integrada", icon: Wifi },
    { label: "Armarios empotrados", icon: Home },
    { label: "Doble acristalamiento", icon: Layers },
    { label: "Ventilación cruzada", icon: Wind },
  ];

  const exteriorFeatures = [
    ...(unit.hasPool ? [{ label: "Piscina privada", icon: Waves }] : []),
    ...(unit.floor >= 3 ? [{ label: "Vistas al mar", icon: Eye }] : []),
    { label: "Plaza de garaje", icon: Car },
    { label: "Trastero incluido", icon: Package },
  ];

  const communityFeatures = [
    { label: "Seguridad 24h", icon: Shield },
    { label: "Piscina comunitaria", icon: Waves },
    { label: "Gimnasio privado", icon: Dumbbell },
    { label: "Zonas verdes", icon: TreePine },
    { label: "Coworking", icon: Building2 },
    { label: "Spa & Sauna", icon: Sparkles },
  ];

  const paymentPlan = [
    { label: "Reserva", percent: 10, amount: unit.price * 0.10, when: "A la firma" },
    { label: "Contrato", percent: 20, amount: unit.price * 0.20, when: "30 días" },
    { label: "Durante obra", percent: 40, amount: unit.price * 0.40, when: "Hitos de obra" },
    { label: "Entrega de llaves", percent: 30, amount: unit.price * 0.30, when: "Escritura" },
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
              {!isCollaboratorView && (
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
              <div className="text-right ml-2">
                <p className="text-base font-bold text-foreground tabular-nums leading-none">{formatPrice(unit.price)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatPrice(pricePerM2)}/m²</p>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Edit mode banner */}
            {editMode && (
              <div className="px-5 sm:px-6 pt-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-amber-800">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="font-medium">Modo edición activo</span>
                    <span className="hidden sm:inline text-amber-700/70">· los cambios se guardan automáticamente al salir del campo</span>
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
                      <MapPin className="h-3 w-3" strokeWidth={1.5} /> {extras.city}, {extras.region.split(" · ")[0]}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
                <Highlight icon={Bed} value={String(unit.bedrooms)} label="Dormitorios"
                  editMode={editMode} type="number" onChange={(v) => update({ bedrooms: Number(v) || 0 })} />
                <Highlight icon={Bath} value={String(unit.bathrooms)} label="Baños"
                  editMode={editMode} type="number" onChange={(v) => update({ bathrooms: Number(v) || 0 })} />
                <Highlight icon={Maximize} value={String(unit.builtArea)} suffix="m²" label="Construida"
                  editMode={editMode} type="number" onChange={(v) => update({ builtArea: Number(v) || 0 })} />
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
                {/* Description */}
                <Section title="Sobre esta vivienda" subtitle="Descripción">
                  {editMode ? (
                    <textarea
                      value={extras.description}
                      onChange={(e) => updateExtra("description", e.target.value)}
                      rows={6}
                      className="w-full text-sm text-foreground/85 leading-relaxed bg-muted/30 rounded-xl border border-border/40 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      placeholder="Descripción personalizada de la vivienda..."
                    />
                  ) : (
                    <div className="space-y-3 text-sm text-foreground/85 leading-relaxed">
                      {extras.description ? (
                        <p className="whitespace-pre-line">{extras.description}</p>
                      ) : (
                        <>
                          <p>
                            Descubra esta excepcional {unit.type.toLowerCase()} de {unit.bedrooms} dormitorios situada en una de las urbanizaciones más prestigiosas de la Costa del Sol. Con {unit.builtArea} m² construidos, esta propiedad combina diseño contemporáneo, materiales de primera calidad y vistas privilegiadas.
                          </p>
                          <p>
                            Distribuida en una planta diáfana, ofrece amplios espacios con luz natural durante todo el día gracias a su orientación {unit.orientation.toLowerCase()}. La cocina abierta al salón, los acabados artesanales y el ventanal de suelo a techo crean una atmósfera única de elegancia y confort.
                          </p>
                          {unit.terrace > 0 && (
                            <p>
                              Cuenta con una terraza privada de {unit.terrace} m², ideal para disfrutar del clima mediterráneo, comer al aire libre o relajarse contemplando el atardecer sobre el Mediterráneo.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Section>

                {/* Surfaces */}
                <Section title="Superficies" subtitle="Distribución">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <SurfaceCard label="Construida" value={unit.builtArea} icon={Maximize}
                      editMode={editMode} onChange={(v) => update({ builtArea: v })} />
                    <SurfaceCard label="Útil" value={unit.usableArea} icon={Ruler}
                      editMode={editMode} onChange={(v) => update({ usableArea: v })} />
                    <SurfaceCard label="Terraza" value={unit.terrace} icon={TreePine}
                      editMode={editMode} onChange={(v) => update({ terrace: v })} hideIfZero={!editMode} />
                    <SurfaceCard label="Jardín" value={unit.garden} icon={TreePine}
                      editMode={editMode} onChange={(v) => update({ garden: v })} hideIfZero={!editMode} />
                    <SurfaceCard label="Parcela" value={unit.parcel} icon={MapPin}
                      editMode={editMode} onChange={(v) => update({ parcel: v })} hideIfZero={!editMode} />
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

                {/* Features grouped */}
                <Section title="Características" subtitle="Equipamiento">
                  <div className="space-y-5">
                    <FeatureGroup
                      title="Interior"
                      items={editMode ? extras.features.interior : interiorFeatures.map(f => f.label)}
                      editMode={editMode}
                      onChange={(items) => updateExtra("features", { ...extras.features, interior: items })}
                    />
                    <FeatureGroup
                      title="Exterior y extras"
                      items={editMode ? extras.features.exterior : exteriorFeatures.map(f => f.label)}
                      editMode={editMode}
                      onChange={(items) => updateExtra("features", { ...extras.features, exterior: items })}
                    />
                    <FeatureGroup
                      title="Zonas comunes"
                      items={editMode ? extras.features.community : communityFeatures.map(f => f.label)}
                      editMode={editMode}
                      onChange={(items) => updateExtra("features", { ...extras.features, community: items })}
                    />
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
                    <DetailRow label="Certificación energética" value={extras.energyCert}
                      editMode={editMode} onChange={(v) => updateExtra("energyCert", v)}
                      options={["A", "B", "C", "D", "E", "F", "G"]}
                      badge={editMode ? undefined : "energy"} />
                    <DetailRow label="Año de entrega" value={extras.deliveryYear}
                      editMode={editMode} type="number" onChange={(v) => updateExtra("deliveryYear", v)} />
                  </div>
                </Section>

                {/* Payment plan */}
                {!isCollaboratorView && (
                  <Section title="Plan de pagos" subtitle="Financiación">
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3">
                      {paymentPlan.map((p, i) => (
                        <div key={p.label} className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{p.when}</p>
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
                    </div>
                  </Section>
                )}

                {/* Location */}
                <Section title="Ubicación" subtitle="Entorno">
                  <div className="rounded-2xl border border-border/40 bg-muted/30 aspect-[16/9] overflow-hidden relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <MapPin className="h-10 w-10 mb-2 opacity-50" strokeWidth={1.2} />
                      {editMode ? (
                        <>
                          <input
                            value={extras.city}
                            onChange={(e) => updateExtra("city", e.target.value)}
                            placeholder="Ciudad"
                            className="text-sm font-medium text-foreground bg-card/80 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 text-center max-w-[240px]"
                          />
                          <input
                            value={extras.region}
                            onChange={(e) => updateExtra("region", e.target.value)}
                            placeholder="Provincia · Región"
                            className="text-xs mt-1 bg-card/80 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 text-center max-w-[280px]"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">{extras.city}</p>
                          <p className="text-xs mt-1">{extras.region}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {extras.pois.map((poi, i) => (
                      <NearbyTile
                        key={i}
                        label={poi.label}
                        value={poi.value}
                        editMode={editMode}
                        onChangeLabel={(v) => updateExtra("pois", extras.pois.map((p, idx) => idx === i ? { ...p, label: v } : p))}
                        onChangeValue={(v) => updateExtra("pois", extras.pois.map((p, idx) => idx === i ? { ...p, value: v } : p))}
                      />
                    ))}
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
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs space-y-1.5">
                    {editMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-medium shrink-0">Cliente:</span>
                          <input
                            defaultValue={unit.clientName || ""}
                            onBlur={(e) => update({ clientName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-amber-300"
                            placeholder="Nombre del cliente"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-medium shrink-0">Agencia:</span>
                          <input
                            defaultValue={unit.agencyName || ""}
                            onBlur={(e) => update({ agencyName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-amber-300"
                            placeholder="Agencia"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-medium shrink-0">Fecha:</span>
                          <input
                            type="date"
                            defaultValue={unit.reservedAt || ""}
                            onBlur={(e) => update({ reservedAt: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-amber-300"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-amber-800">Reservada por {unit.clientName}</p>
                        {unit.agencyName && <p className="text-amber-600">vía {unit.agencyName}</p>}
                        {unit.reservedAt && <p className="text-amber-500 inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {unit.reservedAt}</p>}
                      </>
                    )}
                  </div>
                )}
                {unit.status === "sold" && !isCollaboratorView && (
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3 text-xs space-y-1.5">
                    {editMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium shrink-0">Cliente:</span>
                          <input
                            defaultValue={unit.clientName || ""}
                            onBlur={(e) => update({ clientName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Nombre del cliente"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium shrink-0">Agencia:</span>
                          <input
                            defaultValue={unit.agencyName || ""}
                            onBlur={(e) => update({ agencyName: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Agencia"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium shrink-0">Fecha:</span>
                          <input
                            type="date"
                            defaultValue={unit.soldAt || ""}
                            onBlur={(e) => update({ soldAt: e.target.value })}
                            className="flex-1 bg-white/60 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-primary">Vendida a {unit.clientName}</p>
                        {unit.agencyName && <p className="text-primary/80">vía {unit.agencyName}</p>}
                        {unit.soldAt && <p className="text-primary/60 inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {unit.soldAt}</p>}
                      </>
                    )}
                  </div>
                )}

                {/* Resources */}
                <Section title="Recursos descargables" subtitle="Documentación">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <ResourceTile icon={FileText} label="Brochure" />
                    <ResourceTile icon={FileText} label="Plano" />
                    <ResourceTile icon={ImageIcon} label="Fotos" count={photos.length} />
                    <ResourceTile icon={Video} label="Vídeo tour" />
                  </div>
                </Section>
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
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">{formatPrice(unit.price)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatPrice(pricePerM2)}/m² · {unit.builtArea} m²</p>
                    </>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40">
                    <MiniStat icon={Bed} value={unit.bedrooms} />
                    <MiniStat icon={Bath} value={unit.bathrooms} />
                    <MiniStat icon={Maximize} value={`${unit.builtArea}m²`} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button onClick={() => setSendOpen(true)} className="rounded-full h-10 text-xs gap-1.5">
                    <Send className="h-3.5 w-3.5" strokeWidth={1.5} /> Enviar inmueble
                  </Button>
                  <Button variant="outline" className="rounded-full h-10 text-xs gap-1.5 border-border/60">
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Descargar ficha PDF
                  </Button>
                  {!isCollaboratorView && (
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

                {/* Contact card */}
                <div className="rounded-2xl border border-border/40 bg-card p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Contacto comercial</p>
                  <div className="flex items-center gap-3">
                    {editMode ? (
                      <input
                        value={extras.contactInitials}
                        onChange={(e) => updateExtra("contactInitials", e.target.value.slice(0, 3).toUpperCase())}
                        className="h-10 w-10 rounded-full bg-primary/10 text-primary text-center text-sm font-semibold shrink-0 outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                        {extras.contactInitials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      {editMode ? (
                        <>
                          <input
                            value={extras.contactName}
                            onChange={(e) => updateExtra("contactName", e.target.value)}
                            placeholder="Nombre"
                            className="w-full text-sm font-medium text-foreground bg-muted/40 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <input
                            value={extras.contactRole}
                            onChange={(e) => updateExtra("contactRole", e.target.value)}
                            placeholder="Cargo"
                            className="w-full text-[10px] text-muted-foreground bg-muted/40 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground truncate">{extras.contactName}</p>
                          <p className="text-[10px] text-muted-foreground">{extras.contactRole}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button variant="outline" size="sm" className="rounded-full h-8 text-[10px] gap-1 border-border/60">
                      <Phone className="h-3 w-3" strokeWidth={1.5} /> Llamar
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full h-8 text-[10px] gap-1 border-border/60">
                      <Mail className="h-3 w-3" strokeWidth={1.5} /> Email
                    </Button>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-2.5">
                  <TrustItem icon={CheckCircle2} text="Promoción verificada" />
                  <TrustItem icon={Shield} text="Pagos protegidos" />
                  <TrustItem icon={Star} text="Promotor de confianza" />
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


function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        {subtitle && <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-0.5">{subtitle}</p>}
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
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

function DetailRow({ label, value, badge, editMode, type, onChange, options }: {
  label: string; value: string; badge?: "energy";
  editMode?: boolean; type?: string; onChange?: (v: string) => void; options?: string[];
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
          {value}
        </span>
      ) : (
        <span className="text-foreground font-medium truncate">{value}</span>
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

function NearbyTile({ label, value, editMode, onChangeLabel, onChangeValue }: {
  label: string; value: string;
  editMode?: boolean; onChangeLabel?: (v: string) => void; onChangeValue?: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card px-3 py-2 text-center">
      {editMode && onChangeValue ? (
        <input
          defaultValue={value}
          onBlur={(e) => onChangeValue(e.target.value)}
          className="text-sm font-semibold text-foreground tabular-nums bg-muted/40 rounded-md px-1 py-0.5 w-full text-center outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
      )}
      {editMode && onChangeLabel ? (
        <input
          defaultValue={label}
          onBlur={(e) => onChangeLabel(e.target.value)}
          className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 bg-muted/40 rounded-md px-1 py-0.5 w-full text-center outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
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

function TrustItem({ icon: Icon, text }: { icon: typeof Bed; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-foreground">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
      <span>{text}</span>
    </div>
  );
}
