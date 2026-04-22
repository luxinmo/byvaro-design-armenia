/**
 * SettingsTogglesPage · plantilla para páginas que son una lista de
 * toggles ON/OFF (notificaciones, privacidad, mensajería, IA, etc.).
 *
 * Persiste en localStorage con clave `byvaro.settings.{key}.v1`.
 * Marca dirty al cambiar cualquier toggle. Save resetea dirty.
 *
 * Reduce mucho boilerplate: una página típica queda en 30 líneas.
 */

import { useEffect, useMemo, useState } from "react";
import { SettingsScreen, SettingsCard } from "./SettingsScreen";
import { SettingsRowGroup, SettingsToggle } from "./fields";
import { Button } from "@/components/ui/button";
import { useDirty } from "./SettingsDirtyContext";
import { toast } from "sonner";

export type ToggleDef = {
  key: string;
  label: string;
  description?: string;
  defaultValue?: boolean;
};

interface Props {
  storageKey: string;
  title: string;
  description?: string;
  cardTitle?: string;
  cardDescription?: string;
  toggles: ToggleDef[];
}

function loadValues(storageKey: string, toggles: ToggleDef[]): Record<string, boolean> {
  if (typeof window === "undefined") {
    return Object.fromEntries(toggles.map((t) => [t.key, t.defaultValue ?? false]));
  }
  try {
    const raw = window.localStorage.getItem(`byvaro.settings.${storageKey}.v1`);
    const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    return Object.fromEntries(
      toggles.map((t) => [t.key, stored[t.key] ?? t.defaultValue ?? false]),
    );
  } catch {
    return Object.fromEntries(toggles.map((t) => [t.key, t.defaultValue ?? false]));
  }
}

export function SettingsTogglesPage({
  storageKey, title, description, cardTitle, cardDescription, toggles,
}: Props) {
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    loadValues(storageKey, toggles),
  );
  const [initial, setInitial] = useState(values);
  const { setDirty } = useDirty();

  /* setInitial al montar para tener referencia al snapshot inicial. */
  useEffect(() => {
    setInitial(loadValues(storageKey, toggles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = useMemo(
    () => toggles.some((t) => values[t.key] !== initial[t.key]),
    [values, initial, toggles],
  );

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  const save = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `byvaro.settings.${storageKey}.v1`,
        JSON.stringify(values),
      );
    }
    setInitial(values);
    setDirty(false);
    toast.success("Preferencias guardadas");
  };

  return (
    <SettingsScreen
      title={title}
      description={description}
      actions={
        <Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      <SettingsCard title={cardTitle} description={cardDescription}>
        <SettingsRowGroup>
          {toggles.map((t) => (
            <SettingsToggle
              key={t.key}
              label={t.label}
              description={t.description}
              checked={values[t.key] ?? false}
              onCheckedChange={(b) => setValues((prev) => ({ ...prev, [t.key]: b }))}
            />
          ))}
        </SettingsRowGroup>
      </SettingsCard>
    </SettingsScreen>
  );
}
