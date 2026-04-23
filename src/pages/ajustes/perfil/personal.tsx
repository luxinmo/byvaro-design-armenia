/**
 * /ajustes/perfil/personal — Información personal del usuario actual.
 *
 * Persiste en `byvaro.user.profile.v1` (localStorage) vía
 * `src/lib/profileStorage.ts`. Conectado a `useCurrentUser()` — cualquier
 * cambio aquí se refleja en sidebar, emails, historial y cualquier otro
 * consumer del hook (ver ADR-047).
 *
 * Campos:
 *   - Avatar (PhotoCropModal con recorte circular + zoom)
 *   - Nombre completo · único campo (CLAUDE.md)
 *   - Email
 *   - Cargo + Departamento (fila dos columnas)
 *   - Idiomas (popover multiselect · clave para asignar leads por idioma)
 *   - Bio (280 chars)
 */

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Plus, X } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { PhotoCropModal } from "@/components/settings/PhotoCropModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useCurrentUser } from "@/lib/currentUser";
import { getStoredProfile, saveStoredProfile } from "@/lib/profileStorage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* Idiomas del sector · incluye los que más compran en Costa del Sol / Levante. */
const LANGUAGE_OPTIONS = [
  "Español", "English", "Français", "Deutsch", "Italiano", "Português",
  "Nederlands", "Polski", "Русский", "Svenska", "Norsk", "Dansk",
  "Suomi", "العربية", "中文", "日本語",
];

/* Catálogo abierto · el input acepta cualquier valor, pero sugerimos estos. */
const DEPARTMENT_SUGGESTIONS = [
  "Comercial", "Marketing", "Operaciones", "Administración",
  "Dirección", "Atención al cliente", "Legal",
];

type Profile = {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  languages: string[];
  bio: string;
  avatar?: string;
};

function loadProfile(defaults: Profile): Profile {
  const stored = getStoredProfile();
  return {
    ...defaults,
    ...(stored ?? {}),
    /* El stored puede venir de la versión vieja sin languages/department. */
    languages: stored?.languages ?? defaults.languages,
    department: stored?.department ?? defaults.department,
  };
}

export default function AjustesPerfilPersonal() {
  const user = useCurrentUser();
  const defaults: Profile = {
    fullName: user.name,
    email: user.email,
    jobTitle: "Promotor inmobiliario",
    department: "",
    languages: [],
    bio: "",
  };
  const [profile, setProfile] = useState<Profile>(() => loadProfile(defaults));
  const [initial, setInitial] = useState(profile);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const { setDirty } = useDirty();

  const isDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(initial),
    [profile, initial],
  );

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  const onChange = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));

  const toggleLanguage = (l: string) =>
    setProfile((p) => ({
      ...p,
      languages: p.languages.includes(l)
        ? p.languages.filter((x) => x !== l)
        : [...p.languages, l],
    }));

  const save = () => {
    saveStoredProfile(profile);
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
      {/* ── Foto de perfil ── */}
      <SettingsCard title="Foto de perfil">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className={cn(
              "group relative h-20 w-20 rounded-full shrink-0 overflow-hidden transition-transform hover:-translate-y-0.5",
              profile.avatar
                ? "shadow-soft"
                : "bg-primary/15 text-primary grid place-items-center font-semibold text-xl shadow-soft",
            )}
            aria-label="Cambiar foto de perfil"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
            <span className="absolute inset-0 bg-foreground/50 text-background grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5" />
            </span>
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Tu avatar</p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG o JPG cuadrada, recortada a círculo. Máximo 4 MB.</p>
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPhotoOpen(true)}
              >
                <Camera className="h-3.5 w-3.5" />
                {profile.avatar ? "Cambiar foto" : "Subir foto"}
              </Button>
              {profile.avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onChange({ avatar: undefined })}
                >
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ── Identidad ── */}
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
            <Input
              value={profile.jobTitle}
              onChange={(e) => onChange({ jobTitle: e.target.value })}
              placeholder="Ej. Director comercial"
            />
          </SettingsField>
          <SettingsField label="Departamento" className="sm:col-span-2">
            <Popover open={deptPickerOpen} onOpenChange={setDeptPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground hover:border-foreground/30 transition-colors"
                >
                  <span className={cn("truncate", !profile.department && "text-muted-foreground")}>
                    {profile.department || "Selecciona o escribe un departamento"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-1.5" align="start">
                <div className="px-2 pt-1 pb-2">
                  <Input
                    autoFocus
                    value={profile.department}
                    onChange={(e) => onChange({ department: e.target.value })}
                    placeholder="Escribe un departamento…"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {DEPARTMENT_SUGGESTIONS.map((d) => {
                    const active = profile.department === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          onChange({ department: d });
                          setDeptPickerOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                      >
                        <span>{d}</span>
                        {active && <Check className="h-3.5 w-3.5 text-foreground" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </SettingsField>
        </div>
      </SettingsCard>

      {/* ── Idiomas ── */}
      <SettingsCard
        title="Idiomas que hablas"
        description="Se usa para asignarte clientes que prefieren comunicar en tu idioma."
      >
        <div className="flex flex-wrap items-center gap-2">
          {profile.languages.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-muted text-foreground text-xs font-medium"
            >
              {l}
              <button
                type="button"
                onClick={() => toggleLanguage(l)}
                className="h-5 w-5 rounded-full hover:bg-background/70 grid place-items-center"
                aria-label={`Quitar ${l}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Popover open={langPickerOpen} onOpenChange={setLangPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-full h-8 px-3 text-xs">
                <Plus className="h-3 w-3" /> Añadir idioma
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" align="start">
              <div className="max-h-64 overflow-y-auto">
                {LANGUAGE_OPTIONS.map((l) => {
                  const active = profile.languages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleLanguage(l)}
                      className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                    >
                      <span>{l}</span>
                      {active && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </SettingsCard>

      {/* ── Bio ── */}
      <SettingsCard title="Bio">
        <SettingsField
          label="Descripción corta"
          description="Aparece en tu firma de email y en tu perfil interno."
        >
          <textarea
            value={profile.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            placeholder="Cuéntanos algo sobre ti…"
            rows={3}
            maxLength={280}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
          />
          <p className="text-[10.5px] text-muted-foreground text-right mt-1 tnum">
            {profile.bio.length}/280
          </p>
        </SettingsField>
      </SettingsCard>

      {/* Modal de recorte de foto */}
      <PhotoCropModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onSave={(url) => onChange({ avatar: url || undefined })}
        currentImage={profile.avatar}
      />
    </SettingsScreen>
  );
}
