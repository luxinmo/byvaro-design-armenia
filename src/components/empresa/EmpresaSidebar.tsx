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
  CheckCircle2, Circle,
} from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  /** Peso en el cómputo del % · default 10. La verificación de
   *  empresa pesa 30 (≈ 3 slots) porque es lo que decide la
   *  confianza de las agencias colaboradoras al aceptar la
   *  invitación. Imagen de portada, historia ampliada y testimonios
   *  ya no puntúan · son nice-to-have, no requisito. */
  weight: number;
  action?: string;
}

function getChecklist(empresa: Empresa, oficinasCount: number): ChecklistItem[] {
  return [
    { key: "nombre",       label: "Nombre comercial",         weight: 10, done: !!empresa.nombreComercial.trim() },
    { key: "legal",        label: "Razón social y CIF",       weight: 10, done: !!empresa.razonSocial.trim() && !!empresa.cif.trim() },
    { key: "logo",         label: "Logo subido",              weight: 10, done: !!empresa.logoUrl },
    { key: "overview",     label: "Resumen de empresa",       weight: 10, done: !!empresa.overview.trim() },
    { key: "zonas",        label: "Zonas de operación",       weight: 10, done: empresa.zonasOperacion.length > 0 },
    { key: "oficinas",     label: "Al menos 1 oficina",       weight: 10, done: oficinasCount > 0 },
    { key: "terminos",     label: "Comisión por defecto",     weight: 10, done: empresa.comisionNacionalDefault > 0 },
    { key: "verificada",   label: "Verificación de empresa",  weight: 30, done: !!empresa.verificada },
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
  empresa, oficinasCount, update,
}: {
  empresa: Empresa;
  oficinasCount: number;
  /** Setter del hook `useEmpresa` · necesario para guardar la URL
   *  de Google Maps desde el card del sidebar. */
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const checklist = getChecklist(empresa, oficinasCount);
  /* Cómputo ponderado · cada item suma su `weight` cuando está done.
   * Total fijo = 100. La verificación pesa 30; el resto 10 cada uno.
   * Ej: sin verificar pero con todo lo demás → 70%. */
  const totalWeight = checklist.reduce((acc, c) => acc + c.weight, 0);
  const doneWeight = checklist.filter(c => c.done).reduce((acc, c) => acc + c.weight, 0);
  const percent = Math.round((doneWeight / totalWeight) * 100);
  const done = checklist.filter(c => c.done).length;
  const total = checklist.length;

  /* Una vez al 100% no aporta nada el sidebar · devolvemos `null`
   * para que el layout flex-row del padre colapse y la columna de
   * contenido (`flex-1`) ocupe todo el ancho · misma estructura que
   * la vista de agencia, donde no hay sidebar de fuerza del perfil. */
  if (percent >= 100) {
    return null;
  }

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

        {/* La configuración de Reseñas de Google se ha movido al tab
            "Sobre nosotros" · sección "Reseñas de Google" en modo
            edición. Allí hay espacio para la explicación completa.
            El acceso a `/colaboradores` se ha movido al CTA "Ver
            todos los colaboradores" dentro de la sección "Agencias
            colaboradoras" del tab Inicio · evita duplicar entradas. */}
      </aside>
  );
}
