/**
 * OrgCollabRequestsDrawer · drawer derecho con la lista de
 * solicitudes de colaboración a nivel ORGANIZACIÓN recibidas (y
 * pendientes de respuesta) por el workspace logueado.
 *
 * Acciones por solicitud · Aceptar (verde, primary) · Rechazar
 * (rojo, ghost). Toast on success.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import {
  useReceivedOrgCollabRequests,
  aceptarOrgCollabRequest,
  rechazarOrgCollabRequest,
} from "@/lib/orgCollabRequests";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OrgCollabRequestsDrawer({ open, onClose }: Props) {
  const user = useCurrentUser();
  const received = useReceivedOrgCollabRequests(user, "pendiente");

  const handleAccept = (id: string, fromName: string) => {
    aceptarOrgCollabRequest(id, { name: user.name, email: user.email });
    toast.success(`Aceptaste la solicitud de ${fromName}`);
  };
  const handleReject = (id: string, fromName: string) => {
    rechazarOrgCollabRequest(id, { name: user.name, email: user.email });
    toast.info(`Rechazaste la solicitud de ${fromName}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className={cn(
              "fixed top-0 bottom-0 right-0 z-50 bg-card border-l border-border flex flex-col",
              "w-full lg:w-[440px]",
            )}
          >
            <header className="shrink-0 px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Solicitudes recibidas
                </p>
                <h2 className="text-base font-semibold text-foreground mt-0.5">
                  {received.length === 0
                    ? "Sin solicitudes pendientes"
                    : `${received.length} esperando tu respuesta`}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <main className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {received.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Sin solicitudes pendientes
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                    Cuando otra empresa te envíe una solicitud de colaboración aparecerá aquí.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {received.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
                          <Building2 className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {s.fromOrgName}
                          </p>
                          <p className="text-[11.5px] text-muted-foreground capitalize">
                            {s.fromOrgKind === "developer" ? "Promotor" : "Inmobiliaria"}
                            {" · "}
                            {new Date(s.createdAt).toLocaleDateString("es-ES")}
                          </p>
                          {s.message && (
                            <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed border-l-2 border-border pl-3">
                              {s.message}
                            </p>
                          )}
                          {s.requestedBy && (
                            <p className="text-[11px] text-muted-foreground/70 mt-2">
                              Enviada por {s.requestedBy.name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => handleAccept(s.id, s.fromOrgName)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-[12px] font-semibold hover:bg-foreground/90 transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                              Aceptar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(s.id, s.fromOrgName)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[12px] font-medium transition-colors"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                              Rechazar
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </main>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
