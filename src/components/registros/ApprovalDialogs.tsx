/**
 * ApprovalDialogs · 3 diálogos que componen el flujo de aprobación
 * de un registro · se muestran en secuencia según las señales:
 *
 *   1. `MatchConfirmDialog` · si `matchPercentage >= 65`. Recuerda
 *      al promotor que hay coincidencia. Si no tiene el permiso
 *      `records.matchDetails.view` oculta los datos sensibles.
 *
 *   2. `RelationConfirmDialog` · si el backend detectó una
 *      `possibleRelation` (ej. pareja, familiar). El promotor
 *      confirma o descarta el vínculo antes de seguir.
 *
 *   3. `VisitConfirmDialog` · si `tipo === "registration_visit"` o
 *      `tipo === "visit_only"`. Pide AGENTE obligatorio + aceptar
 *      horario propuesto o proponer otro.
 *
 * Todos los diálogos devuelven resultados vía callbacks explícitos ·
 * la orquestación vive en `src/pages/Registros.tsx`.
 */

import { useState } from "react";
import {
  AlertTriangle, HeartHandshake, CalendarClock, Eye, EyeOff,
  Info, CheckCircle2, X, XCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { UserSelect } from "@/components/ui/UserSelect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Registro } from "@/data/records";

/* ══════════════════════════════════════════════════════════════════
   1 · MatchConfirmDialog · recordatorio de coincidencia con cliente
   ══════════════════════════════════════════════════════════════════ */

type MatchConfirmProps = {
  open: boolean;
  record: Registro;
  /** Si el user tiene `records.matchDetails.view` → muestra nombre +
   *  email del cliente existente. Si no, solo el %. */
  canSeeDetails: boolean;
  onContinue: () => void;
  onCancel: () => void;
};

export function MatchConfirmDialog({
  open, record, canSeeDetails, onContinue, onCancel,
}: MatchConfirmProps) {
  const pct = record.matchPercentage;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-warning/15 text-warning grid place-items-center">
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-base">
                Coincidencia detectada · {pct}%
              </DialogTitle>
              <DialogDescription className="text-[12px] mt-0.5">
                Este cliente tiene alta similitud con un contacto existente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {canSeeDetails && record.matchCliente ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                <Eye className="h-3 w-3" />
                Cliente existente
              </p>
              <dl className="space-y-1.5 text-[12.5px]">
                {record.matchCliente.nombre && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Nombre</dt>
                    <dd className="font-medium text-foreground text-right break-words">
                      {record.matchCliente.nombre}
                    </dd>
                  </div>
                )}
                {record.matchCliente.email && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-medium text-foreground text-right break-words">
                      {record.matchCliente.email}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-start gap-2.5">
              <EyeOff className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-[12.5px] font-medium text-foreground">
                  Datos del cliente existente ocultos
                </p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                  Solo los administradores con el permiso{" "}
                  <code className="text-[10.5px] bg-muted px-1 rounded">records.matchDetails.view</code>{" "}
                  pueden ver la identidad del contacto coincidente.
                </p>
              </div>
            </div>
          )}

          {record.matchWith && (
            <p className="text-[11.5px] text-muted-foreground italic">
              {record.matchWith}
            </p>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
            <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[12px] text-foreground leading-relaxed">
              Aprobar este registro puede generar una comisión duplicada si
              el cliente ya está activo con otra agencia. Confirma que es
              una persona distinta antes de continuar.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={onContinue} className="rounded-full">
            Continuar con la aprobación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════
   2 · RelationConfirmDialog · posible relación detectada por backend
   ══════════════════════════════════════════════════════════════════ */

type RelationConfirmProps = {
  open: boolean;
  record: Registro;
  canSeeDetails: boolean;
  onConfirm: (linkContact: boolean) => void;  // true = vincular · false = es casualidad
  onCancel: () => void;
};

export function RelationConfirmDialog({
  open, record, canSeeDetails, onConfirm, onCancel,
}: RelationConfirmProps) {
  const rel = record.possibleRelation;
  if (!rel) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <HeartHandshake className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-base">
                Posible {rel.relation} detectada
              </DialogTitle>
              <DialogDescription className="text-[12px] mt-0.5">
                Byvaro ha cruzado datos del CRM · confianza {rel.confidence}%.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Contacto existente
            </p>
            <p className="text-[14px] font-semibold text-foreground">
              {canSeeDetails ? rel.contactName : "Un contacto del CRM"}
            </p>
            {!canSeeDetails && (
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                Nombre oculto · sin permiso{" "}
                <code className="text-[10.5px] bg-muted px-1 rounded">records.matchDetails.view</code>.
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Motivos de la detección
            </p>
            <ul className="space-y-1.5">
              {rel.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Si confirmas la relación, quedará registrada bidireccionalmente en
              ambas fichas. Si descartas, seguimos con la aprobación sin vincular.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => onConfirm(false)} className="rounded-full">
            No es {rel.relation}
          </Button>
          <Button onClick={() => onConfirm(true)} className="rounded-full">
            Sí, vincular como {rel.relation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════
   3 · VisitConfirmDialog · agente obligatorio + accept/propose horario
   ══════════════════════════════════════════════════════════════════ */

export type VisitConfirmResult = {
  hostUserId: string;
  /** Si `accepted`, se usa la fecha/hora propuesta original · si
   *  `propose`, se usan estos campos. */
  mode: "accepted" | "propose";
  proposedDate?: string;   // YYYY-MM-DD · solo si mode === "propose"
  proposedTime?: string;   // HH:mm      · solo si mode === "propose"
};

type VisitConfirmProps = {
  open: boolean;
  record: Registro;
  onConfirm: (result: VisitConfirmResult) => void;
  onCancel: () => void;
};

export function VisitConfirmDialog({
  open, record, onConfirm, onCancel,
}: VisitConfirmProps) {
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<"accepted" | "propose">("accepted");
  const [proposedDate, setProposedDate] = useState(record.visitDate ?? "");
  const [proposedTime, setProposedTime] = useState(record.visitTime ?? "");

  const proposedFilled = proposedDate.length > 0 && proposedTime.length > 0;
  const canConfirm =
    !!hostUserId && (mode === "accepted" || proposedFilled);

  const handleConfirm = () => {
    if (!canConfirm || !hostUserId) return;
    onConfirm({
      hostUserId,
      mode,
      proposedDate: mode === "propose" ? proposedDate : undefined,
      proposedTime: mode === "propose" ? proposedTime : undefined,
    });
  };

  const originalWhen = record.visitDate
    ? `${formatVisitDate(record.visitDate)}${record.visitTime ? ` · ${record.visitTime}h` : ""}`
    : "Sin fecha propuesta";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-base">
                Confirmar visita · {record.cliente.nombre}
              </DialogTitle>
              <DialogDescription className="text-[12px] mt-0.5">
                {record.tipo === "visit_only"
                  ? "Cliente ya aprobado previamente · solo confirma la visita."
                  : "Registro aprobado · confirma fecha y agente que atenderá."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Agente anfitrión · obligatorio */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
              Agente que realizará la visita <span className="text-destructive">*</span>
            </label>
            <UserSelect
              value={hostUserId}
              onChange={setHostUserId}
              placeholder="Selecciona agente…"
              onlyActive
              required
            />
          </div>

          {/* Horario · aceptar o proponer */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Horario
            </p>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors",
                  mode === "accepted"
                    ? "border-foreground/30 bg-muted/30"
                    : "border-border hover:bg-muted/20",
                )}
              >
                <input
                  type="radio"
                  name="visit-mode"
                  value="accepted"
                  checked={mode === "accepted"}
                  onChange={() => setMode("accepted")}
                  className="mt-1 accent-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    Aceptar horario propuesto
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
                    {originalWhen}
                  </p>
                </div>
              </label>

              <label
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors",
                  mode === "propose"
                    ? "border-foreground/30 bg-muted/30"
                    : "border-border hover:bg-muted/20",
                )}
              >
                <input
                  type="radio"
                  name="visit-mode"
                  value="propose"
                  checked={mode === "propose"}
                  onChange={() => setMode("propose")}
                  className="mt-1 accent-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    Proponer otro horario
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Se envía contrapropuesta a la agencia.
                  </p>
                  {mode === "propose" && (
                    <div className="flex gap-2 mt-2.5">
                      <input
                        type="date"
                        value={proposedDate}
                        onChange={(e) => setProposedDate(e.target.value)}
                        className="h-9 px-3 text-[13px] bg-card border border-border rounded-lg outline-none focus:border-foreground/40 flex-1 min-w-0"
                      />
                      <input
                        type="time"
                        value={proposedTime}
                        onChange={(e) => setProposedTime(e.target.value)}
                        className="h-9 px-3 text-[13px] bg-card border border-border rounded-lg outline-none focus:border-foreground/40 w-[110px]"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} className="rounded-full">
            {mode === "accepted" ? "Confirmar visita" : "Enviar contrapropuesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

/* ══════════════════════════════════════════════════════════════════
   4 · RejectDialog · motivo obligatorio al rechazar
   · Pre-elige una razón canónica + opcional comentario extra.
   · La razón final se guarda en `decisionNote` del registro y se
     propaga a la visita asociada si existe (ver onRegistroRejected).
   ══════════════════════════════════════════════════════════════════ */

/** Catálogo de motivos canónicos · compartido con el backend cuando
 *  exista. Si se amplía, añadirlo también a
 *  `docs/backend-integration.md §Registros`. */
const REJECT_REASONS: { value: string; label: string }[] = [
  { value: "duplicate_other_agency", label: "Cliente ya registrado por otra agencia" },
  { value: "incomplete_data",        label: "Datos incompletos o incorrectos" },
  { value: "other",                  label: "Otro (describir abajo)" },
];

type RejectDialogProps = {
  open: boolean;
  record: Registro;
  onConfirm: (decisionNote: string) => void;
  onCancel: () => void;
};

export function RejectDialog({ open, record, onConfirm, onCancel }: RejectDialogProps) {
  const [reasonKey, setReasonKey] = useState<string>("");
  const [comment, setComment] = useState("");

  const canConfirm =
    reasonKey !== "" && (reasonKey !== "other" || comment.trim().length >= 5);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const label = REJECT_REASONS.find((r) => r.value === reasonKey)?.label ?? "";
    const note = comment.trim()
      ? reasonKey === "other" ? comment.trim() : `${label} · ${comment.trim()}`
      : label;
    onConfirm(note);
    // reset para la próxima apertura
    setReasonKey("");
    setComment("");
  };

  const handleCancel = () => {
    setReasonKey("");
    setComment("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive grid place-items-center">
              <XCircle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-base">
                Rechazar · {record.cliente.nombre}
              </DialogTitle>
              <DialogDescription className="text-[12px] mt-0.5">
                Selecciona el motivo · se envía a la agencia junto a la notificación.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Motivo
            </p>
            {REJECT_REASONS.map((r) => {
              const active = reasonKey === r.value;
              return (
                <label
                  key={r.value}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors",
                    active
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border hover:bg-muted/30",
                  )}
                >
                  <input
                    type="radio"
                    name="reject-reason"
                    value={r.value}
                    checked={active}
                    onChange={() => setReasonKey(r.value)}
                    className="mt-1 accent-destructive"
                  />
                  <span className="text-[12.5px] text-foreground leading-snug">{r.label}</span>
                </label>
              );
            })}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
              Comentario {reasonKey === "other" && <span className="text-destructive">* obligatorio</span>}
              {reasonKey !== "other" && <span className="text-muted-foreground/70 normal-case tracking-normal font-normal"> · opcional</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                reasonKey === "other"
                  ? "Describe el motivo del rechazo (mínimo 5 caracteres)…"
                  : "Añade contexto si quieres · la agencia lo verá…"
              }
              rows={3}
              className="w-full px-3 py-2 text-[13px] bg-card border border-border rounded-xl outline-none focus:border-foreground/40 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={handleCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-full"
          >
            Confirmar rechazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
