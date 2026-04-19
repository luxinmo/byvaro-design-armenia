import { Compass, Video, BookOpen, FileText, Image as ImageIcon } from "lucide-react";

const resources = [
  { icon: Compass, label: "Tour virtual 360°", count: 3, color: "text-blue-600 bg-blue-50" },
  { icon: Video, label: "Vídeos", count: 2, color: "text-rose-600 bg-rose-50" },
  { icon: ImageIcon, label: "Galería", count: 24, color: "text-amber-600 bg-amber-50" },
  { icon: BookOpen, label: "Catálogo PDF", count: 1, color: "text-emerald-600 bg-emerald-50" },
  { icon: FileText, label: "Planos", count: 8, color: "text-violet-600 bg-violet-50" },
  { icon: FileText, label: "Documentos legales", count: 4, color: "text-slate-600 bg-slate-50" },
];

export function PromotionMultimedia() {
  return (
    <div className="rounded-2xl bg-card border border-border/40 p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
      <h2 className="text-base font-semibold text-foreground mb-3">Recursos y multimedia</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {resources.map((r) => (
          <button
            key={r.label}
            className="flex items-center gap-2.5 p-3 rounded-xl border border-border/30 bg-background/50 hover:bg-muted/40 hover:border-border/50 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 text-left"
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
