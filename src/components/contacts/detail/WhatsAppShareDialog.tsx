/**
 * Dialog "Compartir por WhatsApp · elegir destinatarios".
 *
 * Permite elegir uno o varios contactos del workspace. Al confirmar,
 * para cada contacto seleccionado se generan mensajes WhatsApp con los
 * adjuntos pasados (kind=image o document).
 *
 * Por defecto preselecciona el contacto desde el que se compartió
 * (`defaultContactId`).
 *
 * TODO(backend): POST /api/whatsapp/messages con array de destinatarios.
 */

import { useMemo, useState } from "react";
import { Search, Check, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import { appendOutgoingMessage } from "@/components/contacts/whatsappMessagesMock";
import type { Contact } from "@/components/contacts/types";

export type SharePayload = {
  name: string;
  size: number;
  dataUrl: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContactId: string;
  attachments: SharePayload[];
  onSent: (recipientIds: string[]) => void;
};

export function WhatsAppShareDialog({
  open, onOpenChange, defaultContactId, attachments, onSent,
}: Props) {
  const user = useCurrentUser();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  /* Reset selección al abrir — el usuario elige cada vez. */
  useMemo(() => {
    if (open) setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allContacts = useMemo<Contact[]>(
    () => [...loadImportedContacts(), ...MOCK_CONTACTS],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allContacts;
    return allContacts.filter(
      (c) => c.name.toLowerCase().includes(q) ||
             (c.email?.toLowerCase().includes(q) ?? false) ||
             (c.reference?.toLowerCase().includes(q) ?? false),
    );
  }, [allContacts, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = () => {
    if (selected.size === 0 || attachments.length === 0) return;
    const recipientIds = [...selected];

    recipientIds.forEach((contactId) => {
      attachments.forEach((a) => {
        const isImage = /^data:image\//.test(a.dataUrl) ||
                        /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.name);
        appendOutgoingMessage(contactId, {
          authorId: user.id,
          authorName: user.name,
          kind: isImage ? "image" : "document",
          meta: {
            fileName: a.name,
            sizeKb: Math.round(a.size / 1024),
            ...(isImage ? { dataUrl: a.dataUrl } : {}),
          },
        });
      });
    });

    const docPart = attachments.length === 1 ? "1 documento" : `${attachments.length} documentos`;
    const toPart = recipientIds.length === 1 ? "1 contacto" : `${recipientIds.length} contactos`;
    toast.success(`${docPart} enviados a ${toPart} por WhatsApp`);

    onSent(recipientIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/40 p-0 gap-0 max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-base font-semibold">Enviar por WhatsApp</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {attachments.length === 1
              ? `${attachments[0].name}`
              : `${attachments.length} documentos seleccionados`}
          </p>
        </DialogHeader>

        <div className="px-5 py-3 border-b border-border/40 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contacto por nombre, email o referencia…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic text-center py-6">
              Sin coincidencias
            </p>
          ) : filtered.map((c) => {
            const isSelected = selected.has(c.id);
            const initials = c.name.split(" ").filter(Boolean).slice(0, 2)
              .map((w) => w[0]).join("").toUpperCase();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors",
                  isSelected ? "bg-foreground/5" : "hover:bg-muted/40",
                )}
              >
                <div className={cn(
                  "h-5 w-5 rounded-md border grid place-items-center transition-colors shrink-0",
                  isSelected ? "bg-foreground border-foreground text-background" : "border-border",
                )}>
                  {isSelected && (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M3 8l3.5 3.5L13 5" />
                    </svg>
                  )}
                </div>
                <div className="h-8 w-8 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-[10px] shrink-0 relative">
                  {c.flag ? <span className="text-base leading-none">{c.flag}</span> : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.phone ?? c.email ?? "Sin contacto"}
                  </p>
                </div>
                {c.id === defaultContactId && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                    actual
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border/40 bg-card flex-row sm:justify-between gap-2 shrink-0">
          <span className="text-[11.5px] text-muted-foreground self-center">
            <strong className="tnum text-foreground">{selected.size}</strong> {selected.size === 1 ? "destinatario" : "destinatarios"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button size="sm" onClick={send} disabled={selected.size === 0} className="rounded-full">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
