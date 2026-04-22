/**
 * SettingsSearchContext · comparte el query del buscador del topbar
 * con la home (AjustesHome) y la nav lateral (SettingsShell).
 *
 * El SettingsShell es quien posee el state; ambos consumidores lo
 * leen para filtrar y resaltar matches en amarillo (Highlight).
 */

import { createContext, useContext } from "react";

type Ctx = { query: string };

const SettingsSearchContext = createContext<Ctx>({ query: "" });

export const SettingsSearchProvider = SettingsSearchContext.Provider;

export function useSettingsSearch(): string {
  return useContext(SettingsSearchContext).query;
}
