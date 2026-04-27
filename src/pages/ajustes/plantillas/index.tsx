/**
 * /ajustes/plantillas · Hub central de TODAS las plantillas del sistema.
 *
 * REGLA DE ORO — ver CLAUDE.md §"Plantillas del sistema":
 * Cualquier plantilla nueva que se cree (email, sistema, notificación,
 * documento, WhatsApp) DEBE registrarse aquí. Esta página es la única
 * fuente de verdad de dónde vive cada plantilla y en qué flujo se
 * dispara. Si un administrador quiere ver qué emails automáticos
 * envía Byvaro, este es el sitio.
 *
 * Categorías:
 *   1. Comunicación comercial (emails que el promotor envía al cliente
 *      o a la agencia desde `SendEmailDialog`).
 *   2. Cuentas y acceso (auth emails · bienvenida, reseteo, invitación).
 *   3. Notificaciones transaccionales (eventos del negocio: registro
 *      recibido, visita programada, contrato firmado, etc.).
 *   4. Documentos (PDFs generados por el sistema).
 *   5. WhatsApp · respuestas rápidas.
 *
 * Cada plantilla declara:
 *   · id, categoría, nombre, descripción corta
 *   · dónde aparece / se dispara (screens/flujos)
 *   · estado: "live" | "planned" · badge visual
 *   · ruta opcional a la pantalla donde se edita (si existe)
 *
 * TODO(backend): endpoint `GET /api/templates` con overrides del
 * tenant (subject/body/brand) para cada plantilla del sistema.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail, UserCheck, Bell, FileText, MessageSquare,
  ArrowUpRight, Search, X, Sparkles, Key, UserPlus,
  ShieldCheck, Home, Handshake, FileSignature, Receipt,
  Calendar, CheckCircle2, XCircle, Send, MailOpen, Phone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TemplateStatus = "live" | "planned";

interface TemplateDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: TemplateStatus;
  /** Flujos/pantallas donde se usa · guía al admin a encontrarla. */
  usedIn: string[];
  /** Ruta para editar (si existe implementación). */
  editHref?: string;
}

interface TemplateCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  templates: TemplateDef[];
}

const CATEGORIES: TemplateCategory[] = [
  /* ══════ 1. Comunicación comercial ══════ */
  {
    id: "commercial",
    title: "Comunicación comercial",
    description: "Emails que envía el promotor o la agencia a clientes y colaboradores desde Byvaro.",
    icon: Mail,
    templates: [
      {
        id: "new-availability",
        label: "Nueva disponibilidad",
        description: "Lista de unidades disponibles con precios actualizados. Se inyecta automáticamente desde la promoción.",
        icon: Home,
        status: "live",
        usedIn: [
          "Ficha de promoción · Enviar email",
          "Tab Agencias · Enviar email a N agencias",
          "Emails · Componer nuevo",
        ],
      },
      {
        id: "new-launch",
        label: "Nuevo lanzamiento",
        description: "Anuncio de una promoción recién publicada a colaboradores o base de clientes.",
        icon: Sparkles,
        status: "live",
        usedIn: [
          "Ficha de promoción · Enviar email",
          "Tab Agencias · Enviar email a N agencias",
        ],
      },
      {
        id: "last-unit",
        label: "Última unidad",
        description: "Se activa solo cuando queda exactamente 1 unidad disponible. Tono de urgencia.",
        icon: Bell,
        status: "live",
        usedIn: [
          "Ficha de promoción · Enviar email",
          "Ficha de unidad · Enviar email",
        ],
      },
      {
        id: "blank",
        label: "Sin plantilla (libre)",
        description: "Email libre con solo la cabecera de marca. Útil para comunicaciones one-off.",
        icon: MailOpen,
        status: "live",
        usedIn: ["Emails · Componer nuevo"],
      },
    ],
  },

  /* ══════ 2. Cuentas y acceso ══════ */
  {
    id: "auth",
    title: "Cuentas y acceso",
    description: "Emails automáticos del ciclo de vida de la cuenta. El usuario no los compone.",
    icon: UserCheck,
    templates: [
      {
        id: "auth-welcome",
        label: "Bienvenida",
        description: "Se envía al dar de alta un usuario · confirma email y sugiere primeros pasos.",
        icon: Sparkles,
        status: "planned",
        usedIn: [
          "Alta de workspace · /register",
          "Alta de miembro · /ajustes/usuarios/miembros",
        ],
      },
      {
        id: "auth-password-reset",
        label: "Reseteo de contraseña",
        description: "Enlace mágico con expiración de 1 hora. Se dispara desde /login → Recuperar.",
        icon: Key,
        status: "planned",
        usedIn: ["Login · Recuperar contraseña"],
      },
      {
        id: "auth-email-verification",
        label: "Verificación de email",
        description: "Confirma la dirección de email al cambiarla en el perfil.",
        icon: ShieldCheck,
        status: "planned",
        usedIn: ["Perfil · Cambiar email"],
      },
      {
        id: "auth-member-invitation",
        label: "Invitación a miembro del equipo",
        description: "El admin invita a un nuevo miembro al workspace. Incluye rol asignado y link de onboarding.",
        icon: UserPlus,
        status: "planned",
        usedIn: ["Ajustes · Miembros del equipo"],
      },
      {
        id: "auth-agency-invitation",
        label: "Invitación a agencia colaboradora",
        description: "El promotor invita a una agencia a colaborar en sus promociones. HTML email-safe (tablas + estilos inline) con hero de la promoción, comisión, duración, forma de pago y CTA. Link con 30d de validez. Generado por `getInvitacionHtml()` · ver `src/lib/invitaciones.ts`.",
        icon: Handshake,
        status: "live",
        usedIn: [
          "Empresa · Invitar agencia",
          "Ficha de promoción · Compartir con agencia",
          "Colaboradores · Invitar agencia",
        ],
      },
      {
        id: "auth-responsible-invitation",
        label: "Invitación al Responsable de la agencia",
        description: "El usuario que crea una agencia vía invitación de promotor declara que él NO es el Responsable y propone al dueño / director real. Se envía email al Responsable con CTA de aceptación · al aceptar toma rol admin y el invitador queda como miembro. Generado por `getResponsibleInviteHtml()` · ver `src/lib/responsibleInviteEmail.ts`.",
        icon: UserPlus,
        status: "live",
        usedIn: [
          "Onboarding agencia · Configura quién será el Responsable · Invitar Responsable",
        ],
      },
      {
        id: "auth-domain-match-notify-admin",
        label: "Aviso al admin · invitado con dominio coincidente",
        description: "Cuando un promotor invita a un email cuyo dominio coincide con una agencia ya registrada en Byvaro pero ese email NO está dado de alta como miembro · se notifica al admin de esa agencia para que invite a la persona al equipo. Una vez aceptado, la persona puede procesar la invitación del promotor. Generado por `getDomainMatchNotifyHtml()` · ver `src/lib/domainMatchNotifyEmail.ts`.",
        icon: ShieldCheck,
        status: "live",
        usedIn: [
          "Cualquier flujo de invitación a agencia · `/invite/:token` detecta dominio match",
        ],
      },
    ],
  },

  /* ══════ 3. Notificaciones transaccionales ══════ */
  {
    id: "transactional",
    title: "Notificaciones transaccionales",
    description: "Emails que Byvaro envía automáticamente cuando ocurre un evento del negocio.",
    icon: Bell,
    templates: [
      {
        id: "tx-registration-received",
        label: "Registro recibido",
        description: "Notifica al promotor que una agencia ha registrado un cliente. Incluye resumen del contacto.",
        icon: FileText,
        status: "planned",
        usedIn: ["Pipeline · Nuevo registro creado por agencia"],
      },
      {
        id: "tx-registration-approved",
        label: "Registro aprobado",
        description: "Notifica a la agencia que su registro ha sido aprobado. Incluye validez en días.",
        icon: CheckCircle2,
        status: "planned",
        usedIn: ["Registros · Aprobar"],
      },
      {
        id: "tx-registration-rejected",
        label: "Registro rechazado",
        description: "Notifica a la agencia que su registro ha sido rechazado. Incluye motivo.",
        icon: XCircle,
        status: "planned",
        usedIn: ["Registros · Rechazar"],
      },
      {
        id: "tx-visit-scheduled",
        label: "Visita programada",
        description: "Confirmación al cliente/agencia con fecha, hora, dirección y mapa.",
        icon: Calendar,
        status: "planned",
        usedIn: ["Calendario · Programar visita"],
      },
      {
        id: "tx-visit-reminder",
        label: "Recordatorio de visita",
        description: "Se envía 24h antes de una visita programada.",
        icon: Bell,
        status: "planned",
        usedIn: ["Cron · 24h antes de la visita"],
      },
      {
        id: "tx-contract-sent",
        label: "Contrato enviado",
        description: "Envío del contrato de colaboración a firmar digitalmente.",
        icon: FileSignature,
        status: "planned",
        usedIn: ["Colaboradores · Enviar contrato"],
      },
      {
        id: "tx-contract-signed",
        label: "Contrato firmado",
        description: "Confirmación bilateral tras la firma del contrato.",
        icon: CheckCircle2,
        status: "planned",
        usedIn: ["Cron · Webhook de firma"],
      },
      {
        id: "tx-sale-closed",
        label: "Venta cerrada",
        description: "Enhorabuena con resumen de la operación y comisión asociada.",
        icon: Send,
        status: "planned",
        usedIn: ["Ventas · Cerrar venta"],
      },
    ],
  },

  /* ══════ 4. Documentos ══════ */
  {
    id: "documents",
    title: "Documentos",
    description: "PDFs que genera el sistema para descarga o adjunto en emails.",
    icon: FileText,
    templates: [
      {
        id: "doc-price-list",
        label: "Listado de precios",
        description: "PDF con las unidades disponibles + precios + plan de pagos. Marca del promotor.",
        icon: Receipt,
        status: "live",
        usedIn: [
          "Ficha de promoción · Acciones rápidas · Listado de precios",
        ],
      },
      {
        id: "doc-brochure",
        label: "Brochure de promoción",
        description: "PDF completo con fotos, plano, memoria de calidades, localización.",
        icon: FileText,
        status: "planned",
        usedIn: [
          "Ficha de promoción · Acciones rápidas · Brochure",
        ],
      },
      {
        id: "doc-collaboration-contract",
        label: "Contrato de colaboración",
        description: "Contrato entre promotor y agencia · comisión + duración + cláusulas estándar.",
        icon: FileSignature,
        status: "planned",
        usedIn: ["Colaboradores · Generar contrato"],
      },
      {
        id: "doc-reservation-proposal",
        label: "Propuesta de reserva",
        description: "Documento de reserva con precio, plan de pagos y plazos para el cliente.",
        icon: Receipt,
        status: "planned",
        usedIn: ["Ficha de unidad · Iniciar compra"],
      },
    ],
  },

  /* ══════ 5. WhatsApp ══════ */
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Respuestas rápidas y mensajes automáticos de WhatsApp Business.",
    icon: MessageSquare,
    templates: [
      {
        id: "wa-quick-replies",
        label: "Respuestas rápidas",
        description: "Snippets predefinidos para insertar en conversaciones (precio, disponibilidad, visita).",
        icon: Phone,
        status: "planned",
        usedIn: ["Contacto · Tab WhatsApp"],
        editHref: "/ajustes/whatsapp/respuestas-rapidas",
      },
      {
        id: "wa-auto-responder",
        label: "Auto-respondedor",
        description: "Mensaje automático fuera de horario laboral.",
        icon: MessageSquare,
        status: "planned",
        usedIn: ["Contacto · Tab WhatsApp"],
        editHref: "/ajustes/whatsapp/auto-respondedor",
      },
    ],
  },
];

export default function AjustesPlantillas() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");

  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORIES
      .filter((c) => activeCategory === "all" || c.id === activeCategory)
      .map((c) => ({
        ...c,
        templates: c.templates.filter((t) => {
          if (!q) return true;
          return (
            t.label.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.usedIn.some((u) => u.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((c) => c.templates.length > 0);
  }, [search, activeCategory]);

  const totalCount = CATEGORIES.reduce((acc, c) => acc + c.templates.length, 0);
  const liveCount = CATEGORIES.reduce(
    (acc, c) => acc + c.templates.filter((t) => t.status === "live").length,
    0,
  );

  return (
    <div className="max-w-[960px] mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ajustes · Plantillas del sistema
        </p>
        <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
          Plantillas del sistema
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Todas las plantillas que Byvaro utiliza para comunicarse: emails que envías, avisos
          automáticos, documentos PDF y respuestas de WhatsApp. {" "}
          <span className="text-foreground font-medium tabular-nums">{liveCount}</span> activas de {" "}
          <span className="text-foreground font-medium tabular-nums">{totalCount}</span> · el resto
          quedan por implementar.
        </p>
      </header>

      {/* Toolbar · search + filtro por categoría */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plantilla o flujo…"
            className="w-full h-9 pl-8 pr-3 rounded-full border border-border bg-card text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-foreground/20 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center"
              aria-label="Limpiar"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          <CategoryPill
            label="Todas"
            count={totalCount}
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c.id}
              label={c.title}
              count={c.templates.length}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Categorías */}
      {visibleCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">Sin resultados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Prueba con otra búsqueda o cambia de categoría.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleCategories.map((c) => {
            const CatIcon = c.icon;
            return (
              <section key={c.id} className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                <div className="px-5 py-3 border-b border-border/40 flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-muted/60 grid place-items-center shrink-0">
                    <CatIcon className="h-4 w-4 text-foreground" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-foreground">
                      {c.title}
                      <span className="ml-2 text-[11px] tabular-nums text-muted-foreground/80 font-normal">
                        {c.templates.length}
                      </span>
                    </h2>
                    <p className="text-[11.5px] text-muted-foreground leading-snug">{c.description}</p>
                  </div>
                </div>
                <ul className="divide-y divide-border/50">
                  {c.templates.map((t) => <TemplateRow key={t.id} template={t} />)}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Nota al pie · regla de oro */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-muted/30 p-4 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          <span className="text-foreground font-medium">Regla de oro.</span> Cualquier plantilla que
          se cree en el producto (email, notificación, documento, WhatsApp) debe aparecer aquí. Es
          la fuente única de verdad sobre qué comunicaciones envía Byvaro y desde qué flujo. Ver la
          sección "Plantillas del sistema" en <code className="text-[11px]">CLAUDE.md</code>.
        </p>
      </div>
    </div>
  );
}

/* ═════ Sub-componentes ═════ */

function CategoryPill({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-card border border-border text-foreground hover:bg-muted",
      )}
    >
      {label}
      <span className={cn(
        "tabular-nums text-[10.5px]",
        active ? "text-background/70" : "text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}

function TemplateRow({ template: t }: { template: TemplateDef }) {
  const Icon = t.icon;
  const isLive = t.status === "live";
  const Container = t.editHref ? Link : "div";
  const containerProps = t.editHref ? { to: t.editHref } : {};
  return (
    <li>
      <Container
        {...(containerProps as any)}
        className={cn(
          "flex items-start gap-3 px-5 py-3.5 transition-colors",
          t.editHref ? "hover:bg-muted/30 cursor-pointer group" : "",
        )}
      >
        <span className="h-8 w-8 rounded-lg bg-muted/50 grid place-items-center shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn(
              "text-sm font-semibold truncate",
              isLive ? "text-foreground" : "text-muted-foreground",
            )}>
              {t.label}
            </p>
            <StatusBadge status={t.status} />
          </div>
          <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
            {t.description}
          </p>
          {t.usedIn.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Se usa en
              </span>
              {t.usedIn.map((u, i) => (
                <span
                  key={i}
                  className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10.5px] text-foreground/80"
                >
                  {u}
                </span>
              ))}
            </div>
          )}
        </div>
        {t.editHref && (
          <ArrowUpRight
            className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0 mt-1"
            strokeWidth={1.5}
          />
        )}
      </Container>
    </li>
  );
}

function StatusBadge({ status }: { status: TemplateStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-success/25 bg-success/10 text-[10px] font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Activa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-border bg-muted/40 text-[10px] font-medium text-muted-foreground">
      Planificada
    </span>
  );
}
