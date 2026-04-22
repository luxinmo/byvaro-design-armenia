/**
 * Dialog "Vincular contacto relacionado".
 *
 * 2 pasos:
 *  1. Buscar y elegir un contacto del workspace (excluyendo el actual
 *     y los ya vinculados).
 *  2. Elegir tipo de relación (Cónyuge, Pareja, Familiar, Colega, Otro).
 *
 * Persiste el vínculo en `byvaro.contact.<id>.related.v1`.
 *
 * TODO(backend): PATCH /api/contacts/:id { relatedContacts: [...] }.
 */

import { useEffect, useMemo, useState } from "react";
import { Save, X, Search, ArrowLeft, Check, Heart, Users, Briefcase, MoreHorizontal } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { loadCreatedContacts } from "@/components/contacts/createdContactsStorage";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import {
  loadDeletedContactIds, saveRelationsOverride,
} from "@/components/contacts/contactRelationsStorage";
import { recordRelationLinked } from "@/components/contacts/contactEventsStorage";
import { loadRelationTypes } from "@/components/contacts/relationTypesStorage";
import { useCurrentUser } from "@/lib/currentUser";
import type { Contact, ContactRelation } from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  current: ContactRelation[];
  onSaved: () => void;
};

/** Iconos para los 5 tipos predeterminados. Los tipos personalizados
 *  caen en el icono genérico `MoreHorizontal`. */
const ICON_FOR_BUILTIN: Record<string, typeof Heart> = {
  spouse:    Heart,
  partner:   Heart,
  family:    Users,
  colleague: Briefcase,
  other:     MoreHorizontal,
};

export function LinkContactDialog({ open, onOpenChange, contactId, current, onSaved }: Props) {
  const user = useCurrentUser();
  const [step, setStep] = useState<1 | 2>(1);
  const [pickedContact, setPickedContact] = useState<Contact | null>(null);
  /* Catálogo dinámico (admin lo edita en /ajustes/contactos/relaciones).
   *  Solo los activos aparecen para crear nuevos vínculos. */
  const relationOptions = useMemo(
    () => loadRelationTypes().filter((t) => t.enabled !== false),
    [open],
  );
  const [relation, setRelation] = useState<string>(
    relationOptions.find((t) => t.id === "family")?.id ?? relationOptions[0]?.id ?? "other",
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setPickedContact(null);
      setRelation(
        relationOptions.find((t) => t.id === "family")?.id ?? relationOptions[0]?.id ?? "other",
      );
      setQuery("");
    }
  }, [open, relationOptions]);

  const candidates = useMemo<Contact[]>(() => {
    const deleted = loadDeletedContactIds();
    const all = [...loadCreatedContacts(), ...loadImportedContacts(), ...MOCK_CONTACTS]
      .filter((c) => !deleted.has(c.id))
      .filter((c) => c.id !== contactId)
      .filter((c) => !current.some((r) => r.contactId === c.id));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(q) ||
             (c.email?.toLowerCase().includes(q) ?? false) ||
             (c.reference?.toLowerCase().includes(q) ?? false),
    );
  }, [open, query, contactId, current]);

  const save = () => {
    if (!pickedContact) return;
    const next: ContactRelation[] = [...current, {
      contactId: pickedContact.id,
      contactName: pickedContact.name,
      relationType: relation,
    }];
    saveRelationsOverride(contactId, next);
    const relationLabel = relationOptions.find((o) => o.id === relation)?.label ?? relation;
    /* Audit log en AMBOS contactos para que el vínculo sea simétrico
     * en el historial. */
    const by = { name: user.name, email: user.email };
    recordRelationLinked(contactId, by, pickedContact.name, relationLabel);
    recordRelationLinked(pickedContact.id, by, "este contacto", relationLabel);
    onSaved();
    onOpenChange(false);
    toast.success(`${pickedContact.name} vinculado como ${relationLabel.toLowerCase()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/40 p-0 gap-0 max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-base font-semibold">
            {step === 1 ? "Vincular contacto" : "Tipo de relación"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === 1
              ? "Busca el contacto que quieres vincular."
              : pickedContact && `Cómo se relacionan con ${pickedContact.name}.`}
          </p>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="px-5 py-3 border-b border-border/40 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, email o referencia…"
                  className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {candidates.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground italic text-center py-6">
                  Sin contactos disponibles para vincular.
                </p>
              ) : candidates.map((c) => {
                const initials = c.name.split(" ").filter(Boolean).slice(0, 2)
                  .map((w) => w[0]).join("").toUpperCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => { setPickedContact(c); setStep(2); }}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-xs shrink-0">
                      {c.flag ? <span className="text-base leading-none">{c.flag}</span> : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.email ?? c.phone ?? c.reference ?? "Sin contacto"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && pickedContact && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
              <div className="h-10 w-10 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-xs shrink-0">
                {pickedContact.flag ? <span className="text-lg leading-none">{pickedContact.flag}</span> :
                  pickedContact.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{pickedContact.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{pickedContact.email}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {relationOptions.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground italic text-center py-6">
                  No hay tipos de relación activos. Configúralos en
                  Ajustes → Contactos → Tipos de relación.
                </p>
              ) : relationOptions.map((o) => {
                const Icon = ICON_FOR_BUILTIN[o.id] ?? MoreHorizontal;
                const active = relation === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setRelation(o.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors border",
                      active
                        ? "border-foreground bg-foreground/5"
                        : "border-border bg-card hover:border-foreground/30",
                    )}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm text-foreground">{o.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="px-5 py-3 border-t border-border/40 bg-card flex-row sm:justify-between gap-2 shrink-0">
          {step === 1 ? (
            <>
              <span />
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => { setStep(1); setPickedContact(null); }} className="rounded-full">
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </Button>
              <Button size="sm" onClick={save} className="rounded-full">
                <Save className="h-3.5 w-3.5" /> Vincular
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
