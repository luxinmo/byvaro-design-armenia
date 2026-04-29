/**
 * AgencyNoCollabInPromoBanner · barra superior en /promociones/:id
 * cuando una AGENCIA entra a una promoción de un PROMOTOR con el que
 * SÍ colabora pero la promoción NO está en su cartera.
 *
 * Caso típico: la agencia colabora con Luxinmo y entra a "Villa Serena".
 * Si Luxinmo todavía no le ha invitado a esa promo concreta, le
 * decimos que puede ver la ficha pública pero no operar (registrar,
 * compartir) hasta solicitar colaboración.
 *
 * Estado del botón:
 *   · sin solicitud previa → "Solicitar colaboración".
 *   · solicitud "viva" (pendiente o silenciosamente rechazada) → la
 *     agencia ve "Colaboración solicitada · fecha", botón disabled.
 *
 * REGLA DE ORO en CLAUDE.md "Solicitud de colaboración por promoción":
 *   · descarte silencioso → no mostramos el rechazo, lo seguimos viendo
 *     como "solicitada" para que la agencia no se entere.
 *   · NO permitimos reenviar tras descarte.
 *
 * TODO(backend):
 *   POST /api/agency/collaboration-requests · body:
 *     { promotionId, message? } → 201 { requestId }.
 *   El backend dispara `recordRequestReceived` en el historial
 *   cross-empresa del promotor.
 */

import { useMemo } from "react";
import { Handshake, Check } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import {
  crearSolicitud,
  findSolicitudVivaParaAgencia,
  useAllSolicitudes,
} from "@/lib/solicitudesColaboracion";
import { recordRequestReceived } from "@/lib/companyEvents";

interface Props {
  agencyId: string;
  promotionId: string;
  promotionName: string;
}

export function AgencyNoCollabInPromoBanner({ agencyId, promotionId, promotionName }: Props) {
  const user = useCurrentUser();
  const list = useAllSolicitudes();

  const yaSolicitada = useMemo(
    () => findSolicitudVivaParaAgencia(agencyId, promotionId, list),
    [agencyId, promotionId, list],
  );

  const handleSolicitar = () => {
    crearSolicitud({
      agencyId,
      promotionId,
      requestedBy: { name: user.name, email: user.email, avatarUrl: user.avatar },
    });
    /* Registra evento cross-empresa en el historial del promotor ·
     * el admin lo ve en /colaboradores/:id?tab=historial. */
    recordRequestReceived(agencyId, undefined, { promotionId, promotionName });
    toast.success("Solicitud de colaboración enviada");
  };

  if (yaSolicitada) {
    return (
      <div className="bg-warning/10 border-b border-warning/30 px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-content mx-auto flex items-center gap-3 flex-wrap">
          <Check className="h-4 w-4 text-warning shrink-0" />
          <p className="text-[12.5px] text-foreground min-w-0 flex-1">
            <b className="font-semibold">Colaboración solicitada</b>
            <span className="ml-1.5 text-muted-foreground">
              · esperando aprobación del promotor para "{promotionName}"
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/[0.06] border-b border-primary/20 px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="max-w-content mx-auto flex items-center gap-3 flex-wrap">
        <Handshake className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[12.5px] text-foreground min-w-0 flex-1">
          <b className="font-semibold">No colaboras en esta promoción</b>
          <span className="ml-1.5 text-muted-foreground hidden sm:inline">
            · solicita colaboración para registrar clientes y compartir "{promotionName}"
          </span>
        </p>
        <button
          type="button"
          onClick={handleSolicitar}
          className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          Solicitar colaboración
        </button>
      </div>
    </div>
  );
}
