/**
 * Tab "Datos" del panel de colaboración.
 *
 * Ficha operativa del promotor sobre la agencia: identidad legal,
 * dirección fiscal, contacto principal y responsable de firma de
 * contratos. Son los datos que el promotor necesita para emitir
 * contratos y facturar comisiones.
 *
 * Mock · storage local (`agencyProfile.ts`). Al conectar backend:
 *   GET/PATCH /api/agencias/:id/profile.
 */

import { useMemo, useState } from "react";
import {
  Building2, Pencil, MapPin, Mail, Phone, IdCard, Briefcase,
  User, ShieldCheck, Globe, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useAgencyProfile, mergeAgencyProfile, type AgencyProfile } from "@/lib/agencyProfile";

interface Props {
  agency: Agency;
}

export function DatosTab({ agency: a }: Props) {
  const [stored, save] = useAgencyProfile(a.id);
  const profile = useMemo(() => mergeAgencyProfile(stored, a), [stored, a]);

  const [editOpen, setEditOpen] = useState(false);

  const lastUpdate = stored.updatedAt
    ? new Date(stored.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="space-y-5">
      {/* ══ Header del tab ══ */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ficha operativa
          </p>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground mt-0.5">
            Datos de la agencia
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            {lastUpdate
              ? `Actualizado el ${lastUpdate} · usado en contratos y facturación.`
              : "Completa los datos para que contratos y facturas salgan correctos."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 transition-colors shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          Editar datos
        </button>
      </div>

      {/* ══ Identidad legal ══ */}
      <Section
        icon={Building2}
        title="Identidad de empresa"
        subtitle="Qué figura en contratos y en el registro mercantil"
      >
        <DataGrid>
          <DataField label="Nombre comercial" value={profile.nombreComercial} />
          <DataField label="Razón social"     value={profile.razonSocial} />
          <DataField label="CIF" value={profile.cif} mono />
          <DataField label="Web" value={profile.web} link={profile.web ? `https://${profile.web.replace(/^https?:\/\//, "")}` : undefined} />
        </DataGrid>
      </Section>

      {/* ══ Dirección fiscal ══ */}
      <Section
        icon={MapPin}
        title="Dirección fiscal"
        subtitle="La que irá en contratos y facturas"
      >
        <DataGrid>
          <DataField label="Calle"         value={profile.direccionFiscal?.calle} wide />
          <DataField label="Código postal" value={profile.direccionFiscal?.codigoPostal} mono />
          <DataField label="Ciudad"        value={profile.direccionFiscal?.ciudad} />
          <DataField label="Provincia"     value={profile.direccionFiscal?.provincia} />
          <DataField label="País"          value={profile.direccionFiscal?.pais} />
        </DataGrid>
      </Section>

      {/* ══ Contactos ══ */}
      <Section
        icon={User}
        title="Contactos"
        subtitle="Persona de contacto principal y firmante legal"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ContactCard
            role="Contacto principal"
            icon={User}
            nombre={profile.contactoPrincipal?.nombre}
            cargo={profile.contactoPrincipal?.rol}
            email={profile.contactoPrincipal?.email}
            telefono={profile.contactoPrincipal?.telefono}
          />
          <ContactCard
            role="Firmante de contratos"
            icon={ShieldCheck}
            nombre={profile.firmante?.nombre}
            cargo={profile.firmante?.cargo}
            nif={profile.firmante?.nif}
            email={profile.firmante?.email}
            telefono={profile.firmante?.telefono}
          />
        </div>
      </Section>

      {/* ══ Dialog de edición ══ */}
      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={stored}
        onSave={(p) => {
          save(p);
          toast.success("Datos guardados");
          setEditOpen(false);
        }}
      />
    </div>
  );
}

/* ═══════════════ Sub-componentes ═══════════════ */

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-border/50 flex items-center gap-2.5">
        <span className="h-7 w-7 rounded-lg bg-muted/60 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
      {children}
    </dl>
  );
}

function DataField({
  label, value, mono, wide, link,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  wide?: boolean;
  link?: string;
}) {
  const empty = !value || value.trim() === "";
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn(
        "mt-1 text-[13px] break-words",
        mono && "font-mono tabular-nums tracking-tight",
        empty ? "text-muted-foreground/60 italic" : "text-foreground",
      )}>
        {empty ? "—" : (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {value}
            </a>
          ) : value
        )}
      </dd>
    </div>
  );
}

function ContactCard({
  role, icon: Icon, nombre, cargo, nif, email, telefono,
}: {
  role: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  nombre?: string;
  cargo?: string;
  nif?: string;
  email?: string;
  telefono?: string;
}) {
  const empty = !nombre && !email && !telefono && !cargo && !nif;
  return (
    <div className={cn(
      "rounded-xl border p-3.5",
      empty ? "border-dashed border-border bg-muted/10" : "border-border bg-card",
    )}>
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg bg-muted/60 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {role}
        </p>
      </div>
      {empty ? (
        <p className="text-[12px] text-muted-foreground/70 italic mt-2">
          Sin datos · usa "Editar datos".
        </p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{nombre ?? "—"}</p>
          {cargo && <p className="text-[11.5px] text-muted-foreground">{cargo}</p>}
          {nif && (
            <p className="text-[11.5px] text-muted-foreground font-mono tabular-nums inline-flex items-center gap-1.5">
              <IdCard className="h-3 w-3" strokeWidth={1.75} />
              {nif}
            </p>
          )}
          {email && (
            <a href={`mailto:${email}`} className="text-[12px] text-foreground hover:underline inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
              {email}
            </a>
          )}
          {telefono && (
            <a href={`tel:${telefono}`} className="text-[12px] text-foreground hover:underline inline-flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
              {telefono}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Dialog de edición ═══════════════ */

function EditDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: AgencyProfile;
  onSave: (p: AgencyProfile) => void;
}) {
  const [form, setForm] = useState<AgencyProfile>(initial);

  const patch = (p: Partial<AgencyProfile>) => setForm((prev) => ({ ...prev, ...p }));
  const patchFiscal = (p: Partial<NonNullable<AgencyProfile["direccionFiscal"]>>) =>
    setForm((prev) => ({ ...prev, direccionFiscal: { ...prev.direccionFiscal, ...p } }));
  const patchContacto = (p: Partial<NonNullable<AgencyProfile["contactoPrincipal"]>>) =>
    setForm((prev) => ({ ...prev, contactoPrincipal: { ...prev.contactoPrincipal, ...p } }));
  const patchFirmante = (p: Partial<NonNullable<AgencyProfile["firmante"]>>) =>
    setForm((prev) => ({ ...prev, firmante: { ...prev.firmante, ...p } }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm(initial); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col sm:rounded-3xl">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 pr-12 sm:pr-14 border-b border-border/60">
          <DialogTitle className="text-base sm:text-lg font-semibold">Editar datos de la agencia</DialogTitle>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Se usarán en contratos y facturación.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Identidad */}
          <FormSection icon={Building2} title="Identidad de empresa">
            <FieldGrid>
              <Field label="Nombre comercial" value={form.nombreComercial} onChange={(v) => patch({ nombreComercial: v })} />
              <Field label="Razón social"     value={form.razonSocial}     onChange={(v) => patch({ razonSocial: v })} />
              <Field label="CIF"              value={form.cif}             onChange={(v) => patch({ cif: v })} mono placeholder="A12345678" />
              <Field label="Web"              value={form.web}             onChange={(v) => patch({ web: v })} placeholder="primeproperties.com" icon={Globe} />
            </FieldGrid>
          </FormSection>

          {/* Dirección fiscal */}
          <FormSection icon={MapPin} title="Dirección fiscal">
            <FieldGrid>
              <Field label="Calle"         value={form.direccionFiscal?.calle}        onChange={(v) => patchFiscal({ calle: v })} wide />
              <Field label="Código postal" value={form.direccionFiscal?.codigoPostal} onChange={(v) => patchFiscal({ codigoPostal: v })} mono />
              <Field label="Ciudad"        value={form.direccionFiscal?.ciudad}       onChange={(v) => patchFiscal({ ciudad: v })} />
              <Field label="Provincia"     value={form.direccionFiscal?.provincia}    onChange={(v) => patchFiscal({ provincia: v })} />
              <Field label="País"          value={form.direccionFiscal?.pais}         onChange={(v) => patchFiscal({ pais: v })} />
            </FieldGrid>
          </FormSection>

          {/* Contacto principal */}
          <FormSection icon={User} title="Contacto principal · día a día">
            <FieldGrid>
              <Field label="Nombre"   value={form.contactoPrincipal?.nombre}   onChange={(v) => patchContacto({ nombre: v })} />
              <Field label="Cargo"    value={form.contactoPrincipal?.rol}      onChange={(v) => patchContacto({ rol: v })} icon={Briefcase} />
              <Field label="Email"    value={form.contactoPrincipal?.email}    onChange={(v) => patchContacto({ email: v })} type="email" icon={Mail} />
              <Field label="Teléfono" value={form.contactoPrincipal?.telefono} onChange={(v) => patchContacto({ telefono: v })} icon={Phone} />
            </FieldGrid>
          </FormSection>

          {/* Firmante */}
          <FormSection
            icon={ShieldCheck}
            title="Firmante de contratos"
            subtitle="Persona con capacidad legal de firma en la agencia · va a los contratos de Firmafy"
          >
            <FieldGrid>
              <Field label="Nombre"   value={form.firmante?.nombre}   onChange={(v) => patchFirmante({ nombre: v })} />
              <Field label="Cargo"    value={form.firmante?.cargo}    onChange={(v) => patchFirmante({ cargo: v })} icon={Briefcase} placeholder="Administrador, Apoderado…" />
              <Field label="NIF"      value={form.firmante?.nif}      onChange={(v) => patchFirmante({ nif: v })} mono icon={IdCard} />
              <Field label="Email"    value={form.firmante?.email}    onChange={(v) => patchFirmante({ email: v })} type="email" icon={Mail} />
              <Field label="Teléfono" value={form.firmante?.telefono} onChange={(v) => patchFirmante({ telefono: v })} icon={Phone} />
            </FieldGrid>
          </FormSection>
        </div>

        <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/10">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
            Guardar cambios
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg bg-muted/60 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", mono, wide, icon: Icon,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  wide?: boolean;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        {Icon && (
          <Icon className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
        )}
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20",
            Icon ? "pl-8 pr-3" : "px-3",
            mono && "font-mono tabular-nums tracking-tight",
          )}
        />
      </div>
    </div>
  );
}
