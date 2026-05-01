/**
 * promotionToWizardState.ts · Hidrata `WizardState` desde un
 * `Promotion` / `DevPromotion` ya creado.
 *
 * QUÉ
 * ----
 * Cuando un promotor entra al wizard desde una promoción ya en
 * producción (click en "Completar todo" / "Editar"), el wizard NO
 * debe arrancar vacío · debe llegar pre-llenado con TODO lo que ya
 * tiene la promoción · solo el campo realmente faltante en rojo.
 *
 * Antes de este mapper · el wizard arrancaba con `defaultWizardState`
 * y `getMissingForWizard()` reportaba ~9 pasos pendientes aunque el
 * `Promotion` estuviera 95% completo. Inconsistencia entre los dos
 * validadores (`getMissingForPromotion` decía "1 falta",
 * `getMissingForWizard` decía "9 faltan") · este mapper la cierra.
 *
 * USO
 * ---
 *  · `CrearPromocion.tsx` lee `?promotionId=X` o `returnTo` que
 *    contiene un id de promoción. Si lo encuentra, llama a
 *    `promotionToWizardState(promo, units)` y usa el resultado como
 *    estado inicial · ya no `defaultWizardState`.
 *
 * REGLAS
 * ------
 *  · NUNCA pisa fields del Promotion · solo hidrata desde lo que
 *    existe. Si Promotion no tiene un campo (ej. `description`),
 *    el wizard mantiene el default (string vacío) y `getMissingFor
 *    Wizard` lo reportará como pendiente · que es la verdad.
 *  · Defaults sensatos para campos que el wizard exige pero la
 *    Promotion no almacena (numBloques=1 si solo hay 1 unidad,
 *    etc.). Estos defaults son explícitos, no defaultWizardState.
 *  · Idempotente · llamar 2 veces con el mismo input devuelve el
 *    mismo output.
 *
 * TODO(backend) · cuando aterrice backend con `WizardState` persistido
 * por promoción (`promotion_drafts` table), este mapper se sustituye
 * por `GET /api/promotions/:id/wizard-state` · la signature pública
 * se mantiene para que `CrearPromocion.tsx` no cambie.
 */

import type { Promotion } from "@/data/promotions";
import type { DevPromotion } from "@/data/developerPromotions";
import type { Unit } from "@/data/units";
import {
  defaultWizardState,
  type WizardState,
  type TipoPromocion,
  type SubUni,
  type SubVarias,
  type EstadoPromocion,
  type TipoEntrega,
  type TipologiaSeleccionada,
  type EstiloVivienda,
  type FotoItem,
  type UnitData,
  type SubtipoUnidad,
} from "@/components/crear-promocion/types";

/* ══════════════════════════════════════════════════════════════════
   Helpers de derivación
   ══════════════════════════════════════════════════════════════════ */

/** Mapea `Promotion.buildingType` al trío {tipo, subUni, subVarias}. */
function deriveBuildingType(buildingType: Promotion["buildingType"]): {
  tipo: TipoPromocion | null;
  subUni: SubUni | null;
  subVarias: SubVarias | null;
} {
  switch (buildingType) {
    case "unifamiliar-single":
      return { tipo: "unifamiliar", subUni: "una_sola", subVarias: null };
    case "unifamiliar-multiple":
      return { tipo: "unifamiliar", subUni: "varias", subVarias: "independiente" };
    case "plurifamiliar":
      return { tipo: "plurifamiliar", subUni: null, subVarias: null };
    default:
      return { tipo: null, subUni: null, subVarias: null };
  }
}

/** Deriva el `EstadoPromocion` desde `status` y `constructionProgress`. */
function deriveEstado(p: Promotion): EstadoPromocion | null {
  if (p.status === "incomplete") return null;
  const progress = p.constructionProgress ?? -1;
  if (p.status === "sold-out") return "terminado";
  if (progress >= 100) return "terminado";
  if (progress > 0) return "en_construccion";
  if (progress === 0) return "proyecto";
  return "en_construccion"; // default razonable cuando no se conoce
}

/** Parsea `"Q2 2026"` o `"2026-04-01"` o `"trimestre"` a un trimestreEntrega
 *  reconocido por el wizard. Devuelve null si no encaja. */
function deriveDelivery(delivery: string | undefined): {
  trimestreEntrega: string | null;
  fechaEntrega: string | null;
  tipoEntrega: TipoEntrega | null;
} {
  if (!delivery) return { trimestreEntrega: null, fechaEntrega: null, tipoEntrega: null };
  /* "Q2 2026" → trimestre */
  if (/^Q[1-4]\s+\d{4}$/i.test(delivery.trim())) {
    return { trimestreEntrega: delivery.trim().toUpperCase(), fechaEntrega: null, tipoEntrega: "fecha_definida" };
  }
  /* ISO date · "2026-04-15" */
  if (/^\d{4}-\d{2}-\d{2}$/.test(delivery)) {
    return { trimestreEntrega: null, fechaEntrega: delivery, tipoEntrega: "fecha_definida" };
  }
  /* "tras_contrato_cv" · "tras_licencia" */
  if (delivery === "tras_contrato_cv" || delivery === "tras_licencia") {
    return { trimestreEntrega: null, fechaEntrega: null, tipoEntrega: delivery };
  }
  /* String libre · marcamos como tipoEntrega "fecha_definida" para
   *  que la validación de "tieneEntrega" pase. El usuario puede
   *  refinar en el wizard. */
  return { trimestreEntrega: delivery, fechaEntrega: null, tipoEntrega: "fecha_definida" };
}

/** Parsea `"Altea, Alicante"` o `"Marbella, Costa del Sol"` a {ciudad, provincia, pais}. */
function deriveLocation(location: string): WizardState["direccionPromocion"] {
  const parts = (location ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  /* Heurística pragmática · el seed siempre lleva "Ciudad, Provincia"
   *  · pais por defecto España (el producto es ES-first hoy).
   *  TODO(backend): location structurada (pais/provincia/ciudad
   *  separados) cuando se rediseñe el formulario de ubicación. */
  return {
    pais: "España",
    provincia: parts[1] ?? "",
    ciudad: parts[0] ?? "",
    direccion: "",
  };
}

/** Mapa de string `propertyTypes` (ej. "Apartments") a tipologías que
 *  el wizard reconoce (`SubVarias`). Para plurifamiliar se ignora. */
function deriveTipologias(
  propertyTypes: string[],
  tipo: TipoPromocion | null,
  subUni: SubUni | null,
): TipologiaSeleccionada[] {
  if (tipo !== "unifamiliar" || subUni !== "varias") return [];
  /* Heurística · cada `propertyType` se cuenta 1 vez con cantidad 1.
   *  El usuario puede ajustar en el wizard. */
  const out: TipologiaSeleccionada[] = [];
  for (const pt of propertyTypes) {
    const lower = pt.toLowerCase();
    let kind: SubVarias = "independiente";
    if (lower.includes("adosad")) kind = "adosados";
    else if (lower.includes("pared")) kind = "pareados";
    out.push({ tipo: kind, cantidad: 1 });
  }
  return out;
}

/** Estilo por defecto · el wizard exige al menos uno para
 *  unifamiliar varias. Sin info real, "contemporaneo" es default. */
function deriveEstilos(tipo: TipoPromocion | null, subUni: SubUni | null): EstiloVivienda[] {
  if (tipo === "unifamiliar" && subUni === "varias") return ["contemporaneo"];
  return [];
}

/** Convierte `Unit` (data/units.ts) a `UnitData` (wizard shape). */
function unitToUnitData(u: Unit): UnitData {
  /* Subtipo derivado · el wizard usa SubtipoUnidad, units.ts usa
   *  string libre ("Apartamento", "Ático", "Dúplex", "Estudio",
   *  "Loft"...). Mapeo razonable. */
  const subtipoMap: Record<string, SubtipoUnidad> = {
    "Apartamento": "apartamento",
    "Ático": "penthouse",
    "Dúplex": "duplex",
    "Triplex": "triplex",
    "Loft": "loft",
    "Estudio": "apartamento",
  };
  const subtipo = subtipoMap[u.type] ?? null;
  return {
    id: u.id,
    ref: u.ref,
    nombre: u.publicId ?? `${u.floor}º${u.door}`,
    dormitorios: u.bedrooms,
    banos: u.bathrooms,
    superficieConstruida: u.builtArea,
    superficieUtil: u.usableArea,
    superficieTerraza: u.terrace,
    parcela: u.parcel,
    precio: u.price,
    planta: u.floor,
    orientacion: u.orientation,
    parking: false,
    trastero: false,
    piscinaPrivada: u.hasPool,
    status: u.status,
    vistas: [],
    fotosMode: "promocion",
    planos: false,
    subtipo,
    idInterna: u.id,
    caracteristicas: [],
    usarFotosPromocion: true,
    fotosUnidad: [],
    videosUnidad: [],
    clientName: u.clientName,
    agencyName: u.agencyName,
    reservedAt: u.reservedAt,
    soldAt: u.soldAt,
  };
}

/** Construye la foto principal desde `Promotion.image`. */
function deriveFotos(image: string | undefined): FotoItem[] {
  if (!image) return [];
  return [
    {
      id: "seed-foto-principal",
      url: image,
      nombre: "Imagen principal",
      categoria: "fachada",
      esPrincipal: true,
      bloqueada: false,
      orden: 0,
    },
  ];
}

/* ══════════════════════════════════════════════════════════════════
   Mapper principal
   ══════════════════════════════════════════════════════════════════ */

export function promotionToWizardState(
  p: Promotion | DevPromotion,
  units: Unit[] = [],
): WizardState {
  const { tipo, subUni, subVarias } = deriveBuildingType(p.buildingType);
  const estado = deriveEstado(p);
  const delivery = deriveDelivery(p.delivery);
  const direccion = deriveLocation(p.location);
  const tipologias = deriveTipologias(p.propertyTypes ?? [], tipo, subUni);
  const estilos = deriveEstilos(tipo, subUni);

  /* Si tenemos unidades reales en `unitsByPromotion`, las usamos.
   *  Si no, queda vacío · el wizard pedirá generar al menos 1. */
  const unidades: UnitData[] = units.map(unitToUnitData);

  /* Estructura del edificio · derivada de unidades cuando hay
   *  · si no, defaults razonables. */
  const blocks = new Set(units.map((u) => u.block));
  const numBloques = Math.max(1, blocks.size);
  const floors = new Set(units.map((u) => u.floor));
  const plantas = Math.max(1, floors.size);
  const aptosPorPlanta = units.length > 0 && plantas > 0
    ? Math.max(1, Math.ceil(units.length / Math.max(1, numBloques) / plantas))
    : 4;

  /* Colaboradores · DevPromotion lleva `collaboration: {...}` cuando
   *  el promotor configuró comisiones. Promotion shape (marketplace
   *  legacy) no lo tiene · queda con defaults del wizard que son
   *  válidos para el validador (formaPagoComision queda null y se
   *  reportará como missing). */
  const collab = (p as DevPromotion).collaboration;
  const colaboracion = (p as DevPromotion).canShareWithAgencies !== false;

  return {
    ...defaultWizardState,

    /* ─── Identidad ─── */
    role: p.ownerRole ?? "promotor",
    refPromocion: (p.code ?? "").trim(),
    nombrePromocion: p.name ?? "",

    /* ─── Tipología + estructura ─── */
    tipo,
    subUni,
    subVarias,
    tipologiasSeleccionadas: tipologias,
    estilosSeleccionados: estilos,
    estiloVivienda: estilos[0] ?? null,

    numBloques,
    escalerasPorBloque: Array(numBloques).fill(1),
    plantas,
    aptosPorPlanta,

    /* ─── Comercialización ─── */
    estado,
    fechaEntrega: delivery.fechaEntrega,
    trimestreEntrega: delivery.trimestreEntrega,
    tipoEntrega: delivery.tipoEntrega,
    pisoPiloto: p.hasShowFlat ?? false,

    /* ─── Info básica ─── */
    direccionPromocion: direccion,

    /* ─── Multimedia ─── */
    fotos: deriveFotos(p.image),

    /* ─── Unidades ─── */
    unidades,

    /* ─── Plan de pagos · default razonable ─── */
    requiereReserva: (p.reservationCost ?? 0) > 0,
    importeReserva: p.reservationCost ?? 5000,
    metodoPago: (p.reservationCost ?? 0) > 0 ? "contrato" : null,

    /* ─── Colaboradores ─── */
    colaboracion,
    comisionInternacional: collab?.comisionInternacional ?? p.commission ?? 0,
    comisionNacional: collab?.comisionNacional ?? p.commission ?? 0,
    diferenciarNacionalInternacional: collab?.diferenciarNacionalInternacional ?? false,
    diferenciarComisiones: collab?.diferenciarComisiones ?? false,
    agenciasRefusarNacional: collab?.agenciasRefusarNacional ?? false,
    clasificacionCliente: collab?.clasificacionCliente ?? "residencia",
    formaPagoComision: collab?.formaPagoComision ?? null,
    hitosComision: collab?.hitosComision ?? [],
    ivaIncluido: collab?.ivaIncluido ?? false,
    condicionesRegistro: collab?.condicionesRegistro
      ?? defaultWizardState.condicionesRegistro,
    validezRegistroDias: collab?.validezRegistroDias
      ?? defaultWizardState.validezRegistroDias,
    modoValidacionRegistro: p.modoValidacionRegistro
      ?? defaultWizardState.modoValidacionRegistro,

    constructionProgressOverride: p.constructionProgress,
  };
}
