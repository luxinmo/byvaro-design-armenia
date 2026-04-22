/**
 * Diálogo modal de WhatsApp.
 *
 * Sustituye al tab "WhatsApp" como destino al hacer click. En vez de
 * cambiar de pantalla, abrimos un overlay con backdrop blur sobre el
 * resto de la ficha y un panel a la derecha (en desktop) que ocupa
 * todo el alto de la viewport y un ancho fijo cómodo de chat. En
 * móvil el panel pasa a fullscreen.
 *
 * El contenido es exactamente `<ContactWhatsAppTab />` — reutilizamos
 * todo el chat (setup, conversación, permisos…) sin duplicar lógica.
 *
 * Por qué modal y no tab:
 *  · El usuario espera responder rápido sin perder el contexto de la
 *    ficha (resumen, registros, oportunidades…).
 *  · La conversación es lateral — la lectura del cliente sigue al lado.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ContactWhatsAppTab } from "./ContactWhatsAppTab";
import type { ContactDetail } from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ContactDetail;
};

export function ContactWhatsAppDialog({ open, onOpenChange, detail }: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop con blur — desenfoca la ficha por detrás. */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        {/* Panel: full-height, ancho amplio en desktop (920px = chat
         *  ~620 + sidebar de agentes 300) y full-width en móvil.
         *  Anclado a la derecha de la viewport. */}
        <DialogPrimitive.Content
          className="fixed right-0 top-0 z-50 h-[100dvh] w-full md:w-[920px] bg-background border-l border-border/40 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-200"
        >
          <DialogPrimitive.Title className="sr-only">
            WhatsApp · {detail.name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Conversación de WhatsApp con {detail.name}
          </DialogPrimitive.Description>

          {/* Botón cerrar flotante — arriba a la derecha. La sidebar
           *  de agentes ocupa esa zona, así que el botón flota encima. */}
          <DialogPrimitive.Close
            className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-card/95 backdrop-blur border border-border/60 text-muted-foreground shadow-sm flex items-center justify-center transition-all hover:bg-muted hover:text-foreground"
            aria-label="Cerrar WhatsApp"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </DialogPrimitive.Close>

          {/* Contenido sin padding propio — el ChatView ocupa todo el
           *  alto del modal y maneja su propio scroll interno. */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ContactWhatsAppTab detail={detail} mode="modal" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
