/**
 * Dialog "Editar contacto".
 *
 * Vista única en scroll vertical (sin tabs internas — el usuario quiere
 * verlo todo de un golpe). Orden de las secciones:
 *
 *  1. Tipo de cliente (Particular / Empresa)
 *  2. Datos identidad (cambia según tipo)
 *  3. Nacionalidad + idiomas
 *  4. Teléfonos (multi, con principal)
 *  5. Emails (multi, con principal)
 *  6. Dirección (una línea, Google Maps)
 *  7. Origen + notas
 *
 * NO incluye:
 *  - Persona de contacto (eso es un contacto asociado, se vincula
 *    desde la card "Contactos relacionados" del Resumen).
 *  - Etiquetas (editor inline en Resumen).
 *  - Asignados (botón en sidebar).
 *  - Consents (toggles en sidebar).
 *
 * Persistencia: byvaro.contact.<id>.edits.v1.
 * TODO(backend): PATCH /api/contacts/:id + Google Places autocomplete.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Save, X, Plus, Star, Trash2, MapPin, ChevronDown, Check, Search,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LANGUAGES, findLanguageByCode } from "@/lib/languages";
import { PHONE_COUNTRIES } from "@/lib/phoneCountries";
import {
  saveContactEdits, type ContactEdits,
} from "@/components/contacts/contactEditsStorage";
import { loadSources } from "@/components/contacts/sourcesStorage";
import {
  saveCreatedContact, generateContactId, nextContactReference, loadCreatedContacts,
} from "@/components/contacts/createdContactsStorage";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { recordContactCreated, recordContactEdited } from "@/components/contacts/contactEventsStorage";
import { useCurrentUser } from "@/lib/currentUser";
import type {
  Contact, ContactDetail, ContactKind, ContactPhone, ContactEmailAddress,
} from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contacto a editar. Si null → modo CREAR (form en blanco). */
  detail: ContactDetail | null;
  onSaved: () => void;
  /** Callback opcional cuando se crea un nuevo contacto (modo create).
   *  Recibe el Contact recién creado para que el padre pueda navegar. */
  onCreated?: (contact: Contact) => void;
  /** Sólo en modo create: pre-rellena name o email iniciales (ej.
   *  cuando se abre desde el autocomplete del composer de email). */
  initialPrefill?: { email?: string; name?: string };
};

type FormState = {
  kind: ContactKind;
  /** Particular: nombre completo. Empresa: nombre opcional auxiliar (no se muestra en el form). */
  name: string;
  nif: string;
  companyName: string;
  tradeName: string;
  companyTaxId: string;
  birthDate: string;
  nationality: string;
  flag: string;
  languages: string[];
  address: string;
  source: string;
  notes: string;
  phones: ContactPhone[];
  emails: ContactEmailAddress[];
};

function detailToForm(detail: ContactDetail): FormState {
  return {
    kind: detail.kind ?? "individual",
    name: detail.name ?? "",
    nif: detail.nif ?? "",
    companyName: detail.companyName ?? "",
    tradeName: detail.tradeName ?? "",
    companyTaxId: detail.companyTaxId ?? "",
    birthDate: detail.birthDate ? detail.birthDate.slice(0, 10) : "",
    nationality: detail.nationality ?? "",
    flag: detail.flag ?? "",
    languages: detail.languages ?? [],
    address: [detail.address, detail.city, detail.postalCode].filter(Boolean).join(", "),
    source: detail.source ?? "",
    notes: detail.notes ?? "",
    phones: detail.phones?.length
      ? detail.phones.map((p) => ({ ...p }))
      : [{ id: "p-new-1", number: detail.phone ?? "", label: "Móvil", primary: true, hasWhatsapp: true }],
    emails: detail.emailAddresses?.length
      ? detail.emailAddresses.map((e) => ({ ...e }))
      : [{ id: "e-new-1", address: detail.email ?? "", label: "Personal", primary: true }],
  };
}

/** Form en blanco para CREAR un contacto nuevo. */
function emptyForm(): FormState {
  return {
    kind: "individual",
    name: "",
    nif: "",
    companyName: "",
    tradeName: "",
    companyTaxId: "",
    birthDate: "",
    nationality: "",
    flag: "",
    languages: [],
    address: "",
    source: "",
    notes: "",
    phones: [{ id: "p-new-1", number: "", label: "Móvil", primary: true, hasWhatsapp: true }],
    emails: [{ id: "e-new-1", address: "", label: "Personal", primary: true }],
  };
}

function formToEdits(form: FormState): ContactEdits {
  const ensureOnePrimary = <T extends { primary?: boolean }>(arr: T[]): T[] => {
    if (arr.length === 0) return arr;
    const idx = arr.findIndex((x) => x.primary);
    return arr.map((x, i) => ({ ...x, primary: i === (idx === -1 ? 0 : idx) }));
  };
  const phones = ensureOnePrimary(form.phones.filter((p) => p.number.trim()));
  const emails = ensureOnePrimary(form.emails.filter((e) => e.address.trim()));
  return {
    kind: form.kind,
    name: form.name.trim() || undefined,
    nif: form.kind === "individual" ? form.nif.trim() || undefined : undefined,
    companyName: form.kind === "company" ? form.companyName.trim() || undefined : undefined,
    tradeName: form.kind === "company" ? form.tradeName.trim() || undefined : undefined,
    companyTaxId: form.kind === "company" ? form.companyTaxId.trim() || undefined : undefined,
    birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : undefined,
    nationality: form.nationality.trim() || undefined,
    flag: form.flag.trim() || undefined,
    languages: form.languages.length ? form.languages : undefined,
    address: form.address.trim() || undefined,
    source: form.source.trim() || undefined,
    notes: form.notes.trim() || undefined,
    phones,
    emailAddresses: emails,
    phone: phones.find((p) => p.primary)?.number,
    email: emails.find((e) => e.primary)?.address,
  };
}

export function EditContactDialog({ open, onOpenChange, detail, onSaved, onCreated, initialPrefill }: Props) {
  const confirm = useConfirm();
  const user = useCurrentUser();
  const isCreate = detail === null;

  const buildFresh = (): FormState => {
    if (detail) return detailToForm(detail);
    const blank = emptyForm();
    if (initialPrefill?.name) blank.name = initialPrefill.name;
    if (initialPrefill?.email) {
      blank.emails = [{ id: "e-new-1", address: initialPrefill.email, label: "Personal", primary: true }];
    }
    return blank;
  };

  const [form, setForm] = useState<FormState>(buildFresh);
  const [initial, setInitial] = useState<FormState>(form);

  const sources = useMemo(() => loadSources().map((s) => s.label), []);

  useEffect(() => {
    if (open) {
      const fresh = buildFresh();
      setForm(fresh);
      setInitial(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail, initialPrefill?.email, initialPrefill?.name]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  const hasName = form.kind === "individual"
    ? form.name.trim().length > 0
    : form.companyName.trim().length > 0;
  /* En modo crear, basta con tener nombre para poder guardar.
   * En modo editar, además debe haber cambios. */
  const canSave = hasName && (isCreate || isDirty);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const requestClose = async (next: boolean) => {
    if (!next && isDirty) {
      const ok = await confirm({
        title: isCreate ? "¿Descartar el contacto?" : "¿Descartar los cambios?",
        description: isCreate
          ? "El contacto que estabas creando se perderá."
          : "Los cambios que has hecho se perderán.",
        confirmLabel: "Descartar",
        variant: "destructive",
      });
      if (!ok) return;
    }
    onOpenChange(next);
  };

  const save = () => {
    if (!canSave) return;

    if (isCreate) {
      /* Crear un Contact nuevo y persistirlo en createdContactsStorage. */
      const edits = formToEdits(form);
      const universe = [...MOCK_CONTACTS, ...loadImportedContacts(), ...loadCreatedContacts()];
      const reference = nextContactReference(universe);
      const displayName = form.kind === "individual"
        ? form.name.trim()
        : form.companyName.trim();
      const id = generateContactId(displayName);
      const todayHuman = new Date().toLocaleDateString("es-ES", {
        day: "numeric", month: "short", year: "numeric",
      });
      const newContact: Contact = {
        id,
        reference,
        kind: form.kind,
        companyName: edits.companyName,
        tradeName: edits.tradeName,
        companyTaxId: edits.companyTaxId,
        name: displayName,
        flag: edits.flag,
        nationality: edits.nationality,
        email: edits.email,
        phone: edits.phone,
        tags: [],
        source: edits.source ?? "Direct",
        sourceType: "direct",
        status: "active",
        lastActivity: "Hoy",
        firstSeen: todayHuman,
        activeOpportunities: 0,
        hasUpcomingVisit: false,
        hasVisitDone: false,
        hasRecentWebActivity: false,
        totalRegistrations: 0,
        promotionsOfInterest: [],
        assignedTo: [],
        languages: edits.languages,
        notes: edits.notes,
      };
      saveCreatedContact(newContact);
      /* Persistimos también los detalles editados (multi-tlf, multi-email,
       * dirección, etc) sobre el contacto recién creado para que la
       * ficha los muestre todos. */
      saveContactEdits(id, edits);
      recordContactCreated(id, { name: user.name, email: user.email });
      onCreated?.(newContact);
      onOpenChange(false);
      toast.success("Contacto creado");
      return;
    }

    /* Modo edición */
    const newEdits = formToEdits(form);
    /* Diff: detectamos qué campos cambiaron de form a initial. */
    const changed: string[] = [];
    if (form.name !== initial.name) changed.push("nombre");
    if (form.kind !== initial.kind) changed.push("tipo de cliente");
    if (form.companyName !== initial.companyName) changed.push("razón social");
    if (form.tradeName !== initial.tradeName) changed.push("nombre comercial");
    if (form.companyTaxId !== initial.companyTaxId) changed.push("CIF/NIF");
    if (form.nif !== initial.nif) changed.push("NIF");
    if (form.birthDate !== initial.birthDate) changed.push("fecha de nacimiento");
    if (form.nationality !== initial.nationality) changed.push("nacionalidad");
    if (form.address !== initial.address) changed.push("dirección");
    if (form.source !== initial.source) changed.push("origen");
    if (form.notes !== initial.notes) changed.push("notas");
    if (JSON.stringify(form.languages) !== JSON.stringify(initial.languages)) changed.push("idiomas");
    if (JSON.stringify(form.phones) !== JSON.stringify(initial.phones)) changed.push("teléfonos");
    if (JSON.stringify(form.emails) !== JSON.stringify(initial.emails)) changed.push("emails");

    saveContactEdits(detail!.id, newEdits);
    if (changed.length > 0) {
      recordContactEdited(detail!.id, { name: user.name, email: user.email }, changed);
    }
    setInitial(form);
    onSaved();
    onOpenChange(false);
    toast.success("Contacto actualizado");
  };

  /* ── Phones CRUD ── */
  const addPhone = () => set({
    phones: [...form.phones, {
      id: `p-new-${Date.now()}`,
      number: "",
      label: "Móvil",
      primary: false,
      hasWhatsapp: false,
    }],
  });
  const updatePhone = (idx: number, patch: Partial<ContactPhone>) =>
    set({ phones: form.phones.map((p, i) => i === idx ? { ...p, ...patch } : p) });
  const setPhonePrimary = (idx: number) =>
    set({ phones: form.phones.map((p, i) => ({ ...p, primary: i === idx })) });
  const removePhone = (idx: number) => {
    const next = form.phones.filter((_, i) => i !== idx);
    if (form.phones[idx]?.primary && next[0]) next[0] = { ...next[0], primary: true };
    set({ phones: next });
  };

  /* ── Emails CRUD ── */
  const addEmail = () => set({
    emails: [...form.emails, {
      id: `e-new-${Date.now()}`,
      address: "",
      label: "Personal",
      primary: false,
    }],
  });
  const updateEmail = (idx: number, patch: Partial<ContactEmailAddress>) =>
    set({ emails: form.emails.map((e, i) => i === idx ? { ...e, ...patch } : e) });
  const setEmailPrimary = (idx: number) =>
    set({ emails: form.emails.map((e, i) => ({ ...e, primary: i === idx })) });
  const removeEmail = (idx: number) => {
    const next = form.emails.filter((_, i) => i !== idx);
    if (form.emails[idx]?.primary && next[0]) next[0] = { ...next[0], primary: true };
    set({ emails: next });
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-w-xl bg-card border-border/40 p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">
            {isCreate ? "Nuevo contacto" : "Editar contacto"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Cambios visibles inmediatamente en la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">

          {/* Tipo cliente */}
          <Segmented
            value={form.kind}
            options={[
              { value: "individual", label: "Particular" },
              { value: "company",    label: "Empresa" },
            ]}
            onChange={(v) => set({ kind: v as ContactKind })}
          />

          {/* Datos según tipo */}
          {form.kind === "individual" ? (
            <>
              <Field label="Nombre completo" required>
                <Input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ej. María González Pérez"
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="NIF / DNI">
                  <Input value={form.nif} onChange={(e) => set({ nif: e.target.value })} placeholder="00000000A" />
                </Field>
                <Field label="Fecha de nacimiento">
                  <Input type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Razón social" required hint="Nombre legal en escrituras y facturas.">
                <Input
                  value={form.companyName}
                  onChange={(e) => set({ companyName: e.target.value })}
                  placeholder="Ej. Inmobiliaria Costa Sol S.L."
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre comercial" hint="El que conoce el cliente.">
                  <Input
                    value={form.tradeName}
                    onChange={(e) => set({ tradeName: e.target.value })}
                    placeholder="Ej. Costa Sol Living"
                  />
                </Field>
                <Field label="CIF / NIF">
                  <Input value={form.companyTaxId} onChange={(e) => set({ companyTaxId: e.target.value })} placeholder="B12345678" />
                </Field>
              </div>
            </>
          )}

          {/* Nacionalidad + idiomas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nacionalidad">
              <NationalityPicker
                nationality={form.nationality}
                flag={form.flag}
                onChange={(name, flag) => set({ nationality: name, flag })}
              />
            </Field>
            <Field label="Idiomas">
              <LanguagesPicker
                selected={form.languages}
                onToggle={(c) => set({
                  languages: form.languages.includes(c)
                    ? form.languages.filter((x) => x !== c)
                    : [...form.languages, c],
                })}
                onRemove={(c) => set({ languages: form.languages.filter((x) => x !== c) })}
              />
            </Field>
          </div>

          {/* Teléfonos */}
          <div>
            <SectionHeader
              title="Teléfonos"
              hint="Marca uno como principal con la estrella."
              action={<AddButton onClick={addPhone} label="Añadir teléfono" />}
            />
            <div className="space-y-2">
              {form.phones.map((p, i) => (
                <PhoneRow
                  key={p.id}
                  phone={p}
                  canDelete={form.phones.length > 1}
                  onUpdate={(patch) => updatePhone(i, patch)}
                  onPrimary={() => setPhonePrimary(i)}
                  onRemove={() => removePhone(i)}
                />
              ))}
            </div>
          </div>

          {/* Emails */}
          <div>
            <SectionHeader
              title="Emails"
              hint="Marca uno como principal con la estrella."
              action={<AddButton onClick={addEmail} label="Añadir email" />}
            />
            <div className="space-y-2">
              {form.emails.map((e, i) => (
                <EmailRow
                  key={e.id}
                  email={e}
                  canDelete={form.emails.length > 1}
                  onUpdate={(patch) => updateEmail(i, patch)}
                  onPrimary={() => setEmailPrimary(i)}
                  onRemove={() => removeEmail(i)}
                />
              ))}
            </div>
          </div>

          {/* Dirección */}
          <Field label="Dirección" hint="Una sola línea (calle, ciudad, CP).">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              {/* TODO(backend): Google Places Autocomplete API. */}
              <Input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="Calle Mayor 12, 29600 Marbella"
                className="pl-9"
              />
            </div>
          </Field>

          {/* Origen */}
          <Field label="Origen del contacto">
            <SourceSelect value={form.source} options={sources} onChange={(v) => set({ source: v })} />
          </Field>

          {/* Notas */}
          <Field label="Notas internas" hint="Visibles solo para el equipo.">
            <textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Cualquier dato que no encaje en los campos anteriores…"
              rows={4}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
            />
          </Field>
        </div>

        <DialogFooter className="px-5 sm:px-6 py-3.5 border-t border-border/40 bg-card flex-row sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => requestClose(false)} className="rounded-full">
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!canSave} className="rounded-full">
            <Save className="h-3.5 w-3.5" /> {isCreate ? "Crear contacto" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FILAS · teléfono y email simplificados
   ══════════════════════════════════════════════════════════════════ */

function PhoneRow({
  phone, canDelete, onUpdate, onPrimary, onRemove,
}: {
  phone: ContactPhone;
  canDelete: boolean;
  onUpdate: (p: Partial<ContactPhone>) => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 min-w-0">
        <PhoneInput value={phone.number} onChange={(v) => onUpdate({ number: v })} />
      </div>
      <IconToggle
        icon={Star}
        active={!!phone.primary}
        onClick={onPrimary}
        activeClass="bg-foreground text-background border-foreground"
        title={phone.primary ? "Principal" : "Marcar como principal"}
        fillWhenActive
      />
      {canDelete && (
        <IconButton icon={Trash2} onClick={onRemove} title="Eliminar" destructive />
      )}
    </div>
  );
}

function EmailRow({
  email, canDelete, onUpdate, onPrimary, onRemove,
}: {
  email: ContactEmailAddress;
  canDelete: boolean;
  onUpdate: (p: Partial<ContactEmailAddress>) => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="email"
        value={email.address}
        onChange={(e) => onUpdate({ address: e.target.value })}
        placeholder="cliente@ejemplo.com"
        className="flex-1 min-w-0"
      />
      <IconToggle
        icon={Star}
        active={!!email.primary}
        onClick={onPrimary}
        activeClass="bg-foreground text-background border-foreground"
        title={email.primary ? "Principal" : "Marcar como principal"}
        fillWhenActive
      />
      {canDelete && (
        <IconButton icon={Trash2} onClick={onRemove} title="Eliminar" destructive />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PRIMITIVOS COMPARTIDOS
   ══════════════════════════════════════════════════════════════════ */

function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-2">
      <div>
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
    >
      <Plus className="h-3 w-3" /> {label}
    </button>
  );
}

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-foreground inline-flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Segmented({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-muted/40 rounded-full p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 px-4 rounded-full text-xs font-medium transition-colors",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function IconToggle({
  icon: Icon, active, onClick, activeClass, title, fillWhenActive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  activeClass: string;
  title: string;
  fillWhenActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 w-9 rounded-xl border grid place-items-center transition-colors shrink-0",
        active ? activeClass : "bg-card text-muted-foreground border-border hover:text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && fillWhenActive && "fill-current")} />
    </button>
  );
}

function IconButton({
  icon: Icon, onClick, title, destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  title: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 w-9 rounded-xl grid place-items-center transition-colors shrink-0",
        destructive
          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function SourceSelect({
  value, options, onChange,
}: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary flex items-center justify-between gap-2"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Selecciona origen…"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden"
      >
        <div className="border-b border-border/60 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar origen…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-[220px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin coincidencias.</p>
          ) : filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                value === o ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/40",
              )}
            >
              <span className="truncate">{o}</span>
              {value === o && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NationalityPicker({
  nationality, flag, onChange,
}: {
  nationality: string;
  flag: string;
  onChange: (name: string, flag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary flex items-center gap-2"
        >
          {nationality ? (
            <>
              {flag && <span className="text-base leading-none shrink-0">{flag}</span>}
              <span className="flex-1 truncate text-left text-foreground">{nationality}</span>
            </>
          ) : (
            <span className="flex-1 text-left text-muted-foreground">Selecciona país…</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden"
      >
        <div className="border-b border-border/60 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar país…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin coincidencias</p>
          ) : filtered.map((c) => {
            const isSelected = nationality === c.name;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => { onChange(c.name, c.flag); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                  isSelected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/40",
                )}
              >
                <span className="text-base leading-none shrink-0">{c.flag}</span>
                <span className="flex-1 text-xs truncate">{c.name}</span>
                {isSelected && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LanguagesPicker({
  selected, onToggle, onRemove,
}: { selected: string[]; onToggle: (code: string) => void; onRemove: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-9 px-2 py-1 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary flex items-center gap-1.5 flex-wrap"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">Selecciona idiomas…</span>
          ) : selected.map((code) => {
            const lang = findLanguageByCode(code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full pl-1.5 pr-1 py-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm leading-none">{lang?.flag ?? "🏳️"}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(code); }}
                  className="h-3.5 w-3.5 rounded-full grid place-items-center text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="w-[--radix-popover-trigger-width] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden"
      >
        <div className="border-b border-border/60 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar idioma…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin coincidencias</p>
          ) : filtered.map((l) => {
            const isSelected = selected.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => onToggle(l.code)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                  isSelected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/40",
                )}
              >
                <span className="text-base leading-none shrink-0">{l.flag}</span>
                <span className="flex-1 text-xs truncate">{l.name}</span>
                {isSelected && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
