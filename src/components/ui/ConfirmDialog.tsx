/**
 * ConfirmDialog · reemplazo de `window.confirm()` con los tokens Byvaro.
 *
 * Uso imperativo vía el hook `useConfirm()`:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "¿Descartar?", confirmLabel: "Descartar" });
 *   if (ok) doThing();
 *
 * El componente `<ConfirmDialogHost />` debe montarse UNA vez en el
 * árbol (p. ej. junto al Toaster global). El hook comunica con él
 * mediante un event bus simple.
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type Resolver = (ok: boolean) => void;

// Event bus mínimo · una sola instancia global del host.
const listeners = new Set<(opts: ConfirmOptions, resolve: Resolver) => void>();

export function useConfirm() {
  return (opts: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => {
      const fn = Array.from(listeners)[0];
      if (!fn) {
        // Fallback defensivo: si no hay host montado, nativo para no
        // bloquear al usuario.
        // eslint-disable-next-line no-alert
        resolve(window.confirm(`${opts.title}${opts.description ? `\n\n${opts.description}` : ""}`));
        return;
      }
      fn(opts, resolve);
    });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: Resolver } | null>(null);

  useEffect(() => {
    const fn = (opts: ConfirmOptions, resolve: Resolver) => setState({ opts, resolve });
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const handle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const isDestructive = state?.opts.variant === "destructive";

  return (
    <Dialog open={!!state} onOpenChange={(v) => { if (!v) handle(false); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-5 pb-2">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">{state?.opts.title}</DialogTitle>
              {state?.opts.description && (
                <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {state.opts.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="px-5 py-3 border-t border-border/40 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handle(false)}
            className="rounded-full text-xs h-9 px-4"
          >
            {state?.opts.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            size="sm"
            onClick={() => handle(true)}
            className={cn(
              "rounded-full text-xs h-9 px-4",
              isDestructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {state?.opts.confirmLabel ?? "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
