/**
 * /ajustes/seguridad/actividad — Historial de inicios de sesión.
 *
 * Tabla con: fecha/hora, dispositivo, ubicación, IP, resultado.
 * Filtrable por éxito / fallo. Útil para detectar accesos sospechosos.
 */

import { useMemo, useState } from "react";
import { Check, X, Search } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";

type ActivityEntry = {
  id: string;
  date: string;
  device: string;
  location: string;
  ip: string;
  success: boolean;
  reason?: string;
};

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: "a1", date: "Hoy 09:14", device: "Chrome 120 · macOS", location: "Marbella, ES", ip: "85.222.140.21", success: true },
  { id: "a2", date: "Hoy 08:02", device: "Safari Mobile · iOS", location: "Marbella, ES", ip: "85.222.140.21", success: true },
  { id: "a3", date: "Ayer 22:18", device: "Firefox 124 · Windows", location: "Madrid, ES", ip: "212.105.45.7", success: true },
  { id: "a4", date: "Ayer 14:33", device: "Chrome 119 · macOS", location: "Marbella, ES", ip: "85.222.140.21", success: true },
  { id: "a5", date: "Hace 2 días, 03:12", device: "Chrome 120 · Windows", location: "Bucharest, RO", ip: "188.27.31.5", success: false, reason: "Contraseña incorrecta" },
  { id: "a6", date: "Hace 3 días, 18:41", device: "Edge 122 · Windows", location: "Madrid, ES", ip: "212.105.45.7", success: true },
  { id: "a7", date: "Hace 4 días, 11:09", device: "Safari 17 · macOS", location: "Marbella, ES", ip: "85.222.140.55", success: true },
  { id: "a8", date: "Hace 5 días, 23:01", device: "Chrome 120 · Android", location: "Manila, PH", ip: "112.198.83.4", success: false, reason: "2FA fallido" },
  { id: "a9", date: "Hace 1 semana", device: "Firefox 123 · Linux", location: "Lisboa, PT", ip: "85.244.10.2", success: true },
  { id: "a10", date: "Hace 1 semana", device: "Safari 17 · macOS", location: "Marbella, ES", ip: "85.222.140.21", success: true },
];

export default function AjustesActividad() {
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return MOCK_ACTIVITY.filter((a) => {
      if (filter === "success" && !a.success) return false;
      if (filter === "failed" && a.success) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!`${a.device} ${a.location} ${a.ip} ${a.reason ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filter, query]);

  const failedCount = MOCK_ACTIVITY.filter((a) => !a.success).length;

  return (
    <SettingsScreen
      title="Actividad de inicio de sesión"
      description="Últimos 30 días. Si ves intentos desde lugares o dispositivos que no reconoces, cambia tu contraseña inmediatamente."
    >
      {failedCount > 0 && (
        <SettingsCard>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 grid place-items-center shrink-0">
              <X className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {failedCount} {failedCount === 1 ? "intento fallido" : "intentos fallidos"} en los últimos 30 días
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revisa la lista. Si alguno es sospechoso, activa la verificación en dos pasos y cambia tu contraseña.
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      <SettingsCard
        title="Historial"
        description="Filtra por resultado o busca por ubicación / IP."
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por dispositivo, ubicación o IP…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
          <div className="inline-flex items-center bg-muted/40 border border-border/40 rounded-full p-0.5 text-xs">
            {(["all", "success", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-7 rounded-full transition-colors ${
                  filter === f ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "success" ? "Exitosos" : "Fallidos"}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border/40 -my-3">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground italic">Sin coincidencias</p>
          ) : filtered.map((a) => (
            <div key={a.id} className="py-3 flex items-center gap-3">
              <div className={`h-7 w-7 rounded-full grid place-items-center shrink-0 ${
                a.success ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"
              }`}>
                {a.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 text-sm">
                <span className="text-foreground truncate">{a.device}</span>
                <span className="text-muted-foreground truncate">{a.location} · <span className="font-mono text-xs">{a.ip}</span></span>
                <span className="text-muted-foreground text-xs sm:text-right">{a.date}</span>
              </div>
              {!a.success && a.reason && (
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-destructive shrink-0">
                  {a.reason}
                </span>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
