/**
 * /ajustes/perfil/personal — Información personal del usuario actual.
 *
 * Fuente única: `src/lib/meStorage.ts` → la entrada del `TeamMember`
 * donde `id === currentUser.id`. Cualquier cambio aquí:
 *   · Se ve en el sidebar (useCurrentUser).
 *   · Se ve en `/equipo` (mismo store).
 *   · Se ve en el historial de contactos (autor de eventos).
 *   · Se ve en la firma de emails.
 *
 * Y al revés: si el admin edita mi perfil desde `/equipo` y esta
 * página está abierta, se refresca en caliente (siempre que no esté
 * en estado "dirty" · respetamos lo que el user esté escribiendo).
 *
 * Ver ADR-050 para la unificación.
 */

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Plus, X } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { PhotoCropModal } from "@/components/settings/PhotoCropModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Flag } from "@/components/ui/Flag";
import { JobTitlePicker } from "@/components/team/JobTitlePicker";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useMe, updateMe } from "@/lib/meStorage";
import { uploadUserAvatar } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { UserRefBadge } from "@/components/ui/UserRefBadge";
import { useUserPublicRef, formatUserRef } from "@/lib/userPublicRef";
import { toast } from "sonner";
import { LANGUAGES, findLanguageByCode } from "@/lib/languages";
import {
  parseJobTitle, encodeJobTitle, derivedDepartment,
} from "@/data/jobTitles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEPARTMENT_SUGGESTIONS = [
  "Comercial", "Marketing", "Operaciones", "Administración",
  "Dirección", "Atención al cliente", "Legal",
];

type ProfileForm = {
  fullName: string;
  email: string;
  jobTitleKeys: string[];       // array · editado con JobTitlePicker
  department: string;
  departmentTouched: boolean;
  phone: string;
  languages: string[];          // ISO codes (ES, EN, ...)
  bio: string;
  avatar?: string;
};

function buildForm(
  me: ReturnType<typeof useMe>,
  fallbackName: string,
  fallbackEmail: string,
): ProfileForm {
  return {
    fullName: me?.name ?? fallbackName,
    email: me?.email ?? fallbackEmail,
    jobTitleKeys: parseJobTitle(me?.jobTitle),
    department: me?.department ?? "",
    departmentTouched: false,
    phone: me?.phone ?? "",
    languages: me?.languages ?? [],
    bio: me?.bio ?? "",
    avatar: me?.avatarUrl,
  };
}

export default function AjustesPerfilPersonal() {
  const me = useMe();
  const [profile, setProfile] = useState<ProfileForm>(() =>
    buildForm(me, "", ""),
  );
  const [initial, setInitial] = useState(profile);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const { setDirty } = useDirty();

  /* Resolver el user_id Supabase real para mostrar la public_ref del
   *  user. `me.id` es el id del TeamMember (puede ser UUID o "u1"
   *  legacy) · necesitamos el `auth.uid()` real para indexar el cache
   *  de `user_profiles.public_ref`. */
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase.auth.getUser().then(({ data }) => {
      setSupabaseUserId(data.user?.id ?? null);
    });
  }, []);
  const myPublicRef = useUserPublicRef(supabaseUserId);

  const isDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(initial),
    [profile, initial],
  );

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  /* Sincronía en caliente · cuando el admin edita al usuario desde
   * `/equipo`, esta página se refresca. Solo si no estamos editando. */
  useEffect(() => {
    if (!me) return;
    if (isDirty) return;
    const next = buildForm(me, profile.fullName, profile.email);
    setProfile(next);
    setInitial(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const onChange = (patch: Partial<ProfileForm>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const onJobTitleChange = (next: string[]) => {
    setProfile((p) => ({
      ...p,
      jobTitleKeys: next,
      department: p.departmentTouched ? p.department : derivedDepartment(next) ?? p.department,
    }));
  };

  const toggleLanguage = (code: string) =>
    setProfile((p) => ({
      ...p,
      languages: p.languages.includes(code)
        ? p.languages.filter((x) => x !== code)
        : [...p.languages, code],
    }));

  const save = () => {
    updateMe({
      name: profile.fullName.trim(),
      email: profile.email.trim(),
      jobTitle: encodeJobTitle(profile.jobTitleKeys) || undefined,
      department: profile.department.trim() || undefined,
      phone: profile.phone.trim() || undefined,
      languages: profile.languages.length ? profile.languages : undefined,
      bio: profile.bio.trim() || undefined,
      avatarUrl: profile.avatar,
    });
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
      description="Esta información se muestra a tus compañeros de equipo, aparece en los emails que envías y en tu tarjeta pública de Equipo."
      actions={
        <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      {/* ── Referencia pública del usuario ──
       *  US + 7 dígitos · inmutable · handle externo en URLs y emails. */}
      {myPublicRef && (
        <SettingsCard title="Tu referencia pública">
          <p className="text-xs text-muted-foreground mb-3">
            Tu identificador único en Byvaro. Aparece en URLs internas
            de equipo, emails firmados y resoluciones cross-tenant.
            Es <strong>inmutable</strong> · no se puede modificar.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <UserRefBadge ref={myPublicRef} size="md" />
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/equipo/${myPublicRef}/estadisticas`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Enlace copiado", { description: url });
                } catch {
                  toast.error("No se pudo copiar el enlace");
                }
              }}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border bg-card hover:bg-muted transition-colors text-[11px]"
              title="Copiar enlace a tu ficha pública de equipo"
            >
              <span className="font-mono text-foreground/80 truncate max-w-[260px]">
                /equipo/{formatUserRef(myPublicRef)}
              </span>
            </button>
          </div>
        </SettingsCard>
      )}

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
            <p className="text-xs text-muted-foreground mt-0.5">
              PNG o JPG cuadrada, recortada a círculo. Máximo 4 MB.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setPhotoOpen(true)}>
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

      {/* ── Datos personales ── */}
      <SettingsCard title="Datos personales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Nombre completo" className="sm:col-span-2">
            <Input
              value={profile.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Ej. María González Pérez"
            />
          </SettingsField>
          <SettingsField label="Email">
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => onChange({ email: e.target.value })}
            />
          </SettingsField>
          <SettingsField label="Teléfono">
            <PhoneInput
              value={profile.phone}
              onChange={(v) => onChange({ phone: v })}
              placeholder="600 000 000"
            />
          </SettingsField>
          <SettingsField label="Cargo · máx 2" className="sm:col-span-2">
            <JobTitlePicker
              value={profile.jobTitleKeys}
              onChange={onJobTitleChange}
              max={2}
              placeholder="Selecciona un cargo"
            />
          </SettingsField>
          <SettingsField label="Departamento" className="sm:col-span-2">
            <Popover open={deptPickerOpen} onOpenChange={setDeptPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground hover:border-foreground/30 transition-colors gap-2"
                >
                  <span className={cn("truncate", !profile.department && "text-muted-foreground")}>
                    {profile.department || "Auto según el cargo"}
                  </span>
                  {!profile.departmentTouched && profile.jobTitleKeys.length > 0 && profile.department && (
                    <span className="text-[10px] text-muted-foreground shrink-0">auto</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-1.5" align="start">
                <div className="px-2 pt-1 pb-2">
                  <Input
                    autoFocus
                    value={profile.department}
                    onChange={(e) => onChange({ department: e.target.value, departmentTouched: true })}
                    placeholder="Escribe un departamento…"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {DEPARTMENT_SUGGESTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        onChange({ department: d, departmentTouched: true });
                        setDeptPickerOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                    >
                      <span>{d}</span>
                      {profile.department === d && <Check className="h-3.5 w-3.5 text-foreground" />}
                    </button>
                  ))}
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
          {profile.languages.map((code) => {
            const lang = findLanguageByCode(code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-full bg-muted text-foreground text-xs font-medium"
              >
                <Flag iso={lang?.countryIso} size={14} />
                {code}
                <button
                  type="button"
                  onClick={() => toggleLanguage(code)}
                  className="h-5 w-5 rounded-full hover:bg-background/70 grid place-items-center"
                  aria-label={`Quitar ${code}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <Popover open={langPickerOpen} onOpenChange={setLangPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-full h-8 px-3 text-xs">
                <Plus className="h-3 w-3" /> Añadir idioma
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-1.5" align="start">
              <div className="max-h-64 overflow-y-auto">
                {LANGUAGES.map((l) => {
                  const active = profile.languages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleLanguage(l.code)}
                      className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Flag iso={l.countryIso} size={14} />
                        <span>{l.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 tracking-wider">{l.code}</span>
                      </span>
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

      {/* ── Nota sobre campos solo admin ── */}
      <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed max-w-[620px]">
        Tu rol, permisos, estado y plan de comisiones los gestiona un admin
        desde <strong>Equipo</strong>. Los cambios de cualquiera de los dos
        sitios se sincronizan en tiempo real.
      </p>

      {/* Modal de recorte de foto */}
      <PhotoCropModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onSave={async (dataUrl) => {
          if (!dataUrl) {
            onChange({ avatar: undefined });
            return;
          }
          /* Optimistic local · preview con dataUrl. Después subo a
           *  bucket user-avatars y reemplazo por URL pública. */
          onChange({ avatar: dataUrl });
          if (!isSupabaseConfigured) return;
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const blob = await (await fetch(dataUrl)).blob();
            const publicUrl = await uploadUserAvatar(user.id, blob);
            onChange({ avatar: publicUrl });
          } catch (e) {
            console.warn("[personal:avatar] upload failed:", e);
            toast.error("No se pudo subir el avatar", {
              description: e instanceof Error ? e.message : "Reintenta",
            });
          }
        }}
        currentImage={profile.avatar}
      />
    </SettingsScreen>
  );
}
