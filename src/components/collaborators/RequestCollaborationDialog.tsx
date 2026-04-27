/**
 * RequestCollaborationDialog · modal que la AGENCIA usa para solicitar
 * colaborar en una promoción del promotor. Mirror simétrico (más
 * sencillo) del `SharePromotionDialog` que el promotor usa para
 * invitar a una agencia.
 *
 * Flujo único:
 *   1. Resumen visual de la promoción (cover, nombre, ubicación,
 *      comisión, disponibilidad, rango de precio, entrega, obra).
 *   2. Mensaje opcional para el promotor (140 chars).
 *   3. CTA "Enviar solicitud" → persiste en localStorage vía
 *      `crearSolicitud()` y muestra toast.
 *
 * El promotor verá la solicitud en su tab Agencias > Pendientes
 * (`AgenciasPendientesDialog` ya existente). En backend real el POST
 * dispara una notificación al admin del workspace promotor.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, MapPin, Home as HomeIcon, Coins, Calendar, Construction } from "lucide-react";
import { toast } from "sonner";
import { crearSolicitud } from "@/lib/solicitudesColaboracion";
import { useCurrentUser } from "@/lib/currentUser";
import { recordRequestReceived } from "@/lib/companyEvents";

interface RequestCollabPromo {
  id: string;
  name: string;
  location?: string;
  commission?: number;
  image?: string;
  availableUnits?: number;
  totalUnits?: number;
  priceMin?: number;
  priceMax?: number;
  delivery?: string;
  constructionProgress?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  promo: RequestCollabPromo | null;
}

function fmtPriceCompact(value?: number): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${Math.round(value)}`;
}

function fmtPriceRange(min?: number, max?: number): string {
  const a = fmtPriceCompact(min);
  const b = fmtPriceCompact(max);
  if (a === "—" && b === "—") return "—";
  if (a === b) return a;
  return `${a} – ${b}`;
}

const MAX_MESSAGE = 240;

const DEFAULT_MESSAGE =
  "Nos interesa colaborar en esta promoción. Tenemos cartera de clientes para este perfil de producto y experiencia comercializando proyectos similares en la zona. ¿Lo hablamos?";

export function RequestCollaborationDialog({ open, onOpenChange, agencyId, promo }: Props) {
  const user = useCurrentUser();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMessage(DEFAULT_MESSAGE);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSend = () => {
    if (!promo) return;
    setSubmitting(true);
    /* TODO(backend): POST /api/agencias/me/colaboraciones-solicitadas
     *   { promotionId, message? } · al recibir 201, cerrar modal y
     *   mostrar toast con info de seguimiento. Hoy persistimos en
     *   localStorage para que el lado UI ya muestre estado "Solicitada". */
    crearSolicitud({
      agencyId,
      promotionId: promo.id,
      message,
      requestedBy: { name: user.name, email: user.email, avatarUrl: user.avatar },
    });
    /* Historial cross-empresa · regla de oro CLAUDE.md. Se registra en
     *  el lado promotor (la agencia es el "subject") · cuando exista
     *  bidireccionalidad, también del lado agencia. */
    recordRequestReceived(agencyId, message?.trim() || undefined, {
      promotionId: promo.id,
      promotionName: promo.name,
    });
    toast.success("Solicitud enviada", {
      description: `El promotor recibirá un aviso para colaborar en "${promo.name}".`,
    });
    reset();
    onOpenChange(false);
  };

  if (!promo) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold text-foreground">
            Solicitar colaboración
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Envía una petición al promotor para empezar a comercializar esta promoción.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Resumen de la promoción */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {promo.image ? (
              <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                <img src={promo.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="aspect-[16/8] bg-muted/60 grid place-items-center">
                <HomeIcon className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.25} />
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-foreground truncate">{promo.name}</p>
              {promo.location && (
                <p className="text-[11.5px] text-muted-foreground truncate inline-flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {promo.location}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 rounded-xl bg-muted/40 px-3 py-2.5">
                <Stat
                  icon={HomeIcon}
                  label="Disponibles"
                  value={
                    typeof promo.availableUnits === "number" && typeof promo.totalUnits === "number"
                      ? `${promo.availableUnits}/${promo.totalUnits}`
                      : "—"
                  }
                />
                <Stat icon={Coins} label="Precio" value={fmtPriceRange(promo.priceMin, promo.priceMax)} />
                <Stat icon={Calendar} label="Entrega" value={promo.delivery || "—"} />
                <Stat
                  icon={Construction}
                  label="Obra"
                  value={typeof promo.constructionProgress === "number" ? `${promo.constructionProgress}%` : "—"}
                />
              </div>
              {typeof promo.commission === "number" && promo.commission > 0 && (
                <div className="mt-2.5 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary/10 text-primary text-[10.5px] font-semibold">
                  Comisión {promo.commission}%
                </div>
              )}
            </div>
          </div>

          {/* Mensaje opcional */}
          <div>
            <label htmlFor="collab-msg" className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Mensaje al promotor <span className="font-normal normal-case tracking-normal lowercase">(opcional)</span>
            </label>
            <textarea
              id="collab-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              placeholder="Cuéntale brevemente por qué quieres colaborar (cartera de clientes, mercado, idiomas, ventas previas…)."
              rows={4}
              className="mt-1.5 w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
            <p className="mt-1 text-[10.5px] text-muted-foreground/70 text-right tabular-nums">
              {message.length} / {MAX_MESSAGE}
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleClose(false)} className="rounded-full text-sm h-9 px-4">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSend} disabled={submitting} className="rounded-full text-sm h-9 px-5">
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-2.5 w-2.5" />
        <p className="text-[9.5px] uppercase tracking-wider truncate">{label}</p>
      </div>
      <p className="text-[12.5px] font-semibold text-foreground tabular-nums truncate mt-0.5">{value}</p>
    </div>
  );
}
