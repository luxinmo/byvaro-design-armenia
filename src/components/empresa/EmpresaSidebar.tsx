/**
 * EmpresaSidebar · sidebar lateral de la vista de promotor.
 *
 * Es el panel donde el promotor ve el estado de SU empresa:
 *   - Fuerza del perfil (score + checklist de acciones pendientes)
 *   - Invitaciones pendientes (y CTA "Invitar agencia")
 *   - Rendimiento (vistas al perfil, clicks, etc. — mock v1)
 *   - Tip diario
 *
 * Solo se muestra en viewMode=edit (la perspectiva del promotor).
 * En xl+ se muestra como columna lateral, en mobile/tablet queda
 * oculto (el contenido principal ya tiene los datos más críticos).
 */

import {
  CheckCircle2, Circle, Sparkles, ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  action?: string;
}

function getChecklist(empresa: Empresa, oficinasCount: number): ChecklistItem[] {
  return [
    { key: "nombre",    label: "Nombre comercial",       done: !!empresa.nombreComercial.trim() },
    { key: "legal",     label: "Razón social y CIF",     done: !!empresa.razonSocial.trim() && !!empresa.cif.trim() },
    { key: "logo",      label: "Logo subido",            done: !!empresa.logoUrl },
    { key: "cover",     label: "Imagen de portada",      done: !!empresa.coverUrl },
    { key: "overview",  label: "Resumen de empresa",     done: !!empresa.overview.trim() },
    { key: "about",     label: "Historia ampliada",      done: !!empresa.aboutOverview.trim() },
    { key: "zonas",     label: "Zonas de operación",     done: empresa.zonasOperacion.length > 0 },
    { key: "oficinas",  label: "Al menos 1 oficina",     done: oficinasCount > 0 },
    { key: "terminos",  label: "Comisión por defecto",   done: empresa.comisionNacionalDefault > 0 },
    { key: "testimonios", label: "Al menos 1 testimonio", done: empresa.testimonios.length > 0 },
  ];
}

function SidebarCard({
  title, children, action, actionIcon: ActionIcon, onAction, accent,
}: {
  title: string;
  children: React.ReactNode;
  action?: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
  onAction?: () => void;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 flex flex-col gap-3 shadow-soft",
      accent ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border",
    )}>
      <h3 className={cn("text-[12.5px] font-bold tracking-tight", accent ? "text-primary" : "text-foreground")}>
        {title}
      </h3>
      {children}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full h-8 px-3 transition-colors self-start",
            accent
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border text-foreground hover:bg-muted",
          )}
        >
          {ActionIcon && <ActionIcon className="h-3 w-3" />}
          {action}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmpresaSidebar
   ═══════════════════════════════════════════════════════════════════ */
export function EmpresaSidebar({
  empresa, oficinasCount,
}: {
  empresa: Empresa;
  oficinasCount: number;
}) {
  const navigate = useNavigate();
  const checklist = getChecklist(empresa, oficinasCount);
  const done = checklist.filter(c => c.done).length;
  const total = checklist.length;
  const percent = Math.round((done / total) * 100);

  return (
    <aside className="hidden xl:flex w-[280px] shrink-0 flex-col gap-4">
        {/* ═════ Fuerza del perfil ═════ */}
        <SidebarCard title="Fuerza del perfil">
          <div className="flex items-center gap-3">
            {/* Ring progress */}
            <div className="relative h-14 w-14 shrink-0">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/50" />
                <circle
                  cx="20" cy="20" r="17" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(percent / 100) * (2 * Math.PI * 17)} ${2 * Math.PI * 17}`}
                  className={cn(percent >= 80 ? "text-success" : percent >= 50 ? "text-warning" : "text-primary")}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-[14px] font-bold tnum">{percent}%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-foreground font-semibold leading-tight">
                {percent >= 80 ? "Perfil fuerte" : percent >= 50 ? "Vas bien" : "Hay que mejorarlo"}
              </p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                {done}/{total} secciones completadas
              </p>
            </div>
          </div>

          {/* Checklist */}
          <ul className="flex flex-col gap-1.5 pt-2 border-t border-border">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={cn(
                  "text-[11.5px]",
                  c.done ? "text-muted-foreground line-through" : "text-foreground",
                )}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </SidebarCard>

        {/* ═════ Consejo del día ═════ */}
        <SidebarCard title="">
          <div className="flex items-start gap-2.5 -mt-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11.5px] font-semibold text-foreground leading-tight">Consejo del día</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                Los perfiles con <strong>3+ testimonios y cover personalizada</strong> reciben 2× más visitas de agencias.
              </p>
            </div>
          </div>
        </SidebarCard>

        {/* ═════ Gestiona tu red en Colaboradores ═════ */}
        <SidebarCard title="Red de agencias">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Invita y gestiona tus agencias colaboradoras desde el módulo de Red.
          </p>
          <button
            type="button"
            onClick={() => navigate("/colaboradores")}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary hover:underline self-start"
          >
            Ir a Colaboradores
            <ArrowRight className="h-3 w-3" />
          </button>
        </SidebarCard>
      </aside>
  );
}
