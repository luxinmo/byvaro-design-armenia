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
import { ChevronLeft, ChevronRight, X, Sparkles, Rocket, SkipForward } from "lucide-react";
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
import { saveDraft as persistDraft, getDraft, deleteDraft } from "@/lib/promotionDrafts";
import { createPromotionFromWizard } from "@/lib/promotionsStorage";
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
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import {
  FileCheck, FileX, Calendar as CalendarIconLucide, Home as HomeIcon, Store as StoreIcon,
  Minus, Archive, Car, Waves,
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
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get("draft");
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
  // Carga inicial · prioridad: draft > promotionId hydration > legacy > default
  const initialDraft = useMemo(() => {
    if (draftIdParam) {
      const d = getDraft(draftIdParam);
      if (d) return { id: d.id, state: d.state };
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
        if (override) return { id: null, state: override };
        const units = unitsByPromotion[found.id] ?? [];
        return { id: null, state: promotionToWizardState(found, units) };
      }
    }
    const legacy = loadLegacyDraft(); // se consume y borra la legacy key
    if (legacy) return { id: null, state: legacy };
    return { id: null, state: defaultWizardState };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<WizardState>(initialDraft.state);
  const [draftId, setDraftId] = useState<string | null>(initialDraft.id);

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
  const initialStep = (searchParams.get("step") as StepId) || "role";
  const [step, setStep] = useState<StepId>(initialStep);

  // Indicador de autoguardado
  const [savedAt, setSavedAt] = useState<number | null>(() => (initialDraft.state !== defaultWizardState ? Date.now() : null));
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const isFirstRenderRef = useRef(true);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Auto-save con debounce (~400ms). Evita escribir localStorage en cada
  // keypress y da tiempo a mostrar el estado "Guardando…".
  // Si estamos editando una promo existente (`resolvedPromotionId`),
  // guardamos en el override store (por-promo) en vez de en el draft
  // genérico · así los cambios persisten al volver a abrir la promo.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      if (resolvedPromotionId) {
        savePromoWizardOverride(resolvedPromotionId, state);
        setSavedAt(Date.now());
        setSaving(false);
        return;
      }
      const res = persistDraft(state, draftId ?? undefined);
      if (!draftId) setDraftId(res.id);
      if (!res.ok && res.error === "quota") {
        toast.error("No se pudo autoguardar", {
          description: "El navegador ha quedado sin espacio. Elimina algún borrador o reduce fotos para continuar.",
        });
      } else if (res.discarded.length > 0) {
        toast.info(`Se descartó "${res.discarded[0]}" por superar el límite de 50 borradores`);
      }
      setSavedAt(Date.now());
      setSaving(false);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [state, resolvedPromotionId]);

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
    return state.plantas * state.aptosPorPlanta * multiplier;
  }, [isSingleHome, isVariasUni, state.tipologiasSeleccionadas, state.plantas, state.aptosPorPlanta, multiplier]);
  const totalLocales = state.tipo === "unifamiliar" ? 0 : state.locales * multiplier;
  const summaryItems = [
    { label: "viviendas", count: totalViviendas },
    { label: "locales", count: totalLocales },
    { label: "trasteros", count: state.trasteros },
    { label: "plazas parking", count: state.parkings },
  ];

  /* Opciones de trimestre (año actual +2) */
  const currentYear = new Date().getFullYear();
  const trimestreOptions = [
    `T1 ${currentYear}`, `T2 ${currentYear}`, `T3 ${currentYear}`, `T4 ${currentYear}`,
    `T1 ${currentYear + 1}`, `T2 ${currentYear + 1}`, `T3 ${currentYear + 1}`, `T4 ${currentYear + 1}`,
    `T1 ${currentYear + 2}`, `T2 ${currentYear + 2}`, `T3 ${currentYear + 2}`, `T4 ${currentYear + 2}`,
  ];

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
    setState(prev => ({
      ...prev,
      tipologiasSeleccionadas: prev.tipologiasSeleccionadas.map(t =>
        t.tipo === tipo ? { ...t, cantidad: Math.max(1, t.cantidad + delta) } : t
      ),
    }));
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
      case "config_edificio": return s.numBloques >= 1 && s.plantas >= 1 && s.aptosPorPlanta >= 1;
      case "extras": return true; // siempre opcional
      case "estado": return !!s.estado;
      case "detalles":
        // Si ya está terminado, la entrega ya ocurrió y DetallesStep oculta
        // el selector de tipoEntrega · el paso queda completo sin requerirlo
        // (idéntico al predicado de publicationRequirements §6).
        if (s.estado === "terminado") return true;
        return !!s.tipoEntrega || !!s.fechaEntrega || !!s.trimestreEntrega;
      case "info_basica":
        return !!s.nombrePromocion.trim()
          && !!s.direccionPromocion.pais.trim()
          && !!s.direccionPromocion.ciudad.trim();
      case "multimedia": return s.fotos.length > 0;
      case "descripcion": return !!s.descripcion || Object.keys(s.descripcionIdiomas ?? {}).length > 0;
      case "crear_unidades": return s.unidades.length > 0;
      case "colaboradores": return !s.colaboracion || !!s.formaPagoComision;
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
    if (step === "extras") return true;
    if (step === "revision") return canPublishWizard(state);
    return isStepComplete(state, step);
  };

  /* Handlers */
  const handleContinue = () => {
    const next = getNext();
    if (next) setStep(next);
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
      const created = createPromotionFromWizard(state, me.orgId, role, "active");
      if (draftId) deleteDraft(draftId);
      toast.success("Promoción creada correctamente", {
        description: `${created.name} · publicada en /promociones`,
      });
      navigate("/promociones");
    }
  };
  const handleBack = () => {
    const prev = getPrev();
    if (prev) setStep(prev);
    else navigate(-1);
  };
  /** Cancela el autosave pendiente (si hay timer) y guarda síncrono
   *  con el state actual. Evita race condition: si el usuario pulsa
   *  "Guardar y salir" dentro de los 400ms del debounce, garantizamos
   *  que el id se conserve y no se cree un draft duplicado. */
  const flushSave = (): string => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    /* Editando promo existente · save al override store · NO crea
     *  draft huérfano. Idempotente (mismo promotionId siempre). */
    if (resolvedPromotionId) {
      savePromoWizardOverride(resolvedPromotionId, state);
      return resolvedPromotionId;
    }
    const res = persistDraft(state, draftId ?? undefined);
    if (!draftId) setDraftId(res.id);
    if (!res.ok && res.error === "quota") {
      toast.error("No se pudo guardar", { description: "Espacio de almacenamiento lleno." });
    }
    return res.id;
  };
  const handleSaveDraft = () => {
    flushSave();
    setSavedAt(Date.now());
    toast.success("Borrador guardado");
  };
  const handleSaveAndExit = () => {
    flushSave();
    toast.success(
      state.nombrePromocion?.trim()
        ? `"${state.nombrePromocion}" guardada en incompletas`
        : "Borrador guardado en incompletas",
    );
    navigate("/promociones?tab=incompletas");
  };
  const handleClose = async () => {
    const ok = await confirm({
      title: "¿Salir del asistente?",
      description: "El borrador se conserva en incompletas. Podrás continuar cuando quieras.",
      confirmLabel: "Salir",
    });
    if (ok) {
      flushSave();
      navigate("/promociones?tab=incompletas");
    }
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
            {publishReady && (
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
            <button
              onClick={handleSaveAndExit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              title="Guarda el avance y sal del asistente. Volverás a encontrar la promoción en Incompletas."
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guardar y salir</span>
              <span className="sm:hidden">Guardar</span>
            </button>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tipoOptions.map((o) => (
                      <OptionCard key={o.value} option={o} selected={state.tipo === o.value}
                        onSelect={(v) => {
                          handleTipoSelect(v);
                          autoAdvanceRef.current = true;
                        }} />
                    ))}
                  </div>
                )}

                {/* ─── Step: sub_uni · single-select · auto-advance ─── */}
                {step === "sub_uni" && (
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
                                    <InlineStepper value={selected.cantidad} min={1}
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
                {step === "config_edificio" && (
                  <div className="flex flex-col gap-3">
                    <SectionLabel>Bloques y escaleras</SectionLabel>

                    <NumericStepper
                      label="Número de bloques"
                      value={state.numBloques}
                      min={1}
                      onChange={(v) => {
                        update("numBloques", v);
                        const current = state.escalerasPorBloque;
                        if (v > current.length) {
                          update("escalerasPorBloque", [...current, ...Array(v - current.length).fill(1)]);
                        } else {
                          update("escalerasPorBloque", current.slice(0, v));
                        }
                      }}
                    />

                    {state.numBloques === 1 ? (
                      <NumericStepper
                        label="Escaleras"
                        value={state.escalerasPorBloque[0] || 1}
                        min={1}
                        onChange={(v) => update("escalerasPorBloque", [v])}
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {state.escalerasPorBloque.map((esc, i) => (
                          <NumericStepper
                            key={i}
                            label={`Escaleras en Bloque ${i + 1}`}
                            value={esc}
                            min={1}
                            onChange={(v) => {
                              const next = [...state.escalerasPorBloque];
                              next[i] = v;
                              update("escalerasPorBloque", next);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Renombrado opcional de bloques · solo si hay >1. */}
                    {state.numBloques > 1 && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <SectionLabel>
                          Nombres de bloques <span className="font-normal normal-case text-muted-foreground">· opcional · "Bloque 1", "Torre Norte"…</span>
                        </SectionLabel>
                        <div className="flex flex-col gap-2">
                          {Array.from({ length: state.numBloques }, (_, i) => {
                            const key = `B${i + 1}`;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-20 shrink-0">Bloque {i + 1}</span>
                                <input
                                  type="text"
                                  value={state.blockNames[key] ?? ""}
                                  onChange={(e) => {
                                    const next = { ...state.blockNames };
                                    const trimmed = e.target.value.trim();
                                    if (!trimmed) delete next[key];
                                    else next[key] = e.target.value;
                                    update("blockNames", next);
                                  }}
                                  placeholder={`Bloque ${i + 1}`}
                                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <div className="h-px bg-border my-1" />
                    <SectionLabel>Distribución</SectionLabel>
                    <NumericStepper label="Plantas sobre rasante" value={state.plantas} min={1}
                      onChange={(v) => update("plantas", v)} />
                    <NumericStepper label="Viviendas por planta (por escalera)" value={state.aptosPorPlanta} min={1}
                      onChange={(v) => update("aptosPorPlanta", v)} />

                    <div className="h-px bg-border my-1" />
                    <SectionLabel>Planta baja (planta 0)</SectionLabel>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <PlantaBajaCard icon={Minus} title="Sin uso residencial" desc="Nada en PB"
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
                      <NumericStepper label="Nº de locales en planta baja" value={state.locales} min={0}
                        onChange={(v) => update("locales", v)} />
                    )}

                    {/* Summary */}
                    <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed mt-1">
                      {state.plantaBajaTipo === "viviendas" && (
                        <><span className="font-semibold text-foreground">Bajos:</span> Se generarán {state.aptosPorPlanta * multiplier} viviendas tipo bajo en planta 0. </>
                      )}
                      {state.plantaBajaTipo === "locales" && (
                        <><span className="font-semibold text-foreground">Planta 0:</span> Zona de locales. Las viviendas empiezan en planta 1. </>
                      )}
                      {state.plantaBajaTipo === null && (
                        <><span className="font-semibold text-foreground">Planta 0:</span> Sin uso residencial. Las viviendas empiezan en planta 1. </>
                      )}
                      <br />
                      <span className="font-semibold text-foreground">Total:</span>{" "}
                      <span className="tnum">{totalViviendas} viviendas</span>
                      {state.numBloques > 1 && <> en <span className="tnum">{state.numBloques}</span> bloques</>}
                      {totalEscaleras > 1 && <> (<span className="tnum">{totalEscaleras}</span> escaleras)</>}
                    </div>
                  </div>
                )}

                {/* ─── Step: extras ─── */}
                {step === "extras" && (
                  <div className="flex flex-col gap-3">
                    <SectionLabel>Anejos por vivienda</SectionLabel>

                    {/* Trasteros · si NO está incluido en el precio se pide
                         el precio que se cobra por cada uno. La opción de
                         añadir "trasteros adicionales sueltos" se ha movido
                         a la sección Anejos sueltos del paso "Crear unidades"
                         · ahí se nombran y se les pone precio individual. */}
                    <ExtraBox
                      icon={Archive}
                      title="Trastero incluido"
                      desc="Cada vivienda incluye trastero"
                      active={state.trasteros > 0}
                      onToggle={(v) => {
                        if (v) {
                          update("trasterosIncluidosPorVivienda", 1);
                          update("trasteros", totalViviendas);
                        } else {
                          update("trasteros", 0);
                        }
                      }}
                    >
                      <ExtraRow label="Trasteros incluidos por vivienda"
                        value={state.trasterosIncluidosPorVivienda}
                        min={1}
                        onChange={(v) => {
                          update("trasterosIncluidosPorVivienda", v);
                          const extra = Math.max(0, state.trasteros - totalViviendas * state.trasterosIncluidosPorVivienda);
                          update("trasteros", totalViviendas * v + extra);
                        }} />
                      <Checkbox
                        id="trasteros-precio"
                        checked={state.trasterosIncluidosPrecio}
                        onCheckedChange={(v) => update("trasterosIncluidosPrecio", v)}
                        label="Incluido en el precio de la vivienda"
                      />
                      {!state.trasterosIncluidosPrecio && (
                        <PriceRow
                          label="Precio por trastero"
                          value={state.trasteroPrecio}
                          onChange={(v) => update("trasteroPrecio", v)}
                        />
                      )}
                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                        Si hay trasteros adicionales sueltos, los podrás añadir
                        más adelante en el paso <span className="font-medium text-foreground">Crear unidades · Anejos sueltos</span>.
                      </p>
                    </ExtraBox>

                    {/* Parking · mismo patrón. Plazas adicionales sueltas
                         viven en Anejos sueltos del paso "Crear unidades". */}
                    <ExtraBox
                      icon={Car}
                      title="Plaza de parking"
                      desc="Cada vivienda incluye plaza de parking"
                      active={state.parkings > 0}
                      onToggle={(v) => {
                        if (v) {
                          update("parkingsIncluidosPorVivienda", 1);
                          update("parkings", totalViviendas);
                        } else {
                          update("parkings", 0);
                        }
                      }}
                    >
                      <ExtraRow label="Plazas incluidas por vivienda"
                        value={state.parkingsIncluidosPorVivienda}
                        min={1}
                        onChange={(v) => {
                          update("parkingsIncluidosPorVivienda", v);
                          const extra = Math.max(0, state.parkings - totalViviendas * state.parkingsIncluidosPorVivienda);
                          update("parkings", totalViviendas * v + extra);
                        }} />
                      <Checkbox
                        id="parkings-precio"
                        checked={state.parkingsIncluidosPrecio}
                        onCheckedChange={(v) => update("parkingsIncluidosPrecio", v)}
                        label="Incluido en el precio de la vivienda"
                      />
                      {!state.parkingsIncluidosPrecio && (
                        <PriceRow
                          label="Precio por plaza"
                          value={state.parkingPrecio}
                          onChange={(v) => update("parkingPrecio", v)}
                        />
                      )}
                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                        Si hay plazas de parking adicionales sueltas, las podrás añadir
                        más adelante en el paso <span className="font-medium text-foreground">Crear unidades · Anejos sueltos</span>.
                      </p>
                    </ExtraBox>

                    {/* Piscina privada · solo aplica a unifamiliar. Mismo
                         patrón que trastero/parking · si no está incluida
                         en el precio, se pide el importe. */}
                    {state.tipo === "unifamiliar" && (
                      <ExtraBox
                        icon={Waves}
                        title="Piscina privada"
                        desc="Cada villa incluye piscina propia"
                        active={state.piscinaPrivadaPorDefecto}
                        onToggle={(v) => update("piscinaPrivadaPorDefecto", v)}
                      >
                        <Checkbox
                          id="piscina-precio"
                          checked={state.piscinaIncluidaPrecio}
                          onCheckedChange={(v) => update("piscinaIncluidaPrecio", v)}
                          label="Incluida en el precio de la vivienda"
                        />
                        {!state.piscinaIncluidaPrecio && (
                          <PriceRow
                            label="Precio por piscina privada"
                            value={state.piscinaPrecio}
                            onChange={(v) => update("piscinaPrecio", v)}
                          />
                        )}
                        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                          Esto es el valor por defecto para todas las villas. Si
                          alguna no tiene piscina, podrás desactivarla en esa villa
                          concreta más adelante en el paso <span className="font-medium text-foreground">Crear unidades</span>.
                        </p>
                      </ExtraBox>
                    )}

                    {/* Zonas y amenidades · booleanos explícitos de la
                         promoción. La ficha de unidad los consulta para
                         mostrar iconos reales. La piscina privada vive
                         arriba en su propia ExtraBox · aquí solo zonas
                         compartidas de la promoción. */}
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Waves className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Zonas y amenidades</p>
                          <p className="text-xs text-muted-foreground">Qué incluye la promoción para todas las viviendas</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <AmenityToggle label="Piscina comunitaria"
                          checked={state.piscinaComunitaria}
                          onCheckedChange={(v) => update("piscinaComunitaria", v)} />
                        <AmenityToggle label="Piscina interna / climatizada"
                          checked={state.piscinaInterna}
                          onCheckedChange={(v) => update("piscinaInterna", v)} />
                        <AmenityToggle label="Zona SPA"
                          checked={state.zonaSpa}
                          onCheckedChange={(v) => update("zonaSpa", v)} />
                        <AmenityToggle label="Zona infantil / parque"
                          checked={state.zonaInfantil}
                          onCheckedChange={(v) => update("zonaInfantil", v)} />
                        <AmenityToggle label="Urbanización cerrada"
                          checked={state.urbanizacionCerrada}
                          onCheckedChange={(v) => update("urbanizacionCerrada", v)} />
                      </div>
                    </div>

                    <TotalSummary items={summaryItems} />
                  </div>
                )}

                {/* ─── Step: estado ─── */}
                {step === "estado" && (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {estadoOptions.map((o) => (
                        <OptionCard key={o.value} option={o} selected={state.estado === o.value}
                          onSelect={handleEstadoSelect} />
                      ))}
                    </div>

                    {/* Licencia (solo para proyecto) */}
                    {state.estado === "proyecto" && (
                      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                        <SectionLabel>¿Tiene licencia de obra?</SectionLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <LicenciaCard icon={FileCheck} title="Con licencia" desc="Licencia concedida"
                            selected={state.tieneLicencia === true} onClick={() => update("tieneLicencia", true)} />
                          <LicenciaCard icon={FileX} title="Sin licencia" desc="Pendiente de licencia"
                            selected={state.tieneLicencia === false} onClick={() => update("tieneLicencia", false)} />
                        </div>
                      </div>
                    )}

                    {/* Fase de construcción (cuando en_construccion) */}
                    {state.estado === "en_construccion" && (
                      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                        <SectionLabel>Etapa de construcción</SectionLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {faseConstruccionOptions.map((o) => (
                            <OptionCard key={o.value} option={o} selected={state.faseConstruccion === o.value}
                              onSelect={handleFaseSelect} />
                          ))}
                        </div>

                        {state.faseConstruccion === "entrega_proxima" && (
                          <div className="pt-3 border-t border-border">
                            <SectionLabel>Fecha estimada de entrega</SectionLabel>
                            <div className="grid grid-cols-4 gap-2">
                              {trimestreOptions.map((t) => (
                                <button key={t} onClick={() => update("trimestreEntrega", t)}
                                  className={cn(
                                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors tnum",
                                    state.trimestreEntrega === t
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fecha de terminación (cuando terminado) */}
                    {state.estado === "terminado" && (
                      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <CalendarIconLucide className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Fecha de terminación</p>
                            <p className="text-xs text-muted-foreground">¿Cuándo se terminó la obra?</p>
                          </div>
                        </div>
                        <input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          value={state.fechaTerminacion ? state.fechaTerminacion.split("T")[0] : ""}
                          onChange={(e) => update("fechaTerminacion", e.target.value ? new Date(e.target.value).toISOString() : null)}
                          className="h-9 px-3 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
                        />
                        <p className="text-[11px] text-muted-foreground">La fecha no puede ser posterior a hoy.</p>
                      </div>
                    )}

                    {/* Mixto: informativo */}
                    {state.tipo === "mixto" && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-foreground">Promoción mixta</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Para crear una promoción mixta, primero configura la parte <strong>plurifamiliar</strong>.
                          Al finalizar podrás añadir las <strong>viviendas unifamiliares</strong> desde la ficha de la promoción.
                        </p>
                      </div>
                    )}
                  </div>
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
                  <InfoBasicaStep state={state} update={update} />
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
                  <MultimediaStep state={state} update={update} />
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
                  <CrearUnidadesStep state={state} update={update} />
                )}

                {/* ─── Step: revision (paso final) ─── */}
                {step === "revision" && (
                  <RevisionStep state={state} onEditStep={setStep} />
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
                {!getNext() ? "Activar" : "Siguiente"}
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
function PriceRow({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-8 w-28 rounded-lg border border-border bg-card text-sm tnum px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
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
