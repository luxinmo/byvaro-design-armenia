/**
 * /ajustes/perfil/personal — Información personal del usuario actual.
 * Persiste en localStorage byvaro.user.profile.v1
 */

import { useEffect, useState } from "react";
import { Camera, User } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";

const KEY = "byvaro.user.profile.v1";

type Profile = {
  /** Nombre completo (en todo el sistema usamos un único campo). */
  fullName: string;
  email: string;
  jobTitle: string;
  bio: string;
  avatar?: string;
};

function loadProfile(defaults: Profile): Profile {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    /* Migración silenciosa de schemas anteriores que tenían
     * { firstName, lastName }. Se concatenan al fullName y se
     * descartan los campos viejos. */
    if (raw && (raw.firstName || raw.lastName) && !raw.fullName) {
      raw.fullName = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim();
      delete raw.firstName;
      delete raw.lastName;
    }
    return { ...defaults, ...raw };
  } catch { return defaults; }
}

export default function AjustesPerfilPersonal() {
  const user = useCurrentUser();
  const defaults: Profile = {
    fullName: user.name,
    email: user.email,
    jobTitle: "Promotor inmobiliario",
    bio: "",
  };
  const [profile, setProfile] = useState<Profile>(() => loadProfile(defaults));
  const [initial, setInitial] = useState(profile);
  const { setDirty } = useDirty();

  useEffect(() => {
    const dirty = JSON.stringify(profile) !== JSON.stringify(initial);
    setDirty(dirty);
  }, [profile, initial, setDirty]);

  const onChange = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));

  const save = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(profile));
    setInitial(profile);
    setDirty(false);
    toast.success("Perfil guardado");
  };

  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  const isDirty = JSON.stringify(profile) !== JSON.stringify(initial);

  return (
    <SettingsScreen
      title="Información personal"
      description="Esta información se muestra a tus compañeros de equipo y aparece en los emails que envías."
      actions={
        <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      <SettingsCard title="Foto de perfil">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-xl shrink-0">
            {initials}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Tu avatar</p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG o JPG, mínimo 200×200 px</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.info("Sube de archivo — próximamente con backend")}>
                <Camera className="h-3.5 w-3.5" />
                Cambiar foto
              </Button>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Datos personales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Nombre completo" className="sm:col-span-2">
            <Input
              value={profile.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Ej. María González Pérez"
            />
          </SettingsField>
          <SettingsField label="Email" htmlFor="email">
            <Input id="email" type="email" value={profile.email} onChange={(e) => onChange({ email: e.target.value })} />
          </SettingsField>
          <SettingsField label="Cargo">
            <Input value={profile.jobTitle} onChange={(e) => onChange({ jobTitle: e.target.value })} placeholder="Ej. Director comercial" />
          </SettingsField>
        </div>

        <div className="mt-4">
          <SettingsField label="Bio" description="Una descripción breve para tu firma de email y perfil interno.">
            <textarea
              value={profile.bio}
              onChange={(e) => onChange({ bio: e.target.value })}
              placeholder="Cuéntanos algo sobre ti…"
              rows={3}
              maxLength={280}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
            />
            <p className="text-[10.5px] text-muted-foreground text-right mt-1">{profile.bio.length}/280</p>
          </SettingsField>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
