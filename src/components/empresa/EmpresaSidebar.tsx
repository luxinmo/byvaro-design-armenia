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

import { useState } from "react";
import {
  CheckCircle2, Circle, Send, Eye, TrendingUp, MousePointer2,
  Users, Mail, Clock, Copy, Check, RefreshCw, Trash2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Empresa } from "@/lib/empresa";
import { useInvitaciones, buildInvitacionUrl } from "@/lib/invitaciones";
import { InvitarAgenciaModal } from "./InvitarAgenciaModal";
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
  const { pendientes, revocar, reenviar, eliminar } = useInvitaciones();
  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const checklist = getChecklist(empresa, oficinasCount);
  const done = checklist.filter(c => c.done).length;
  const total = checklist.length;
  const percent = Math.round((done / total) * 100);

  const handleCopyLink = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(buildInvitacionUrl(token));
      setCopiedId(id);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <>
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
                  className={cn(percent >= 80 ? "text-emerald-500" : percent >= 50 ? "text-amber-500" : "text-primary")}
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
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

        {/* ═════ Invitar agencia (CTA principal) ═════ */}
        <SidebarCard
          title="Red de agencias"
          accent
          action="Invitar agencia"
          actionIcon={Send}
          onAction={() => setShowInvitarModal(true)}
        >
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Invita agencias colaboradoras para ampliar tu red comercial. Cuantas más agencias, más visibilidad para tus promociones.
          </p>
          {pendientes.length > 0 && (
            <div className="flex items-center gap-2 text-[11.5px]">
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-foreground">
                <strong>{pendientes.length}</strong> invitaci{pendientes.length === 1 ? "ón" : "ones"} pendiente{pendientes.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </SidebarCard>

        {/* ═════ Invitaciones pendientes ═════ */}
        {pendientes.length > 0 && (
          <SidebarCard title={`Invitaciones pendientes (${pendientes.length})`}>
            <ul className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto">
              {pendientes.map((inv) => {
                const diasRestantes = Math.max(0, Math.ceil((inv.expiraEn - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <li key={inv.id} className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">
                          {inv.nombreAgencia || inv.emailAgencia}
                        </p>
                        {inv.nombreAgencia && (
                          <p className="text-[10.5px] text-muted-foreground truncate">{inv.emailAgencia}</p>
                        )}
                      </div>
                      <span className="text-[9.5px] font-bold uppercase tracking-wide rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-500 border border-amber-500/30 px-2 py-0.5 shrink-0">
                        {inv.comisionOfrecida}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span>Caduca en {diasRestantes} día{diasRestantes !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(inv.token, inv.id)}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-card border border-border text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedId === inv.id ? <Check className="h-2.5 w-2.5 text-primary" /> : <Copy className="h-2.5 w-2.5" />}
                        {copiedId === inv.id ? "Copiado" : "Copiar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { reenviar(inv.id); toast.success("Invitación renovada 30 días"); }}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-card border border-border text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Renovar
                      </button>
                      <button
                        type="button"
                        onClick={() => { eliminar(inv.id); toast.success("Invitación eliminada"); }}
                        className="ml-auto inline-flex items-center h-6 px-2 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SidebarCard>
        )}

        {/* ═════ Rendimiento (mock hasta que haya backend) ═════ */}
        <SidebarCard title="Rendimiento últimos 30d">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex items-center gap-1 text-[9.5px] text-muted-foreground uppercase tracking-wider">
                <Eye className="h-2.5 w-2.5" /> Vistas
              </div>
              <p className="text-[18px] font-bold tnum leading-tight mt-0.5">—</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[9.5px] text-muted-foreground uppercase tracking-wider">
                <MousePointer2 className="h-2.5 w-2.5" /> Clics
              </div>
              <p className="text-[18px] font-bold tnum leading-tight mt-0.5">—</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[9.5px] text-muted-foreground uppercase tracking-wider">
                <Users className="h-2.5 w-2.5" /> Únicos
              </div>
              <p className="text-[18px] font-bold tnum leading-tight mt-0.5">—</p>
            </div>
          </div>
          <p className="text-[10.5px] text-muted-foreground leading-relaxed pt-2 border-t border-border">
            Empezaremos a medir vistas cuando publiques tu primer microsite público.
          </p>
        </SidebarCard>

        {/* ═════ Tip ═════ */}
        <SidebarCard title="">
          <div className="flex items-start gap-2.5 -mt-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11.5px] font-semibold text-foreground leading-tight">Consejo del día</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                Los perfiles con <strong>3+ testimonios y cover personalizada</strong> convierten 2× más invitaciones de agencias.
              </p>
            </div>
          </div>
        </SidebarCard>
      </aside>

      {showInvitarModal && (
        <InvitarAgenciaModal onClose={() => setShowInvitarModal(false)} />
      )}
    </>
  );
}
