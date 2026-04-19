import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  sections?: string[];
  status?: "planning" | "designing" | "next";
};

const statusCopy = {
  planning: "En planificación",
  designing: "En diseño",
  next: "Próxima pantalla",
};

export function PlaceholderPage({ icon: Icon, eyebrow, title, description, sections, status = "planning" }: Props) {
  return (
    <div className="flex-1 min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8">
        <div className="max-w-[1100px] mx-auto">

          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-10">
            {/* decorative glow */}
            <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col items-start gap-5 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                    {eyebrow}
                  </p>
                  <h1 className="text-[24px] sm:text-[30px] font-bold tracking-tight leading-tight">{title}</h1>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11.5px] font-semibold">
                <Sparkles className="h-3 w-3" />
                {statusCopy[status]}
              </div>

              <p className="text-[14.5px] text-muted-foreground leading-relaxed">
                {description}
              </p>

              {sections && sections.length > 0 && (
                <div className="w-full">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                    Bloques previstos en esta pantalla
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sections.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background/40 hover:border-primary/40 hover:bg-background transition-colors"
                      >
                        <div className="h-6 w-6 rounded-lg bg-muted text-muted-foreground grid place-items-center text-[11px] font-bold tnum shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <span className="text-[13px] leading-snug text-foreground">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft">
                Volver al Inicio <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Placeholder cards (skeletons) */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card shadow-soft p-5">
                <div className="h-2.5 w-24 bg-muted rounded-full" />
                <div className="h-6 w-32 bg-muted/60 rounded mt-3" />
                <div className="h-2 w-full bg-muted/40 rounded-full mt-4" />
                <div className="h-2 w-5/6 bg-muted/30 rounded-full mt-2" />
                <div className="h-2 w-3/4 bg-muted/30 rounded-full mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
