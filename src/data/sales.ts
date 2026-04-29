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
const RAW_SALES: Venta[] = [
  /* ─── RESERVADAS (7) ─── */
  {
    id: "v-001",
    registroId: "r-1045",
    promotionId: "1",
    unitId: "1-11A-2B",
    unitLabel: "11A · 2ºB · 3 hab · 112 m²",
    clienteNombre: "Hans Müller",
    clienteEmail: "h.mueller@example.de",
    clienteTelefono: "+49 176 2234 1198",
    clienteNacionalidad: "Alemania",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "reservada",
    fechaReserva: "2026-04-02",
    precioReserva: 6000,
    precioFinal: 612000,
    precioListado: 625000,
    descuentoAplicado: 13000,
    comisionPct: 5,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-04-28",
    nota: "Cliente con hipoteca pre-aprobada por Sabadell.",
    pagos: [
      { fecha: "2026-04-02", concepto: "Señal de reserva", importe: 6000 },
    ],
  },
  {
    id: "v-002",
    registroId: "r-1051",
    promotionId: "2",
    unitId: "2-11A-4A",
    unitLabel: "11A · 4ºA · 2 hab · 88 m²",
    clienteNombre: "Olivia Ramsay",
    clienteEmail: "olivia.r@example.co.uk",
    clienteTelefono: "+44 7700 900123",
    clienteNacionalidad: "Reino Unido",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "reservada",
    fechaReserva: "2026-04-11",
    precioReserva: 10000,
    precioFinal: 495000,
    precioListado: 495000,
    comisionPct: 4.5,
    comisionPagada: false,
    metodoPago: "contado",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-05-05",
    pagos: [
      { fecha: "2026-04-11", concepto: "Señal de reserva", importe: 10000 },
    ],
  },
  {
    id: "v-003",
    registroId: "r-1063",
    promotionId: "4",
    unitId: "4-11A-1C",
    unitLabel: "11A · 1ºC · 1 hab · 62 m²",
    clienteNombre: "Ana García",
    clienteEmail: "ana.garcia@example.es",
    clienteTelefono: "+34 654 332 119",
    clienteNacionalidad: "España",
    agencyId: null,
    agentName: "Arman (Promotor)",
    estado: "reservada",
    fechaReserva: "2026-04-14",
    precioReserva: 5000,
    precioFinal: 285000,
    precioListado: 290000,
    descuentoAplicado: 5000,
    comisionPct: 0,
    comisionPagada: true,
    metodoPago: "mixto",
    siguientePaso: "Aportar documentación bancaria",
    siguientePasoFecha: "2026-04-25",
    nota: "Venta directa sin agencia.",
    pagos: [
      { fecha: "2026-04-14", concepto: "Señal de reserva", importe: 5000 },
    ],
  },
  {
    id: "v-004",
    registroId: "r-1068",
    promotionId: "3",
    unitId: "3-11A-0A",
    unitLabel: "Villa G-04 · 4 hab · 220 m²",
    clienteNombre: "Sven Johansson",
    clienteEmail: "sven.j@example.se",
    clienteTelefono: "+46 70 123 45 67",
    clienteNacionalidad: "Suecia",
    agencyId: "ag-2",
    agentName: "Kristina Eriksson",
    estado: "reservada",
    fechaReserva: "2026-04-08",
    precioReserva: 25000,
    precioFinal: 1460000,
    precioListado: 1490000,
    descuentoAplicado: 30000,
    comisionPct: 6,
    comisionPagada: false,
    metodoPago: "contado",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-05-02",
    pagos: [
      { fecha: "2026-04-08", concepto: "Señal de reserva", importe: 25000 },
    ],
  },
  {
    id: "v-005",
    registroId: "r-1071",
    promotionId: "6",
    unitId: "6-11A-0A",
    unitLabel: "Villa 3 · 5 hab · 340 m²",
    clienteNombre: "Pierre Dubois",
    clienteEmail: "p.dubois@example.fr",
    clienteTelefono: "+33 6 12 34 56 78",
    clienteNacionalidad: "Francia",
    agencyId: "ag-3",
    agentName: "Thomas Janssen",
    estado: "reservada",
    fechaReserva: "2026-04-16",
    precioReserva: 15000,
    precioFinal: 1320000,
    precioListado: 1320000,
    comisionPct: 5.5,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Aportar tasación bancaria",
    siguientePasoFecha: "2026-05-10",
    pagos: [
      { fecha: "2026-04-16", concepto: "Señal de reserva", importe: 15000 },
    ],
  },
  {
    id: "v-006",
    registroId: "r-1074",
    promotionId: "dev-3",
    unitId: "dev-3-11A-2A",
    unitLabel: "11A · 2ºA · 2 hab · 78 m²",
    clienteNombre: "Nina Kowalski",
    clienteEmail: "n.kowalski@example.pl",
    clienteTelefono: "+48 601 234 567",
    clienteNacionalidad: "Polonia",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "reservada",
    fechaReserva: "2026-04-17",
    precioReserva: 5000,
    precioFinal: 345000,
    precioListado: 345000,
    comisionPct: 4,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-05-14",
    pagos: [
      { fecha: "2026-04-17", concepto: "Señal de reserva", importe: 5000 },
    ],
  },
  {
    id: "v-007",
    registroId: "r-1076",
    promotionId: "dev-5",
    unitId: "dev-5-11A-1B",
    unitLabel: "11A · 1ºB · 2 hab · 72 m²",
    clienteNombre: "Lars Andersen",
    clienteEmail: "lars.a@example.no",
    clienteTelefono: "+47 928 11 223",
    clienteNacionalidad: "Noruega",
    agencyId: "ag-2",
    agentName: "Kristina Eriksson",
    estado: "reservada",
    fechaReserva: "2026-04-18",
    precioReserva: 4000,
    precioFinal: 268000,
    precioListado: 275000,
    descuentoAplicado: 7000,
    comisionPct: 4,
    comisionPagada: false,
    metodoPago: "mixto",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-05-12",
    pagos: [
      { fecha: "2026-04-18", concepto: "Señal de reserva", importe: 4000 },
    ],
  },

  /* ─── CONTRATADAS (6) ─── */
  {
    id: "v-010",
    registroId: "r-0982",
    promotionId: "1",
    unitId: "1-11A-3A",
    unitLabel: "11A · 3ºA · 3 hab · 118 m²",
    clienteNombre: "Klaus Weber",
    clienteEmail: "k.weber@example.de",
    clienteTelefono: "+49 152 5512 9933",
    clienteNacionalidad: "Alemania",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "contratada",
    fechaReserva: "2026-02-21",
    fechaContrato: "2026-03-14",
    precioReserva: 6000,
    precioFinal: 655000,
    precioListado: 665000,
    descuentoAplicado: 10000,
    comisionPct: 5,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-06-18",
    pagos: [
      { fecha: "2026-02-21", concepto: "Señal de reserva", importe: 6000 },
      { fecha: "2026-03-14", concepto: "Pago a la firma de contrato", importe: 65500 },
    ],
  },
  {
    id: "v-011",
    registroId: "r-0995",
    promotionId: "2",
    unitId: "2-11A-3B",
    unitLabel: "11A · 3ºB · 3 hab · 105 m²",
    clienteNombre: "Charlotte Verhaegen",
    clienteEmail: "c.verhaegen@example.be",
    clienteTelefono: "+32 476 22 33 44",
    clienteNacionalidad: "Bélgica",
    agencyId: "ag-3",
    agentName: "Thomas Janssen",
    estado: "contratada",
    fechaReserva: "2026-01-30",
    fechaContrato: "2026-02-20",
    precioReserva: 10000,
    precioFinal: 720000,
    precioListado: 730000,
    descuentoAplicado: 10000,
    comisionPct: 4.5,
    comisionPagada: false,
    metodoPago: "contado",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-05-22",
    pagos: [
      { fecha: "2026-01-30", concepto: "Señal de reserva", importe: 10000 },
      { fecha: "2026-02-20", concepto: "Pago a la firma de contrato", importe: 206000 },
    ],
  },
  {
    id: "v-012",
    registroId: "r-0997",
    promotionId: "4",
    unitId: "4-11A-2B",
    unitLabel: "11A · 2ºB · 2 hab · 75 m²",
    clienteNombre: "Marco Rossi",
    clienteEmail: "marco.r@example.it",
    clienteTelefono: "+39 320 111 2233",
    clienteNacionalidad: "Italia",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "contratada",
    fechaReserva: "2026-02-05",
    fechaContrato: "2026-03-01",
    precioReserva: 5000,
    precioFinal: 395000,
    precioListado: 410000,
    descuentoAplicado: 15000,
    comisionPct: 4,
    comisionPagada: true,
    metodoPago: "hipoteca",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-07-04",
    pagos: [
      { fecha: "2026-02-05", concepto: "Señal de reserva", importe: 5000 },
      { fecha: "2026-03-01", concepto: "Pago a la firma de contrato", importe: 34500 },
    ],
  },
  {
    id: "v-013",
    registroId: "r-1004",
    promotionId: "6",
    unitId: "6-11A-1A",
    unitLabel: "Villa 1 · 4 hab · 290 m²",
    clienteNombre: "Daniel van Dijk",
    clienteEmail: "d.vandijk@example.nl",
    clienteTelefono: "+31 6 1234 5678",
    clienteNacionalidad: "Países Bajos",
    agencyId: "ag-3",
    agentName: "Thomas Janssen",
    estado: "contratada",
    fechaReserva: "2026-02-12",
    fechaContrato: "2026-03-22",
    precioReserva: 15000,
    precioFinal: 1150000,
    precioListado: 1180000,
    descuentoAplicado: 30000,
    comisionPct: 5.5,
    comisionPagada: false,
    metodoPago: "mixto",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-08-10",
    pagos: [
      { fecha: "2026-02-12", concepto: "Señal de reserva", importe: 15000 },
      { fecha: "2026-03-22", concepto: "Pago a la firma de contrato", importe: 100000 },
    ],
  },
  {
    id: "v-014",
    registroId: "r-1015",
    promotionId: "dev-2",
    unitId: "dev-2-11A-2A",
    unitLabel: "11A · 2ºA · 3 hab · 115 m²",
    clienteNombre: "Sofia Popescu",
    clienteEmail: "sofia.p@example.ro",
    clienteTelefono: "+40 723 112 445",
    clienteNacionalidad: "Rumanía",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "contratada",
    fechaReserva: "2026-03-04",
    fechaContrato: "2026-03-30",
    precioReserva: 8000,
    precioFinal: 790000,
    precioListado: 795000,
    descuentoAplicado: 5000,
    comisionPct: 5,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-07-25",
    pagos: [
      { fecha: "2026-03-04", concepto: "Señal de reserva", importe: 8000 },
      { fecha: "2026-03-30", concepto: "Pago a la firma de contrato", importe: 71000 },
    ],
  },
  {
    id: "v-015",
    registroId: "r-1021",
    promotionId: "dev-4",
    unitId: "dev-4-11A-1D",
    unitLabel: "11A · 1ºD · 2 hab · 82 m²",
    clienteNombre: "Isabel Moreno",
    clienteEmail: "isabel.m@example.es",
    clienteTelefono: "+34 610 554 887",
    clienteNacionalidad: "España",
    agencyId: null,
    agentName: "Arman (Promotor)",
    estado: "contratada",
    fechaReserva: "2026-02-18",
    fechaContrato: "2026-03-10",
    precioReserva: 5000,
    precioFinal: 412000,
    precioListado: 420000,
    descuentoAplicado: 8000,
    comisionPct: 0,
    comisionPagada: true,
    metodoPago: "hipoteca",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-06-30",
    nota: "Venta directa sin agencia.",
    pagos: [
      { fecha: "2026-02-18", concepto: "Señal de reserva", importe: 5000 },
      { fecha: "2026-03-10", concepto: "Pago a la firma de contrato", importe: 36200 },
    ],
  },

  /* ─── ESCRITURADAS (6) ─── */
  {
    id: "v-020",
    registroId: "r-0812",
    promotionId: "2",
    unitId: "2-11A-5B",
    unitLabel: "11A · 5ºB · Ático · 140 m²",
    clienteNombre: "Henrik Berg",
    clienteEmail: "h.berg@example.se",
    clienteTelefono: "+46 70 555 11 22",
    clienteNacionalidad: "Suecia",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "escriturada",
    fechaReserva: "2025-10-12",
    fechaContrato: "2025-11-08",
    fechaEscritura: "2026-04-03",
    precioReserva: 10000,
    precioFinal: 890000,
    precioListado: 920000,
    descuentoAplicado: 30000,
    comisionPct: 4.5,
    comisionPagada: true,
    metodoPago: "contado",
    pagos: [
      { fecha: "2025-10-12", concepto: "Señal de reserva", importe: 10000 },
      { fecha: "2025-11-08", concepto: "Pago a la firma de contrato", importe: 250000 },
      { fecha: "2026-04-03", concepto: "Pago final en escritura", importe: 630000 },
    ],
  },
  {
    id: "v-021",
    registroId: "r-0845",
    promotionId: "5",
    unitId: "5-11A-2A",
    unitLabel: "11A · 2ºA · 2 hab · 80 m²",
    clienteNombre: "Jakob Schmidt",
    clienteEmail: "j.schmidt@example.de",
    clienteTelefono: "+49 151 1122 8844",
    clienteNacionalidad: "Alemania",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "escriturada",
    fechaReserva: "2025-09-04",
    fechaContrato: "2025-10-15",
    fechaEscritura: "2026-04-08",
    precioReserva: 8000,
    precioFinal: 365000,
    precioListado: 365000,
    comisionPct: 3.5,
    comisionPagada: true,
    metodoPago: "hipoteca",
    pagos: [
      { fecha: "2025-09-04", concepto: "Señal de reserva", importe: 8000 },
      { fecha: "2025-10-15", concepto: "Pago a la firma de contrato", importe: 28500 },
      { fecha: "2026-04-08", concepto: "Pago final en escritura", importe: 328500 },
    ],
  },
  {
    id: "v-022",
    registroId: "r-0878",
    promotionId: "4",
    unitId: "4-11A-1A",
    unitLabel: "11A · 1ºA · 1 hab · 58 m²",
    clienteNombre: "Sara Nilsson",
    clienteEmail: "sara.n@example.se",
    clienteTelefono: "+46 70 999 22 11",
    clienteNacionalidad: "Suecia",
    agencyId: "ag-2",
    agentName: "Kristina Eriksson",
    estado: "escriturada",
    fechaReserva: "2025-11-20",
    fechaContrato: "2025-12-18",
    fechaEscritura: "2026-04-12",
    precioReserva: 5000,
    precioFinal: 272000,
    precioListado: 275000,
    descuentoAplicado: 3000,
    comisionPct: 4,
    comisionPagada: false,
    metodoPago: "hipoteca",
    pagos: [
      { fecha: "2025-11-20", concepto: "Señal de reserva", importe: 5000 },
      { fecha: "2025-12-18", concepto: "Pago a la firma de contrato", importe: 22000 },
      { fecha: "2026-04-12", concepto: "Pago final en escritura", importe: 245000 },
    ],
  },
  {
    id: "v-023",
    registroId: "r-0891",
    promotionId: "1",
    unitId: "1-11A-4C",
    unitLabel: "11A · 4ºC · 3 hab · 120 m²",
    clienteNombre: "Emily Thompson",
    clienteEmail: "emily.t@example.co.uk",
    clienteTelefono: "+44 7911 000555",
    clienteNacionalidad: "Reino Unido",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "escriturada",
    fechaReserva: "2025-09-28",
    fechaContrato: "2025-10-30",
    fechaEscritura: "2026-03-24",
    precioReserva: 6000,
    precioFinal: 710000,
    precioListado: 710000,
    comisionPct: 5,
    comisionPagada: true,
    metodoPago: "contado",
    pagos: [
      { fecha: "2025-09-28", concepto: "Señal de reserva", importe: 6000 },
      { fecha: "2025-10-30", concepto: "Pago a la firma de contrato", importe: 64000 },
      { fecha: "2026-03-24", concepto: "Pago final en escritura", importe: 640000 },
    ],
  },
  {
    id: "v-024",
    registroId: "r-0905",
    promotionId: "8",
    unitId: "8-11A-3B",
    unitLabel: "11A · 3ºB · 2 hab · 92 m²",
    clienteNombre: "Alexia Constantin",
    clienteEmail: "alexia.c@example.ro",
    clienteTelefono: "+40 744 002 331",
    clienteNacionalidad: "Rumanía",
    agencyId: "ag-3",
    agentName: "Thomas Janssen",
    estado: "escriturada",
    fechaReserva: "2025-08-15",
    fechaContrato: "2025-09-18",
    fechaEscritura: "2026-04-15",
    precioReserva: 12000,
    precioFinal: 680000,
    precioListado: 690000,
    descuentoAplicado: 10000,
    comisionPct: 4.5,
    comisionPagada: true,
    metodoPago: "hipoteca",
    pagos: [
      { fecha: "2025-08-15", concepto: "Señal de reserva", importe: 12000 },
      { fecha: "2025-09-18", concepto: "Pago a la firma de contrato", importe: 56000 },
      { fecha: "2026-04-15", concepto: "Pago final en escritura", importe: 612000 },
    ],
  },
  {
    id: "v-025",
    registroId: "r-0917",
    promotionId: "dev-2",
    unitId: "dev-2-11A-1B",
    unitLabel: "11A · 1ºB · 3 hab · 118 m²",
    clienteNombre: "Victor Olsen",
    clienteEmail: "victor.o@example.dk",
    clienteTelefono: "+45 22 33 44 55",
    clienteNacionalidad: "Dinamarca",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "escriturada",
    fechaReserva: "2025-10-02",
    fechaContrato: "2025-11-06",
    fechaEscritura: "2026-04-18",
    precioReserva: 8000,
    precioFinal: 825000,
    precioListado: 830000,
    descuentoAplicado: 5000,
    comisionPct: 5,
    comisionPagada: false,
    metodoPago: "contado",
    pagos: [
      { fecha: "2025-10-02", concepto: "Señal de reserva", importe: 8000 },
      { fecha: "2025-11-06", concepto: "Pago a la firma de contrato", importe: 74500 },
      { fecha: "2026-04-18", concepto: "Pago final en escritura", importe: 742500 },
    ],
  },

  /* ─── CAÍDAS (3) ─── */
  {
    id: "v-030",
    registroId: "r-0944",
    promotionId: "3",
    unitId: "3-11A-0B",
    unitLabel: "Villa G-07 · 4 hab · 235 m²",
    clienteNombre: "Yuri Volkov",
    clienteEmail: "yuri.v@example.ru",
    clienteTelefono: "+7 921 555 1234",
    clienteNacionalidad: "Rusia",
    agencyId: "ag-2",
    agentName: "Erik Lindqvist",
    estado: "caida",
    fechaReserva: "2026-01-18",
    fechaCaida: "2026-03-02",
    precioReserva: 25000,
    precioFinal: 1520000,
    precioListado: 1520000,
    comisionPct: 6,
    comisionPagada: false,
    metodoPago: "contado",
    nota: "Hipoteca denegada, el cliente retira la reserva. Señal no reembolsable retenida.",
    pagos: [
      { fecha: "2026-01-18", concepto: "Señal de reserva", importe: 25000 },
    ],
  },
  {
    id: "v-031",
    registroId: "r-0960",
    promotionId: "4",
    unitId: "4-11A-2A",
    unitLabel: "11A · 2ºA · 3 hab · 90 m²",
    clienteNombre: "Thomas Fischer",
    clienteEmail: "t.fischer@example.de",
    clienteTelefono: "+49 171 3344 5566",
    clienteNacionalidad: "Alemania",
    agencyId: "ag-1",
    agentName: "Marta Jiménez",
    estado: "caida",
    fechaReserva: "2026-02-24",
    fechaCaida: "2026-03-28",
    precioReserva: 5000,
    precioFinal: 458000,
    precioListado: 460000,
    descuentoAplicado: 2000,
    comisionPct: 4,
    comisionPagada: false,
    metodoPago: "hipoteca",
    nota: "Cliente cambia de opinión antes de la firma de contrato. Se devuelve señal íntegra.",
    pagos: [
      { fecha: "2026-02-24", concepto: "Señal de reserva", importe: 5000 },
      { fecha: "2026-03-28", concepto: "Devolución de señal", importe: -5000 },
    ],
  },
  {
    id: "v-032",
    registroId: "r-0968",
    promotionId: "dev-5",
    unitId: "dev-5-11A-2C",
    unitLabel: "11A · 2ºC · 2 hab · 74 m²",
    clienteNombre: "Mikhail Ivanov",
    clienteEmail: "m.ivanov@example.ru",
    clienteTelefono: "+7 911 222 3344",
    clienteNacionalidad: "Rusia",
    agencyId: "ag-3",
    agentName: "Thomas Janssen",
    estado: "caida",
    fechaReserva: "2026-02-02",
    fechaCaida: "2026-04-10",
    precioReserva: 4000,
    precioFinal: 295000,
    precioListado: 300000,
    descuentoAplicado: 5000,
    comisionPct: 4,
    comisionPagada: false,
    metodoPago: "hipoteca",
    nota: "Problemas bancarios para transferir fondos. Operación cancelada.",
    pagos: [
      { fecha: "2026-02-02", concepto: "Señal de reserva", importe: 4000 },
      { fecha: "2026-04-10", concepto: "Devolución de señal", importe: -4000 },
    ],
  },
  /* ─── Ventas de ag-4 (Meridian) · histórico antes del fin de
   *  contrato. Estado "expired" en agencies.ts permite ver operaciones
   *  cerradas y caídas en el CRM de James/Olivia. ─────────────────── */
  {
    id: "v-040-m",
    registroId: "reg-024-m",
    promotionId: "1",
    unitId: "1-12B-3A",
    unitLabel: "12B · 3ºA · 2 hab · 96 m²",
    clienteNombre: "Charles Pemberton",
    clienteEmail: "c.pemberton@btinternet.com",
    clienteTelefono: "+44 7700 900245",
    clienteNacionalidad: "Reino Unido",
    agencyId: "ag-4",
    agentName: "James Whitfield",
    estado: "escriturada",
    fechaReserva: "2025-12-15",
    fechaContrato: "2026-01-20",
    fechaEscritura: "2026-03-12",
    precioReserva: 8000,
    precioFinal: 545000,
    precioListado: 560000,
    descuentoAplicado: 15000,
    comisionPct: 3,
    comisionPagada: true,
    metodoPago: "hipoteca",
    pagos: [
      { fecha: "2025-12-15", concepto: "Señal de reserva", importe: 8000 },
      { fecha: "2026-01-20", concepto: "Pago a la firma del CPV", importe: 100000 },
      { fecha: "2026-03-12", concepto: "Escritura · resto", importe: 437000 },
    ],
  },
  {
    id: "v-041-m",
    registroId: "reg-025-m",
    promotionId: "2",
    unitId: "2-3F-1B",
    unitLabel: "3F · 1ºB · 2 hab · 88 m²",
    clienteNombre: "Margaret Ashworth",
    clienteEmail: "m.ashworth@gmail.com",
    clienteTelefono: "+44 7984 112233",
    clienteNacionalidad: "Reino Unido",
    agencyId: "ag-4",
    agentName: "Olivia Carter",
    estado: "contratada",
    fechaReserva: "2026-01-10",
    fechaContrato: "2026-02-15",
    precioReserva: 6000,
    precioFinal: 412000,
    precioListado: 420000,
    descuentoAplicado: 8000,
    comisionPct: 3,
    comisionPagada: false,
    metodoPago: "contado",
    siguientePaso: "Escritura pública",
    siguientePasoFecha: "2026-05-20",
    pagos: [
      { fecha: "2026-01-10", concepto: "Señal de reserva", importe: 6000 },
      { fecha: "2026-02-15", concepto: "Pago a la firma del CPV", importe: 80000 },
    ],
  },
  {
    id: "v-042-m",
    registroId: "reg-027-m",
    promotionId: "3",
    unitId: "3-7A-2C",
    unitLabel: "7A · 2ºC · 3 hab · 124 m²",
    clienteNombre: "Niamh O'Sullivan",
    clienteEmail: "niamh.osullivan@hotmail.com",
    clienteTelefono: "+353 87 555 4321",
    clienteNacionalidad: "Irlanda",
    agencyId: "ag-4",
    agentName: "James Whitfield",
    estado: "reservada",
    fechaReserva: "2026-02-25",
    precioReserva: 5000,
    precioFinal: 375000,
    precioListado: 385000,
    descuentoAplicado: 10000,
    comisionPct: 3,
    comisionPagada: false,
    metodoPago: "hipoteca",
    siguientePaso: "Firma de contrato privado",
    siguientePasoFecha: "2026-04-30",
    pagos: [
      { fecha: "2026-02-25", concepto: "Señal de reserva", importe: 5000 },
    ],
  },
];

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
const SALES_ACTORS: Record<string, Array<{ id: string; name: string; email: string }>> = {
  "ag-1": [
    { id: "u-agency-ag-1-laura@primeproperties.com", name: "Laura Sánchez", email: "laura@primeproperties.com" },
    { id: "u-agency-ag-1-tom@primeproperties.com",   name: "Tom Brennan",    email: "tom@primeproperties.com" },
  ],
  "ag-2": [
    { id: "u-agency-ag-2-erik@nordichomefinders.com", name: "Erik Lindqvist", email: "erik@nordichomefinders.com" },
    { id: "u-agency-ag-2-anna@nordichomefinders.com", name: "Anna Bergström", email: "anna@nordichomefinders.com" },
  ],
  "ag-3": [
    { id: "u-agency-ag-3-pieter@dutchbelgianrealty.com", name: "Pieter De Vries", email: "pieter@dutchbelgianrealty.com" },
    { id: "u-agency-ag-3-sander@dutchbelgianrealty.com", name: "Sander Janssen",   email: "sander@dutchbelgianrealty.com" },
  ],
  "ag-4": [
    { id: "u-agency-ag-4-james@meridianrealestate.co.uk",  name: "James Whitfield", email: "james@meridianrealestate.co.uk" },
    { id: "u-agency-ag-4-olivia@meridianrealestate.co.uk", name: "Olivia Carter",    email: "olivia@meridianrealestate.co.uk" },
  ],
  "ag-5": [
    { id: "u-agency-ag-5-joao@iberialuxuryhomes.pt", name: "João Almeida", email: "joao@iberialuxuryhomes.pt" },
    { id: "u-agency-ag-5-ines@iberialuxuryhomes.pt", name: "Inês Costa",    email: "ines@iberialuxuryhomes.pt" },
  ],
};

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
