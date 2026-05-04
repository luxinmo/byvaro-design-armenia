/**
 * UnitDetailPanel · panel lateral/expandible de detalle de una unidad.
 *
 * Se renderiza dentro de la tabla/catálogo de `PromotionAvailabilityFull` como
 * una fila expandida (`<tr>` con colSpan=20). Muestra toda la información
 * relevante de una unidad individual: precio, superficies, detalles (orientación,
 * dormitorios, planta), recursos multimedia (plano, fotos, vídeo, tour 360°) y
 * CTAs contextuales según el estado (reservar, notificar colaboradores, editar).
 *
 * Responsabilidades:
 *   1. Presentación de highlights visuales (piscina · vistas mar · terraza).
 *   2. Grid de precio + superficies + detalles + recursos.
 *   3. CTAs contextuales por estado: `available` (reservar), `reserved` (info +
 *      avisar colaboradores), `sold` (info), `withdrawn` (sin acción).
 *   4. Dialog de edición de unidad (datos + multimedia) con tabs.
 *   5. Dialog de reserva (captura cliente + notas).
 *   6. Envío por email vía `SendEmailDialog`.
 *
 * Props (ver interface `UnitDetailPanelProps`):
 *   - unit: Unit                                → unidad a mostrar.
 *   - onUpdateUnit?: (id, updates) => void      → callback para persistir edición.
 *   - isCollaboratorView?: boolean              → oculta edición / reserva cuando
 *                                                 el viewer es un colaborador.
 *
 * Dependencias:
 *   - `@/data/units`                 → tipos Unit + UnitStatus.
 *   - `@/hooks/use-toast`            → notificaciones Byvaro.
 *   - `@/components/ui/button`       → primitiva Button Byvaro.
 *   - `@/components/ui/dialog`       → Dialog (edición, reserva).
 *   - `@/components/ui/input`        → Input Byvaro (tipografía + radio coherentes).
 *   - `@/components/ui/tabs`         → Tabs para el diálogo de edición.
 *   - `@/lib/utils` (cn)             → helper de classnames condicionales.
 *   - `zod`                          → validación del ID de unidad al editar.
 *   - `@/components/email/SendEmailDialog` → envío de ficha por email.
 *   - `lucide-react`                 → iconografía.
 *
 * Tokens Byvaro usados (todos HSL, ver src/index.css):
 *   - bg-card · border-border · text-foreground · text-muted-foreground
 *   - bg-primary/10 text-primary (estado "Disponible", chip "Vistas mar", etc.)
 *   - bg-destructive/10 text-destructive (estado "Retirada", recurso Vídeo)
 *   - bg-accent/10 text-accent-foreground (recurso Plano)
 *   - Excepción amber-500: estado "Reservada" + banner reserva (warning Byvaro).
 *   - Radios: rounded-2xl (dialog edición) · rounded-xl (cards internas,
 *     recursos, botones principales) · rounded-full (badges de estado, chips).
 *   - Sombras: shadow-soft en reposo · shadow-soft-lg en hover (sustituye
 *     los `shadow-[0_Xpx...]` arbitrarios del original).
 *
 * TODOs:
 *   - TODO(backend): PATCH /api/units/:id — persistir edición de unidad.
 *   - TODO(backend): POST /api/units/:id/reservations — crear reserva.
 *   - TODO(backend): POST /api/units/:id/notify-collaborators — aviso masivo.
 *   - TODO(backend): GET /api/units/:id/media — plano, fotos, vídeo, tour.
 *   - TODO(ui): reemplazar grid de "Recursos" por un viewer real (lightbox,
 *     reproductor de vídeo, iframe tour 360°).
 *   - TODO(feature): histórico de cambios de la unidad (precio, estado).
 */

import { useState } from "react";
import { z } from "zod"; // Validación del ID (floor/door/customId) al editar
import { Unit, UnitStatus } from "@/data/units";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, priceForDisplay } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Compass, Bed, Building2, Waves, Eye, Image as ImageIcon, Video, FileText,
  Download, Pencil, Bookmark, Send, Droplets, Check, X,
  Upload, Link2, Camera,
} from "lucide-react";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function getUnitDisplayId(unit: Pick<Unit, "publicId" | "floor" | "door">) {
  return unit.publicId?.trim() || `${unit.floor}º${unit.door}`;
}

// Status de unidades unificado con la paleta de tokens Byvaro (HSL).
// Excepción amber para "reservada" — warning estándar del sistema.
const statusConfig: Record<UnitStatus, { label: string; class: string; dotClass: string }> = {
  available: { label: "Disponible", class: "bg-primary/10 text-primary border-primary/20", dotClass: "bg-primary" },
  reserved: { label: "Reservada", class: "bg-warning/10 text-warning border-warning/20", dotClass: "bg-warning" },
  sold: { label: "Vendida", class: "bg-destructive/10 text-destructive border-destructive/20", dotClass: "bg-destructive" },
  withdrawn: { label: "Retirada", class: "bg-muted text-muted-foreground border-border", dotClass: "bg-muted-foreground" },
};

const orientaciones = ["Norte", "Sur", "Este", "Oeste", "NE", "NO", "SE", "SO"];

const subtipoOptions = [
  { value: "apartamento", label: "Apartamento" },
  { value: "loft", label: "Loft" },
  { value: "penthouse", label: "Penthouse" },
  { value: "duplex", label: "Dúplex" },
  { value: "triplex", label: "Tríplex" },
  { value: "planta_baja", label: "Planta baja" },
];

const vistaOptions = [
  { value: "mar", label: "Al mar" },
  { value: "montana", label: "A la montaña" },
  { value: "rio", label: "Al río" },
  { value: "oceano", label: "Al océano" },
  { value: "golf", label: "A golf" },
];

const caracteristicasOptions = [
  { value: "cocina_equipada", label: "Cocina equipada" },
  { value: "vistas_mar", label: "Vistas al mar" },
  { value: "terraza", label: "Terraza" },
  { value: "jardin_privado", label: "Jardín privado" },
  { value: "smart_home", label: "Smart home" },
  { value: "aire_acondicionado", label: "Aire acondicionado" },
  { value: "suelo_radiante", label: "Suelo radiante" },
];

interface UnitDetailPanelProps {
  unit: Unit;
  onUpdateUnit?: (unitId: string, updates: Partial<Unit>) => void;
  isCollaboratorView?: boolean;
}

export function UnitDetailPanel({ unit, onUpdateUnit, isCollaboratorView = false }: UnitDetailPanelProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);

  const sc = statusConfig[unit.status];
  const pricePerM2 = Math.round(unit.price / unit.builtArea);
  const displayId = getUnitDisplayId(unit);
  /* REGLA · "Planta" no aplica a unifamiliares (villas, chalets,
   * pareados, adosados son una vivienda en parcela, no edificio).
   * Detectamos por el tipo de unidad ya que el panel no recibe la
   * promo. Para plurifamiliares (apartamento, ático, dúplex, etc.)
   * sí mostramos planta. */
  const isUni = /^(villa|chalet|unifamiliar|pareado|adosado)$/i.test(unit.type ?? "");

  // Highlights con tokens Byvaro. El original usaba blue/cyan/emerald hardcoded.
  const highlights = [
    ...(unit.hasPool ? [{ label: "Piscina", icon: Waves, color: "text-primary bg-primary/10" }] : []),
    ...(unit.floor >= 3 ? [{ label: "Vistas al mar", icon: Eye, color: "text-primary bg-primary/10" }] : []),
    ...(unit.terrace > 0 ? [{ label: `Terraza ${unit.terrace}m²`, icon: Droplets, color: "text-primary bg-primary/10" }] : []),
  ];

  const surfaces = [
    { label: "Construida", value: unit.builtArea },
    { label: "Útil", value: unit.usableArea },
    ...(unit.terrace > 0 ? [{ label: "Terraza", value: unit.terrace }] : []),
    ...(unit.parcel > 0 ? [{ label: "Parcela", value: unit.parcel }] : []),
  ];

  return (
    <tr>
      <td colSpan={20} className="p-0">
        <div className="border-b border-border/30 bg-gradient-to-b from-muted/5 to-transparent px-8 py-6">
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {highlights.map(h => (
                <span key={h.label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${h.color}`}>
                  <h.icon className="h-3 w-3" strokeWidth={1.5} /> {h.label}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_180px_220px] gap-6">
            {/* PRICE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Precio</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                  {sc.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{priceForDisplay(unit)}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(pricePerM2)}/m² · {unit.builtArea} m² construidos</p>
            </div>

            {/* SURFACES */}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2.5 block">Superficies</span>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {surfaces.map(s => (
                  <div key={s.label} className="rounded-xl border border-border/30 bg-card px-3.5 py-3">
                    <p className="text-sm font-semibold text-foreground leading-none">{s.value} m²</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* DETAILS */}
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2.5 block">Detalles</span>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Compass className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-muted-foreground">Orientación:</span>
                  <span className="text-foreground font-medium">{unit.orientation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bed className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-foreground font-medium">{unit.bedrooms} hab. · {unit.bathrooms} baños</span>
                </div>
                {!isUni && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-muted-foreground">Planta:</span>
                    <span className="text-foreground font-medium">{unit.floor}ª</span>
                  </div>
                )}
              </div>
            </div>

            {/* RESOURCES + ACTIONS */}
            <div className="space-y-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recursos</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  // Recursos con tokens Byvaro (violet/amber/rose/blue → primary/accent/destructive).
                  // Amber se mantiene en "Fotos" como warning estándar Byvaro.
                  { icon: FileText, label: "Plano", color: "text-accent-foreground bg-accent/10 border-accent/20" },
                  { icon: ImageIcon, label: "Fotos (6)", color: "text-warning bg-warning/10 border-warning/20" },
                  { icon: Video, label: "Vídeo", color: "text-destructive bg-destructive/10 border-destructive/20" },
                  { icon: Eye, label: "Tour 360°", color: "text-primary bg-primary/10 border-primary/20" },
                ].map(r => (
                  <button key={r.label} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all shadow-soft hover:shadow-soft-lg ${r.color}`}>
                    <r.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {r.label}
                  </button>
                ))}
              </div>

              {/* Send button — always visible */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendEmailOpen(true)}
                className="gap-1.5 h-8 text-xs w-full justify-center rounded-xl border-border/50"
              >
                <Send className="h-3 w-3" strokeWidth={1.5} /> Enviar inmueble
              </Button>

              {/* Edit + Download — only for non-collaborator */}
              {!isCollaboratorView && (
                <>
                  <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs w-full justify-center rounded-xl border-border/50">
                        <Pencil className="h-3 w-3" strokeWidth={1.5} /> Editar {displayId}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[620px] max-h-[80vh] overflow-hidden flex flex-col p-0 rounded-2xl">
                      <DialogHeader className="px-8 pt-7 pb-0">
                        <DialogTitle className="text-sm font-semibold tracking-tight">Editar {displayId}</DialogTitle>
                      </DialogHeader>
                      <EditUnitForm
                        unit={unit}
                        onClose={() => setEditDialogOpen(false)}
                        onSave={(updates) => {
                          onUpdateUnit?.(unit.id, updates);
                          setEditDialogOpen(false);
                        }}
                      />
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs w-full justify-center rounded-xl border-border/50">
                    <Download className="h-3 w-3" strokeWidth={1.5} /> Descargar ficha
                  </Button>
                </>
              )}

              {/* Status info — only for non-collaborator */}
              {!isCollaboratorView && unit.status === "available" && (
                <Dialog open={reserveDialogOpen} onOpenChange={setReserveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 h-8 text-xs w-full rounded-xl">
                      <Bookmark className="h-3 w-3" strokeWidth={1.5} /> Reservar unidad
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-sm">Reservar {displayId}</DialogTitle>
                    </DialogHeader>
                    <ReserveForm unit={unit} onClose={() => setReserveDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}

              {!isCollaboratorView && unit.status === "reserved" && (
                <div className="space-y-1.5">
                  <div className="rounded-xl bg-warning/10 border border-warning/30 px-3.5 py-2.5 text-xs">
                    <p className="font-medium text-warning">Reservada por {unit.clientName}</p>
                    {unit.agencyName && <p className="text-warning/80 mt-0.5">vía {unit.agencyName}</p>}
                    {unit.reservedAt && <p className="text-warning/70 mt-0.5">{unit.reservedAt}</p>}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs w-full rounded-xl">
                    <Send className="h-3 w-3" strokeWidth={1.5} /> Avisar colaboradores
                  </Button>
                </div>
              )}

              {!isCollaboratorView && unit.status === "sold" && (
                <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs">
                  <p className="font-medium text-primary">Vendida a {unit.clientName}</p>
                  {unit.agencyName && <p className="text-primary/80 mt-0.5">vía {unit.agencyName}</p>}
                  {unit.soldAt && <p className="text-primary/70 mt-0.5">{unit.soldAt}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Send email dialog (template picker + WYSIWYG) */}
        <SendEmailDialog
          open={sendEmailOpen}
          onOpenChange={setSendEmailOpen}
          defaultAudience="client"
          mode="unit"
          promotionId={unit.promotionId}
          unitId={unit.id}
        />
      </td>
    </tr>
  );
}

/* ── Mock promotion photos for demo ── */
const mockPromoFotos = Array.from({ length: 6 }, (_, i) => ({
  id: `promo-${i}`,
  url: `https://picsum.photos/400/300?random=${i + 100}`,
  nombre: `Foto promo ${i + 1}`,
}));

const mockPromoVideos = [
  { id: "pv-1", url: "https://youtube.com/watch?v=demo1", nombre: "Recorrido promoción" },
];

/* ── Edit Unit Form ── */
function EditUnitForm({ unit, onClose, onSave }: { unit: Unit; onClose: () => void; onSave: (updates: Partial<Unit>) => void }) {
  const isUni = /^(villa|chalet|unifamiliar|pareado|adosado)$/i.test(unit.type ?? "");
  const [price, setPrice] = useState(unit.price);
  const [builtArea, setBuiltArea] = useState(unit.builtArea);
  const [usableArea, setUsableArea] = useState(unit.usableArea);
  const [terrace, setTerrace] = useState(unit.terrace);
  const [parcel, setParcel] = useState(unit.parcel);
  const [bedrooms, setBedrooms] = useState(unit.bedrooms);
  const [bathrooms, setBathrooms] = useState(unit.bathrooms);
  const [orientation, setOrientation] = useState(unit.orientation);
  const [subtipo, setSubtipo] = useState("apartamento");
  const [planta, setPlanta] = useState(unit.floor);
  const [door, setDoor] = useState(unit.door);
  const [customPublicId, setCustomPublicId] = useState(unit.publicId ?? "");
  const [vistas, setVistas] = useState<string[]>([]);
  const [caracteristicas, setCaracteristicas] = useState<string[]>([]);
  const [parking, setParking] = useState(false);
  const [trastero, setTrastero] = useState(false);
  const [usarFotosPromo, setUsarFotosPromo] = useState(true);
  const [disabledPromoFotos, setDisabledPromoFotos] = useState<string[]>([]);
  const [unitFotos, setUnitFotos] = useState<{ id: string; url: string; nombre: string }[]>([]);
  const [unitVideos, setUnitVideos] = useState<{ id: string; url: string; nombre: string }[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  const { toast } = useToast();

  const toggleVista = (v: string) =>
    setVistas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const toggleCaracteristica = (v: string) =>
    setCaracteristicas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const togglePromoFoto = (id: string) =>
    setDisabledPromoFotos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const addMockUnitPhoto = () => {
    setUnitFotos(prev => [...prev, {
      id: `unit-foto-${Date.now()}`,
      url: `https://picsum.photos/400/300?random=${Date.now()}`,
      nombre: `Foto unidad ${prev.length + 1}`,
    }]);
  };

  const addVideo = () => {
    if (!videoUrl) return;
    setUnitVideos(prev => [...prev, { id: `uv-${Date.now()}`, url: videoUrl, nombre: videoUrl }]);
    setVideoUrl("");
  };

  const activePromoCount = mockPromoFotos.filter(f => !disabledPromoFotos.includes(f.id)).length;
  const generatedId = `${planta}º${door || "—"}`;

  const unitIdSchema = z.object({
    floor: z.number().int().min(0).max(99),
    door: z.string().trim().min(1, "La puerta es obligatoria").max(4, "Máximo 4 caracteres").regex(/^[A-Za-z0-9]+$/, "Solo letras y números"),
    customId: z.string().trim().max(40, "Máximo 40 caracteres").regex(/^[^\n\r]*$/, "La ID no puede tener saltos de línea").optional(),
  });

  const handleSave = () => {
    const parsed = unitIdSchema.safeParse({ floor: planta, door, customId: customPublicId });
    if (!parsed.success) {
      toast({
        title: "ID de unidad no válida",
        description: parsed.error.issues[0]?.message || "Revisa planta y puerta",
        variant: "destructive",
      });
      return;
    }

    onSave({
      floor: parsed.data.floor,
      door: parsed.data.door.toUpperCase(),
      publicId: parsed.data.customId?.trim() ? parsed.data.customId.trim() : undefined,
      price,
      builtArea,
      usableArea,
      terrace,
      parcel,
      bedrooms,
      bathrooms,
      orientation,
      type: subtipoOptions.find(o => o.value === subtipo)?.label || unit.type,
    });
  };

  const Field = ({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) => {
    // Campos de precio (€) se muestran con separador de miles "500.000"
    // para evitar confusión visual con valores pequeños.
    const isPrice = /precio|€/i.test(label);
    return (
      <div>
        <label className="text-xs text-muted-foreground font-medium">{label}</label>
        <div className="relative mt-0.5">
          {isPrice ? (
            <Input
              type="text"
              inputMode="numeric"
              value={Number(value || 0).toLocaleString("es-ES")}
              onChange={e => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                onChange(digits === "" ? 0 : Number(digits));
              }}
              className="h-8 text-xs pr-8 rounded-xl border-border/40 bg-muted/20 focus:bg-background tabular-nums"
            />
          ) : (
            <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="h-8 text-xs pr-8 rounded-xl border-border/40 bg-muted/20 focus:bg-background" />
          )}
          {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    );
  };

  const selectClass = "w-full h-8 rounded-xl border border-border/40 bg-muted/20 text-xs px-2.5 mt-0.5 focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors";

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-8 pt-4 pb-2">
        <p className="text-sm font-semibold text-foreground tracking-tight">{customPublicId.trim() || generatedId} · {unit.type}</p>
        <p className="text-xs text-muted-foreground">Ref: {unit.ref} · {priceForDisplay(unit)} · {unit.builtArea} m²</p>
      </div>

      <Tabs defaultValue="datos" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8">
          <div className="flex gap-0.5">
            {[
              { value: "datos", label: "Datos" },
              { value: "multimedia", label: "Multimedia" },
            ].map(tab => (
              <TabsList key={tab.value} className="bg-transparent p-0 h-auto">
                <TabsTrigger
                  value={tab.value}
                  className="rounded-full px-3.5 py-1 text-xs font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors shadow-none border-0 bg-transparent"
                >
                  {tab.label}
                </TabsTrigger>
              </TabsList>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-4">
          <TabsContent value="datos" className="mt-0 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Datos básicos</p>
              <div className={cn("grid gap-2.5", isUni ? "grid-cols-2" : "grid-cols-4")}>
                {/* Planta + Puerta solo en plurifamiliares · una villa
                  * no tiene planta ni puerta. */}
                {!isUni && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Planta</label>
                      <select value={planta} onChange={e => setPlanta(Number(e.target.value))} className={selectClass}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i} value={i}>{i === 0 ? "Planta Baja" : `Planta ${i}`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Puerta</label>
                      <Input value={door} onChange={e => setDoor(e.target.value.toUpperCase())}
                        className="h-8 text-xs mt-0.5 rounded-xl border-border/40 bg-muted/20 focus:bg-background" maxLength={4} />
                    </div>
                  </>
                )}
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Subtipo</label>
                  <select value={subtipo} onChange={e => setSubtipo(e.target.value)} className={selectClass}>
                    {subtipoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Orientación</label>
                  <select value={orientation} onChange={e => setOrientation(e.target.value)} className={selectClass}>
                    {orientaciones.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">ID visible</label>
                  <Input value={customPublicId} onChange={e => setCustomPublicId(e.target.value)}
                    placeholder={generatedId} className="h-8 text-xs mt-0.5 rounded-xl border-border/40 bg-muted/20 focus:bg-background" maxLength={40} />
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">Vacío = {generatedId}</p>
                </div>
                <Field label="Precio (€)" value={price} onChange={setPrice} />
              </div>
            </div>

            <div className="h-px bg-border/20" />

            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Superficies</p>
              <div className="grid grid-cols-4 gap-2.5">
                <Field label="Construidos" value={builtArea} onChange={setBuiltArea} suffix="m²" />
                <Field label="Útiles" value={usableArea} onChange={setUsableArea} suffix="m²" />
                <Field label="Terraza" value={terrace} onChange={setTerrace} suffix="m²" />
                <Field label="Parcela" value={parcel} onChange={setParcel} suffix="m²" />
              </div>
            </div>

            <div className="h-px bg-border/20" />

            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Habitaciones y extras</p>
              <div className="grid grid-cols-4 gap-2.5">
                <Field label="Dormitorios" value={bedrooms} onChange={setBedrooms} />
                <Field label="Baños" value={bathrooms} onChange={setBathrooms} />
                <div className="col-span-2 flex items-end gap-1.5 pb-0.5">
                  {([
                    { key: "parking", label: "Parking", val: parking, set: setParking },
                    { key: "trastero", label: "Trastero", val: trastero, set: setTrastero },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => t.set(!t.val)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                        t.val ? "bg-foreground text-background" : "bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}: {t.val ? "Sí" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-border/20" />

            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Vistas</p>
              <div className="flex flex-wrap gap-1.5">
                {vistaOptions.map(v => (
                  <button key={v.value} onClick={() => toggleVista(v.value)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all",
                      vistas.includes(v.value) ? "bg-foreground text-background" : "bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border/20" />

            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Características</p>
              <div className="flex flex-wrap gap-1.5">
                {caracteristicasOptions.map(c => (
                  <button key={c.value} onClick={() => toggleCaracteristica(c.value)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium transition-all",
                      caracteristicas.includes(c.value) ? "bg-foreground text-background" : "bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="multimedia" className="mt-0 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fotografías</p>
                <button
                  onClick={() => setUsarFotosPromo(!usarFotosPromo)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    usarFotosPromo ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {usarFotosPromo ? "Heredando promoción" : "Solo propias"}
                </button>
              </div>

              {usarFotosPromo && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    De la promoción · {activePromoCount}/{mockPromoFotos.length} activas — click para desactivar
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {mockPromoFotos.map(foto => {
                      const disabled = disabledPromoFotos.includes(foto.id);
                      return (
                        <button
                          key={foto.id}
                          onClick={() => togglePromoFoto(foto.id)}
                          className={cn(
                            "relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all",
                            disabled ? "border-border/40 opacity-40 grayscale" : "border-primary/60"
                          )}
                        >
                          <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" />
                          {!disabled && (
                            <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Propias de la unidad · {unitFotos.length}</p>
                <div className="grid grid-cols-4 gap-2">
                  {unitFotos.map(foto => (
                    <div key={foto.id} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border/60 group">
                      <img src={foto.url} alt={foto.nombre} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setUnitFotos(prev => prev.filter(f => f.id !== foto.id))}
                        className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5 text-destructive-foreground" strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addMockUnitPhoto}
                    className="aspect-[4/3] rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Upload className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-[10px] font-medium">Subir</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Vídeos</p>
              {mockPromoVideos.map(v => (
                <div key={v.id} className="flex items-center gap-2.5 py-1.5">
                  <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-xs text-muted-foreground truncate flex-1">{v.nombre}</span>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Promoción</span>
                </div>
              ))}
              {unitVideos.map(v => (
                <div key={v.id} className="flex items-center gap-2.5 py-1.5">
                  <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <span className="text-xs text-foreground truncate flex-1">{v.nombre}</span>
                  <button onClick={() => setUnitVideos(prev => prev.filter(x => x.id !== v.id))} className="h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="URL de YouTube o Vimeo..." className="pl-8 h-8 text-xs border-border/60" />
                </div>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-8 rounded-xl" onClick={addVideo}>
                  Añadir
                </Button>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Planos</p>
              <button className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/60 px-4 py-5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                <Upload className="h-4 w-4" strokeWidth={1.5} />
                Subir planos de la unidad
              </button>
            </div>

            <div className="h-px bg-border/40" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Documentos</p>
              {[
                { label: "Brochure", desc: "Heredado de la promoción" },
                { label: "Memoria de calidades", desc: "Heredado de la promoción" },
              ].map((doc, i) => (
                <div key={doc.label}>
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{doc.label}</p>
                        <p className="text-[10px] text-muted-foreground">{doc.desc}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1">
                      <Upload className="h-3 w-3" /> Sustituir
                    </Button>
                  </div>
                  {i === 0 && <div className="h-px bg-border/30 mt-1" />}
                </div>
              ))}
            </div>
          </TabsContent>
        </div>

        <div className="flex items-center gap-2 border-t border-border/20 px-8 py-4">
          <Button className="flex-1 h-9 text-xs rounded-xl gap-1.5" onClick={handleSave}>
            <Check className="h-3 w-3" strokeWidth={1.5} /> Guardar cambios
          </Button>
          <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </Tabs>
    </div>
  );
}

/* ── Reserve form ── */
function ReserveForm({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const displayId = getUnitDisplayId(unit);

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="rounded-xl bg-muted/40 px-3.5 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Unidad</span>
          <span className="font-semibold text-foreground">{displayId} · {unit.type}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-muted-foreground">Precio</span>
          <span className="font-semibold text-foreground">{priceForDisplay(unit)}</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium">Nombre del cliente *</label>
        <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre completo" className="h-8 text-xs mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground font-medium">Email</label>
          <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@ejemplo.com" className="h-8 text-xs mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium">Teléfono</label>
          <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+34 600 000 000" className="h-8 text-xs mt-1" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium">Notas</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notas adicionales sobre la reserva..."
          className="w-full h-16 rounded-xl border border-border bg-background text-xs px-3 py-2 mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button className="flex-1 h-8 text-xs rounded-xl gap-1.5" disabled={!clientName}>
          <Bookmark className="h-3 w-3" strokeWidth={1.5} /> Confirmar reserva
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
