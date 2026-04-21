/**
 * DescripcionStep · Paso "Descripción" del wizard.
 *
 * Un único textarea gobernado por tabs de idioma (ES + 7). El contenido
 * cambia según el idioma activo. Acciones sobre la caja:
 *   - "Generar con IA" (solo disponible en ES, es la versión base)
 *   - "Traducir con IA" (rellena los idiomas vacíos desde ES)
 */

import { useState } from "react";
import { Sparkles, Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardState } from "./types";

const idiomas = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
] as const;

const textareaClass =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors resize-y";

export function DescripcionStep({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const [activeIdioma, setActiveIdioma] = useState<string>("es");
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);

  const isES = activeIdioma === "es";
  const valueFor = (code: string) =>
    code === "es" ? state.descripcion : state.descripcionIdiomas[code] || "";

  const setValueFor = (code: string, text: string) => {
    if (code === "es") {
      update("descripcion", text);
      if (state.descripcionMode !== "manual") update("descripcionMode", "manual");
    } else {
      update("descripcionIdiomas", { ...state.descripcionIdiomas, [code]: text });
    }
  };

  const hasBase = !!(state.descripcion && state.descripcion.trim().length > 0);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      const mock = `Promoción ${state.nombrePromocion || "exclusiva"} situada en ${state.direccionPromocion.ciudad || "una ubicación privilegiada"}. Diseño contemporáneo, calidades premium y acabados cuidados. Una oportunidad única para disfrutar de un entorno incomparable.`;
      update("descripcion", mock);
      update("descripcionMode", "ai");
      setGenerating(false);
    }, 900);
  };

  const handleTranslateAll = () => {
    if (!hasBase) return;
    setTranslating(true);
    setTimeout(() => {
      const next: Record<string, string> = { ...state.descripcionIdiomas };
      idiomas.forEach((i) => {
        if (i.code !== "es") next[i.code] = `[${i.label}] ${state.descripcion}`;
      });
      update("descripcionIdiomas", next);
      setTranslating(false);
    }, 700);
  };

  const activeLabel = idiomas.find((i) => i.code === activeIdioma)?.label ?? activeIdioma;
  const currentValue = valueFor(activeIdioma);

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Tabs de idioma ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <p className="text-xs font-semibold text-foreground">Descripción</p>
        </div>
        {isES ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={1.5} />
            )}
            {generating ? "Generando…" : hasBase ? "Regenerar con IA" : "Generar con IA"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleTranslateAll}
            disabled={!hasBase || translating}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {translating ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={1.5} />
            )}
            {translating ? "Traduciendo…" : "Traducir todo desde ES"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {idiomas.map((idioma) => {
          const hasContent = !!valueFor(idioma.code);
          const isActive = activeIdioma === idioma.code;
          return (
            <button
              key={idioma.code}
              type="button"
              onClick={() => setActiveIdioma(idioma.code)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : hasContent
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
              )}
            >
              <span aria-hidden="true">{idioma.flag}</span>
              {idioma.label}
              {hasContent && !isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Textarea único ─── */}
      <textarea
        key={activeIdioma}
        value={currentValue}
        onChange={(e) => setValueFor(activeIdioma, e.target.value)}
        placeholder={
          isES
            ? "Escribe o genera con IA. Describe ubicación, vistas, calidades, entorno y lo que hace única la promoción…"
            : hasBase
              ? `Descripción en ${activeLabel}…`
              : "Escribe primero la versión española o genera con IA."
        }
        disabled={!isES && !hasBase}
        className={cn(textareaClass, "min-h-[180px] disabled:opacity-50")}
      />

      <p className="text-[10px] text-muted-foreground">
        {isES
          ? "La IA usará los datos de ubicación, amenities, vistas y tipo de edificación configurados en pasos previos."
          : "Traduce desde la versión española o edita manualmente este idioma."}
      </p>
    </div>
  );
}
