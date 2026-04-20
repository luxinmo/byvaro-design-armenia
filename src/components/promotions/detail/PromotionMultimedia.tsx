/**
 * PromotionMultimedia · panel de "Recursos y multimedia" de la ficha.
 *
 * Qué hace:
 *   Renderiza un grid de tiles clicables (2 cols mobile / 3 cols md+) que
 *   resumen los recursos disponibles de una promoción: tour virtual 360°,
 *   vídeos, galería de imágenes, catálogo PDF, planos y documentos legales.
 *   Cada tile es un botón con icono coloreado + etiqueta + contador de
 *   archivos. Sirve como hub de acceso rápido desde la ficha principal.
 *
 * Props:
 *   - Ninguno por ahora. La lista de recursos está hardcodeada en el
 *     array `resources` (mock). Cuando haya backend se pasará como prop
 *     `resources: PromotionResource[]`.
 *
 * Dependencias:
 *   - `lucide-react` → iconos (Compass para tour 360°, Video, BookOpen
 *     para PDF, FileText para planos/docs, Image para galería).
 *
 * Tokens Byvaro usados:
 *   - `bg-card` + `border-border/40` → superficie panel.
 *   - `bg-primary/10 text-primary` → tinte para tour y catálogo.
 *   - `bg-destructive/10 text-destructive` → tinte para vídeos (acción
 *     "reproducir" / recurso consumible).
 *   - `bg-amber-500/10 ... text-amber-700` → warning Byvaro estándar
 *     (galería = contenido sin revisar / pendiente de curar).
 *   - `bg-accent/10 text-accent-foreground` → tinte para planos.
 *   - `bg-muted text-muted-foreground` → tinte neutro para documentos
 *     legales.
 *   - Radios: panel `rounded-2xl`, tiles `rounded-xl`, iconos `rounded-lg`.
 *   - Sombras: `shadow-soft` en reposo, `shadow-soft-lg` en hover.
 *
 * TODO(backend):
 *   - GET /api/promotions/:id/resources → lista real de recursos con
 *     { type, count, url }. Sustituir el array `resources` mock.
 *   - El `count` debe venir del backend (num de assets por tipo).
 *   - El click en cada tile debe navegar al visor correspondiente
 *     (/promotions/:id/gallery, /promotions/:id/tour, etc.).
 *
 * TODO(ui):
 *   - Estado vacío: si `count === 0`, ocultar tile o mostrar en gris con
 *     label "Sin archivos".
 *   - Thumbnail preview del primer asset al hover (pop-card lateral).
 *   - Badge "Nuevo" cuando se suba un recurso hace <7 días.
 */

// Iconos del set lucide-react usados como glyphs visuales para cada tipo
// de recurso. Trazo fino (strokeWidth default) para cuadrar con el resto
// de la ficha.
import { Compass, Video, BookOpen, FileText, Image as ImageIcon } from "lucide-react";

const resources = [
  { icon: Compass, label: "Tour virtual 360°", count: 3, color: "text-primary bg-primary/10" },
  { icon: Video, label: "Vídeos", count: 2, color: "text-destructive bg-destructive/10" },
  { icon: ImageIcon, label: "Galería", count: 24, color: "text-amber-700 bg-amber-500/10" },
  { icon: BookOpen, label: "Catálogo PDF", count: 1, color: "text-primary bg-primary/10" },
  { icon: FileText, label: "Planos", count: 8, color: "text-accent-foreground bg-accent/10" },
  { icon: FileText, label: "Documentos legales", count: 4, color: "text-muted-foreground bg-muted" },
];

export function PromotionMultimedia() {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-soft">
      <h2 className="text-base font-semibold text-foreground mb-3">Recursos y multimedia</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {resources.map((r) => (
          <button
            key={r.label}
            className="flex items-center gap-2.5 p-3 rounded-xl border border-border/30 bg-background/50 hover:bg-muted/40 hover:border-border/50 hover:-translate-y-0.5 hover:shadow-soft-lg transition-all duration-200 text-left"
          >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${r.color}`}>
              <r.icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-[10px] text-muted-foreground">{r.count} {r.count === 1 ? "archivo" : "archivos"}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
