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

import { useMemo, useRef, useState } from "react";
import {
  Eye, AlertTriangle, Globe, Edit, CheckCircle2, Upload, Trash2,
} from "lucide-react";
import { useEmpresa, useOficinas } from "@/lib/empresa";
import { cn } from "@/lib/utils";
import { EmpresaHomeTab } from "@/components/empresa/EmpresaHomeTab";
import { EmpresaAboutTab } from "@/components/empresa/EmpresaAboutTab";
import { EmpresaAgentsTab } from "@/components/empresa/EmpresaAgentsTab";
import { EmpresaSidebar } from "@/components/empresa/EmpresaSidebar";

type Tab = "home" | "about" | "agents" | "statistics";

export default function Empresa() {
  const { empresa, update } = useEmpresa();
  const { oficinas } = useOficinas();
  const [tab, setTab] = useState<Tab>("home");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  /* ─── Upload helpers ─── */
  const handleImageUpload = (file: File, field: "logoUrl" | "coverUrl") => {
    if (file.size > 3 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => update(field, reader.result as string);
    reader.readAsDataURL(file);
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
    <div className="min-h-full -mx-4 sm:-mx-6 lg:-mx-10 -my-6 sm:-my-8 lg:-my-10">
      {/* ═════ Banner onboarding ═════ */}
      {isIncomplete && viewMode === "edit" && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-5 sm:px-8 lg:px-10 py-3 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
          <p className="text-[11.5px] text-foreground flex-1 min-w-0">
            <span className="font-semibold">Tu perfil de empresa está al {completionPercent}%.</span>{" "}
            Completa todas las secciones para que agencias y promotores puedan encontrarte.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-24 h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/70 rounded-full transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-500 tnum">{completionPercent}%</span>
          </div>
        </div>
      )}

      <div className="px-5 sm:px-8 lg:px-10 pt-4 pb-10 max-w-[1250px] mx-auto">
        {/* ═════ Breadcrumb + toggle ═════ */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <span className="text-[11px] text-muted-foreground">‹ Administración</span>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
              viewMode === "preview"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border text-foreground hover:bg-muted",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {viewMode === "preview" ? "Volver a editar" : "Ver como usuario"}
          </button>
        </div>

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
              <>
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-medium text-foreground flex items-center gap-1.5 shadow-soft hover:bg-card transition-colors"
                  >
                    <Edit className="h-3 w-3" /> {empresa.coverUrl ? "Cambiar portada" : "Añadir portada"}
                  </button>
                  {empresa.coverUrl && (
                    <button
                      type="button"
                      onClick={() => update("coverUrl", "")}
                      className="bg-card/90 backdrop-blur rounded-full px-3 py-1.5 text-[10.5px] font-medium text-foreground flex items-center gap-1.5 shadow-soft hover:bg-card transition-colors"
                    >
                      <Trash2 className="h-3 w-3" /> Quitar
                    </button>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f, "coverUrl");
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <div className="relative px-5 sm:px-7 pb-0">
            {/* Logo */}
            <div className="absolute -top-14 sm:-top-16 left-5 sm:left-7 group">
              <div className="h-[100px] w-[100px] sm:h-[120px] sm:w-[120px] rounded-full border-[5px] border-card shadow-soft-lg bg-muted overflow-hidden">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nombreComercial} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 text-primary grid place-items-center font-bold text-2xl">
                    {empresa.nombreComercial?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              {viewMode === "edit" && (
                <>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Upload className="h-5 w-5 text-card" />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f, "logoUrl");
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>

            {/* Nombre + website */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-[56px] sm:pt-[68px] pb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[18px] sm:text-[20px] font-bold text-foreground leading-snug">
                    {empresa.nombreComercial || "Tu empresa"}
                  </h1>
                  {empresa.verificada && (
                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mt-1 truncate">
                  {subtitleDisplay || "Completa la ubicación y año de fundación para personalizar tu perfil"}
                </p>
              </div>
              {empresa.sitioWeb && (
                <a
                  href={empresa.sitioWeb.startsWith("http") ? empresa.sitioWeb : `https://${empresa.sitioWeb}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] text-primary font-medium border border-primary/30 rounded-full px-4 h-9 hover:bg-primary/5 transition-colors shrink-0"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {empresa.sitioWeb}
                </a>
              )}
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

          {viewMode === "edit" && tab === "home" && (
            <EmpresaSidebar />
          )}
        </div>
      </div>
    </div>
  );
}
