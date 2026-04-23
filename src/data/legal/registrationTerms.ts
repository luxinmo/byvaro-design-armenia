/**
 * Términos y condiciones del registro de cliente en una promoción.
 *
 * Los define el sistema. Hay dos variantes según quién envíe el registro:
 *
 *   · `agency`    → texto v2 específico para agencia colaboradora.
 *                   Menciona explícitamente que el sistema trabaja con
 *                   datos parciales (nombre, nacionalidad, últimos 4
 *                   dígitos del teléfono) y detalla las consecuencias de
 *                   manipulación.
 *
 *   · `developer` → texto v1 para el promotor cuando registra él mismo
 *                   un cliente directo. Versión más breve — no aplica el
 *                   tema de datos parciales porque el promotor ve todo.
 *
 * Al aceptar se graba `audit.termsVersion` y `audit.acceptedAt` en el
 * Registro para tener traza auditable.
 *
 * TODO(backend):
 *   - GET /api/legal/registration-terms?role=agency|developer&lang=es
 *   - POST /api/promociones/:id/registros  body incluye { termsVersion, acceptedAt, role }
 *   - Tabla `legal_acceptances` como audit log independiente.
 */

export type LegalLang = "es" | "en";
export type LegalRole = "agency" | "developer";

export interface TermsSection {
  heading: Record<LegalLang, string>;
  /** Uno o varios párrafos antes de los bullets (opcional). */
  paragraphs?: Record<LegalLang, string[]>;
  /** Lista de bullets opcional — se pintan como <ul>. */
  bullets?: Record<LegalLang, string[]>;
}

export interface RegistrationTerms {
  version: string;
  lastUpdated: string; // ISO date
  title: Record<LegalLang, string>;
  intro: Record<LegalLang, string>;
  sections: TermsSection[];
  consentLabel: Record<LegalLang, string>;
  acceptCta: Record<LegalLang, string>;
}

/* ═══════════════════════════════════════════════════════════════════
   AGENCY · v2-2026-04 (texto provisto por Arman, 23 abril 2026)
   ═══════════════════════════════════════════════════════════════════ */
export const REGISTRATION_TERMS_AGENCY: RegistrationTerms = {
  version: "v2-2026-04",
  lastUpdated: "2026-04-23",

  title: {
    es: "Términos del registro de cliente",
    en: "Client registration terms",
  },

  intro: {
    es: "Al enviar este registro sobre la promoción, el agente o promotor declara y acepta expresamente lo siguiente:",
    en: "By submitting this registration for the promotion, the agent or developer expressly declares and accepts the following:",
  },

  sections: [
    {
      heading: { es: "1. Veracidad de los datos", en: "1. Truthfulness of the data" },
      paragraphs: {
        es: [
          "El agente se compromete a introducir los datos del cliente exactamente como han sido proporcionados por el propio cliente.",
          "Dado que el sistema trabaja con datos parciales (nombre, nacionalidad y últimos 4 dígitos del teléfono), cualquier modificación intencionada para evitar coincidencias será considerada una manipulación del registro.",
        ],
        en: [
          "The agent agrees to enter the client's data exactly as provided by the client.",
          "Since the system works with partial data (name, nationality and the last 4 digits of the phone), any intentional modification aimed at avoiding matches will be treated as a manipulation of the registration.",
        ],
      },
    },
    {
      heading: { es: "2. Representación legítima", en: "2. Legitimate representation" },
      paragraphs: {
        es: [
          "El agente únicamente puede registrar a clientes que le hayan autorizado expresamente.",
          "Queda estrictamente prohibido registrar a terceros (familiares, amigos u otros) en lugar del cliente real con el objetivo de asegurar una oportunidad o evitar conflictos de registro.",
        ],
        en: [
          "The agent may only register clients who have expressly authorised them to do so.",
          "It is strictly forbidden to register third parties (relatives, friends or others) in place of the actual client in order to secure an opportunity or avoid registration conflicts.",
        ],
      },
    },
    {
      heading: { es: "3. Integridad del registro", en: "3. Registration integrity" },
      paragraphs: {
        es: [
          "El registro en Byvaro debe reflejar al cliente real interesado en la promoción, no una identidad alternativa.",
          "Se considerará uso indebido del sistema:",
        ],
        en: [
          "A registration in Byvaro must reflect the actual client interested in the promotion, never an alternate identity.",
          "The following is considered misuse of the system:",
        ],
      },
      bullets: {
        es: [
          "Registrar a otra persona en lugar del cliente real.",
          "Alterar parcialmente el nombre o los datos.",
          "Intentar evitar coincidencias mediante variaciones intencionadas.",
        ],
        en: [
          "Registering another person instead of the real client.",
          "Partially altering the name or other fields.",
          "Attempting to bypass duplicate detection through intentional variations.",
        ],
      },
    },
    {
      heading: { es: "4. Validación y revisión", en: "4. Validation and review" },
      paragraphs: {
        es: [
          "Aunque el registro se realiza con datos parciales, el promotor podrá realizar verificaciones posteriores antes de validar una reserva o cerrar una operación.",
          "En caso de conflicto entre agencias, se tendrá en cuenta:",
        ],
        en: [
          "Although the registration is submitted with partial data, the developer may perform later verifications before validating a reservation or closing a transaction.",
          "In the event of a conflict between agencies, the following will be taken into account:",
        ],
      },
      bullets: {
        es: [
          "Orden cronológico del registro.",
          "Coherencia de los datos.",
          "Historial de actividad.",
          "Relación real con el cliente.",
        ],
        en: [
          "Chronological order of the registration.",
          "Consistency of the data.",
          "Activity history.",
          "Actual relationship with the client.",
        ],
      },
    },
    {
      heading: { es: "5. Consentimiento RGPD", en: "5. GDPR consent" },
      paragraphs: {
        es: [
          "El agente confirma haber obtenido el consentimiento del cliente para el tratamiento de sus datos conforme a la normativa vigente (RGPD).",
        ],
        en: [
          "The agent confirms having obtained the client's consent to process their personal data in accordance with the applicable regulation (GDPR).",
        ],
      },
    },
    {
      heading: { es: "6. Consecuencias", en: "6. Consequences" },
      paragraphs: {
        es: [
          "En caso de detectarse incoherencias, suplantación o intento de manipulación:",
        ],
        en: [
          "If inconsistencies, impersonation or attempted manipulation are detected:",
        ],
      },
      bullets: {
        es: [
          "El registro podrá ser invalidado.",
          "La comisión podrá ser anulada.",
          "El promotor podrá rechazar la operación.",
          "Se podrá limitar o cancelar la colaboración.",
        ],
        en: [
          "The registration may be invalidated.",
          "The associated commission may be cancelled.",
          "The developer may reject the transaction.",
          "The collaboration may be limited or terminated.",
        ],
      },
    },
    {
      heading: { es: "7. Trazabilidad", en: "7. Traceability" },
      paragraphs: {
        es: [
          "Cada registro queda asociado a:",
        ],
        en: [
          "Every registration is linked to:",
        ],
      },
      bullets: {
        es: [
          "Usuario que lo realiza.",
          "Fecha y hora.",
          "Dispositivo y entorno técnico.",
        ],
        en: [
          "The user who submits it.",
          "Date and time.",
          "Device and technical environment.",
        ],
      },
    },
    {
      heading: { es: "8. Comisiones", en: "8. Commissions" },
      paragraphs: {
        es: [
          "El derecho a comisión está condicionado a:",
        ],
        en: [
          "Entitlement to commission is conditional on:",
        ],
      },
      bullets: {
        es: [
          "La veracidad del registro.",
          "La correcta representación del cliente.",
          "El cumplimiento de estos términos.",
        ],
        en: [
          "Truthfulness of the registration.",
          "Proper representation of the client.",
          "Compliance with these terms.",
        ],
      },
    },
  ],

  consentLabel: {
    es: "He leído y acepto los términos del registro.",
    en: "I have read and accept the registration terms.",
  },

  acceptCta: {
    es: "Aceptar términos",
    en: "Accept terms",
  },
};

/* ═══════════════════════════════════════════════════════════════════
   DEVELOPER · v1-2026-04 · versión más breve para promotor directo
   ═══════════════════════════════════════════════════════════════════ */
export const REGISTRATION_TERMS_DEVELOPER: RegistrationTerms = {
  version: "v1-2026-04",
  lastUpdated: "2026-04-23",
  title: {
    es: "Términos del registro de cliente",
    en: "Client registration terms",
  },
  intro: {
    es: "Al crear este registro directo sobre la promoción, como promotor declaras y aceptas lo siguiente:",
    en: "By creating this direct registration for the promotion, as a developer you declare and accept the following:",
  },
  sections: [
    {
      heading: { es: "1. Veracidad de los datos", en: "1. Truthfulness of the data" },
      paragraphs: {
        es: [
          "Los datos del cliente se introducen tal y como fueron proporcionados por el propio cliente, sin alteraciones que puedan afectar a la trazabilidad del registro.",
        ],
        en: [
          "Client data is entered exactly as provided by the client, without alterations that could affect the traceability of the registration.",
        ],
      },
    },
    {
      heading: { es: "2. Consentimiento RGPD", en: "2. GDPR consent" },
      paragraphs: {
        es: [
          "Se ha obtenido el consentimiento del cliente para el tratamiento de sus datos conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).",
        ],
        en: [
          "The client's consent has been obtained for data processing in accordance with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).",
        ],
      },
    },
    {
      heading: { es: "3. Trazabilidad", en: "3. Traceability" },
      paragraphs: {
        es: [
          "Cada registro queda asociado al usuario que lo crea, la fecha y hora, el dispositivo y el entorno técnico, para usarlo como prueba en caso de conflicto.",
        ],
        en: [
          "Every registration is linked to the user who creates it, date and time, device and technical environment, to be used as evidence in case of dispute.",
        ],
      },
    },
    {
      heading: { es: "4. Derecho de anulación", en: "4. Right of cancellation" },
      paragraphs: {
        es: [
          "En caso de detectarse incoherencias, suplantación o manipulación, el registro podrá invalidarse y, si aplica, la comisión asociada podrá anularse.",
        ],
        en: [
          "If inconsistencies, impersonation or manipulation are detected, the registration may be invalidated and, where applicable, the associated commission may be cancelled.",
        ],
      },
    },
  ],
  consentLabel: {
    es: "He leído y acepto los términos del registro.",
    en: "I have read and accept the registration terms.",
  },
  acceptCta: {
    es: "Aceptar términos",
    en: "Accept terms",
  },
};

/** Devuelve el bloque legal aplicable al rol actual. */
export function getRegistrationTerms(role: LegalRole): RegistrationTerms {
  return role === "agency" ? REGISTRATION_TERMS_AGENCY : REGISTRATION_TERMS_DEVELOPER;
}

/** Export legacy · mantiene compatibilidad con código existente. Apunta
 *  al texto AGENCY porque es el flujo dominante. */
export const REGISTRATION_TERMS = REGISTRATION_TERMS_AGENCY;
export const REGISTRATION_TERMS_VERSION = REGISTRATION_TERMS_AGENCY.version;
