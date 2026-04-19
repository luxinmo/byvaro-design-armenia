/**
 * DescripcionStep · Paso "Descripción" del wizard Crear Promoción.
 *
 * Dos modos seleccionables:
 *   1. IA: la descripción se genera automáticamente a partir de la
 *      ubicación, amenities, vistas y tipo de edificación configurados
 *      en pasos anteriores. Mock informativo en el prototipo.
 *   2. Manual: textarea libre, mínimo recomendado ~140 px.
 *
 * Bloque "Traducciones": pestañas de idioma (ES por defecto, más 7
 * idiomas adicionales) + textarea por idioma activo. Botón "Traducir
 * con IA" rellena los idiomas vacíos desde la versión española (mock).
 *
 * Port adaptado de figgy-friend-forge/src/components/create-promotion/
 * StepDescripcion.tsx — sin shadcn, con primitivas nativas + tokens
 * del sistema Byvaro.
 */

import { useState } from "react";
import { Sparkles, PenLine, Languages } from "lucide-react";
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

  const updateIdioma = (code: string, text: string) => {
    update("descripcionIdiomas", { ...state.descripcionIdiomas, [code]: text });
  };

  const handleTranslateAll = () => {
    const base = state.descripcion || state.descripcionIdiomas["es"] || "";
    if (!base) return;
    const next: Record<string, string> = { ...state.descripcionIdiomas };
    idiomas.forEach((i) => {
      if (i.code !== "es" && !next[i.code]) {
        next[i.code] = `[${i.label}] ${base}`;
      }
    });
    update("descripcionIdiomas", next);
  };

  const activeLabel = idiomas.find((i) => i.code === activeIdioma)?.label ?? activeIdioma;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Selector de modo ─── */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => update("descripcionMode", "ai")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            state.descripcionMode === "ai"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          Generar con IA
        </button>
        <button
          type="button"
          onClick={() => update("descripcionMode", "manual")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            state.descripcionMode === "manual"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
          )}
        >
          <PenLine className="h-3.5 w-3.5" strokeWidth={1.5} />
          Escribir manualmente
        </button>
      </div>

      {/* ─── Modo manual: textarea principal ─── */}
      {state.descripcionMode === "manual" && (
        <textarea
          value={state.descripcion}
          onChange={(e) => update("descripcion", e.target.value)}
          placeholder="Describe la promoción, su ubicación, vistas, calidades, entorno y lo que la hace única..."
          className={cn(textareaClass, "min-h-[140px]")}
        />
      )}

      {/* ─── Modo IA: bloque informativo ─── */}
      {state.descripcionMode === "ai" && (
        <div className="rounded-xl bg-muted/40 border border-border px-4 py-4 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Generación automática</p>
            <p>
              La descripción se generará basándose en la ubicación, amenities, vistas y tipo de edificación
              configurados en pasos anteriores. Podrás revisarla y editarla antes de publicar.
            </p>
          </div>
        </div>
      )}

      {/* ─── Traducciones ─── */}
      {state.descripcionMode !== null && (
        <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-foreground">Traducciones</p>
            </div>
            <button
              type="button"
              onClick={handleTranslateAll}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              Traducir con IA
            </button>
          </div>

          {/* Tabs de idioma */}
          <div className="flex flex-wrap gap-1.5">
            {idiomas.map((idioma) => {
              const hasContent =
                idioma.code === "es"
                  ? !!(state.descripcion || state.descripcionIdiomas["es"])
                  : !!state.descripcionIdiomas[idioma.code];
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

          {/* Textarea del idioma activo */}
          <textarea
            value={
              activeIdioma === "es"
                ? state.descripcion || state.descripcionIdiomas["es"] || ""
                : state.descripcionIdiomas[activeIdioma] || ""
            }
            onChange={(e) => {
              if (activeIdioma === "es") {
                update("descripcion", e.target.value);
              } else {
                updateIdioma(activeIdioma, e.target.value);
              }
            }}
            placeholder={`Descripción en ${activeLabel}...`}
            className={cn(textareaClass, "min-h-[100px] text-xs")}
          />
        </div>
      )}
    </div>
  );
}
