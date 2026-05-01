/**
 * /planes · Página comercial de planes de Byvaro.
 *
 * QUÉ
 * ----
 * Display claro y comercial de los planes disponibles · pensada para
 * onboarding nuevo workspace y conversión desde gates de paywall.
 * Menciona explícitamente todo lo que incluye el sistema · IA, WhatsApp,
 * Emails, Ventas, Oportunidades, Calendario, Microsites, Estadísticas,
 * Colaboraciones, Historial, Contactos, Registros, etc.
 *
 * MODELO COMERCIAL
 * ----------------
 *  · Agencia GRATIS · 0€/mes · 10 solicitudes de colaboración (en su
 *    provincia) · usuarios ilimitados · acceso completo. Si un promotor
 *    de su provincia la invita, ya tiene toda la funcionalidad gratis
 *    sin gastar solicitudes.
 *  · Agencia MARKETPLACE · 99€/mes · directorio nacional completo +
 *    solicitudes ilimitadas a cualquier promotor.
 *  · Promotor / Comercializador · 6 meses GRATIS · luego 249€/mes (IVA
 *    excluido) · hasta 5 promociones · invitaciones nacionales · 10
 *    colaboraciones cross-empresa gratis.
 *  · Promotor VOLUMEN · 329€/mes (IVA excluido) · hasta 10 promociones.
 *  · ENTERPRISE · más de 10 promociones · consultar.
 *
 * IMPORTANTE
 * ----------
 *  El paywall enforcement vive en `usageGuard.ts` (server-side cuando
 *  aterrice backend). Esta pantalla es PRESENTACIÓN COMERCIAL · cambiar
 *  precios aquí NO modifica los gates · solo el mensaje al usuario.
 *
 *  TODO(backend) · cuando exista Stripe Checkout, los CTAs llaman a
 *  `POST /api/billing/checkout?plan=X` y redirigen al portal hosted.
 *  Hoy hacen `openUpgradeModal` para no romper el flujo de validación.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Check, ArrowRight, Brain, MessageSquare, Mail, CircleDollarSign,
  Inbox, CalendarDays, Globe, BarChart3, Handshake, History,
  Users, FileText, FileSignature, Sparkles, Building2, Phone, Crown,
  CreditCard, Lock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePlan, PLAN_LIMITS, PLAN_LABEL, setPlan, isPaidPlan,
  cancelSubscription,
  usePlanState,
  setAgencyPack, setPromoterPack,
  AGENCY_PACK_LABEL, PROMOTER_PACK_LABEL,
  isAgencyActive, isPromoterActive,
  type PlanTier, type AgencyPack, type PromoterPack,
} from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { useCurrentUser } from "@/lib/currentUser";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   Tipos
   ══════════════════════════════════════════════════════════════════ */

/** Feature de un plan · soporta tooltip explicativo opcional. */
type PlanFeature = string | { label: string; tooltip: string };

type Plan = {
  id: string;
  audience: "agencia" | "promotor" | "enterprise";
  name: string;
  price: string;
  priceNote?: string;
  trialNote?: string;
  highlight?: boolean;
  blurb: string;
  features: PlanFeature[];
  ctaLabel: string;
  ctaHref?: string;
};

type FeatureBlock = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
};

/* ══════════════════════════════════════════════════════════════════
   Datos · planes y features
   ══════════════════════════════════════════════════════════════════ */

const PLANS: Plan[] = [
  {
    id: "agency-free",
    audience: "agencia",
    name: "Agencia · Gratis",
    price: "0 €",
    priceNote: "para siempre",
    trialNote: "Si te invita un promotor · TODO gratis sin gastar solicitudes",
    blurb:
      "Todo el sistema con 10 solicitudes para colaborar con promotores de tu provincia. Si un promotor te invita primero, queda gratis para siempre.",
    features: [
      "Gratis para siempre cuando te invitan a colaborar",
      "10 solicitudes propias para iniciar colaboración (en tu provincia)",
      "Usuarios ilimitados · todo el equipo dentro",
      "Acceso completo a CRM, ventas, calendario y microsites",
      "WhatsApp · Emails · Plantillas",
      "Estadísticas y dashboards",
      {
        label: "Hasta 10 landing pages publicadas",
        tooltip:
          "Páginas de marketing independientes (distintas de los "
          + "microsites por promoción) · ideales para campañas, "
          + "captación de leads o branding. En plan Marketplace son "
          + "ilimitadas.",
      },
    ],
    ctaLabel: "Empezar gratis",
  },
  {
    id: "agency-marketplace",
    audience: "agencia",
    name: "Agencia · Marketplace",
    price: "99 €",
    priceNote: "/ mes · IVA excluido",
    blurb:
      "Acceso al directorio nacional completo de promotores y comercializadores.",
    features: [
      "Todo lo del plan Gratis · sin restricciones de provincia",
      "Solicitudes ilimitadas a cualquier promotor",
      "Acceso al directorio nacional completo",
      "Búsqueda avanzada por mercados, especialidad, idiomas",
      "Prioridad de aparición ante promotores",
      {
        label: "Colaboración entre agencias incluida",
        tooltip:
          "Puedes colaborar también con otras agencias inmobiliarias "
          + "(no solo con promotores). Co-listings, reparto de "
          + "comisiones, contratos firmados con Firmafy. Ilimitado en "
          + "este plan · sin tope de colaboraciones cross-agencia.",
      },
      "Landing pages ilimitadas",
      {
        label: "Importación de datos GRATIS",
        tooltip:
          "Te ayudamos a migrar al sistema · importamos contactos y "
          + "ventas existentes · formación gratis para tu equipo · "
          + "todo coordinado por nuestro equipo de onboarding.",
      },
      {
        label: "15 firmas digitales / mes incluidas",
        tooltip:
          "Acceso a firma digital con Firmafy (validez legal eIDAS · "
          + "OTP por SMS). 15 firmas incluidas cada mes natural · "
          + "firmas adicionales se pagan por uso desde el Marketplace "
          + "Byvaro · podrás contratar más servicios ahí (edición de "
          + "fotos profesional, integraciones premium, etc.).",
      },
      "Sin permanencia · si cancelas conservas tus ventas y datos",
    ],
    ctaLabel: "Activar Marketplace",
  },
  {
    id: "promoter-249",
    audience: "promotor",
    name: "Promotor / Comercializador",
    price: "249 €",
    priceNote: "/ mes · IVA excluido",
    trialNote: "6 meses gratis al empezar",
    highlight: true,
    blurb:
      "Para promotores y comercializadores · gestiona tu cartera y trabaja con agencias en toda España.",
    features: [
      "Hasta 5 promociones activas",
      "Invitaciones a agencias · alcance nacional",
      "10 colaboraciones cross-empresa gratis",
      "Reconocimiento de registros por IA · evita duplicados",
      "Microsite por promoción · página pública lista para vender",
      "Landing pages ilimitadas",
      "Ventas · contratos · escrituras · seguimiento completo",
      "Estadísticas · embudo · ranking de equipo",
      {
        label: "Importación de datos GRATIS",
        tooltip:
          "Te ayudamos a migrar al sistema · importamos los datos de "
          + "tus promociones, contactos y ventas existentes · "
          + "formación gratis para tu equipo · todo coordinado por "
          + "nuestro equipo de onboarding.",
      },
      {
        label: "50 firmas digitales / mes incluidas",
        tooltip:
          "Acceso a firma digital con Firmafy (validez legal eIDAS · "
          + "OTP por SMS) para contratos de reserva, compraventa y "
          + "colaboración. 50 firmas incluidas cada mes natural · "
          + "firmas adicionales se pagan por uso desde el Marketplace "
          + "Byvaro · próximamente también edición de fotos "
          + "profesional, integraciones premium, etc.",
      },
      "Sin permanencia · si cancelas conservas tus ventas y datos",
    ],
    ctaLabel: "Empezar 6 meses gratis",
  },
  {
    id: "promoter-329",
    audience: "promotor",
    name: "Promotor · Volumen · TODO incluido",
    price: "329 €",
    priceNote: "/ mes · IVA excluido",
    blurb:
      "El pack completo · funcionalidad de Promotor + Agencia · "
      + "ideal si gestionas tus propias promociones Y comercializas "
      + "promociones de terceros.",
    features: [
      "Hasta 10 promociones activas propias",
      {
        label: "INCLUYE plan Agencia · Marketplace (99 €) GRATIS",
        tooltip:
          "Tu workspace funciona como Promotor + Agencia a la vez. "
          + "Ves tu cartera de promociones (Mis Promociones) y "
          + "además puedes colaborar como agencia con otros "
          + "promotores nacionales sin gastar solicitudes ni pagar "
          + "los 99€ aparte. El sidebar muestra ambos bloques cuando "
          + "tienes este pack activo.",
      },
      "Acceso al directorio nacional de promotores y comercializadores",
      "Colaboración entre agencias incluida · ilimitada",
      {
        label: "Importación de datos GRATIS",
        tooltip:
          "Migración asistida desde tu plan o CRM actual · datos de "
          + "promociones, contactos, ventas · formación incluida.",
      },
      "50 firmas digitales / mes incluidas",
      "Landing pages ilimitadas",
      "Sin permanencia · si cancelas conservas tus ventas y datos",
    ],
    ctaLabel: "Activar Volumen",
  },
];

const ENTERPRISE: Plan = {
  id: "enterprise",
  audience: "enterprise",
  name: "Enterprise",
  price: "Consultar",
  blurb: "Más de 10 promociones · atención personalizada.",
  features: [
    "Promociones ilimitadas",
    "Onboarding asistido del equipo",
    "Soporte dedicado",
    "Integraciones a medida",
  ],
  ctaLabel: "Hablar con ventas",
  ctaHref: "mailto:hola@byvaro.com?subject=Plan Enterprise",
};

const FEATURES: FeatureBlock[] = [
  {
    icon: Brain,
    title: "Reconocimiento de registros por IA",
    description:
      "Detecta automáticamente si el cliente que registra una agencia ya existe en tu CRM o en otro registro previo · evita duplicados antes de aprobar.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Business",
    description:
      "Conversaciones desde la plataforma · plantillas rápidas · vinculadas al contacto y a la oportunidad.",
  },
  {
    icon: Mail,
    title: "Emails integrados",
    description:
      "Conecta tu Gmail, Outlook o IMAP · envío y recepción · firma de organización · plantillas.",
  },
  {
    icon: CircleDollarSign,
    title: "Ventas y operaciones",
    description:
      "Kanban + tabla · estados reservada → contratada → escriturada · seguimiento de comisiones y pagos.",
  },
  {
    icon: Inbox,
    title: "Oportunidades",
    description:
      "Pipeline desde lead entrante hasta cierre · asignación de agente · evaluaciones de visita.",
  },
  {
    icon: CalendarDays,
    title: "Calendario y visitas",
    description:
      "Eventos · llamadas · visitas con evaluación obligatoria · recordatorios y disponibilidad por miembro.",
  },
  {
    icon: Globe,
    title: "Microsites y páginas web",
    description:
      "Cada promoción genera su propio microsite con dominio propio opcional · sin desarrolladores.",
  },
  {
    icon: BarChart3,
    title: "Estadísticas y dashboards",
    description:
      "KPIs financieros · embudo de conversión · ranking de equipo · heatmap de actividad.",
  },
  {
    icon: Handshake,
    title: "Colaboraciones entre empresas",
    description:
      "Promotores con agencias · agencias con agencias · contratos firmados con Firmafy · 10 colaboraciones gratis.",
  },
  {
    icon: History,
    title: "Historial completo",
    description:
      "Auditoría de cada acción · contacto · oportunidad · venta · cross-empresa · admin.",
  },
  {
    icon: Users,
    title: "Equipo y permisos",
    description:
      "Usuarios ilimitados · roles admin/member · permisos por dominio · cada miembro ve solo lo suyo.",
  },
  {
    icon: FileText,
    title: "Contactos y registros",
    description:
      "CRM con cartera asignable · bandeja de registros con duplicados detectados · reasignación con historial.",
  },
  {
    icon: FileSignature,
    title: "Contratos y firma digital",
    description:
      "Sube el PDF · envía por email + SMS con OTP vía Firmafy · validez legal eIDAS.",
  },
  {
    icon: Building2,
    title: "Multi-promoción · multi-tenant",
    description:
      "Workspace aislado por empresa · datos separados · permisos granulares · escalable.",
  },
];

/* ══════════════════════════════════════════════════════════════════
   Página
   ══════════════════════════════════════════════════════════════════ */

/* Mapeo de `PlanTier` → `Plan.id` del catálogo de cards · usado para
 *  resaltar la card del plan actual. trial/promoter_249 cuentan ambos
 *  como "promoter-249" en el grid (la card incluye los 6 meses gratis
 *  como trial note). */
function planIdFromTier(tier: PlanTier): string {
  switch (tier) {
    case "agency_free":         return "agency-free";
    case "agency_marketplace":  return "agency-marketplace";
    case "promoter_329":        return "promoter-329";
    case "trial":
    case "promoter_249":        return "promoter-249";
    case "enterprise":          return "enterprise";
    default:                    return "";
  }
}

/* Inverso · `Plan.id` del catálogo → `PlanTier` real para `setPlan()`. */
function tierFromPlanId(planId: string): PlanTier | null {
  switch (planId) {
    case "agency-free":         return "agency_free";
    case "agency-marketplace":  return "agency_marketplace";
    case "promoter-249":        return "promoter_249";
    case "promoter-329":        return "promoter_329";
    case "enterprise":          return "enterprise";
    default:                    return null;
  }
}

export default function Planes() {
  const tier = usePlan();
  const counters = useUsageCounters();
  const limits = PLAN_LIMITS[tier];
  const user = useCurrentUser();
  const activePlanId = planIdFromTier(tier);

  /* Plan seleccionado · cuando el user pulsa la CTA de una card.
   *  Si es null, el dialog está cerrado. */
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  /* Filas de uso · solo se muestran los 2 ÚNICOS límites del sistema:
   *   · promotor → promociones activas (5 / 10 según plan).
   *   · agency  → solicitudes de colaboración (10 en agency_free).
   *  Resto (agencias invitadas, registros recibidos, etc.) son
   *  ilimitados · no se muestran como contadores con tope. */
  const isAgency = user.accountType === "agency";
  const usage: Array<{ label: string; used: number; limit: number }> = isAgency
    ? [
        {
          label: "Solicitudes de colaboración enviadas",
          /* TODO(backend): contador real desde
           *  `GET /api/workspace/usage` · campo collabRequestsSent. */
          used: 0,
          limit: limits.collabRequests,
        },
      ]
    : [
        { label: "Promociones activas", used: counters.activePromotions, limit: limits.activePromotions },
      ];

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-16 max-w-content mx-auto">
        {/* ═══════════ HERO ═══════════ */}
        <header className="text-center max-w-2xl mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Planes Byvaro
          </p>
          <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-bold tracking-tight text-foreground leading-tight mt-2">
            Vende obra nueva sin fricción.
          </h1>
          <p className="text-[14.5px] sm:text-base text-muted-foreground mt-4 leading-relaxed">
            CRM, ventas, microsites, IA de duplicados, WhatsApp y emails ·
            todo en una sola plataforma. Empieza gratis si eres agencia ·
            6 meses sin cargo si eres promotor.
          </p>
        </header>


        {/* ═══════════ DOS SECCIONES INDEPENDIENTES ═══════════
          * Cada workspace puede tener AMBOS packs activos a la vez ·
          * un promotor que quiere catálogo de inmobiliarias activa el
          * pack agencia, una agencia que quiere comercializar activa
          * el pack promotor. Los beneficios "alta nueva" (10
          * solicitudes / 6m gratis) son específicos del pack que se
          * eligió al CREAR la cuenta · ver `signupKind`. */}
        <PackSection
          title="Pack Inmobiliaria"
          eyebrow="Para agencias colaboradoras"
          description="Catálogo de promotores y comercializadores · puedes registrar clientes en sus promociones y cobrar comisiones."
          plans={PLANS.filter((p) => p.audience === "agencia")}
          activePlanId={activePlanId}
          onSelect={(p) => setCheckoutPlan(p)}
          crossPackNote={
            user.accountType === "developer"
              ? "Como promotor, activar el pack Inmobiliaria te da acceso al directorio. Las 10 solicitudes gratis son solo para nuevas altas de inmobiliaria · si activas Gratis aquí, tendrás 0 solicitudes (pasa a Marketplace para ilimitadas)."
              : null
          }
        />

        <PackSection
          title="Pack Promotor / Comercializador"
          eyebrow="Para crear y publicar promociones"
          description="Crea tu obra nueva, comparte con agencias, gestiona registros y cierra ventas."
          plans={PLANS.filter((p) => p.audience === "promotor")}
          activePlanId={activePlanId}
          onSelect={(p) => setCheckoutPlan(p)}
          crossPackNote={
            user.accountType === "agency"
              ? "Como inmobiliaria, activar el pack Promotor te permite crear tus propias promociones. Los 6 meses gratis son solo para altas nuevas de promotor · empezarás directamente en 249€/mes."
              : null
          }
        />

        {/* Dialog de pago · se abre al pulsar la CTA de una card */}
        <PlanCheckoutDialog
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
        />

        {/* ═══════════ ENTERPRISE ═══════════ */}
        <section className="mt-6">
          <article className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {ENTERPRISE.name} · {ENTERPRISE.price}
              </h3>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                {ENTERPRISE.blurb} {ENTERPRISE.features.join(" · ")}
              </p>
            </div>
            <a
              href={ENTERPRISE.ctaHref}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors shrink-0"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {ENTERPRISE.ctaLabel}
            </a>
          </article>
        </section>

        {/* ═══════════ FEATURES INCLUIDAS EN TODOS ═══════════ */}
        <section className="mt-16">
          <header className="text-center max-w-xl mx-auto">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Todo lo que incluye Byvaro
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground leading-tight mt-2">
              Una sola plataforma para tu negocio inmobiliario.
            </h2>
            <p className="text-[13.5px] text-muted-foreground mt-3">
              Desde la captación hasta la escritura · sin saltar entre
              herramientas · todas las features en todos los planes.
            </p>
          </header>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
                    {f.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ═══════════ SIN PERMANENCIA · QUÉ PASA AL CANCELAR ═══════════ */}
        <section className="mt-16 bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto">
          <header className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-success/10 text-success grid place-items-center shrink-0">
              <Check className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Sin permanencia · cancela cuando quieras
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                Pagas mes a mes · postpago · sin compromiso de continuidad.
              </p>
            </div>
          </header>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <article className="bg-success/5 border border-success/20 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-success">
                Conservas siempre
              </p>
              <ul className="mt-2 space-y-1.5">
                {[
                  "Histórico de ventas · contratos · escrituras",
                  "Tus contactos del CRM",
                  "Tus oportunidades cerradas (ganadas y perdidas)",
                  "Tus registros aprobados con su trazabilidad",
                  "Datos legales y fiscales de tu empresa",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" strokeWidth={2.5} />
                    <span className="text-[12.5px] text-foreground/90 leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="bg-muted/50 border border-border rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Acceso restringido tras cancelar
              </p>
              <ul className="mt-2 space-y-1.5">
                {[
                  "No puedes crear nuevas promociones ni publicar microsites",
                  "No puedes invitar a más agencias colaboradoras",
                  "Calendario, emails y WhatsApp quedan en modo lectura",
                  "Estadísticas y dashboards · solo histórico congelado",
                  "Reactiva el plan en cualquier momento · todo vuelve a abrirse",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20 grid place-items-center shrink-0 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    </span>
                    <span className="text-[12.5px] text-foreground/90 leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <p className="text-[11.5px] text-muted-foreground mt-4 leading-relaxed">
            Tus datos viven en tu cuenta y nunca se borran sin que tú lo
            pidas explícitamente · puedes exportarlos en cualquier momento
            desde Ajustes · Privacidad · Exportar.
          </p>
        </section>

        {/* ═══════════ NOTAS LEGALES ═══════════ */}
        <footer className="mt-10 text-center text-[12px] text-muted-foreground max-w-xl mx-auto leading-relaxed">
          <p>
            Todos los precios excluyen IVA. Sin permanencia · cancela cuando
            quieras desde el banner de "Tu plan actual". Para más de 10
            promociones, escríbenos a
            {" "}
            <a
              href="mailto:hola@byvaro.com"
              className="text-foreground font-medium hover:underline"
            >
              hola@byvaro.com
            </a>{" "}
            y te preparamos un plan a medida.
          </p>
        </footer>
      </div>
    </div>
    </TooltipProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Componentes locales
   ══════════════════════════════════════════════════════════════════ */

/* Banner con el plan actualmente contratado + uso real del workspace.
 *  Va arriba del grid · primer impacto al entrar a /planes para
 *  contextualizar al usuario antes de ver las opciones. */
function CurrentPlanBanner({
  tier,
  usage,
  onCancel,
}: {
  tier: PlanTier;
  usage: Array<{ label: string; used: number; limit: number }>;
  onCancel: () => void;
}) {
  /* Solo mostramos "Cancelar suscripción" si el plan vigente es de
   *  pago. trial NO se cancela (es onboarding gratuito 6 meses).
   *  agency_free tampoco (ya es gratis). */
  const canCancel = isPaidPlan(tier) && tier !== "enterprise";
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-10 bg-card border border-border rounded-2xl shadow-soft p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row gap-5 lg:items-start lg:justify-between">
        {/* Plan actual · izquierda */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Crown className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tu plan actual
            </p>
            <p className="text-base font-semibold text-foreground mt-0.5">
              {PLAN_LABEL[tier]}
            </p>
            {canCancel && (
              confirming ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11.5px] text-foreground">¿Cancelar?</span>
                  <button
                    type="button"
                    onClick={() => { onCancel(); setConfirming(false); }}
                    className="inline-flex items-center justify-center h-7 px-3 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold hover:bg-destructive/90 transition-colors"
                  >
                    Sí, cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="inline-flex items-center justify-center h-7 px-3 rounded-full border border-border bg-card text-[11px] font-medium hover:bg-muted transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-destructive transition-colors mt-1.5"
                >
                  <X className="h-3 w-3" strokeWidth={2.25} />
                  Cancelar suscripción
                </button>
              )
            )}
          </div>
        </div>

        {/* Uso · derecha · grid responsive 1/2/3 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:flex-[2]">
          {usage.map((u) => {
            const unlimited = u.limit === Number.POSITIVE_INFINITY;
            const pct = unlimited || u.limit === 0 ? 0 : Math.min(100, (u.used / u.limit) * 100);
            const atLimit = !unlimited && u.limit > 0 && u.used >= u.limit;
            return (
              <div key={u.label} className="bg-muted/40 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground leading-snug">{u.label}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-bold text-foreground tnum">
                    {u.used.toLocaleString("es-ES")}
                  </span>
                  {!unlimited && u.limit > 0 && (
                    <span className="text-[11px] text-muted-foreground tnum">
                      / {u.limit.toLocaleString("es-ES")}
                    </span>
                  )}
                  {unlimited && (
                    <span className="text-[11px] text-success font-medium ml-0.5">
                      ∞
                    </span>
                  )}
                </div>
                {!unlimited && u.limit > 0 && (
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        atLimit ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PackSection · sección con título + nota cross-pack + grid de planes
   ══════════════════════════════════════════════════════════════════ */
function PackSection({
  title,
  eyebrow,
  description,
  plans,
  activePlanId,
  onSelect,
  crossPackNote,
}: {
  title: string;
  eyebrow: string;
  description: string;
  plans: Plan[];
  activePlanId: string | null;
  onSelect: (plan: Plan) => void;
  /** Aviso solo visible cuando el viewer NO encaja en el signupKind
   *  natural del pack (promotor activando agencia, etc.). Explica
   *  los beneficios "alta nueva" que NO se heredan. */
  crossPackNote: string | null;
}) {
  return (
    <section className="mt-10">
      <header className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground mt-1">
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">
          {description}
        </p>
        {crossPackNote && (
          <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 px-3.5 py-2.5 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[12px] text-foreground leading-relaxed">
              {crossPackNote}
            </p>
          </div>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isActive={plan.id === activePlanId}
            onSelect={() => onSelect(plan)}
          />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  isActive,
  onSelect,
}: {
  plan: Plan;
  isActive: boolean;
  onSelect: () => void;
}) {
  const isPromoter = plan.audience === "promotor";
  return (
    <article
      className={cn(
        "relative flex flex-col bg-card border rounded-2xl p-5 sm:p-6 transition-all duration-200",
        isActive
          ? "border-primary shadow-soft-lg ring-2 ring-primary/30"
          : plan.highlight
          ? "border-foreground shadow-soft-lg ring-1 ring-foreground/5"
          : "border-border shadow-soft hover:shadow-soft-lg",
      )}
    >
      {/* Badge "Tu plan" / "Más popular" · "Tu plan" prevalece si activo */}
      {isActive ? (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-primary text-primary-foreground text-[10.5px] font-semibold tracking-wide uppercase">
          <Check className="h-3 w-3" strokeWidth={2.5} />
          Tu plan
        </span>
      ) : plan.highlight ? (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-foreground text-background text-[10.5px] font-semibold tracking-wide uppercase">
          <Sparkles className="h-3 w-3" strokeWidth={2.25} />
          Más popular
        </span>
      ) : null}

      {/* Eyebrow + nombre */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {isPromoter ? "Para promotores" : "Para agencias"}
      </p>
      <h3 className="text-base font-semibold text-foreground mt-1">{plan.name}</h3>

      {/* Precio */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[28px] sm:text-[32px] font-bold tracking-tight text-foreground leading-none">
            {plan.price}
          </span>
          {plan.priceNote && (
            <span className="text-[11.5px] text-muted-foreground">{plan.priceNote}</span>
          )}
        </div>
        {plan.trialNote && (
          <p className="text-[11.5px] font-medium text-success mt-1.5">
            {plan.trialNote}
          </p>
        )}
      </div>

      {/* Blurb */}
      <p className="text-[12.5px] text-muted-foreground mt-3 leading-relaxed">
        {plan.blurb}
      </p>

      {/* Features · soporta string o {label, tooltip} */}
      <ul className="mt-5 space-y-2 flex-1">
        {plan.features.map((f, i) => {
          const isObj = typeof f !== "string";
          const label = isObj ? f.label : f;
          return (
            <li key={i} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-foreground/70 mt-0.5 shrink-0" strokeWidth={2.5} />
              <span className="text-[12.5px] text-foreground/90 leading-snug inline-flex items-start gap-1">
                {label}
                {isObj && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Más info sobre ${label}`}
                        className="text-muted-foreground hover:text-foreground transition-colors mt-px"
                      >
                        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs leading-relaxed">
                      {f.tooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* CTA · si es el plan actual etiqueta "Plan activo" sin acción.
       *  Si NO es el actual, abre el dialog de checkout in-page. */}
      {isActive ? (
        <span className="mt-6 inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-semibold bg-primary/10 text-primary">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Plan activo
        </span>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "mt-6 inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-sm font-semibold transition-colors",
            plan.highlight
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "border border-border bg-card hover:bg-muted",
          )}
        >
          {plan.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PlanCheckoutDialog · popup de pago in-page
   ──────────────────────────────────────────────────────────────────
   Mock UI · pide nombre del titular + número de tarjeta + caducidad
   + CVV y al confirmar llama a `setPlan(tier)`. NO valida ni cobra ·
   solo dispara el cambio de tier en localStorage.
   TODO(backend) · cuando aterrice Stripe, este dialog se sustituye
   por una redirect a `Stripe Checkout` (hosted) y el cambio de tier
   lo dispara el webhook server-side · este componente queda como
   fallback para entornos sin Stripe configurado.
   ══════════════════════════════════════════════════════════════════ */
function PlanCheckoutDialog({
  plan,
  onClose,
}: {
  plan: Plan | null;
  onClose: () => void;
}) {
  const user = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  /* Mock form state · no se persiste · solo para que el user vea un
   *  flujo completo de checkout. */
  const [holder, setHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const open = plan !== null;
  /* Si el plan es Enterprise, abrir mailto y cerrar (no hay checkout). */
  if (open && plan!.id === "enterprise") {
    if (typeof window !== "undefined" && plan!.ctaHref) {
      window.location.href = plan!.ctaHref;
    }
    onClose();
    return null;
  }

  const tier = plan ? tierFromPlanId(plan.id) : null;
  const isFreePlan = plan?.id === "agency-free";

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tier || !plan) return;
    setSubmitting(true);
    /* Simulamos latencia · backend real tarda ~1-2s con Stripe. */
    setTimeout(() => {
      /* Activamos el pack adecuado según la audience del plan ·
       *  preserva el otro pack del workspace (un promotor que activa
       *  Marketplace mantiene su trial/249/329). */
      if (plan.audience === "agencia") {
        const pack: AgencyPack = plan.id === "agency-marketplace" ? "marketplace" : "free";
        setAgencyPack(user, pack);
      } else if (plan.audience === "promotor") {
        const pack: PromoterPack = plan.id === "promoter-329" ? "promoter_329"
          : plan.id === "promoter-249" ? "promoter_249"
          : "trial";
        setPromoterPack(user, pack);
      } else {
        setPlan(user, tier);
      }
      toast.success(`Plan ${plan.name} activado`, {
        description: isFreePlan
          ? "Tu cuenta gratis está lista · empieza a invitar promotores."
          : "Te enviaremos la factura por email · gracias.",
      });
      setSubmitting(false);
      /* Reset campos · seguridad básica al cerrar. */
      setHolder(""); setCardNumber(""); setExpiry(""); setCvv("");
      onClose();
    }, 800);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header con resumen del plan */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            {isFreePlan ? "Activar plan Gratis" : "Confirmar suscripción"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {plan?.name} · {plan?.price}{plan?.priceNote ? ` ${plan.priceNote}` : ""}
            {plan?.trialNote && (
              <span className="block text-success font-medium mt-1">{plan.trialNote}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Form · sin tarjeta para el plan gratis */}
        <form onSubmit={handleConfirm} className="px-6 py-5 space-y-4">
          {!isFreePlan && (
            <>
              <Field label="Titular de la tarjeta">
                <input
                  required
                  type="text"
                  autoComplete="cc-name"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  placeholder="Nombre y apellidos"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </Field>

              <Field label="Número de tarjeta" icon={<CreditCard className="h-3.5 w-3.5" />}>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, "").slice(0, 19))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Caducidad">
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value.replace(/[^\d/]/g, "").slice(0, 5))}
                    placeholder="MM/AA"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </Field>
                <Field label="CVV">
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </Field>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug">
                <Lock className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={2.25} />
                Pago seguro · cifrado de extremo a extremo · sin permanencia ·
                primera factura en 30 días.
              </p>
            </>
          )}

          {isFreePlan && (
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Sin tarjeta · sin cargos. Tendrás 10 solicitudes propias y
              acceso completo al sistema. Si un promotor te invita, no
              gastas solicitudes.
            </p>
          )}

          {/* Botones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>Procesando…</>
              ) : isFreePlan ? (
                <>Activar gratis<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} /></>
              ) : (
                <>Confirmar y pagar<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} /></>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mb-1.5">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
