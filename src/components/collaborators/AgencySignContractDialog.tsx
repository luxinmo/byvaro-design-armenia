/**
 * AgencySignContractDialog · vista de firma para la AGENCIA receptora.
 *
 * Cuando el promotor / comercializador / agencia que comparte envía
 * un contrato a firmar (status `sent` o `viewed`), la agencia recibe
 * email + SMS de Firmafy con el link OTP. Por si lo borra, lo pierde,
 * o quiere verificar antes de firmar, también lo ve dentro de Byvaro
 * con este dialog.
 *
 * El dialog NO firma desde Byvaro · la firma siempre va por Firmafy
 * (OTP por SMS · validación legal). Solo:
 *   1. Resumen del contrato (título, alcance, comisión, duración).
 *   2. Estado de cada firmante.
 *   3. Botón "Firmar en Firmafy" → abre `signUrl` del firmante de la
 *      agencia en una pestaña nueva.
 *
 * Permisos · cualquier miembro de la agencia con permiso
 * `collaboration.contracts.view` ve el dialog. Solo los firmantes
 * declarados pueden firmar; el resto solo ve el resumen.
 *
 * TODO(backend):
 *   GET /api/contracts/:id (lado agencia · scope filtrado al
 *   tenant que comparte) · devuelve el shape `CollaborationContract`
 *   incluyendo `signers[].signUrl` para el firmante actual. Si el
 *   usuario no es firmante, `signUrl` viene vacío.
 *   El backend NUNCA debe devolver el `signUrl` de OTRA agencia
 *   ni del propio promotor.
 */

import { ExternalLink, FileSignature, ShieldCheck, Clock, Mail, Phone, X, Building2, Calendar, Percent } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CollaborationContract, ContractSigner } from "@/lib/collaborationContracts";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";
import { getOwnerRoleLabel } from "@/lib/promotionRole";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: CollaborationContract | null;
  /** Email del usuario actual de la agencia · sirve para resaltar SU
   *  firmante y exponer SU `signUrl`. Si no se pasa, se muestran todos
   *  los firmantes en igualdad (vista no-firmante). */
  currentUserEmail?: string;
}

const SIGNER_STATUS_META: Record<NonNullable<ContractSigner["signerStatus"]>, { label: string; cls: string }> = {
  pending:   { label: "Pendiente",  cls: "bg-warning/10 text-warning" },
  delivered: { label: "Entregado",  cls: "bg-primary/10 text-primary" },
  read:      { label: "Leído",       cls: "bg-primary/10 text-primary" },
  signed:    { label: "Firmado",     cls: "bg-success/10 text-success" },
  rejected:  { label: "Rechazado",   cls: "bg-destructive/10 text-destructive" },
};

export function AgencySignContractDialog({ open, onOpenChange, contract, currentUserEmail }: Props) {
  if (!contract) return null;

  const c = contract;
  const promoCatalog = new Map<string, { id: string; name: string; ownerRole?: "promotor" | "comercializador" }>();
  for (const p of [...developerOnlyPromotions, ...promotions]) {
    if (!promoCatalog.has(p.id)) {
      promoCatalog.set(p.id, { id: p.id, name: p.name, ownerRole: p.ownerRole });
    }
  }

  /* Promociones cubiertas · si scopePromotionIds vacío, cubre todas
     las del owner. */
  const scoped = (c.scopePromotionIds ?? []).map((id) => promoCatalog.get(id)).filter(Boolean) as Array<{
    id: string; name: string; ownerRole?: "promotor" | "comercializador";
  }>;
  const isBlanket = !c.scopePromotionIds || c.scopePromotionIds.length === 0;

  /* Detectar el firmante del usuario actual (si lo es). El backend
     real solo devolverá `signUrl` para este firmante · en mock cogemos
     match exacto por email. */
  const meIndex = currentUserEmail
    ? c.signers.findIndex((s) => s.email.toLowerCase() === currentUserEmail.toLowerCase())
    : -1;
  const me = meIndex >= 0 ? c.signers[meIndex] : null;
  const myStatus = me?.signerStatus ?? "pending";
  const canSign = !!me && myStatus !== "signed" && myStatus !== "rejected";

  const handleSign = () => {
    if (!me?.signUrl) return;
    window.open(me.signUrl, "_blank", "noopener,noreferrer");
    /* No cerramos el dialog · el usuario vuelve después de firmar y
       el webhook actualiza el estado en background. */
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <FileSignature className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Contrato pendiente de firma
              </p>
              <h2 className="text-base font-semibold text-foreground truncate mt-0.5">{c.title}</h2>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {c.pdfFilename}
                {c.sentAt ? ` · enviado el ${new Date(c.sentAt).toLocaleDateString("es-ES")}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Cuerpo · scrollable */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Resumen */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Resumen del acuerdo
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <SummaryItem
                icon={Building2}
                label="Alcance"
                value={isBlanket ? "Todas las promociones" : `${scoped.length} promociones`}
              />
              <SummaryItem
                icon={Percent}
                label="Comisión"
                value={typeof c.comision === "number" && c.comision > 0 ? `${c.comision}%` : "—"}
              />
              <SummaryItem
                icon={Calendar}
                label="Duración"
                value={
                  typeof c.duracionMeses === "number"
                    ? c.duracionMeses === 0 ? "Indefinido" : `${c.duracionMeses} meses`
                    : "—"
                }
              />
              <SummaryItem
                icon={Clock}
                label="Firmar antes de"
                value={c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("es-ES") : "—"}
              />
            </div>
            {!isBlanket && scoped.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {scoped.map((p) => (
                  <li key={p.id} className="text-[12px] text-foreground flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                    {p.name}
                    {p.ownerRole === "comercializador" && (
                      <span className="text-[10px] text-muted-foreground">· comercializador</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Firmantes */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Firmantes ({c.signers.length})
            </p>
            <ul className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {c.signers.map((s, idx) => {
                const status = SIGNER_STATUS_META[s.signerStatus ?? "pending"];
                const isMe = idx === meIndex;
                return (
                  <li key={`${s.email}-${idx}`} className={cn(
                    "px-3 py-2.5 flex items-center gap-3",
                    isMe && "bg-primary/[0.03]",
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[12.5px] font-medium text-foreground truncate">{s.nombre}</p>
                        {isMe && (
                          <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-primary/10 text-primary text-[9.5px] font-semibold">
                            Tú
                          </span>
                        )}
                        {s.cargo && (
                          <span className="text-[10.5px] text-muted-foreground">· {s.cargo}</span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" strokeWidth={1.75} /> {s.email}
                        </span>
                        {s.telefono && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" strokeWidth={1.75} /> {s.telefono}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium shrink-0",
                      status.cls,
                    )}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Aviso del canal de firma */}
          <section>
            <div className="rounded-xl bg-muted/30 px-3.5 py-3 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground">
                  La firma se realiza en Firmafy con código OTP por SMS
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Te ha llegado el link a tu email{me?.telefono ? " y un código por SMS al " + me.telefono : ""}.
                  Validación legal en España según eIDAS. Una vez firmado por todas las partes, el
                  contrato pasa a "vigente" automáticamente.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cerrar
          </button>
          {canSign && me?.signUrl ? (
            <button
              type="button"
              onClick={handleSign}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
            >
              Firmar en Firmafy
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">
              {myStatus === "signed"
                ? "Ya firmaste · esperando al resto"
                : !me
                  ? "Solo los firmantes designados pueden firmar"
                  : "Link de firma no disponible · revisa tu email/SMS"}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-componentes ─── */

function SummaryItem({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">{label}</p>
        <p className="text-[12px] font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
