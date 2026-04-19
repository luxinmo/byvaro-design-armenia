/**
 * InfoBasicaStep · Paso "Información básica" del wizard Crear Promoción.
 *
 * Recoge:
 *   - Nombre comercial de la promoción (obligatorio)
 *   - Ubicación: país · provincia · ciudad · dirección
 *   - Estilo arquitectónico (si no se fijó en sub_varias)
 *   - Toggle urbanización
 *   - Amenities, zonas comunes, características de vivienda (pills)
 *   - Aplicación de características (todas / algunas)
 *   - Certificado energético (A-G · En trámite)
 *
 * Diseño: inputs grandes (h-10), pills multi-select con iconos,
 * secciones separadas por SectionLabel. Smart defaults: sugerimos
 * amenities según el país/zona y el tipo de promoción; el promotor
 * puede confirmar o quitar antes de seguir.
 */

import { useMemo } from "react";
import { MapPin, Sparkles, Leaf } from "lucide-react";
import type { WizardState, EstiloVivienda } from "./types";
import {
  estiloViviendaOptions,
  amenitiesOptions,
  caracteristicasViviendaOptions,
  zonasComOptions,
  certificadoEnergeticoOptions,
} from "./options";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import { OptionCard } from "./SharedWidgets";

/* ─── Sugerencias de ubicación ────────────────────────────────────── */
const PAISES_COMUNES = ["España", "Portugal", "Andorra", "México", "Colombia", "Argentina"];

const PROVINCIAS_ES = [
  "A Coruña", "Álava", "Albacete", "Alicante", "Almería", "Asturias",
  "Ávila", "Badajoz", "Baleares", "Barcelona", "Burgos", "Cáceres",
  "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca",
  "Girona", "Granada", "Guadalajara", "Gipuzkoa", "Huelva", "Huesca",
  "Jaén", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo",
  "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Palencia",
  "Pontevedra", "Salamanca", "Segovia", "Sevilla", "Soria",
  "Tarragona", "Santa Cruz de Tenerife", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Bizkaia", "Zamora", "Zaragoza",
];

const CIUDADES_POPULARES: Record<string, string[]> = {
  Alicante: ["Altea", "Benidorm", "Calpe", "Dénia", "Jávea", "Torrevieja", "Santa Pola"],
  Málaga: ["Marbella", "Estepona", "Fuengirola", "Benalmádena", "Mijas", "Nerja"],
  Madrid: ["Madrid", "Las Rozas", "Pozuelo", "Majadahonda", "Alcobendas", "Boadilla"],
  Barcelona: ["Barcelona", "Sitges", "Castelldefels", "Gavà", "Sant Cugat"],
  Baleares: ["Palma", "Calvià", "Alcúdia", "Pollença", "Manacor", "Ibiza ciudad"],
};

/* Sugerencias "smart" de amenities según indicios de costa / ciudad. */
function suggestAmenities(state: WizardState): string[] {
  const ciudad = state.direccionPromocion.ciudad?.toLowerCase() ?? "";
  const costa = /marbella|benidorm|denia|altea|jávea|javea|estepona|alicante|málaga|malaga|calpe|torrevieja|palma|ibiza/.test(ciudad);
  const urbana = /madrid|barcelona|bilbao|sevilla|valencia/.test(ciudad);
  if (costa) return ["piscina", "jardin", "beach_club", "seguridad"];
  if (urbana) return ["gimnasio", "coworking", "seguridad", "conserje"];
  return ["piscina", "jardin", "seguridad"];
}

/* ─── Sub-componente: PillSelect ──────────────────────────────────── */
function PillSelect<T extends string>({
  options, selected, onToggle,
}: {
  options: { value: T; label: string; icon: React.ElementType }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const Icon = o.icon;
        const isOn = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-all border",
              isOn
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Sub-componente: Field (label + input) ──────────────────────── */
function Field({
  label, required, children, hint,
}: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const inputClass = "h-10 px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

/* ─── SectionLabel compartido ──────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   InfoBasicaStep
   ═══════════════════════════════════════════════════════════════════ */
export function InfoBasicaStep({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const isPlurifamiliar = state.tipo === "plurifamiliar" || state.tipo === "mixto";

  // Sugerencias dinámicas. Solo para inspirar, el promotor decide.
  const suggestions = useMemo(() => suggestAmenities(state), [state.direccionPromocion.ciudad]);
  const noAmenitiesYet = state.amenities.length === 0;
  const ciudadesSugeridas = CIUDADES_POPULARES[state.direccionPromocion.provincia] ?? [];

  const toggleAmenity = (v: string) => {
    const next = state.amenities.includes(v)
      ? state.amenities.filter(a => a !== v)
      : [...state.amenities, v];
    update("amenities", next);
  };
  const toggleCaracteristica = (v: string) => {
    const next = state.caracteristicasVivienda.includes(v)
      ? state.caracteristicasVivienda.filter(a => a !== v)
      : [...state.caracteristicasVivienda, v];
    update("caracteristicasVivienda", next);
  };
  const toggleZona = (v: string) => {
    const next = state.zonasComunes.includes(v)
      ? state.zonasComunes.filter(a => a !== v)
      : [...state.zonasComunes, v];
    update("zonasComunes", next);
  };

  return (
    <div className="flex flex-col gap-7">
      {/* ═════ Nombre ═════ */}
      <div>
        <SectionLabel>Cómo se llama tu promoción</SectionLabel>
        <input
          type="text"
          autoFocus
          value={state.nombrePromocion}
          onChange={(e) => update("nombrePromocion", e.target.value)}
          placeholder="Ej. Residencial Mar Azul"
          className={cn(inputClass, "h-12 text-[16px] font-semibold")}
          maxLength={80}
        />
        <p className="text-[10.5px] text-muted-foreground mt-1.5">
          Este nombre aparecerá en el listado, en los materiales de agencias y en tu microsite público.
        </p>
      </div>

      {/* ═════ Ubicación ═════ */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Ubicación
          </span>
        </SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="País" required>
            <input
              type="text"
              list="paises-list"
              value={state.direccionPromocion.pais}
              onChange={(e) => update("direccionPromocion", { ...state.direccionPromocion, pais: e.target.value })}
              placeholder="España"
              className={inputClass}
            />
            <datalist id="paises-list">
              {PAISES_COMUNES.map(p => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label="Provincia">
            <input
              type="text"
              list="provincias-list"
              value={state.direccionPromocion.provincia}
              onChange={(e) => update("direccionPromocion", { ...state.direccionPromocion, provincia: e.target.value, ciudad: "" })}
              placeholder="Málaga"
              className={inputClass}
            />
            <datalist id="provincias-list">
              {PROVINCIAS_ES.map(p => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label="Ciudad / municipio" required>
            <input
              type="text"
              list="ciudades-list"
              value={state.direccionPromocion.ciudad}
              onChange={(e) => update("direccionPromocion", { ...state.direccionPromocion, ciudad: e.target.value })}
              placeholder={ciudadesSugeridas[0] ?? "Marbella"}
              className={inputClass}
            />
            {ciudadesSugeridas.length > 0 && (
              <datalist id="ciudades-list">
                {ciudadesSugeridas.map(c => <option key={c} value={c} />)}
              </datalist>
            )}
          </Field>
          <Field label="Dirección / zona" hint="Calle, urbanización o zona reconocible">
            <input
              type="text"
              value={state.direccionPromocion.direccion}
              onChange={(e) => update("direccionPromocion", { ...state.direccionPromocion, direccion: e.target.value })}
              placeholder="Av. del Mar, 45"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* ═════ Estilo arquitectónico (solo si no viene ya) ═════ */}
      {state.estiloVivienda == null && (
        <div>
          <SectionLabel>Estilo arquitectónico</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {estiloViviendaOptions.map((o) => (
              <OptionCard
                key={o.value}
                option={o}
                selected={state.estiloVivienda === o.value}
                onSelect={(v) => update("estiloVivienda", v as EstiloVivienda)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═════ Urbanización toggle ═════ */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold text-foreground">¿Está dentro de una urbanización?</p>
          <p className="text-[11.5px] text-muted-foreground">
            Si lo está, podrás usar sus zonas comunes como valor añadido para los compradores.
          </p>
        </div>
        <Switch
          checked={state.urbanizacion}
          onCheckedChange={(v) => update("urbanizacion", v)}
          ariaLabel="Dentro de urbanización"
        />
      </div>

      {/* ═════ Amenities ═════ */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Amenities que ofrece tu promoción
          </span>
        </SectionLabel>
        <PillSelect
          options={amenitiesOptions}
          selected={state.amenities}
          onToggle={toggleAmenity}
        />
        {noAmenitiesYet && state.direccionPromocion.ciudad && (
          <button
            type="button"
            onClick={() => update("amenities", suggestions)}
            className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Sugerencia: añadir {suggestions.length} amenities habituales en {state.direccionPromocion.ciudad}
          </button>
        )}
      </div>

      {/* ═════ Zonas comunes — solo plurifamiliar/mixto ═════ */}
      {isPlurifamiliar && (
        <div>
          <SectionLabel>Zonas comunes del edificio</SectionLabel>
          <PillSelect
            options={zonasComOptions}
            selected={state.zonasComunes}
            onToggle={toggleZona}
          />
        </div>
      )}

      {/* ═════ Características de la vivienda ═════ */}
      <div>
        <SectionLabel>Características destacadas de las viviendas</SectionLabel>
        <PillSelect
          options={caracteristicasViviendaOptions}
          selected={state.caracteristicasVivienda}
          onToggle={toggleCaracteristica}
        />
        {state.caracteristicasVivienda.length > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/40 border border-border p-3">
            <span className="text-[11.5px] text-muted-foreground">¿Aplican a todas las viviendas?</span>
            <div className="flex gap-1 ml-auto">
              {(["todas", "algunas"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => update("caracteristicasAplicacion", v)}
                  className={cn(
                    "h-7 rounded-full px-3 text-[11.5px] font-semibold transition-colors",
                    state.caracteristicasAplicacion === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground border border-border hover:text-foreground",
                  )}
                >
                  {v === "todas" ? "Todas" : "Solo algunas"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═════ Certificado energético ═════ */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Leaf className="h-3 w-3" />
            Certificado energético
          </span>
        </SectionLabel>
        <div className="flex flex-wrap gap-2">
          {certificadoEnergeticoOptions.map((c) => {
            const isOn = state.certificadoEnergetico === c;
            const isLetter = c.length === 1;
            return (
              <button
                key={c}
                type="button"
                onClick={() => update("certificadoEnergetico", isOn ? "" : c)}
                className={cn(
                  "min-w-10 h-10 rounded-xl px-3 text-[13px] font-bold transition-colors border",
                  isOn
                    ? "bg-primary text-primary-foreground border-primary"
                    : isLetter
                      ? "bg-card border-border text-foreground hover:border-primary/40"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] text-muted-foreground mt-2">
          Puedes dejarlo como "En trámite" si la promoción está en proyecto o en construcción.
        </p>
      </div>
    </div>
  );
}
