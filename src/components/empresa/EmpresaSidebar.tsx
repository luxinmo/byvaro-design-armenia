/**
 * EmpresaSidebar · tarjetas auxiliares del lado derecho (solo se
 * muestra en viewMode="edit" y tab="home"). Réplica del Lovable.
 */

import { Plus, ArrowRight } from "lucide-react";

function SidebarCard({
  title, description, action, actionIcon = "plus",
}: {
  title: string;
  description: string;
  action: string;
  actionIcon?: "plus" | "arrow";
}) {
  const Icon = actionIcon === "arrow" ? ArrowRight : Plus;
  return (
    <div className="bg-card rounded-2xl border border-border shadow-soft p-5 flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">{description}</p>
      <button type="button" className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors self-start">
        <Icon className="h-3 w-3" />
        {action}
      </button>
    </div>
  );
}

export function EmpresaSidebar() {
  return (
    <div className="hidden xl:flex w-[260px] shrink-0 flex-col gap-4">
      <SidebarCard
        title="Miembros del equipo y permisos"
        description="Invita a tu equipo o asigna un administrador para gestionar los datos de la empresa, completar información obligatoria y acelerar colaboraciones."
        action="Añadir miembros del equipo"
        actionIcon="plus"
      />
      <SidebarCard
        title="Tu web gratis en minutos"
        description="Aprovecha tus datos de empresa para generar un microsite público con tu branding. Puedes personalizarlo cuando quieras."
        action="Ir al microsite"
        actionIcon="arrow"
      />
    </div>
  );
}
