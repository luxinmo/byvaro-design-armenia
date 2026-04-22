/**
 * /ajustes/promociones/validez — Validez de exclusiva por defecto.
 * Días que dura el lock entre agencia y cliente cuando registra.
 */

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField, SettingsToggle } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.promotions.validity.v1";

type State = {
  defaultDays: number;
  allowExtension: boolean;
  extensionDays: number;
  notifyBeforeExpiry: number;
};

const DEFAULT: State = { defaultDays: 30, allowExtension: true, extensionDays: 15, notifyBeforeExpiry: 7 };
const PRESETS = [15, 30, 45, 60, 90];

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try { return { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

export default function AjustesPromocionesValidez() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [state, setState] = useState<State>(() => load());
  const [initial, setInitial] = useState(state);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(JSON.stringify(state) !== JSON.stringify(initial)); }, [state, initial, setDirty]);
  const isDirty = JSON.stringify(state) !== JSON.stringify(initial);

  const save = () => {
    if (!canEdit) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
    setInitial(state);
    setDirty(false);
    toast.success("Validez por defecto guardada");
  };

  return (
    <SettingsScreen
      title="Validez de exclusiva por defecto"
      description="Cuánto tiempo dura la exclusiva entre una agencia colaboradora y un cliente registrado. Se aplica a promociones nuevas — las existentes mantienen su valor."
      actions={canEdit && <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">Guardar</Button>}
    >
      <SettingsCard title="Días por defecto" description="Tras registrar a un cliente, otra agencia no podrá registrarlo en la misma promoción durante este tiempo.">
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((d) => (
              <button key={d} onClick={() => setState((s) => ({ ...s, defaultDays: d }))} disabled={!canEdit}
                className={cn("h-9 px-4 rounded-full text-sm font-medium border transition-colors",
                  state.defaultDays === d ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:text-foreground")}>
                {d} días
              </button>
            ))}
          </div>
          <SettingsField label="Personalizado">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={365} value={state.defaultDays} disabled={!canEdit}
                onChange={(e) => setState((s) => ({ ...s, defaultDays: Math.max(1, Math.min(365, Number(e.target.value))) }))}
                className="w-32 tnum" />
              <span className="text-sm text-muted-foreground">días</span>
            </div>
          </SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard title="Extensión de exclusiva">
        <SettingsToggle label="Permitir extender exclusiva" description="La agencia puede solicitar prórroga si el cliente sigue interesado."
          checked={state.allowExtension} onCheckedChange={(b) => setState((s) => ({ ...s, allowExtension: b }))} disabled={!canEdit} />
        {state.allowExtension && (
          <SettingsField label="Días de extensión" className="mt-4">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={90} value={state.extensionDays} disabled={!canEdit}
                onChange={(e) => setState((s) => ({ ...s, extensionDays: Math.max(1, Math.min(90, Number(e.target.value))) }))}
                className="w-32 tnum" />
              <span className="text-sm text-muted-foreground">días extra</span>
            </div>
          </SettingsField>
        )}
      </SettingsCard>

      <SettingsCard title="Aviso de vencimiento">
        <SettingsField label="Avisar al promotor y agencia con">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input type="number" min={1} max={30} value={state.notifyBeforeExpiry} disabled={!canEdit}
              onChange={(e) => setState((s) => ({ ...s, notifyBeforeExpiry: Math.max(1, Math.min(30, Number(e.target.value))) }))}
              className="w-32 tnum" />
            <span className="text-sm text-muted-foreground">días de antelación</span>
          </div>
        </SettingsField>
      </SettingsCard>
    </SettingsScreen>
  );
}
