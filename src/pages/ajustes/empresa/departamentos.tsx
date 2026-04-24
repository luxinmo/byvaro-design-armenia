/**
 * /ajustes/empresa/departamentos — CRUD de departamentos del workspace.
 *
 * Un departamento es simplemente un nombre único. Se usan como
 * sugerencia en los formularios de alta/edición de miembro · el admin
 * los puede gestionar desde aquí sin tocar código.
 *
 * Store reactivo: `src/lib/departmentsStorage.ts`.
 * TODO(backend): `GET/POST/PATCH/DELETE /api/workspace/departments`.
 */

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X as XIcon, Layers } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  useDepartments, addDepartment, renameDepartment, removeDepartment,
} from "@/lib/departmentsStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AjustesEmpresaDepartamentos() {
  const list = useDepartments();
  const confirm = useConfirm();

  // Alta
  const [draft, setDraft] = useState("");
  const onAdd = () => {
    const t = draft.trim();
    if (!t) return;
    const ok = addDepartment(t);
    if (!ok) {
      toast.error(`"${t}" ya existe`);
      return;
    }
    toast.success(`Departamento "${t}" añadido`);
    setDraft("");
  };

  // Edición inline
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const startEdit = (name: string) => {
    setEditing(name);
    setEditValue(name);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };
  const saveEdit = (oldName: string) => {
    const t = editValue.trim();
    if (!t) return;
    if (t === oldName) {
      cancelEdit();
      return;
    }
    const ok = renameDepartment(oldName, t);
    if (!ok) {
      toast.error(`"${t}" ya existe`);
      return;
    }
    toast.success(`Renombrado a "${t}"`);
    cancelEdit();
  };

  const onRemove = async (name: string) => {
    const ok = await confirm({
      title: "¿Eliminar departamento?",
      description: `Se eliminará "${name}" de la lista de sugerencias. Los miembros que ya lo tenían asignado conservan su valor hasta que los edites manualmente.`,
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    removeDepartment(name);
    toast.success(`"${name}" eliminado`);
  };

  return (
    <SettingsScreen
      title="Departamentos"
      description="Gestiona los departamentos de tu empresa. Se usan como sugerencias al asignar miembros (p. ej. Comercial, Marketing, Operaciones…). El admin puede añadir, renombrar o eliminar los suyos."
    >
      {/* Lista actual */}
      <SettingsCard
        title="Departamentos actuales"
        description={list.length === 0
          ? "Aún no tienes departamentos. Añade el primero abajo."
          : `${list.length} ${list.length === 1 ? "departamento" : "departamentos"} activos.`}
      >
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Layers className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-[12px] text-muted-foreground">Sin departamentos configurados.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {list.map((name) => {
              const isEditing = editing === name;
              return (
                <li
                  key={name}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    isEditing && "bg-muted/30 -mx-3 px-3 rounded-lg",
                  )}
                >
                  <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  </div>

                  {isEditing ? (
                    <>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(name);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-9 text-sm flex-1"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(name)}
                        title="Guardar"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        title="Cancelar"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground flex-1 truncate">{name}</p>
                      <button
                        onClick={() => startEdit(name)}
                        title="Renombrar"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => onRemove(name)}
                        title="Eliminar"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>

      {/* Alta */}
      <SettingsCard
        title="Añadir departamento"
        description="Teclea el nombre y pulsa Enter o 'Añadir'. Se deduplica automáticamente por nombre (case-insensitive)."
      >
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
            placeholder="Ej. Recursos humanos"
            className="flex-1"
          />
          <Button onClick={onAdd} disabled={!draft.trim()} className="rounded-full shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
            Añadir
          </Button>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
