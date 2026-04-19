/**
 * EditableSection · tarjeta con modo vista y modo edición.
 *
 * Patrón idéntico al original Lovable:
 *   - Vista: icono "Pencil" aparece on-hover arriba a la derecha,
 *     click → entra en modo edit y muestra `editContent`.
 *   - Edit:  botones Save / Cancel arriba a la derecha.
 *   - Sin `editContent`: no muestra el botón editar (solo display).
 *
 * Los callbacks `onSave`/`onCancel` son opcionales. Si no se pasan, el
 * componente sale del modo edit automáticamente al guardar (los
 * cambios se asumen ya persistidos por los hooks del padre, así que
 * Save es cosmético — como en el original).
 */

import { useState, type ReactNode } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableSectionProps {
  title: string;
  children: ReactNode;
  editContent?: ReactNode;
  viewMode: "edit" | "preview";
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
  rightSlot?: ReactNode;
}

export function EditableSection({
  title, children, editContent, viewMode, onSave, onCancel, className, rightSlot,
}: EditableSectionProps) {
  const [editing, setEditing] = useState(false);

  const handleSave = () => { onSave?.(); setEditing(false); };
  const handleCancel = () => { onCancel?.(); setEditing(false); };

  if (editing && editContent) {
    return (
      <div className={cn(
        "rounded-2xl border border-primary/30 bg-card shadow-soft overflow-hidden",
        className,
      )}>
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
          <h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 px-3 h-7 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors"
            >
              <Check className="h-3 w-3" /> Guardar
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 px-3 h-7 rounded-full border border-border text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
          </div>
        </div>
        <div className="px-5 pb-5">{editContent}</div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section relative",
      className,
    )}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          {rightSlot}
          {viewMode === "edit" && editContent && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover/section:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 h-7 rounded-md bg-background border border-border text-[11.5px] text-muted-foreground hover:text-foreground shadow-soft"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
        </div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

/* ─── Info item (icono + label + valor) ──────────────────────────── */
export function InfoItem({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-[14px] font-semibold text-foreground tnum">{value}</p>
    </div>
  );
}
