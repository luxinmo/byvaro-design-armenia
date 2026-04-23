/**
 * RegistrationTermsDialog · Modal de lectura de los términos y condiciones
 * de registro de cliente.
 *
 * Se dispara al hacer click en el link del checkbox del diálogo
 * `ClientRegistrationDialog`. Acepta `role` para mostrar la variante
 * correcta (agencia o promotor directo).
 *
 * Responsabilidades:
 *   · Mostrar el texto legal en el idioma pedido (ES / EN).
 *   · Body scrolleable — header y footer permanecen fijos, el botón
 *     "Aceptar" siempre visible.
 *   · Botón dispara `onAccept` y cierra.
 *   · Fullscreen en móvil, 600px centrado en desktop.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRegistrationTerms,
  type LegalLang,
  type LegalRole,
} from "@/data/legal/registrationTerms";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Idioma del contenido legal. Por defecto ES. */
  lang?: LegalLang;
  /** Rol del usuario que acepta los términos. Determina qué variante del
   *  texto se renderiza. Por defecto "agency". */
  role?: LegalRole;
  /** Disparado al pulsar "Aceptar términos". */
  onAccept: () => void;
}

export function RegistrationTermsDialog({
  open,
  onOpenChange,
  lang = "es",
  role = "agency",
  onAccept,
}: Props) {
  const terms = getRegistrationTerms(role);
  const lastUpdatedLabel = new Date(terms.lastUpdated).toLocaleDateString(
    lang === "en" ? "en-GB" : "es-ES",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 bg-card border-0 max-w-[600px] flex flex-col overflow-hidden",
          /* Altura limitada para que el footer con el botón "Aceptar"
           * siempre quede visible. En móvil ocupa 100dvh; en desktop
           * hasta 85vh con scroll interno en el body. */
          "max-h-[85vh] max-sm:max-w-none max-sm:max-h-[100dvh] max-sm:h-[100dvh] max-sm:rounded-none max-sm:top-0 max-sm:translate-y-0",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{terms.title[lang]}</DialogTitle>
          <DialogDescription>{terms.intro[lang]}</DialogDescription>
        </DialogHeader>

        {/* Header fijo */}
        <header className="px-6 pt-6 pb-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-xl bg-foreground/5 flex items-center justify-center">
              <ScrollText className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
            </div>
            <h2 className="text-base font-semibold tracking-tight">{terms.title[lang]}</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {lang === "es" ? "Versión" : "Version"} {terms.version} · {lang === "es" ? "Última actualización" : "Last updated"}: {lastUpdatedLabel}
          </p>
        </header>

        {/* Body scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          <p className="text-xs text-foreground/80 leading-relaxed">
            {terms.intro[lang]}
          </p>

          {terms.sections.map((s) => (
            <section key={s.heading[lang]} className="space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground">{s.heading[lang]}</h3>
              {s.paragraphs?.[lang]?.map((p, i) => (
                <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
              {s.bullets?.[lang] && (
                <ul className="space-y-1 pl-4 list-disc text-[12px] text-muted-foreground leading-relaxed marker:text-muted-foreground/50">
                  {s.bullets[lang].map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <div className="rounded-xl bg-muted/40 border border-border/30 px-4 py-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {lang === "es"
                ? "Al pulsar \"Aceptar términos\" o marcar \"He leído y acepto\", manifiestas tu conformidad expresa con lo anterior. Esta aceptación queda registrada con fecha, hora y huella digital junto al registro."
                : "By pressing \"Accept terms\" or checking \"I have read and accept\", you expressly agree to the above. This acceptance is recorded with date, time and digital fingerprint together with the registration."}
            </p>
          </div>
        </div>

        {/* Footer fijo con CTA */}
        <footer className="px-6 py-4 border-t border-border/30 shrink-0 flex items-center justify-end gap-2 bg-card">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 px-4 text-xs"
            onClick={() => onOpenChange(false)}
          >
            {lang === "es" ? "Cerrar" : "Close"}
          </Button>
          <Button
            size="sm"
            className="rounded-full h-9 px-5 text-xs gap-1.5"
            onClick={() => {
              onAccept();
              onOpenChange(false);
            }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            {terms.acceptCta[lang]}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
