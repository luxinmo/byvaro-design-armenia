/**
 * /ajustes/perfil/contacto — Teléfonos del usuario.
 *
 * CRUD de N teléfonos con tipo (móvil, oficina, casa, otro) + prefijo
 * internacional. Delega en `<PhoneInput>` para el selector de país
 * (dropdown con bandera + búsqueda por ISO / nombre / prefijo).
 *
 * El número se guarda siempre con prefijo: "+34 600 000 000".
 * Uno se marca como `primary` — será el que aparezca en firma de
 * emails, notificaciones SMS y contacto preferido.
 *
 * TODO(backend): GET/PUT /api/me/phones — reemplaza `byvaro.user.phones.v1`.
 */

import { useEffect, useState } from "react";
import { Phone, Plus, Trash2, Star } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserSetting } from "@/lib/userSettings";

const SETTING_KEY = "user.phones";

type PhoneRow = {
  id: string;
  type: "mobile" | "office" | "home" | "other";
  /** Número con prefijo internacional, formato `+34 600 000 000`. */
  number: string;
  primary: boolean;
};

const TYPE_LABELS = {
  mobile: "Móvil",
  office: "Oficina",
  home: "Casa",
  other: "Otro",
} as const;

const DEFAULT_PHONES: PhoneRow[] = [
  { id: "p1", type: "mobile", number: "+34 600 000 000", primary: true },
];

export default function AjustesPerfilContacto() {
  const [persisted, setPersisted] = useUserSetting<PhoneRow[]>(SETTING_KEY, DEFAULT_PHONES);
  const [phones, setPhones] = useState<PhoneRow[]>(persisted);
  const [initial, setInitial] = useState<PhoneRow[]>(persisted);
  const { setDirty } = useDirty();

  /* Sync con DB cuando llega la hidratación. */
  useEffect(() => {
    setPhones(persisted);
    setInitial(persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);

  useEffect(() => {
    setDirty(JSON.stringify(phones) !== JSON.stringify(initial));
  }, [phones, initial, setDirty]);

  const isDirty = JSON.stringify(phones) !== JSON.stringify(initial);

  const add = () =>
    setPhones((p) => [
      ...p,
      {
        id: `p${Date.now()}`,
        type: "mobile",
        number: "",
        primary: p.length === 0,
      },
    ]);
  const remove = (id: string) =>
    setPhones((p) => {
      const next = p.filter((x) => x.id !== id);
      /* Si quitamos el primario, ascender el primero. */
      if (next.length > 0 && !next.some((x) => x.primary)) {
        next[0] = { ...next[0], primary: true };
      }
      return next;
    });
  const update = (id: string, patch: Partial<PhoneRow>) =>
    setPhones((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const setPrimary = (id: string) =>
    setPhones((p) => p.map((x) => ({ ...x, primary: x.id === id })));

  const save = () => {
    setPersisted(phones);
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
            <p className="py-6 text-center text-sm text-muted-foreground italic">
              Sin teléfonos · añade uno
            </p>
          )}
          {phones.map((p) => (
            <div key={p.id} className="py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <select
                value={p.type}
                onChange={(e) => update(p.id, { type: e.target.value as PhoneRow["type"] })}
                className="h-9 px-3 rounded-full border border-border bg-card text-sm outline-none focus:border-primary shrink-0"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <div className="flex-1 min-w-[220px]">
                <PhoneInput
                  value={p.number}
                  onChange={(v) => update(p.id, { number: v })}
                  placeholder="600 000 000"
                />
              </div>
              <button
                type="button"
                onClick={() => setPrimary(p.id)}
                title={p.primary ? "Primario" : "Marcar como primario"}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  p.primary
                    ? "text-warning"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Star className={cn("h-4 w-4", p.primary && "fill-warning")} />
              </button>
              <button
                type="button"
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
