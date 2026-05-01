/**
 * systemLimits.ts · Catálogo CENTRAL de límites del sistema.
 *
 * Único sitio donde se declaran qué cosas tienen tope · dos motivos:
 *
 *   1. **Plan-tier** · el plan contratado da X de algo (ej. 5
 *      promociones activas en el plan Promotor 249). Ver `plan.ts`
 *      para `PLAN_LIMITS`.
 *
 *   2. **Por créditos** · features de pago por uso (ej. AI tokens,
 *      exports masivos, integraciones premium) que se consumen del
 *      saldo de créditos del workspace. Hoy es esqueleto · backend
 *      pendiente de implementar.
 *
 * Cuando una feature nueva se quiera monetizar:
 *   · Si encaja en plan-tier → añadir campo a `PlanLimits` en
 *     `plan.ts` y completar `PLAN_LIMITS[tier]`.
 *   · Si encaja en pay-per-use → añadir entrada a `SYSTEM_LIMITS`
 *     con `kind: "credits"` + precio por unidad.
 *
 * NUNCA hardcodear un límite en un componente · siempre via este
 * fichero o `plan.ts` · así el backend tiene una lista canónica que
 * replicar y un solo sitio donde el admin puede tunear.
 */

/* ══════════════════════════════════════════════════════════════════
   1 · CATÁLOGO DE LÍMITES DECLARATIVO
   ══════════════════════════════════════════════════════════════════ */

export type SystemLimitKind = "plan" | "credits" | "feature";

export interface SystemLimitDef {
  /** ID estable · usado en endpoints, gates y storage. */
  id: string;
  kind: SystemLimitKind;
  /** Etiqueta humana · para UI. */
  label: string;
  /** Descripción larga · qué cubre, cuándo aplica. */
  description: string;
  /** Endpoint que valida el gate server-side cuando aterrice backend. */
  enforcement?: string;
  /** Solo `kind: "credits"` · coste por uso (en créditos). */
  creditCost?: number;
  /** Solo `kind: "credits"` · qué unidad consume (1 token, 1 export…). */
  creditUnit?: string;
}

/**
 * Límites VIVOS (gate real) en el sistema actualmente:
 *
 * | id                  | kind   | tope                                   |
 * |---------------------|--------|----------------------------------------|
 * | `promotions.active` | plan   | 5 (249) · 10 (329) · ∞ resto           |
 * | `collab.requests`   | plan   | 10 (agency_free provincia) · ∞ resto   |
 *
 * Nada más se gates hoy · invitedAgencies, registros, cross-collabs
 * son ilimitados. Si en el futuro se monetizan, se añaden aquí.
 */
export const SYSTEM_LIMITS: Record<string, SystemLimitDef> = {
  "promotions.active": {
    id: "promotions.active",
    kind: "plan",
    label: "Promociones activas",
    description:
      "Promociones simultáneas en estado 'active' que el promotor / "
      + "comercializador puede tener. Plan trial · 5. Plan 249 · 5. "
      + "Plan 329 · 10. Enterprise · ilimitado.",
    enforcement:
      "POST /api/promotions y PATCH /api/promotions/:id (transición a "
      + "active) · responde 402 Payment Required con `{ trigger: "
      + "\"createPromotion\", used, limit }` si excede.",
  },

  "collab.requests": {
    id: "collab.requests",
    kind: "plan",
    label: "Solicitudes de colaboración",
    description:
      "Solicitudes que la agencia puede enviar para iniciar "
      + "colaboración con un promotor. agency_free · 10 (en su "
      + "provincia). agency_marketplace · ilimitado. Si un promotor "
      + "invita primero, NO se gasta solicitud.",
    enforcement:
      "POST /api/collab-requests · responde 402 con `{ trigger: "
      + "\"sendCollabRequest\", used, limit }` si excede.",
  },

  "landing.pages.published": {
    id: "landing.pages.published",
    kind: "plan",
    label: "Landing pages publicadas",
    description:
      "Páginas de marketing independientes (distintas de los "
      + "microsites por promoción · pensadas para campañas, captación "
      + "de leads, branding). agency_free · 10. Resto de planes (de "
      + "pago) · ilimitado.",
    enforcement:
      "POST /api/landings/:id/publish · responde 402 si "
      + "`landingPagesPublished >= landingPages`.",
  },

  "firmafy.signatures.monthly": {
    id: "firmafy.signatures.monthly",
    kind: "plan",
    label: "Firmas digitales (Firmafy)",
    description:
      "Firmas digitales incluidas en el plan por mes natural. "
      + "promoter_249 · 329 · trial · 50/mes. agency_marketplace · 15/mes. "
      + "agency_free · 0 (no incluido). Reset el día 1. Lo que exceda "
      + "se paga como firma adicional vía Marketplace Byvaro · "
      + "consume créditos del wallet del workspace.",
    enforcement:
      "POST /api/contracts/:id/send-to-sign · responde 402 si "
      + "`signaturesUsedThisMonth >= signaturesPerMonth`. UI debe "
      + "abrir CreditsTopupDialog o redirigir al Marketplace.",
    creditCost: 1,
    creditUnit: "firma adicional",
  },

  /* ── Placeholders para features que SE PODRÍAN monetizar más
   *    adelante. Se mantienen como `kind: "feature"` (sin gate · solo
   *    documental) para que cualquier dev sepa qué se ha barajado.
   *    Cuando se decida monetizar, cambiar a `kind: "plan"` o
   *    `kind: "credits"` y completar el coste/tier.
   * ────────────────────────────────────────────────────────────── */
  "microsite.customDomain": {
    id: "microsite.customDomain",
    kind: "feature",
    label: "Dominio propio en microsite",
    description:
      "Conectar dominio propio al microsite de una promoción. Hoy "
      + "incluido en plan promoter · candidato a add-on de pago si "
      + "se quiere monetizar (ej. 19€/mes por dominio extra).",
  },

  "ai.duplicateDetection": {
    id: "ai.duplicateDetection",
    kind: "feature",
    label: "IA detección duplicados",
    description:
      "Reconocimiento automático de cliente duplicado al recibir un "
      + "registro. Hoy incluido en todos los planes. Si se monetiza "
      + "por uso, pasaría a `kind: \"credits\"` con `creditCost: 1` "
      + "por análisis.",
  },

  "estadisticas.advanced": {
    id: "estadisticas.advanced",
    kind: "feature",
    label: "Estadísticas avanzadas",
    description:
      "Heatmaps, predicciones IA, comparativas de equipo. Hoy "
      + "incluido en plan promoter. Candidato a tier premium.",
  },

  "export.bulkCSV": {
    id: "export.bulkCSV",
    kind: "feature",
    label: "Exportación masiva CSV",
    description:
      "Exportar listados completos en CSV (contactos, ventas, "
      + "registros). Hoy admin puede exportar libremente. Candidato a "
      + "credit-cost por export grande (>1000 filas).",
  },

  "marketplace.photoEdit": {
    id: "marketplace.photoEdit",
    kind: "feature",
    label: "Edición de fotos profesional",
    description:
      "Servicio de retoque y enhancement de fotos de promociones · "
      + "se contrata desde el Marketplace Byvaro · pay-per-photo en "
      + "créditos. PENDIENTE de implementar.",
  },

  "marketplace.dataImport": {
    id: "marketplace.dataImport",
    kind: "feature",
    label: "Importación de datos asistida",
    description:
      "Migración guiada desde otros CRMs (importación de promoción, "
      + "contactos y ventas). Incluido GRATIS en planes de pago "
      + "(promoter, agency_marketplace) con formación incluida. "
      + "El admin de Byvaro lo coordina por email tras la suscripción.",
  },
};

/* ══════════════════════════════════════════════════════════════════
   2 · SISTEMA DE CRÉDITOS · ESQUELETO
   ──────────────────────────────────────────────────────────────────
   Para features de pago por uso (no por plan). Cada workspace tiene
   un wallet con saldo · se carga vía Stripe Checkout y se descuenta
   al usar features marcadas `kind: "credits"`.

   ESTADO · esqueleto solamente · NADIE consume créditos hoy.
   Cuando aterrice backend:
     · `GET /api/workspace/credits/balance`        → saldo actual
     · `POST /api/workspace/credits/spend`         → descontar (server-validated)
     · `POST /api/workspace/credits/topup`         → Stripe Checkout para
                                                     comprar packs (10€·100€·etc.)
     · `GET /api/workspace/credits/transactions`   → histórico de uso
   ══════════════════════════════════════════════════════════════════ */

export interface CreditsWallet {
  /** Saldo actual en créditos. */
  balance: number;
  /** Última fecha de consumo · para mostrar "última actividad". */
  lastSpentAt?: string;
  /** ¿El wallet tiene auto-recarga configurada? */
  autoTopup?: boolean;
}

export interface CreditsTransaction {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Positivo = topup · Negativo = spend. */
  amount: number;
  /** Razón legible · "Compra de pack" · "AI análisis registro · 5 créditos". */
  reason: string;
}

export interface CreditsApi {
  getBalance(): Promise<CreditsWallet>;
  /** Devuelve `false` si no hay saldo suficiente · UI debe abrir topup. */
  spend(amount: number, reason: string): Promise<boolean>;
  /** Inicia checkout para comprar `packCredits` · resuelve con la URL
   *  de Stripe (frontend redirige) o `null` si backend no configurado. */
  topup(packCredits: number): Promise<string | null>;
  /** Histórico paginado · solo admin. */
  transactions(limit?: number): Promise<CreditsTransaction[]>;
}

/** Stub no-op · sustituir por implementación real cuando aterrice
 *  backend. Cualquier llamada hoy devuelve datos placeholder. */
export const credits: CreditsApi = {
  async getBalance() {
    return { balance: 0 };
  },
  async spend(_amount: number, _reason: string): Promise<boolean> {
    /* No cobra hasta que exista backend · siempre permite la acción
     *  para no bloquear la UI durante el desarrollo. Cuando aterrice
     *  backend, este método validará server-side y devolverá `false`
     *  si no hay saldo. */
    return true;
  },
  async topup(_packCredits: number): Promise<string | null> {
    return null; // sin Stripe · UI debe mostrar "próximamente".
  },
  async transactions(_limit = 50): Promise<CreditsTransaction[]> {
    return [];
  },
};
