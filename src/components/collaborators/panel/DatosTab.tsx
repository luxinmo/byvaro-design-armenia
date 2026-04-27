/**
 * Tab "Datos" del panel de colaboración.
 *
 * Vista READ-ONLY para el promotor · los datos de la agencia los
 * mantiene la propia agencia desde su workspace (Empresa tenant).
 * Aquí se leen vía `useEmpresa(agencyId)` que envuelve el adapter
 * agency → Empresa (`agencyToEmpresa`).
 *
 * Cuatro bloques:
 *   · Identidad       · nombre comercial, razón social, CIF, fundada,
 *                       dirección fiscal (línea única · Google Maps).
 *   · Contacto empresa · email, teléfono, horario, web, idiomas.
 *   · Redes sociales  · LinkedIn, Instagram, Facebook, YouTube, TikTok.
 *   · Contacto asignado · avatar + nombre + cargo + email + tel.
 */

import { useMemo } from "react";
import {
  Building2, MapPin, Mail, Phone, Briefcase, Clock,
  User, Globe, ExternalLink,
  Linkedin, Instagram, Facebook, Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useEmpresa } from "@/lib/empresa";
import { LANGUAGES } from "@/lib/languages";
import { Flag } from "@/components/ui/Flag";
import {
  licenciaLabel, licenciaMeta, isAgencyVerified,
  type LicenciaInmobiliaria,
} from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";

interface Props {
  agency: Agency;
}

export function DatosTab({ agency: a }: Props) {
  const { empresa } = useEmpresa(a.id);
  const verified = isAgencyVerified(getAgencyLicenses(a));

  /* Dirección fiscal en una sola línea · cuando Google Maps Autocomplete
     devuelva la string formateada, esta función se reduce a retornarla. */
  const fullAddress = useMemo(() => {
    const d = empresa.direccionFiscal;
    if (!d) return "";
    if (d.direccion?.trim()) return [d.direccion, d.codigoPostal, d.ciudad, d.provincia, d.pais].filter(Boolean).join(", ");
    return [d.codigoPostal, d.ciudad, d.provincia, d.pais].filter(Boolean).join(", ");
  }, [empresa.direccionFiscal]);

  const hasAnySocial = !!(empresa.linkedin || empresa.instagram || empresa.facebook || empresa.youtube || empresa.tiktok);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="min-w-0 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ficha operativa
          </p>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground mt-0.5">
            Datos de la agencia
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Los mantiene la propia agencia desde su panel · usados en contratos y facturación.
          </p>
        </div>
        {verified && <VerifiedBadge size="md" />}
      </div>


      {/* ══ Identidad ══ */}
      <Section icon={Building2} title="Identidad de empresa">
        <DataGrid>
          <DataField label="Nombre comercial" value={empresa.nombreComercial || a.name} />
          <DataField label="Razón social" value={empresa.razonSocial} />
          <DataField label="CIF"          value={empresa.cif} mono />
          <DataField label="Fundada en"   value={empresa.fundadaEn} />
          <DataField
            label="Dirección fiscal"
            value={fullAddress || undefined}
            icon={MapPin}
            wide
            link={
              fullAddress
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
                : undefined
            }
            linkLabel="Abrir en Google Maps"
          />
        </DataGrid>

        {/* Licencias · compactas, una línea por licencia */}
        {(() => {
          const licencias = getAgencyLicenses(a);
          return licencias.length > 0 ? (
            <div className="mt-5 pt-4 border-t border-border/50">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                Licencias inmobiliarias
              </p>
              <ul className="space-y-1">
                {licencias.map((l, i) => <LicenseLine key={`${l.tipo}-${l.numero}-${i}`} licencia={l} />)}
              </ul>
            </div>
          ) : null;
        })()}
      </Section>

      {/* ══ Contacto empresa ══ */}
      <Section icon={Mail} title="Contacto">
        <DataGrid>
          <DataField
            label="Email"
            value={empresa.email}
            icon={Mail}
            link={empresa.email ? `mailto:${empresa.email}` : undefined}
          />
          <DataField
            label="Teléfono"
            value={empresa.telefono}
            icon={Phone}
            link={empresa.telefono ? `tel:${empresa.telefono.replace(/\s/g, "")}` : undefined}
          />
          <DataField
            label="Web"
            value={empresa.sitioWeb}
            icon={Globe}
            link={empresa.sitioWeb ? `https://${empresa.sitioWeb.replace(/^https?:\/\//, "")}` : undefined}
          />
          <DataField label="Horario" value={empresa.horario} icon={Clock} wide />
        </DataGrid>

        {empresa.idiomasAtencion && empresa.idiomasAtencion.length > 0 && (
          <div className="mt-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
              Idiomas de atención
            </p>
            <div className="flex flex-wrap gap-1.5">
              {empresa.idiomasAtencion.map((code) => <LanguageChip key={code} code={code} />)}
            </div>
          </div>
        )}
      </Section>

      {/* ══ Redes sociales ══ */}
      {hasAnySocial && (
        <Section icon={Linkedin} title="Redes sociales">
          <div className="flex flex-wrap gap-2">
            <SocialLink icon={Linkedin}  label="LinkedIn"  href={empresa.linkedin} />
            <SocialLink icon={Instagram} label="Instagram" href={empresa.instagram} />
            <SocialLink icon={Facebook}  label="Facebook"  href={empresa.facebook} />
            <SocialLink icon={Youtube}   label="YouTube"   href={empresa.youtube} />
            <SocialLink icon={TikTokIcon} label="TikTok"   href={empresa.tiktok} />
          </div>
        </Section>
      )}

      {/* ══ Contacto asignado ══ */}
      <Section icon={User} title="Contacto asignado">
        <AssignedContact agency={a} empresaIdiomas={empresa.idiomasAtencion ?? []} />
      </Section>
    </div>
  );
}

/* ═══════════════ Sub-componentes ═══════════════ */

/** `<VerifiedBadge>` vive en `@/components/ui/VerifiedBadge` para que
 *  no dependa del layout del panel. Re-export por compatibilidad
 *  mientras actualizamos los call sites. */
export { VerifiedBadge } from "@/components/ui/VerifiedBadge";

function LicenseLine({ licencia: l }: { licencia: LicenciaInmobiliaria }) {
  const meta = licenciaMeta(l);
  const label = licenciaLabel(l);
  const publicUrl = l.publicUrl ?? meta?.autoridadUrl;
  const content = (
    <div className="flex items-center gap-2 flex-wrap text-[12.5px]">
      <span className="font-bold text-foreground">{label}</span>
      {meta?.ambito && (
        <span className="text-[10.5px] text-muted-foreground">{meta.ambito}</span>
      )}
      <span className="font-mono tabular-nums tracking-tight text-foreground">
        {l.numero}
      </span>
      {l.verificada && (
        <span title="Verificada por Byvaro">
          <VerifiedBadge size="sm" />
        </span>
      )}
      {publicUrl && (
        <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" strokeWidth={1.75} />
      )}
    </div>
  );
  return (
    <li>
      {publicUrl ? (
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center hover:underline"
          title={meta?.nombreCompleto}
        >
          {content}
        </a>
      ) : (
        <div title={meta?.nombreCompleto}>{content}</div>
      )}
    </li>
  );
}

export function Section({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className="px-4 sm:px-5 py-3 border-b border-border/50 flex items-center gap-2.5">
        <span className="h-7 w-7 rounded-lg bg-muted/60 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
      </header>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  );
}

export function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
      {children}
    </dl>
  );
}

export function DataField({
  label, value, mono, wide, link, linkLabel, icon: Icon,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  wide?: boolean;
  link?: string;
  linkLabel?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const empty = !value || !value.trim();
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 md:col-span-3")}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn(
        "mt-1 text-[13px] break-words flex items-start gap-1.5",
        mono && "font-mono tabular-nums tracking-tight",
        empty ? "text-muted-foreground/60 italic" : "text-foreground",
      )}>
        {Icon && !empty && <Icon className="h-3.5 w-3.5 text-muted-foreground/70 mt-0.5 shrink-0" strokeWidth={1.75} />}
        {empty ? "—" : (
          link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              title={linkLabel}
            >
              {value}
            </a>
          ) : <span>{value}</span>
        )}
      </dd>
    </div>
  );
}

function LanguageChip({ code }: { code: string }) {
  const lang = LANGUAGES.find(
    (l) => l.code.toLowerCase() === code.toLowerCase() || l.countryIso.toLowerCase() === code.toLowerCase(),
  );
  if (!lang) {
    return (
      <span className="inline-flex items-center h-6 px-2 rounded-full bg-muted/60 text-[11px] font-medium text-muted-foreground">
        {code.toUpperCase()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full bg-muted/60 text-[11px] font-medium text-foreground">
      <Flag iso={lang.countryIso} size={14} shape="rect" />
      {lang.name}
    </span>
  );
}

function SocialLink({
  icon: Icon, label, href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
}) {
  if (!href || !href.trim()) return null;
  const url = href.startsWith("http") ? href : `https://${href.replace(/^\/\//, "")}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 h-9 pl-2 pr-3.5 rounded-full border border-border bg-card hover:bg-muted transition-colors group"
    >
      <span className="h-6 w-6 rounded-full bg-muted/60 grid place-items-center shrink-0 group-hover:bg-foreground/10">
        <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" strokeWidth={1.75} />
      </span>
      <span className="text-[12.5px] font-medium text-foreground">{label}</span>
    </a>
  );
}

function TikTokIcon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  /* TikTok no está en lucide-react · SVG mínimo con el estilo del resto. */
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 12v6a3 3 0 1 0 3 3V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function AssignedContact({
  agency: a,
  empresaIdiomas,
}: {
  agency: Agency;
  empresaIdiomas: string[];
}) {
  const cp = a.contactoPrincipal;
  if (!cp?.nombre) {
    return (
      <p className="text-[12px] text-muted-foreground/80 italic">
        La agencia aún no ha asignado un contacto responsable para tu cuenta.
      </p>
    );
  }
  /* Prioridad · lenguas que habla ESTA persona > idiomas que atiende la
     empresa como fallback. */
  const idiomasPersona = cp.idiomas && cp.idiomas.length > 0 ? cp.idiomas : empresaIdiomas;
  const fuenteEsPersonal = !!(cp.idiomas && cp.idiomas.length > 0);
  const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cp.nombre)}&backgroundType=gradientLinear`;
  return (
    <div className="flex items-start gap-4">
      <img
        src={avatarUrl}
        alt={cp.nombre}
        className="h-14 w-14 rounded-full shrink-0 border border-border bg-muted"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{cp.nombre}</p>
        {cp.rol && (
          <p className="text-[12px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
            <Briefcase className="h-3 w-3" strokeWidth={1.75} />
            {cp.rol}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-1">
          {cp.email && (
            <a
              href={`mailto:${cp.email}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground hover:underline"
            >
              <Mail className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
              {cp.email}
            </a>
          )}
          {cp.telefono && (
            <a
              href={`tel:${cp.telefono.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground hover:underline"
            >
              <Phone className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
              {cp.telefono}
            </a>
          )}
        </div>
        {idiomasPersona.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
              Habla
              {!fuenteEsPersonal && (
                <span className="normal-case text-muted-foreground/70 tracking-normal ml-1">
                  · según idiomas de la agencia
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {idiomasPersona.slice(0, 6).map((code) => <LanguageChip key={code} code={code} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
