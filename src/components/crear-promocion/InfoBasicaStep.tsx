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
import {
  MapPin, Sparkles, Leaf, Palmtree,
  Lock, ShieldCheck, Bell,
  Waves, TreePine, Baby, Dog,
  Dumbbell, Volleyball, Footprints, Sparkles as SpaIcon,
  Users as UsersIcon, Laptop, Wine, UtensilsCrossed, PartyPopper,
  Car, Wrench, BellRing,
  Plug, Recycle,
} from "lucide-react";
import type { WizardState, EstiloVivienda } from "./types";
import {
  estiloViviendaOptions,
  amenitiesOptions,
  caracteristicasViviendaOptions,
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

/* Amenities de urbanización agrupadas · cada item es un id estable
 * que persiste en `state.zonasComunes: string[]`. Los grupos son solo
 * agrupación visual de la UI · el dato sigue plano. */
const URBANIZACION_GROUPS: {
  label: string;
  items: { value: string; label: string; icon: React.ElementType }[];
}[] = [
  {
    label: "Seguridad y acceso",
    items: [
      { value: "control_acceso",   label: "Control de acceso", icon: Lock },
      { value: "seguridad_24h",    label: "Seguridad 24h",     icon: ShieldCheck },
      { value: "conserjeria",      label: "Conserjería",       icon: Bell },
    ],
  },
  {
    label: "Zonas comunes",
    items: [
      { value: "piscina_com",      label: "Piscina",      icon: Waves },
      { value: "jardin_com",       label: "Jardín",       icon: TreePine },
      { value: "zona_infantil_com",label: "Zona infantil",icon: Baby },
      { value: "zona_mascotas",    label: "Mascotas",     icon: Dog },
    ],
  },
  {
    label: "Deporte y salud",
    items: [
      { value: "gimnasio_com",     label: "Gimnasio",     icon: Dumbbell },
      { value: "padel",            label: "Pádel",        icon: Volleyball },
      { value: "tenis",            label: "Tenis",        icon: Volleyball },
      { value: "running",          label: "Running",      icon: Footprints },
      { value: "spa",              label: "SPA / wellness", icon: SpaIcon },
    ],
  },
  {
    label: "Social",
    items: [
      { value: "club_social",      label: "Club social",      icon: UsersIcon },
      { value: "coworking",        label: "Coworking",        icon: Laptop },
      { value: "bar",              label: "Bar",              icon: Wine },
      { value: "restaurante",      label: "Restaurante",      icon: UtensilsCrossed },
      { value: "sala_eventos",     label: "Sala de eventos",  icon: PartyPopper },
    ],
  },
  {
    label: "Servicios",
    items: [
      { value: "parking_visitas",  label: "Parking visitas", icon: Car },
      { value: "mantenimiento",    label: "Mantenimiento",   icon: Wrench },
      { value: "concierge",        label: "Concierge",       icon: BellRing },
    ],
  },
  {
    label: "Sostenibilidad",
    items: [
      { value: "carga_electrica",  label: "Carga eléctrica", icon: Plug },
      { value: "reciclaje",        label: "Reciclaje",       icon: Recycle },
    ],
  },
];

const URBANIZACION_TIPOS: { value: "cerrada" | "resort" | "abierta"; label: string }[] = [
  { value: "cerrada", label: "Cerrada" },
  { value: "resort",  label: "Resort" },
  { value: "abierta", label: "Abierta" },
];

/** Estilos arquitectónicos que SOLO aplican a villa unifamiliar.
 *  Un edificio plurifamiliar no es ni "finca rural" ni "rústico de
 *  piedra/madera" · son típicos de casa con terreno. Filtrado en el
 *  render del paso "Estilo arquitectónico" según `state.tipo`. */
const ESTILOS_SOLO_UNIFAMILIAR = new Set<EstiloVivienda>(["finca", "rustico"]);

/* ═══════════════════════════════════════════════════════════════════
   InfoBasicaStep
   ═══════════════════════════════════════════════════════════════════ */
export function InfoBasicaStep({
  state,
  update,
  defaultsCapturedInExtras = false,
  hideNameSection = false,
  hideLocationSection = false,
  onlySection,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  /** Cuando V5 está activo (`?wizardV5=1`), el step "extras"
   *  captura características de la vivienda (cocina, AC, vistas,
   *  terraza, jardín, smart home…) y zonas comunes de la
   *  urbanización. Si `true`, ocultamos esas dos secciones aquí
   *  para no duplicar entrada · solo quedan nombre, dirección,
   *  estilo (plurifamiliar) y certificado energético. */
  defaultsCapturedInExtras?: boolean;
  /** Oculta la sección "Cómo se llama tu promoción" · útil cuando
   *  el componente se embebe en el modal "Características y
   *  amenidades" de la ficha · el nombre se edita desde el bloque
   *  Identidad. Default false (wizard standalone lo muestra). */
  hideNameSection?: boolean;
  /** Oculta la sección "Ubicación" (AddressAutocomplete) · igual
   *  que arriba · la ubicación tiene su propio bloque + popup en
   *  la ficha. */
  hideLocationSection?: boolean;
  /** Si está set, renderiza SOLO esa sección · útil para mini-modales
   *  desde la ficha que editan una sola subárea (amenidades sola,
   *  características solas, urbanización sola, etc.) sin abrir el
   *  modal grande con todo. Default undefined → render completo. */
  onlySection?: "amenidades" | "caracteristicas" | "urbanizacion" | "estilo" | "energia";
}) {
  /* Helper · ¿se debe renderizar esta sección? Si onlySection está
   * set, solo si coincide. Si no, siempre. */
  const showSection = (s: NonNullable<typeof onlySection>) =>
    onlySection ? onlySection === s : true;
  /* Cuando el caller pide UNA sección específica, ignoramos el flag
   * `defaultsCapturedInExtras` · el user clica explícitamente
   * "Características del hogar" en la ficha · debe verlo aunque V5
   * normalmente las capture en otro paso. */
  const effectiveDefaultsCapturedInExtras = onlySection ? false : defaultsCapturedInExtras;
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
      {/* ═════ Nombre ═════ · oculto cuando se embebe en el modal
        * "Características y amenidades" (se edita desde Identidad). */}
      {!hideNameSection && (
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
      )}

      {/* ═════ Dirección Google-style ═════ · oculto cuando se
        * embebe en el modal "Características y amenidades" (la
        * ubicación tiene su propio bloque y popup en la ficha). */}
      {!hideLocationSection && (
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
      )}

      {/* ═════ Estilo arquitectónico · solo plurifamiliar/mixto
             (unifamiliar ya lo elige en el paso sub_varias).

             Filtro · `finca` y `rustico` SOLO aplican a villa
             unifamiliar · un edificio plurifamiliar no es ni "finca
             rural" ni de piedra/madera rústica. ═════ */}
      {showSection("estilo") && !isUnifamiliar && state.estiloVivienda == null && (
        <div>
          <SectionLabel>Estilo arquitectónico</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {estiloViviendaOptions
              .filter((o) => !ESTILOS_SOLO_UNIFAMILIAR.has(o.value))
              .map((o) => (
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
          Rama UNIFAMILIAR: características
          (Solo si V5 NO está capturando defaults · evita duplicado.)
          ═════════════════════════════════════════════════════════════ */}
      {showSection("caracteristicas") && isUnifamiliar && !effectiveDefaultsCapturedInExtras && (
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
          Rama PLURIFAMILIAR / MIXTO: amenities (siempre · son del
          edificio, no de la unidad) + características (solo legacy).
          ═════════════════════════════════════════════════════════════ */}
      {isPlurifamiliar && (
        <>
          {showSection("amenidades") && (
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
          )}

          {showSection("caracteristicas") && !effectiveDefaultsCapturedInExtras && (
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
          )}
        </>
      )}

      {/* ═════ Urbanización master switch (siempre disponible) ═════ */}
      {showSection("urbanizacion") && (
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
            <div className="border-t border-border bg-muted/20 p-4 flex flex-col gap-5">
              {/* Tipo · Cerrada / Resort / Abierta */}
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground mb-1.5 block">
                  Tipo
                </label>
                <div className="flex gap-1.5">
                  {URBANIZACION_TIPOS.map((t) => {
                    const isOn = state.urbanizacionTipo === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          update("urbanizacionTipo", isOn ? null : t.value)
                        }
                        className={cn(
                          "h-8 rounded-full px-3.5 text-[12px] font-medium transition-colors border",
                          isOn
                            ? "bg-foreground text-background border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
                        )}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombre de la urbanización · ocultado de momento ·
               *  el campo `urbanizacionNombre` sigue en el modelo como
               *  cadena vacía por compat con drafts antiguos. */}

              {/* Amenities agrupadas */}
              <div className="flex flex-col gap-4">
                {URBANIZACION_GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                      {g.label}
                    </p>
                    <PillSelect
                      options={g.items}
                      selected={state.zonasComunes}
                      onToggle={toggleZona}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ═════ Certificado energético ═════ */}
      {showSection("energia") && (
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
      )}
    </div>
  );
}
