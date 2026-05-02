/**
 * AppSidebar — Navbar principal desktop (≥lg).
 *
 * Modos:
 *   - **Expanded** (236px): grupos con labels, items con icono + título
 *     + badge. Es el estado por defecto.
 *   - **Collapsed** (56px): solo iconos centrados, labels y badges
 *     ocultos. Tooltip nativo (`title`) con el nombre. Se activa
 *     automáticamente en las rutas listadas en `COLLAPSED_ROUTES`
 *     (hoy: `/emails`) — patrón replicado del ref Lovable para dar
 *     ancho al cliente de correo sin hacer desaparecer la navegación.
 */

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Building, FileText, CircleDollarSign, CalendarDays,
  Handshake, Contact, Globe, Mail, Settings, ChevronsUpDown, FileSignature,
  Building2, Inbox, User as UserIcon, LogOut, Users, Activity, Sparkles,
  KeyRound, LayoutGrid, Crown, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/lib/empresa";
import { usePlanState } from "@/lib/plan";
import { BrandLogo } from "@/components/BrandLogo";
import { useCurrentUser } from "@/lib/currentUser";
import { currentOrgIdentity } from "@/lib/orgCollabRequests";
import { useInvitaciones } from "@/lib/invitaciones";
import { agencies } from "@/data/agencies";
import { useHasPermission } from "@/lib/permissions";
import { onAgencyOnboardingChanged } from "@/lib/agencyOnboarding";
import { logout } from "@/lib/accountType";
import { registros as seedRegistros } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { sales as seedSales } from "@/data/sales";

/** Audiences del item · array con los packs que lo desbloquean.
 *  · `undefined` o `[]` · siempre visible · CRM general (Inicio,
 *    Calendario, Contactos, Emails, etc.).
 *  · `["promoter"]` · solo visible si `promoter_pack !== 'none'`
 *    (Microsites, Actividad, Sugerencias, /colaboradores).
 *  · `["agency"]` · solo visible si `agency_pack !== 'none'`
 *    (/promotores).
 *  · `["promoter", "agency"]` · visible si CUALQUIERA de los 2
 *    packs está activo (Promociones, Inmuebles, etc. · útil para
 *    el promotor con sus promos Y para la agencia con su catálogo).
 *
 *  Si el item está locked (ningún pack del audiences activo), se
 *  renderiza con candado y click muestra toast:
 *   · admin → "Activa el módulo X" + link a /planes.
 *   · member → "Pídele al admin que active el módulo X". */
type NavAudience = "promoter" | "agency";
type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  accent?: boolean;
  accentColor?: "primary" | "destructive";
  audiences?: NavAudience[];
};
type NavGroup = { label: string; items: NavItem[] };

/** Rutas donde la sidebar se colapsa automáticamente a icon-only. */
const COLLAPSED_ROUTES = ["/emails"];

const groups: NavGroup[] = [
  {
    label: "General",
    items: [
      { title: "Inicio", url: "/inicio", icon: Home },
      /* Actividad y Sugerencias · dashboards del lado promotor ·
       *  KPIs sobre SUS promociones / agencias · no aplican al
       *  pack agencia. */
      { title: "Actividad", url: "/actividad", icon: Activity, audiences: ["promoter"] },
      { title: "Sugerencias", url: "/sugerencias", icon: Sparkles, audiences: ["promoter"] },
    ],
  },
  {
    label: "Comercial",
    items: [
      /* Promociones · Inmuebles · Inmuebles cuadrícula · visibles si
       *  CUALQUIERA de los 2 packs está activo (promotor ve sus
       *  promociones · agencia ve el catálogo donde colabora).
       *  Sin ningún pack activo (Plan Básico puro post-trial), se
       *  bloquean. */
      { title: "Promociones", url: "/promociones", icon: Building, audiences: ["promoter", "agency"] },
      { title: "Inmuebles", url: "/inmuebles", icon: KeyRound, audiences: ["promoter", "agency"] },
      { title: "Inmuebles · cuadrícula", url: "/inmuebles/cuadricula", icon: LayoutGrid, audiences: ["promoter", "agency"] },
      { title: "Oportunidades", url: "/oportunidades", icon: Inbox },
      { title: "Registros", url: "/registros", icon: FileText },
      { title: "Ventas", url: "/ventas", icon: CircleDollarSign },
      { title: "Calendario", url: "/calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Red",
    items: [
      /* Promotores & comercializadores · directorio que la INMOBILIARIA
       *  consume desde el pack agencia · permite buscar y solicitar
       *  colaboración con promotores externos. Sin pack agencia activo,
       *  no tiene sentido. */
      { title: "Promotores & comercializadores", url: "/promotores", icon: Building, audiences: ["agency"] },
      /* Inmobiliarias · lado promotor · gestión de las agencias que
       *  colaboran con SUS promociones. Sin pack promotor (no hay
       *  promociones propias), no aplica. */
      { title: "Inmobiliarias", url: "/colaboradores", icon: Handshake, audiences: ["promoter"] },
      { title: "Inmobiliarias test", url: "/colaboradores-test", icon: Handshake, audiences: ["promoter"] },
      { title: "Contratos", url: "/contratos", icon: FileSignature },
      { title: "Contactos", url: "/contactos", icon: Contact },
    ],
  },
  {
    label: "Contenido",
    items: [
      /* Microsites · solo aplica al promotor (microsite POR promoción
       *  propia). Sin pack promotor, no hay nada que renderizar. */
      { title: "Microsites", url: "/microsites", icon: Globe, audiences: ["promoter"] },
      { title: "Emails", url: "/emails", icon: Mail },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";

  /* Plan packs activos · usado para resolver `isLockedItem(item)`.
   *  Un item se bloquea si su `audiences` no incluye ningún pack
   *  activo. Member ve el item con candado pero no puede activar
   *  nada · admin click → toast con CTA "Ver planes". */
  const planState = usePlanState();
  const promoterActive = planState.promoterPack !== "none";
  const agencyActive = planState.agencyPack !== "none";
  const isAdmin = currentUser.role === "admin";

  const isLockedItem = (audiences?: NavAudience[]): boolean => {
    if (!audiences || audiences.length === 0) return false;
    /* Visible si alguno de sus audiences está activo. */
    return !audiences.some((a) =>
      (a === "promoter" && promoterActive) ||
      (a === "agency" && agencyActive),
    );
  };

  /* Etiqueta humana del módulo bloqueante · primer audience del
   *  array · típicamente "promoter" o "agency". */
  const audienceLabel = (audiences?: NavAudience[]): string => {
    if (!audiences || audiences.length === 0) return "";
    /* Si el item necesita CUALQUIERA de los 2, mostramos los dos
     *  para que el user sepa con qué se desbloquea. */
    if (audiences.length === 2) return "Promotor o Agencia Inmobiliaria";
    return audiences[0] === "agency" ? "Agencia Inmobiliaria" : "Promotor";
  };

  const handleLockedClick = (e: React.MouseEvent, audiences?: NavAudience[]) => {
    e.preventDefault();
    const moduleLabel = audienceLabel(audiences);
    if (isAdmin) {
      toast.info(`Activa el módulo ${moduleLabel}`, {
        description: "Necesitas activarlo para acceder a esta sección.",
        action: {
          label: "Ver planes",
          onClick: () => navigate("/planes"),
        },
      });
    } else {
      toast.info(`Pídele al admin que active el módulo ${moduleLabel}`, {
        description: "Solo el administrador de la cuenta puede activar módulos del plan.",
      });
    }
  };
  /* Empresa / Equipo / Ajustes · solo admin del workspace · datos
   *  fiscales, miembros, billing, integraciones, plan. El member NO
   *  los ve.
   *
   * El setup del Responsable pendiente NO oculta los links · el admin
   * de una agencia recién creada SÍ los ve para conocer su existencia.
   * Al hacer click, el `<CriticalActionGuard>` de la ruta abre el
   * modal y obliga a confirmar Responsable o invitar al real antes
   * de poder entrar (regla CLAUDE.md "Setup de Responsable bloquea
   * acciones críticas"). */
  /* Listener · re-render cuando cambia el estado de onboarding (otra
   * pestaña, mismo tab tras completar el setup, etc.). Sin esto el
   * sidebar no se entera y los enlaces de Empresa/Equipo/Ajustes
   * quedan stale (mostrando o no según el último render). */
  const [, tickOnboarding] = useState(0);
  useEffect(() => onAgencyOnboardingChanged(() => tickOnboarding((n) => n + 1)), []);
  const canSeeAjustes = currentUser.role === "admin";
  // CLAUDE.md · "Datos sensibles requieren permiso" · /actividad
  // oculta del sidebar si el user no tiene la key. El gate real vive
  // en la página (early return); esta ocultación es por UX, no por
  // seguridad.
  const canSeeActivity = useHasPermission("activity.dashboard.view");

  const onEmpresaRoute = location.pathname.startsWith("/empresa");
  const necesitaOnboarding = !empresa.onboardingCompleto;
  const collapsed = COLLAPSED_ROUTES.some((r) => location.pathname.startsWith(r));

  /* Dropdown del botón de usuario (pie del sidebar) · abre arriba porque
   * el botón vive en la última fila. Cierra al clicar fuera o elegir opción. */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  /* En modo agencia, oculta rutas que sólo tienen sentido para el
   * promotor. Estas mismas rutas se redirigen en App.tsx vía
   * <AgencyGuard> si el usuario entra por URL directa.
   *
   * El miembro / responsable de agencia SÍ ve:
   *   Inicio · Contactos · Emails · Calendario · Oportunidades · Ventas
   *   · Registros · Promociones (las que colabora) · Colaboradores
   *   (mirror · lista de promotores con los que colabora).
   * No ve: Microsites · Actividad (admin del promotor) · Sugerencias. */
  const agencyHiddenRoutes = new Set([
    "/microsites",
    "/actividad",
    "/sugerencias",
    /* Contratos · NO solicitado en la lista de la agencia
     * (Inicio, Contactos, Emails, Calendario, Oportunidades, Ventas,
     * Registros, Promotores). Si más adelante hace falta, se mete una
     * versión filtrada por agencyId. */
    "/contratos",
    /* Inmobiliarias (`/colaboradores`) · visible también para
     *  agencias · `ColaboradoresAgencyView` muestra al promotor
     *  con el que colabora + otras inmobiliarias en la red. */
    /* Test variant queda oculta del lado agencia (es PromotorOnly
     *  a nivel de ruta · sin sentido en el sidebar). */
    "/colaboradores-test",
  ]);
  const permissionHiddenRoutes = new Set<string>();
  if (!canSeeActivity) permissionHiddenRoutes.add("/actividad");

  /* Invitaciones pendientes del agente · red pill en /promociones.
     Solo aplica a cuentas de agencia. Match por agencyId OR email. */
  const { pendientes: allPendientes } = useInvitaciones();

  /* SCOPE GLOBAL · set de promo IDs del workspace logueado · Carlos
   *  AEDAS no debe contar promos / ventas / registros de Luxinmo en
   *  los badges del sidebar (idem para Marta Neinor, Sara Metrovacesa).
   *  Mismo patrón que Inicio.tsx · Ventas.tsx · Registros.tsx. */
  const myOrgId = currentOrgIdentity(currentUser).orgId;
  const myPromoIds = useMemo(() => {
    const all = [...promotions, ...developerOnlyPromotions];
    return new Set(
      all
        .filter((p) => (p.ownerOrganizationId ?? "developer-default") === myOrgId)
        .map((p) => p.id),
    );
  }, [myOrgId]);

  /* Registros pendientes · badge rojo dinámico en el nav.
     Para agencia: solo los que envió ella · member filtra por audit.
     Para developer: solo registros cuyo promotionId pertenece a su org. */
  const createdRegs = useCreatedRegistros();
  const pendingRegistrosCount = useMemo(() => {
    const all = [...createdRegs, ...seedRegistros];
    let scope = isAgencyUser && currentUser.agencyId
      ? all.filter((r) => r.agencyId === currentUser.agencyId)
      : all.filter((r) => !r.promotionId || myPromoIds.has(r.promotionId));
    /* viewOwn · member solo ve los suyos · CLAUDE.md permissions.md. */
    if (currentUser.role === "member") {
      const myEmail = currentUser.email.toLowerCase();
      scope = scope.filter((r) =>
        r.audit?.actor.email?.toLowerCase() === myEmail,
      );
    }
    return scope.filter((r) => r.estado === "pendiente").length;
  }, [createdRegs, isAgencyUser, currentUser.agencyId, currentUser.role, currentUser.email, myPromoIds]);
  const agencyEmail = useMemo(() => {
    if (!isAgencyUser || !currentUser.agencyId) return null;
    const a = agencies.find((x) => x.id === currentUser.agencyId);
    return a?.contactoPrincipal?.email?.toLowerCase() ?? null;
  }, [isAgencyUser, currentUser.agencyId]);
  const pendingInvitations = useMemo(() => {
    if (!isAgencyUser || !currentUser.agencyId) return 0;
    return allPendientes.filter((i) =>
      i.agencyId === currentUser.agencyId ||
      (agencyEmail && i.emailAgencia.toLowerCase() === agencyEmail),
    ).length;
  }, [allPendientes, isAgencyUser, currentUser.agencyId, agencyEmail]);

  /* Promociones · conteo real para mostrar en badge.
   *  Promotor → SUS promociones activas (scoped por org).
   *  Agencia  → si tiene invitaciones pendientes, ese es el badge
   *             rojo (atención · click pa añadir a cartera). Si no,
   *             sin badge (la página interna ya cuenta la cartera). */
  const promocionesCount = useMemo(() => {
    if (isAgencyUser) return pendingInvitations; // 0 → sin badge
    return [
      ...promotions.filter((p) => p.status === "active"),
      ...developerOnlyPromotions.filter((p) => p.status === "active"),
    ].filter((p) => myPromoIds.has(p.id)).length;
  }, [isAgencyUser, pendingInvitations, myPromoIds]);

  /* Ventas · conteo real.
   *  Promotor → ventas no caídas de SUS promociones.
   *  Agencia admin → ventas no caídas de su agencia.
   *  Agencia member → solo las suyas (audit.actor.email · viewOwn). */
  const ventasCount = useMemo(() => {
    const live = seedSales.filter((v) => v.estado !== "caida");
    if (!isAgencyUser || !currentUser.agencyId) {
      /* Developer · scope por workspace · Carlos AEDAS no cuenta
       *  ventas de Luxinmo en su badge. */
      return live.filter((v) => v.promotionId && myPromoIds.has(v.promotionId)).length;
    }
    const byAgency = live.filter((v) => v.agencyId === currentUser.agencyId);
    if (currentUser.role === "member") {
      const myEmail = currentUser.email.toLowerCase();
      return byAgency.filter((v) =>
        v.audit?.actor.email?.toLowerCase() === myEmail,
      ).length;
    }
    return byAgency.length;
  }, [isAgencyUser, currentUser.agencyId, currentUser.role, currentUser.email, myPromoIds]);

  const visibleGroups = (isAgencyUser
    ? groups.map((g) => ({
        ...g,
        items: g.items.filter((it) => !agencyHiddenRoutes.has(it.url)),
      }))
    : groups
  )
    .map((g) => ({
      ...g,
      items: g.items
        .filter((it) => !permissionHiddenRoutes.has(it.url))
        .map((it) => {
          /* Promociones · label dinámico por rol del workspace.
           *  · agency-only · "Promociones" · catálogo donde colabora ·
           *    badge rojo si hay invitaciones pendientes.
           *  · developer-only · "Mis Promociones" · sus propias promos ·
           *    badge con conteo de promos activas.
           *  TODO(hybrid · pack activation) · cuando un workspace tenga
           *  ambos roles activos (ver `Empresa.kinds`), mostrar DOS
           *  items: "Promociones" → /promociones (vista agency) y
           *  "Mis Promociones" → /mis-promociones (vista developer).
           *  Hoy es uno solo según accountType. */
          if (it.url === "/promociones") {
            if (isAgencyUser) {
              return {
                ...it,
                badge: pendingInvitations > 0 ? pendingInvitations : undefined,
                accent: pendingInvitations > 0,
                accentColor: "destructive" as const,
              };
            }
            return {
              ...it,
              title: "Mis Promociones",
              badge: promocionesCount > 0 ? promocionesCount : undefined,
            };
          }
          /* Ventas · conteo real (live · no caída). */
          if (it.url === "/ventas") {
            return {
              ...it,
              badge: ventasCount > 0 ? ventasCount : undefined,
            };
          }
          /* Registros · badge rojo con el nº real de pendientes. */
          if (it.url === "/registros") {
            return {
              ...it,
              badge: pendingRegistrosCount > 0 ? pendingRegistrosCount : undefined,
              accent: pendingRegistrosCount > 0,
              accentColor: "destructive" as const,
            };
          }
          /* Oportunidades · el badge `24` es seed mock del promotor.
           *  Para la agencia no tiene sentido (ella ve solo las suyas).
           *  Hasta tener conteo real, lo escondemos en agencia. */
          if (isAgencyUser && it.url === "/oportunidades") {
            return { ...it, badge: undefined, accent: false };
          }
          /* Promociones developer-side · el `12` también es mock.
           *  Si llega backend lo dejamos dinámico, mientras tanto el
           *  badge mock sigue para promotor pero NO debe sangrar a la
           *  agencia que ya tiene su override arriba. */
          return it;
        }),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar sticky top-0 h-screen transition-[width] duration-200",
        collapsed ? "w-14" : "w-[265px]",
      )}
    >
      {/* Logo — en modo colapsado, solo isotipo centrado */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <BrandLogo
          variant={collapsed ? "icon" : "lockup"}
          iconSize={collapsed ? 28 : 32}
          wordmarkHeight={16}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
        {visibleGroups.map((group) => (
          <div key={group.label} className={collapsed ? "mb-2" : "mb-5"}>
            {!collapsed && (
              <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 mb-2">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.url;
              const Icon = item.icon;
              const locked = isLockedItem(item.audiences);
              const moduleLabel = audienceLabel(item.audiences);

              /* Item bloqueado · NO navega · click muestra toast.
               *  Member solo "ve", admin tiene CTA hacia /planes. */
              if (locked) {
                return (
                  <button
                    key={item.url}
                    type="button"
                    onClick={(e) => handleLockedClick(e, item.audiences)}
                    title={collapsed
                      ? `${item.title} · módulo ${moduleLabel} sin activar`
                      : `Módulo ${moduleLabel} sin activar`}
                    className={cn(
                      "relative flex items-center transition-colors w-full text-left",
                      collapsed
                        ? "justify-center h-10 mx-2 rounded-lg"
                        : "gap-3 px-5 py-2 text-sm",
                      "text-sidebar-foreground/40 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent/20 cursor-pointer",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate min-w-0">{item.title}</span>
                        <Lock className="ml-auto h-3 w-3 shrink-0 text-sidebar-foreground/40" strokeWidth={2} />
                      </>
                    )}
                    {collapsed && (
                      <span
                        className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sidebar-foreground/30"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "relative flex items-center transition-colors",
                    collapsed
                      ? "justify-center h-10 mx-2 rounded-lg"
                      : "gap-3 px-5 py-2 text-sm",
                    isActive
                      ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/40",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate min-w-0">{item.title}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={cn(
                        "ml-auto text-[11px] tnum font-semibold rounded-md",
                        item.accentColor === "destructive"
                          ? "text-destructive-foreground bg-destructive px-1.5 py-px"
                          : item.accent
                            ? "text-primary bg-primary/10 px-1.5 py-px"
                            : "text-sidebar-foreground/50",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {collapsed && item.badge !== undefined && (
                    <span
                      className={cn(
                        "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                        item.accentColor === "destructive"
                          ? "bg-destructive"
                          : item.accent ? "bg-primary" : "bg-sidebar-foreground/40",
                      )}
                      aria-hidden
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* ═════ Administración · admin con setup completo ═════
         *  Aplica a developer admin (siempre) y a agency admin con su
         *  setup de Responsable confirmado. El member NO ve esta
         *  sección · tampoco el agency admin con setup pendiente. */}
        {canSeeAjustes && (
        <div className={collapsed ? "mb-2" : "mb-5"}>
          {!collapsed && (
            <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 mb-2">
              Administración
            </div>
          )}
          <NavLink
            to="/empresa"
            title={collapsed ? "Empresa" : undefined}
            className={cn(
              "relative flex items-center transition-colors",
              collapsed
                ? "justify-center h-10 mx-2 rounded-lg"
                : "gap-3 px-5 py-2 text-sm",
              onEmpresaRoute
                ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                : "text-sidebar-foreground hover:bg-sidebar-accent/40",
            )}
          >
            <Building2 className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Empresa</span>}
            {necesitaOnboarding && (
              <span
                className={cn(
                  "rounded-full bg-primary animate-pulse",
                  collapsed ? "absolute top-1 right-1 h-1.5 w-1.5" : "ml-auto h-1.5 w-1.5",
                )}
                aria-label="Pendiente de configurar"
              />
            )}
          </NavLink>

          {/* Equipo · vive junto a Empresa porque conceptualmente es parte
           *  del perfil organizativo (miembros que aparecen en el microsite,
           *  plan de comisiones, invitaciones). */}
          <NavLink
            to="/equipo"
            title={collapsed ? "Equipo" : undefined}
            className={({ isActive }) =>
              cn(
                "relative flex items-center transition-colors",
                collapsed
                  ? "justify-center h-10 mx-2 rounded-lg"
                  : "gap-3 px-5 py-2 text-sm",
                isActive
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/40",
              )
            }
          >
            <Users className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Equipo</span>}
          </NavLink>
        </div>
        )}
      </nav>

      {/* Footer · "Ajustes" solo para admin · el member no gestiona
       *  empresa, equipo, billing ni integraciones. */}
      <div className="border-t border-sidebar-border py-3">
        {canSeeAjustes && (
          <NavLink
            to="/ajustes"
            title={collapsed ? "Ajustes" : undefined}
            className={({ isActive }) =>
              cn(
                "relative flex items-center transition-colors",
                collapsed
                  ? "justify-center h-10 mx-2 rounded-lg"
                  : "gap-3 px-5 py-2 text-sm",
                isActive
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/40",
              )
            }
          >
            <Settings className="h-[18px] w-[18px]" />
            {!collapsed && <span>Ajustes</span>}
          </NavLink>
        )}
        <div
          ref={userMenuRef}
          className={cn(
            "relative mt-2 pt-3 border-t border-sidebar-border/60",
            collapsed ? "px-2" : "px-4",
          )}
        >
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title={collapsed ? currentUser.name : undefined}
            className={cn(
              "w-full flex items-center rounded-lg transition-colors",
              userMenuOpen ? "bg-sidebar-accent/60" : "hover:bg-sidebar-accent/40",
              collapsed ? "justify-center py-2" : "gap-3 px-2 py-2",
            )}
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-xs tnum shrink-0">
                {currentUser.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
                      {currentUser.name}
                    </span>
                    {/* Badge `Admin` solo si el rol es admin · ayuda al
                     *  usuario a recordar de un vistazo qué puede hacer
                     *  vs un member sin Settings/billing/roles. */}
                    {currentUser.role === "admin" && (
                      <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-primary/10 text-primary text-[9.5px] font-semibold uppercase tracking-wide shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {isAgencyUser
                      ? `${currentUser.agencyName ?? "Agencia"} · Agencia`
                      : empresa.nombreComercial
                        ? `${empresa.nombreComercial} · Promotor`
                        : "Luxinmo · Promotor"}
                  </div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </>
            )}
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute z-40 rounded-xl border border-border bg-card shadow-soft-lg overflow-hidden",
                // Abre arriba del botón · ancho fijo en modo expanded,
                // flotante a la derecha en modo collapsed.
                collapsed
                  ? "left-[calc(100%+8px)] bottom-0 w-56"
                  : "left-4 right-4 bottom-[calc(100%+6px)]",
              )}
            >
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[13px] font-semibold text-foreground truncate">{currentUser.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{currentUser.email}</p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/ajustes/perfil/personal");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
                >
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Mi perfil
                </button>
                {canSeeAjustes && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/planes");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Crown className="h-4 w-4 text-muted-foreground" />
                    Mi plan
                  </button>
                )}
                {canSeeAjustes && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/ajustes");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Ajustes
                  </button>
                )}
              </div>
              <div className="border-t border-border py-1">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                    navigate("/login", { replace: true });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
