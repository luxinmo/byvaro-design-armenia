/**
 * DeactivateUserDialog · forzar reasignación de activos antes de
 * desactivar a un miembro del equipo.
 *
 * REGLA DE ORO (CLAUDE.md §🔄): un empleado que sale NO debe dejar
 * contactos, oportunidades, registros, visitas ni propiedades sin
 * dueño. Este dialog obliga al admin a decidir a quién pasa cada
 * categoría. Al confirmar, cada elemento reasignado queda en el
 * historial de la entidad con un evento "Heredado de <empleado>"
 * para preservar el contexto.
 *
 * El email del empleado se delega automáticamente al destinatario
 * que el admin elija en la categoría "email" — el backend configura
 * un forward de 6 meses para capturar correos entrantes.
 *
 * TODO(backend): POST /api/members/:id/handover
 *   body: { reassignments: { [category]: newMemberId }, reason?, deactivate: true }
 *   server hace la transacción atómica · falla si faltan categorías.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, UserCheck, ArrowRight, Users, Briefcase,
  FileText, CalendarDays, Building2, Mail, Check, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getMemberInventory,
  type AssetCategory, type AssetInventoryItem, type HandoverPlan,
} from "@/lib/assetOwnership";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";
import { UserSelect } from "@/components/ui/UserSelect";
import { cn } from "@/lib/utils";

const ICON_BY_CATEGORY: Record<AssetCategory, React.ComponentType<{ className?: string }>> = {
  contacts: Users,
  opportunities: Briefcase,
  records: FileText,
  visits: CalendarDays,
  promotions: Building2,
  email: Mail,
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Miembro que se va a desactivar. */
  member: TeamMember | null;
  /** Se invoca al confirmar · el padre aplica el plan + desactiva. */
  onConfirm: (plan: HandoverPlan) => void;
};

export function DeactivateUserDialog({ open, onClose, member, onConfirm }: Props) {
  const inventory = useMemo(
    () => (member ? getMemberInventory(member.id) : []),
    [member],
  );
  /** Ids a excluir del UserSelect: el propio miembro que se desactiva. */
  const excludeIds = useMemo(() => (member ? [member.id] : []), [member]);

  const [reassignments, setReassignments] = useState<Partial<Record<AssetCategory, string>>>({});
  const [bulkTarget, setBulkTarget] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setReassignments({});
    setBulkTarget("");
    setReason("");
  }, [open, member]);

  const setFor = (cat: AssetCategory, id: string) =>
    setReassignments((r) => ({ ...r, [cat]: id }));

  const applyBulk = (id: string) => {
    setBulkTarget(id);
    if (!id) return;
    const next: Partial<Record<AssetCategory, string>> = {};
    inventory.forEach((item) => { next[item.category] = id; });
    setReassignments(next);
  };

  const missingCount = inventory.filter((item) => !reassignments[item.category]).length;
  const canConfirm = missingCount === 0 && !!member;

  const handleConfirm = () => {
    if (!member || !canConfirm) return;
    onConfirm({
      fromMemberId: member.id,
      reassignments,
      reason: reason.trim() || undefined,
    });
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[640px] p-0 gap-0 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-sm font-bold inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Desactivar a {member.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Antes de desactivar, reasigna sus contactos, oportunidades y tareas a
            otros miembros activos. Quedará constancia en cada historial como
            <b className="text-foreground"> "Heredado de {member.name}"</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {inventory.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 p-5 text-center">
              <Check className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                No tiene nada asignado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Se puede desactivar sin reasignar.
              </p>
            </div>
          ) : (
            <>
              {/* Atajo · asignar todo al mismo */}
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-2">
                  <UserCheck className="h-3 w-3" />
                  Asignar todo a un miembro (atajo)
                </p>
                <UserSelect
                  value={bulkTarget || null}
                  onChange={applyBulk}
                  placeholder="Selecciona un miembro…"
                  excludeIds={excludeIds}
                  onlyActive
                />
              </div>

              {/* Inventario por categoría */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Activos a reasignar · {inventory.length} {inventory.length === 1 ? "categoría" : "categorías"}
                </p>
                {inventory.map((item) => (
                  <InventoryRow
                    key={item.category}
                    item={item}
                    fromMember={member}
                    excludeIds={excludeIds}
                    value={reassignments[item.category] ?? ""}
                    onChange={(id) => setFor(item.category, id)}
                  />
                ))}
              </div>

              {/* Motivo opcional */}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Motivo (opcional · queda en el historial)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Baja voluntaria · 23 abril 2026"
                  rows={2}
                  maxLength={200}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
                />
              </label>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border flex-row justify-between gap-2 sm:gap-2">
          <div className="text-[11px] text-muted-foreground">
            {missingCount > 0 && inventory.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-warning" />
                {missingCount} {missingCount === 1 ? "categoría sin" : "categorías sin"} asignar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className={cn("rounded-full", canConfirm && "bg-destructive hover:bg-destructive/90")}
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              <Check className="h-3.5 w-3.5" />
              {inventory.length === 0 ? "Desactivar" : "Reasignar y desactivar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   InventoryRow · una categoría del inventario con su dropdown
   ═══════════════════════════════════════════════════════════════════ */

function InventoryRow({
  item, fromMember, excludeIds, value, onChange,
}: {
  item: AssetInventoryItem;
  fromMember: TeamMember;
  excludeIds: string[];
  value: string;
  onChange: (id: string) => void;
}) {
  const Icon = ICON_BY_CATEGORY[item.category];
  /* Avisos post-asignación · resolvemos el nombre con findTeamMember
   * para que sea consistente con lo que pinta el UserSelect. */
  const assigneeName = value
    ? TEAM_MEMBERS.find((m) => m.id === value)?.name
    : undefined;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className={cn(
          "h-9 w-9 rounded-lg grid place-items-center shrink-0",
          value ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            {item.label}
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full tnum">
              {item.count}
            </span>
            {item.autoDelegated && (
              <span className="text-[9px] font-semibold text-primary/80 uppercase tracking-wider">
                Delegación auto
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {item.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-[48px]">
        <span className="text-[11px] text-muted-foreground truncate shrink-0">
          {fromMember.name}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <div className="flex-1 min-w-0">
          <UserSelect
            value={value || null}
            onChange={onChange}
            placeholder="Elige miembro…"
            excludeIds={excludeIds}
            onlyActive
          />
        </div>
      </div>
      {assigneeName && (
        <p className="text-[10px] text-muted-foreground/80 italic mt-1.5 pl-[48px]">
          {item.autoDelegated
            ? `Los emails entrantes se reenvían a ${assigneeName} durante 6 meses.`
            : `${item.count} ${item.count === 1 ? "elemento pasará" : "elementos pasarán"} a ${assigneeName} con "Heredado de ${fromMember.name}" en su historial.`}
        </p>
      )}
    </div>
  );
}
