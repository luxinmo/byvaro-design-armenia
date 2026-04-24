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
  Eye, AlertTriangle, CheckCircle2, Camera, Image as ImageIcon,
} from "lucide-react";
import { useEmpresa, useOficinas } from "@/lib/empresa";
import { useCurrentUser } from "@/lib/currentUser";
import { cn } from "@/lib/utils";
import { EmpresaHomeTab } from "@/components/empresa/EmpresaHomeTab";
import { EmpresaAboutTab } from "@/components/empresa/EmpresaAboutTab";
import { EmpresaAgentsTab } from "@/components/empresa/EmpresaAgentsTab";
import { EmpresaSidebar } from "@/components/empresa/EmpresaSidebar";
import { ImageCropModal } from "@/components/empresa/ImageCropModal";
import { HeroSocialIcons } from "@/components/empresa/HeroSocialIcons";
import { Toaster } from "sonner";

const TAB_KEYS = ["home", "about", "agents", "statistics"] as const;
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

  const completionPercent = Math.round(
    (Object.values(completion).filter(Boolean).length / Object.values(completion).length) * 100
  );
  const isIncomplete = completionPercent < 100;

  /* ─── ImageCropModal: Aplicar una imagen recortada ─── */
  const handleApplyImage = (dataUrl: string) => {
    if (editingImage === "logo") update("logoUrl", dataUrl);
    else if (editingImage === "cover") update("coverUrl", dataUrl);
    setEditingImage(null);
  };
  const handleRemoveImage = () => {
    if (editingImage === "logo") update("logoUrl", "");
    else if (editingImage === "cover") update("coverUrl", "");
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

  /* ─── Tabs config ─── */
  const tabs: { value: Tab; label: string; disabled?: boolean }[] = [
    { value: "home", label: "Inicio" },
    { value: "about", label: "Sobre nosotros" },
    { value: "agents", label: "Agentes" },
    { value: "statistics", label: "Estadísticas", disabled: true },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Toaster position="top-center" richColors />

      {/* ═════ Banner onboarding (solo dueño, no visitor) ═════ */}
      {!isVisitor && isIncomplete && viewMode === "edit" && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-warning dark:text-warning shrink-0" />
          <p className="text-[11.5px] text-foreground flex-1 min-w-0">
            <span className="font-semibold">Tu perfil de empresa está al {completionPercent}%.</span>{" "}
            Completa todas las secciones para que agencias y promotores puedan encontrarte.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 bg-warning/20 rounded-full overflow-hidden">
              <div className="h-full bg-warning/70 rounded-full transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-warning dark:text-warning tnum">{completionPercent}%</span>
          </div>
        </div>
      )}

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
                  Ficha de agencia
                </p>
                <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">
                  {empresa.nombreComercial}
                </h1>
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
              {viewMode === "preview" ? "Volver a editar" : "Previsualizar como agencia"}
            </button>
          )}
        </div>

        {/* ═════ Slot del visitante (overlay promotor: contrato + acciones) ═════ */}
        {isVisitor && visitorSlot}

        {/* ═════ Profile hero ═════ */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-soft">
          {/* Cover */}
          <div className="relative h-48 sm:h-56 bg-muted/30 group">
            {empresa.coverUrl ? (
              <img src={empresa.coverUrl} alt="Portada" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted via-muted/60 to-primary/10" />
            )}
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
                  {empresa.verificada && (
                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
                  )}
                </div>
                {empresa.tagline ? (
                  <p className="text-[14px] font-medium text-primary mt-1 leading-snug" style={{ color: empresa.colorCorporativo || undefined }}>
                    {empresa.tagline}
                  </p>
                ) : viewMode === "edit" && (
                  <input
                    type="text"
                    value={empresa.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="Añade un slogan · Ej. Inversión segura en la Costa del Sol"
                    className="mt-1 w-full max-w-lg text-[14px] font-medium text-primary bg-transparent outline-none border-b border-dashed border-border focus:border-primary placeholder:text-muted-foreground/50 placeholder:font-normal transition-colors pb-0.5"
                    maxLength={120}
                  />
                )}
                <p className="text-[12.5px] text-muted-foreground mt-1.5 truncate">
                  {subtitleDisplay || "Completa la ubicación y año de fundación para personalizar tu perfil"}
                </p>
              </div>
              {/* Iconos sociales · discretos, alineados a la derecha */}
              <div className="shrink-0">
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
              <EmpresaHomeTab viewMode={viewMode} empresa={empresa} update={update} />
            )}
            {tab === "about" && (
              <EmpresaAboutTab viewMode={viewMode} empresa={empresa} update={update} />
            )}
            {tab === "agents" && <EmpresaAgentsTab />}
          </div>

          {!isVisitor && viewMode === "edit" && tab === "home" && (
            <EmpresaSidebar empresa={empresa} oficinasCount={oficinas.length} />
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
            shape={empresa.logoShape === "square" ? "square" : "circle"}
            allowShapeSwitch
            onShapeChange={(s) => update("logoShape", s)}
            title="Editar logo"
            outputSize={{ width: 512, height: 512 }}
          />
          <ImageCropModal
            open={editingImage === "cover"}
            onClose={() => setEditingImage(null)}
            onApply={handleApplyImage}
            onRemove={handleRemoveImage}
            initialImage={empresa.coverUrl || undefined}
            shape="rectangle"
            aspectRatio={24 / 10}
            title="Editar portada"
            outputSize={{ width: 1200, height: 500 }}
          />
        </>
      )}

      {/* ═════ Footer sticky del visitante (acciones promotor) ═════ */}
      {isVisitor && visitorFooter}
    </div>
  );
}
