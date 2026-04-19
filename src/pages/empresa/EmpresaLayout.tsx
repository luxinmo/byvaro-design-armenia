/**
 * EmpresaLayout · contenedor de todas las pantallas de /empresa/*
 *
 * Diseño:
 *   - Cabecera única con título "Empresa" + descripción + chip de
 *     estado global (configurada / pendiente).
 *   - Barra de pestañas horizontal (Datos · Oficinas · Usuarios ·
 *     Permisos · Facturación · Integraciones) que navega por rutas
 *     hijas. Las no disponibles muestran candado y no navegan.
 *   - En móvil la barra de pestañas es desplazable horizontalmente
 *     (scroll-x), sin forzar a caber todo en una pantalla.
 *   - El contenido específico se renderiza vía <Outlet />.
 *
 * Las sub-páginas (EmpresaDatos, EmpresaOficinas…) ya NO muestran su
 * propia cabecera grande — el layout se encarga. Solo renderizan el
 * contenido del tab seleccionado.
 */

import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Building2, MapPin, Users, Shield, CreditCard, Plug, Lock,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { useEmpresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

const tabs: Tab[] = [
  { label: "Datos de empresa", url: "/empresa/datos", icon: Building2 },
  { label: "Oficinas", url: "/empresa/oficinas", icon: MapPin },
  { label: "Usuarios", url: "/empresa/usuarios", icon: Users, disabled: true },
  { label: "Permisos", url: "/empresa/permisos", icon: Shield, disabled: true },
  { label: "Facturación", url: "/empresa/facturacion", icon: CreditCard, disabled: true },
  { label: "Integraciones", url: "/empresa/integraciones", icon: Plug, disabled: true },
];

export default function EmpresaLayout() {
  const location = useLocation();
  const { empresa } = useEmpresa();

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Cabecera ═════ */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Administración
          </p>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight mt-1">
            Empresa
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Gestiona los datos de tu empresa (identidad fiscal, oficinas, usuarios, permisos, facturación e integraciones).
            Todo lo administrativo vive aquí, separado del flujo comercial.
          </p>
        </div>
        <div className="shrink-0">
          {empresa.onboardingCompleto ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full bg-primary/10 text-primary px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Empresa configurada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-500 px-3 py-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Pendiente de completar
            </span>
          )}
        </div>
      </header>

      {/* ═════ Barra de pestañas ═════ */}
      <div className="relative -mx-4 sm:mx-0">
        {/* Scroll horizontal en móvil, sin scroll en desktop */}
        <div className="overflow-x-auto no-scrollbar border-b border-border px-4 sm:px-0">
          <div className="flex items-center gap-1 min-w-max">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.url;
              const Icon = tab.icon;

              if (tab.disabled) {
                return (
                  <div
                    key={tab.url}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium text-muted-foreground/50 cursor-not-allowed border-b-2 border-transparent select-none"
                    title={`${tab.label} · próximamente`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    <Lock className="h-2.5 w-2.5 shrink-0 ml-0.5" />
                  </div>
                );
              }

              return (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap",
                    isActive
                      ? "text-primary border-primary font-semibold"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═════ Contenido ═════ */}
      <div className="flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
