/**
 * InfoBasicaStep · Paso "Información básica" del wizard Crear Promoción.
 *
 * Fidelidad al original Lovable + mejoras de UX:
 *   1. Nombre comercial (obligatorio, autofocus, hero big input).
 *   2. Dirección · input único tipo Google Places (AddressAutocomplete)
 *      que parsea ciudad/provincia/país automáticamente.
 *   3. Certificado energético · letter-grid A-G + "En trámite".
 *   4. SI unifamiliar:
 *      - caracteristicasVivienda (pills)
 *      - Master switch "¿Dentro de urbanización?" → si ON revela
 *        nombre de la urba + sus zonas comunes compartidas.
 *   5. SI plurifamiliar/mixto:
 *      - amenities propias del edificio (pills)
 *      - caracteristicasVivienda (pills)
 *      - Si hay características: selector "Todas / Solo algunas unidades"
 *      - Master switch "¿Dentro de urbanización?" (mejora sobre el
 *        original: un bloque plurifamiliar también puede estar dentro
 *        de una urba con piscina compartida, etc.)
 *
 * El branching respeta la semántica del original: amenities = propias
 * del edificio; zonasComunes = de la urbanización a la que pertenece.
 */

import { useMemo } from "react";
import { MapPin, Sparkles, Leaf, Palmtree, Home as HomeIcon } from "lucide-react";
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
import { AddressAutocomplete } from "./AddressAutocomplete";

/* ─── Sugerencia smart de amenities según ubicación ──────────────── */
function suggestAmenities(ciudad: string): string[] {
  const c = ciudad.toLowerCase();
  const costa = /marbella|benidorm|denia|altea|javea|jávea|estepona|alicante|málaga|malaga|calpe|torrevieja|palma|ibiza|orihuela|nerja/.test(c);
  const urbana = /madrid|barcelona|bilbao|sevilla|valencia/.test(c);
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

/* ─── SectionLabel compartido ──────────────────────────────────────── */
function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </p>
      {hint && <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputClass = "h-10 px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

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
  const isUnifamiliar = state.tipo === "unifamiliar";

  // Sugerencias dinámicas de amenities según la ciudad.
  const suggestions = useMemo(
    () => suggestAmenities(state.direccionPromocion.ciudad ?? ""),
    [state.direccionPromocion.ciudad],
  );
  const noAmenitiesYet = state.amenities.length === 0;

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
          className={cn(inputClass, "h-12 text-[16px] font-semibold w-full")}
          maxLength={80}
        />
        <p className="text-[10.5px] text-muted-foreground mt-1.5">
          Este nombre aparecerá en el listado de agencias y en tu microsite público.
        </p>
      </div>

      {/* ═════ Dirección Google-style ═════ */}
      <div>
        <SectionLabel hint="Escribe la ciudad, urbanización o dirección y selecciona una sugerencia.">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Ubicación
          </span>
        </SectionLabel>
        <AddressAutocomplete
          value={state.direccionPromocion}
          onChange={(v) => update("direccionPromocion", v)}
        />
      </div>

      {/* ═════ Estilo arquitectónico · solo plurifamiliar/mixto
             (unifamiliar ya lo elige en el paso sub_varias). ═════ */}
      {!isUnifamiliar && state.estiloVivienda == null && (
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

      {/* ═════════════════════════════════════════════════════════════
          Rama UNIFAMILIAR: características + urbanización
          ═════════════════════════════════════════════════════════════ */}
      {isUnifamiliar && (
        <>
          <div>
            <SectionLabel>Características destacadas de las viviendas</SectionLabel>
            <PillSelect
              options={caracteristicasViviendaOptions}
              selected={state.caracteristicasVivienda}
              onToggle={toggleCaracteristica}
            />
          </div>
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════
          Rama PLURIFAMILIAR / MIXTO: amenities + características
          ═════════════════════════════════════════════════════════════ */}
      {isPlurifamiliar && (
        <>
          <div>
            <SectionLabel hint="Lo que ofrece el edificio/promoción por sí mismo.">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Amenities del edificio
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

          <div>
            <SectionLabel>Características comunes de las viviendas</SectionLabel>
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
        </>
      )}

      {/* ═════ Urbanización master switch (siempre disponible) ═════ */}
      <div>
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5">
            <Palmtree className="h-3 w-3" />
            Urbanización
          </span>
        </SectionLabel>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">¿Está dentro de una urbanización?</p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-md">
                {isUnifamiliar
                  ? "Las viviendas unifamiliares suelen estar dentro de urbanizaciones con piscina, pistas de pádel, jardines compartidos…"
                  : "Un bloque plurifamiliar puede formar parte de una urbanización más grande con sus propias zonas comunes."}
              </p>
            </div>
            <Switch
              checked={state.urbanizacion}
              onCheckedChange={(v) => update("urbanizacion", v)}
              ariaLabel="Dentro de urbanización"
            />
          </div>

          {/* Sub-formulario que se revela cuando el switch está ON */}
          {state.urbanizacion && (
            <div className="border-t border-border bg-muted/20 p-4 flex flex-col gap-4">
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground mb-1.5 block">
                  Nombre de la urbanización
                </label>
                <input
                  type="text"
                  placeholder="Ej. Urb. Los Flamingos, Nueva Andalucía…"
                  className={cn(inputClass, "w-full")}
                  defaultValue=""
                  /* En el modelo actual no hay `nombreUrbanizacion`.
                     Lo dejamos como input cosmético; si en el futuro
                     se añade al estado se conecta aquí. */
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  Opcional. Si no la sabes, solo marca las zonas comunes que ofrece.
                </p>
              </div>

              <div>
                <p className="text-[11.5px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <HomeIcon className="h-3 w-3" />
                  Zonas comunes compartidas
                </p>
                <PillSelect
                  options={zonasComOptions}
                  selected={state.zonasComunes}
                  onToggle={toggleZona}
                />
                {state.zonasComunes.length === 0 && (
                  <p className="text-[10.5px] text-muted-foreground/80 mt-2">
                    Selecciona las zonas comunes a las que tienen acceso los compradores.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
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
