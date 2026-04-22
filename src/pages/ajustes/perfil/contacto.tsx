/**
 * /ajustes/perfil/contacto — Teléfonos del usuario.
 * CRUD de N teléfonos con tipo y prefijo internacional.
 */

import { useEffect, useState } from "react";
import { Phone, Plus, Trash2, Star } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.user.phones.v1";

type Phone = { id: string; type: "mobile" | "office" | "home" | "other"; number: string; primary: boolean };

const TYPE_LABELS = { mobile: "Móvil", office: "Oficina", home: "Casa", other: "Otro" } as const;

function load(): Phone[] {
  if (typeof window === "undefined") return [{ id: "p1", type: "mobile", number: "+34 600 000 000", primary: true }];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [{ id: "p1", type: "mobile", number: "+34 600 000 000", primary: true }];
  } catch { return []; }
}

export default function AjustesPerfilContacto() {
  const [phones, setPhones] = useState<Phone[]>(() => load());
  const [initial, setInitial] = useState(phones);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(JSON.stringify(phones) !== JSON.stringify(initial)); }, [phones, initial, setDirty]);

  const isDirty = JSON.stringify(phones) !== JSON.stringify(initial);

  const add = () => setPhones((p) => [...p, { id: `p${Date.now()}`, type: "mobile", number: "", primary: p.length === 0 }]);
  const remove = (id: string) => setPhones((p) => p.filter((x) => x.id !== id));
  const update = (id: string, patch: Partial<Phone>) =>
    setPhones((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
  const setPrimary = (id: string) =>
    setPhones((p) => p.map((x) => ({ ...x, primary: x.id === id })));

  const save = () => {
    window.localStorage.setItem(KEY, JSON.stringify(phones));
    setInitial(phones);
    setDirty(false);
    toast.success("Teléfonos guardados");
  };

  return (
    <SettingsScreen
      title="Teléfonos de contacto"
      description="Tus números de teléfono. El primario aparece como contacto preferido en tu firma y para notificaciones SMS."
      actions={
        <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      <SettingsCard
        footer={
          <Button type="button" variant="outline" size="sm" onClick={add} className="rounded-full">
            <Plus className="h-4 w-4" /> Añadir teléfono
          </Button>
        }
      >
        <div className="divide-y divide-border/40 -my-3">
          {phones.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground italic">Sin teléfonos · añade uno</p>
          )}
          {phones.map((p) => (
            <div key={p.id} className="py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <select
                value={p.type}
                onChange={(e) => update(p.id, { type: e.target.value as Phone["type"] })}
                className="h-9 px-3 rounded-full border border-border bg-card text-sm outline-none focus:border-primary shrink-0"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input value={p.number} onChange={(e) => update(p.id, { number: e.target.value })} placeholder="+34 600 000 000" className="flex-1" />
              <button
                onClick={() => setPrimary(p.id)}
                title={p.primary ? "Primario" : "Marcar primario"}
                className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  p.primary ? "text-amber-500" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
              >
                <Star className={cn("h-4 w-4", p.primary && "fill-amber-400")} />
              </button>
              <button
                onClick={() => remove(p.id)}
                className="h-8 w-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
