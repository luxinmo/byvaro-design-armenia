/**
 * /ajustes/contactos/relaciones — Tipos de relación entre contactos.
 *
 * Catálogo editable por admin. Se usa en el dialog "Vincular contacto"
 * de la ficha (sidebar Resumen). Default: 5 tipos básicos (Cónyuge,
 * Pareja, Familiar, Colega, Otro). El admin puede:
 *  - Añadir tipos propios (ej. Inversor conjunto, Heredero…)
 *  - Renombrar
 *  - Activar / desactivar (los desactivados siguen mostrándose en
 *    vínculos existentes pero no aparecen en el selector de nuevos)
 *  - Eliminar
 *
 * TODO(backend): GET/POST /api/contacts/relation-types.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Lock, Heart, Users, Briefcase, MoreHorizontal } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadRelationTypes, saveRelationTypes, nextRelationTypeId,
  type RelationType,
} from "@/components/contacts/relationTypesStorage";

const BUILTIN_IDS = ["spouse", "partner", "family", "colleague", "other"];

const ICON_FOR_BUILTIN: Record<string, typeof Heart> = {
  spouse: Heart,
  partner: Heart,
  family: Users,
  colleague: Briefcase,
  other: MoreHorizontal,
};

export default function AjustesContactosRelaciones() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const confirm = useConfirm();
  const { setDirty } = useDirty();

  const [types, setTypes] = useState<RelationType[]>(() => loadRelationTypes());
  const [initial, setInitial] = useState<RelationType[]>(types);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    setDirty(JSON.stringify(types) !== JSON.stringify(initial));
  }, [types, initial, setDirty]);

  const isDirty = JSON.stringify(types) !== JSON.stringify(initial);

  const save = () => {
    if (!canEdit) return;
    saveRelationTypes(types);
    setInitial(types);
    setDirty(false);
    toast.success("Tipos de relación guardados");
  };

  const startCreate = () => {
    if (!canEdit) return;
    setCreating(true);
    setNewLabel("");
  };

  const submitCreate = () => {
    const clean = newLabel.trim();
    if (!clean) {
      setCreating(false);
      return;
    }
    if (types.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe un tipo con ese nombre");
      return;
    }
    const id = nextRelationTypeId(clean, types);
    setTypes((prev) => [...prev, { id, label: clean, enabled: true }]);
    setCreating(false);
    setNewLabel("");
  };

  const startEdit = (id: string, label: string) => {
    setEditingId(id);
    setEditLabel(label);
  };

  const submitEdit = (id: string) => {
    const clean = editLabel.trim();
    if (!clean) { setEditingId(null); return; }
    if (types.some((t) => t.id !== id && t.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe un tipo con ese nombre");
      return;
    }
    setTypes((prev) => prev.map((t) => t.id === id ? { ...t, label: clean } : t));
    setEditingId(null);
  };

  const toggleEnabled = (id: string) => {
    setTypes((prev) => prev.map((t) =>
      t.id === id ? { ...t, enabled: t.enabled === false ? true : false } : t,
    ));
  };

  const removeType = async (id: string) => {
    const t = types.find((x) => x.id === id);
    if (!t) return;
    const ok = await confirm({
      title: `¿Eliminar "${t.label}"?`,
      description: BUILTIN_IDS.includes(id)
        ? "Es un tipo predeterminado. Los vínculos existentes seguirán mostrándose con su nombre, pero no podrás crear nuevos con este tipo."
        : "Los vínculos existentes seguirán mostrándose con su nombre, pero no podrás crear nuevos con este tipo.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    setTypes((prev) => prev.filter((t) => t.id !== id));
  };

  const restoreDefaults = async () => {
    const ok = await confirm({
      title: "¿Restaurar valores por defecto?",
      description: "Vuelve a los 5 tipos básicos: Cónyuge, Pareja, Familiar, Colega, Otro. Tus tipos personalizados se eliminarán.",
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    setTypes([
      { id: "spouse",    label: "Cónyuge",  enabled: true },
      { id: "partner",   label: "Pareja",   enabled: true },
      { id: "family",    label: "Familiar", enabled: true },
      { id: "colleague", label: "Colega",   enabled: true },
      { id: "other",     label: "Otro",     enabled: true },
    ]);
  };

  return (
    <SettingsScreen
      title="Tipos de relación"
      description="Cómo se vinculan los contactos entre sí (cónyuges, familiares, asesores…). Aparecen en el dialog «Vincular contacto» de la ficha."
      actions={canEdit ? (
        <div className="flex gap-2">
          <Button onClick={restoreDefaults} variant="ghost" size="sm" className="rounded-full">
            Valores por defecto
          </Button>
          <Button onClick={save} disabled={!isDirty} size="sm" className="rounded-full">
            Guardar
          </Button>
        </div>
      ) : undefined}
    >
      {!canEdit && (
        <SettingsCard>
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Solo los administradores pueden gestionar los tipos de relación.
            </p>
          </div>
        </SettingsCard>
      )}

      <SettingsCard
        title={`${types.filter((t) => t.enabled !== false).length} tipos activos`}
        description="Los tipos desactivados se mantienen para vínculos existentes pero no aparecen al crear nuevos."
        footer={canEdit ? (
          <div className="flex justify-end">
            <Button onClick={startCreate} variant="outline" size="sm" className="rounded-full">
              <Plus className="h-3.5 w-3.5" /> Añadir tipo
            </Button>
          </div>
        ) : undefined}
      >
        <ul className="space-y-1.5">
          {types.map((t) => {
            const builtin = BUILTIN_IDS.includes(t.id);
            const Icon = ICON_FOR_BUILTIN[t.id] ?? Pencil;
            const editing = editingId === t.id;
            const disabled = t.enabled === false;
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors",
                  disabled ? "border-border/40 bg-muted/20 opacity-60" : "border-border/40 bg-card",
                )}
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                {editing ? (
                  <Input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEdit(t.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => submitEdit(t.id)}
                    className="h-8 text-sm flex-1"
                  />
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground inline-flex items-center gap-2">
                      {t.label}
                      {builtin && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5">
                          predet.
                        </span>
                      )}
                      {disabled && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5">
                          desactivado
                        </span>
                      )}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleEnabled(t.id)}
                          title={disabled ? "Activar" : "Desactivar"}
                          className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {disabled
                            ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                            : <X className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => startEdit(t.id, t.label)}
                          title="Renombrar"
                          className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeType(t.id)}
                          title="Eliminar"
                          className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}

          {creating && (
            <li className="flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-foreground/30 bg-card">
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                  if (e.key === "Escape") { setCreating(false); setNewLabel(""); }
                }}
                onBlur={submitCreate}
                placeholder="Ej. Inversor conjunto, Heredero…"
                className="h-8 text-sm flex-1"
              />
            </li>
          )}
        </ul>
      </SettingsCard>
    </SettingsScreen>
  );
}
