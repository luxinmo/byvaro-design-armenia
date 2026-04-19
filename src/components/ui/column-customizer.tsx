import React, { useState, useMemo } from "react";
import { Search, X, GripVertical, Lock, Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface ColumnDef {
  key: string;
  label: string;
  locked?: boolean; // Can't be toggled off
}

interface ColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnDef[];
  visibleColumns: Set<string>;
  onSave: (visible: Set<string>) => void;
}

export function ColumnCustomizer({
  open,
  onOpenChange,
  columns,
  visibleColumns,
  onSave,
}: ColumnCustomizerProps) {
  const [draft, setDraft] = useState<Set<string>>(new Set(visibleColumns));
  const [search, setSearch] = useState("");

  // Reset draft when dialog opens
  React.useEffect(() => {
    if (open) {
      setDraft(new Set(visibleColumns));
      setSearch("");
    }
  }, [open, visibleColumns]);

  const filtered = useMemo(() => {
    if (!search.trim()) return columns;
    const q = search.toLowerCase();
    return columns.filter(c => c.label.toLowerCase().includes(q));
  }, [columns, search]);

  const toggle = (key: string) => {
    const col = columns.find(c => c.key === key);
    if (col?.locked) return;
    const next = new Set(draft);
    next.has(key) ? next.delete(key) : next.add(key);
    setDraft(next);
  };

  const selectedCount = draft.size;
  const totalCount = columns.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <DialogTitle className="text-sm font-semibold">Personalizar columnas</DialogTitle>
          </div>
          <span className="text-xs text-muted-foreground font-medium pr-7">
            {selectedCount} de {totalCount} seleccionados
          </span>
        </div>
        <DialogDescription className="sr-only">Selecciona las columnas visibles en la tabla</DialogDescription>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Buscar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Column list */}
        <div className="max-h-[400px] overflow-y-auto border-t border-border">
          {filtered.map(col => {
            const isActive = draft.has(col.key);
            const isLocked = col.locked;
            return (
              <button
                key={col.key}
                onClick={() => toggle(col.key)}
                disabled={isLocked}
                className={cn(
                  "flex items-center gap-3 w-full px-5 py-3 text-left border-b border-border/50 transition-colors",
                  !isLocked && "hover:bg-muted/30 cursor-pointer",
                  isLocked && "cursor-default"
                )}
              >
                {/* Drag handle */}
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" strokeWidth={1.5} />

                {/* Checkbox or lock */}
                {isLocked ? (
                  <div className="h-[18px] w-[18px] rounded border border-muted-foreground/20 bg-muted/50 flex items-center justify-center shrink-0">
                    <Lock className="h-3 w-3 text-muted-foreground/50" strokeWidth={2} />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "h-[18px] w-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      isActive
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/25 bg-background"
                    )}
                  >
                    {isActive && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                  </div>
                )}

                {/* Label */}
                <span className={cn(
                  "text-sm",
                  isActive || isLocked ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {col.label}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No se encontraron columnas
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <Button
            size="sm"
            className="h-9 px-5 text-sm"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-5 text-sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
