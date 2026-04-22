/**
 * SettingsDirtyContext · indica si hay cambios sin guardar en la
 * sub-página actual de Ajustes.
 *
 * Las sub-páginas llaman a `useDirty().setDirty(true)` cuando el
 * usuario modifica un campo, y `setDirty(false)` cuando guardan.
 *
 * El SettingsShell consulta el flag antes de navegar (back, close,
 * cualquier link del nav) — si dirty, abre un ConfirmDialog
 * "¿Descartar los cambios sin guardar?" antes de salir.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = {
  dirty: boolean;
  setDirty: (b: boolean) => void;
};

const SettingsDirtyContext = createContext<Ctx>({
  dirty: false,
  setDirty: () => {},
});

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  return (
    <SettingsDirtyContext.Provider value={{ dirty, setDirty }}>
      {children}
    </SettingsDirtyContext.Provider>
  );
}

/** Hook para sub-páginas: marcar dirty / clean y leer el flag actual. */
export function useDirty(): Ctx {
  return useContext(SettingsDirtyContext);
}

/** Hook interno usado por el shell — devuelve el value tal cual. */
export function useSettingsDirtyValue(): Ctx {
  return useContext(SettingsDirtyContext);
}
