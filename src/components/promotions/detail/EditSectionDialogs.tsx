/**
 * EditSectionDialogs
 * ------------------
 * Conjunto de diálogos que editan cada subsección de la ficha de promoción
 * Byvaro. Todos comparten el wrapper <EditDialogShell> (header + scroll + footer
 * con Cancelar / Guardar) y el helper <SectionTitle>.
 *
 * Diálogos exportados (orden de aparición en el archivo):
 *   1.  EditMultimediaDialog     -> sube/reordena fotos, videos (YouTube/Vimeo), marca portada.
 *   2.  EditBasicInfoDialog      -> tipos de vivienda + amenities comunes + features.
 *   3.  EditStructureDialog      -> fase de obra + % progreso (tipo y estructura read-only).
 *   4.  EditDescriptionDialog    -> descripción multilingüe con IA (generar + traducir).
 *   5.  EditLocationDialog       -> dirección única (fuente de verdad del mapa).
 *   6.  EditPaymentPlanDialog    -> importe reserva, % entrada y etapas de pago dinámicas.
 *   7.  EditShowHouseDialog      -> piso piloto: disponibilidad, dirección y horario.
 *   8.  EditDocumentDialog       -> uploader genérico (memoria, planos, brochure, etc.).
 *   9.  EditContactsDialog       -> web / teléfono / email públicos.
 *   10. EditSalesOfficesDialog   -> puntos de venta físicos (CRUD inline).
 *   11. EditInventoryDialog      -> redirección informativa al tab Disponibilidad.
 *   12. EditBrochureDialog       -> alias legacy de EditDocumentDialog (icon=BookOpen).
 *   13. PickTeamMembersDialog    -> multi-select visual de miembros + permisos por miembro.
 *   14. PickSalesOfficesDialog   -> multi-select visual de oficinas ya existentes en la empresa.
 *
 * Props clave (firma genérica):
 *   - open: boolean
 *   - onOpenChange: (v: boolean) => void
 *   - onSave: callback tipado por cada diálogo (payload distinto).
 *   Cada diálogo añade campos iniciales (images, description, location, offices…).
 *
 * Dependencias:
 *   - @/components/ui/dialog     -> Radix dialog wrapper.
 *   - @/components/ui/button     -> Acciones footer + inline.
 *   - @/components/ui/input      -> Campos de texto corto.
 *   - @/components/ui/textarea   -> Descripciones largas multilingües.
 *   - @/components/ui/switch     -> Toggles (piso piloto).
 *   - @/components/ui/avatar     -> Tarjetas de miembros del equipo.
 *   - @/components/ui/checkbox   -> (reservado; no usado actualmente).
 *   - @/lib/utils (cn)           -> Composición de classnames.
 *   - lucide-react               -> Iconografía.
 *
 * Tokens Byvaro usados:
 *   - primary / primary/5 / primary/10 / primary/20 / primary/30 / primary/40
 *   - destructive / destructive/10   (botones destructivos y eliminación)
 *   - muted / muted-foreground / border/20|30|40|60 / card / foreground / background
 *   - amber-500 (excepción permitida para "portada" / warnings suaves)
 *   - bg-foreground/40 / bg-foreground/60  (overlays antes bg-black/X)
 *   - text-background (antes text-white sobre acentos)
 *   - shadow-soft / shadow-soft-lg · rounded-2xl (paneles) · rounded-xl (cards)
 *     · rounded-lg (inputs/botones) · rounded-full (pills/avatars)
 *
 * TODO(backend):
 *   - PATCH /api/promociones/:id/multimedia   (EditMultimediaDialog)
 *   - PATCH /api/promociones/:id              (EditBasicInfoDialog, EditStructureDialog,
 *                                              EditLocationDialog, EditContactsDialog,
 *                                              EditShowHouseDialog)
 *   - PATCH /api/promociones/:id/descripciones   (EditDescriptionDialog, i18n)
 *   - POST  /api/ia/describir                 (generador IA de descripción)
 *   - POST  /api/ia/traducir                  (traducción masiva)
 *   - PATCH /api/promociones/:id/plan-pagos   (EditPaymentPlanDialog)
 *   - POST  /api/promociones/:id/documentos   (EditDocumentDialog / EditBrochureDialog)
 *   - POST  /api/promociones/:id/puntos-venta (EditSalesOfficesDialog, PickSalesOfficesDialog)
 *   - POST  /api/promociones/:id/miembros     (PickTeamMembersDialog + permisos)
 * TODO(ui):
 *   - Drag&drop real en EditMultimediaDialog (hoy es mover con botón ±1).
 *   - Validación de URL de video antes de guardarla.
 *   - Validación de teléfono/email/web (zod) en EditContactsDialog.
 *   - Mostrar diff antes de guardar en diálogos con muchos campos.
 *   - Feedback de éxito/fallo tras el onSave (toast).
 */
import { useState, useRef } from "react";
// Primitivas del dialog (shadcn wrapper de Radix)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
// Avatar para tarjetas de miembros del equipo en PickTeamMembersDialog
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
// Iconografía: acciones (Upload, Trash2, Plus, X, Pencil, Search, Check, UserPlus),
// tipos de contenido (FileText, BookOpen, Video, Star, Layers, Store, Building2),
// ubicación/contacto (MapPin, Phone, Mail, Globe), edición textual (PenLine, Sparkles,
// Languages), miscelánea (GripVertical, Eye).
import {
  Upload, Trash2, GripVertical, Star, Video,
  Plus, X, MapPin, FileText, Sparkles, Languages, PenLine,
  Phone, Mail, Globe, BookOpen, Eye, Layers, Store, Building2, Pencil, Search, Check, UserPlus,
} from "lucide-react";

// ═══ SHARED WRAPPER ═══
function EditDialogShell({
  open, onOpenChange, title, description, onSave, onCancel, children, maxWidth = "max-w-2xl", saveLabel = "Guardar cambios",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  saveLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidth} bg-muted border-border/40 p-0 gap-0 max-h-[85vh] flex flex-col`}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/30">
          <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>
        <DialogFooter className="px-6 py-4 border-t border-border/30 gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full text-sm h-9 px-4">Cancelar</Button>
          <Button size="sm" onClick={onSave} className="rounded-full text-sm h-9 px-5">{saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{children}</p>;
}

// ═══ MULTIMEDIA EDIT ═══
export function EditMultimediaDialog({ open, onOpenChange, images, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; images: string[]; onSave: (imgs: string[]) => void;
}) {
  const [photos, setPhotos] = useState(images);
  const [coverIdx, setCoverIdx] = useState(0);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newVideo, setNewVideo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      setPhotos(p => [...p, url]);
    });
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const arr = [...photos];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setPhotos(arr);
    if (coverIdx === from) setCoverIdx(to);
    else if (coverIdx === to) setCoverIdx(from);
  };

  const addVideo = () => {
    if (!newVideo.trim()) return;
    setVideoUrls(v => [...v, newVideo.trim()]);
    setNewVideo("");
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar multimedia"
      description="Sube, reordena y gestiona fotografías y videos."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(photos); onOpenChange(false); }}
      maxWidth="max-w-3xl"
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionTitle>Fotografías · {photos.length}</SectionTitle>
            <p className="text-xs text-muted-foreground mt-1">Pasa el cursor para reordenar. La foto con estrella es la portada.</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full h-9 gap-1.5 text-sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Subir fotos
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {photos.map((src, i) => (
            <div key={i} className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-muted border border-border/40">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => setCoverIdx(i)} className="h-8 w-8 rounded-full bg-background/90 flex items-center justify-center hover:bg-background" title="Establecer como principal">
                  <Star className={`h-3.5 w-3.5 ${coverIdx === i ? "fill-amber-500 text-amber-500" : "text-foreground"}`} />
                </button>
                <button onClick={() => movePhoto(i, i - 1)} disabled={i === 0} className="h-8 w-8 rounded-full bg-background/90 flex items-center justify-center hover:bg-background disabled:opacity-30" title="Mover a la izquierda">
                  <GripVertical className="h-3.5 w-3.5 text-foreground -rotate-90" />
                </button>
                <button onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))} className="h-8 w-8 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/90" title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5 text-destructive-foreground" />
                </button>
              </div>
              {coverIdx === i && (
                <div className="absolute top-2 left-2 bg-amber-500 text-background text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 fill-current" /> Portada
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-foreground/60 text-background text-[10px] font-semibold px-1.5 py-0.5 rounded-lg">{i + 1}</div>
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} className="aspect-[4/3] rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors">
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Añadir foto</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Videos · {videoUrls.length}</SectionTitle>
        <p className="text-xs text-muted-foreground mt-1 mb-3">URL de YouTube o Vimeo.</p>
        <div className="flex gap-2 mb-3">
          <Input value={newVideo} onChange={e => setNewVideo(e.target.value)} placeholder="https://youtube.com/..." className="h-9 rounded-full text-sm flex-1" />
          <Button size="sm" variant="outline" className="rounded-full h-9 gap-1.5 text-sm" onClick={addVideo}>
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        {videoUrls.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/40 rounded-xl">
            <Video className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
            Aún no hay videos
          </div>
        ) : (
          <div className="space-y-2">
            {videoUrls.map((u, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/30 bg-muted/30">
                <Video className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate">{u}</span>
                <button onClick={() => setVideoUrls(v => v.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </EditDialogShell>
  );
}

// ═══ BASIC INFORMATION EDIT (NO location — that has its own dialog) ═══
const ALL_AMENITIES = ["Piscina", "Gimnasio", "Jardín", "Seguridad", "Parking", "Spa", "Conserje", "Pista de pádel", "Co-working", "Zona infantil"];
const ALL_FEATURES = ["Cocina equipada", "Aire acondicionado", "Terraza", "Domótica", "Suelo radiante", "Vestidor", "Vistas al mar", "Jardín privado"];
const PROPERTY_TYPES = ["Apartamento", "Ático", "Villa", "Adosado", "Estudio", "Dúplex", "Chalet"];

export function EditBasicInfoDialog({ open, onOpenChange, propertyTypes, amenities = [], features = [], onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyTypes: string[];
  amenities?: string[];
  features?: string[];
  onSave: (data: { propertyTypes: string[]; amenities: string[]; features: string[] }) => void;
}) {
  const [types, setTypes] = useState(propertyTypes);
  const [ams, setAms] = useState(amenities.length ? amenities : ["Piscina", "Gimnasio", "Jardín", "Seguridad", "Parking"]);
  const [feats, setFeats] = useState(features.length ? features : ["Cocina equipada", "Aire acondicionado", "Terraza", "Domótica"]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(a => a !== val) : [...arr, val]);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar información básica"
      description="Tipos de vivienda, amenities y características de la vivienda. Usa la sección Ubicación para cambiar la dirección."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave({ propertyTypes: types, amenities: ams, features: feats }); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Tipos de vivienda</SectionTitle>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PROPERTY_TYPES.map(t => (
            <button key={t} onClick={() => toggle(types, setTypes, t)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                types.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border/60 hover:text-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Amenities comunes</SectionTitle>
        <p className="text-xs text-muted-foreground mt-1 mb-3">Espacios y servicios compartidos.</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_AMENITIES.map(a => (
            <button key={a} onClick={() => toggle(ams, setAms, a)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                ams.includes(a) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border/60 hover:text-foreground")}>
              {ams.includes(a) && <span className="mr-1">✓</span>}{a}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Características de la vivienda</SectionTitle>
        <p className="text-xs text-muted-foreground mt-1 mb-3">Características incluidas en cada vivienda.</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_FEATURES.map(f => (
            <button key={f} onClick={() => toggle(feats, setFeats, f)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                feats.includes(f) ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border/60 hover:text-foreground")}>
              {feats.includes(f) && <span className="mr-1">✓</span>}{f}
            </button>
          ))}
        </div>
      </div>
    </EditDialogShell>
  );
}

// ═══ STRUCTURE & CONSTRUCTION (read-only summary + edit construction progress only) ═══
const CONSTRUCTION_PHASES = ["Planificación", "Cimentación", "Estructura", "Acabados", "Finalizada"];

export function EditStructureDialog({ open, onOpenChange, type, structure, phase, progress, onSave, onOpenWizard }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: string;
  structure: string;
  phase: string;
  progress: number;
  onSave: (data: { phase: string; progress: number }) => void;
  onOpenWizard?: () => void;
}) {
  const [ph, setPh] = useState(phase);
  const [pr, setPr] = useState(progress);

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar estado de construcción"
      description="Actualiza la fase de obra y el progreso. El tipo de vivienda y la estructura se definen al crear la promoción."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave({ phase: ph, progress: pr }); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5 grid grid-cols-2 gap-4">
        <div>
          <SectionTitle>Tipo de vivienda</SectionTitle>
          <div className="mt-2 h-9 rounded-full bg-muted/40 border border-border/30 px-4 flex items-center text-sm text-muted-foreground">{type || "—"}</div>
        </div>
        <div>
          <SectionTitle>Estructura</SectionTitle>
          <div className="mt-2 h-9 rounded-full bg-muted/40 border border-border/30 px-4 flex items-center text-sm text-muted-foreground">{structure || "—"}</div>
        </div>
        {onOpenWizard && (
          <button onClick={onOpenWizard} className="col-span-2 text-[10px] text-primary hover:underline text-left -mt-1">
            Cambiar en el asistente de configuración de la promoción →
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border/20 p-5 space-y-4">
        <div>
          <SectionTitle>Fase de construcción</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {CONSTRUCTION_PHASES.map(p => (
              <button key={p} onClick={() => setPh(p)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  ph === p ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border/60 hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>Progreso</SectionTitle>
            <span className="text-sm font-semibold text-foreground tabular-nums">{pr}%</span>
          </div>
          <input type="range" min={0} max={100} value={pr} onChange={e => setPr(Number(e.target.value))} className="w-full accent-primary" />
        </div>
      </div>
    </EditDialogShell>
  );
}

// ═══ DESCRIPTION EDIT — multilingual + AI ═══
const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

export function EditDescriptionDialog({ open, onOpenChange, description, descriptions = {}, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  description: string;
  descriptions?: Record<string, string>;
  onSave: (data: { description: string; descriptions: Record<string, string> }) => void;
}) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [activeLang, setActiveLang] = useState("en");
  const [base, setBase] = useState(description);
  const [translations, setTranslations] = useState<Record<string, string>>(descriptions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const getValue = (code: string) => code === "en" ? (base || translations["en"] || "") : (translations[code] || "");
  const setValue = (code: string, v: string) => {
    if (code === "en") setBase(v);
    else setTranslations(t => ({ ...t, [code]: v }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setBase("Esta es una promoción de lujo situada en una zona privilegiada, con arquitectura excepcional, amenities premium y vistas inmejorables. Cada unidad ha sido cuidadosamente diseñada para combinar elegancia, confort y funcionalidad, ofreciendo una experiencia única a los compradores más exigentes.");
      setIsGenerating(false);
    }, 900);
  };

  const handleTranslateAll = () => {
    const src = getValue("en");
    if (!src) return;
    setIsTranslating(true);
    setTimeout(() => {
      const next: Record<string, string> = { ...translations };
      LANGUAGES.forEach(l => {
        if (l.code !== "en") next[l.code] = `[${l.label}] ${src}`;
      });
      setTranslations(next);
      setIsTranslating(false);
    }, 1200);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar descripción"
      description="Escribe o genera la descripción pública. Traduce a varios idiomas con IA."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave({ description: base, descriptions: translations }); onOpenChange(false); }}
      maxWidth="max-w-3xl"
    >
      {/* Mode selector */}
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Modo de generación</SectionTitle>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setMode("manual")}
            className={cn("flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              mode === "manual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            <PenLine className="h-3.5 w-3.5" /> Escribir manualmente
          </button>
          <button onClick={() => setMode("ai")}
            className={cn("flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              mode === "ai" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            <Sparkles className="h-3.5 w-3.5" /> Generar con IA
          </button>
        </div>
        {mode === "ai" && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-foreground">La IA redactará una descripción a partir de la ubicación, amenities y características de esta promoción.</p>
            <Button size="sm" className="rounded-full h-8 gap-1.5 text-xs" onClick={handleGenerate} disabled={isGenerating}>
              <Sparkles className="h-3 w-3" /> {isGenerating ? "Generando…" : "Generar"}
            </Button>
          </div>
        )}
      </div>

      {/* Languages + editor */}
      <div className="rounded-2xl bg-card border border-border/20 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <SectionTitle>Traducciones</SectionTitle>
          </div>
          <Button variant="outline" size="sm" className="rounded-full h-8 text-xs gap-1.5" onClick={handleTranslateAll} disabled={isTranslating || !getValue("en")}>
            <Sparkles className="h-3 w-3" /> {isTranslating ? "Traduciendo…" : "Traducir todo con IA"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map(l => {
            const has = !!getValue(l.code);
            return (
              <button key={l.code} onClick={() => setActiveLang(l.code)}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeLang === l.code ? "border-primary bg-primary/10 text-primary"
                    : has ? "border-primary/30 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                <span>{l.flag}</span> {l.label}
                {has && activeLang !== l.code && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <Textarea
          value={getValue(activeLang)}
          onChange={e => setValue(activeLang, e.target.value)}
          placeholder={`Descripción en ${LANGUAGES.find(l => l.code === activeLang)?.label}...`}
          className="min-h-[200px] rounded-2xl text-sm resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">{getValue(activeLang).length} / 2000</p>
      </div>
    </EditDialogShell>
  );
}

// ═══ LOCATION EDIT (single source of truth) ═══
export function EditLocationDialog({ open, onOpenChange, location, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; location: string; onSave: (d: string) => void;
}) {
  const [loc, setLoc] = useState(location);
  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar ubicación"
      description="Define la dirección. El mapa y la ubicación mostrada en la promoción se actualizarán."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(loc); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <SectionTitle>Dirección</SectionTitle>
        <div className="relative mt-2">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Calle, ciudad, provincia" className="h-9 rounded-full pl-9 text-sm" />
        </div>
        <div className="mt-4 h-[200px] rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center text-xs text-muted-foreground">
          <div className="text-center">
            <MapPin className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            Vista previa del mapa · {loc || "sin dirección"}
          </div>
        </div>
      </div>
    </EditDialogShell>
  );
}

// ═══ PAYMENT PLAN EDIT ═══
export function EditPaymentPlanDialog({ open, onOpenChange, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSave: () => void;
}) {
  const [reservation, setReservation] = useState("15000");
  const [downpayment, setDownpayment] = useState("20");
  const [stages, setStages] = useState([
    { label: "Reserva", percent: 5, when: "A la firma" },
    { label: "Entrada", percent: 20, when: "En 30 días" },
    { label: "Hitos de construcción", percent: 30, when: "Por hito" },
    { label: "Entrega", percent: 45, when: "Entrega de llaves" },
  ]);

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar plan de pagos"
      description="Define la estructura de pagos del comprador etapa por etapa."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5 grid grid-cols-2 gap-4">
        <div>
          <SectionTitle>Importe de reserva (€)</SectionTitle>
          <Input value={reservation} onChange={e => setReservation(e.target.value)} className="h-9 rounded-full mt-2 text-sm" />
        </div>
        <div>
          <SectionTitle>Entrada (%)</SectionTitle>
          <Input value={downpayment} onChange={e => setDownpayment(e.target.value)} className="h-9 rounded-full mt-2 text-sm" />
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Etapas de pago</SectionTitle>
          <Button size="sm" variant="outline" className="rounded-full h-9 gap-1.5 text-sm"
            onClick={() => setStages([...stages, { label: "Nueva etapa", percent: 0, when: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Añadir etapa
          </Button>
        </div>
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/30">
              <Input value={s.label} onChange={e => { const arr = [...stages]; arr[i] = { ...s, label: e.target.value }; setStages(arr); }} className="h-9 rounded-full text-sm flex-1" />
              <Input value={s.percent} type="number" onChange={e => { const arr = [...stages]; arr[i] = { ...s, percent: Number(e.target.value) }; setStages(arr); }} className="h-9 rounded-full text-sm w-20" />
              <Input value={s.when} onChange={e => { const arr = [...stages]; arr[i] = { ...s, when: e.target.value }; setStages(arr); }} className="h-9 rounded-full text-sm flex-1" />
              <button onClick={() => setStages(stages.filter((_, idx) => idx !== i))} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-right">
          Total: <span className="font-semibold tabular-nums text-foreground">{stages.reduce((sum, s) => sum + s.percent, 0)}%</span>
        </p>
      </div>
    </EditDialogShell>
  );
}

// ═══ SHOW HOUSE EDIT ═══
export function EditShowHouseDialog({ open, onOpenChange, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSave: () => void;
}) {
  const [available, setAvailable] = useState(true);
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("Lun–Vie 10:00–18:00");

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar piso piloto"
      description="Configura la ubicación y el horario de visitas del piso piloto."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Piso piloto disponible</SectionTitle>
            <p className="text-xs text-muted-foreground mt-1">Los compradores pueden visitar una unidad modelo amueblada.</p>
          </div>
          <Switch checked={available} onCheckedChange={setAvailable} />
        </div>
        {available && (
          <>
            <div>
              <SectionTitle>Dirección</SectionTitle>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección del piso piloto" className="h-9 rounded-full mt-2 text-sm" />
            </div>
            <div>
              <SectionTitle>Horario de visitas</SectionTitle>
              <Input value={hours} onChange={e => setHours(e.target.value)} className="h-9 rounded-full mt-2 text-sm" />
            </div>
          </>
        )}
      </div>
    </EditDialogShell>
  );
}

// ═══ DOCUMENT UPLOAD (generic — Memoria, Planos, Brochure) ═══
type DocFileEntry = { id: string; name: string; size: string };

export function EditDocumentDialog({ open, onOpenChange, title, description, accept = ".pdf", icon: Icon = FileText, multiple = false, files: initialFiles = [], onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  accept?: string;
  icon?: React.ElementType;
  multiple?: boolean;
  files?: DocFileEntry[];
  onSave: (files: DocFileEntry[]) => void;
}) {
  const [files, setFiles] = useState<DocFileEntry[]>(initialFiles);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).map(f => ({
      id: `f-${Date.now()}-${f.name}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    setFiles(prev => multiple ? [...prev, ...newFiles] : newFiles);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(files); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <div className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center">
          <Icon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-foreground font-medium">Arrastra los archivos aquí</p>
          <p className="text-xs text-muted-foreground mt-1">o</p>
          <Button size="sm" variant="outline" className="rounded-full h-9 mt-3 text-sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Elegir {multiple ? "archivos" : "archivo"}
          </Button>
          <input ref={fileRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleUpload} />
          <p className="text-[10px] text-muted-foreground mt-3">{accept.toUpperCase().replace(/\./g, "")} · Máx. 20MB</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            <SectionTitle>Archivos ({files.length})</SectionTitle>
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 bg-muted/30">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.size}</p>
                </div>
                <button onClick={() => setFiles(files.filter(x => x.id !== f.id))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </EditDialogShell>
  );
}

// ═══ CONTACTS EDIT ═══
export function EditContactsDialog({ open, onOpenChange, website, phone, email, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; website?: string; phone?: string; email?: string;
  onSave: (d: { website: string; phone: string; email: string }) => void;
}) {
  const [w, setW] = useState(website || "");
  const [p, setP] = useState(phone || "");
  const [e, setE] = useState(email || "");

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar contactos"
      description="Información de contacto pública mostrada a compradores y agencias colaboradoras."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave({ website: w, phone: p, email: e }); onOpenChange(false); }}
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5 space-y-4">
        <div>
          <SectionTitle>Web</SectionTitle>
          <div className="relative mt-2">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={w} onChange={ev => setW(ev.target.value)} placeholder="https://..." className="h-9 rounded-full pl-9 text-sm" />
          </div>
        </div>
        <div>
          <SectionTitle>Teléfono</SectionTitle>
          <div className="relative mt-2">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={p} onChange={ev => setP(ev.target.value)} placeholder="+34 ..." className="h-9 rounded-full pl-9 text-sm" />
          </div>
        </div>
        <div>
          <SectionTitle>Email</SectionTitle>
          <div className="relative mt-2">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={e} onChange={ev => setE(ev.target.value)} placeholder="sales@..." className="h-9 rounded-full pl-9 text-sm" />
          </div>
        </div>
      </div>
    </EditDialogShell>
  );
}

// ═══ SALES OFFICES EDIT ═══
export type SalesOffice = { id: string; nombre: string; direccion: string; telefono: string; email: string; whatsapp?: string; coverUrl?: string };

export function EditSalesOfficesDialog({ open, onOpenChange, offices: initial, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  offices: SalesOffice[];
  onSave: (offices: SalesOffice[]) => void;
}) {
  const [offices, setOffices] = useState<SalesOffice[]>(initial);
  const [editing, setEditing] = useState<SalesOffice | null>(null);

  const startNew = () => setEditing({ id: `pv-${Date.now()}`, nombre: "", direccion: "", telefono: "", email: "", whatsapp: "" });
  const saveOffice = () => {
    if (!editing) return;
    setOffices(prev => {
      const exists = prev.find(o => o.id === editing.id);
      return exists ? prev.map(o => o.id === editing.id ? editing : o) : [...prev, editing];
    });
    setEditing(null);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar puntos de venta"
      description="Oficinas físicas donde los compradores pueden acudir. Se configuraron inicialmente al crear la promoción."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onSave(offices); onOpenChange(false); }}
      maxWidth="max-w-2xl"
    >
      <div className="rounded-2xl bg-card border border-border/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Puntos de venta · {offices.length}</SectionTitle>
          {!editing && (
            <Button size="sm" variant="outline" className="rounded-full h-8 gap-1.5 text-xs" onClick={startNew}>
              <Plus className="h-3 w-3" /> Añadir punto de venta
            </Button>
          )}
        </div>

        {offices.length === 0 && !editing && (
          <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border/40 rounded-xl">
            <Store className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
            Aún no hay puntos de venta
          </div>
        )}

        {!editing && (
          <div className="space-y-2">
            {offices.map(o => (
              <div key={o.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/30 bg-muted/20 group">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{o.nombre}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{o.direccion}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    {o.telefono && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {o.telefono}</span>}
                    {o.email && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {o.email}</span>}
                  </div>
                </div>
                {/* Acciones siempre visibles (antes hover-only — invisible en móvil) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing(o)}
                    aria-label={`Editar ${o.nombre}`}
                    className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffices(offices.filter(x => x.id !== o.id))}
                    aria-label={`Quitar ${o.nombre}`}
                    className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="space-y-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
            <p className="text-xs font-semibold text-foreground">{offices.find(o => o.id === editing.id) ? "Editar punto de venta" : "Nuevo punto de venta"}</p>
            <Input value={editing.nombre} onChange={e => setEditing({ ...editing, nombre: e.target.value })} placeholder="Nombre del punto de venta" className="h-9 rounded-full text-sm" />
            <Input value={editing.direccion} onChange={e => setEditing({ ...editing, direccion: e.target.value })} placeholder="Dirección" className="h-9 rounded-full text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={editing.telefono} onChange={e => setEditing({ ...editing, telefono: e.target.value })} placeholder="Teléfono" className="h-9 rounded-full text-sm" />
              <Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="Email" className="h-9 rounded-full text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" className="rounded-full h-8 text-xs" onClick={saveOffice} disabled={!editing.nombre}>Guardar punto de venta</Button>
            </div>
          </div>
        )}
      </div>
    </EditDialogShell>
  );
}

// ═══ INVENTORY (SUMMARY) — redirects to Availability tab ═══
export function EditInventoryDialog({ open, onOpenChange, onGoAvailability }: {
  open: boolean; onOpenChange: (v: boolean) => void; onGoAvailability: () => void;
}) {
  return (
    <EditDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar inventario"
      description="El inventario se gestiona unidad por unidad en la pestaña Disponibilidad."
      onCancel={() => onOpenChange(false)}
      onSave={() => { onGoAvailability(); onOpenChange(false); }}
      saveLabel="Ir a Disponibilidad"
    >
      <div className="rounded-2xl bg-card border border-border/20 p-6 text-center">
        <Layers className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm font-semibold text-foreground">Gestiona las unidades en Disponibilidad</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
          Añade, edita precios, estados y detalles unidad por unidad.
        </p>
      </div>
    </EditDialogShell>
  );
}

// Re-export legacy name for backward compat (Brochure) — now uses generic EditDocumentDialog
export function EditBrochureDialog(props: { open: boolean; onOpenChange: (v: boolean) => void; onSave: () => void }) {
  return (
    <EditDocumentDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Subir brochure"
      description="Sube el brochure oficial en PDF para compradores y agentes."
      icon={BookOpen}
      onSave={() => props.onSave()}
    />
  );
}

// ═══ PICK TEAM MEMBERS (visual multi-select with per-member permissions) ═══
export type PickableMember = {
  id: string;
  name: string;
  role?: string;
  email: string;
  avatar?: string;
};

export type MemberPermissions = {
  canRegister: boolean;
  canShareWithAgencies: boolean;
  canEdit: boolean;
};

export type PickedMemberWithPerms = PickableMember & { permissions: MemberPermissions };

const DEFAULT_PERMS: MemberPermissions = { canRegister: true, canShareWithAgencies: false, canEdit: false };

export function PickTeamMembersDialog({
  open, onOpenChange, pool, alreadyAddedIds, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pool: PickableMember[];
  alreadyAddedIds: string[];
  onConfirm: (members: PickedMemberWithPerms[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, MemberPermissions>>({});

  const available = pool.filter(m => !alreadyAddedIds.includes(m.id));
  const filtered = available.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.email.toLowerCase().includes(query.toLowerCase()) ||
    (m.role || "").toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { ...DEFAULT_PERMS };
      return next;
    });
  };

  const updatePerm = (id: string, key: keyof MemberPermissions, value: boolean) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const reset = () => { setSelected({}); setQuery(""); };

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;

  const handleConfirm = () => {
    const result: PickedMemberWithPerms[] = selectedIds
      .map(id => {
        const m = pool.find(p => p.id === id);
        return m ? { ...m, permissions: selected[id] } : null;
      })
      .filter((x): x is PickedMemberWithPerms => x !== null);
    onConfirm(result);
    reset();
    onOpenChange(false);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
      title="Añadir miembros del equipo"
      description="Elige miembros y configura los permisos de cada uno antes de añadirlos."
      onCancel={() => onOpenChange(false)}
      onSave={handleConfirm}
      saveLabel={selectedCount > 0 ? `Añadir ${selectedCount} miembro${selectedCount > 1 ? "s" : ""}` : "Añadir"}
      maxWidth="max-w-3xl"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, email o rol…"
          className="h-9 rounded-full text-sm pl-9 bg-card border-border/40"
        />
      </div>

      {/* Pool grid */}
      <div className="rounded-2xl bg-card border border-border/20 p-4">
        <SectionTitle>Miembros disponibles · {filtered.length}</SectionTitle>
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-foreground">No se encontraron miembros</p>
            <p className="text-xs text-muted-foreground mt-1">
              {available.length === 0 ? "Todos los miembros de tu equipo ya están añadidos." : "Prueba con otra búsqueda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {filtered.map(m => {
              const isSelected = !!selected[m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-soft-lg"
                      : "border-border/30 bg-background/50 hover:border-border/60 hover:bg-muted/30"
                  )}
                >
                  <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                    <AvatarImage src={m.avatar} alt={m.name} />
                    <AvatarFallback className="bg-muted text-[10px] font-medium">
                      {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.role || m.email}</p>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center transition-all shrink-0",
                    isSelected ? "bg-primary text-primary-foreground" : "border border-border/60"
                  )}>
                    {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions panel — per selected member */}
      {selectedCount > 0 && (
        <div className="rounded-2xl bg-card border border-border/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Permisos por miembro · {selectedCount}</SectionTitle>
            <button
              type="button"
              onClick={() => {
                const all: Record<string, MemberPermissions> = {};
                selectedIds.forEach(id => { all[id] = { canRegister: true, canShareWithAgencies: true, canEdit: true }; });
                setSelected(all);
              }}
              className="text-[10px] uppercase tracking-wide text-primary hover:text-primary/80 font-medium"
            >
              Conceder todo a todos
            </button>
          </div>
          <div className="space-y-2">
            {selectedIds.map(id => {
              const m = pool.find(p => p.id === id);
              if (!m) return null;
              const perms = selected[id];
              return (
                <div key={id} className="rounded-xl border border-border/30 bg-background/50 p-3">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar} alt={m.name} />
                      <AvatarFallback className="bg-muted text-[10px]">
                        {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.role || m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Quitar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      { key: "canRegister" as const, label: "Registrar clientes", desc: "Puede registrar nuevos contactos" },
                      { key: "canShareWithAgencies" as const, label: "Compartir con agencias", desc: "Puede invitar colaboradores" },
                      { key: "canEdit" as const, label: "Editar promoción", desc: "Puede modificar detalles y precios" },
                    ]).map(({ key, label, desc }) => {
                      const active = perms[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updatePerm(id, key, !active)}
                          className={cn(
                            "flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all",
                            active
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/30 bg-muted/20 hover:border-border/60"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            active ? "bg-primary text-primary-foreground" : "border border-border/60"
                          )}>
                            {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </EditDialogShell>
  );
}

// ═══ PICK SALES OFFICES (visual multi-select from company offices) ═══
export type PickableOffice = {
  id: string;
  name: string;
  address: string;
  city?: string;
  phone?: string;
  email?: string;
  coverUrl?: string;
};

export function PickSalesOfficesDialog({
  open, onOpenChange, pool, alreadyAddedIds, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pool: PickableOffice[];
  alreadyAddedIds: string[];
  onConfirm: (offices: PickableOffice[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = pool.filter(o => !alreadyAddedIds.includes(o.id));
  const filtered = available.filter(o =>
    o.name.toLowerCase().includes(query.toLowerCase()) ||
    o.address.toLowerCase().includes(query.toLowerCase()) ||
    (o.city || "").toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(pool.filter(o => selected.has(o.id)));
    setSelected(new Set());
    setQuery("");
    onOpenChange(false);
  };

  return (
    <EditDialogShell
      open={open}
      onOpenChange={(v) => { if (!v) { setSelected(new Set()); setQuery(""); } onOpenChange(v); }}
      title="Añadir puntos de venta"
      description="Elige oficinas físicas de tu empresa. Haz clic en una tarjeta para seleccionarla; puedes elegir varias."
      onCancel={() => onOpenChange(false)}
      onSave={handleConfirm}
      saveLabel={selected.size > 0 ? `Añadir ${selected.size} punto${selected.size > 1 ? "s" : ""} de venta` : "Añadir"}
      maxWidth="max-w-3xl"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, ciudad o dirección…"
          className="h-9 rounded-full text-sm pl-9 bg-card border-border/40"
        />
      </div>

      {/* Pool grid */}
      <div className="rounded-2xl bg-card border border-border/20 p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <Store className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-foreground">No se encontraron puntos de venta</p>
            <p className="text-xs text-muted-foreground mt-1">
              {available.length === 0 ? "Todos tus puntos de venta ya están añadidos a esta promoción." : "Prueba con otra búsqueda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(o => {
              const isSelected = selected.has(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "relative rounded-xl border overflow-hidden text-left transition-all group",
                    isSelected
                      ? "border-primary shadow-soft-lg"
                      : "border-border/30 hover:border-border/60"
                  )}
                >
                  {/* Cover */}
                  <div className="relative h-24 bg-muted/30">
                    {o.coverUrl ? (
                      <img src={o.coverUrl} alt={o.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center">
                        <Building2 className="h-7 w-7 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className={cn(
                      "absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-all",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-background/80 backdrop-blur border border-border/40"
                    )}>
                      {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3 bg-background/50">
                    <p className="text-sm font-semibold text-foreground truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" /> {[o.city, o.address].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </EditDialogShell>
  );
}
