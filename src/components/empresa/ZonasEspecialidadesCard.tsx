/**
 * ZonasEspecialidadesCard · 3 bloques de chips: zonas de operación,
 * especialidades y idiomas de atención. Editables con botón +.
 *
 * Es información clave para agencias: dónde operan, en qué nicho y
 * en qué idiomas atienden a clientes internacionales.
 */

import { useState } from "react";
import { MapPin, Gem, Languages, X, Plus } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

/* ─── Sugerencias predefinidas ────────────────────────────────────── */
const ZONAS_SUGERIDAS = [
  "Costa del Sol", "Costa Blanca", "Costa Brava", "Costa Cálida",
  "Madrid", "Barcelona", "Baleares", "Canarias", "País Vasco",
  "Andalucía", "Portugal", "Andorra",
];

const ESPECIALIDADES_SUGERIDAS = [
  "Luxury", "Residencial", "Coastal", "Urbano", "Golf",
  "Nueva construcción", "Inversión", "Sobre plano", "Llave en mano",
  "Segunda residencia", "Comercial",
];

const IDIOMAS_DISPONIBLES = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
];

const inputClass = "h-8 px-3 text-[12px] bg-card border border-border rounded-full focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

/* ─── Chip individual editable ────────────────────────────────────── */
function ChipList({
  items, onToggle, onRemove, sugerencias, editing, icon: Icon, accent = "primary",
}: {
  items: string[];
  onToggle: (v: string) => void;
  onRemove: (v: string) => void;
  sugerencias: string[];
  editing: boolean;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "amber" | "indigo";
}) {
  const accentClass = accent === "amber"
    ? "bg-warning/10 text-warning dark:text-warning border-warning/30"
    : accent === "indigo"
      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
      : "bg-primary/10 text-primary border-primary/30";

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <span key={v} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] font-medium", accentClass)}>
          <Icon className="h-3 w-3" />
          {v}
          {editing && (
            <button type="button" onClick={() => onRemove(v)} className="ml-0.5 opacity-70 hover:opacity-100" aria-label="Quitar">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}
      {items.length === 0 && !editing && (
        <span className="text-[11.5px] text-muted-foreground italic">Sin añadir</span>
      )}
      {editing && (
        <div className="flex flex-wrap gap-1.5">
          {sugerencias.filter(s => !items.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Plus className="h-2.5 w-2.5" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ZonasEspecialidadesCard
   ═══════════════════════════════════════════════════════════════════ */
export function ZonasEspecialidadesCard({
  viewMode, empresa, update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const [customZona, setCustomZona] = useState("");
  const [customEsp, setCustomEsp] = useState("");

  const toggleZona = (z: string) => {
    const has = empresa.zonasOperacion.includes(z);
    update("zonasOperacion", has ? empresa.zonasOperacion.filter(x => x !== z) : [...empresa.zonasOperacion, z]);
  };
  const toggleEsp = (e: string) => {
    const has = empresa.especialidades.includes(e);
    update("especialidades", has ? empresa.especialidades.filter(x => x !== e) : [...empresa.especialidades, e]);
  };
  const toggleIdioma = (c: string) => {
    const has = empresa.idiomasAtencion.includes(c);
    update("idiomasAtencion", has ? empresa.idiomasAtencion.filter(x => x !== c) : [...empresa.idiomasAtencion, c]);
  };

  return (
    <EditableSection
      title="Zonas y especialidades"
      viewMode={viewMode}
      editContent={
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Zonas de operación
            </p>
            <ChipList items={empresa.zonasOperacion} onToggle={toggleZona} onRemove={toggleZona}
              sugerencias={ZONAS_SUGERIDAS} editing icon={MapPin} accent="primary" />
            <div className="flex items-center gap-2 mt-2">
              <input
                value={customZona}
                onChange={(e) => setCustomZona(e.target.value)}
                placeholder="Añadir zona personalizada…"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customZona.trim()) {
                    toggleZona(customZona.trim());
                    setCustomZona("");
                  }
                }}
              />
              <button type="button" onClick={() => { if (customZona.trim()) { toggleZona(customZona.trim()); setCustomZona(""); } }}
                className="inline-flex items-center gap-1 rounded-full px-3 h-8 bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Añadir
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <Gem className="h-3 w-3" /> Especialidades
            </p>
            <ChipList items={empresa.especialidades} onToggle={toggleEsp} onRemove={toggleEsp}
              sugerencias={ESPECIALIDADES_SUGERIDAS} editing icon={Gem} accent="amber" />
            <div className="flex items-center gap-2 mt-2">
              <input
                value={customEsp}
                onChange={(e) => setCustomEsp(e.target.value)}
                placeholder="Añadir especialidad personalizada…"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customEsp.trim()) {
                    toggleEsp(customEsp.trim());
                    setCustomEsp("");
                  }
                }}
              />
              <button type="button" onClick={() => { if (customEsp.trim()) { toggleEsp(customEsp.trim()); setCustomEsp(""); } }}
                className="inline-flex items-center gap-1 rounded-full px-3 h-8 bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> Añadir
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <Languages className="h-3 w-3" /> Idiomas de atención
            </p>
            <div className="flex flex-wrap gap-1.5">
              {IDIOMAS_DISPONIBLES.map((i) => {
                const on = empresa.idiomasAtencion.includes(i.code);
                return (
                  <button key={i.code} type="button" onClick={() => toggleIdioma(i.code)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      on
                        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    )}>
                    <span className="text-[14px]">{i.flag}</span>
                    {i.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> Zonas de operación
          </p>
          <ChipList items={empresa.zonasOperacion} onToggle={() => {}} onRemove={() => {}} sugerencias={[]} editing={false} icon={MapPin} accent="primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Gem className="h-3 w-3" /> Especialidades
          </p>
          <ChipList items={empresa.especialidades} onToggle={() => {}} onRemove={() => {}} sugerencias={[]} editing={false} icon={Gem} accent="amber" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Languages className="h-3 w-3" /> Idiomas de atención
          </p>
          <div className="flex flex-wrap gap-1.5">
            {empresa.idiomasAtencion.length === 0 ? (
              <span className="text-[11.5px] text-muted-foreground italic">Sin añadir</span>
            ) : (
              empresa.idiomasAtencion.map(code => {
                const i = IDIOMAS_DISPONIBLES.find(x => x.code === code);
                return (
                  <span key={code} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 px-2.5 py-1 text-[11.5px] font-medium">
                    <span className="text-[13px]">{i?.flag ?? "🏳️"}</span>
                    {i?.label ?? code}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </EditableSection>
  );
}
