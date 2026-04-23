/**
 * Pantalla · Ficha de agencia (`/colaboradores/:id`)
 *
 * Es LITERALMENTE la misma vista que `/empresa`, renderizando el
 * `<Empresa>` con `tenantId` poblado. La shape de datos la construye
 * `agencyToEmpresa()` en `src/lib/agencyEmpresaAdapter.ts`.
 *
 * Añade dos piezas propias del promotor que no pertenecen al perfil
 * público del tenant agencia:
 *   - `visitorSlot`  · overlay arriba con contrato + métricas con tu red
 *     + incidencias (bloques compactos).
 *   - `visitorFooter` · barra sticky inferior con acciones
 *     (Aprobar/Descartar · Pausar/Reanudar · Eliminar · Compartir).
 *
 * Así mantenemos UNA SOLA VISTA de empresa; cualquier mejora en
 * `Empresa.tsx` se refleja automáticamente aquí.
 *
 * TODO(backend): ver `docs/backend-integration.md` §4, §5.
 */

import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Pause, Play, Trash2, Share2, Mail, History, ArrowUpRight,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import Empresa from "./Empresa";
import { agencies, type Agency } from "@/data/agencies";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  recordRequestApproved, recordRequestRejected,
  recordCollaborationPaused, recordCollaborationResumed,
  recordCompanyAny,
  useCanViewCompanyHistory,
} from "@/lib/companyEvents";
import { useCurrentUser } from "@/lib/currentUser";

function getEstado(a: Agency): "activa" | "contrato-pendiente" | "pausada" {
  if (a.estadoColaboracion) return a.estadoColaboracion;
  if (a.status === "active") return "activa";
  if (a.status === "pending") return "contrato-pendiente";
  return "pausada";
}

export default function AgenciaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const agency = useMemo(() => agencies.find((a) => a.id === id), [id]);

  if (!id || !agency) {
    return (
      <div className="flex flex-col min-h-full bg-background items-center justify-center px-4 py-10 text-center">
        <Toaster position="top-center" richColors closeButton />
        <h1 className="text-xl font-bold text-foreground mb-1">Agencia no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          La agencia que buscas no existe o ha sido eliminada de tu red.
        </p>
        <button
          onClick={() => navigate("/colaboradores")}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          ← Volver a colaboradores
        </button>
      </div>
    );
  }

  const a = agency;
  const estado = getEstado(a);
  const isPending = !!(a.solicitudPendiente || a.isNewRequest);
  const currentUser = useCurrentUser();
  const actor = { name: currentUser.name, email: currentUser.email };
  const canViewHistory = useCanViewCompanyHistory();

  const handleAprobar = () => {
    recordRequestApproved(a.id, actor);
    toast.success("Solicitud aprobada", { description: `${a.name} ya puede colaborar en tus promociones.` });
    setTimeout(() => navigate("/colaboradores"), 700);
  };
  const handleRechazar = async () => {
    const ok = await confirm({
      title: "¿Descartar solicitud?",
      description: `${a.name} no podrá colaborar contigo hasta volver a solicitarlo.`,
      confirmLabel: "Descartar",
      destructive: true,
    });
    if (!ok) return;
    recordRequestRejected(a.id, actor);
    toast.success("Solicitud descartada");
    navigate("/colaboradores");
  };
  const handlePausar = () => {
    if (estado === "pausada") {
      recordCollaborationResumed(a.id, actor);
    } else {
      recordCollaborationPaused(a.id, actor);
    }
    toast.success(estado === "pausada" ? "Colaboración reanudada" : "Colaboración pausada");
  };
  const handleEliminar = async () => {
    const ok = await confirm({
      title: "¿Eliminar colaboración?",
      description: `Quitarás a ${a.name} de tu red. Las promociones compartidas dejarán de estar visibles.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    recordCompanyAny(a.id, "collaboration_ended", "Colaboración eliminada",
      "El promotor eliminó la agencia de su red.", actor);
    toast.success("Colaboración eliminada");
    navigate("/colaboradores");
  };

  /* ─── Footer sticky con acciones ─── */
  const visitorFooter = (
    <footer className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur-sm z-20">
      <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground mr-auto">
          {isPending
            ? "Revisa la solicitud y decide:"
            : estado === "pausada"
              ? "Colaboración en pausa:"
              : "Colaboración activa:"}
        </p>
        {isPending ? (
          <>
            <button
              onClick={handleRechazar}
              className="h-10 px-5 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted hover:border-destructive/30 hover:text-destructive transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleAprobar}
              className="h-10 px-6 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
            >
              Aprobar colaboración
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEliminar}
              className="h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Eliminar
            </button>
            <button
              onClick={handlePausar}
              className="h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
            >
              {estado === "pausada" ? (
                <><Play className="h-3.5 w-3.5" strokeWidth={1.75} /> Reanudar</>
              ) : (
                <><Pause className="h-3.5 w-3.5" strokeWidth={1.75} /> Pausar</>
              )}
            </button>
            {a.contactoPrincipal?.email && (
              <a
                href={`mailto:${a.contactoPrincipal.email}`}
                className="h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                Email
              </a>
            )}
            <button
              onClick={() => toast.info("Compartir — abre una promoción y pulsa Compartir con agencias")}
              className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors inline-flex items-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Compartir promoción
            </button>
          </>
        )}
      </div>
    </footer>
  );

  /* ─── Link al historial cross-empresa (solo admin del promotor) ───
     El historial es su propia página · aquí solo el enlace discreto
     arriba a la derecha. Visible únicamente si el usuario puede
     verlo (admin del promotor). */
  const visitorHeaderRight = canViewHistory ? (
    <Link
      to={`/colaboradores/${a.id}/historial`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <History className="h-3.5 w-3.5" strokeWidth={1.75} />
      Historial conmigo
      <ArrowUpRight className="h-3 w-3 opacity-60" />
    </Link>
  ) : null;

  return (
    <Empresa
      tenantId={id}
      visitorHeaderRight={visitorHeaderRight}
      visitorFooter={visitorFooter}
    />
  );
}
