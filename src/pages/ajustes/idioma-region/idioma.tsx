/**
 * /ajustes/idioma-region/idioma — Idioma de la interfaz.
 *
 * ──────────────────────────────────────────────────────────────────
 * ESTADO Y BACKEND
 * ──────────────────────────────────────────────────────────────────
 *
 * Frontend (LISTO):
 *  - Lista curada de 20+ idiomas internacionales con bandera, nombre
 *    nativo y locale BCP 47.
 *  - Buscador (case-insensitive) por nombre nativo, español o código.
 *  - Persistencia local en `byvaro.userLocale.v1`.
 *  - Banner honesto de estado: la preferencia se guarda pero la
 *    interfaz no se traduce todavía (no hay i18n cableado).
 *
 * NO HECHO en cliente (i18n global, requiere proyecto aparte):
 *  - Cablear `react-i18next` (o lingui / formatjs) y envolver TODOS
 *    los strings de la app en `t("...")` + archivos `es.json`,
 *    `en.json`, `fr.json`, etc. Tarea grande, ~600 strings repartidos
 *    por la app. Es trabajo cliente puro, no backend.
 *  - Detección automática del idioma del navegador con fallback.
 *  - Soporte RTL para árabe / hebreo: añadir `dir="rtl"` al <html>
 *    cuando la locale sea ar-SA o he-IL, ajustar márgenes (Tailwind
 *    soporta `rtl:` modifiers). Hoy se elegiría el idioma pero el
 *    layout seguiría LTR.
 *
 * TODO(backend) — cuando exista API:
 *  - PATCH /api/me { locale: "es-ES" } — sync entre dispositivos.
 *    Hoy es per-navegador.
 *  - Emails transaccionales en el idioma del destinatario (recordatorios
 *    de visita, resumen semanal, código de cambio de contraseña).
 *    El backend tiene que conocer la preferencia para renderizar la
 *    plantilla correcta antes de enviarla.
 *  - Documentos PDF generados (contratos, fichas de venta, recibos)
 *    en el idioma del usuario o del cliente final.
 */

import { useMemo, useState } from "react";
import { Check, Search, Info } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KEY = "byvaro.userLocale.v1";

type Language = {
  code: string;       // BCP 47
  flag: string;       // emoji bandera
  label: string;      // nombre en español
  native: string;     // nombre en su propio idioma
  rtl?: boolean;
};

/** 20+ idiomas relevantes para el mercado Byvaro (Costa del Sol /
 *  Costa Blanca + clientes internacionales) ordenados por tracción
 *  esperada. */
const LANGUAGES: Language[] = [
  { code: "es-ES", flag: "🇪🇸", label: "Español",          native: "Español (España)" },
  { code: "en-US", flag: "🇺🇸", label: "English (US)",      native: "English (United States)" },
  { code: "en-GB", flag: "🇬🇧", label: "English (UK)",      native: "English (United Kingdom)" },
  { code: "fr-FR", flag: "🇫🇷", label: "Francés",           native: "Français (France)" },
  { code: "de-DE", flag: "🇩🇪", label: "Alemán",            native: "Deutsch (Deutschland)" },
  { code: "it-IT", flag: "🇮🇹", label: "Italiano",          native: "Italiano (Italia)" },
  { code: "pt-PT", flag: "🇵🇹", label: "Portugués",         native: "Português (Portugal)" },
  { code: "pt-BR", flag: "🇧🇷", label: "Portugués (Brasil)",native: "Português (Brasil)" },
  { code: "nl-NL", flag: "🇳🇱", label: "Neerlandés",        native: "Nederlands" },
  { code: "sv-SE", flag: "🇸🇪", label: "Sueco",             native: "Svenska" },
  { code: "no-NO", flag: "🇳🇴", label: "Noruego",           native: "Norsk" },
  { code: "da-DK", flag: "🇩🇰", label: "Danés",             native: "Dansk" },
  { code: "fi-FI", flag: "🇫🇮", label: "Finés",             native: "Suomi" },
  { code: "pl-PL", flag: "🇵🇱", label: "Polaco",            native: "Polski" },
  { code: "ro-RO", flag: "🇷🇴", label: "Rumano",            native: "Română" },
  { code: "cs-CZ", flag: "🇨🇿", label: "Checo",             native: "Čeština" },
  { code: "hu-HU", flag: "🇭🇺", label: "Húngaro",           native: "Magyar" },
  { code: "ru-RU", flag: "🇷🇺", label: "Ruso",              native: "Русский" },
  { code: "uk-UA", flag: "🇺🇦", label: "Ucraniano",         native: "Українська" },
  { code: "tr-TR", flag: "🇹🇷", label: "Turco",             native: "Türkçe" },
  { code: "hy-AM", flag: "🇦🇲", label: "Armenio",           native: "Հայերեն" },
  { code: "ka-GE", flag: "🇬🇪", label: "Georgiano",         native: "ქართული" },
  { code: "ar-SA", flag: "🇸🇦", label: "Árabe",             native: "العربية", rtl: true },
  { code: "he-IL", flag: "🇮🇱", label: "Hebreo",            native: "עברית", rtl: true },
  { code: "zh-CN", flag: "🇨🇳", label: "Chino simplificado",native: "简体中文" },
  { code: "ja-JP", flag: "🇯🇵", label: "Japonés",           native: "日本語" },
  { code: "ko-KR", flag: "🇰🇷", label: "Coreano",           native: "한국어" },
];

function loadLocale(): string {
  if (typeof window === "undefined") return "es-ES";
  return window.localStorage.getItem(KEY) ?? "es-ES";
}

export default function AjustesIdioma() {
  const [selected, setSelected] = useState(() => loadLocale());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  const selectedLang = LANGUAGES.find((l) => l.code === selected);

  const save = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, selected);
    }
    /* TODO(backend): PATCH /api/me { locale: selected } */
    toast.success(`Idioma guardado: ${selectedLang?.label ?? selected}`, {
      description: "Se aplicará cuando esté disponible la traducción de la app.",
    });
  };

  return (
    <SettingsScreen
      title="Idioma"
      description="El idioma elegido se usará para la interfaz, los emails de notificación y los documentos generados desde Byvaro."
      actions={
        <Button onClick={save} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      {/* ══════ Aviso honesto ══════ */}
      <SettingsCard>
        <div className="flex items-start gap-3 text-[13px] text-muted-foreground">
          <Info className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="text-foreground font-semibold mb-1">Tu preferencia se guarda</p>
            <p>
              La interfaz aún no está traducida — Byvaro está en español por ahora. Cuando integremos las traducciones del resto de idiomas (inglés, francés, ruso, armenio…), la app se mostrará automáticamente en el idioma que elijas aquí. Mientras tanto, tu elección se respeta para emails y documentos cuando los conectemos.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* ══════ Selector ══════ */}
      <SettingsCard
        title="Selecciona tu idioma"
        description="Tu elección actual se marca con un check. Puedes buscar por nombre o código (es, en, ru, hy…)."
      >
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar idioma…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Sin coincidencias para "{query}"
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto -mx-2 px-2">
            {filtered.map((lang) => {
              const active = selected === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelected(lang.code)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-foreground/20 hover:bg-muted/40",
                  )}
                >
                  <span className="text-2xl shrink-0 leading-none">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {lang.label}
                      <span className="ml-1.5 text-muted-foreground tnum text-[11px]">{lang.code}</span>
                      {lang.rtl && (
                        <span className="ml-1.5 inline-block text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-muted rounded px-1 align-middle">RTL</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" dir={lang.rtl ? "rtl" : "ltr"}>{lang.native}</p>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        )}
      </SettingsCard>
    </SettingsScreen>
  );
}
