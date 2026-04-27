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
import { Flag } from "@/components/ui/Flag";
import { findLanguageByCode, sortLanguagesByImportance, TOP_LANGUAGES } from "@/lib/languages";

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

/* Idiomas disponibles · TOP_LANGUAGES primero (ES, EN, FR, DE, RU),
 * luego el resto más habitual en el sector. */
const IDIOMAS_DISPONIBLES = sortLanguagesByImportance([
  ...TOP_LANGUAGES, "PT", "IT", "NL", "AR", "ZH", "HY",
]).map((code) => findLanguageByCode(code)!).filter(Boolean);

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
  viewMode, empresa, update, idiomas, idiomasReadOnly,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  /** Idiomas a mostrar en el bloque "Idiomas de atención". Cuando se
   *  pasa, sustituye a `empresa.idiomasAtencion` (caso típico: own
   *  workspace donde los idiomas se derivan automáticamente del equipo
   *  vía `useEmpresaStats`). */
  idiomas?: string[];
  /** Si true, el bloque de idiomas se renderiza solo lectura (no se
   *  puede editar manualmente — la fuente de verdad es el equipo). */
  idiomasReadOnly?: boolean;
}) {
  const [customZona, setCustomZona] = useState("");
  const [customEsp, setCustomEsp] = useState("");

  const idiomasEffective = idiomas ?? empresa.idiomasAtencion;

  /* Idiomas · 5 visibles + toggle "+N / ver menos" cuando hay más.
   *  Mismo patrón que en EmpresaHomeTab "Datos de la empresa" y en
   *  EmpresaAgentsTab `<PersonCard>`. */
  const LANG_PREVIEW = 5;
  const [langExpanded, setLangExpanded] = useState(false);
  const visibleIdiomasEffective = langExpanded
    ? idiomasEffective
    : idiomasEffective.slice(0, LANG_PREVIEW);
  const hiddenIdiomasCount = idiomasEffective.length - LANG_PREVIEW;

  const toggleZona = (z: string) => {
    const has = empresa.zonasOperacion.includes(z);
    update("zonasOperacion", has ? empresa.zonasOperacion.filter(x => x !== z) : [...empresa.zonasOperacion, z]);
  };
  const toggleEsp = (e: string) => {
    const has = empresa.especialidades.includes(e);
    update("especialidades", has ? empresa.especialidades.filter(x => x !== e) : [...empresa.especialidades, e]);
  };
  const toggleIdioma = (c: string) => {
    if (idiomasReadOnly) return;
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
              {idiomasReadOnly && (
                <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/70">· se calcula automáticamente desde tu equipo</span>
              )}
            </p>
            {idiomasReadOnly ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {idiomasEffective.length === 0 ? (
                  <span className="text-[11.5px] text-muted-foreground italic">
                    Sin idiomas · añade agentes en /equipo con sus idiomas para activar este campo.
                  </span>
                ) : (
                  <>
                    {visibleIdiomasEffective.map((code) => {
                      const i = findLanguageByCode(code);
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 px-2.5 py-1 text-[11.5px] font-medium"
                        >
                          <Flag iso={i?.countryIso ?? code} size={13} />
                          {i?.name ?? code}
                        </span>
                      );
                    })}
                    {hiddenIdiomasCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setLangExpanded((v) => !v)}
                        className="inline-flex items-center h-6 px-2 rounded-full border border-dashed border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        {langExpanded ? "ver menos" : `+${hiddenIdiomasCount} más`}
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {IDIOMAS_DISPONIBLES.map((i) => {
                  const on = empresa.idiomasAtencion.includes(i.code);
                  return (
                    <button key={i.code} type="button" onClick={() => toggleIdioma(i.code)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                        on
                          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}>
                      <Flag iso={i.countryIso} size={14} />
                      {i.name}
                    </button>
                  );
                })}
              </div>
            )}
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
            <Languages className="h-3 w-3" /> Idiomas de atención <span className="tnum">({idiomasEffective.length})</span>
            {idiomasReadOnly && (
              <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/70">· se calcula automáticamente desde tu equipo</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {idiomasEffective.length === 0 ? (
              <span className="text-[11.5px] text-muted-foreground italic">
                {idiomasReadOnly
                  ? "Sin idiomas · añade agentes en /equipo con sus idiomas para activar este campo."
                  : "Sin añadir"}
              </span>
            ) : (
              <>
                {visibleIdiomasEffective.map((code) => {
                  const i = findLanguageByCode(code);
                  return (
                    <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 px-2.5 py-1 text-[11.5px] font-medium">
                      <Flag iso={i?.countryIso ?? code} size={13} />
                      {i?.name ?? code}
                    </span>
                  );
                })}
                {hiddenIdiomasCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setLangExpanded((v) => !v)}
                    className="inline-flex items-center h-6 px-2 rounded-full border border-dashed border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  >
                    {langExpanded ? "ver menos" : `+${hiddenIdiomasCount} más`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </EditableSection>
  );
}
