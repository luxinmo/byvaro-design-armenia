/**
 * /empresa/datos · datos maestros de la empresa (tenant).
 *
 * Secciones:
 *   1. Identidad fiscal (nombre comercial, razón social, CIF, logo,
 *      color corporativo)
 *   2. Contacto público (email, teléfono, web, LinkedIn, descripción)
 *   3. Dirección fiscal (país, provincia, ciudad, dirección, CP)
 *   4. Preferencias (moneda, idioma por defecto, zona horaria)
 *
 * Auto-guardado: cada cambio persiste en localStorage vía useEmpresa.
 * Onboarding: banner rojo/amber si faltan datos clave (nombre, razón
 * social, CIF).
 */

import { useState, useRef } from "react";
import {
  Building2, AlertCircle, Upload, Palette,
  Mail, Phone, Globe as GlobeIcon, Linkedin, FileText,
  MapPin, Coins, Languages, Clock, Image as ImageIcon, X,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useEmpresa, isValidCifBasico } from "@/lib/empresa";
import { cn } from "@/lib/utils";

/* ─── UI helpers ──────────────────────────────────────────────────── */
const inputClass = "h-10 w-full px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight leading-tight">{title}</h2>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  );
}

function Field({
  label, required, error, hint, children,
}: {
  label: string; required?: boolean; error?: string | false; hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {error && <span className="text-[11px] text-destructive font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</span>}
      {hint && !error && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Página
   ═══════════════════════════════════════════════════════════════════ */
export default function EmpresaDatos() {
  const { empresa, update, patch } = useEmpresa();
  const [cifTouched, setCifTouched] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const cifError = cifTouched && empresa.cif && !isValidCifBasico(empresa.cif)
    ? "Formato inválido. Ej. B12345674"
    : false;

  const handleLogoUpload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo no puede superar 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update("logoUrl", reader.result as string);
      toast.success("Logo actualizado");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!empresa.nombreComercial.trim()) {
      toast.error("El nombre comercial es obligatorio");
      return;
    }
    toast.success("Datos guardados", { description: "Tu empresa está actualizada." });
  };

  return (
    <div className="flex flex-col gap-5">
      <Toaster position="top-center" richColors />

      {/* ═════ Subcabecera con botón Guardar ═════ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">Datos de empresa</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Identidad fiscal, contacto público y preferencias. Se guardan automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-soft shrink-0"
        >
          Guardar cambios
        </button>
      </div>

      {/* ═════ Banner onboarding ═════ */}
      {!empresa.onboardingCompleto && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-500 shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 text-[12.5px] leading-relaxed">
            <p className="font-semibold text-foreground">Completa los datos de tu empresa</p>
            <p className="text-muted-foreground mt-0.5">
              Nombre comercial, razón social y CIF son imprescindibles para emitir contratos y compartir tus promociones con agencias. Sin esto no podrás publicar en modo oficial.
            </p>
          </div>
        </div>
      )}

      {/* ═════ Identidad ═════ */}
      <Section
        icon={Building2}
        title="Identidad"
        description="Cómo apareces frente a clientes y agencias, y los datos fiscales que te identifican."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre comercial" required hint="El que aparece en tus microsites y materiales comerciales.">
            <input
              type="text"
              value={empresa.nombreComercial}
              onChange={(e) => update("nombreComercial", e.target.value)}
              placeholder="Ej. Luxinmo Real Estate"
              className={inputClass}
            />
          </Field>
          <Field label="Razón social" required hint="Denominación legal completa (SL, SA, etc.).">
            <input
              type="text"
              value={empresa.razonSocial}
              onChange={(e) => update("razonSocial", e.target.value)}
              placeholder="Ej. Luxinmo Real Estate S.L."
              className={inputClass}
            />
          </Field>
          <Field label="CIF / NIF" required error={cifError} hint="Formato: letra + 7 dígitos + control (ej. B12345674).">
            <input
              type="text"
              value={empresa.cif}
              onChange={(e) => update("cif", e.target.value.toUpperCase())}
              onBlur={() => setCifTouched(true)}
              placeholder="B12345674"
              className={cn(inputClass, "tracking-wider font-mono", cifError && "border-destructive focus:border-destructive focus:ring-destructive/20")}
              maxLength={9}
            />
          </Field>
          <Field label="Color corporativo" hint="Se usa como color principal en tus microsites públicos.">
            <div className="flex items-center gap-2 h-10 px-3 bg-card border border-border rounded-xl">
              <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="color"
                value={empresa.colorCorporativo}
                onChange={(e) => update("colorCorporativo", e.target.value)}
                className="h-6 w-10 rounded cursor-pointer bg-transparent border border-border"
              />
              <input
                type="text"
                value={empresa.colorCorporativo}
                onChange={(e) => update("colorCorporativo", e.target.value)}
                className="flex-1 text-[13px] font-mono tracking-wider bg-transparent outline-none"
                maxLength={7}
              />
            </div>
          </Field>
        </div>

        {/* Logo */}
        <Field label="Logo" hint="PNG/SVG con fondo transparente recomendado. Máx. 2 MB.">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl shrink-0 overflow-hidden",
              empresa.logoUrl ? "bg-background border border-border" : "bg-muted border-2 border-dashed border-border"
            )}>
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt="Logo" className="max-h-12 max-w-12 object-contain" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-[12px] font-semibold hover:bg-foreground/90 transition-colors"
                >
                  <Upload className="h-3 w-3" />
                  {empresa.logoUrl ? "Cambiar logo" : "Subir logo"}
                </button>
                {empresa.logoUrl && (
                  <button
                    type="button"
                    onClick={() => update("logoUrl", "")}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3" /> Quitar
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </Field>
      </Section>

      {/* ═════ Contacto público ═════ */}
      <Section
        icon={Mail}
        title="Contacto público"
        description="Datos que se muestran a compradores y agencias en tus microsites y correos."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email corporativo">
            <input
              type="email"
              value={empresa.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="hola@tuempresa.com"
              className={inputClass}
            />
          </Field>
          <Field label="Teléfono">
            <input
              type="tel"
              value={empresa.telefono}
              onChange={(e) => update("telefono", e.target.value)}
              placeholder="+34 600 000 000"
              className={inputClass}
            />
          </Field>
          <Field label="Sitio web">
            <input
              type="url"
              value={empresa.sitioWeb}
              onChange={(e) => update("sitioWeb", e.target.value)}
              placeholder="https://tuempresa.com"
              className={inputClass}
            />
          </Field>
          <Field label="LinkedIn">
            <input
              type="url"
              value={empresa.linkedin}
              onChange={(e) => update("linkedin", e.target.value)}
              placeholder="https://linkedin.com/company/…"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Descripción breve" hint="1–2 frases sobre tu empresa. Aparece en la portada de tu microsite.">
          <textarea
            value={empresa.descripcion}
            onChange={(e) => update("descripcion", e.target.value)}
            placeholder="Promotor inmobiliario especializado en viviendas de alto standing en la Costa del Sol."
            rows={3}
            maxLength={300}
            className={cn(inputClass, "h-auto py-2.5 resize-none")}
          />
          <span className="text-[10px] text-muted-foreground self-end tnum">{empresa.descripcion.length}/300</span>
        </Field>
      </Section>

      {/* ═════ Dirección fiscal ═════ */}
      <Section
        icon={MapPin}
        title="Dirección fiscal"
        description="Sede declarada. Aparece en contratos y facturas. No tiene que coincidir con la oficina principal."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="País">
            <input
              type="text"
              value={empresa.direccionFiscal.pais}
              onChange={(e) => patch({ direccionFiscal: { ...empresa.direccionFiscal, pais: e.target.value } })}
              placeholder="España"
              className={inputClass}
            />
          </Field>
          <Field label="Provincia">
            <input
              type="text"
              value={empresa.direccionFiscal.provincia}
              onChange={(e) => patch({ direccionFiscal: { ...empresa.direccionFiscal, provincia: e.target.value } })}
              placeholder="Málaga"
              className={inputClass}
            />
          </Field>
          <Field label="Ciudad">
            <input
              type="text"
              value={empresa.direccionFiscal.ciudad}
              onChange={(e) => patch({ direccionFiscal: { ...empresa.direccionFiscal, ciudad: e.target.value } })}
              placeholder="Marbella"
              className={inputClass}
            />
          </Field>
          <Field label="Código postal">
            <input
              type="text"
              value={empresa.direccionFiscal.codigoPostal}
              onChange={(e) => patch({ direccionFiscal: { ...empresa.direccionFiscal, codigoPostal: e.target.value } })}
              placeholder="29600"
              className={cn(inputClass, "tnum")}
              maxLength={10}
            />
          </Field>
          <Field label="Dirección (calle, número)">
            <input
              type="text"
              value={empresa.direccionFiscal.direccion}
              onChange={(e) => patch({ direccionFiscal: { ...empresa.direccionFiscal, direccion: e.target.value } })}
              placeholder="Av. Ricardo Soriano, 45"
              className={cn(inputClass, "sm:col-span-2")}
            />
          </Field>
        </div>
      </Section>

      {/* ═════ Preferencias ═════ */}
      <Section
        icon={Clock}
        title="Preferencias"
        description="Valores por defecto para formatos de precio, idioma de tus microsites y fechas."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Moneda">
            <div className="flex items-center gap-1 h-10 px-2 bg-card border border-border rounded-xl">
              <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
              <select
                value={empresa.moneda}
                onChange={(e) => update("moneda", e.target.value as typeof empresa.moneda)}
                className="flex-1 h-full bg-transparent text-[13.5px] outline-none cursor-pointer pr-1"
              >
                <option value="EUR">EUR · Euro (€)</option>
                <option value="USD">USD · Dólar ($)</option>
                <option value="GBP">GBP · Libra (£)</option>
              </select>
            </div>
          </Field>
          <Field label="Idioma por defecto">
            <div className="flex items-center gap-1 h-10 px-2 bg-card border border-border rounded-xl">
              <Languages className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
              <select
                value={empresa.idiomaDefault}
                onChange={(e) => update("idiomaDefault", e.target.value as typeof empresa.idiomaDefault)}
                className="flex-1 h-full bg-transparent text-[13.5px] outline-none cursor-pointer pr-1"
              >
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇬🇧 English</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="pt">🇵🇹 Português</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="nl">🇳🇱 Nederlands</option>
                <option value="ar">🇸🇦 العربية</option>
              </select>
            </div>
          </Field>
          <Field label="Zona horaria">
            <div className="flex items-center gap-1 h-10 px-2 bg-card border border-border rounded-xl">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
              <select
                value={empresa.zonaHoraria}
                onChange={(e) => update("zonaHoraria", e.target.value)}
                className="flex-1 h-full bg-transparent text-[13.5px] outline-none cursor-pointer pr-1"
              >
                <option value="Europe/Madrid">Europe/Madrid</option>
                <option value="Europe/Lisbon">Europe/Lisbon</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Atlantic/Canary">Atlantic/Canary</option>
              </select>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  );
}
