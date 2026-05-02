/**
 * Ventas · mock de datos
 *
 * QUÉ: dataset de ventas/reservas de un promotor. Cada `Venta` se origina de
 * un registro aprobado (futura integración con `Registros`) + una unidad
 * concreta de una promoción. Representa el pipeline de formalización:
 * reserva firmada → contrato privado de compraventa → escritura pública.
 *
 * CÓMO: `sales` se consume en `src/pages/Ventas.tsx`. Los datos cruzan con
 * `promotions` / `developerPromotions` (nombre promoción, location) y con
 * `agencies` (nombre agencia que vendió). Los IDs de unidad referencian
 * `unitsByPromotion[promotionId]` aunque no es obligatorio que existan
 * — en ese caso la vista compone el label legible a partir de los campos.
 *
 * TODO(backend): GET /api/sales?promotionId=&status=&from=&to=
 * TODO(backend): PATCH /api/sales/:id/transition  → avanza estado y ajusta fechas/importes
 * TODO(logic): la comisión se calcula como `precioFinal * comisionPct`; queda
 *   pendiente (ver docs/open-questions.md Qnueva) si el IVA se excluye y si
 *   los hitos parciales afectan al "comisionPagada" bool o requieren un
 *   modelo de `Pago[]` aparte.
 */

export type VentaEstado = "reservada" | "contratada" | "escriturada" | "caida";
export type MetodoPago = "contado" | "hipoteca" | "mixto";

export type Venta = {
  id: string;
  /** Referencia al registro de `Registros` que originó la venta (cuando se conecte). */
  registroId?: string;
  promotionId: string;
  /** `unit.id` si la unidad existe en `unitsByPromotion`. Si no, un label libre. */
  unitId: string;
  /** Label legible de la unidad (ej. "11A-2B · 3 hab") — no depende de que exista la unidad en mock. */
  unitLabel: string;
  clienteNombre: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  clienteNacionalidad?: string;
  /** Agencia que cerró la venta. `null` si fue venta directa del promotor. */
  agencyId: string | null;
  agentName: string;
  estado: VentaEstado;
  fechaReserva: string;     // ISO yyyy-mm-dd
  fechaContrato?: string;   // ISO — se fija al entrar a "contratada"
  fechaEscritura?: string;  // ISO — se fija al entrar a "escriturada"
  fechaCaida?: string;      // ISO — se fija al entrar a "caida"
  precioReserva: number;    // señal pagada al reservar
  precioFinal: number;      // precio final acordado (tras descuentos)
  precioListado: number;    // precio de tarifa
  descuentoAplicado?: number; // € de descuento vs listado
  comisionPct: number;      // % bruto sobre precioFinal
  comisionPagada: boolean;
  metodoPago: MetodoPago;
  /** Hito siguiente (ej. "Firma contrato", "Entrega llaves"). */
  siguientePaso?: string;
  siguientePasoFecha?: string;
  nota?: string;
  /** Historial de pagos recibidos del cliente hasta la fecha. */
  pagos: Array<{
    fecha: string;
    concepto: string;
    importe: number;
  }>;
  /** Huella de quién creó / cerró la venta · alimenta el filtro
   *  viewOwn (member solo ve las suyas). Si falta, member no la ve. */
  audit?: import("@/lib/audit").ActionFingerprint;
};

/* ══════════════════════════════════════════════════════════════════
   Dataset mock — 22 ventas, distribuidas por estado.
   `RAW_SALES` se enriquece con `audit.actor` determinístico (ver
   `enrichSeedSales` al final del archivo) para que el filtro
   viewOwn / viewAll funcione · CLAUDE.md `permissions.md`.
   ══════════════════════════════════════════════════════════════════ */
const RAW_SALES: Venta[] = [];

/* ══════════════════════════════════════════════════════════════════
   Helpers puros (sin React)
   ══════════════════════════════════════════════════════════════════ */

export const estadoLabel: Record<VentaEstado, string> = {
  reservada: "Reservada",
  contratada: "Contratada",
  escriturada: "Escriturada",
  caida: "Caída",
};

export const metodoPagoLabel: Record<MetodoPago, string> = {
  contado: "Contado",
  hipoteca: "Hipoteca",
  mixto: "Mixto",
};

/** Comisión bruta en € de una venta (sin restar IVA; ver open-questions Qnueva). */
export function getComisionImporte(v: Venta): number {
  return Math.round(v.precioFinal * (v.comisionPct / 100));
}

/** Una venta cuenta como "del mes M" según su fecha principal por estado. */
export function getFechaReferencia(v: Venta): string {
  switch (v.estado) {
    case "escriturada":
      return v.fechaEscritura ?? v.fechaContrato ?? v.fechaReserva;
    case "contratada":
      return v.fechaContrato ?? v.fechaReserva;
    case "caida":
      return v.fechaCaida ?? v.fechaReserva;
    case "reservada":
    default:
      return v.fechaReserva;
  }
}

/* ─── Atribución determinística de actores · alimenta viewOwn ──── */
const SALES_ACTORS: Record<string, Array<{ id: string; name: string; email: string }>> = {};

function enrichSeedSales(seeds: Venta[]): Venta[] {
  return seeds.map((s) => {
    if (s.audit) return s;
    const numMatch = s.id.match(/(\d+)$/);
    const idx = numMatch ? parseInt(numMatch[1], 10) : 0;
    const pool = s.agencyId ? SALES_ACTORS[s.agencyId] : undefined;
    if (!pool || pool.length === 0) return s;
    const actor = pool[idx % pool.length];
    const audit: import("@/lib/audit").ActionFingerprint = {
      v: 1,
      capturedAt: s.fechaReserva,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      platform: "MacIntel",
      language: "es-ES",
      timezone: "Europe/Madrid",
      timezoneOffset: -60,
      screen: { width: 1920, height: 1080, pixelRatio: 2 },
      viewport: { width: 1440, height: 900 },
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: "agency",
        agencyId: s.agencyId ?? undefined,
      },
    };
    return { ...s, audit };
  });
}

/** Dataset final · `RAW_SALES` con `audit.actor` añadido. */
export const sales: Venta[] = enrichSeedSales(RAW_SALES);
