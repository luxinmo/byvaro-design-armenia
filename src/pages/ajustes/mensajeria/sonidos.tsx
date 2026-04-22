/**
 * /ajustes/mensajeria/sonidos — Alertas sonoras del navegador.
 */

import { useEffect, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsRowGroup, SettingsToggle } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.messaging.sounds.v1";

const SOUNDS = [
  { id: "subtle", name: "Sutil", description: "Suave, sin interrumpir." },
  { id: "modern", name: "Moderno", description: "Tipo iOS." },
  { id: "classic", name: "Clásico", description: "Notificación tradicional." },
  { id: "ping", name: "Ping", description: "Corto y claro." },
];

type State = {
  enabled: boolean;
  sound: string;
  volume: number;
  silentInMeetings: boolean;
  newMessage: boolean;
  newMention: boolean;
  newRecord: boolean;
};

const DEFAULT: State = {
  enabled: true, sound: "subtle", volume: 60,
  silentInMeetings: true, newMessage: true, newMention: true, newRecord: false,
};

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try { return { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

function playSound() {
  /* Generate a small beep with WebAudio — no external assets needed */
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {/* ignored */}
}

export default function AjustesMensajeriaSonidos() {
  const [state, setState] = useState<State>(() => load());
  const [initial, setInitial] = useState(state);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(JSON.stringify(state) !== JSON.stringify(initial)); }, [state, initial, setDirty]);
  const isDirty = JSON.stringify(state) !== JSON.stringify(initial);

  const save = () => {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    setInitial(state);
    setDirty(false);
    toast.success("Preferencias de sonido guardadas");
  };

  const set = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  return (
    <SettingsScreen
      title="Alertas sonoras"
      description="Sonidos para mensajes, menciones y nuevos registros. Útiles si trabajas con la app de fondo."
      actions={<Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">Guardar cambios</Button>}
    >
      <SettingsCard>
        <SettingsToggle
          label="Activar alertas sonoras"
          description="Necesitas tener el navegador con audio permitido."
          checked={state.enabled}
          onCheckedChange={(b) => set({ enabled: b })}
        />
      </SettingsCard>

      {state.enabled && (
        <>
          <SettingsCard title="Tono" description="Selecciona el tono que se reproducirá. Pulsa play para escuchar.">
            <div className="space-y-2">
              {SOUNDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => set({ sound: s.id })}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                    state.sound === s.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-foreground/20",
                  )}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); playSound(); }}
                    className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Volumen">
            <div className="flex items-center gap-3">
              <VolumeX className="h-4 w-4 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={state.volume}
                onChange={(e) => set({ volume: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs tnum text-muted-foreground w-10 text-right">{state.volume}%</span>
            </div>
          </SettingsCard>

          <SettingsCard title="Cuándo sonar">
            <SettingsRowGroup>
              <SettingsToggle label="Mensaje nuevo en email" checked={state.newMessage} onCheckedChange={(b) => set({ newMessage: b })} />
              <SettingsToggle label="Mención en comentario interno" checked={state.newMention} onCheckedChange={(b) => set({ newMention: b })} />
              <SettingsToggle label="Nuevo registro entrante" checked={state.newRecord} onCheckedChange={(b) => set({ newRecord: b })} />
              <SettingsToggle label="Silenciar durante reuniones (Calendar)" description="Detecta si tienes un evento en curso." checked={state.silentInMeetings} onCheckedChange={(b) => set({ silentInMeetings: b })} />
            </SettingsRowGroup>
          </SettingsCard>
        </>
      )}
    </SettingsScreen>
  );
}
