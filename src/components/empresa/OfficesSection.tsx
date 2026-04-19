/**
 * OfficesSection · réplica del componente del original Lovable adaptado
 * a los componentes y storage de Byvaro.
 *
 * Modo vista: cards 280px con cover, nombre, dirección, tel, email y
 * CTA "Ver cómo llegar". Las oficinas `activa=false` no se muestran.
 *
 * Modo edit: formulario en línea por oficina con 6 campos + toggle
 * "Visible" (mapea a `activa`) + delete button. Añadir oficina con
 * botón dashed. Save/Cancel commitean el draft en localStorage vía
 * `useOficinas`.
 *
 * Diferencias con el original:
 *   - Usa mi Switch custom (no Radix)
 *   - Usa cn() y mis tokens de diseño (rounded-2xl, shadow-soft)
 *   - Persistencia en localStorage vía useOficinas
 *   - Añade chip "Principal" en las oficinas marcadas como tal
 */

import { useState } from "react";
import {
  MapPin, Phone, Mail, Building2, Plus, Pencil, Check, X,
  Trash2, Eye, EyeOff, Navigation, Upload, ImageIcon, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOficinas, type Oficina } from "@/lib/empresa";
import { Switch } from "@/components/ui/Switch";

/* ─── Input helpers ───────────────────────────────────────────────── */
const inputClass = "h-8 w-full px-3 text-[12.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

/* ─── Office card (vista pública) ─────────────────────────────────── */
function OfficeCard({ office }: { office: Oficina }) {
  return (
    <div className="w-[280px] shrink-0 rounded-2xl border border-border bg-card overflow-hidden hover:border-border/70 transition-colors">
      {/* Cover */}
      <div className="relative h-40 bg-muted/20">
        {office.coverUrl ? (
          <img src={office.coverUrl} alt={office.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/40 to-muted/20 flex items-center justify-center">
            <Building2 className="h-10 w-10 text-muted-foreground/15" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold text-white leading-tight truncate">{office.nombre || "Sin nombre"}</p>
            {office.esPrincipal && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 shrink-0">
                <Star className="h-2 w-2" strokeWidth={3} /> Principal
              </span>
            )}
          </div>
          {(office.ciudad || office.provincia) && (
            <p className="text-[11px] text-white/80 mt-0.5 truncate">
              {[office.ciudad, office.provincia].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5">
        {office.direccion && (
          <div className="flex items-start gap-2.5">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
            <p className="text-[11.5px] text-foreground leading-relaxed">
              {office.direccion}{office.ciudad ? `, ${office.ciudad}` : ""}
            </p>
          </div>
        )}
        {office.telefono && (
          <div className="flex items-center gap-2.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <p className="text-[11.5px] text-foreground tnum">
              {office.phonePrefix ? `${office.phonePrefix} ` : ""}{office.telefono}
            </p>
          </div>
        )}
        {office.email && (
          <div className="flex items-center gap-2.5">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <p className="text-[11.5px] text-foreground truncate">{office.email}</p>
          </div>
        )}

        <button
          type="button"
          className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Navigation className="h-3.5 w-3.5" />
          Cómo llegar
        </button>
      </div>
    </div>
  );
}

/* ─── Edit row (una oficina en modo edición) ──────────────────────── */
function OfficeEditRow({
  office, onChange, onDelete, onMakePrincipal,
}: {
  office: Oficina;
  onChange: (o: Oficina) => void;
  onDelete: () => void;
  onMakePrincipal: () => void;
}) {
  const set = <K extends keyof Oficina>(key: K, val: Oficina[K]) => onChange({ ...office, [key]: val });

  const handleCoverUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => set("coverUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/10 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-foreground">
            {office.nombre || "Nueva oficina"}
          </p>
          {office.esPrincipal && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
              <Star className="h-2 w-2" strokeWidth={3} /> Principal
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!office.esPrincipal && (
            <button
              type="button"
              onClick={onMakePrincipal}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              title="Marcar como principal"
            >
              <Star className="h-3 w-3" /> Marcar principal
            </button>
          )}
          <div className="flex items-center gap-1.5">
            {office.activa ? (
              <Eye className="h-3 w-3 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-[10px] text-muted-foreground">
              {office.activa ? "Visible" : "Oculta"}
            </span>
            <Switch
              checked={office.activa}
              onCheckedChange={(v) => set("activa", v)}
              ariaLabel="Visible"
            />
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Nombre</label>
          <input value={office.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputClass} placeholder="Ej. Oficina Altea" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Ciudad</label>
          <input value={office.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={inputClass} placeholder="Ciudad" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Provincia</label>
          <input value={office.provincia} onChange={(e) => set("provincia", e.target.value)} className={inputClass} placeholder="Provincia" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Dirección</label>
          <input value={office.direccion} onChange={(e) => set("direccion", e.target.value)} className={inputClass} placeholder="Dirección completa" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Teléfono</label>
          <div className="flex items-center gap-1.5">
            <input
              value={office.phonePrefix}
              onChange={(e) => set("phonePrefix", e.target.value)}
              className={cn(inputClass, "w-14 text-center tnum")}
              placeholder="+34"
              maxLength={4}
            />
            <input
              value={office.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              className={cn(inputClass, "flex-1 tnum")}
              placeholder="612345678"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Email</label>
          <input value={office.email} onChange={(e) => set("email", e.target.value)} className={inputClass} placeholder="email@empresa.com" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Imagen de portada</label>
          {office.coverUrl ? (
            <div className="relative rounded-xl overflow-hidden h-28 group/cover">
              <img src={office.coverUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-card/95 text-[11px] font-medium text-foreground hover:bg-card transition-colors">
                  <Upload className="h-3 w-3" /> Cambiar
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) handleCoverUpload(f);
                  }} />
                </label>
                <button type="button" onClick={() => set("coverUrl", "")} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-card/95 text-[11px] font-medium text-foreground hover:bg-card transition-colors">
                  <Trash2 className="h-3 w-3" /> Quitar
                </button>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-border/60 hover:border-border transition-colors">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              <span className="text-[11px] text-muted-foreground">Click para subir imagen</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) handleCoverUpload(f);
              }} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OfficesSection principal
   ═══════════════════════════════════════════════════════════════════ */
export function OfficesSection({ viewMode }: { viewMode: "edit" | "preview" }) {
  const { oficinas, addOficina, updateOficina, deleteOficina, setPrincipal } = useOficinas();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Oficina[]>([]);

  const visibleOficinas = oficinas.filter((o) => o.activa !== false);
  // Ordenar: principal primero, luego por createdAt
  const sorted = [...visibleOficinas].sort((a, b) => {
    if (a.esPrincipal !== b.esPrincipal) return a.esPrincipal ? -1 : 1;
    return a.createdAt - b.createdAt;
  });

  const startEdit = () => {
    setDraft(oficinas.map(o => ({ ...o })));
    setEditing(true);
  };

  const save = () => {
    // Diff contra el storage actual
    const currentIds = new Set(oficinas.map(o => o.id));
    const draftIds = new Set(draft.map(o => o.id));

    // Borrar oficinas que ya no están
    oficinas.forEach(o => {
      if (!draftIds.has(o.id)) deleteOficina(o.id);
    });

    // Añadir o actualizar
    draft.forEach(d => {
      if (!currentIds.has(d.id)) {
        addOficina(d);
      } else {
        updateOficina(d.id, d);
      }
    });

    setEditing(false);
  };

  const cancel = () => {
    setDraft([]);
    setEditing(false);
  };

  const addDraft = () => {
    setDraft(prev => [...prev, {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: "",
      direccion: "",
      ciudad: "",
      provincia: "",
      telefono: "",
      phonePrefix: "+34",
      email: "",
      whatsapp: "",
      horario: "L-V 9:00-18:00",
      logoUrl: "",
      coverUrl: "",
      esPrincipal: prev.length === 0,
      activa: true,
      createdAt: Date.now(),
    }]);
  };

  const updateDraft = (idx: number, o: Oficina) => {
    setDraft(prev => prev.map((x, i) => i === idx ? o : x));
  };

  const deleteDraft = (idx: number) => {
    setDraft(prev => {
      const removed = prev[idx];
      let next = prev.filter((_, i) => i !== idx);
      // Si borramos la principal y queda alguna, la primera pasa a principal
      if (removed?.esPrincipal && next.length > 0) {
        next = next.map((o, i) => ({ ...o, esPrincipal: i === 0 }));
      }
      return next;
    });
  };

  const makePrincipalDraft = (idx: number) => {
    setDraft(prev => prev.map((o, i) => ({ ...o, esPrincipal: i === idx })));
  };

  /* ─── Modo edit ─── */
  if (editing) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card shadow-soft overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-foreground">Oficinas</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={save} className="inline-flex items-center gap-1 px-3 h-7 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors">
              <Check className="h-3 w-3" /> Guardar
            </button>
            <button type="button" onClick={cancel} className="inline-flex items-center gap-1 px-3 h-7 rounded-full border border-border text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> Cancelar
            </button>
          </div>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-3">
          {draft.map((o, i) => (
            <OfficeEditRow
              key={o.id}
              office={o}
              onChange={(updated) => updateDraft(i, updated)}
              onDelete={() => deleteDraft(i)}
              onMakePrincipal={() => makePrincipalDraft(i)}
            />
          ))}
          <button
            type="button"
            onClick={addDraft}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir oficina
          </button>
        </div>
      </div>
    );
  }

  /* ─── Modo vista ─── */
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold text-foreground">Oficinas</h2>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full tnum">{sorted.length}</span>
        </div>
        {viewMode === "edit" && (
          <button
            type="button"
            onClick={startEdit}
            className="opacity-0 group-hover/section:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 h-7 rounded-md bg-background border border-border text-[11.5px] text-muted-foreground hover:text-foreground shadow-soft"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        )}
      </div>
      <div className="px-5 pb-5">
        <div className={cn(
          "flex gap-4",
          sorted.length === 1 && "justify-start",
          sorted.length >= 2 && "flex-wrap",
        )}>
          {sorted.map(o => (
            <OfficeCard key={o.id} office={o} />
          ))}

          {sorted.length === 0 && (
            <div className="w-full py-8 text-center">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-[12px] text-muted-foreground">
                No hay oficinas visibles. Haz click en <span className="font-semibold">Editar</span> para añadir o mostrar oficinas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
