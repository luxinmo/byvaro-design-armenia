/**
 * /ajustes/empresa/oficinas — CRUD de oficinas de la organización.
 * Cada oficina con: nombre, ciudad, dirección, manager, teléfono.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2, Building2, Star } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { UserSelect } from "@/components/ui/UserSelect";
import { findTeamMember } from "@/lib/team";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "organization.offices";

type Office = {
  id: string;
  name: string;
  city: string;
  address: string;
  /** Id del miembro del equipo que gestiona la oficina (ver TEAM_MEMBERS).
   *  `null` = sin manager asignado. Se resuelve al nombre vía findTeamMember. */
  managerId: string | null;
  phone: string;
  primary: boolean;
};

const DEFAULT: Office[] = [
  { id: "o1", name: "Marbella HQ", city: "Marbella", address: "Calle Real 25", managerId: "u1", phone: "+34 952 000 000", primary: true },
  { id: "o2", name: "Estepona",    city: "Estepona", address: "Av. Litoral 14", managerId: "u2", phone: "+34 952 111 111", primary: false },
];

function migrateLegacy(parsed: Array<Office & { manager?: string }>): Office[] {
  return parsed.map((o) => {
    if (o.managerId !== undefined) return o as Office;
    const legacy = (o as { manager?: string }).manager;
    const found = legacy ? findTeamMember(legacy) : undefined;
    return { ...o, managerId: found?.id ?? null } as Office;
  });
}

export default function AjustesEmpresaOficinas() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [persisted, setPersisted] = useOrgSetting<Office[]>(SETTING_KEY, DEFAULT);
  const [offices, setOffices] = useState<Office[]>(migrateLegacy(persisted));
  const [initial, setInitial] = useState<Office[]>(migrateLegacy(persisted));
  const { setDirty } = useDirty();
  useEffect(() => {
    const m = migrateLegacy(persisted);
    setOffices(m);
    setInitial(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);

  useEffect(() => { setDirty(JSON.stringify(offices) !== JSON.stringify(initial)); }, [offices, initial, setDirty]);
  const isDirty = JSON.stringify(offices) !== JSON.stringify(initial);

  const save = () => {
    if (!canEdit) return;
    setPersisted(offices);
    setInitial(offices);
    setDirty(false);
    toast.success("Oficinas guardadas");
  };

  const add = () => setOffices((p) => [...p, {
    id: `o${Date.now()}`, name: "Nueva oficina", city: "", address: "",
    managerId: null, phone: "", primary: p.length === 0,
  }]);
  const remove = (id: string) => setOffices((p) => p.filter((x) => x.id !== id));
  const update = (id: string, patch: Partial<Office>) =>
    setOffices((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
  const setPrimary = (id: string) =>
    setOffices((p) => p.map((x) => ({ ...x, primary: x.id === id })));

  return (
    <SettingsScreen
      title="Oficinas"
      description="Sedes físicas de tu empresa. La oficina primaria aparece como dirección por defecto en facturas y firmas."
      actions={<Button onClick={save} disabled={!isDirty || !canEdit} className="rounded-full" size="sm">Guardar cambios</Button>}
    >
      {offices.map((o) => (
        <SettingsCard
          key={o.id}
          title={
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{o.name || "Nueva oficina"}</span>
              {o.primary && <span className="text-[10px] font-semibold text-warning inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning" /> Primaria</span>}
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingsField label="Nombre"><Input value={o.name} onChange={(e) => update(o.id, { name: e.target.value })} disabled={!canEdit} /></SettingsField>
            <SettingsField label="Ciudad"><Input value={o.city} onChange={(e) => update(o.id, { city: e.target.value })} disabled={!canEdit} /></SettingsField>
            <SettingsField label="Dirección" htmlFor={`addr-${o.id}`}>
              <Input id={`addr-${o.id}`} value={o.address} onChange={(e) => update(o.id, { address: e.target.value })} disabled={!canEdit} />
            </SettingsField>
            <SettingsField label="Manager">
              <UserSelect
                value={o.managerId}
                onChange={(id) => update(o.id, { managerId: id })}
                placeholder="Sin asignar"
                onlyActive
              />
            </SettingsField>
            <SettingsField label="Teléfono"><Input value={o.phone} onChange={(e) => update(o.id, { phone: e.target.value })} disabled={!canEdit} /></SettingsField>
          </div>
          {canEdit && (
            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
              <button
                onClick={() => setPrimary(o.id)}
                disabled={o.primary}
                className={cn("inline-flex items-center gap-1.5 text-xs",
                  o.primary ? "text-muted-foreground cursor-default" : "text-muted-foreground hover:text-foreground")}
              >
                <Star className={cn("h-3.5 w-3.5", o.primary && "fill-warning text-warning")} />
                {o.primary ? "Oficina primaria" : "Marcar como primaria"}
              </button>
              <button
                onClick={() => remove(o.id)}
                className="inline-flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 rounded-full px-2 py-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar oficina
              </button>
            </div>
          )}
        </SettingsCard>
      ))}

      {canEdit && (
        <Button variant="outline" onClick={add} className="rounded-full">
          <Plus className="h-4 w-4" />
          Añadir oficina
        </Button>
      )}
    </SettingsScreen>
  );
}
