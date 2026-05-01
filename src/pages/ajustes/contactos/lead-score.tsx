/**
 * /ajustes/contactos/lead-score — Fórmula de lead scoring 0-100.
 * Sliders para pesos por dimensión + threshold de "lead caliente".
 */

import { useEffect, useState } from "react";
import { Flame, Thermometer } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "contacts.leadScore";

type State = {
  weightInteraction: number;
  weightBudget: number;
  weightUrgency: number;
  weightOpportunity: number;
  hotThreshold: number;
};

const DEFAULT: State = {
  weightInteraction: 35, weightBudget: 25, weightUrgency: 20, weightOpportunity: 20, hotThreshold: 75,
};

function Slider({ label, value, onChange, color }: { label: string; value: number; onChange: (n: number) => void; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-sm font-semibold tnum text-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min="0" max="100" step="5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full", color)}
      />
    </div>
  );
}

export default function AjustesContactosLeadScore() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
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

  const total = state.weightInteraction + state.weightBudget + state.weightUrgency + state.weightOpportunity;
  const valid = total === 100;

  const save = () => {
    if (!valid) { toast.error("Los pesos deben sumar exactamente 100"); return; }
    if (!canEdit) return;
    setPersisted(state);
    setInitial(state);
    setDirty(false);
    toast.success("Fórmula de lead score guardada");
  };

  return (
    <SettingsScreen
      title="Fórmula de lead score"
      description="Cómo se calcula la puntuación 0-100 de cada contacto. Los pesos deben sumar 100%. El score se actualiza automáticamente cada vez que el contacto interactúa."
      actions={<Button onClick={save} disabled={!isDirty || !valid || !canEdit} className="rounded-full" size="sm">Guardar fórmula</Button>}
    >
      <SettingsCard title="Pesos por dimensión" description="Cuánto pondera cada factor en el cálculo final.">
        <div className="space-y-5">
          <Slider
            label="Interacción"
            value={state.weightInteraction}
            onChange={(v) => setState((s) => ({ ...s, weightInteraction: v }))}
            color="accent-primary"
          />
          <Slider
            label="Presupuesto / capacidad económica"
            value={state.weightBudget}
            onChange={(v) => setState((s) => ({ ...s, weightBudget: v }))}
            color="accent-success"
          />
          <Slider
            label="Urgencia"
            value={state.weightUrgency}
            onChange={(v) => setState((s) => ({ ...s, weightUrgency: v }))}
            color="accent-warning"
          />
          <Slider
            label="Oportunidad activa"
            value={state.weightOpportunity}
            onChange={(v) => setState((s) => ({ ...s, weightOpportunity: v }))}
            color="accent-violet-500"
          />
        </div>
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className={cn("text-lg font-bold tabular-nums",
            valid ? "text-success" : "text-destructive")}>
            {total}% {valid ? "✓" : `· ${total < 100 ? "faltan" : "sobran"} ${Math.abs(total - 100)}%`}
          </span>
        </div>
      </SettingsCard>

      <SettingsCard title="Umbral de lead caliente" description="A partir de qué score se marca como 'hot' con icono fuego.">
        <SettingsField label="Score mínimo (0-100)">
          <div className="flex items-center gap-3">
            <Flame className="h-4 w-4 text-warning" />
            <Input
              type="number" min={0} max={100}
              value={state.hotThreshold}
              onChange={(e) => setState((s) => ({ ...s, hotThreshold: Math.max(0, Math.min(100, Number(e.target.value))) }))}
              className="w-32 tnum"
            />
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Recomendado: 70-80</span>
          </div>
        </SettingsField>
      </SettingsCard>
    </SettingsScreen>
  );
}
