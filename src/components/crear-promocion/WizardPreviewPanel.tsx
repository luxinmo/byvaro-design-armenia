/**
 * WizardPreviewPanel · panel lateral derecho (desktop xl+) que muestra
 * una preview en vivo de la promoción mientras se rellena el wizard.
 *
 * Dos "piezas":
 *   1. Card miniatura (lo que ve un promotor/agencia en el listado).
 *   2. Microsite mini (lo que vería un cliente final en la web pública).
 *
 * Objetivo: dar sensación de "producto 100M€" — que el promotor vea el
 * fruto de su trabajo en tiempo real y se entusiasme. También sirve de
 * control de calidad: si la preview se ve mal, falta algún dato.
 *
 * Implementación actual (Commit 1): shell del panel con datos reales
 * disponibles. Los detalles de microsite (plantillas, colores, tipografía)
 * se refinan en commits posteriores.
 */

import { Building2, Camera, Eye, Globe2, MapPin } from "lucide-react";
import type { WizardState } from "./types";
import { tipoOptions, subUniOptions, subVariasOptions, estadoOptions } from "./options";
import { cn } from "@/lib/utils";

function getDerivedName(state: WizardState): string {
  if (state.nombrePromocion?.trim()) return state.nombrePromocion.trim();
  // Sugerencia provisional mientras no hay nombre escrito
  const tipoLabel = tipoOptions.find(o => o.value === state.tipo)?.label;
  const ciudad = state.direccionPromocion.ciudad?.trim();
  if (ciudad) return `Promoción en ${ciudad}`;
  if (tipoLabel) return `Nueva promoción ${tipoLabel.toLowerCase()}`;
  return "Nueva promoción";
}

function getDerivedLocation(state: WizardState): string {
  const { ciudad, provincia, pais } = state.direccionPromocion;
  const parts = [ciudad, provincia, pais].filter(p => p?.trim());
  if (parts.length === 0) return "Ubicación pendiente";
  return parts.join(", ");
}

function getDerivedSummary(state: WizardState): string {
  const parts: string[] = [];
  if (state.tipo) parts.push(tipoOptions.find(o => o.value === state.tipo)?.label ?? "");
  if (state.tipo === "unifamiliar" && state.subUni) {
    parts.push(subUniOptions.find(o => o.value === state.subUni)?.label ?? "");
  }
  if (state.subVarias) parts.push(subVariasOptions.find(o => o.value === state.subVarias)?.label ?? "");
  if (state.estado) parts.push(estadoOptions.find(o => o.value === state.estado)?.label ?? "");
  return parts.filter(Boolean).join(" · ") || "Rellena los pasos para ver la preview";
}

function getDerivedUnits(state: WizardState): number {
  if (state.unidades.length > 0) return state.unidades.length;
  if (state.tipo === "unifamiliar" && state.subUni === "una_sola") return 1;
  if (state.tipologiasSeleccionadas.length > 0) {
    return state.tipologiasSeleccionadas.reduce((s, t) => s + t.cantidad, 0);
  }
  const totalEsc = state.escalerasPorBloque.reduce((sum, n) => sum + n, 0) || 1;
  return Math.max(1, state.plantas * state.aptosPorPlanta * totalEsc);
}

export function WizardPreviewPanel({ state, className }: { state: WizardState; className?: string }) {
  const name = getDerivedName(state);
  const location = getDerivedLocation(state);
  const summary = getDerivedSummary(state);
  const units = getDerivedUnits(state);
  const cover = state.fotos.find(f => f.esPrincipal)?.url ?? state.fotos[0]?.url ?? null;
  const hasLocation = !!state.direccionPromocion.ciudad?.trim();

  return (
    <aside
      className={cn(
        "w-[340px] shrink-0 border-l border-border bg-muted/25 flex-col",
        className,
      )}
      aria-label="Preview en vivo de la promoción"
    >
      <div className="h-14 flex items-center gap-2 px-5 border-b border-border bg-card/50">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preview en vivo
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* ═════ Tarjeta tipo "card en listado" ═════ */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Tarjeta en listado
          </p>
          <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
            {/* Cover */}
            <div className="relative aspect-[16/10] bg-muted">
              {cover ? (
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10.5px] font-medium">Sin imagen aún</span>
                  </div>
                </div>
              )}
              {state.fotos.length > 0 && (
                <span className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 tnum">
                  {state.fotos.length} fotos
                </span>
              )}
            </div>
            {/* Body */}
            <div className="p-3.5 flex flex-col gap-1.5">
              <h3 className="text-[13.5px] font-bold text-foreground leading-tight truncate" title={name}>
                {name}
              </h3>
              <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
              <p className="text-[11px] text-muted-foreground/90 leading-snug line-clamp-2">
                {summary}
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="tnum">{units}</span> uds
                </span>
                {state.estado && (
                  <span className="text-[10px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                    {estadoOptions.find(o => o.value === state.estado)?.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═════ Microsite mini ═════ */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Globe2 className="h-3 w-3" />
            Microsite público
          </p>
          <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
            {/* Fake URL bar */}
            <div className="h-6 px-3 bg-muted/60 border-b border-border flex items-center gap-1.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-green-400/70" />
              </div>
              <span className="text-[9.5px] text-muted-foreground/80 truncate flex-1 text-center tnum">
                byvaro.com/{state.nombrePromocion?.trim().toLowerCase().replace(/\s+/g, "-") || "nueva-promocion"}
              </span>
            </div>
            {/* Hero */}
            <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/10 via-muted to-primary/5">
              {cover && (
                <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h4 className="text-white text-[13px] font-bold leading-tight drop-shadow truncate">
                  {name}
                </h4>
                <p className="text-white/85 text-[10.5px] leading-tight truncate">
                  {hasLocation ? location : "Tu promoción aquí"}
                </p>
              </div>
            </div>
            {/* Placeholder sections */}
            <div className="p-3 flex flex-col gap-1.5">
              <div className="h-1.5 w-2/3 rounded-full bg-muted" />
              <div className="h-1.5 w-1/2 rounded-full bg-muted" />
              <div className="h-1.5 w-3/4 rounded-full bg-muted" />
              <div className="flex gap-1.5 pt-1">
                <div className="h-8 flex-1 rounded-lg bg-muted/70" />
                <div className="h-8 flex-1 rounded-lg bg-muted/70" />
                <div className="h-8 flex-1 rounded-lg bg-muted/70" />
              </div>
            </div>
          </div>
        </div>

        {/* ═════ Nota ═════ */}
        <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed px-1">
          La preview se actualiza automáticamente mientras rellenas los pasos.
          Al publicar, el microsite se genera con tu branding real.
        </p>
      </div>
    </aside>
  );
}
