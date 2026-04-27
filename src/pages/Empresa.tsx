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
import { useEmpresaStats } from "@/lib/empresaStats";
import { useCurrentUser } from "@/lib/currentUser";
import { agencies } from "@/data/agencies";
import { hasActiveDeveloperCollab, DEFAULT_DEVELOPER_ID } from "@/lib/developerNavigation";
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
  const effectiveTenantId = tenantId ?? (isAgencyUser ? currentUser.agencyId : undefined);
  const { empresa, update, isVisitor } = useEmpresa(effectiveTenantId);
  const { oficinas } = useOficinas();
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
  const entityType: "developer" | "agency" =
    !effectiveTenantId
      ? (isAgencyUser ? "agency" : "developer")
      : effectiveTenantId.startsWith("developer-")
        ? "developer"
        : "agency";

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
  const panelHref = effectiveTenantId
    ? (entityType === "developer"
      ? `/promotor/${effectiveTenantId === DEFAULT_DEVELOPER_ID ? DEFAULT_DEVELOPER_ID : effectiveTenantId}/panel`
      : `/colaboradores/${effectiveTenantId}/panel`)
    : undefined;

  const hasActiveCollab = (() => {
    if (!isVisitor) return false;
    if (entityType === "developer") {
      return hasActiveDeveloperCollab(currentUser);
    }
    // entityType === "agency" → developer viendo la ficha de una agencia.
    const ag = agencies.find((x) => x.id === effectiveTenantId);
    if (!ag) return false;
    if (ag.status === "active") return true;
    if (ag.estadoColaboracion === "activa") return true;
    if (ag.estadoColaboracion === "contrato-pendiente") return true;
    if (ag.estadoColaboracion === "pausada") return true;
    return false;
  })();

  const [tab, setTab] = useTabParam<Tab>(TAB_KEYS, "home");
  const [viewMode, setViewMode] = useState<"edit" | "preview">(isVisitor ? "preview" : "edit");
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
  const handleApplyImage = (
    dataUrl: string,
    sourceDataUrl: string,
    crop: { zoom: number; posX: number; posY: number },
  ) => {
    if (editingImage === "logo") {
      update("logoUrl", dataUrl);
      update("logoSourceUrl", sourceDataUrl);
      update("logoCrop", crop);
    } else if (editingImage === "cover") {
      update("coverUrl", dataUrl);
      update("coverSourceUrl", sourceDataUrl);
      update("coverCrop", crop);
    }
    setEditingImage(null);
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

  /* ─── Subtitle display ─── */
  const subtitleDisplay = empresa.subtitle
    || [
      empresa.direccionFiscal.ciudad,
      empresa.direccionFiscal.provincia,
      empresa.direccionFiscal.pais,
    ].filter(Boolean).join(", ") +
      (empresa.fundadaEn ? ` · Fundada en ${empresa.fundadaEn}` : "");

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

      <div className="px-4 sm:px-6 lg:px-10 pt-4 pb-10 max-w-[1250px] mx-auto w-full">
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
          {!isVisitor && !isAgencyUser && (
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

        {/* ═════ Slot del visitante (overlay promotor: contrato + acciones) ═════ */}
        {isVisitor && visitorSlot}

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
                {viewMode === "edit" ? (
                  /* Modo edición · input siempre editable (incluso si
                   *  ya hay tagline). El usuario puede sobreescribir
                   *  o vaciar la frase desde aquí mismo. */
                  <input
                    type="text"
                    value={empresa.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="Añade un slogan · Ej. Inversión segura en la Costa del Sol"
                    className="mt-1 w-full max-w-lg text-[14px] font-medium text-primary bg-transparent outline-none border-b border-dashed border-border focus:border-primary placeholder:text-muted-foreground/50 placeholder:font-normal transition-colors pb-0.5"
                    style={{ color: empresa.colorCorporativo || undefined }}
                    maxLength={120}
                  />
                ) : empresa.tagline ? (
                  <p className="text-[14px] font-medium text-primary mt-1 leading-snug" style={{ color: empresa.colorCorporativo || undefined }}>
                    {empresa.tagline}
                  </p>
                ) : null}
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
              dentro del card (max-w-[1250px]). Render aprox 1168×224
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
