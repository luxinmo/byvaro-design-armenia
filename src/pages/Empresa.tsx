/**
 * /empresa · perfil completo de la empresa.
 *
 * Réplica del CompanyProfile del Lovable adaptado a los componentes
 * Byvaro. Estructura:
 *   - Banner amarillo arriba si perfil incompleto (progress %)
 *   - Breadcrumb + toggle "Ver como usuario" / "Volver a editar"
 *   - Card hero: cover + logo circular + nombre + badge verificado +
 *     subtitle + pill website + tabs (Home · About · Agents ·
 *     Statistics disabled)
 *   - Columna principal con el tab activo + sidebar derecha (solo en
 *     tab=home && viewMode=edit)
 *
 * Cálculo de "profile completion": 6 checks (overview, logo, cover,
 * agents, locations, about). Cada uno ≈17%.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTabParam } from "@/lib/useTabParam";
import {
  Eye, CheckCircle2, Camera, Image as ImageIcon,
} from "lucide-react";
import { useEmpresa, useOficinas } from "@/lib/empresa";
import { uploadOrgLogo, uploadOrgCover } from "@/lib/storage";
import { useEmpresaStats } from "@/lib/empresaStats";
import { useCurrentUser } from "@/lib/currentUser";
import { agencies } from "@/data/agencies";
import { hasActiveDeveloperCollab, DEFAULT_DEVELOPER_ID } from "@/lib/developerNavigation";
import { getPublicRef } from "@/lib/tenantRefResolver";
import { cn } from "@/lib/utils";
import { EmpresaHomeTab } from "@/components/empresa/EmpresaHomeTab";
import { EmpresaAboutTab } from "@/components/empresa/EmpresaAboutTab";
import { EmpresaAgentsTab } from "@/components/empresa/EmpresaAgentsTab";
import { EmpresaSidebar } from "@/components/empresa/EmpresaSidebar";
import { ImageCropModal } from "@/components/empresa/ImageCropModal";
import { HeroSocialIcons } from "@/components/empresa/HeroSocialIcons";
import { HeroGoogleRating } from "@/components/empresa/HeroGoogleRating";
import { DefaultCoverPattern } from "@/components/empresa/DefaultCoverPattern";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge"; // Toaster global en App.tsx
import {
  useEmpresaCategories,
  EMPRESA_CATEGORY_LABELS,
  type EmpresaCategory,
} from "@/lib/empresaCategories";
import {
  getMyOwnEmpresa,
  hasMinimumIdentityData,
  currentOrgIdentity,
  crearOrgCollabRequest,
  useHasPendingRequestTo,
  type OrgKind,
} from "@/lib/orgCollabRequests";
import { AlertTriangle, Lock, Send, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { Empresa as EmpresaType } from "@/lib/empresa";
import type { CurrentUser } from "@/lib/currentUser";

const TAB_KEYS = ["home", "about", "agents"] as const;
type Tab = typeof TAB_KEYS[number];

/**
 * Props opcionales:
 *   - tenantId   · si viene, renderizamos el perfil PÚBLICO de OTRO tenant
 *                  (modo "visitor"). Usado por `/colaboradores/:id`.
 *   - visitorSlot · contenido propio del que visita (p.ej. overlay
 *                  promotor-specific con contrato + acciones). Se renderiza
 *                  antes del hero.
 *   - visitorFooter · barra sticky inferior con acciones (aprobar, pausar,
 *                    eliminar, compartir). Solo en modo visitor.
 */
export default function Empresa({
  tenantId,
  visitorSlot,
  visitorHeaderRight,
  visitorFooter,
}: {
  tenantId?: string;
  visitorSlot?: React.ReactNode;
  visitorHeaderRight?: React.ReactNode;
  visitorFooter?: React.ReactNode;
} = {}) {
  /* En modo agencia sin tenantId explícito, `/empresa` muestra la
   * ficha de la propia agencia (no la del promotor). Se carga como
   * visitor hasta que añadamos edición multi-tenant — mejor que
   * filtrar datos del promotor. */
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";

  /** Back que respeta el historial real · si el usuario llegó desde la
   *  tab Agencias de una promoción, vuelve ahí; si llegó desde el
   *  listado general `/colaboradores`, vuelve ahí. Solo si no hay
   *  historial (deep link directo) cae al listado. */
  const handleBack = () => {
    // window.history.length incluye otras pestañas/sesiones, así que
    // usamos navigate(-1) y un fallback si no hay referrer propio.
    const hasSameOriginReferrer = typeof document !== "undefined"
      && document.referrer
      && document.referrer.startsWith(window.location.origin);
    if (hasSameOriginReferrer || window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/colaboradores");
    }
  };
  /* `effectiveTenantId` · si el caller pasa `tenantId` (rutas
   *  `/colaboradores/:id`, `/promotor/:id`), ése manda. Si no, no
   *  forzamos un tenantId · `useEmpresa` lo resolverá al orgId del
   *  workspace logueado · garantiza que el dueño edite su propia
   *  ficha (developer o agency) sin pasar por el modo visitor.
   *
   *  REGLA · `isVisitor` lo decide `useEmpresa` comparando el orgId
   *  del tenantId contra el del usuario · NO lo decidamos aquí en
   *  función de accountType. */
  const effectiveTenantId = tenantId;
  const { empresa, update, isVisitor, canEdit } = useEmpresa(effectiveTenantId);
  /* Oficinas scoped al tenant que se está mostrando · evita fuga
   *  de las oficinas del workspace logueado (Luxinmo) en la ficha
   *  de otra empresa. */
  const { oficinas } = useOficinas(effectiveTenantId);
  const stats = useEmpresaStats(empresa, oficinas.length, effectiveTenantId);

  /* Tipo de entidad para los KPIs del HeroStatsStrip. Es ortogonal a
   * `isVisitor`: la ficha de un promotor (sea propia o vista por una
   * agencia desde /promotor/:id) usa los tiles de portfolio. La ficha
   * de una agencia (sea propia o vista por un promotor desde
   * /colaboradores/:id) usa los tiles operativos. Heurística:
   *   · sin tenantId Y usuario es agency → ficha propia agencia.
   *   · sin tenantId Y usuario es developer → ficha propia developer.
   *   · tenantId con prefijo "developer-" → developer profile.
   *   · cualquier otro tenantId → agency profile.
   */
  /* `prom-*` IDs son promotores externos (seed `promotores.ts`) ·
   *  para la ficha pública se tratan como entidad developer. */
  const isExternalPromotor = !!effectiveTenantId
    && effectiveTenantId.startsWith("prom-");
  const entityType: "developer" | "agency" =
    !effectiveTenantId
      ? (isAgencyUser ? "agency" : "developer")
      : effectiveTenantId.startsWith("developer-") || isExternalPromotor
        ? "developer"
        : "agency";

  /* Categorías canónicas (Inmobiliaria · Promotor · Comercializador).
   *  Para el workspace developer (Luxinmo) y promotores externos
   *  derivamos por entityType=developer. Para promotores externos en
   *  el mock single-tenant solo tenemos categoría "Promotor"
   *  hardcoded · cuando aterrice backend, vendrá del endpoint
   *  /categorias scoped al organization_id. */
  const baseCategories = useEmpresaCategories({ accountType: entityType });
  const heroCategories = isExternalPromotor
    ? (["promotor"] as typeof baseCategories)
    : baseCategories;

  /* ─── Teaser de "ficha avanzada" · solo se muestra en modo visitor.
   *
   *  panelHref · ruta del panel operativo de la entidad mostrada:
   *    · entityType="developer" → `/promotor/:id/panel`
   *    · entityType="agency"    → `/colaboradores/:id/panel`
   *
   *  hasActiveCollab · ¿el usuario logueado y la entidad mostrada
   *  comparten un vínculo activo? "Activo" aquí incluye invitación
   *  abierta, colaboración firmada o colaboración pausada — la
   *  ficha pública es el fallback solo cuando no hay nada entre las
   *  dos empresas. Se evalúa según el cruce de roles:
   *    · agency viendo developer  → hasActiveDeveloperCollab(user).
   *    · developer viendo agency  → leemos status/estado de la agency
   *      mostrada (cualquier estado distinto de pending sin contrato
   *      cuenta).
   */
  /* URL canónica · usa `IDXXXXXX` (publicRef) en vez del id interno
   *  cuando esté disponible. */
  const tenantRef = effectiveTenantId
    ? (getPublicRef(effectiveTenantId) || effectiveTenantId)
    : undefined;
  const panelHref = tenantRef
    ? (entityType === "developer"
      ? `/promotor/${tenantRef}/panel`
      : `/colaboradores/${tenantRef}/panel`)
    : undefined;

  /* `hasActiveCollab` · ¿hay UN VÍNCULO VIVO entre yo y la entidad
   *  visitada? Se usa para decidir si tiene sentido mostrar el panel
   *  operativo, hide del CTA "Enviar solicitud", etc.
   *
   *  IMPORTANTE: ESTA función NO decide visibilidad de datos
   *  sensibles · esa decisión vive aparte (`canViewSensitiveDetails`)
   *  con regla más estricta. "Vivo" aquí incluye paused/contrato-
   *  pendiente porque la UI quiere ofrecer continuidad operativa
   *  (ver el historial, el panel) aunque la colaboración esté en
   *  stand-by. */
  const hasActiveCollab = (() => {
    if (!isVisitor) return false;
    if (entityType === "developer") {
      return hasActiveDeveloperCollab(currentUser);
    }
    if (isAgencyUser) return false;
    const ag = agencies.find((x) => x.id === effectiveTenantId);
    if (!ag) return false;
    if (ag.status === "active") return true;
    if (ag.estadoColaboracion === "activa") return true;
    if (ag.estadoColaboracion === "contrato-pendiente") return true;
    if (ag.estadoColaboracion === "pausada") return true;
    return false;
  })();

  /* `hasFullActiveOrgCollab` · vínculo TOTALMENTE activo a nivel de
   *  ORGANIZACIÓN. Más estricto que `hasActiveCollab` · solo cubre
   *  `estadoColaboracion === "activa"` (mock) · backend equivalente:
   *  `organization_collaborations.status = 'active'`.
   *
   *  Estados que NO cuentan como "fully active":
   *    · `pausada` · stand-by · no acceso a datos sensibles.
   *    · `contrato-pendiente` (org-level) · sin contrato firmado · no.
   *
   *  Backend doc reference · §6.2 sensitive access requires either:
   *    a) `organization_collaborations.status = 'active'`, OR
   *    b) ≥1 `promotion_collaborations` in
   *       `status IN ('active','pending_contract')`.
   *
   *  En el mock single-tenant solo modelamos (a) — promotion-level
   *  pending_contract es TODO(backend) cuando aterrice la tabla. */
  const hasFullActiveOrgCollab = (() => {
    if (!isVisitor) return false;
    if (entityType === "developer") {
      return hasActiveDeveloperCollab(currentUser);
    }
    if (isAgencyUser) return false;
    const ag = agencies.find((x) => x.id === effectiveTenantId);
    if (!ag) return false;
    return ag.status === "active" && ag.estadoColaboracion === "activa";
  })();

  /* Visibilidad de datos sensibles · regla canónica per §6.2 del
   *  backend doc (docs/backend-dual-role-architecture.md):
   *    · Owner del workspace → siempre ve.
   *    · Visitor + admin + ORG_COLLAB ACTIVA → ve.
   *    · Visitor + admin + ≥1 PROMO_COLLAB activo/pending_contract → ve
   *      (TODO backend: tabla `promotion_collaborations` no existe en mock).
   *    · `pausada` → NO acceso (privacy gap C1 corregido).
   *    · `contrato-pendiente` org-level → NO acceso (privacy gap C2 corregido).
   *    · Member (no admin) → NO acceso aunque colabore.
   *
   *  TODO(backend): GET /organizations/:id/sensitive responde 403 si
   *  el caller no cumple alguna de las dos condiciones · el cliente
   *  no debería renderizar la sección, pero el endpoint lo enforce. */
  const canViewSensitiveDetails = !isVisitor
    || (hasFullActiveOrgCollab && currentUser.role === "admin");

  /* Datos del propio workspace · usados para validar si se puede
   *  enviar solicitud de colaboración (regla Byvaro: razón social
   *  + CIF + dirección + contacto). Si faltan, banner en own
   *  ficha · button gateado en visitor. */
  const myOwnEmpresa = useMemo(() => getMyOwnEmpresa(currentUser), [currentUser]);
  const myIdentityCheck = useMemo(
    () => hasMinimumIdentityData(myOwnEmpresa),
    [myOwnEmpresa],
  );

  const [tab, setTab] = useTabParam<Tab>(TAB_KEYS, "home");
  /* canEdit=false (member del propio workspace) → forzar preview ·
   *  members ven igual que un visitor pero SIN los chips de "ficha
   *  pública" porque siguen estando dentro de su propio workspace. */
  const [viewMode, setViewMode] = useState<"edit" | "preview">(canEdit ? "edit" : "preview");
  const [editingImage, setEditingImage] = useState<"logo" | "cover" | null>(null);

  /* ─── % de completitud ─── */
  const completion = useMemo(() => ({
    overview: !!empresa.overview.trim(),
    logo: !!empresa.logoUrl,
    cover: !!empresa.coverUrl,
    agents: true,                        // siempre true en el mock actual
    locations: oficinas.length > 0,
    about: !!empresa.aboutOverview.trim(),
  }), [empresa, oficinas]);

  /* completionPercent ya no se usa aquí · el % vive en el sidebar
     `EmpresaSidebar` que computa su propio checklist. */

  /* ─── ImageCropModal: Aplicar una imagen recortada ───
   * Guardamos 3 cosas:
   *   · `*Url`     → imagen recortada, lista para mostrar.
   *   · `*SourceUrl` → imagen ORIGINAL sin recortar · permite reabrir
   *     el editor con el material completo y reajustar.
   *   · `*Crop`    → zoom + posX + posY usados al recortar · al
   *     reabrir, restauramos el encuadre exacto. */
  const handleApplyImage = async (
    dataUrl: string,
    sourceDataUrl: string,
    crop: { zoom: number; posX: number; posY: number },
  ) => {
    /* Upload a Supabase Storage bucket org-public · NO guardamos
     *  base64 en DB. dataUrl/sourceDataUrl pasan por fetch+blob para
     *  convertir a Blob y subir. La columna logo_url/cover_url queda
     *  con la URL pública del bucket · cross-device + cacheable por
     *  CDN de Supabase. */
    const which = editingImage;
    if (!which) return;
    setEditingImage(null);

    /* Optimistic local · mostramos el dataUrl inmediato mientras
     *  sube al bucket. Cuando llega la URL pública, sobreescribimos. */
    if (which === "logo") {
      update("logoUrl", dataUrl);
      update("logoSourceUrl", sourceDataUrl);
      update("logoCrop", crop);
    } else {
      update("coverUrl", dataUrl);
      update("coverSourceUrl", sourceDataUrl);
      update("coverCrop", crop);
    }

    /* Convertir dataUrl → Blob y subir. Si falla (ej. RLS), el toast
     *  de saveEmpresaForOrg se mostrará con la URL local · al recargar
     *  el dato no persistirá hasta que se solucione la causa. */
    try {
      const orgId = effectiveTenantId ?? "developer-default";
      const blob = await (await fetch(dataUrl)).blob();
      const publicUrl = which === "logo"
        ? await uploadOrgLogo(orgId, blob)
        : await uploadOrgCover(orgId, blob);
      /* Reemplazar dataUrl por URL pública · esto es lo que persiste
       *  en DB. */
      if (which === "logo") update("logoUrl", publicUrl);
      else update("coverUrl", publicUrl);
    } catch (e) {
      console.warn("[Empresa] image upload failed:", e);
      const { toast } = await import("sonner");
      toast.error("No se pudo subir la imagen", {
        description: e instanceof Error ? e.message : "Reintenta · si persiste, contacta soporte",
      });
    }
  };
  const handleRemoveImage = () => {
    if (editingImage === "logo") {
      update("logoUrl", "");
      update("logoSourceUrl", "");
      update("logoCrop", undefined);
    } else if (editingImage === "cover") {
      update("coverUrl", "");
      update("coverSourceUrl", "");
      update("coverCrop", undefined);
    }
    setEditingImage(null);
  };

  /* ─── Subtitle display ───
   *  Compone: Ciudad, Provincia, País · Fundada en YYYY · LICENCIA Nº.
   *  La licencia es la primera de `empresa.licencias` (la más
   *  representativa · típicamente la del registro autonómico
   *  obligatorio en la sede fiscal). Solo se muestra si tiene número
   *  rellenado · si está vacía no aparece. */
  const primaryLicencia = empresa.licencias?.find((l) => l.numero?.trim());
  const licenciaTxt = primaryLicencia
    ? (() => {
        const label = primaryLicencia.tipo === "custom"
          ? primaryLicencia.etiqueta ?? "Licencia"
          : primaryLicencia.tipo;
        /* Strip prefijo redundante · si el usuario introdujo
         * "AICAT-12345" o "AICAT 12345", quitamos el label para que
         * el render quede "AICAT 12345" en vez de "AICAT AICAT-12345". */
        const rawNum = (primaryLicencia.numero ?? "").trim();
        const cleaned = rawNum.replace(
          new RegExp(`^${label}[\\s\\-_]*`, "i"),
          "",
        ).trim();
        return `${label} ${cleaned || rawNum}`;
      })()
    : "";
  /* Ubicación bajo el nombre · SOLO ciudad, provincia, país.
   *
   * NUNCA mostrar la dirección completa (calle + nº + CP) en el hero ·
   * eso pertenece al tab "Sobre nosotros · Detalles" como dato
   * fiscal. Aquí el visitante ve la ubicación a nivel de mercado.
   *
   * Si los campos estructurados están vacíos pero hay una línea
   * libre `direccionFiscalCompleta` (rellenada por Google Places o a
   * mano), extraemos los últimos 2-3 segmentos separados por coma ·
   * convención Google Places: la cola de la línea es siempre
   * `..., ciudad, provincia, país`. Se ignoran segmentos que parezcan
   * código postal o números de calle. */
  const direccionFiscalTxt = (() => {
    const ciudad = empresa.direccionFiscal?.ciudad?.trim();
    const provincia = empresa.direccionFiscal?.provincia?.trim();
    const pais = empresa.direccionFiscal?.pais?.trim();
    if (ciudad || provincia || pais) {
      const parts = [ciudad, provincia, pais].filter(Boolean) as string[];
      /* Quitar duplicados (ej. ciudad y provincia coinciden en
       * municipios pequeños como Madrid · Madrid · España). */
      return [...new Set(parts)].join(", ");
    }
    const linea = empresa.direccionFiscalCompleta?.trim();
    if (!linea) return "";
    /* Google Places entrega la cola como `..., CP ciudad, provincia,
     * país`. Tomamos las últimas 3 piezas y a cada una le quitamos un
     * eventual código postal de cabeza (5 dígitos). Ejemplo:
     *   "Av. del Mar 15, 29602 Marbella, Málaga, España"
     *     → segments ["Av. del Mar 15", "29602 Marbella", "Málaga", "España"]
     *     → tail (-3)   ["29602 Marbella", "Málaga", "España"]
     *     → strip CP    ["Marbella", "Málaga", "España"] */
    const tail = linea
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-3)
      .map((s) => s.replace(/^\d{4,5}\s+/, "").trim())
      .filter(Boolean);
    return [...new Set(tail)].join(", ");
  })();

  /* La licencia se renderiza ahora en el slot del slogan (debajo del
   * nombre), no en el subtitle · evitamos duplicarla en ambos sitios. */
  const subtitleDisplay = empresa.subtitle
    || [
      direccionFiscalTxt,
      empresa.fundadaEn ? `Fundada en ${empresa.fundadaEn}` : null,
    ].filter(Boolean).join(" · ");

  /* ─── Tabs config · solo 3 ─── La tab "Estadísticas" se quitó del
   *  nav porque las estadísticas operativas viven en el panel
   *  avanzado (`/promotor/:id/panel` o `/colaboradores/:id/panel`),
   *  no en la ficha pública. El teaser que sustituye al Lema en modo
   *  visitor invita a entrar al panel si hay colaboración activa. */
  const tabs: { value: Tab; label: string; disabled?: boolean }[] = [
    { value: "home", label: "Inicio" },
    { value: "about", label: "Sobre nosotros" },
    { value: "agents", label: "Equipo" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Banner onboarding eliminado · la misma info (% completado +
          checklist) ya vive en el sidebar derecho como "Fuerza del
          perfil" · evita duplicar y deja la cabecera más limpia. */}

      <div className="px-4 sm:px-6 lg:px-10 pt-4 pb-10 max-w-reading mx-auto w-full">
        {/* ═════ Cabecera ═════ */}
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            {isVisitor ? (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                >
                  ← Volver
                </button>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ficha de empresa
                </p>
                {/* El nombre de la empresa solo se muestra en el hero
                    (debajo de la cover) · no lo duplicamos aquí
                    arriba para evitar la repetición. */}
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Administración
                </p>
                <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">
                  Mi empresa
                  {empresa.nombreComercial && (
                    <span className="text-muted-foreground font-normal ml-2">· {empresa.nombreComercial}</span>
                  )}
                </h1>
              </>
            )}
          </div>
          {isVisitor && visitorHeaderRight}
          {/* Toggle "Previsualizar" · disponible para CUALQUIER dueño
           *  (developer + agency). Antes estaba capado a developer
           *  porque la agencia no tenía perfil editable · con storage
           *  scoped por orgId, agencia también edita su /empresa y
           *  necesita el toggle para ver cómo lo ve un visitante. */}
          {/* Toggle de preview · solo admin del propio workspace.
           *  Members no editan · su pantalla siempre está en preview
           *  · sin toggle. */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                viewMode === "preview"
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "border border-border text-foreground hover:bg-muted",
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              {viewMode === "preview" ? "Volver a editar" : "Previsualizar como usuario"}
            </button>
          )}
        </div>

        {/* ═════ Banner · datos mínimos faltantes en mi empresa
            (impide enviar solicitudes y deja el workspace invisible
            en la red de Byvaro). NO aplica a invitaciones de
            promotores · esas siempre se pueden aceptar. ═════ */}
        {!isVisitor && !myIdentityCheck.ok && (
          <CompanyVisibilityBanner missing={myIdentityCheck.missing} />
        )}

        {/* ═════ Pantalla bloqueante "No eres visible" ═════
            Si el dueño activa "Previsualizar como usuario" pero
            todavía le faltan los campos críticos para ser visible
            (logo, identidad, contacto), reemplazamos el preview por
            esta pantalla informativa. Evita que vea una ficha vacía
            y crea fricción intencional para completar antes de
            compartirla. */}
        {!isVisitor && viewMode === "preview" && (() => {
          const visibilityMissing = getPublicVisibilityMissing(empresa);
          if (visibilityMissing.length === 0) return null;
          return (
            <NotVisibleScreen
              missing={visibilityMissing}
              onBackToEdit={() => setViewMode("edit")}
            />
          );
        })()}

        {/* ═════ CTA · enviar solicitud de colaboración ═════
            REGLA · NUNCA mostrar este CTA en la ficha propia (un
            usuario no puede solicitarse colaboración a sí mismo).
            Tres condiciones · todas necesarias:
              · `isVisitor` → estoy viendo OTRA org.
              · `!hasActiveCollab` → no colaboramos ya.
              · `effectiveTenantId !== myOrgId` (defensivo · `isVisitor`
                ya lo garantiza, pero dejamos check explícito ante
                regresiones futuras).
              · `effectiveTenantId` rellenado · sin tenantId no hay
                target. */}
        {isVisitor
          && !hasActiveCollab
          && effectiveTenantId
          && currentOrgIdentity(currentUser).orgId !== effectiveTenantId && (
          <SendCollabRequestCard
            targetOrgId={effectiveTenantId}
            targetOrgName={empresa.nombreComercial || empresa.razonSocial || "Empresa"}
            targetOrgKind={entityType}
            currentUser={currentUser}
            myEmpresa={myOwnEmpresa}
          />
        )}

        {/* ═════ Slot del visitante (overlay promotor: contrato + acciones) ═════ */}
        {isVisitor && visitorSlot}

        {/* En preview mode con datos faltantes, ocultamos toda la
         *  ficha y mostramos solo la pantalla "No eres visible" arriba.
         *  Cuando el dueño rellene los campos, la pantalla
         *  desaparece y la preview real se muestra. */}
        {!isVisitor && viewMode === "preview"
          && getPublicVisibilityMissing(empresa).length > 0 ? null : (
        <>
        {/* ═════ Profile hero ═════ */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-soft">
          {/* Cover · si no hay portada, mostramos un patrón geométrico
              de fallback (estilo "default cover" de Facebook/LinkedIn)
              para que la cabecera no quede vacía. Encima siempre va un
              degradado de abajo a arriba (hasta la mitad) para mejorar
              el contraste con cualquier UI flotante (botones,
              iconos sociales). */}
          <div className="relative h-48 sm:h-56 bg-muted/30 group">
            {empresa.coverUrl ? (
              <img src={empresa.coverUrl} alt="Portada" className="w-full h-full object-cover" />
            ) : (
              <DefaultCoverPattern />
            )}
            {/* Gradiente bottom→top hasta el 50% · oscurece la mitad
                inferior progresivamente. Pointer-events-none para no
                interferir con el botón de editar arriba. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0) 100%)",
              }}
            />
            {viewMode === "edit" && (
              <button
                type="button"
                onClick={() => setEditingImage("cover")}
                className="absolute top-3 right-3 bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-medium text-foreground flex items-center gap-1.5 shadow-soft hover:bg-card transition-colors opacity-0 group-hover:opacity-100"
              >
                <ImageIcon className="h-3 w-3" /> {empresa.coverUrl ? "Editar portada" : "Añadir portada"}
              </button>
            )}
          </div>

          <div className="relative px-5 sm:px-7 pb-0">
            {/* Logo */}
            <div className="absolute -top-14 sm:-top-16 left-5 sm:left-7 group">
              <div className={cn(
                "h-[100px] w-[100px] sm:h-[120px] sm:w-[120px] border-[5px] border-card shadow-soft-lg bg-muted overflow-hidden",
                empresa.logoShape === "square" ? "rounded-2xl" : "rounded-full",
              )}>
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nombreComercial} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 text-primary grid place-items-center font-bold text-2xl">
                    {empresa.nombreComercial?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              {viewMode === "edit" && (
                <button
                  type="button"
                  onClick={() => setEditingImage("logo")}
                  className={cn(
                    "absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-card text-[10px] font-semibold",
                    empresa.logoShape === "square" ? "rounded-2xl" : "rounded-full",
                  )}
                >
                  <Camera className="h-4 w-4" />
                  Editar
                </button>
              )}
            </div>

            {/* Nombre + website */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-[56px] sm:pt-[68px] pb-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[19px] sm:text-[22px] font-bold text-foreground leading-tight tracking-tight">
                    {empresa.nombreComercial || "Tu empresa"}
                  </h1>
                  {empresa.verificada && <VerifiedBadge size="md" />}
                </div>
                {/* Categorías + licencia inmobiliaria · una línea
                    inline en color neutro. Sin colores semánticos por
                    categoría (decisión producto · diseño minimalista).
                    Las palabras se separan por · en muted. */}
                {(heroCategories.length > 0 || primaryLicencia) && (
                  <p className="mt-1.5 text-[12.5px] font-medium text-muted-foreground leading-snug">
                    {heroCategories.map((c, i) => (
                      <span key={c}>
                        {i > 0 && <span className="mx-1">·</span>}
                        {EMPRESA_CATEGORY_LABELS[c]}
                      </span>
                    ))}
                    {primaryLicencia && heroCategories.length > 0 && (
                      <span className="mx-1">·</span>
                    )}
                    {primaryLicencia && (
                      <span className="tracking-wide">{licenciaTxt}</span>
                    )}
                  </p>
                )}
                <p className="text-[12.5px] text-muted-foreground mt-1.5 truncate">
                  {subtitleDisplay || "Completa la ubicación y año de fundación para personalizar tu perfil"}
                </p>
              </div>
              {/* Bloque derecho · rating Google encima · iconos sociales debajo */}
              <div className="shrink-0 flex flex-col items-end gap-2">
                <HeroGoogleRating empresa={empresa} />
                <HeroSocialIcons empresa={empresa} update={update} viewMode={viewMode} />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-t border-border overflow-x-auto no-scrollbar -mx-5 sm:-mx-7 px-5 sm:px-7">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => !t.disabled && setTab(t.value)}
                  disabled={t.disabled}
                  className={cn(
                    "px-4 sm:px-5 py-3 text-[13px] font-medium transition-colors relative whitespace-nowrap",
                    tab === t.value
                      ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                      : t.disabled
                        ? "text-muted-foreground/30 cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═════ Contenido + sidebar ═════ */}
        <div className="flex flex-col xl:flex-row gap-5 mt-5">
          <div className="flex-1 min-w-0">
            {tab === "home" && (
              <EmpresaHomeTab
                viewMode={viewMode}
                empresa={empresa}
                update={update}
                stats={stats}
                isVisitor={isVisitor}
                entityType={entityType}
                panelHref={panelHref}
                hasActiveCollab={hasActiveCollab}
                tenantId={effectiveTenantId}
              />
            )}
            {tab === "about" && (
              <EmpresaAboutTab
                viewMode={viewMode}
                empresa={empresa}
                update={update}
                isVisitor={isVisitor}
                isAdmin={currentUser.role === "admin"}
                tenantId={effectiveTenantId}
                canViewSensitiveDetails={canViewSensitiveDetails}
              />
            )}
            {tab === "agents" && (
              <EmpresaAgentsTab
                isVisitor={isVisitor}
                viewMode={viewMode}
                tenantId={effectiveTenantId}
              />
            )}
          </div>

          {!isVisitor && viewMode === "edit" && tab === "home" && (
            <EmpresaSidebar empresa={empresa} oficinasCount={oficinas.length} update={update} />
          )}
        </div>
        </>
        )}
      </div>

      {/* ═════ Modales de edición (solo dueño) ═════ */}
      {!isVisitor && (
        <>
          <ImageCropModal
            open={editingImage === "logo"}
            onClose={() => setEditingImage(null)}
            onApply={handleApplyImage}
            onRemove={handleRemoveImage}
            initialImage={empresa.logoUrl || undefined}
            initialSource={empresa.logoSourceUrl || undefined}
            initialCrop={empresa.logoCrop}
            shape={empresa.logoShape === "square" ? "square" : "circle"}
            allowShapeSwitch
            onShapeChange={(s) => update("logoShape", s)}
            title="Editar logo"
            outputSize={{ width: 512, height: 512 }}
          />
          {/* Aspect ratio del recorte = aspect real del hero `h-56`
              dentro del card (max-w-reading). Render aprox 1168×224
              en desktop · 5.214:1. WYSIWYG: el área del recorte tiene
              la MISMA proporción que el cover en la ficha → todo lo
              visible dentro del recorte aparece tal cual al guardar. */}
          <ImageCropModal
            open={editingImage === "cover"}
            onClose={() => setEditingImage(null)}
            onApply={handleApplyImage}
            onRemove={handleRemoveImage}
            initialImage={empresa.coverUrl || undefined}
            initialSource={empresa.coverSourceUrl || undefined}
            initialCrop={empresa.coverCrop}
            shape="rectangle"
            aspectRatio={1168.67 / 224}
            title="Editar portada"
            outputSize={{ width: 2336, height: 448 }}
          />
        </>
      )}

      {/* ═════ Footer sticky del visitante (acciones promotor) ═════ */}
      {isVisitor && visitorFooter}
    </div>
  );
}

/** Color de texto por categoría · usado en el hero para renderizar
 *  la categoría inline (sin pill) · mismo patrón que la card del
 *  listado de Inmobiliarias / Promotores. */
function categoryHeroColor(c: EmpresaCategory): string {
  switch (c) {
    case "inmobiliaria":    return "text-primary";
    case "promotor":        return "text-success";
    case "comercializador": return "text-warning";
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Visibility check para "Previsualizar como usuario"
   ═══════════════════════════════════════════════════════════════════

   Calcula los campos críticos para que la ficha pública sea
   presentable a un colaborador. Diferente de
   `hasMinimumIdentityData()` (que valida envío de solicitudes) ·
   este check incluye también el LOGO y el nombre comercial · sin
   ellos el visitante ve un perfil vacío que da mala imagen y le
   resta confianza al promotor / inmobiliaria.

   Cada entry tiene:
     · `key` · estable para keys de React.
     · `label` · qué le decimos al user que falta.
     · `done(empresa)` · boolean true cuando está completo.

   La pantalla "No eres visible" muestra TODOS los items con
   estado check/cross para que el user vea de un vistazo qué
   tiene y qué falta. */
type VisibilityField = {
  key: string;
  label: string;
  done: (e: EmpresaType) => boolean;
};

const VISIBILITY_FIELDS: VisibilityField[] = [
  { key: "logo", label: "Logo de la empresa (avatar)", done: (e) => !!e.logoUrl?.trim() },
  { key: "nombre", label: "Nombre comercial", done: (e) => !!e.nombreComercial?.trim() },
  { key: "razon", label: "Razón social", done: (e) => !!e.razonSocial?.trim() },
  { key: "cif", label: "CIF/NIF/VAT", done: (e) => !!e.cif?.trim() },
  {
    key: "direccion",
    label: "Dirección fiscal (ciudad y país)",
    done: (e) =>
      !!(e.direccionFiscalCompleta?.trim()
        || (e.direccionFiscal?.ciudad?.trim() && e.direccionFiscal?.pais?.trim())),
  },
  {
    key: "contacto",
    label: "Email o teléfono de contacto",
    done: (e) => !!(e.email?.trim() || e.telefono?.trim()),
  },
];

/** Devuelve los campos faltantes para que la ficha sea visible. */
function getPublicVisibilityMissing(empresa: EmpresaType): VisibilityField[] {
  return VISIBILITY_FIELDS.filter((f) => !f.done(empresa));
}

/* ═══════════════════════════════════════════════════════════════════
   Pantalla "No eres visible" en preview con datos faltantes
   ═══════════════════════════════════════════════════════════════════ */
function NotVisibleScreen({
  missing, onBackToEdit,
}: {
  missing: VisibilityField[];
  onBackToEdit: () => void;
}) {
  /* Lista completa con check/cross · damos contexto · el usuario ve
   *  qué tiene Y qué falta · más motivador que solo lista de errores. */
  return (
    <section className="mt-2 mb-6 rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
      <div className="px-5 sm:px-7 py-7 sm:py-8 text-center bg-muted/30 border-b border-border">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-warning/15 text-warning grid place-items-center mb-3">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground">
          No eres visible para tus colaboradores
        </h2>
        <p className="mt-2 text-[13px] sm:text-[13.5px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          Tu ficha pública aún no tiene los datos mínimos para que un promotor o una inmobiliaria pueda confiar en ti. Para ser visible al menos debes añadir estos campos:
        </p>
      </div>

      <div className="px-5 sm:px-7 py-5 sm:py-6">
        <ul className="space-y-2">
          {VISIBILITY_FIELDS.map((f) => {
            const isMissing = missing.some((m) => m.key === f.key);
            return (
              <li
                key={f.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  isMissing
                    ? "border-warning/30 bg-warning/5"
                    : "border-success/20 bg-success/5",
                )}
              >
                <span
                  className={cn(
                    "h-6 w-6 rounded-full grid place-items-center shrink-0",
                    isMissing
                      ? "bg-warning/20 text-warning"
                      : "bg-success/20 text-success",
                  )}
                >
                  {isMissing ? (
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  ) : (
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  )}
                </span>
                <span
                  className={cn(
                    "text-[13px] flex-1",
                    isMissing ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {f.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBackToEdit}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors shadow-soft"
          >
            Volver a editar y completar
          </button>
          <p className="text-[11.5px] text-muted-foreground self-center">
            Cuando completes los campos, este aviso desaparece y la ficha será visible.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Banner · datos mínimos faltantes en mi empresa (own ficha)
   ═══════════════════════════════════════════════════════════════════ */
function CompanyVisibilityBanner({ missing }: { missing: string[] }) {
  return (
    <section className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-warning/20 grid place-items-center text-warning shrink-0">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-foreground">
            Tu empresa no es visible en la red de Byvaro
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Otras empresas no podrán encontrarte ni colaborar contigo
            hasta que completes tus datos mínimos. Las invitaciones
            recibidas de promotores siguen llegando.
          </p>
          <p className="text-[12px] text-foreground/80 mt-2">
            Falta: <span className="font-semibold">{missing.join(" · ")}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Card · enviar solicitud de colaboración (visitor sin colaboración)
   ═══════════════════════════════════════════════════════════════════ */
function SendCollabRequestCard({
  targetOrgId, targetOrgName, targetOrgKind, currentUser, myEmpresa,
}: {
  targetOrgId: string;
  targetOrgName: string;
  targetOrgKind: OrgKind;
  currentUser: CurrentUser;
  myEmpresa: EmpresaType;
}) {
  const hasPending = useHasPendingRequestTo(currentUser, targetOrgId);
  const myCheck = hasMinimumIdentityData(myEmpresa);

  const handleSend = () => {
    if (!myCheck.ok) {
      toast.warning(
        "Faltan datos para poder enviar solicitudes",
        {
          description:
            `Pídele a tu admin que rellene: ${myCheck.missing.join(" · ")}.`,
        },
      );
      return;
    }
    const me = currentOrgIdentity(currentUser);
    crearOrgCollabRequest({
      fromOrgId: me.orgId,
      fromOrgName: myEmpresa.nombreComercial?.trim()
        || myEmpresa.razonSocial?.trim()
        || me.orgName,
      fromOrgKind: me.orgKind,
      toOrgId: targetOrgId,
      toOrgName: targetOrgName,
      toOrgKind: targetOrgKind,
      requestedBy: { name: currentUser.name, email: currentUser.email },
    });
    toast.success(`Solicitud enviada a ${targetOrgName}`);
  };

  if (hasPending) {
    return (
      <section className="mb-4 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
            <Lock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Solicitud de colaboración pendiente · esperando respuesta de
            <span className="text-foreground font-semibold"> {targetOrgName}</span>.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-soft">
      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
        <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
          <Send className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-foreground">
            Aún no colaboras con {targetOrgName}
          </h3>
          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
            Envía una solicitud · cuando la acepten quedaréis colaborando
            y podrás operar con su catálogo o cartera.
          </p>
          {!myCheck.ok && (
            <p className="text-[11.5px] text-warning mt-2">
              <AlertTriangle className="inline h-3 w-3 mr-1" strokeWidth={2} />
              Tu admin debe rellenar antes:{" "}
              <span className="font-semibold">{myCheck.missing.join(" · ")}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSend}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 transition-colors shrink-0"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          Enviar solicitud
        </button>
      </div>
    </section>
  );
}
