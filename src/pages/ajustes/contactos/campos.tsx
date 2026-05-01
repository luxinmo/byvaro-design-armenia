/**
 * /ajustes/contactos/campos — Campos personalizados para contactos.
 * Permite definir campos extra (texto, número, fecha, select) por organización.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "contacts.customFields";

type FieldType = "text" | "number" | "date" | "select" | "boolean";
type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

const TYPES: { v: FieldType; l: string }[] = [
  { v: "text", l: "Texto" }, { v: "number", l: "Número" },
  { v: "date", l: "Fecha" }, { v: "select", l: "Selección" }, { v: "boolean", l: "Sí / No" },
];

const DEFAULT: Field[] = [
  { id: "f1", label: "Presupuesto máximo", type: "number", required: false },
  { id: "f2", label: "Zonas de interés", type: "text", required: false },
  { id: "f3", label: "Origen del lead", type: "select", required: false, options: ["Web", "Recomendación", "Portal", "Evento"] },
];

export default function AjustesContactosCampos() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [persisted, setPersisted] = useOrgSetting<Field[]>(SETTING_KEY, DEFAULT);
  const [fields, setFields] = useState<Field[]>(persisted);
  const [initial, setInitial] = useState<Field[]>(persisted);
  const { setDirty } = useDirty();
  const confirm = useConfirm();

  useEffect(() => {
    setFields(persisted);
    setInitial(persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);

  useEffect(() => { setDirty(JSON.stringify(fields) !== JSON.stringify(initial)); }, [fields, initial, setDirty]);
  const isDirty = JSON.stringify(fields) !== JSON.stringify(initial);

  const addField = () => setFields((arr) => [...arr, {
    id: `f${Date.now()}`, label: "Nuevo campo", type: "text", required: false,
  }]);

  const removeField = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar campo",
      description: "Los valores guardados en contactos para este campo se perderán.",
      confirmLabel: "Eliminar", variant: "destructive",
    });
    if (!ok) return;
    setFields((arr) => arr.filter((f) => f.id !== id));
  };

  const update = (id: string, patch: Partial<Field>) =>
    setFields((arr) => arr.map((f) => f.id === id ? { ...f, ...patch } : f));

  const save = () => {
    if (!canEdit) return;
    setPersisted(fields);
    setInitial(fields);
    setDirty(false);
    toast.success("Campos personalizados guardados");
  };

  return (
    <SettingsScreen
      title="Campos personalizados"
      description="Añade campos extra a la ficha de cualquier contacto. Aparecen en la sección 'Datos adicionales' al editar un contacto."
      actions={canEdit && (
        <div className="flex gap-2">
          <Button onClick={addField} variant="outline" className="rounded-full" size="sm"><Plus className="h-4 w-4" /> Añadir campo</Button>
          <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">Guardar</Button>
        </div>
      )}
    >
      <SettingsCard title={`${fields.length} campos`}>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin campos personalizados todavía.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.id} className="border border-border/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <Input
                    value={f.label}
                    onChange={(e) => update(f.id, { label: e.target.value })}
                    disabled={!canEdit}
                    className="flex-1"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => update(f.id, { type: e.target.value as FieldType })}
                    disabled={!canEdit}
                    className="h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
                  >
                    {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  {canEdit && (
                    <Button onClick={() => removeField(f.id)} variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {f.type === "select" && (
                  <SettingsField label="Opciones (una por línea)">
                    <textarea
                      value={(f.options ?? []).join("\n")}
                      onChange={(e) => update(f.id, { options: e.target.value.split("\n").filter(Boolean) })}
                      disabled={!canEdit}
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary resize-none"
                    />
                  </SettingsField>
                )}

                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={f.required} onChange={(e) => update(f.id, { required: e.target.checked })} disabled={!canEdit} />
                  Obligatorio al crear contacto
                </label>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </SettingsScreen>
  );
}
