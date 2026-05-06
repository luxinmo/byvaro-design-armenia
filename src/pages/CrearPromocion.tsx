/**
 * Crear promoción · Wizard multi-paso — REDISEÑO v3
 *
 * Shell reconstruida:
 *   - Sidebar izquierda: PhaseTimeline con 6 fases colapsables
 *   - Topbar: título del paso, AutoSaveIndicator, botón "Publicar rápido",
 *     cierre
 *   - Contenido central: el paso actual (transición framer-motion) · usa
 *     todo el ancho disponible
 *   - Footer: Atrás · Omitir (condicional) · Siguiente/Publicar
 *   - Auto-save a localStorage con timestamp visible
 *
 * Los pasos ya portados del original Lovable se mantienen intactos. Los
 * nuevos pasos del rediseño (info_basica revamped, multimedia, descripción,
 * etc.) se irán añadiendo en commits C3–C9.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { memCache } from "@/lib/memCache";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Plus, Sparkles, Rocket, SkipForward } from "lucide-react";
import { toast } from "sonner"; // Toaster global en App.tsx

import type {
  StepId, WizardState, RoleOption, TipoPromocion,
  SubUni, SubVarias, EstadoPromocion, FaseConstruccion, EstiloVivienda,
} from "@/components/crear-promocion/types";
import { defaultWizardState } from "@/components/crear-promocion/types";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { unitsByPromotion } from "@/data/units";
import { promotionToWizardState } from "@/lib/promotionToWizardState";
import {
  getOverride as getPromoWizardOverride,
  saveOverride as savePromoWizardOverride,
} from "@/lib/promotionWizardOverrides";
import { canPublishWizard } from "@/lib/publicationRequirements";
import { saveDraft as persistDraft, getDraft, deleteDraft, listDrafts } from "@/lib/promotionDrafts";
import { generatePublicRef } from "@/lib/publicRef";
import { ExtrasV5 } from "@/components/crear-promocion/extras-v5";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileWarning } from "lucide-react";
import { createPromotionFromWizard, deleteCreatedPromotion } from "@/lib/promotionsStorage";
import { currentOrgIdentity } from "@/lib/orgCollabRequests";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useUsageGuard } from "@/lib/usageGuard";
import {
  roleOptions, tipoOptions, subUniOptions, subVariasOptions,
  estadoOptions, faseConstruccionOptions, estiloViviendaOptions,
} from "@/components/crear-promocion/options";
import { OptionCard, NumericStepper, InlineStepper, TotalSummary } from "@/components/crear-promocion/SharedWidgets";
import { getAllSteps } from "@/components/crear-promocion/StepTimeline";
import { PhaseTimeline } from "@/components/crear-promocion/PhaseTimeline";
import { AutoSaveIndicator } from "@/components/crear-promocion/AutoSaveIndicator";
import { InfoBasicaStep } from "@/components/crear-promocion/InfoBasicaStep";
import { DetallesStep } from "@/components/crear-promocion/DetallesStep";
import { DescripcionStep } from "@/components/crear-promocion/DescripcionStep";
import { PlanPagosStep } from "@/components/crear-promocion/PlanPagosStep";
import { MultimediaStep } from "@/components/crear-promocion/MultimediaStep";
import { ColaboradoresStep } from "@/components/crear-promocion/ColaboradoresStep";
import { CrearUnidadesStep } from "@/components/crear-promocion/CrearUnidadesStep";
import { RevisionStep } from "@/components/crear-promocion/RevisionStep";
import { EstadoStep } from "@/components/crear-promocion/EstadoStep";
import { EditStepModal, isSupportedInModal } from "@/components/crear-promocion/EditStepModal";
import { ConfiguracionEdificio } from "@/components/crear-promocion/configuracion-edificio";
import { ConfiguracionEdificioV3 } from "@/components/crear-promocion/configuracion-edificio/index-v3";
import { ConfiguracionEdificioV4 } from "@/components/crear-promocion/configuracion-edificio/index-v4";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import { futureTrimesterOptions } from "@/lib/futureTrimesters";
import {
  FileCheck, FileX, Calendar as CalendarIconLucide, Home as HomeIcon, Store as StoreIcon,
  Minus, Archive, Car, Waves, Building2, Trash2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Persistencia · una sola fuente de verdad en promotionDrafts.ts.
   El legacy DRAFT_KEY se mantiene solo como lectura para migración;
   una vez migrado al array de drafts se elimina automáticamente.
   ═══════════════════════════════════════════════════════════════════ */
const LEGACY_DRAFT_KEY = "byvaro-crear-promocion-draft";
/** Lee el legacy single-draft una única vez; después se borra. */
const loadLegacyDraft = (): WizardState | null => {
  try {
    const r = memCache.getItem(LEGACY_DRAFT_KEY);
    if (!r) return null;
    memCache.removeItem(LEGACY_DRAFT_KEY); // consumido
    return { ...defaultWizardState, ...JSON.parse(r) };
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════════
   Metadatos de cada paso (título + subtítulo mostrados en la cabecera)
   ═══════════════════════════════════════════════════════════════════ */
const stepMeta: Record<StepId, { title: string; subtitle: string }> = {
  role: { title: "Crear nueva promoción", subtitle: "¿Cómo deseas crear esta promoción?" },
  tipo: { title: "Tipo de promoción", subtitle: "Selecciona el tipo de promoción" },
  sub_uni: { title: "Vivienda unifamiliar", subtitle: "¿Cuántas viviendas tendrá la promoción?" },
  sub_varias: { title: "Tipología y estilo", subtitle: "Selecciona el tipo y estilo arquitectónico" },
  config_edificio: { title: "Configuración del edificio", subtitle: "Define la estructura y distribución de plantas" },
  extras: { title: "Anejos y extras", subtitle: "Configura trasteros y plazas de parking por vivienda" },
  equipamiento: { title: "Equipamiento de las viviendas", subtitle: "Lo que incluye CADA vivienda · climatización, smart home, wellness y más" },
  estado: { title: "Estado de la promoción", subtitle: "¿En qué fase se encuentra?" },
  detalles: { title: "Detalles finales", subtitle: "Configuración adicional de la promoción" },
  info_basica: { title: "Información básica", subtitle: "Nombre, ubicación y características" },
  multimedia: { title: "Multimedia", subtitle: "Fotografías y videos de la promoción" },
  descripcion: { title: "Descripción", subtitle: "Describe la promoción para los compradores" },
  crear_unidades: { title: "Crear unidades", subtitle: "Configura las unidades de la promoción" },
  colaboradores: { title: "Colaboración", subtitle: "Define cómo se compensará a las agencias colaboradoras" },
  plan_pagos: { title: "Plan de pagos", subtitle: "Define cómo pagará el comprador durante el proceso de compra" },
  revision: { title: "Revisión y publicación", subtitle: "Últimos ajustes antes de lanzar tu promoción" },
};

/* ═══════════════════════════════════════════════════════════════════
   Qué pasos admiten "Omitir" (se guardan con null/vacío y generan un
   warning amarillo en la revisión final). No se puede omitir nada
   estructural: rol, tipo, configuración del edificio, estado e info
   básica son obligatorios para poder publicar.
   ═══════════════════════════════════════════════════════════════════ */
const SKIPPABLE_STEPS: ReadonlySet<StepId> = new Set<StepId>([
  "extras",
  "detalles",
  "multimedia",
  "descripcion",
  "colaboradores",
  "plan_pagos",
]);

/* ═══════════════════════════════════════════════════════════════════
   Condición mínima para "Publicar rápido". Se cumple cuando la
   promoción tiene la información imprescindible: rol, tipo, una
   configuración válida según la ramificación, estado y un nombre +
   ciudad de ubicación.
   ═══════════════════════════════════════════════════════════════════ */
function hasPublishMinimums(s: WizardState): boolean {
  // Requisitos duros para publicar — delegamos en la fuente única de
  // verdad en src/lib/publicationRequirements.ts para que el wizard y
  // la ficha apliquen exactamente las mismas reglas.
  //
  // Además mantenemos chequeos estructurales básicos del wizard (rol,
  // tipo y ramificación) porque sin ellos los pasos posteriores ni se
  // generan.
  if (!s.role || !s.tipo) return false;
  if (s.tipo === "unifamiliar") {
    if (!s.subUni) return false;
    if (s.subUni === "una_sola" && (!s.subVarias || !s.estiloVivienda)) return false;
    if (s.subUni === "varias" && (s.tipologiasSeleccionadas.length === 0 || s.estilosSeleccionados.length === 0)) return false;
  }
  if (s.tipo === "plurifamiliar" || s.tipo === "mixto") {
    if (s.numBloques < 1 || s.plantas < 1 || s.aptosPorPlanta < 1) return false;
  }
  if (!s.nombrePromocion?.trim()) return false;

  // Requisitos de negocio (fotos, unidades, plan pago, ubicación, entrega,
  // estado construcción, comisiones si colabora):
  return canPublishWizard(s);
}

/* ═══════════════════════════════════════════════════════════════════
   Página principal
   ═══════════════════════════════════════════════════════════════════ */
export default function CrearPromocion() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const confirm = useConfirm();
  /* Paywall · Fase 1 · Bloquea la publicación si el plan trial ya
     tiene 2 promociones activas. Borrador y guardado siguen libres
     para no dejar trabajo perdido. */
  const createGuard = useUsageGuard("createPromotion");
  const [searchParams, setSearchParams] = useSearchParams();
  const draftIdParam = searchParams.get("draft");
  /* Feature flag · activa el rediseño del paso "Configuración del
   * edificio" (wizard conversacional con preview en vivo). Mientras
   * está en validación, sin la flag el componente actual sigue
   * funcionando intacto. URL típica · ?wizardV2=1&draft=... */
  const wizardV2 = searchParams.get("wizardV2") === "1";
  /* Variante V3 · binary cards con auto-advance ("Una/varias escaleras",
   * "Uno/varios bloques") · plantas y viviendas al final. URL típica
   * · ?wizardV3=1&draft=... */
  const wizardV3 = searchParams.get("wizardV3") === "1";
  /* Variante V4 · bloques primero (sin selección por defecto) ·
   * configuración per-bloque cuando hay varios. URL típica
   * · ?wizardV4=1&draft=... */
  const wizardV4 = searchParams.get("wizardV4") === "1";
  /* V5 ya es el default · `?wizardV5=1` queda como alias por compat
   * (no cambia nada), pero no se necesita activarlo · `ExtrasV5`
   * sustituye al step extras legacy en TODOS los flujos. */
  /* Sub-step interno de V4 · necesario para gatear el Siguiente global
   * del wizard exterior. Mientras V4 no está en "resumen", el botón
   * Siguiente del footer queda inactivo · evita saltar al paso 4 sin
   * haber confirmado la configuración del edificio. */
  const [v4InternalSubstep, setV4InternalSubstep] = useState<string>("bloques");
  /* `?promotionId=X` · cuando el wizard se abre desde la ficha de una
   *  promoción YA creada (botón "Completar todo" o "Editar"), hidratamos
   *  el `WizardState` con todos los datos existentes · evita que pasos
   *  ya rellenados aparezcan como pendientes. Sin esto, el wizard
   *  arrancaba con `defaultWizardState` (vacío) aunque el `Promotion`
   *  estuviera 95% completo · inconsistencia que confundía al user. */
  const promotionIdParam = searchParams.get("promotionId");
  /** `singleSave=1` · modo "guarda este paso y vuelve". Al activarse,
   *  el footer "Siguiente" se sustituye por "Guardar" · al pulsar,
   *  guarda el override del paso actual y navega a `returnTo`. Útil
   *  cuando el user llega aquí desde un guard ("Configura comisiones
   *  primero") · sólo necesita resolver ese campo concreto. */
  const singleSaveMode = searchParams.get("singleSave") === "1";
  const returnToParam = searchParams.get("returnTo");

  /* Guard de `/crear-promocion` sin params · ELIMINADO 2026-05-04 ·
   *  ahora el wizard puede entrar SIN draft (state in-memory) ·
   *  el draft se persiste solo cuando el user lo decide (Guardar
   *  borrador, Activar, Subir imagen). Si entra y sale sin tocar
   *  nada · cero datos en DB. */

  /* Carga inicial · prioridad: ?draft=> ?promotionId=> legacy.
   *
   *  CAMBIO 2026-05-04 · el draft se crea LAZY (`ensureDraftId`)
   *  cuando el user toca acciones que requieren persistencia
   *  (Guardar borrador, Activar, Subir imagen). Sin ?draft= en URL
   *  el wizard arranca con state in-memory · `id: null` · el user
   *  puede entrar y salir sin generar nada en DB. */
  const initialDraft = useMemo(() => {
    if (draftIdParam) {
      const d = getDraft(draftIdParam);
      if (d) return { id: d.id, state: d.state, currentStep: d.currentStep };
    }
    /* Hidratar desde Promotion existente · cubre marketplace seeds y
     *  developerOnlyPromotions. Buscamos por id O por code (PR44444…).
     *  PRIORIDAD · si hay override guardado del wizard sobre esa
     *  misma promo, lo cargamos antes que el mapper · preserva edits
     *  del user (descripción, fotos extra, ajustes de comisiones)
     *  entre sesiones. */
    if (promotionIdParam) {
      const all = [...promotions, ...developerOnlyPromotions];
      const found = all.find((p) => p.id === promotionIdParam || p.code === promotionIdParam);
      if (found) {
        const override = getPromoWizardOverride(found.id);
        if (override) return { id: null as string | null, state: override };
        const units = unitsByPromotion[found.id] ?? [];
        return { id: null as string | null, state: promotionToWizardState(found, units) };
      }
    }
    const legacy = loadLegacyDraft(); // se consume y borra la legacy key
    if (legacy) {
      const ref = legacy.publicRef ?? generatePublicRef("promotion");
      return { id: `d-${ref}` as string | null, state: { ...legacy, publicRef: ref } };
    }
    /* Sin params · el effect de redirect ya disparó · este state
     *  no se llega a renderizar. Devolvemos shape vacío para que TS
     *  no se queje. */
    return { id: null as string | null, state: defaultWizardState };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<WizardState>(initialDraft.state);
  /* `draftId` vive en useState para que el UI pueda re-renderizar
   *  cuando se asigne (ej. cambiar el href "Continuar más tarde"), pero
   *  TAMBIÉN en useRef para que el autosave debounced lo lea
   *  SINCRÓNICAMENTE. Sin el ref, había una race condition: el primer
   *  autosave llamaba persistDraft(state, undefined) → genera id "X"
   *  → setDraftId("X") (async). Si el usuario cambiaba state antes de
   *  que React aplicara el set, el effect re-corría con `draftId` aún
   *  null → otro persistDraft(state, undefined) → id "Y" → 2 borradores
   *  duplicados en el listado de incompletas. */
  const [draftId, setDraftIdState] = useState<string | null>(initialDraft.id);
  const draftIdRef = useRef<string | null>(initialDraft.id);
  const setDraftId = useCallback((id: string) => {
    draftIdRef.current = id;
    setDraftIdState(id);
  }, []);

  /* Sync URL ↔ draftId · si entramos sin `?draft=` pero ya tenemos
   * uno asignado por el initialDraft, reflejamos el id en la URL con
   * replace para que un refresh continúe el MISMO borrador en lugar
   * de generar otro. La persistencia ya se hizo en el useMemo de
   * initialDraft (lazy init · evita doble-mount de StrictMode). */
  useEffect(() => {
    if (promotionIdParam) return;
    if (!draftId) return;
    if (draftIdParam) return;
    const next = new URLSearchParams(searchParams);
    next.set("draft", draftId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Resuelve `?promotionId=X` al `id` interno · activa el flujo de
   *  override (save/load) en vez del flujo de drafts genérico. */
  const resolvedPromotionId = useMemo(() => {
    if (!promotionIdParam) return null;
    const all = [...promotions, ...developerOnlyPromotions];
    const found = all.find((p) => p.id === promotionIdParam || p.code === promotionIdParam);
    return found?.id ?? null;
  }, [promotionIdParam]);
  // Modo "sólo completar lo que falta" · activado desde la ficha. El
  // wizard salta todos los pasos ya completados y al terminar vuelve a
  // la ficha (returnTo) en vez de ir al paso de revisión.
  const onlyMissing = searchParams.get("onlyMissing") === "1";
  const returnTo = searchParams.get("returnTo");
  /* Step inicial · prioridad:
   *  1. `?step=` explícito en URL (deep-link · `Continuar editando`
   *     desde la ficha siempre lo pasa).
   *  2. `currentStep` guardado en el draft (donde el user dejó el
   *     wizard la última vez · "guardé y salí").
   *  3. Default "role" (wizard nuevo).
   *  Sin (2), un draft a medias siempre arrancaba en "role" obligando
   *  al usuario a re-recorrer todo · regla nueva: respetar el último
   *  step donde el user estaba al guardar. */
  /* Override por variante · si entras con `?wizardV2/V3/V4=1` (paso
   * config_edificio rediseñado), saltamos directamente a ese step
   * para que veas la variante. V5 ya es default · sin override. */
  const variantStep: StepId | null =
    (wizardV2 || wizardV3 || wizardV4) ? "config_edificio" :
    null;
  const initialStep = variantStep
    || (searchParams.get("step") as StepId)
    || initialDraft.currentStep
    || "role";
  const [step, setStep] = useState<StepId>(initialStep);

  /* Indicador de "guardado el ..." · usado en header/móvil para mostrar
   * cuándo fue el último guardado MANUAL (botones "Guardar borrador" /
   * "Guardar y salir"). Sin autosave, este timestamp solo se actualiza
   * por acción explícita del user. */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saving = false;

  /* Step abierto en modal de edición desde la pantalla de Revisión.
   * Null = ningún modal abierto. Los pasos no soportados (role/tipo/
   * sub_uni/sub_varias/estado · inline en CrearPromocion) caen al
   * navigate clásico via setStep. */
  const [editModalStep, setEditModalStep] = useState<StepId | null>(null);

  /* Aviso de reanudación · cuando el user entra con `?draft=<id>`
   * desde fuera (link "Continuar editando"), mostramos un popup que
   * recuerda que la promoción aún no está completa antes de saltarle
   * al step donde lo dejó. Evita que crea que ya se publicó. */
  const [showResumeNotice, setShowResumeNotice] = useState(() => {
    /* Solo si entra con draftIdParam Y el draft tenía algún progreso
     * real (no si era un draft vacío recién creado). */
    return !!draftIdParam && initialDraft.id != null
      && !!(initialDraft.state.nombrePromocion?.trim()
        || initialDraft.state.role
        || initialDraft.state.tipo
        || initialDraft.state.unidades.length > 0);
  });

  /* `hasChangesRef` · marca si el user ha tocado algo desde mount.
   *  Usado por handleClose para decidir si pide confirmación o sale
   *  directo. Ref (no state) porque no necesita re-render. */
  const hasChangesRef = useRef(false);

  /* `ensureDraftId` · idempotente · crea el draft on-demand cuando
   *  alguna acción lo necesita (Guardar borrador, Activar, Subir
   *  imagen). Si ya existe, devuelve el id actual. Sincroniza la
   *  URL con `?draft=ID` para que un refresh continúe el mismo
   *  draft. Cuando estamos editando una promo (`resolvedPromotionId`)
   *  devuelve "" porque el flujo es override, no draft. */
  const ensureDraftId = useCallback((): string => {
    if (draftIdRef.current) return draftIdRef.current;
    if (resolvedPromotionId) return "";
    /* Si el state ya tiene publicRef (legacy/promo edit) reusamos.
     *  Si no, lo generamos al vuelo. */
    const existingRef = state.publicRef;
    const ref = existingRef || generatePublicRef("promotion");
    const id = `d-${ref}`;
    draftIdRef.current = id;
    setDraftIdState(id);
    /* Persist el draft INMEDIATAMENTE en memCache (+ write-through a
     *  Supabase) · sin esto, el siguiente `ensureDraftPersisted()` que
     *  hace MultimediaEditor antes de subir foto falla con
     *  "draft d-PRxxx not found in cache" porque el id existe en el ref
     *  pero la fila nunca se escribió. Necesitamos un state con el
     *  publicRef ya seteado · lo construimos in-line para no depender
     *  del flush async de setState. */
    const stateWithRef = existingRef ? state : { ...state, publicRef: ref };
    if (!existingRef) {
      setState(prev => ({ ...prev, publicRef: ref }));
    }
    persistDraft(stateWithRef, id, step);
    /* Sync URL inmediatamente · refresh durante edición continúa
     *  el mismo draft en lugar de crear otro. */
    const next = new URLSearchParams(searchParams);
    next.set("draft", id);
    setSearchParams(next, { replace: true });
    return id;
  }, [resolvedPromotionId, searchParams, setSearchParams, state, step]);

  /* `update` · setea state + marca hasChanges. NO persiste. La
   *  persistencia es lazy · ver `ensureDraftId`. */
  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    hasChangesRef.current = true;
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  /* Autosave ELIMINADO · 2026-05 · ver historial git para la versión
   * con debounce. Razones:
   *   1. Generaba drafts huérfanos cada vez que el user entraba al
   *      wizard sin `?draft=` en URL · pile-up de borradores vacíos.
   *   2. La barrera "guarda antes de subir imágenes" es chocante
   *      cuando el user no sabe que hay autosave.
   * Persistencia ahora · solo via botones "Guardar borrador" y
   * "Guardar y salir" · `flushSave()` los maneja de forma síncrona. */

  /* Auto-create draft cuando se entra en pasos que requieren
   *  uploadScopeId (storage RLS) · sin esto el user llegaba a
   *  Multimedia o Crear Unidades y los uploaders salían
   *  desactivados con "guarda primero". Se ejecuta también desde
   *  el handler de modal en Revisión (onEditStep). */
  useEffect(() => {
    const needsDraft = step === "multimedia" || step === "crear_unidades";
    if (needsDraft) ensureDraftId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* Pasos visibles según ramificación (depende de tipo/subUni) */
  const visibleSteps = useMemo(() => getAllSteps(state).map(s => s.id), [state]);

  /* Auto-advance · cuando un step de selección única (role, tipo,
   *  sub_uni) recibe una respuesta, avanzamos automáticamente al
   *  siguiente paso. Evita que el usuario tenga que pulsar "Siguiente"
   *  detrás de cada click de radio.
   *
   *  Implementación · el handler del OptionCard sube el flag
   *  `autoAdvanceRef.current = true`. Este effect corre en el commit
   *  siguiente (cuando `state` ya refleja la elección y por tanto
   *  `visibleSteps` está actualizado · crítico para `tipo` que puede
   *  saltarse `sub_uni` si el usuario eligió plurifamiliar). Si el
   *  flag está alzado, computamos getNext() con la NUEVA visibleSteps
   *  y avanzamos. Reset del flag a false en el mismo paso. */
  const autoAdvanceRef = useRef(false);
  useEffect(() => {
    if (!autoAdvanceRef.current) return;
    autoAdvanceRef.current = false;
    const i = visibleSteps.indexOf(step);
    const nextIdx = i + 1;
    if (nextIdx < visibleSteps.length) setStep(visibleSteps[nextIdx]);
  }, [state, visibleSteps, step]);

  /* Flags derivados del estado (usados en conditionals) */
  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";
  const isVariasUni = state.tipo === "unifamiliar" && state.subUni === "varias";

  /* Cálculos derivados para config_edificio y extras */
  const totalEscaleras = useMemo(
    () => state.escalerasPorBloque.reduce((sum, n) => sum + n, 0),
    [state.escalerasPorBloque]
  );
  const multiplier = totalEscaleras;
  const totalViviendas = useMemo(() => {
    if (isSingleHome) return 1;
    if (isVariasUni) {
      return state.tipologiasSeleccionadas.reduce((s, t) => s + t.cantidad, 0) || 1;
    }
    /* Plurifamiliar · plantas-sobre-rasante × viv/planta × escaleras
     *  + bajos residenciales (planta 0) si `plantaBajaTipo === "viviendas"`.
     *  Sin sumar los bajos, el banner mostraba "4 viviendas" cuando
     *  el preview decía "5 viviendas" · inconsistencia visible. */
    const upperUnits = state.plantas * state.aptosPorPlanta * multiplier;
    const groundUnits = state.plantaBajaTipo === "viviendas"
      ? state.aptosPorPlanta * multiplier
      : 0;
    return upperUnits + groundUnits;
  }, [isSingleHome, isVariasUni, state.tipologiasSeleccionadas, state.plantas, state.aptosPorPlanta, state.plantaBajaTipo, multiplier]);
  const totalLocales = state.tipo === "unifamiliar" ? 0 : state.locales * multiplier;
  const summaryItems = [
    { label: "viviendas", count: totalViviendas },
    { label: "locales", count: totalLocales },
    { label: "trasteros", count: state.trasteros },
    { label: "plazas parking", count: state.parkings },
  ];

  /* Opciones de trimestre · próximos 4 años desde HOY · filtra los
   *  que ya pasaron en el año en curso · es ilógico ofrecer
   *  "T1 2026" cuando estamos en Q2 2026. */
  const trimestreOptions = futureTrimesterOptions();

  /* Handlers auxiliares (multi-select con cantidades, estado con cascada) */
  const toggleTipologia = (tipo: SubVarias) => {
    const existing = state.tipologiasSeleccionadas.find(t => t.tipo === tipo);
    if (existing) {
      setState(prev => ({ ...prev, tipologiasSeleccionadas: prev.tipologiasSeleccionadas.filter(t => t.tipo !== tipo) }));
    } else {
      setState(prev => ({ ...prev, tipologiasSeleccionadas: [...prev.tipologiasSeleccionadas, { tipo, cantidad: 1 }] }));
    }
  };
  const updateTipologiaCantidad = (tipo: SubVarias, delta: number) => {
    setState(prev => {
      const current = prev.tipologiasSeleccionadas.find(t => t.tipo === tipo);
      if (!current) return prev;
      const nextCantidad = current.cantidad + delta;
      /* Si bajamos a 0 quitamos la tipología por completo · equivale
       * a deseleccionarla (mismo efecto que clicar la card). */
      if (nextCantidad <= 0) {
        return {
          ...prev,
          tipologiasSeleccionadas: prev.tipologiasSeleccionadas.filter(t => t.tipo !== tipo),
        };
      }
      return {
        ...prev,
        tipologiasSeleccionadas: prev.tipologiasSeleccionadas.map(t =>
          t.tipo === tipo ? { ...t, cantidad: nextCantidad } : t
        ),
      };
    });
  };
  const toggleEstilo = (estilo: EstiloVivienda) => {
    setState(prev => ({
      ...prev,
      estilosSeleccionados: prev.estilosSeleccionados.includes(estilo)
        ? prev.estilosSeleccionados.filter(e => e !== estilo)
        : [...prev.estilosSeleccionados, estilo],
    }));
  };
  const handleEstadoSelect = (v: string) => {
    const estado = v as EstadoPromocion;
    setState(prev => ({
      ...prev,
      estado,
      faseConstruccion: null,
      trimestreEntrega: null,
      tieneLicencia: estado === "proyecto" ? prev.tieneLicencia : null,
      fechaEntrega: estado === "terminado" ? null : prev.fechaEntrega,
      fechaTerminacion: estado === "terminado" ? prev.fechaTerminacion : null,
    }));
  };
  const handleFaseSelect = (v: string) => {
    const fase = v as FaseConstruccion;
    if (fase === "llave_en_mano") {
      setState(prev => ({ ...prev, faseConstruccion: fase, estado: "terminado", trimestreEntrega: null }));
    } else {
      setState(prev => ({ ...prev, faseConstruccion: fase, trimestreEntrega: null }));
    }
  };
  /** Predicado puro: ¿el paso está ya completado en el state? Usado
   *  para saltar pasos ya hechos en modo `onlyMissing`. */
  const isStepComplete = (s: WizardState, sid: StepId): boolean => {
    switch (sid) {
      case "role": return !!s.role;
      case "tipo": return !!s.tipo;
      case "sub_uni": return !!s.subUni;
      case "sub_varias":
        if (s.subUni === "varias") {
          return s.tipologiasSeleccionadas.length > 0 && s.estilosSeleccionados.length > 0;
        }
        return !!s.subVarias && !!s.estiloVivienda;
      case "config_edificio": {
        if (s.numBloques < 1 || s.plantas < 1 || s.aptosPorPlanta < 1) return false;
        /* Planta baja · el user DEBE elegir explícitamente una de las
         *  3 cards · `undefined` = no ha clicado ninguna · `null` = ha
         *  elegido "Sin uso" conscientemente. Sin esto el wizard
         *  dejaba pasar con la card "Sin uso" preseleccionada por
         *  default · el user no se enteraba de que había opciones. */
        if (s.plantaBajaTipo === undefined) return false;
        /* Locales comerciales · si el user marca "Locales", debe
         *  rellenar cuántos · sin esto el wizard dejaba pasar con
         *  `state.locales = 0` · resultado contradictorio. */
        if (s.plantaBajaTipo === "locales" && (s.locales ?? 0) < 1) return false;
        return true;
      }
      case "extras": {
        /* Parking / trastero / solárium / sótano · si están enabled,
         *  el user DEBE elegir registralKind (inseparable o separada)
         *  antes de avanzar. Sin esto el generador de unidades no sabe
         *  si propagar el flag per-unit o crear anejos sueltos · acaba
         *  haciendo lo primero por defecto y se pierde la venta del
         *  anejo. */
        const d = s.promotionDefaults;
        if (!d) return true;
        if (d.parking.enabled && !d.parking.registralKind) return false;
        if (d.storageRoom.enabled && !d.storageRoom.registralKind) return false;
        if (d.solarium.enabled && !d.solarium.registralKind) return false;
        if (d.basement.enabled && !d.basement.registralKind) return false;
        return true;
      }
      case "equipamiento": {
        /* Si el user abre Solárium/Seguridad/Vistas/Orientación pero no
         *  marca nada dentro, "Siguiente" se deshabilita · fuerza a
         *  marcar al menos 1 opción O cerrar el chip. ExtrasV5 persiste
         *  qué chips están "abiertos" en `promotionDefaults.openExtras`. */
        const d = s.promotionDefaults;
        if (!d) return true;
        /* Solárium habilitado · registralKind obligatorio (popup en
         *  V5 lo pide al activar) · sin esto el wizard avanzaba sin
         *  saber si solárium es separado/inseparable · seed roto. */
        if (d.solarium.enabled && !d.solarium.registralKind) return false;
        const open = d.openExtras ?? [];
        for (const key of open) {
          if (key === "solarium") {
            if (!d.solarium.priceMode) return false;
          } else if (key === "security") {
            const hasAny = d.security.alarm || d.security.reinforcedDoor || d.security.videoSurveillance;
            if (!hasAny) return false;
          } else if (key === "views") {
            const hasAny = d.views.sea || d.views.oceano || d.views.rio
              || d.views.mountain || d.views.ciudad || d.views.golf
              || d.views.panoramic || d.views.amanecer || d.views.atardecer
              || d.views.abiertas;
            if (!hasAny) return false;
          } else if (key === "orientation") {
            if (!d.orientation) return false;
          }
        }
        return true;
      }
      case "estado": {
        /* Estado · el sub-campo condicional es OBLIGATORIO antes de
         *  avanzar · sin esto el wizard dejaba pasar "Estado: Proyecto"
         *  sin marcar Con/Sin licencia, o "En construcción" sin fase. */
        if (!s.estado) return false;
        if (s.estado === "proyecto") return s.tieneLicencia !== null;
        if (s.estado === "en_construccion") return !!s.faseConstruccion;
        /* "terminado" · fechaTerminacion es opcional (la promoción
         *  está acabada, fecha exacta puede no recordarse) · pasa. */
        return true;
      }
      case "detalles":
        // Si ya está terminado, la entrega ya ocurrió y DetallesStep oculta
        // el selector de tipoEntrega · el paso queda completo sin requerirlo
        // (idéntico al predicado de publicationRequirements §6).
        if (s.estado === "terminado") return true;
        return !!s.tipoEntrega || !!s.fechaEntrega || !!s.trimestreEntrega;
      case "info_basica":
        return !!s.nombrePromocion.trim()
          && !!s.direccionPromocion.pais.trim()
          && !!s.direccionPromocion.ciudad.trim()
          /* Certificado energético · obligatorio · es requisito legal
           *  para vender en España (Real Decreto 390/2021) · sin él la
           *  promoción no puede publicarse en portales ni microsite. */
          && !!s.certificadoEnergetico.trim();
      case "multimedia": return s.fotos.length > 0;
      case "descripcion": return !!s.descripcion || Object.keys(s.descripcionIdiomas ?? {}).length > 0;
      case "crear_unidades": {
        if (s.unidades.length === 0) return false;
        /* Cada unidad debe tener los campos comerciales mínimos
         * rellenos · sin esto no se puede listar ni vender. La parcela
         * solo se exige en unifamiliar (los pisos no tienen parcela). */
        const isUnifamiliar = s.tipo === "unifamiliar";
        const unitsOk = s.unidades.every((u) => {
          if (!u.dormitorios || u.dormitorios <= 0) return false;
          if (!u.banos || u.banos <= 0) return false;
          if (!u.superficieConstruida || u.superficieConstruida <= 0) return false;
          if (!u.precio || u.precio <= 0) return false;
          if (isUnifamiliar && (!u.parcela || u.parcela <= 0)) return false;
          return true;
        });
        if (!unitsOk) return false;
        /* Anejos sueltos · cada uno (trastero, parking, solárium,
         * sótano) debe tener precio > 0 · si lo añadiste, hay que
         * ponerle precio o quitarlo. Solárium/sótano solo en unifamiliar. */
        const totalViv = s.unidades.length;
        const trasterosBundled = s.trasterosIncluidosPrecio
          ? totalViv * s.trasterosIncluidosPorVivienda
          : 0;
        const trasterosSueltos = Math.max(0, s.trasteros - trasterosBundled);
        for (let i = 0; i < trasterosSueltos; i++) {
          if (!s.trasteroPrecios[i] || s.trasteroPrecios[i] <= 0) return false;
        }
        const parkingsBundled = s.parkingsIncluidosPrecio
          ? totalViv * s.parkingsIncluidosPorVivienda
          : 0;
        const parkingsSueltos = Math.max(0, s.parkings - parkingsBundled);
        for (let i = 0; i < parkingsSueltos; i++) {
          if (!s.parkingPrecios[i] || s.parkingPrecios[i] <= 0) return false;
        }
        const solariums = s.solariums ?? 0;
        const solariumPrecios = s.solariumPrecios ?? [];
        for (let i = 0; i < solariums; i++) {
          if (!solariumPrecios[i] || solariumPrecios[i] <= 0) return false;
        }
        const sotanos = s.sotanos ?? 0;
        const sotanoPrecios = s.sotanoPrecios ?? [];
        for (let i = 0; i < sotanos; i++) {
          if (!sotanoPrecios[i] || sotanoPrecios[i] <= 0) return false;
        }
        return true;
      }
      case "colaboradores": {
        /* Cuando colaboración está activa (la step la auto-activa al
         * entrar) exigimos los campos comerciales mínimos para
         * compartir con agencias:
         *   - Comisión internacional > 0.
         *   - Si diferencia nacional/internacional, también nacional > 0.
         *   - Forma de pago de comisión elegida.
         *   - Si forma de pago = "personalizado", al menos 1 hito y
         *     suma de % cliente Y % colaborador = 100.
         * Si NO colabora (toggle off) · paso completo sin más. */
        if (!s.colaboracion) return true;
        if (!s.comisionInternacional || s.comisionInternacional <= 0) return false;
        if (s.diferenciarComisiones && (!s.comisionNacional || s.comisionNacional <= 0)) return false;
        if (!s.formaPagoComision) return false;
        if (s.formaPagoComision === "personalizado") {
          if (s.hitosComision.length === 0) return false;
          const sumCliente = s.hitosComision.reduce((acc, h) => acc + h.pagoCliente, 0);
          const sumColab = s.hitosComision.reduce((acc, h) => acc + h.pagoColaborador, 0);
          if (sumCliente !== 100 || sumColab !== 100) return false;
        }
        return true;
      }
      case "plan_pagos": return !!s.metodoPago;
      case "revision": return false; // último paso, no salta
    }
  };

  const getNext = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    let next = i + 1;
    if (onlyMissing) {
      // En modo "sólo lo que falta" saltamos los pasos ya completados
      // hasta encontrar uno incompleto o llegar al final.
      while (next < visibleSteps.length && isStepComplete(state, visibleSteps[next])) {
        next++;
      }
    }
    return next < visibleSteps.length ? visibleSteps[next] : null;
  };
  const getPrev = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    let prev = i - 1;
    if (onlyMissing) {
      while (prev >= 0 && isStepComplete(state, visibleSteps[prev])) {
        prev--;
      }
    }
    return prev >= 0 ? visibleSteps[prev] : null;
  };

  /* Al entrar en modo `onlyMissing`, saltar directamente al primer
     paso incompleto para que el usuario no vea el "role" / "tipo"
     ya resueltos.
     EXCEPCIÓN · si la URL trae `?step=X` explícito, respetamos ese
     step aunque `onlyMissing=1` esté activo · permite que el user
     entre a un step concreto (ej. revisar la descripción que ya
     escribió) sin que el wizard le redirija a otro pendiente. */
  useEffect(() => {
    if (!onlyMissing) return;
    if (searchParams.get("step")) return; // respeta step explícito
    if (isStepComplete(state, step)) {
      const firstMissing = visibleSteps.find((s) => !isStepComplete(state, s));
      if (firstMissing) setStep(firstMissing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Validación de "Siguiente" por paso.
   *
   * UNA SOLA fuente de verdad: delega en `isStepComplete` para cada
   * paso (el mismo predicado que alimenta la timeline y el modo
   * "onlyMissing"). Evita que avance-vs-completo diverjan.
   *
   * Excepciones:
   *   · `extras`   · opcional · siempre avanza.
   *   · `detalles` · opcional si el estado está terminado (lo resuelve
   *                  el propio isStepComplete).
   *   · `revision` · exige `canPublishWizard` (chequeo completo).
   */
  const canContinue = () => {
    if (step === "extras") {
      /* Validación del V5 · cualquier categoría activada (toggle on)
       * que tenga campos `appliesTo` y/o `priceMode` debe tenerlos
       * elegidos · si no, Siguiente queda inactivo. Las categorías
       * sin enabled flag (terraces, equipment, security, views,
       * orientation, urbanization) no requieren validación · son
       * colecciones de checkboxes opcionales. */
      const d = state.promotionDefaults;
      if (d) {
        if (d.privatePool.enabled && (!d.privatePool.appliesTo || !d.privatePool.priceMode)) return false;
        /* Parking / trastero · `appliesTo` SOLO se valida cuando
         *  registralKind === "inseparable" · si es "separate" el
         *  control "Aplicar a" se oculta del card (no aplica a viv ·
         *  es anejo suelto) · sin esto Siguiente quedaba bloqueado
         *  esperando un valor que el UI ya no pide. `registralKind`
         *  obligatorio se valida en `isStepComplete`. */
        if (d.parking.enabled) {
          if (d.parking.registralKind === "inseparable" && !d.parking.appliesTo) return false;
          if (!d.parking.priceMode) return false;
        }
        if (d.storageRoom.enabled) {
          if (d.storageRoom.registralKind === "inseparable" && !d.storageRoom.appliesTo) return false;
          if (!d.storageRoom.priceMode) return false;
        }
        if (d.solarium.enabled) {
          if (d.solarium.registralKind === "inseparable" && !d.solarium.appliesTo) return false;
          if (!d.solarium.priceMode) return false;
        }
        if (d.basement.enabled) {
          if (d.basement.registralKind === "inseparable" && !d.basement.appliesTo) return false;
          if (!d.basement.priceMode) return false;
        }
        if (d.plot.enabled && !d.plot.appliesTo) return false;
        /* Parcela activada · exige superficie mínima · sin m² la
         *  card queda incompleta · la unidad heredaría parcela "0
         *  m²" que se renderiza raro en la ficha. */
        if (d.plot.enabled && (!d.plot.minSizeSqm || d.plot.minSizeSqm <= 0)) return false;
        /* Terrazas activadas pero sin tipo elegido · bloquea avanzar
         *  hasta que el user marque cubierta y/o descubierta. Razón ·
         *  el user activó "tengo terrazas" pero no especificó cuáles
         *  · sin esa info la card queda incompleta y la unidad se
         *  generaría sin tipo de terraza heredado. */
        if (d.terraces.enabled && !d.terraces.covered && !d.terraces.uncovered) return false;
      }
      return true;
    }
    if (step === "revision") return canPublishWizard(state);
    /* Si estás en V4 (config_edificio · flag wizardV4=1) el Siguiente
     * global queda inactivo hasta que llegues al sub-step "resumen"
     * del flujo interno · evita saltar al paso 4 sin confirmar. */
    if (step === "config_edificio" && wizardV4 && v4InternalSubstep !== "resumen") {
      return false;
    }
    return isStepComplete(state, step);
  };

  /* Handlers */
  const handleContinue = async () => {
    const next = getNext();
    if (next) setStep(next);
    else if (resolvedPromotionId) {
      /* Editando promo existente desde Configuración · NO crear una
       *  nueva · solo guardar el override y volver a la ficha. */
      flushSave();
      toast.success("Cambios guardados");
      navigate(returnTo || `/promociones/${resolvedPromotionId}`);
    }
    else if (onlyMissing && returnTo) {
      // Modo "sólo lo que falta" · al acabar vuelve a la ficha en
      // vez de publicar. El promotor decide publicar desde ahí.
      flushSave();
      toast.success("Listo · vuelve a la ficha para publicar");
      navigate(returnTo);
    } else {
      // Publicación final del wizard (llegamos aquí desde el paso
      // "revision" con `canPublishWizard(state) === true`).
      //
      // Paywall guard · Fase 1: si el plan está en `trial` y ya hay
      // 2 promociones activas, bloqueamos la publicación y abrimos el
      // UpgradeModal. El borrador NO se borra · queda en "incompletas"
      // para que el promotor lo retome al suscribirse.
      // TODO(backend): el endpoint POST /api/promociones devolverá
      //   402 Payment Required con `{ trigger, used, limit }` cuando
      //   se llegue al tope · la UI lee ese payload y abre el mismo
      //   modal con la copy correspondiente.
      if (createGuard.blocked) {
        flushSave();
        createGuard.openUpgrade();
        return;
      }
      // TODO(backend): POST /api/promociones con WizardState (shape
      //   completo) → { id: string, code: string }. Ver
      //   docs/backend-integration.md §3 "Promociones · Endpoints".
      //   La respuesta debe devolver el id nuevo para poder
      //   redirigir a la ficha (`navigate(\`/promociones/${id}\`)`).
      //   El backend valida los mismos 7 requisitos que
      //   `canPublishWizard` (publicationRequirements.ts §WizardState);
      //   si falla, devuelve 422 con `missing[]` y el cliente re-abre
      //   el wizard en modo `onlyMissing`.
      // Persistir promoción a Supabase + localStorage scoped.
      const me = currentOrgIdentity(currentUser);
      const role = (state as unknown as { role?: "promotor" | "comercializador" }).role
        ?? "promotor";
      const result = await createPromotionFromWizard(state, me.orgId, role, "active");
      /* CRÍTICO · solo borramos el draft si Supabase confirmó el
       * insert. Si falla, mantenemos el draft para que el user pueda
       * re-intentar · evita pérdida de datos por RLS / schema mismatch
       * que antes pasaba silencioso (cache local con la promo pero
       * /promociones leyendo solo de Supabase = invisible). */
      if (!result.supabaseOk) {
        toast.error("No se pudo publicar la promoción en la nube", {
          description: `${result.supabaseError ?? "Error desconocido"}. Tu borrador NO se ha borrado · puedes reintentar más tarde.`,
        });
        return;
      }
      if (draftId) deleteDraft(draftId);
      /* Cleanup defensivo · al activar, eliminamos TODOS los drafts
       *  vacíos (sin nombrePromocion) que el user pudiera tener.
       *  Razón · cada vez que el wizard monta sin `?draft=` en URL
       *  se crea un draft nuevo · si por alguna razón hubo varios
       *  mounts (navegación, refresh, race en hidratación), quedaban
       *  drafts huérfanos en el listado tras la activación. Limpiar
       *  aquí garantiza que tras "Activar" el listado solo enseña la
       *  promo recién creada · no fantasmas. */
      const ghostDrafts = listDrafts().filter(
        (d) => !(d.state.nombrePromocion ?? "").trim() && d.id !== draftId,
      );
      ghostDrafts.forEach((d) => deleteDraft(d.id));
      toast.success("Promoción creada correctamente", {
        description: `${result.created.name} · publicada en /promociones`,
      });
      navigate("/promociones");
    }
  };
  const handleBack = () => {
    const prev = getPrev();
    if (prev) setStep(prev);
    else navigate(-1);
  };
  /** Persiste el state actual · save explícito · llamado por los
   *  botones "Guardar borrador", "Guardar y salir" o el "Sí guardar"
   *  del confirm de salida. Si no había draftId aún, ensureDraftId
   *  lo crea on-demand · sin esto el primer save de un wizard fresh
   *  fallaba (no había id donde escribir). */
  const flushSave = (): string => {
    /* Editando promo existente · save al override store · NO crea
     *  draft huérfano. Idempotente (mismo promotionId siempre). */
    if (resolvedPromotionId) {
      savePromoWizardOverride(resolvedPromotionId, state);
      return resolvedPromotionId;
    }
    /* Asegura draft creado antes de persistir · primera llamada
     *  genera id+publicRef+URL sync · subsiguientes son no-op. */
    const currentId = draftIdRef.current ?? ensureDraftId();
    const res = persistDraft(state, currentId, step);
    if (!res.ok && res.error === "quota") {
      toast.error("No se pudo guardar", { description: "Espacio de almacenamiento lleno." });
    }
    setSavedAt(Date.now());
    return res.id;
  };
  const handleSaveDraft = () => {
    flushSave();
    setSavedAt(Date.now());
    toast.success("Borrador guardado");
  };
  /* `handleSaveAndExit` ELIMINADO · su botón se quitó del header.
   *  El flujo "salir guardando" ahora va por la X · si hay cambios
   *  el diálogo ofrece "Guardar borrador" o "Cancelar". */
  /** Cierre del wizard (botón X).
   *  - Sin cambios desde mount → salida directa · cero datos en DB.
   *  - Con cambios → diálogo "Guardar borrador" / "Cancelar":
   *      · Guardar borrador → flushSave + navega a /incompletas
   *      · Cancelar (o ESC / X) → navega sin tocar nada · NO crea
   *        ni actualiza nada en DB.
   *  Importante · si el user llegó editando un draft existente,
   *  "Cancelar" NO borra el draft de DB · solo descarta los cambios
   *  pendientes (nunca se llamó flushSave). */
  const handleClose = async () => {
    if (!hasChangesRef.current) {
      navigate("/promociones");
      return;
    }
    const save = await confirm({
      title: "Tienes cambios sin guardar",
      description: "Pulsa \"Guardar borrador\" para conservarlos · \"Cancelar\" sale sin guardar nada.",
      confirmLabel: "Guardar borrador",
      cancelLabel: "Cancelar",
    });
    if (save) {
      flushSave();
      navigate("/promociones?tab=incompletas");
    } else {
      navigate("/promociones");
    }
  };

  /* "Eliminar borrador" · acción destructiva movida desde el listing
   *  · solo visible cuando hay un draftId activo. Borra del cache local
   *  + Supabase y navega de vuelta. Antes vivía como botón hover en
   *  cada card del listado · era ruidoso y se confundía con
   *  "Guardar y salir". */
  const handleDeleteDraft = async () => {
    if (!draftId) return;
    const ok = await confirm({
      title: "¿Descartar este borrador?",
      description: state.nombrePromocion?.trim()
        ? `"${state.nombrePromocion}" se eliminará permanentemente.`
        : "El borrador se eliminará permanentemente.",
      confirmLabel: "Descartar",
      variant: "destructive",
    });
    if (!ok) return;
    deleteDraft(draftId);
    toast.success("Borrador eliminado");
    navigate("/promociones?tab=incompletas");
  };

  /* "Omitir" — salta el paso actual sin validación. Útil en pasos
     opcionales (multimedia, descripción, colaboradores, plan de pagos…). */
  const handleSkip = () => {
    const next = getNext();
    if (next) {
      setStep(next);
      toast.info("Paso omitido", { description: "Puedes volver a completarlo antes de publicar." });
    }
  };

  /* "Publicar rápido" — publica con los mínimos cuando se cumplen. Se
     muestra solo cuando hasPublishMinimums(state) === true. */
  const handleQuickPublish = () => {
    if (!hasPublishMinimums(state)) return;
    if (draftId) deleteDraft(draftId);
    toast.success("Promoción publicada", {
      description: "Has publicado con los datos mínimos. Podrás completar el resto desde la ficha.",
    });
    navigate("/promociones");
  };

  const canSkipCurrentStep = SKIPPABLE_STEPS.has(step);
  const publishReady = hasPublishMinimums(state);

  /* Selección de tipo reinicia sub-pasos */
  const handleTipoSelect = (v: string) => {
    setState(prev => ({ ...prev, tipo: v as TipoPromocion, subUni: null, subVarias: null, estado: null }));
  };

  const meta = stepMeta[step];

  return (
    <div className="fixed inset-0 z-40 flex bg-background">

      {/* Aviso de reanudación · al volver a un draft incompleto */}
      <Dialog open={showResumeNotice} onOpenChange={setShowResumeNotice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <FileWarning className="h-5 w-5" strokeWidth={1.7} />
            </div>
            <DialogTitle className="mt-3">La creación de la promoción aún no está completa</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              Te llevamos al punto donde la dejaste. Continúa para terminar todos los pasos
              y poder compartir la promoción con tus colaboradores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <button
              type="button"
              onClick={() => setShowResumeNotice(false)}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft w-full sm:w-auto"
            >
              Continuar editando
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edición desde Revisión · sin obligar al user a
          re-navegar por todo el wizard. */}
      <EditStepModal
        open={editModalStep !== null}
        step={editModalStep}
        state={state}
        update={update}
        uploadScopeId={resolvedPromotionId ?? draftId ?? undefined}
        onClose={() => setEditModalStep(null)}
      />

      {/* ═══════════ Sidebar · PhaseTimeline ═══════════ */}
      <aside className="hidden lg:flex w-[300px] shrink-0 flex-col border-r border-border bg-card">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold text-sm">B</div>
          <div className="font-bold text-[15px] tracking-tight">Byvaro</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3 px-1">
            Crear promoción
          </p>
          <PhaseTimeline state={state} currentStep={step} onGoToStep={setStep} />
        </div>
        <div className="border-t border-border p-3">
          <button
            onClick={handleSaveDraft}
            className="w-full text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg py-2 hover:bg-muted/60"
          >
            Guardar borrador y salir
          </button>
        </div>
      </aside>

      {/* ═══════════ Main area ═══════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile + desktop) */}
        <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold text-[13px]">B</div>
              <span className="font-bold text-[14px] tracking-tight">Crear promoción</span>
            </div>
            <div className="hidden lg:flex items-baseline gap-2 min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Paso {visibleSteps.indexOf(step) + 1}/{visibleSteps.length}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[13px] font-semibold text-foreground truncate">{meta.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <AutoSaveIndicator savedAt={savedAt} saving={saving} className="hidden sm:inline-flex" />
            {/* "Activar rápido" · solo en CREACIÓN nueva (sin
                resolvedPromotionId). Si el user vino desde Configuración
                de una promo ya existente, el wizard está editando · no
                tiene sentido "activar" lo que ya está activo. */}
            {publishReady && !resolvedPromotionId && (
              <button
                onClick={handleQuickPublish}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors shadow-soft"
                title="Activa la promoción con los datos mínimos. Podrás completar el resto después."
              >
                <Rocket className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Activar rápido</span>
                <span className="sm:hidden">Activar</span>
              </button>
            )}
            {/* Botón "Guardar y salir" · ELIMINADO 2026-05-04 ·
                redundante · al pulsar la X con cambios sin guardar
                ya sale el diálogo "Guardar borrador / Cancelar". */}
            {draftId && (
              <button
                onClick={handleDeleteDraft}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[12px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                title="Elimina permanentemente este borrador."
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Eliminar borrador</span>
                <span className="sm:hidden">Eliminar</span>
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar asistente"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content area · panel lateral eliminado. Ancho del contenedor
             depende del paso: el de "Crear unidades" necesita aire para
             la tabla de Disponibilidad; el resto mantiene su ancho
             cómodo de lectura. */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className={cn(
            "mx-auto w-full",
            step === "crear_unidades" ? "max-w-[1200px]"
              : step === "colaboradores" ? "max-w-[720px]"
              : step === "config_edificio" ? "max-w-[1080px]"
              : "max-w-[580px]"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-6"
              >
                {/* Step header */}
                <div>
                  <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">
                    {meta.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1.5">{meta.subtitle}</p>
                </div>

                {/* Banner de campos pendientes intencionalmente OMITIDO en
                 *  los pasos intermedios · el wizard es un borrador
                 *  guiado, NO un formulario validado. Mostrar 'Faltan N
                 *  campos para activar' en cada paso es agresivo y rompe
                 *  el flujo de creación. La validación pre-publicación
                 *  vive en el paso "Revisión" (`RevisionStep.tsx`) ·
                 *  ahí sí se enumera todo lo que falta antes de activar. */}

                {/* ─── Step: role · single-select · auto-advance ─── */}
                {step === "role" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roleOptions.map((o) => (
                      <OptionCard key={o.value} option={o} selected={state.role === o.value}
                        onSelect={(v) => {
                          update("role", v as RoleOption);
                          autoAdvanceRef.current = true;
                        }} />
                    ))}
                  </div>
                )}

                {/* ─── Step: tipo · single-select · auto-advance ─── */}
                {step === "tipo" && (
                  state.unidades.length > 0 ? (
                    <LockedStructureNotice
                      current={tipoOptions.find((o) => o.value === state.tipo)?.label ?? "—"}
                      label="Tipo de promoción"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {tipoOptions.map((o) => (
                        <OptionCard key={o.value} option={o} selected={state.tipo === o.value}
                          onSelect={(v) => {
                            handleTipoSelect(v);
                            autoAdvanceRef.current = true;
                          }} />
                      ))}
                    </div>
                  )
                )}

                {/* ─── Step: sub_uni · single-select · auto-advance ─── */}
                {step === "sub_uni" && (
                  state.unidades.length > 0 ? (
                    <LockedStructureNotice
                      current={subUniOptions.find((o) => o.value === state.subUni)?.label ?? "—"}
                      label="Cantidad de viviendas"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {subUniOptions.map((o) => (
                        <OptionCard key={o.value} option={o} selected={state.subUni === o.value}
                          onSelect={(v) => {
                            update("subUni", v as SubUni);
                            update("subVarias", null);
                            autoAdvanceRef.current = true;
                          }} />
                      ))}
                    </div>
                  )
                )}

                {/* ─── Step: sub_varias ─── */}
                {step === "sub_varias" && (
                  <div className="flex flex-col gap-6">
                    {/* Variante una_sola: tipología única + estilo único */}
                    {isSingleHome && (
                      <>
                        <div>
                          <SectionLabel>Tipología</SectionLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {subVariasOptions.map((o) => (
                              <OptionCard key={o.value} option={o} selected={state.subVarias === o.value}
                                onSelect={(v) => update("subVarias", v as SubVarias)} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <SectionLabel>Estilo arquitectónico</SectionLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {estiloViviendaOptions.map((o) => (
                              <OptionCard key={o.value} option={o} selected={state.estiloVivienda === o.value}
                                onSelect={(v) => update("estiloVivienda", v as EstiloVivienda)} />
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Variante varias: multi-select con contadores + multi-estilo */}
                    {isVariasUni && (
                      <>
                        <div>
                          <SectionLabel>Tipologías — selecciona una o más</SectionLabel>
                          <div className="flex flex-col gap-2">
                            {subVariasOptions.map((o) => {
                              const selected = state.tipologiasSeleccionadas.find(t => t.tipo === o.value);
                              const Icon = o.icon;
                              return (
                                <div key={o.value}
                                  className={cn(
                                    "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                                    selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                                  )}
                                >
                                  <button onClick={() => toggleTipologia(o.value)}
                                    className="flex items-center gap-3 flex-1 text-left">
                                    <div className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{o.label}</p>
                                      <p className="text-xs text-muted-foreground">{o.description}</p>
                                    </div>
                                  </button>
                                  {selected && (
                                    <InlineStepper value={selected.cantidad} min={0}
                                      onChange={(v) => updateTipologiaCantidad(o.value, v - selected.cantidad)} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {state.tipologiasSeleccionadas.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2 tnum">
                              Total: {state.tipologiasSeleccionadas.reduce((s, t) => s + t.cantidad, 0)} viviendas
                            </p>
                          )}
                        </div>
                        <div>
                          <SectionLabel>Estilos arquitectónicos — selecciona uno o más</SectionLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {estiloViviendaOptions.map((o) => {
                              const selected = state.estilosSeleccionados.includes(o.value);
                              const Icon = o.icon;
                              return (
                                <button key={o.value} onClick={() => toggleEstilo(o.value)}
                                  className={cn(
                                    "group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200",
                                    selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                                  )}
                                >
                                  <div className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                  )}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                                  <p className="text-[11px] text-muted-foreground leading-snug">{o.description}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─── Step: config_edificio ─── */}
                {/* Layout 2-col en lg+ · inputs a la izquierda, preview
                   visual del edificio sticky a la derecha · móvil/tablet
                   colapsa a 1 col (preview debajo). El preview siempre
                   visible en viewport mientras editas los steppers ·
                   feedback inmediato de los cambios. */}
                {step === "config_edificio" && wizardV4 && (
                  <ConfiguracionEdificioV4
                    state={state}
                    update={update}
                    onContinueOuter={handleContinue}
                    onSubstepChange={setV4InternalSubstep}
                  />
                )}
                {step === "config_edificio" && wizardV3 && !wizardV4 && (
                  <ConfiguracionEdificioV3
                    state={state}
                    update={update}
                    onContinueOuter={handleContinue}
                  />
                )}
                {step === "config_edificio" && wizardV2 && !wizardV3 && !wizardV4 && (
                  <ConfiguracionEdificio
                    state={state}
                    update={update}
                    onContinueOuter={handleContinue}
                  />
                )}
                {step === "config_edificio" && !wizardV2 && !wizardV3 && !wizardV4 && (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
                  {/* ─── COLUMNA IZQUIERDA · Form ─── */}
                  <div className="flex flex-col gap-6 min-w-0">

                    {/* Card 1 · Distribución */}
                    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
                      <header className="mb-4">
                        <h2 className="text-[14px] font-semibold text-foreground">Distribución del edificio</h2>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                          Define cuántas plantas tiene y cuántas viviendas hay por escalera.
                        </p>
                      </header>
                      <div className="flex flex-col gap-3">
                        <NumericStepper label="Plantas sobre rasante" value={state.plantas} min={1}
                          onChange={(v) => update("plantas", v)} />
                        <NumericStepper label="Viviendas por planta" value={state.aptosPorPlanta} min={1}
                          onChange={(v) => update("aptosPorPlanta", v)} />
                      </div>
                      <p className="text-[11px] text-muted-foreground/80 mt-3 leading-relaxed">
                        Bloques y escaleras se gestionan desde la vista previa (a la derecha) ·
                        usa los botones <span className="font-medium text-foreground">+ Bloque</span> y
                        <span className="font-medium text-foreground"> + Escalera</span>.
                      </p>
                    </section>

                    {/* Card 2 · Planta baja */}
                    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
                      <header className="mb-4">
                        <h2 className="text-[14px] font-semibold text-foreground">Planta baja</h2>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                          ¿Qué uso tiene la planta 0 del edificio?
                        </p>
                      </header>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <PlantaBajaCard icon={Minus} title="Sin uso residencial" desc="Nada en planta baja"
                          selected={state.plantaBajaTipo === null}
                          onClick={() => update("plantaBajaTipo", null)} />
                        <PlantaBajaCard icon={StoreIcon} title="Locales comerciales" desc="Espacios comerciales"
                          selected={state.plantaBajaTipo === "locales"}
                          onClick={() => update("plantaBajaTipo", "locales")} />
                        <PlantaBajaCard icon={HomeIcon} title="Viviendas (bajos)" desc="Viviendas tipo bajo"
                          selected={state.plantaBajaTipo === "viviendas"}
                          onClick={() => update("plantaBajaTipo", "viviendas")} />
                      </div>

                      {state.plantaBajaTipo === "locales" && (
                        <div className="mt-3">
                          <NumericStepper label="Número de locales" value={state.locales} min={0}
                            onChange={(v) => update("locales", v)} />
                        </div>
                      )}
                    </section>

                    {/* Card 3 · Resumen */}
                    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
                          <Building2 className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-foreground">
                            <span className="tnum">{totalViviendas}</span> {totalViviendas === 1 ? "vivienda" : "viviendas"} en total
                          </p>
                          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                            {state.numBloques} {state.numBloques === 1 ? "bloque" : "bloques"} ·{" "}
                            {totalEscaleras} {totalEscaleras === 1 ? "escalera" : "escaleras"} ·{" "}
                            {state.plantas} plantas · {state.aptosPorPlanta} viv/planta
                            {state.plantaBajaTipo === "viviendas" && (
                              <> · <span className="font-medium text-foreground">+{state.aptosPorPlanta * multiplier} bajos en PB</span></>
                            )}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* ─── COLUMNA DERECHA · Preview visual ─── */}
                  <aside className="lg:sticky lg:top-4 self-start w-full">
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                      <header className="mb-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Vista previa
                        </p>
                        <p className="text-[12.5px] text-foreground mt-0.5">
                          Así queda el edificio
                        </p>
                      </header>
                      {state.aptosPorPlanta >= 1 ? (
                        <BuildingPreview state={state} update={update} />
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-10 flex flex-col items-center gap-2.5 text-center">
                          <Building2 className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                          <p className="text-[13px] font-semibold text-foreground">
                            Aún no hay edificio
                          </p>
                          <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-[220px]">
                            Define el número de viviendas por planta para empezar a visualizar la fachada.
                          </p>
                        </div>
                      )}
                    </div>
                  </aside>
                  </div>
                )}

                {/* ─── Step: extras (V5) · solo ANEJOS esenciales ·
                       piscina/parking/trastero/sótano/solárium/parcela/terrazas.
                       Equipamiento + Seguridad + Vistas + Orientación se
                       movieron al step "equipamiento" siguiente. ─── */}
                {step === "extras" && (
                  <ExtrasV5 state={state} update={update} lockToPane="essentials" />
                )}

                {/* ─── Step: equipamiento (V5) · Equipamiento auto-expandido
                       arriba + resto de adicionales (Solárium · Seguridad ·
                       Vistas · Orientación) como cards añadibles debajo. ─── */}
                {step === "equipamiento" && (
                  <ExtrasV5
                    state={state}
                    update={update}
                    lockToPane="extras"
                    autoExpandKeys={["equipment"]}
                  />
                )}


                {/* ─── Step: estado ─── */}
                {step === "estado" && (
                  <>
                    <EstadoStep state={state} update={update} />
                    {/* Mixto: informativo · solo en wizard, no en modal. */}
                    {state.tipo === "mixto" && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2 mt-4">
                        <p className="text-xs font-semibold text-foreground">Promoción mixta</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Para crear una promoción mixta, primero configura la parte <strong>plurifamiliar</strong>.
                          Al finalizar podrás añadir las <strong>viviendas unifamiliares</strong> desde la ficha de la promoción.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ─── Step: detalles ─── */}
                {step === "detalles" && (
                  <DetallesStep
                    state={state}
                    update={update}
                    trimestreOptions={trimestreOptions}
                  />
                )}

                {/* ─── Step: info_basica ─── */}
                {step === "info_basica" && (
                  <InfoBasicaStep
                    state={state}
                    update={update}
                    defaultsCapturedInExtras
                  />
                )}

                {/* ─── Step: descripcion ─── */}
                {step === "descripcion" && (
                  <DescripcionStep state={state} update={update} />
                )}

                {/* ─── Step: plan_pagos ─── */}
                {step === "plan_pagos" && (
                  <PlanPagosStep state={state} update={update} />
                )}

                {/* ─── Step: multimedia ─── */}
                {step === "multimedia" && (
                  <MultimediaStep
                    state={state}
                    update={update}
                    /* Namespace para los paths de Storage. Si edito una
                       promo existente uso su id. Si es draft, el draftId
                       (puede ser null si aún no se guardó · el editor
                       muestra "Guarda el borrador para empezar a subir"). */
                    uploadScopeId={resolvedPromotionId ?? draftId ?? undefined}
                  />
                )}

                {/* ─── Step: colaboradores ───
                  * `canManage` · solo admin del workspace puede tocar el
                  * toggle de colaboración. Cuando llegue
                  * `Promotion.createdByUserId`, sumamos el OR de creador.
                  * TODO(backend): `isAdmin(user) || promo.createdByUserId === user.id`. */}
                {step === "colaboradores" && (
                  <ColaboradoresStep
                    state={state}
                    update={update}
                    canManage={isAdmin(currentUser)}
                  />
                )}

                {/* ─── Step: crear_unidades ─── */}
                {step === "crear_unidades" && (
                  <CrearUnidadesStep
                    state={state}
                    update={update}
                    uploadScopeId={resolvedPromotionId ?? draftId ?? undefined}
                  />
                )}

                {/* ─── Step: revision (paso final) ─── */}
                {step === "revision" && (
                  <RevisionStep
                    state={state}
                    onDeletePromotion={resolvedPromotionId ? async () => {
                      const ok = await confirm({
                        title: `¿Eliminar "${state.nombrePromocion || "esta promoción"}"?`,
                        description: "Se borrará la promoción del catálogo y de la base de datos. Esta acción no se puede deshacer.",
                        confirmLabel: "Eliminar",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      const res = await deleteCreatedPromotion(resolvedPromotionId);
                      if (!res.ok) {
                        toast.error("Error al eliminar", { description: res.error });
                        return;
                      }
                      toast.success("Promoción eliminada");
                      setTimeout(() => navigate("/promociones"), 50);
                    } : undefined}
                    onEditStep={(s) => {
                      /* Steps que necesitan persistencia para subir
                       *  archivos (storage RLS exige draftId real) ·
                       *  forzamos creación lazy AHORA · sin esto el
                       *  user abre Multimedia y los uploaders salen
                       *  desactivados con "guarda primero". */
                      const needsDraft = s === "multimedia" || s === "crear_unidades"
                        || s === "planos" || s === "brochure";
                      if (needsDraft) ensureDraftId();
                      /* Si el paso tiene componente propio · abre modal. */
                      if (isSupportedInModal(s)) setEditModalStep(s);
                      /* Si no (role/tipo/sub_uni/sub_varias/estado) ·
                       * fallback a navegación · son pasos cortos. */
                      else setStep(s);
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ═══════════ Footer nav ═══════════ */}
        <footer className="h-16 shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 border-t border-border bg-card">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {!getPrev() ? "Cancelar" : "Atrás"}
          </button>

          <div className="flex items-center gap-2">
            {/* Indicador móvil de autoguardado (visible solo cuando el header no lo muestra) */}
            <AutoSaveIndicator savedAt={savedAt} saving={saving} className="sm:hidden" />

            {canSkipCurrentStep && getNext() && (
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
                title="Saltar este paso — podrás completarlo antes de activar"
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Omitir</span>
              </button>
            )}

            {singleSaveMode ? (
              /* Modo "Guardar este paso y volver" · el user llegó aquí
               *  para resolver UN campo concreto · al guardar, persiste
               *  el override y navega de vuelta a `returnTo`. El
               *  autosave ya está corriendo · forzamos un save inmediato
               *  por seguridad y navegamos. */
              <button
                onClick={() => {
                  if (resolvedPromotionId) {
                    savePromoWizardOverride(resolvedPromotionId, state);
                  }
                  toast.success("Cambios guardados");
                  if (returnToParam) navigate(returnToParam);
                  else if (resolvedPromotionId) navigate(`/promociones/${resolvedPromotionId}`);
                  else navigate("/promociones");
                }}
                disabled={!canContinue()}
                className="inline-flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            ) : (
              <button
                onClick={handleContinue}
                disabled={!canContinue()}
                className="inline-flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {/* Etiqueta del CTA final · "Activar" solo cuando se
                    crea una promo nueva (no resolvedPromotionId).
                    Editando una existente → "Guardar cambios" porque
                    ya está activa · solo persistimos el override. */}
                {!getNext()
                  ? (resolvedPromotionId ? "Guardar cambios" : "Activar")
                  : "Siguiente"}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </footer>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes auxiliares de los pasos
   ═══════════════════════════════════════════════════════════════════ */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function LicenciaCard({
  icon: Icon, title, desc, selected, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-4 py-3 transition-colors text-left",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function ToggleRow({
  icon: Icon, title, desc, checked, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
          checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div
        aria-checked={checked}
        role="switch"
        className={cn(
          "relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )} style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }} />
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BuildingPreview · fachada visual del edificio (no diagrama técnico).
   ───────────────────────────────────────────────────────────────────
   Renderiza cada bloque como un edificio real con:
     · Tejado (roof) horizontal con pequeño remate.
     · Paredes (perímetro · cream/concrete tone).
     · Plantas apiladas top-down · cada planta dividida en N escaleras.
     · Cada escalera tiene M ventanas (1 por apartamento) con marco.
     · Líneas verticales separan escaleras (las paredes interiores).
     · Planta baja · puerta de entrada por escalera + (si "locales")
       escaparates comerciales o (si "viviendas") ventanas tipo bajo.

   Ratios pensados para que se vea como un edificio real:
     · Ventana 16x18 (más alta que ancha · estética arquitectónica).
     · Gap entre ventanas 6px (bandera entre apts).
     · Altura de planta 30px (12px de ventana + 18px de antepecho).
     · PB · 36px (puerta más alta que ventanas).

   El header con nombre y el footer con total quedan fuera de la
   fachada · formato card. ═══════════════════════════════════════════════ */
function BuildingPreview({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const aptos = state.aptosPorPlanta;
  const showBlockLabels = state.numBloques > 1;
  /* Compresión de plantas · si hay > 6 plantas, dibujamos solo P{top}
   * y P1 con una banda intermedia "+N plantas". Evita que un edificio
   * de 58 plantas se estire fuera del viewport. */
  const COMPRESS_THRESHOLD = 6;
  const compressed = state.plantas > COMPRESS_THRESHOLD;
  const visiblePlantas = compressed
    ? [state.plantas, 1] // solo top y bottom
    : Array.from({ length: state.plantas }, (_, i) => state.plantas - i);
  const collapsedCount = compressed ? state.plantas - 2 : 0;

  /* Sizing dinámico · ventanas más grandes/cuadradas si hay pocas
   * viviendas/escalera · evita el efecto "torre flaca". */
  const windowW = aptos === 1 ? 22 : aptos === 2 ? 18 : 16;
  const windowH = aptos === 1 ? 22 : 18;
  const colMinW = 60;
  const floorH = compressed ? 24 : (state.plantas > 8 ? 22 : 26);

  /* ── Mutators inline · todos van por el mismo helper update() ── */
  const addBloque = () => {
    const next = state.numBloques + 1;
    update("numBloques", next);
    update("escalerasPorBloque", [...state.escalerasPorBloque, 1]);
  };
  const removeBloque = (idx: number) => {
    if (state.numBloques <= 1) return;
    const next = state.escalerasPorBloque.filter((_, i) => i !== idx);
    update("numBloques", state.numBloques - 1);
    update("escalerasPorBloque", next);
  };
  const addEscalera = (blockIdx: number) => {
    const next = [...state.escalerasPorBloque];
    next[blockIdx] = (next[blockIdx] || 1) + 1;
    update("escalerasPorBloque", next);
  };
  const removeEscalera = (blockIdx: number) => {
    const current = state.escalerasPorBloque[blockIdx] || 1;
    if (current <= 1) return;
    const next = [...state.escalerasPorBloque];
    next[blockIdx] = current - 1;
    update("escalerasPorBloque", next);
  };
  const renameBloque = (blockIdx: number, value: string) => {
    const key = `B${blockIdx + 1}`;
    const next = { ...state.blockNames };
    if (!value.trim()) delete next[key];
    else next[key] = value;
    update("blockNames", next);
  };

  return (
    <div className="-mx-2 sm:mx-0 px-2 sm:px-0 overflow-x-auto pb-1">
      <div className="inline-flex gap-4 min-w-min items-end">
        {Array.from({ length: state.numBloques }, (_, b) => {
          const blockKey = `B${b + 1}`;
          const blockName = state.blockNames[blockKey] || `Bloque ${b + 1}`;
          const escs = state.escalerasPorBloque[b] || 1;
          const showEscLabels = escs > 1;
          const totalVivs = state.plantas * escs * aptos
            + (state.plantaBajaTipo === "viviendas" ? escs * aptos : 0);

          return (
            <article key={b} className="flex flex-col items-center gap-2 shrink-0">
              {/* Header · solo si hay >1 bloque · editable inline */}
              {showBlockLabels && (
                <div className="flex items-center gap-1.5 group/block">
                  <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                  <input
                    type="text"
                    value={state.blockNames[blockKey] ?? ""}
                    onChange={(e) => renameBloque(b, e.target.value)}
                    placeholder={blockName}
                    className="text-[12px] font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-0.5 max-w-[120px] tracking-tight"
                  />
                  <button
                    type="button"
                    onClick={() => removeBloque(b)}
                    className="opacity-0 group-hover/block:opacity-100 transition-opacity h-4 w-4 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Eliminar bloque"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              )}

              {/* ── FACHADA ── */}
              <div className="flex flex-col items-center">
                {/* Tejado */}
                <div className="h-2 w-[calc(100%+10px)] -mb-px rounded-t-sm bg-foreground/85 shadow-soft" />

                {/* Cuerpo del edificio */}
                <div className="border border-foreground/40 bg-[#f4ede1] dark:bg-foreground/10 shadow-soft overflow-hidden">
                  {/* Labels ESC · solo si >1 escalera */}
                  {showEscLabels && (
                    <div className="flex bg-foreground/5 border-b border-foreground/20">
                      {Array.from({ length: escs }, (_, e) => (
                        <div
                          key={e}
                          className={cn(
                            "flex items-center justify-center gap-1 py-0.5 group/esc",
                            e > 0 && "border-l border-foreground/30",
                          )}
                          style={{ minWidth: colMinW }}
                        >
                          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                            ESC {e + 1}
                          </span>
                          {escs > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEscalera(b)}
                              className="opacity-0 group-hover/esc:opacity-100 transition-opacity h-3 w-3 grid place-items-center rounded-full text-muted-foreground hover:text-destructive"
                              title="Eliminar escalera"
                            >
                              <X className="h-2.5 w-2.5" strokeWidth={2.25} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Plantas residenciales · top y bottom · banda
                     comprimida en medio si hay > COMPRESS_THRESHOLD */}
                  {visiblePlantas.map((p, idx) => (
                    <div
                      key={`p-${p}`}
                      className={cn(
                        "flex",
                        idx > 0 && "border-t border-foreground/15",
                      )}
                      style={{ height: floorH }}
                    >
                      {Array.from({ length: escs }, (_, e) => (
                        <div
                          key={e}
                          className={cn(
                            "flex items-center justify-around gap-[6px] px-[10px]",
                            e > 0 && "border-l border-foreground/30",
                          )}
                          style={{ minWidth: colMinW }}
                        >
                          {Array.from({ length: aptos }, (_, a) => (
                            <span
                              key={a}
                              className="rounded-[2px] bg-sky-200 dark:bg-sky-900/60 border border-sky-700/40 dark:border-sky-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0"
                              style={{ width: windowW, height: windowH }}
                              title={`P${p} · puerta ${a + 1}`}
                            />
                          ))}
                        </div>
                      ))}
                      {/* Inserción de banda compressed entre P{top} y P1 */}
                    </div>
                  ))}
                  {/* Banda de plantas comprimidas · entre top y bottom.
                     Render con position absoluto NO posible · uso un row
                     extra después del primero (top) cuando compressed. */}
                  {compressed && (
                    <div
                      className="flex items-center border-t border-b border-foreground/30 bg-foreground/8 relative"
                      style={{ height: floorH }}
                    >
                      {/* Líneas verticales que cruzan para mantener
                         continuidad visual de las paredes interiores */}
                      {Array.from({ length: escs }, (_, e) => (
                        <div
                          key={e}
                          className={cn(
                            "h-full",
                            e > 0 && "border-l border-foreground/30",
                          )}
                          style={{ minWidth: colMinW, flex: 1 }}
                        />
                      ))}
                      {/* Texto centrado superpuesto · spans full width */}
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground/80 tnum tracking-tight pointer-events-none">
                        + {collapsedCount} {collapsedCount === 1 ? "planta" : "plantas"}
                      </span>
                    </div>
                  )}

                  {/* Planta baja · con puerta(s) de entrada por escalera */}
                  <div className="flex border-t border-foreground/40 bg-foreground/5" style={{ minHeight: floorH + 8 }}>
                    {Array.from({ length: escs }, (_, e) => (
                      <div
                        key={e}
                        className={cn(
                          "flex items-end justify-center gap-[6px] px-[10px] pt-[6px] pb-[2px] flex-1",
                          e > 0 && "border-l border-foreground/30",
                        )}
                        style={{ minWidth: colMinW }}
                      >
                        {state.plantaBajaTipo === "viviendas" ? (
                          Array.from({ length: aptos }, (_, a) => (
                            <span
                              key={a}
                              className="rounded-[2px] bg-emerald-200 dark:bg-emerald-900/60 border border-emerald-700/40 dark:border-emerald-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] shrink-0"
                              style={{ width: windowW, height: windowH }}
                              title={`PB · bajo ${a + 1}`}
                            />
                          ))
                        ) : state.plantaBajaTipo === "locales" ? (
                          <>
                            <span
                              className="rounded-sm bg-amber-200 dark:bg-amber-900/60 border border-amber-700/50 dark:border-amber-300/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] flex-1"
                              style={{ height: windowH + 8, minWidth: 28 }}
                              title="Local comercial"
                            />
                            <span
                              className="w-[10px] rounded-t-sm bg-foreground/70 border border-foreground/80 shrink-0"
                              style={{ height: windowH + 10 }}
                              title="Entrada residencial"
                            />
                          </>
                        ) : (
                          <span
                            className="w-[14px] rounded-t-sm bg-foreground/70 border border-foreground/80 shrink-0"
                            style={{ height: windowH + 10 }}
                            title="Entrada al portal"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acera/suelo */}
                <div className="h-1 w-[calc(100%+14px)] -mt-px rounded-b-sm bg-foreground/30" />
              </div>

              {/* Footer · resumen + botón añadir escalera */}
              <div className="text-center flex flex-col items-center gap-1">
                <p className="text-[10px] text-muted-foreground tnum">
                  {state.plantas}P · {escs} esc · {aptos} viv/planta
                </p>
                <p className="text-[11px] font-semibold text-foreground tnum">
                  {totalVivs} {totalVivs === 1 ? "vivienda" : "viviendas"}
                </p>
                <button
                  type="button"
                  onClick={() => addEscalera(b)}
                  className="mt-1 inline-flex items-center gap-1 h-6 px-2 rounded-full border border-dashed border-border text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  title="Añadir una escalera a este bloque"
                >
                  <Plus className="h-2.5 w-2.5" strokeWidth={2.25} />
                  Escalera
                </button>
              </div>
            </article>
          );
        })}

        {/* Botón "Añadir bloque" · ghost · al lado derecho del último bloque */}
        <button
          type="button"
          onClick={addBloque}
          className="flex flex-col items-center justify-center gap-1.5 self-stretch min-h-[160px] w-[80px] rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors shrink-0"
          title="Añadir un bloque más"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px] font-medium">Añadir bloque</span>
        </button>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[2px] bg-sky-200 border border-sky-700/40 inline-block" />
          Vivienda
        </span>
        {state.plantaBajaTipo === "viviendas" && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] bg-emerald-200 border border-emerald-700/40 inline-block" />
            Bajo residencial
          </span>
        )}
        {state.plantaBajaTipo === "locales" && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-amber-200 border border-amber-700/50 inline-block" />
            Local comercial
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2 rounded-t-sm bg-foreground/70 border border-foreground/80 inline-block" />
          Entrada al portal
        </span>
      </div>
    </div>
  );
}

function PlantaBajaCard({
  icon: Icon, title, desc, selected, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
    </button>
  );
}

function AmenityToggle({
  label, checked, onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className={cn(
      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors",
      checked ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/30",
    )}>
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function ExtraBox({
  icon: Icon, title, desc, active, onToggle, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; active: boolean;
  onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Switch checked={active} onCheckedChange={onToggle} ariaLabel={title} />
      </div>
      {active && (
        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

function ExtraRow({
  label, value, min, onChange,
}: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <InlineStepper value={value} min={min} onChange={onChange} />
    </div>
  );
}

/** Input de precio · usado cuando un anejo (trastero / parking / piscina
 *  privada) NO está incluido en el precio de la vivienda y hay que
 *  cobrarlo aparte. Mismo styling que ExtraRow para coherencia visual. */
/* ═══════════════════════════════════════════════════════════════════
   LockedStructureNotice
   ═══════════════════════════════════════════════════════════════════
   Banner read-only que aparece en los pasos `tipo` y `sub_uni` cuando
   ya hay unidades creadas · cambiar esos campos regeneraría todo y
   destruiría datos. El user ve el valor actual + aviso explícito de
   que tiene que crear una promoción nueva si necesita ese cambio. */
function LockedStructureNotice({ label, current }: { label: string; current: string }) {
  return (
    <div className="flex flex-col gap-3 max-w-[600px] mx-auto w-full">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-foreground">{current}</p>
      </div>
      <div className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-[13px] text-foreground leading-relaxed">
        <p className="font-medium mb-1">No puedes cambiarlo a estas alturas</p>
        <p className="text-muted-foreground">
          Ya has creado unidades en esta promoción. Cambiar este campo regeneraría toda la
          estructura y perderías los datos introducidos. Si necesitas un tipo distinto,
          crea una promoción nueva desde cero.
        </p>
      </div>
    </div>
  );
}

function PriceRow({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          /* Formato es-ES con miles · "100.000" en vez de "100000".
           * Empty string cuando 0 · placeholder hace de hint. */
          value={value > 0 ? value.toLocaleString("es-ES") : ""}
          placeholder="0"
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, "");
            onChange(digits === "" ? 0 : Number(digits));
          }}
          className="h-8 w-28 rounded-lg border border-border bg-card text-sm tnum px-2 text-right outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <span className="text-xs text-muted-foreground">€</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Placeholder para pasos aún no portados
   ═══════════════════════════════════════════════════════════════════ */
function UpcomingStep({ step }: { step: StepId }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 sm:p-8 text-center">
      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-[14.5px] font-semibold">Paso "{step}" · próximamente</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Este paso se portará en la siguiente fase del diseño. Puedes continuar al siguiente o volver atrás.
      </p>
    </div>
  );
}
