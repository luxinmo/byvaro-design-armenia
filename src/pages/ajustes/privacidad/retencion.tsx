/**
 * /ajustes/privacidad/retencion — Retención de datos.
 * Cuánto tiempo guardamos los registros antes de archivarlos / borrarlos.
 */

import { useEffect, useState } from "react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "privacy.retention";

const OPTIONS = [
  { v: "30", l: "30 días", desc: "Mínimo legal — solo para entidades muy reguladas." },
  { v: "90", l: "90 días", desc: "Recomendado para leads sin actividad." },
  { v: "365", l: "1 año", desc: "Estándar para clientes activos." },
  { v: "1825", l: "5 años", desc: "Por defecto — cumple AEAT para facturación." },
  { v: "forever", l: "Sin límite", desc: "Nunca borrar (ojo con GDPR)." },
];

type State = { records: string; emails: string; activityLogs: string };
const DEFAULT: State = { records: "1825", emails: "365", activityLogs: "90" };

function RetentionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-xl border transition-colors",
            value === o.v ? "border-primary bg-primary/5" : "border-border/40 hover:border-foreground/20",
          )}
        >
          <p className="text-sm font-medium text-foreground">{o.l}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

export default function AjustesPrivacidadRetencion() {
  const [persisted, setPersisted] = useOrgSetting<State>(SETTING_KEY, DEFAULT);
  const [state, setState] = useState<State>(persisted);
  const [initial, setInitial] = useState<State>(persisted);
  const { setDirty } = useDirty();
  useEffect(() => {
    setState(persisted);
    setInitial(persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);
  useEffect(() => { setDirty(JSON.stringify(state) !== JSON.stringify(initial)); }, [state, initial, setDirty]);
  const isDirty = JSON.stringify(state) !== JSON.stringify(initial);

  const save = () => {
    setPersisted(state);
    setInitial(state);
    setDirty(false);
    toast.success("Retención de datos guardada");
  };

  return (
    <SettingsScreen
      title="Retención de datos"
      description="Cuánto tiempo guardamos cada tipo de dato antes de archivarlo o eliminarlo permanentemente."
      actions={<Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">Guardar cambios</Button>}
    >
      <SettingsCard title="Registros de visitas y leads" description="Aplica al módulo Registros (formularios, visitas, ofertas).">
        <RetentionPicker value={state.records} onChange={(v) => setState((s) => ({ ...s, records: v }))} />
      </SettingsCard>
      <SettingsCard title="Emails enviados y recibidos">
        <RetentionPicker value={state.emails} onChange={(v) => setState((s) => ({ ...s, emails: v }))} />
      </SettingsCard>
      <SettingsCard title="Logs de actividad" description="Quién ha hecho qué dentro de la app.">
        <RetentionPicker value={state.activityLogs} onChange={(v) => setState((s) => ({ ...s, activityLogs: v }))} />
      </SettingsCard>
    </SettingsScreen>
  );
}
