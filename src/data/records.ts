/**
 * records.ts · Mock de registros (leads entrantes de agencias o directos)
 *
 * QUÉ
 * ----
 * Fuente de datos mock para la pantalla `/registros` (src/pages/Registros.tsx).
 * Un "Registro" representa la solicitud de apartar un cliente potencial
 * sobre una promoción concreta. Puede tener dos orígenes (`origen`):
 *   · `"collaborator"` → lo envía una agencia colaboradora (caso clásico).
 *   · `"direct"`       → lo crea el propio promotor (cliente que le llega
 *                        directamente, sin agencia intermediaria).
 * Es el núcleo del diferencial IA de duplicados (ver `docs/product.md` y
 * `docs/data-model.md`).
 *
 * CÓMO
 * ----
 * - `promotionId` referencia a `src/data/promotions.ts`.
 * - `agencyId`    referencia a `src/data/agencies.ts`. Solo obligatorio
 *   cuando `origen === "collaborator"`; en directos es undefined.
 * - `matchPercentage` (0-100) lo calcula el detector de duplicados:
 *     < 30%  → limpio (aprobación fluida)
 *     30-69% → ambiguo (promotor decide con comparación lado-a-lado)
 *     >= 70% → muy probable duplicado (se recomienda rechazar)
 * - `matchWith` es el ID/descripción del contacto o registro con el que
 *   colisiona, para poder mostrar la comparación.
 *
 * Ver también: `docs/screens/registros.md`.
 *
 * TODO(backend): GET /api/records — paginado, filtrado server-side.
 * TODO(logic): cuando exista IA real, el `matchPercentage` y `matchWith`
 *   vendrán del backend; el frontend solo los renderiza.
 */

/**
 * Estados del Registro.
 *
 *   · pendiente            · esperando decisión del owningParty.
 *   · preregistro_activo   · aprobado en modo `por_visita` ·
 *                            esperando que la visita se realice.
 *   · aprobado             · cliente formalmente registrado.
 *   · rechazado            · rechazado por el owningParty.
 *   · duplicado            · first-come silent · otro lo registró antes.
 *   · caducado             · preregistro_activo cuya visita fue cancelada
 *                            o cuyo plazo expiró sin realizarse · cliente
 *                            queda libre para que otra agencia lo registre.
 *
 * Phase 2 · estado `desplazado` (perdió por visita ajena · ver
 * `docs/registration-system.md §2`) · pendiente.
 */
export type RegistroEstado =
  | "pendiente"
  | "preregistro_activo"
  | "aprobado"
  | "rechazado"
  | "duplicado"
  | "caducado";

/**
 * Outcome de la visita asociada al registro · solo aplica cuando
 * `tipo === "registration_visit"` y el registro pasó por
 * `preregistro_activo`. Determina cómo se transita el estado:
 *
 *   · realizada            → preregistro_activo → aprobado
 *   · no_show_cliente      → preregistro_activo → caducado (cliente desistió)
 *   · cancelada_agencia    → preregistro_activo → caducado (agencia renuncia · pesa en track record)
 *   · cancelada_promotor   → preregistro_activo → caducado (motivo del lado anfitrión · NO penaliza agencia)
 *   · reprogramada         → preregistro_activo (mantiene · solo cambia visitDate · max 2 veces)
 */
export type VisitOutcome =
  | "realizada"
  | "no_show_cliente"
  | "cancelada_agencia"
  | "cancelada_promotor"
  | "reprogramada";

/**
 * Origen del registro.
 *
 * - `"direct"`        → lo da de alta el promotor en la ficha de promoción
 *                       usando "Registrar cliente · Directo". No hay agencia.
 * - `"collaborator"`  → lo envía una agencia colaboradora (solicitud entrante
 *                       que requiere aprobación del promotor + IA duplicados).
 *
 * Diferencias de flujo:
 * - Un `direct` normalmente no requiere aprobación (lo mete el propio promotor)
 *   pero sí pasa por el detector de duplicados para avisar de colisiones.
 * - Un `collaborator` arranca en `pendiente` y siempre requiere decisión.
 */
export type RegistroOrigen = "direct" | "collaborator";

export type RegistroCliente = {
  nombre: string;
  /** Email del cliente · OPCIONAL. Solo se captura si la promoción
   *  incluye `"email_completo"` en `CondicionRegistro`. En flujos
   *  colaborador, la UI lo enmascara hasta que el promotor aprueba. */
  email?: string;
  telefono: string;
  /** DNI / NIE / pasaporte — OPCIONAL en fase registro. Solo se exige
   *  en la transición a reserva (minimización GDPR · menor fricción
   *  inicial). `CondicionRegistro` en `types/promotion-config.ts` ya
   *  excluye "dni" de las opciones configurables por el promotor. */
  dni?: string;
  /** Nacionalidad en español · "Británica", "Francés", etc. */
  nacionalidad: string;
  /** ISO 3166-1 alpha-2 del país. Alimenta `<Flag iso={cliente.nationalityIso} />`
   *  en `src/components/ui/Flag.tsx` (SVG local desde `public/flags/`).
   *  Si el seed no lo trae, `resolveNationality(nacionalidad)` lo deriva.
   *  NUNCA emoji · Windows no renderiza regional indicators. */
  nationalityIso?: string;
};

/**
 * Tipo de registro:
 *   - "registration"        → solicitud sólo de registro (apartado).
 *   - "registration_visit"  → registro + visita programada solicitada.
 *   - "visit_only"          → SOLO visita · el cliente ya estaba
 *                              registrado previamente (aprobado) y
 *                              ahora se propone una visita nueva.
 *                              Salta todos los checks de cliente y
 *                              pasa directo al flujo de visita.
 */
export type RegistroTipo = "registration" | "registration_visit" | "visit_only";

/**
 * Relación posible detectada por el backend al cruzar el cliente
 * entrante con el CRM del promotor. Permite avisar de vínculos que
 * el agente podría no conocer (pareja, familiar) antes de aprobar el
 * registro · si se confirma, queda como relación en la ficha del
 * contacto (bidireccional).
 *
 * TODO(backend): detectar automáticamente a partir de coincidencias
 * de dirección + apellido + teléfonos compartidos + registros
 * anteriores cruzados. Ver `docs/backend-integration.md`.
 */
export type PossibleRelation = {
  /** Nombre del contacto/cliente existente · datos sensibles solo
   *  visibles con `records.matchDetails.view`. */
  contactName: string;
  /** Id del contacto existente (para linkar bidireccional). */
  contactId?: string;
  /** Tipo de relación sugerida: "pareja" | "familiar" | "socio" | ... */
  relation: string;
  /** Confianza 0-100. A partir de 70% se muestra el aviso. */
  confidence: number;
  /** Motivos que dispararon la detección (ej. "Mismo teléfono
   *  registrado en ficha", "Mismo apellido y dirección"). */
  reasons: string[];
};

/**
 * Evento del ciclo de vida del Registro · ActivityTimeline.
 *
 * Lifecycle típico:
 *   1. submitted          — la agencia envía la solicitud.
 *   2. auto_check         — la IA de duplicados ejecuta la comparación.
 *   3. decision           — el promotor aprueba/rechaza/pide info.
 *   4. notification       — la agencia recibe la notificación
 *                           (con grace period de 5 min para revertir).
 *   5. sent_to_developer  — el cliente queda registrado en la promoción.
 */
export type RegistroTimelineEvent = {
  id: string;
  type: "submitted" | "auto_check" | "decision" | "notification" | "sent_to_developer";
  title: string;
  description?: string;
  timestamp: string;          // ISO
  status: "completed" | "active" | "pending";
  actor?: string;             // quién lo disparó (usuario o "Sistema")
  actorRole?: string;
  /** Para decisiones, qué se decidió. */
  decisionType?: "approved" | "declined" | "info_requested";
  decisionReason?: string;
  /** Cuánto tardó (ej. "1h 24min") · para events de tipo decision. */
  responseTime?: string;
  /** Cuánto lleva esperando · para events active. */
  waitingDuration?: string;
};

export type Registro = {
  id: string;
  /** Referencia pública del registro · formato `reXXXXXX` · inmutable
   *  durante toda la vida del registro (mantiene la misma ref al
   *  transitar entre `pendiente → preregistro_activo → aprobado`).
   *  Único por organización · uso humano solo. UUID `id` sigue siendo
   *  PK técnica. Ver `docs/public-references-audit.md`. */
  publicRef: string;
  /** "registration" por defecto · "registration_visit" si la solicitud
   *  incluye proponer una visita. */
  tipo?: RegistroTipo;
  /** Origen del registro (directo vs. a través de colaborador). */
  origen: RegistroOrigen;
  /** FK → src/data/promotions.ts::Promotion.id */
  promotionId: string;
  /**
   * FK → src/data/agencies.ts::Agency.id.
   * Obligatorio cuando `origen === "collaborator"`, undefined cuando es directo.
   */
  agencyId?: string;
  cliente: RegistroCliente;
  /** ISO 8601 (se formatea con date-fns/formatDistanceToNow en la UI). */
  fecha: string;
  estado: RegistroEstado;
  /** 0-100. 0 = sin duplicado detectado. */
  matchPercentage: number;
  /**
   * Descripción humana del candidato a duplicado (nombre del contacto
   * existente o id de registro previo). Undefined si matchPercentage === 0.
   */
  matchWith?: string;
  /**
   * Datos del contacto/registro con el que colisiona, para mostrar la
   * comparación lado-a-lado sin tener que hacer otra búsqueda.
   */
  matchCliente?: Partial<RegistroCliente>;
  /** Recomendación textual de la IA (ej. "Aprobar · sin coincidencias"). */
  recommendation?: string;
  /** Solo si tipo === "registration_visit". Fecha + hora propuesta. */
  visitDate?: string;        // YYYY-MM-DD
  visitTime?: string;        // HH:mm
  /** Tiempo de respuesta del promotor (ej. "1h 24min") · derivado por backend. */
  responseTime?: string;
  /** Id del miembro (TEAM_MEMBERS) que tomó la decisión · fuente única.
   *  El nombre/cargo se resuelven en render vía `findTeamMember()`. */
  decidedByUserId?: string;
  /** LEGACY · snapshot del nombre cuando se decidió. Se mantiene como
   *  fallback histórico cuando el miembro original ha sido eliminado
   *  o cuando no hay id (registros antiguos, decisiones automáticas). */
  decidedBy?: string;
  /** LEGACY · snapshot del cargo. Mismo motivo que `decidedBy`. */
  decidedByRole?: string;
  decisionNote?: string;
  /** ISO · cuándo se decidió. Sirve para el GracePeriodBanner (5min). */
  decidedAt?: string;
  /** Audit log de eventos del ciclo de vida del registro. */
  timeline?: RegistroTimelineEvent[];
  notas?: string;
  /** El agente marca haber obtenido el consentimiento RGPD del cliente. */
  consent: boolean;
  /** Origen del cliente (solo promotor directo): "Idealista", "Referido",
   *  "Web propia", etc. Undefined en flujos colaborador (el origen es la
   *  propia agencia). */
  origenCliente?: string;
  /** Huella digital capturada en el momento de crear el registro — quién,
   *  cuándo, dispositivo, zona horaria, versión de términos aceptada.
   *  Se populará con `captureFingerprint()` (ver `src/lib/audit.ts`). */
  audit?: import("@/lib/audit").ActionFingerprint;
  /** Relación posible detectada por el backend (pareja, familiar). Si
   *  aparece, el flujo de aprobación la confirma/descarta antes de
   *  marcar el registro como aprobado. */
  possibleRelation?: PossibleRelation;
  /** Id del registro original · solo en `tipo === "visit_only"` · el
   *  cliente ya fue aprobado en ese registro. */
  originRegistroId?: string;
  /** Resultado final de la visita asociada · marca la transición de
   *  estado al ejecutarse. Undefined hasta que se evalúa la visita. */
  visitOutcome?: VisitOutcome;
  /** Cuántas veces se ha reprogramado la visita · cap a 2 (Phase 1).
   *  TODO(backend): persistir + validar server-side el cap. */
  reprogramacionesCount?: number;
  /** Motivo de la última cancelación / reprogramación · libre. */
  visitNote?: string;
  /** ISO · cuándo se evaluó la visita (realizada/cancelada/reprogramada).
   *  Sirve para mostrar "Caducado hace X días" en UI. */
  visitOutcomeAt?: string;
  /** Auditoría legal de los términos aceptados al aprobar. Versionado
   *  vive en `src/lib/legalTerms.ts`. Permite probar ante disputa
   *  qué versión se firmó y cuándo. */
  approvedTermsVersion?: string;
  approvedTermsAt?: string;
  approvedTermsByUserId?: string;
  /** Override · cuando el promotor aprueba a pesar de matchPercentage
   *  ≥70%. Justificación obligatoria queda en historial cross-empresa
   *  para auditar disputas futuras de comisión. (Phase 2 Bloque H) */
  overrideNote?: string;
  overrideAt?: string;
  overrideByUserId?: string;
  /* TODO(fase-2) · "Pedir más datos a la agencia". No es un one-shot
   * sino un thread bidireccional · hay que decidir canal (in-app /
   * email híbrido tipo Intercom/Stripe / WhatsApp). Ver nota abajo.
   *
   *   infoRequests?: Array<{
   *     id: string;
   *     at: string;
   *     by: { userId: string; name: string };
   *     message: string;
   *     response?: { at: string; by: { userId: string; name: string }; message: string };
   *   }>;
   *
   * Cada mensaje dispara evento en timeline del registro + del
   * contacto (regla CLAUDE.md §🥇). Notificación entrega via email
   * + WhatsApp + bell in-app. Mientras hay requests abiertas, la
   * card pinta un pill "Info pedida" en vez de "Pendiente". */
};

/* ═══════════════════════════════════════════════════════════════════
   Helpers de fecha: minutos/horas/días atrás desde HOY.
   ═══════════════════════════════════════════════════════════════════ */
const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

/* ═══════════════════════════════════════════════════════════════════
   Mocks — mezcla variada de limpios, ambiguos y duplicados claros.

   BACKFILL · Phase 1 Core
     Cada seed se escribe sin `publicRef` y el wrapper
     `enrichLegacyRegistroSeed` lo asigna ordenado por fecha ASC ·
     evita reescribir ~25 entries a mano.
   ═══════════════════════════════════════════════════════════════════ */

type LegacyRegistroSeed = Omit<Registro, "publicRef">;

/* ─── Atribución determinística de actores por agencia ────────────
 *  Cada registro del seed se atribuye automáticamente a un usuario
 *  mock concreto (admin o member alternados según paridad del id),
 *  para que el filtro viewOwn funcione · CLAUDE.md `permissions.md`
 *  · cada member debe ver solo lo suyo.
 *
 *  Mapping fijo · si en mockUsers se añaden más miembros, ampliar.
 *  Los registros sin agencia (`origen: "direct"`) se atribuyen al
 *  promotor admin (Arman). */
const ACTORS_BY_AGENCY: Record<string, Array<{ id: string; name: string; email: string }>> = {
  /* ag-1 · Prime Properties */
  "ag-1": [
    { id: "u-agency-ag-1-laura@primeproperties.com", name: "Laura Sánchez",  email: "laura@primeproperties.com" },
    { id: "u-agency-ag-1-tom@primeproperties.com",   name: "Tom Brennan",     email: "tom@primeproperties.com" },
  ],
  /* ag-2 · Nordic Home Finders */
  "ag-2": [
    { id: "u-agency-ag-2-erik@nordichomefinders.com", name: "Erik Lindqvist", email: "erik@nordichomefinders.com" },
    { id: "u-agency-ag-2-anna@nordichomefinders.com", name: "Anna Bergström", email: "anna@nordichomefinders.com" },
  ],
  /* ag-3 · Dutch & Belgian Realty */
  "ag-3": [
    { id: "u-agency-ag-3-pieter@dutchbelgianrealty.com", name: "Pieter De Vries", email: "pieter@dutchbelgianrealty.com" },
    { id: "u-agency-ag-3-sander@dutchbelgianrealty.com", name: "Sander Janssen",   email: "sander@dutchbelgianrealty.com" },
  ],
  /* ag-4 · Meridian Real Estate */
  "ag-4": [
    { id: "u-agency-ag-4-james@meridianrealestate.co.uk",  name: "James Whitfield", email: "james@meridianrealestate.co.uk" },
    { id: "u-agency-ag-4-olivia@meridianrealestate.co.uk", name: "Olivia Carter",    email: "olivia@meridianrealestate.co.uk" },
  ],
  /* ag-5 · Iberia Luxury Homes */
  "ag-5": [
    { id: "u-agency-ag-5-joao@iberialuxuryhomes.pt",  name: "João Almeida", email: "joao@iberialuxuryhomes.pt" },
    { id: "u-agency-ag-5-ines@iberialuxuryhomes.pt",  name: "Inês Costa",    email: "ines@iberialuxuryhomes.pt" },
  ],
};
const PROMOTER_ADMIN = { id: "u1", name: "Arman Rahmanov", email: "arman@byvaro.com" };

function buildSeedAudit(
  s: LegacyRegistroSeed,
): import("@/lib/audit").ActionFingerprint | undefined {
  if (s.audit) return s.audit; // si el seed lo trae explícito, no lo sobrescribimos
  /* Pickeamos actor según paridad del id numérico del registro · así el
   * mismo seed siempre se atribuye al mismo user · estable. */
  const numMatch = s.id.match(/(\d+)$/);
  const idx = numMatch ? parseInt(numMatch[1], 10) : 0;
  let actor: { id: string; name: string; email: string };
  let role: "developer" | "agency";
  if (s.origen === "direct" || !s.agencyId) {
    actor = PROMOTER_ADMIN;
    role = "developer";
  } else {
    const pool = ACTORS_BY_AGENCY[s.agencyId];
    if (!pool || pool.length === 0) return undefined;
    actor = pool[idx % pool.length];
    role = "agency";
  }
  return {
    v: 1,
    capturedAt: s.fecha,
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
      role,
      agencyId: role === "agency" ? s.agencyId : undefined,
    },
  };
}

function enrichLegacyRegistroSeeds(seeds: LegacyRegistroSeed[]): Registro[] {
  /* Asignamos publicRef por orden cronológico ASC (el más antiguo es
     re000001) · así futuros registros nuevos siempre tienen ref mayor.
     Y atribuimos audit.actor determinísticamente para que viewOwn
     funcione (member solo ve los suyos). */
  const sorted = [...seeds].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );
  const refMap = new Map<string, string>();
  sorted.forEach((s, i) => {
    refMap.set(s.id, `re${String(i + 1).padStart(6, "0")}`);
  });
  return seeds.map((s) => ({
    ...s,
    publicRef: refMap.get(s.id)!,
    audit: s.audit ?? buildSeedAudit(s),
  }));
}

const RAW_REGISTROS: LegacyRegistroSeed[] = [
  /* ───── Limpios (matchPercentage = 0) ───── */
  {
    id: "reg-001",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-1",
    cliente: {
      nombre: "Émilie Rousseau",
      email: "emilie.rousseau@gmail.com",
      telefono: "+33 6 12 34 56 78",
      dni: "FR-21837291",
      nacionalidad: "Francia",
      nationalityIso: "FR",
    },
    fecha: minsAgo(14),
    estado: "pendiente",
    matchPercentage: 0,
    recommendation: "Apto para aprobación directa · sin coincidencias.",
    consent: true,
    notas: "Buscando ático con vistas al mar, presupuesto hasta 1.2M€.",
  },
  {
    id: "reg-002",
    tipo: "registration_visit",
    visitDate: "2026-04-28",
    visitTime: "10:30",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-2",
    cliente: {
      nombre: "Lars Bergström",
      email: "l.bergstrom@nordichomes.se",
      telefono: "+46 70 987 1123",
      dni: "SE-19810423",
      nacionalidad: "Suecia",
      nationalityIso: "SE",
    },
    fecha: hoursAgo(2),
    estado: "pendiente",
    matchPercentage: 0,
    consent: true,
  },
  {
    id: "reg-003",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-3",
    cliente: {
      nombre: "Joris van der Berg",
      email: "joris.vdb@dutchrealty.nl",
      telefono: "+31 6 2345 6789",
      dni: "NL-PS5419230",
      nacionalidad: "Países Bajos",
      nationalityIso: "NL",
    },
    fecha: hoursAgo(5),
    estado: "pendiente",
    matchPercentage: 0,
    consent: true,
    /* El backend detectó relación posible con un contacto existente
     * (mismo apellido + tel compartido) · el agente debe confirmar
     * antes de aprobar. */
    possibleRelation: {
      contactName: "Sophie van der Berg",
      contactId: "c-nl-007",
      relation: "pareja",
      confidence: 82,
      reasons: [
        "Mismo teléfono registrado en su ficha",
        "Misma dirección fiscal",
        "Apellido coincidente",
      ],
    },
  },
  {
    id: "reg-004",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-2",
    cliente: {
      nombre: "Anna-Liisa Virtanen",
      email: "anna.virtanen@outlook.fi",
      telefono: "+358 40 555 2211",
      dni: "FI-120385-999X",
      nacionalidad: "Finlandia",
      nationalityIso: "FI",
    },
    fecha: daysAgo(1),
    estado: "aprobado",
    matchPercentage: 0,
    consent: true,
  },

  /* ───── Ambiguos (30 - 69%) ───── */
  {
    id: "reg-005",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-1",
    cliente: {
      nombre: "James O'Connor",
      email: "james.oconnor@gmail.com",
      telefono: "+44 7700 900 301",
      dni: "GB-98765432",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: hoursAgo(7),
    estado: "pendiente",
    matchPercentage: 42,
    matchWith: "Jamie O'Connor · contacto propio desde 2025",
    matchCliente: {
      nombre: "Jamie O'Connor",
      email: "jamie.connor@outlook.com",
      telefono: "+44 7700 900 499",
      dni: "GB-98765491",
      nacionalidad: "Reino Unido",
    },
    consent: true,
    notas: "Coincide el apellido y nacionalidad, pero teléfono y email distintos.",
  },
  {
    id: "reg-006",
    origen: "collaborator",
    promotionId: "4",
    agencyId: "ag-3",
    cliente: {
      nombre: "Sofía Martínez Ruiz",
      email: "sofia.mruiz@hotmail.com",
      telefono: "+34 656 443 221",
      dni: "12345678B",
      nacionalidad: "España",
      nationalityIso: "ES",
    },
    fecha: hoursAgo(10),
    estado: "pendiente",
    tipo: "registration_visit",
    visitDate: "2026-04-29",
    visitTime: "16:00",
    matchPercentage: 55,
    matchWith: "Sofía M. Ruiz · registrada por Prime Properties (hace 11 días)",
    recommendation: "Coincidencia parcial · revisa email y teléfono antes de decidir.",
    matchCliente: {
      nombre: "Sofía M. Ruiz",
      email: "sofimr@gmail.com",
      telefono: "+34 656 443 221",
      dni: "12345678B",
      nacionalidad: "España",
    },
    consent: true,
  },
  {
    id: "reg-007",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-2",
    cliente: {
      nombre: "Mikhail Volkov",
      email: "mvolkov@mail.ru",
      telefono: "+7 916 234 5678",
      dni: "RU-7701985",
      nacionalidad: "Rusia",
      nationalityIso: "RU",
    },
    fecha: daysAgo(2),
    estado: "pendiente",
    matchPercentage: 38,
    matchWith: "Mikhail V. · contacto propio (email diferente)",
    matchCliente: {
      nombre: "Mikhail V.",
      email: "volkov.m@yandex.ru",
      telefono: "+7 916 234 5699",
      dni: "RU-7701985",
      nacionalidad: "Rusia",
    },
    consent: true,
  },
  {
    id: "reg-008",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-3",
    cliente: {
      nombre: "Hans Dieter Schmidt",
      email: "hd.schmidt@t-online.de",
      telefono: "+49 170 4455 889",
      dni: "DE-AR3928473",
      nacionalidad: "Alemania",
      nationalityIso: "DE",
    },
    fecha: daysAgo(3),
    estado: "pendiente",
    matchPercentage: 61,
    matchWith: "Hans D. Schmidt · registrado hace 45 días",
    matchCliente: {
      nombre: "Hans D. Schmidt",
      email: "hds@gmx.de",
      telefono: "+49 170 4455 889",
      dni: "DE-AR3928473",
      nacionalidad: "Alemania",
    },
    consent: true,
  },

  /* ───── Duplicados fuertes (>= 70%) ───── */
  {
    id: "reg-009",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-3",
    cliente: {
      nombre: "Lars Bergström",
      email: "l.bergstrom@nordichomes.se",
      telefono: "+46 70 987 1123",
      dni: "SE-19810423",
      nacionalidad: "Suecia",
      nationalityIso: "SE",
    },
    fecha: hoursAgo(1),
    estado: "pendiente",
    matchPercentage: 96,
    matchWith: "reg-002 · Nordic Home Finders (hace 2h)",
    matchCliente: {
      nombre: "Lars Bergström",
      email: "l.bergstrom@nordichomes.se",
      telefono: "+46 70 987 1123",
      dni: "SE-19810423",
      nacionalidad: "Suecia",
    },
    consent: true,
    notas: "Mismo cliente exacto: teléfono, DNI y email coinciden.",
  },
  {
    id: "reg-010",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-2",
    cliente: {
      nombre: "Émilie Rousseau",
      email: "emilie.r@gmail.com",
      telefono: "+33 6 12 34 56 78",
      dni: "FR-21837291",
      nacionalidad: "Francia",
      nationalityIso: "FR",
    },
    fecha: minsAgo(45),
    estado: "pendiente",
    matchPercentage: 88,
    matchWith: "reg-001 · Prime Properties (hace 14 min)",
    matchCliente: {
      nombre: "Émilie Rousseau",
      email: "emilie.rousseau@gmail.com",
      telefono: "+33 6 12 34 56 78",
      dni: "FR-21837291",
      nacionalidad: "Francia",
    },
    consent: true,
  },
  {
    id: "reg-011",
    origen: "collaborator",
    promotionId: "4",
    agencyId: "ag-1",
    cliente: {
      nombre: "Sofía Martínez",
      email: "sofimr@gmail.com",
      telefono: "+34 656 443 221",
      dni: "12345678B",
      nacionalidad: "España",
      nationalityIso: "ES",
    },
    fecha: daysAgo(5),
    estado: "duplicado",
    matchPercentage: 92,
    matchWith: "Contacto CRM propio (desde Nov 2025)",
    matchCliente: {
      nombre: "Sofía M. Ruiz",
      email: "sofimr@gmail.com",
      telefono: "+34 656 443 221",
      dni: "12345678B",
      nacionalidad: "España",
    },
    consent: true,
  },
  {
    id: "reg-012",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-1",
    cliente: {
      nombre: "Johan De Vries",
      email: "j.devries@ziggo.nl",
      telefono: "+31 6 1122 3344",
      dni: "NL-BSN8839921",
      nacionalidad: "Países Bajos",
      nationalityIso: "NL",
    },
    fecha: daysAgo(4),
    estado: "rechazado",
    matchPercentage: 78,
    matchWith: "Registrado previamente por Dutch & Belgian Realty",
    matchCliente: {
      nombre: "Johan De Vries",
      email: "jdv@gmail.com",
      telefono: "+31 6 1122 3344",
      dni: "NL-BSN8839921",
      nacionalidad: "Países Bajos",
    },
    consent: true,
    notas: "Rechazado — la otra agencia registró primero.",
  },

  /* ───── Más volumen limpio para que los filtros se sientan vivos ───── */
  {
    id: "reg-013",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-2",
    cliente: {
      nombre: "Ingrid Johansen",
      email: "ingrid.johansen@gmail.com",
      telefono: "+47 918 44 552",
      dni: "NO-23048811",
      nacionalidad: "Noruega",
      nationalityIso: "NO",
    },
    fecha: daysAgo(1),
    estado: "aprobado",
    matchPercentage: 0,
    responseTime: "1h 24min",
    decidedByUserId: "u1",
    decidedBy: "Arman Rahmanov",
    decidedByRole: "Admin",
    consent: true,
  },
  {
    id: "reg-014",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-1",
    cliente: {
      nombre: "Pierre Lefèvre",
      email: "pierre.lefevre@orange.fr",
      telefono: "+33 6 78 90 12 34",
      dni: "FR-43298172",
      nacionalidad: "Francia",
      nationalityIso: "FR",
    },
    fecha: daysAgo(2),
    estado: "aprobado",
    matchPercentage: 15,
    responseTime: "3h 12min",
    decidedByUserId: "u2",
    decidedBy: "Laura Gómez",
    decidedByRole: "Comercial senior",
    matchWith: "Contacto parecido (nombre frecuente)",
    matchCliente: {
      nombre: "Pierre Lefebvre",
      email: "p.lefebvre@wanadoo.fr",
      telefono: "+33 6 78 90 99 99",
      dni: "FR-43290000",
      nacionalidad: "Francia",
    },
    consent: true,
  },
  {
    id: "reg-015",
    origen: "collaborator",
    promotionId: "4",
    agencyId: "ag-2",
    cliente: {
      nombre: "Olivia Thompson",
      email: "o.thompson@icloud.com",
      telefono: "+44 7712 445 889",
      dni: "GB-PP1122334",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: hoursAgo(4),
    estado: "pendiente",
    matchPercentage: 0,
    consent: true,
    notas: "Interesada en duplex con terraza orientación sur.",
  },
  {
    id: "reg-016",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-3",
    cliente: {
      nombre: "Matteo Ricci",
      email: "matteo.ricci@tiscali.it",
      telefono: "+39 333 445 6677",
      dni: "IT-RCCMTT80",
      nacionalidad: "Italia",
      nationalityIso: "IT",
    },
    fecha: daysAgo(6),
    estado: "rechazado",
    matchPercentage: 0,
    consent: false,
    notas: "Rechazado por falta de consentimiento RGPD.",
  },
  {
    id: "reg-017",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-1",
    cliente: {
      nombre: "Katarzyna Nowak",
      email: "k.nowak@onet.pl",
      telefono: "+48 602 334 891",
      dni: "PL-82051244765",
      nacionalidad: "Polonia",
      nationalityIso: "PL",
    },
    fecha: minsAgo(35),
    estado: "pendiente",
    matchPercentage: 0,
    consent: true,
  },
  {
    id: "reg-018",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-3",
    cliente: {
      nombre: "Carlos Mendoza Vega",
      email: "carlos.mvega@gmail.com",
      telefono: "+52 55 6632 1144",
      dni: "MX-MEVC850203",
      nacionalidad: "México",
      nationalityIso: "MX",
    },
    fecha: hoursAgo(9),
    estado: "pendiente",
    matchPercentage: 33,
    matchWith: "Carlos M. Vega · contacto con email parecido",
    matchCliente: {
      nombre: "Carlos M. Vega",
      email: "carlos.mvega.01@gmail.com",
      telefono: "+52 55 6632 9988",
      dni: "MX-MEVC850299",
      nacionalidad: "México",
    },
    consent: true,
  },

  /* ───── Registros DIRECTOS (los mete el propio promotor) ───── */
  {
    id: "reg-019",
    origen: "direct",
    promotionId: "1",
    cliente: {
      nombre: "Sophie Laurent",
      email: "sophie.laurent@privatemail.fr",
      telefono: "+33 1 45 67 89 01",
      dni: "FR-92847361",
      nacionalidad: "Francia",
      nationalityIso: "FR",
    },
    fecha: hoursAgo(3),
    estado: "aprobado",
    decidedAt: hoursAgo(3),
    decidedBy: "Promotor",
    matchPercentage: 0,
    consent: true,
    notas: "Contacto vía formulario del microsite. Interesada en planta alta.",
  },
  {
    id: "reg-020",
    tipo: "registration_visit",
    visitDate: "2026-04-30",
    visitTime: "17:00",
    origen: "direct",
    promotionId: "2",
    cliente: {
      nombre: "Markus Schulz",
      email: "markus.schulz@outlook.de",
      telefono: "+49 30 1234 5678",
      dni: "DE-PA98712345",
      nacionalidad: "Alemania",
      nationalityIso: "DE",
    },
    fecha: hoursAgo(20),
    estado: "aprobado",
    decidedAt: hoursAgo(20),
    decidedBy: "Promotor",
    matchPercentage: 0,
    consent: true,
    notas: "Llamada entrante. Quiere visitar con su mujer el finde.",
  },
  {
    id: "reg-021",
    origen: "direct",
    promotionId: "3",
    cliente: {
      nombre: "Beatriz Ribeiro",
      email: "beatriz.ribeiro@hotmail.pt",
      telefono: "+351 93 456 7890",
      dni: "PT-18724569",
      nacionalidad: "Portugal",
      nationalityIso: "PT",
    },
    fecha: daysAgo(2),
    estado: "pendiente",
    matchPercentage: 72,
    matchWith: "Beatriz Ribeiro · ya registrada por Iberia Homes hace 6 días",
    matchCliente: {
      nombre: "Beatriz Ribeiro",
      email: "b.ribeiro@hotmail.pt",
      telefono: "+351 93 456 7890",
      dni: "PT-18724569",
      nacionalidad: "Portugal",
    },
    recommendation: "Atención: cliente ya en sistema por una agencia colaboradora. Revisar antes de aprobar.",
    consent: true,
  },
  {
    id: "reg-022",
    origen: "direct",
    promotionId: "4",
    cliente: {
      nombre: "Alex Petrov",
      email: "alex.petrov@gmail.com",
      telefono: "+7 916 555 0123",
      dni: "RU-7812345678",
      nacionalidad: "Rusia",
      nationalityIso: "RU",
    },
    fecha: minsAgo(45),
    estado: "aprobado",
    decidedAt: minsAgo(45),
    decidedBy: "Promotor",
    matchPercentage: 0,
    consent: true,
  },

  /* ───── Cross-promoción · mismo email que reg-005 (James O'Connor,
     pendiente en promoción 2) pero aprobado en promoción 4 con otra
     agencia. Sirve para probar el banner CrossPromotionWarning.
     En producción esto reflejaría un cliente que ya está activo con
     otra agencia en otra promoción · conflicto potencial de comisión. ───── */
  {
    id: "reg-024",
    origen: "collaborator",
    promotionId: "4",
    agencyId: "ag-3",
    cliente: {
      nombre: "James O'Connor",
      email: "james.oconnor@gmail.com",
      telefono: "+44 7700 900 301",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: daysAgo(30),
    estado: "aprobado",
    decidedAt: daysAgo(29),
    decidedByUserId: "u1",
    decidedBy: "Arman Rahmanov",
    matchPercentage: 0,
    consent: true,
    notas: "Cliente registrado y activo en Residencial Costa Brava.",
  },

  /* ───── Solo visita · cliente ya aprobado · agencia propone una
     visita nueva sobre la misma promoción. Flujo salta los checks de
     cliente y pasa directo a confirmar visita + agente. ───── */
  {
    id: "reg-023",
    tipo: "visit_only",
    originRegistroId: "reg-004",
    visitDate: "2026-04-30",
    visitTime: "17:00",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-2",
    cliente: {
      nombre: "Anna-Liisa Virtanen",
      email: "anna.virtanen@outlook.fi",
      telefono: "+358 40 555 2211",
      nacionalidad: "Finlandia",
      nationalityIso: "FI",
    },
    fecha: minsAgo(30),
    estado: "pendiente",
    matchPercentage: 0,
    recommendation: "Cliente ya aprobado previamente · solo confirma la visita.",
    consent: true,
  },
  /* ─── Registros para ag-4 (Meridian · status="expired") · histórico
   *  legítimo previo al fin de contrato. James/Olivia logueados ven
   *  estos en su CRM como historia que se cerró. ─────────────────── */
  {
    id: "reg-024-m",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-4",
    cliente: {
      nombre: "Charles Pemberton",
      email: "c.pemberton@btinternet.com",
      telefono: "+44 7700 900245",
      dni: "GB-PP998877",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: daysAgo(120),
    estado: "aprobado",
    matchPercentage: 8,
    responseTime: "2h 45min",
    decidedByUserId: "u1",
    decidedBy: "Arman Rahmanov",
    decidedByRole: "Director",
    consent: true,
    notas: "Cliente repetidor de Meridian · cerró villa 2 unidades.",
  },
  {
    id: "reg-025-m",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-4",
    cliente: {
      nombre: "Margaret Ashworth",
      email: "m.ashworth@gmail.com",
      telefono: "+44 7984 112233",
      dni: "GB-PP554433",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: daysAgo(95),
    estado: "aprobado",
    matchPercentage: 12,
    responseTime: "5h 18min",
    decidedByUserId: "u1",
    decidedBy: "Arman Rahmanov",
    decidedByRole: "Director",
    consent: true,
  },
  {
    id: "reg-026-m",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-4",
    cliente: {
      nombre: "Edward Sinclair",
      email: "edward.sinclair@yahoo.co.uk",
      telefono: "+44 7445 887766",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: daysAgo(80),
    estado: "rechazado",
    matchPercentage: 78,
    responseTime: "1h 22min",
    decidedByUserId: "u2",
    decidedBy: "Laura Gómez",
    decidedByRole: "Comercial senior",
    matchWith: "Cliente ya activo en otra agencia",
    consent: true,
  },
  {
    id: "reg-027-m",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-4",
    cliente: {
      nombre: "Niamh O'Sullivan",
      email: "niamh.osullivan@hotmail.com",
      telefono: "+353 87 555 4321",
      nacionalidad: "Irlanda",
      nationalityIso: "IE",
    },
    fecha: daysAgo(70),
    estado: "aprobado",
    matchPercentage: 6,
    responseTime: "3h 50min",
    decidedByUserId: "u1",
    decidedBy: "Arman Rahmanov",
    decidedByRole: "Director",
    consent: true,
  },
  {
    id: "reg-028-m",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-4",
    cliente: {
      nombre: "Robert Whitaker",
      email: "r.whitaker@outlook.com",
      telefono: "+44 7831 224466",
      nacionalidad: "Reino Unido",
      nationalityIso: "GB",
    },
    fecha: daysAgo(50),
    estado: "caducado",
    matchPercentage: 22,
    consent: true,
    notas: "Pre-registro caducado · cliente desistió antes de la visita.",
  },
  /* ─── Registros para ag-5 (Iberia · status="pending", primera
   *  solicitud) · pocos registros tempranos para que João/Inês
   *  empiecen viendo algo de actividad reciente. ─────────────────── */
  {
    id: "reg-029-i",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-5",
    cliente: {
      nombre: "Rafael Martins",
      email: "r.martins@iol.pt",
      telefono: "+351 93 555 7788",
      nacionalidad: "Portugal",
      nationalityIso: "PT",
    },
    fecha: daysAgo(8),
    estado: "pendiente",
    matchPercentage: 4,
    consent: true,
    notas: "Cliente premium · cerró 2 operaciones con Iberia el año pasado.",
  },
  {
    id: "reg-030-i",
    origen: "collaborator",
    promotionId: "2",
    agencyId: "ag-5",
    cliente: {
      nombre: "Catarina Mendes",
      email: "c.mendes@sapo.pt",
      telefono: "+351 96 222 3344",
      nacionalidad: "Portugal",
      nationalityIso: "PT",
    },
    fecha: daysAgo(5),
    estado: "pendiente",
    matchPercentage: 0,
    consent: true,
  },
  {
    id: "reg-031-i",
    origen: "collaborator",
    promotionId: "1",
    agencyId: "ag-5",
    cliente: {
      nombre: "Pedro Almeida",
      email: "p.almeida@portugalmail.pt",
      telefono: "+351 21 555 9000",
      nacionalidad: "Portugal",
      nationalityIso: "PT",
    },
    fecha: daysAgo(2),
    estado: "pendiente",
    matchPercentage: 18,
    consent: true,
  },
  {
    id: "reg-032-i",
    origen: "collaborator",
    promotionId: "3",
    agencyId: "ag-5",
    cliente: {
      nombre: "Lucas Oliveira",
      email: "lucas.oliveira@globo.com.br",
      telefono: "+55 11 9 8765 4321",
      nacionalidad: "Brasil",
      nationalityIso: "BR",
    },
    fecha: hoursAgo(20),
    estado: "pendiente",
    matchPercentage: 2,
    consent: true,
    notas: "Inversor brasileño · busca segunda residencia en Costa del Sol.",
  },
];

/** Export final · cada Registro recibe `publicRef` ordenado por fecha. */
export const registros: Registro[] = enrichLegacyRegistroSeeds(RAW_REGISTROS);

/* ═══════════════════════════════════════════════════════════════════
   Helpers derivados
   ═══════════════════════════════════════════════════════════════════ */

/** Banda de riesgo de duplicado para badge/colores (ver design-system.md). */
export function getMatchLevel(pct: number): "none" | "low" | "medium" | "high" {
  if (pct === 0) return "none";
  if (pct < 30) return "low";
  if (pct < 70) return "medium";
  return "high";
}

/** Label humano del estado. */
export const estadoLabel: Record<RegistroEstado, string> = {
  pendiente: "Pendiente",
  preregistro_activo: "Preregistro",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  duplicado: "Duplicado",
  caducado: "Caducado",
};

/** Label humano del outcome de visita · usado en timeline + cards. */
export const visitOutcomeLabel: Record<VisitOutcome, string> = {
  realizada:           "Visita realizada",
  no_show_cliente:     "Cliente desistió",
  cancelada_agencia:   "Cancelada por la agencia",
  cancelada_promotor:  "Cancelada por el promotor",
  reprogramada:        "Visita reprogramada",
};
