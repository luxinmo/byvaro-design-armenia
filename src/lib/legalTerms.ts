/**
 * legalTerms.ts · Catálogo de términos legales versionados.
 *
 * Phase 2 frontend mock · cuando el backend exista, los términos
 * vivirán en `legal_terms` table con auditoría server-side. Mientras
 * tanto, se almacenan aquí como constantes para que cuando un
 * promotor apruebe un registro, deje traza de QUÉ versión aceptó.
 *
 * Spec en `docs/registration-system.md §C "T&C popup en aprobación"`.
 *
 * TODO(backend): GET /api/legal-terms/:id → trae la última versión
 * aplicable al workspace (puede haber versiones por país / idioma).
 */

export type LegalTermsId = "registration_approval" | "responsible_acceptance";

export type LegalTerms = {
  id: LegalTermsId;
  version: string;       // semver-ish · "v1.0", "v1.1"
  updatedAt: string;     // ISO
  /** Texto legal · soporta interpolación con {placeholder}. */
  body: string;
  /** Variantes de copy según el modo de la promoción. */
  bodyDirecto?: string;
  bodyPorVisita?: string;
};

export const REGISTRATION_APPROVAL_TERMS: LegalTerms = {
  id: "registration_approval",
  version: "v1.0",
  updatedAt: "2026-04-27",
  body:
    "Reconozco que he revisado los datos del cliente y declaro que la " +
    "atribución a {agencia} es correcta. La aprobación es vinculante " +
    "y queda registrada en el historial cross-empresa.",
  bodyDirecto:
    "Al aprobar, el cliente {cliente} queda formalmente registrado " +
    "a nombre de {agencia} en {promocion}. Esta atribución implica " +
    "el derecho a comisión según los términos de colaboración acordados.",
  bodyPorVisita:
    "Al aprobar, el cliente {cliente} queda en preregistro reservado " +
    "a {agencia} para {promocion}. La reserva se confirma como " +
    "registro definitivo cuando se realice la primera visita. Si la " +
    "visita no se ejecuta en el plazo configurado, el cliente queda " +
    "libre y la atribución se pierde.",
};

/* ════════════════════════════════════════════════════════════════
 *  Responsible Acceptance · T&C que acepta un usuario al confirmar
 *  que es el Responsable de una agencia.
 *
 *  Estructura:
 *   - `declarations` · 4 bullets cortos visibles directamente en el
 *     modal · cada uno termina en check verde.
 *   - `body` · texto legal completo · scrollable box "Ver términos
 *     completos" dentro del modal.
 *
 *  Idioma · solo ES por ahora · phase 2 i18n.
 *  Versión · semver string · sube el número en cada cambio · queda
 *  guardado en el paper trail (`AgencyOnboardingState.selfTermsAccepted.termsVersion`).
 *  ════════════════════════════════════════════════════════════════ */

export interface ResponsibleAcceptanceTerms {
  id: "responsible_acceptance";
  version: string;
  updatedAt: string;
  /** 4 bullets cortos · visibles directamente en el modal. */
  declarations: string[];
  /** Texto legal completo · markdown plano · scrollable. */
  body: string;
}

export const RESPONSIBLE_ACCEPTANCE_TERMS: ResponsibleAcceptanceTerms = {
  id: "responsible_acceptance",
  version: "1.0",
  updatedAt: "2026-04-27",
  declarations: [
    "Soy mayor de edad, tengo capacidad legal y los datos que aporto son veraces.",
    "Soy la persona autorizada para representar a la agencia y firmar en su nombre.",
    "Asumo la responsabilidad legal de los contratos, registros y pagos generados desde la cuenta.",
    "Doy consentimiento al tratamiento de mis datos y de los datos del equipo y clientes conforme al RGPD.",
  ],
  body: `\
TÉRMINOS DEL RESPONSABLE DE LA AGENCIA

Versión 1.0 · 27 de abril de 2026

1. Identidad y capacidad
Declaro bajo mi responsabilidad que soy la persona física que figura en
el formulario de aceptación, que soy mayor de edad y tengo capacidad
legal plena para obligarme y representar a la agencia indicada.

2. Autoridad de representación
Confirmo que soy la persona autorizada por la agencia para actuar como
Responsable en la plataforma Byvaro, lo que incluye administrar el
perfil, gestionar el equipo, firmar contratos de colaboración con
promotores y comercializadores, autorizar pagos y aceptar términos en
nombre de la agencia.

3. Veracidad de los datos
Garantizo que la información facilitada al darse de alta y la que
aporten los miembros del equipo en el uso ordinario de Byvaro es veraz,
está actualizada y que tengo derecho a tratarla. Acepto rectificarla
o actualizarla cuando sea necesario.

4. Cuenta y credenciales
Soy responsable de la confidencialidad de las credenciales de acceso a
mi cuenta, así como de las acciones realizadas desde ella. Debo
notificar a Byvaro inmediatamente cualquier acceso no autorizado o
sospecha de compromiso.

5. Contratos firmados desde la cuenta
Reconozco que los contratos de colaboración firmados digitalmente desde
la cuenta de la agencia son vinculantes para la propia agencia. Los
términos económicos (comisión, plazo de pago, condiciones de venta)
quedan registrados en Byvaro y constituyen prueba aceptada por ambas
partes.

6. Tratamiento de datos personales (RGPD)
Como Responsable autorizo a Byvaro, en su condición de encargado del
tratamiento, a procesar los datos personales necesarios para la
prestación del servicio. La agencia actúa como responsable del
tratamiento respecto de los clientes y miembros que cargue en el
sistema, y asume las obligaciones derivadas: información a los
interesados, base legitimadora, ejercicio de derechos ARCO-POL.

7. Subcontratistas autorizados
Acepto que Byvaro puede emplear sub-encargados (proveedores de hosting,
email, firma digital, pasarelas de pago, etc.) bajo contratos que
garanticen los mismos estándares de protección de datos. La lista
actualizada de sub-encargados está disponible en el portal del cliente.

8. Pagos y suscripción
En caso de planes de pago, autorizo el cargo automático en el método
de pago configurado mientras el plan esté activo. Soy responsable de
mantener actualizada la información de facturación y de cancelar la
suscripción si dejo de aceptar este punto.

9. Uso aceptable
Me comprometo a no usar Byvaro para fines ilícitos, fraudulentos,
spam, suplantación de identidad ni para almacenar datos especialmente
protegidos sin la base jurídica adecuada. El incumplimiento puede
implicar la suspensión inmediata de la cuenta.

10. Limitación de responsabilidad
Byvaro no responde de los daños indirectos derivados del uso del
servicio. La responsabilidad económica, en todo caso, queda limitada
al importe efectivamente pagado por la agencia en los doce meses
anteriores al hecho que origine la reclamación.

11. Modificaciones
Byvaro puede actualizar estos términos. Los cambios materiales se
comunican con al menos 15 días de antelación al email del Responsable
y a través del aviso en plataforma. La continuación del uso supone
aceptación.

12. Ley aplicable y jurisdicción
Este acuerdo se rige por la legislación española. Para cualquier
controversia las partes se someten, con renuncia expresa a cualquier
otro fuero, a los Juzgados y Tribunales de la ciudad donde Byvaro
tenga su sede social, salvo que la legislación aplicable al consumidor
imponga otro fuero.

Al marcar la casilla de aceptación se entiende prestado el
consentimiento a todos los puntos anteriores. La fecha, IP, agente del
navegador y dirección de email del aceptante quedan registrados como
prueba electrónica de la aceptación.
`,
};

/** Resuelve los términos aplicables · Phase 2 puede tener i18n + per-org. */
export function getRegistrationTerms(
  modo: "directo" | "por_visita" = "por_visita",
  vars?: { agencia?: string; cliente?: string; promocion?: string },
): { id: LegalTermsId; version: string; body: string } {
  const t = REGISTRATION_APPROVAL_TERMS;
  const template = modo === "directo"
    ? (t.bodyDirecto ?? t.body)
    : (t.bodyPorVisita ?? t.body);
  const body = template
    .replace("{agencia}", vars?.agencia ?? "la agencia colaboradora")
    .replace("{cliente}", vars?.cliente ?? "el cliente")
    .replace("{promocion}", vars?.promocion ?? "la promoción");
  return { id: t.id, version: t.version, body };
}
