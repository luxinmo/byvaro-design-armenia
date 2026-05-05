/**
 * ExtrasV5 · Pantalla 5/14 · "Características por defecto" (compacta).
 *
 * Variante activable con `?wizardV5=1`. Patrón "add-on-demand": en vez
 * de mostrar las 12 categorías expandidas, se enseñan como chips "+ X"
 * en la cabecera. Al clicar, la categoría se añade como card debajo
 * con sus opciones · click en la X la quita y limpia sus campos.
 *
 * Visibilidad de una categoría = configurada (algún campo set) || añadida
 * manualmente (state local del componente, transient). Al recargar la
 * pantalla las que tengan datos siguen visibles · las vacías vuelven al
 * picker. Sin polución del schema.
 *
 * Modelo · `state.promotionDefaults` (ver `./types.ts`). Hidratación
 * lazy para drafts viejos sin la key.
 */

import { useEffect, useState } from "react";
import {
  Waves, TreePine, Car, Archive, Sun, Fence,
  Wind, Thermometer, Sparkles, Eye, Compass,
  ShieldAlert, Plus, X,
  ChevronRight, ChevronLeft,
  /* Equipment ampliado · iconos para nuevas opciones */
  Shirt, Wine, Dumbbell, Bath, Flame, UtensilsCrossed,
  ArrowUpDown, LayoutPanelLeft, Cpu, Volleyball, Trophy,
  BatteryCharging,
  /* Views ampliadas */
  Mountain, Building, Sunrise, Sunset, Maximize, Ship,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/Checkbox";
import type { WizardState } from "../types";
import {
  defaultPromotionDefaults,
  type PromotionDefaults,
  type AppliesTo,
  type PriceMode,
} from "./types";

interface Props {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  /** Categorías que el caller quiere OCULTAR (no aparecen en el
   *  picker ni se renderizan como cards aunque estén configuradas).
   *  Útil cuando se embebe el step desde otro contexto (ej. modal
   *  de Características de la ficha quiere ocultar "plot/parcela"
   *  porque pertenece a la unidad, no al edificio). Default vacío. */
  hideCategoryKeys?: string[];
  /** Bloquea el pane del componente · si "extras" · solo muestra el
   *  pane de adicionales (Solárium, Equipamiento, Seguridad, Vistas,
   *  Orientación) sin botón "Volver a esenciales" · si "essentials"
   *  · solo el pane de esenciales sin botón "Más opciones". Default
   *  undefined · 2 panes navegables como en el wizard. */
  lockToPane?: "essentials" | "extras";
}

type CategoryKey =
  | "privatePool" | "parking" | "storageRoom"
  | "solarium" | "terraces" | "plot"
  | "equipment" | "security"
  | "views" | "orientation";

interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: React.ElementType;
  group: "private" | "interior" | "exterior" | "common";
}

const CATEGORIES: CategoryDef[] = [
  { key: "privatePool",   label: "Piscina privada",  icon: Waves,        group: "private" },
  { key: "parking",       label: "Parking",          icon: Car,          group: "private" },
  { key: "storageRoom",   label: "Trastero",         icon: Archive,      group: "private" },
  { key: "plot",          label: "Parcela",          icon: TreePine,     group: "private" },
  { key: "solarium",      label: "Solárium",         icon: Sun,          group: "private" },
  { key: "terraces",      label: "Terrazas",         icon: Sun,          group: "private" },
  { key: "equipment",     label: "Equipamiento",     icon: Sparkles,     group: "interior" },
  { key: "security",      label: "Seguridad",        icon: ShieldAlert,  group: "interior" },
  { key: "views",         label: "Vistas",           icon: Eye,          group: "exterior" },
  { key: "orientation",   label: "Orientación",      icon: Compass,      group: "exterior" },
];

/* Esenciales · siempre visibles arriba como toggle rows. Cubre el 80%
 * de los casos · piscina/jardín/parking/trastero/terrazas suelen
 * aplicar a casi toda promoción de obra nueva.
 *
 * Adicionales · ocultos detrás de chips "+". Solo aparecen si el user
 * los añade explícitamente (solárium, parcela, equipamiento, vistas,
 * etc.) o si ya tienen datos (draft con valores set). */
const ESSENTIAL_KEYS = new Set<CategoryKey>([
  "privatePool", "parking", "storageRoom", "plot", "terraces",
]);

/* Categorías que tienen el control "Aplicar a" (Todas/Algunas/Decidir
 * luego). Se usa para auto-rellenar `appliesTo: "all"` cuando estamos
 * en single-home mode y el control no se renderiza. */
const APPLIES_TO_KEYS = new Set<CategoryKey>([
  "privatePool", "parking", "storageRoom", "solarium", "plot",
]);

/* Derivado · ¿la categoría tiene algún campo configurado? Si sí, se
 * mantiene visible aunque el user no la haya "añadido" manualmente
 * (cubre el caso de reabrir un draft con datos). */
function isConfigured(d: PromotionDefaults, k: CategoryKey): boolean {
  switch (k) {
    case "privatePool":   return d.privatePool.enabled;
    case "parking":       return d.parking.enabled;
    case "storageRoom":   return d.storageRoom.enabled;
    case "solarium":      return d.solarium.enabled;
    case "terraces":      return d.terraces.enabled || d.terraces.covered || d.terraces.uncovered;
    case "plot":          return d.plot.enabled;
    case "equipment":     return Object.values(d.equipment).some((v) =>
      v !== null && v !== false && v !== undefined,
    );
    case "security":      return d.security.alarm || d.security.reinforcedDoor || d.security.videoSurveillance;
    case "views":         return d.views.sea || d.views.oceano || d.views.rio
                            || d.views.mountain || d.views.ciudad || d.views.golf
                            || d.views.panoramic || d.views.amanecer || d.views.atardecer
                            || d.views.abiertas;
    case "orientation":   return d.orientation !== null;
  }
}

/* Reset de una categoría a su default (al hacer click en la X). */
function resetCategory(d: PromotionDefaults, k: CategoryKey): PromotionDefaults {
  return { ...d, [k]: defaultPromotionDefaults[k] } as PromotionDefaults;
}

export function ExtrasV5({ state, update, hideCategoryKeys = [], lockToPane }: Props) {
  const hidden = new Set(hideCategoryKeys);
  /* Hidratación lazy para drafts pre-V5. */
  useEffect(() => {
    if (!state.promotionDefaults) {
      update("promotionDefaults", defaultPromotionDefaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaults = state.promotionDefaults ?? defaultPromotionDefaults;

  /* Single-home mode · una sola vivienda unifamiliar.
   *  - Oculta el control "Aplicar a" (Todas/Algunas/Decidir luego) ·
   *    no tiene sentido elegir "algunas" cuando solo hay UNA.
   *  - Cuando se activa una categoría auto-set `appliesTo = "all"`
   *    para que el validador `canContinue` no bloquee.
   *  - Copy del header en singular ("la vivienda" vs "las viviendas"). */
  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";

  /* Set local · qué categorías ha añadido el user que aún no tienen
   * datos. Las que SÍ tienen datos son visibles via `isConfigured`. */
  const [manualAdded, setManualAdded] = useState<Set<CategoryKey>>(new Set());

  function patch<K extends keyof PromotionDefaults>(
    key: K,
    sub: Partial<PromotionDefaults[K]>,
  ) {
    update("promotionDefaults", {
      ...defaults,
      [key]: { ...defaults[key], ...sub },
    } as PromotionDefaults);
  }

  /* Registra orden de selección · cada vez que el user toggle una
   *  feature, su id se mete al INICIO de selectedOrder. Al desmarcar,
   *  se quita. La ficha pinta los chips en este orden · el último
   *  marcado aparece primero. */
  function recordSelection(key: string, checked: boolean) {
    const current = defaults.selectedOrder ?? [];
    const next = checked
      ? [key, ...current.filter((k) => k !== key)]
      : current.filter((k) => k !== key);
    update("promotionDefaults", { ...defaults, selectedOrder: next });
  }

  function add(k: CategoryKey) {
    setManualAdded((prev) => new Set(prev).add(k));
    /* Single-home · si la categoría tiene `appliesTo` y el control no
     * se renderiza, lo dejamos en "all" desde el principio para que
     * el validador `canContinue` no se quede esperando un valor. */
    if (isSingleHome && APPLIES_TO_KEYS.has(k)) {
      update("promotionDefaults", {
        ...defaults,
        [k]: { ...defaults[k], appliesTo: "all" },
      } as PromotionDefaults);
    }
  }

  function remove(k: CategoryKey) {
    setManualAdded((prev) => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
    update("promotionDefaults", resetCategory(defaults, k));
  }

  const essentials = CATEGORIES.filter((c) => ESSENTIAL_KEYS.has(c.key) && !hidden.has(c.key));
  const additionals = CATEGORIES.filter((c) => !ESSENTIAL_KEYS.has(c.key) && !hidden.has(c.key));

  /* Pane interno · "essentials" (5 esenciales) o "extras" (más
   * opciones avanzadas). Evita que la lista crezca hacia abajo al
   * añadir un chip · cada cosa en su pantalla. El user navega entre
   * las dos con CTAs internos · el Siguiente del wizard exterior
   * sigue funcionando en cualquier pane (los additionales son
   * opcionales). */
  const [paneState, setPane] = useState<"essentials" | "extras">("essentials");
  /* Cuando lockToPane está set, ignoramos el state interno · el
   * pane queda fijo · útil para mini-modales de la ficha. */
  const pane = lockToPane ?? paneState;

  /* Adicionales VISIBLES · orden: ÚLTIMO añadido manualmente PRIMERO ·
   * detrás los configurados desde draft (orden CATEGORIES). El user
   * lo pidió: "siempre el nuevo añadido debe colocarse primero".
   * Sets en JS mantienen orden de inserción · iteramos al revés. */
  const additionalsVisible = (() => {
    const out: typeof additionals = [];
    const seen = new Set<CategoryKey>();
    /* Manualmente añadidos · más reciente primero. */
    const manualKeys = Array.from(manualAdded).reverse();
    for (const k of manualKeys) {
      const c = additionals.find((cat) => cat.key === k);
      if (c && !seen.has(c.key)) {
        out.push(c);
        seen.add(c.key);
      }
    }
    /* Configurados desde draft (no añadidos en esta sesión) · al
     * final, en orden CATEGORIES. */
    for (const c of additionals) {
      if (seen.has(c.key)) continue;
      if (isConfigured(defaults, c.key)) {
        out.push(c);
        seen.add(c.key);
      }
    }
    return out;
  })();
  const additionalsAvailable = additionals.filter(
    (c) => !isConfigured(defaults, c.key) && !manualAdded.has(c.key),
  );
  const additionalsActiveCount = additionals.filter((c) =>
    isConfigured(defaults, c.key),
  ).length;

  if (pane === "essentials") {
    return (
      <div className="flex flex-col gap-5 max-w-[760px] mx-auto w-full">
        <header className="mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Características
          </p>
          <h2 className="text-[19px] sm:text-[22px] font-semibold text-foreground tracking-tight mt-1">
            {isSingleHome ? "¿Qué incluye la vivienda?" : "¿Qué incluyen las viviendas?"}
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
            {isSingleHome
              ? "Activa lo esencial · podrás añadir opciones avanzadas en la siguiente pantalla."
              : "Activa lo esencial de cada vivienda · podrás añadir opciones avanzadas en la siguiente pantalla."}
          </p>
        </header>

        <div className="flex flex-col gap-2">
          {essentials.map((c) => (
            <EssentialRow
              key={c.key}
              def={c}
              defaults={defaults}
              patch={patch}
              update={update}
              isSingleHome={isSingleHome}
              recordSelection={recordSelection}
            />
          ))}
        </div>

        {/* CTA hacia pane "extras" · oculto si lockToPane (mini-modal). */}
        {!lockToPane && (
          <button
            type="button"
            onClick={() => setPane("extras")}
            className="self-start inline-flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-card text-[13px] font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            Más opciones
            {additionalsActiveCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tnum">
                {additionalsActiveCount}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
          </button>
        )}
      </div>
    );
  }

  /* ═══════════ Pane "extras" · picker + cards ═══════════ */
  return (
    <div className="flex flex-col gap-5 max-w-[760px] mx-auto w-full">
      <header className="mb-1">
        {!lockToPane && (
          <button
            type="button"
            onClick={() => setPane("essentials")}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Volver a esenciales
          </button>
        )}
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Más opciones
        </p>
        <h2 className="text-[19px] sm:text-[22px] font-semibold text-foreground tracking-tight mt-1">
          Características adicionales
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
          Añade solo lo que aplica · equipamiento, vistas, zonas comunes, etc.
        </p>
      </header>

      {additionalsAvailable.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {additionalsAvailable.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => add(c.key)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-dashed border-border text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <c.icon className="h-3.5 w-3.5" strokeWidth={1.6} />
              {c.label}
            </button>
          ))}
        </div>
      )}

      {additionalsVisible.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {additionalsVisible.map((c) => (
            <CategoryCard
              key={c.key}
              def={c}
              defaults={defaults}
              patch={patch}
              update={update}
              onRemove={() => remove(c.key)}
              isSingleHome={isSingleHome}
              recordSelection={recordSelection}
            />
          ))}
        </div>
      )}

      {additionalsVisible.length === 0 && additionalsAvailable.length > 0 && (
        <p className="text-[12px] text-muted-foreground italic">
          Selecciona arriba lo que quieras añadir.
        </p>
      )}
    </div>
  );
}

/* ════════════════════ EssentialRow ════════════════════
 * Row compacto siempre visible · click en la fila o en el toggle
 * expande la configuración inline. La X no existe (es esencial · no
 * se quita, solo se desactiva). */
function EssentialRow({
  def,
  defaults,
  patch,
  update,
  isSingleHome,
  recordSelection,
}: {
  def: CategoryDef;
  defaults: PromotionDefaults;
  patch: <K extends keyof PromotionDefaults>(key: K, sub: Partial<PromotionDefaults[K]>) => void;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isSingleHome: boolean;
  recordSelection?: (key: string, checked: boolean) => void;
}) {
  const Icon = def.icon;
  const configured = isConfigured(defaults, def.key);
  const [open, setOpen] = useState(configured);
  /* Para categorías sin `enabled` (terraces) consideramos "activa" si
   * ya tiene algún flag set O si el row está abierto · así el toggle
   * visual refleja el estado real cuando el user abre la card sin
   * haber chequeado nada todavía. */
  const TOGGLE_KEYS = new Set<CategoryKey>([
    "privatePool", "parking", "storageRoom", "solarium", "plot", "terraces",
  ]);
  const hasEnabledFlag = TOGGLE_KEYS.has(def.key);
  const active = configured || (!hasEnabledFlag && open);

  /* Auto-expand cuando se activa por primera vez (el user marca el
   * toggle pero también queremos enseñar las sub-opciones). */
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  function toggleEnabled(v: boolean) {
    if (hasEnabledFlag) {
      /* Si la categoría se desactiva · reset COMPLETO al default ·
       * evita que checkboxes hijos (terraces.covered/uncovered) se
       * queden marcados con la card en off · y para el resto
       * (privatePool, parking, etc.) limpia appliesTo/priceMode
       * residuales si los hubiera. */
      if (!v) {
        update("promotionDefaults", {
          ...defaults,
          [def.key]: defaultPromotionDefaults[def.key],
        } as PromotionDefaults);
      } else {
        /* Single-home · auto-set `appliesTo = "all"` cuando se activa
         * la categoría · el control "Aplicar a" no se renderiza, así
         * que sin esto el validador `canContinue` se queda esperando
         * un valor que nunca llega. */
        const extra = isSingleHome
          ? ({ appliesTo: "all" } as Partial<PromotionDefaults[typeof def.key]>)
          : ({} as Partial<PromotionDefaults[typeof def.key]>);
        patch(def.key, { enabled: v, ...extra } as Partial<PromotionDefaults[typeof def.key]>);
      }
    }
    setOpen(v);
  }

  /* Wrapper de `patch` para esta row · cualquier mutación auto-activa
   * la categoría (flipa `enabled=true` si aplica). Resuelve el bug de
   * "edito Aplicar a / Precio pero la card sigue gris". */
  function patchAuto<K extends keyof PromotionDefaults>(
    key: K,
    sub: Partial<PromotionDefaults[K]>,
  ) {
    if (
      key === def.key &&
      hasEnabledFlag &&
      !(defaults[def.key] as { enabled?: boolean }).enabled
    ) {
      patch(key, { ...sub, enabled: true } as Partial<PromotionDefaults[K]>);
    } else {
      patch(key, sub);
    }
  }

  /* Click en cualquier zona del header (icono / título / row) ALTERNA
   * activado/desactivado. Mismo efecto que pulsar el toggle del
   * extremo derecho · una sola interacción consistente para el user. */
  function handleHeaderClick() {
    toggleEnabled(!active);
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-colors",
        active ? "border-primary/30" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={handleHeaderClick}
        className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 text-left"
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl shrink-0",
            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <span className="flex-1 text-[14px] font-medium text-foreground">{def.label}</span>
        <ToggleSwitch
          checked={active}
          onClick={(e) => {
            e.stopPropagation();
            toggleEnabled(!active);
          }}
        />
      </button>
      {open && (
        <div className="border-t border-border/60 p-4 sm:p-5 flex flex-col gap-3">
          <CategoryBody
            def={def}
            defaults={defaults}
            patch={patchAuto}
            update={update}
            isSingleHome={isSingleHome}
            recordSelection={recordSelection}
          />
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "bg-primary" : "bg-muted-foreground/25 hover:bg-muted-foreground/35",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </span>
  );
}

/* ════════════════════ CategoryCard ════════════════════ */

function CategoryCard({
  def,
  defaults,
  patch,
  update,
  onRemove,
  isSingleHome,
  recordSelection,
}: {
  def: CategoryDef;
  defaults: PromotionDefaults;
  patch: <K extends keyof PromotionDefaults>(key: K, sub: Partial<PromotionDefaults[K]>) => void;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onRemove: () => void;
  isSingleHome: boolean;
  recordSelection?: (key: string, checked: boolean) => void;
}) {
  const Icon = def.icon;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-border/60">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <p className="text-[14px] font-medium text-foreground flex-1">{def.label}</p>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar"
          className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <CategoryBody
          def={def}
          defaults={defaults}
          patch={patch}
          update={update}
          isSingleHome={isSingleHome}
          recordSelection={recordSelection}
        />
      </div>
    </div>
  );
}

/* ════════════════════ Body por categoría ════════════════════ */

function CategoryBody({
  def,
  defaults,
  patch,
  update,
  isSingleHome,
  recordSelection,
}: {
  def: CategoryDef;
  defaults: PromotionDefaults;
  patch: <K extends keyof PromotionDefaults>(key: K, sub: Partial<PromotionDefaults[K]>) => void;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isSingleHome: boolean;
  recordSelection?: (key: string, checked: boolean) => void;
}) {
  switch (def.key) {
    case "privatePool":
      return (
        <>
          {!isSingleHome && (
            <AppliesToControl
              value={defaults.privatePool.appliesTo}
              onChange={(v) => patch("privatePool", { appliesTo: v })}
            />
          )}
          <PriceModeControl
            value={defaults.privatePool.priceMode}
            onChange={(v) => patch("privatePool", { priceMode: v })}
            optionalPrice={defaults.privatePool.optionalPrice}
            onOptionalPriceChange={(v) => patch("privatePool", { optionalPrice: v })}
          />
        </>
      );

    case "parking":
      return (
        <>
          <Row label={isSingleHome ? "Plazas" : "Plazas por vivienda"}>
            <NumberStepper
              value={defaults.parking.spaces}
              min={1}
              max={6}
              onChange={(v) => patch("parking", { spaces: v })}
            />
          </Row>
          <SegmentedControl
            label="Tipo"
            value={defaults.parking.type}
            options={[
              { value: "outdoor", label: "Exterior" },
              { value: "closed_garage", label: "Garaje cerrado" },
            ]}
            onChange={(v) => patch("parking", { type: v as "outdoor" | "closed_garage" })}
          />
          <PriceModeControl
            value={defaults.parking.priceMode}
            onChange={(v) => patch("parking", { priceMode: v })}
            optionalPrice={defaults.parking.optionalPrice}
            onOptionalPriceChange={(v) => patch("parking", { optionalPrice: v })}
          />
          {!isSingleHome && (
            <AppliesToControl
              value={defaults.parking.appliesTo}
              onChange={(v) => patch("parking", { appliesTo: v })}
            />
          )}
        </>
      );

    case "storageRoom":
      return (
        <>
          {!isSingleHome && (
            <AppliesToControl
              value={defaults.storageRoom.appliesTo}
              onChange={(v) => patch("storageRoom", { appliesTo: v })}
            />
          )}
          <PriceModeControl
            value={defaults.storageRoom.priceMode}
            onChange={(v) => patch("storageRoom", { priceMode: v })}
            optionalPrice={defaults.storageRoom.optionalPrice}
            onOptionalPriceChange={(v) => patch("storageRoom", { optionalPrice: v })}
          />
        </>
      );

    case "solarium":
      return (
        <>
          {!isSingleHome && (
            <AppliesToControl
              value={defaults.solarium.appliesTo}
              onChange={(v) => patch("solarium", { appliesTo: v })}
            />
          )}
          <PriceModeControl
            value={defaults.solarium.priceMode}
            onChange={(v) => patch("solarium", { priceMode: v })}
            optionalPrice={defaults.solarium.optionalPrice}
            onOptionalPriceChange={(v) => patch("solarium", { optionalPrice: v })}
          />
        </>
      );

    case "terraces":
      return (
        <CheckboxGrid
          items={[
            { key: "covered",   label: "Cubierta",     checked: defaults.terraces.covered,
              onChange: (v) => patch("terraces", { covered: v }) },
            { key: "uncovered", label: "Descubierta",  checked: defaults.terraces.uncovered,
              onChange: (v) => patch("terraces", { uncovered: v }) },
          ]}
        />
      );

    case "plot":
      return (
        <>
          <Row label="Superficie desde">
            <NumberInput
              value={defaults.plot.minSizeSqm}
              placeholder="m²"
              onChange={(v) => patch("plot", { minSizeSqm: v })}
            />
            <span className="text-[12px] text-muted-foreground tnum">m²</span>
          </Row>
          {!isSingleHome && (
            <AppliesToControl
              value={defaults.plot.appliesTo}
              onChange={(v) => patch("plot", { appliesTo: v })}
            />
          )}
        </>
      );

    case "equipment": {
      const eq = defaults.equipment;
      const eqPatch = (sub: Partial<PromotionDefaults["equipment"]>) =>
        patch("equipment", sub);
      return (
        <>
          {/* Confort base · climatización + cocina con sub-tipo */}
          <SubGroup label="Confort">
            <ToggleRow
              icon={Wind}
              label="Aire acondicionado"
              checked={eq.airConditioning}
              onChange={(v) => eqPatch({ airConditioning: v })}
            >
              <SegmentedControl
                value={eq.airConditioningType ?? ""}
                options={[
                  { value: "central",         label: "Central" },
                  { value: "split",           label: "Split" },
                  { value: "preinstallation", label: "Preinst." },
                ]}
                onChange={(v) =>
                  eqPatch({ airConditioningType: v as "central" | "split" | "preinstallation" })
                }
              />
            </ToggleRow>
            <ToggleRow
              icon={Thermometer}
              label="Calefacción"
              checked={eq.heating}
              onChange={(v) => eqPatch({ heating: v })}
            >
              <SegmentedControl
                value={eq.heatingType ?? ""}
                options={[
                  { value: "underfloor", label: "Suelo radiante" },
                  { value: "central",    label: "Central" },
                  { value: "gas",        label: "Gas" },
                ]}
                onChange={(v) => eqPatch({ heatingType: v as "underfloor" | "central" | "gas" })}
              />
            </ToggleRow>
            <ToggleRow
              icon={UtensilsCrossed}
              label="Cocina equipada"
              checked={eq.equippedKitchen}
              onChange={(v) => eqPatch({ equippedKitchen: v })}
            >
              <SegmentedControl
                value={eq.kitchenType ?? ""}
                options={[
                  { value: "open",        label: "Abierta" },
                  { value: "independent", label: "Independ." },
                ]}
                onChange={(v) => eqPatch({ kitchenType: v as "open" | "independent" })}
              />
            </ToggleRow>
          </SubGroup>

          {/* Eficiencia / smart home */}
          <SubGroup label="Eficiencia y smart">
            <IconCheckboxGrid
              items={[
                { key: "domotics",       label: "Domótica",              icon: Cpu,             checked: eq.domotics,        onChange: (v) => eqPatch({ domotics: v }) },
                { key: "solarPanels",    label: "Paneles solares",       icon: Sun,             checked: eq.solarPanels,     onChange: (v) => eqPatch({ solarPanels: v }) },
                { key: "chargingPoint",  label: "Punto de carga VE",     icon: BatteryCharging, checked: eq.chargingPoint,   onChange: (v) => eqPatch({ chargingPoint: v }) },
                { key: "electricBlinds", label: "Persianas eléctricas",  icon: LayoutPanelLeft, checked: eq.electricBlinds,  onChange: (v) => eqPatch({ electricBlinds: v }) },
                { key: "doubleGlazing",  label: "Doble acristalamiento", icon: LayoutPanelLeft, checked: eq.doubleGlazing,   onChange: (v) => eqPatch({ doubleGlazing: v }) },
              ]}
            />
          </SubGroup>

          {/* Espacios extra · armarios, vestidor, lavandería, bodega, chimenea */}
          <SubGroup label="Espacios extra">
            <IconCheckboxGrid
              items={[
                { key: "armariosEmpotrados", label: "Armarios empotrados", icon: Archive, checked: eq.armariosEmpotrados, onChange: (v) => eqPatch({ armariosEmpotrados: v }) },
                { key: "vestidor",  label: "Vestidor",     icon: Shirt, checked: eq.vestidor,  onChange: (v) => eqPatch({ vestidor: v }) },
                { key: "lavanderia", label: "Lavandería",   icon: Shirt, checked: eq.lavanderia, onChange: (v) => eqPatch({ lavanderia: v }) },
                { key: "bodega",     label: "Bodega",       icon: Wine,  checked: eq.bodega,    onChange: (v) => eqPatch({ bodega: v }) },
                { key: "chimenea",   label: "Chimenea",     icon: Flame, checked: eq.chimenea,  onChange: (v) => eqPatch({ chimenea: v }) },
                { key: "ascensor",   label: "Ascensor",     icon: ArrowUpDown, checked: eq.ascensor, onChange: (v) => eqPatch({ ascensor: v }) },
              ]}
            />
          </SubGroup>

          {/* Wellness · gym, sauna, jacuzzi, hammam */}
          <SubGroup label="Wellness">
            <IconCheckboxGrid
              items={[
                { key: "gym",     label: "Gimnasio", icon: Dumbbell, checked: eq.gym,     onChange: (v) => eqPatch({ gym: v }) },
                { key: "sauna",   label: "Sauna",    icon: Flame,    checked: eq.sauna,   onChange: (v) => eqPatch({ sauna: v }) },
                { key: "jacuzzi", label: "Jacuzzi",  icon: Bath,     checked: eq.jacuzzi, onChange: (v) => eqPatch({ jacuzzi: v }) },
                { key: "hammam",  label: "Hammam",   icon: Bath,     checked: eq.hammam,  onChange: (v) => eqPatch({ hammam: v }) },
              ]}
            />
          </SubGroup>

          {/* Exterior y ocio · BBQ, tenis, pádel */}
          <SubGroup label="Exterior y ocio">
            <IconCheckboxGrid
              items={[
                { key: "bbq",   label: "Barbacoa (BBQ)", icon: Flame,      checked: eq.bbq,   onChange: (v) => eqPatch({ bbq: v }) },
                { key: "tenis", label: "Pista de tenis", icon: Trophy,     checked: eq.tenis, onChange: (v) => eqPatch({ tenis: v }) },
                { key: "padel", label: "Pista de pádel", icon: Volleyball, checked: eq.padel, onChange: (v) => eqPatch({ padel: v }) },
              ]}
            />
          </SubGroup>
        </>
      );
    }

    case "security":
      return (
        <CheckboxGrid
          items={[
            { key: "alarm",             label: "Alarma",          checked: defaults.security.alarm,
              onChange: (v) => patch("security", { alarm: v }) },
            { key: "reinforcedDoor",    label: "Puerta blindada", checked: defaults.security.reinforcedDoor,
              onChange: (v) => patch("security", { reinforcedDoor: v }) },
            { key: "videoSurveillance", label: "Videovigilancia", checked: defaults.security.videoSurveillance,
              onChange: (v) => patch("security", { videoSurveillance: v }) },
          ]}
        />
      );

    case "views": {
      const vw = defaults.views;
      const vwPatch = (sub: Partial<PromotionDefaults["views"]>) => patch("views", sub);
      return (
        <IconCheckboxGrid
          items={[
            { key: "sea",       label: "Mar",            icon: Waves,    checked: vw.sea,       onChange: (v) => vwPatch({ sea: v }) },
            { key: "oceano",    label: "Océano",         icon: Ship,     checked: vw.oceano,    onChange: (v) => vwPatch({ oceano: v }) },
            { key: "rio",       label: "Río",            icon: Waves,    checked: vw.rio,       onChange: (v) => vwPatch({ rio: v }) },
            { key: "mountain",  label: "Montaña",        icon: Mountain, checked: vw.mountain,  onChange: (v) => vwPatch({ mountain: v }) },
            { key: "ciudad",    label: "Ciudad",         icon: Building, checked: vw.ciudad,    onChange: (v) => vwPatch({ ciudad: v }) },
            { key: "golf",      label: "Golf",           icon: Trophy,   checked: vw.golf,      onChange: (v) => vwPatch({ golf: v }) },
            { key: "panoramic", label: "Panorámicas",    icon: Eye,      checked: vw.panoramic, onChange: (v) => vwPatch({ panoramic: v }) },
            { key: "amanecer",  label: "Al amanecer",    icon: Sunrise,  checked: vw.amanecer,  onChange: (v) => vwPatch({ amanecer: v }) },
            { key: "atardecer", label: "Al atardecer",   icon: Sunset,   checked: vw.atardecer, onChange: (v) => vwPatch({ atardecer: v }) },
            { key: "abiertas",  label: "Vistas abiertas", icon: Maximize, checked: vw.abiertas,  onChange: (v) => vwPatch({ abiertas: v }) },
          ]}
        />
      );
    }

    case "orientation":
      return (
        <SegmentedControl
          value={defaults.orientation ?? ""}
          options={[
            { value: "north",     label: "Norte" },
            { value: "northeast", label: "Noreste" },
            { value: "east",      label: "Este" },
            { value: "southeast", label: "Sureste" },
            { value: "south",     label: "Sur" },
            { value: "southwest", label: "Suroeste" },
            { value: "west",      label: "Oeste" },
            { value: "northwest", label: "Noroeste" },
          ]}
          onChange={(v) =>
            update("promotionDefaults", {
              ...defaults,
              orientation: v as PromotionDefaults["orientation"],
            })
          }
        />
      );

  }
}

/* ════════════════════ Sub-componentes UI ════════════════════ */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-foreground">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberStepper({
  value, min, max, onChange,
}: {
  value: number; min?: number; max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min ?? 0, value - 1))}
        disabled={min !== undefined && value <= min}
        className="h-6 w-6 rounded-full bg-card text-foreground hover:bg-card/70 disabled:opacity-30 disabled:cursor-not-allowed text-[14px] leading-none"
      >
        −
      </button>
      <span className="min-w-[20px] text-center text-[13px] font-medium tnum">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}
        disabled={max !== undefined && value >= max}
        className="h-6 w-6 rounded-full bg-card text-foreground hover:bg-card/70 disabled:opacity-30 disabled:cursor-not-allowed text-[14px] leading-none"
      >
        +
      </button>
    </div>
  );
}

function NumberInput({
  value, placeholder, onChange,
}: {
  value: number | null; placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className="w-24 h-8 rounded-lg border border-border bg-background px-2.5 text-[13px] tnum text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

function SegmentedControl<T extends string>({
  label, value, options, onChange,
}: {
  label?: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {label && <span className="text-[13px] text-foreground">{label}</span>}
      <div className="inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap",
              value === o.value
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AppliesToControl({
  value, onChange,
}: {
  value: AppliesTo | null; onChange: (v: AppliesTo) => void;
}) {
  return (
    <SegmentedControl
      label="Aplicar a"
      value={value ?? ""}
      options={[
        { value: "all",   label: "Todas" },
        { value: "some",  label: "Algunas" },
        { value: "later", label: "Decidir luego" },
      ]}
      onChange={onChange}
    />
  );
}

function PriceModeControl({
  value, onChange,
  optionalPrice, onOptionalPriceChange,
}: {
  value: PriceMode | null;
  onChange: (v: PriceMode) => void;
  /** Precio (€) cuando `value === "optional"` · captura el upsell que
   *  el promotor cobra por activar el extra en cada unidad. Solo se
   *  renderiza cuando "Opcional" está seleccionado. */
  optionalPrice?: number | null;
  onOptionalPriceChange?: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SegmentedControl
        label="Precio"
        value={value ?? ""}
        options={[
          { value: "included",     label: "Incluido" },
          { value: "optional",     label: "Opcional" },
          { value: "not_included", label: "No incluido" },
        ]}
        onChange={onChange}
      />
      {value === "optional" && onOptionalPriceChange && (
        <Row label="Precio opcional">
          <input
            type="text"
            inputMode="numeric"
            value={optionalPrice && optionalPrice > 0 ? optionalPrice.toLocaleString("es-ES") : ""}
            placeholder="0"
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              onOptionalPriceChange(digits === "" ? null : Number(digits));
            }}
            className="w-32 h-8 rounded-lg border border-border bg-background px-2.5 text-[13px] tnum text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-[12px] text-muted-foreground">€</span>
        </Row>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
  children,
}: {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/50 transition-colors",
        checked ? "border-primary/30" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Icon className={cn("h-3.5 w-3.5", checked ? "text-primary" : "text-muted-foreground")} />
        <p className="text-[13px] text-foreground flex-1">{label}</p>
        <Checkbox
          id={`tr-${label}`}
          checked={checked}
          onCheckedChange={onChange}
        />
      </div>
      {checked && children && (
        <div className="px-3 pb-2.5 pt-0.5">{children}</div>
      )}
    </div>
  );
}

function CheckboxGrid({
  items,
}: {
  items: { key: string; label: string; checked: boolean; onChange: (v: boolean) => void }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((it) => (
        <Checkbox
          key={it.key}
          id={`cbx-${it.key}`}
          checked={it.checked}
          onCheckedChange={it.onChange}
          label={it.label}
        />
      ))}
    </div>
  );
}

/* ─── SubGroup · agrupador visual con label discreto ──────────── */
function SubGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </p>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

/* ─── IconCheckboxGrid · checkbox + icon + label · grid 2-3 col ───
 *  Sustituye al `CheckboxGrid` plano cuando queremos cada item con
 *  su icono · más visual y rápido de escanear. Click en cualquier
 *  zona del item alterna el checkbox. */
function IconCheckboxGrid({
  items,
}: {
  items: {
    key: string;
    label: string;
    icon: React.ElementType;
    checked: boolean;
    onChange: (v: boolean) => void;
  }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => it.onChange(!it.checked)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
              it.checked
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg shrink-0",
              it.checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <span className={cn(
              "flex-1 text-[12.5px]",
              it.checked ? "font-semibold text-foreground" : "text-foreground",
            )}>
              {it.label}
            </span>
            <span
              className={cn(
                "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                it.checked ? "border-primary bg-primary" : "border-muted-foreground/30",
              )}
            >
              {it.checked && <X className="h-2.5 w-2.5 text-primary-foreground rotate-45" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
