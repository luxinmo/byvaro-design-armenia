/**
 * PriceListDialog · exportación de listado de precios personalizado.
 *
 * Qué hace:
 *   Abre un modal con dos paneles:
 *     1. **Preview** (izquierda): documento A4 vertical con el branding
 *        del promotor (logo + nombre + color corporativo), foto grande
 *        de la promoción, ficha de datos clave, tabla de unidades con
 *        precios y pie con fecha + datos de contacto.
 *     2. **Opciones** (derecha): filtros sobre qué incluir — unidades
 *        disponibles, reservadas o vendidas, mostrar comisión para la
 *        versión agencia, incluir QR del microsite, idioma.
 *
 *   La descarga real utiliza `window.print()` sobre un contenedor
 *   `id="price-list-printable"` y un bloque CSS `@media print` en
 *   `src/index.css` que oculta todo lo demás. El navegador ofrece
 *   "Guardar como PDF" nativo — evitamos añadir jspdf/html2canvas
 *   (librerías pesadas) manteniendo el output en calidad vectorial.
 *
 * Datos:
 *   - `empresa` vía `useEmpresa()` → logoUrl, nombreComercial,
 *     colorCorporativo, sitioWeb, email, telefono.
 *   - `promotion` del padre (ficha).
 *   - `units` vía `unitsByPromotion[promotion.id]`.
 *
 * TODO(backend):
 *   - Persistir el "último formato elegido" (idioma, flags) por promotor.
 *   - Endpoint `POST /api/promociones/:id/export/price-list` que
 *     genere el PDF server-side con Puppeteer y devuelva URL firmada.
 *     Permite envío directo por email sin pasar por el navegador.
 */

import { useMemo, useState } from "react";
import { Download, Printer, X, Building2, QrCode, MapPin, CreditCard, PenLine, Map as MapIcon, LayoutTemplate, ShieldCheck, Settings } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import type { Promotion } from "@/data/promotions";
import { unitsByPromotion, type Unit } from "@/data/units";
import { useEmpresa } from "@/lib/empresa";
import { cn, priceForDisplay } from "@/lib/utils";
import { MinimalSort } from "@/components/ui/MinimalSort";

type Idioma = "es" | "en";
type UnitFilter = "available" | "available-reserved" | "all";
type Template = 1 | 2;

interface PriceListDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotion: Promotion;
  /**
   * Cuando la ficha está en modo colaborador (agencia), el PDF debe
   * imprimirse con branding y contacto de la AGENCIA, ocultando
   * datos del promotor real salvo que el usuario lo habilite.
   */
  agencyMode?: boolean;
}

/**
 * Identidad mock del colaborador (agencia) — reemplazaría a
 * `useEmpresa()` cuando el usuario logueado fuese una agencia.
 * En este prototipo hardcodeamos una agencia de referencia.
 * TODO(backend): leer del perfil real de la agencia autenticada.
 */
const AGENCY_IDENTITY = {
  nombreComercial: "Luxinmo Real Estate",
  sitioWeb: "luxinmo.com",
  email: "contacto@luxinmo.com",
  telefono: "+34 965 00 00 00",
  colorCorporativo: "#0f172a",
  logoUrl: "",
  logoShape: "circle" as const,
};

/* ═══════════════════════════════════════════════════════════════════
   Strings por idioma
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  es: {
    title: "Listado de precios",
    ubicacion: "Ubicación",
    entrega: "Entrega",
    unidades: "Unidades",
    disponibles: "Disponibles",
    rango: "Rango de precios",
    numero: "Nº",
    planta: "Planta",
    tipo: "Tipo",
    dormitorios: "Dorm.",
    banos: "Baños",
    construidos: "m² const.",
    utiles: "m² útiles",
    terraza: "Terraza",
    orientacion: "Orientación",
    precio: "Precio",
    estado: "Estado",
    comision: "Comisión",
    available: "Disponible",
    reserved: "Reservada",
    sold: "Vendida",
    actualizado: "Actualizado",
    contacto: "Contacto",
    disclaimer:
      "Precios sin IVA, sujetos a disponibilidad. Este listado tiene valor informativo y no constituye oferta contractual.",
    pb: "PB",
    atico: "Ático",
    fotoPrincipal: "Foto principal",
    sinFoto: "Sin foto seleccionada",
  },
  en: {
    title: "Price list",
    ubicacion: "Location",
    entrega: "Delivery",
    unidades: "Units",
    disponibles: "Available",
    rango: "Price range",
    numero: "#",
    planta: "Floor",
    tipo: "Type",
    dormitorios: "Bed.",
    banos: "Bath.",
    construidos: "Built m²",
    utiles: "Usable m²",
    terraza: "Terrace",
    orientacion: "Orientation",
    precio: "Price",
    estado: "Status",
    comision: "Commission",
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    actualizado: "Updated",
    contacto: "Contact",
    disclaimer:
      "Prices VAT excluded, subject to availability. This list is informational and does not constitute a contract offer.",
    pb: "GF",
    atico: "Penthouse",
    fotoPrincipal: "Cover photo",
    sinFoto: "No photo selected",
  },
} as const;

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function formatPrice(n: number, locale = "es-ES") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function floorLabel(floor: number, t: typeof T["es"]) {
  if (floor === 0) return t.pb;
  return `P${floor}`;
}

function statusDot(s: Unit["status"]) {
  if (s === "available") return "bg-success";
  if (s === "reserved") return "bg-warning";
  if (s === "sold") return "bg-destructive";
  return "bg-muted-foreground/40";
}

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
export function PriceListDialog({ open, onOpenChange, promotion, agencyMode = false }: PriceListDialogProps) {
  const { empresa: rawEmpresa } = useEmpresa();
  // Identidad del emisor del PDF: en modo agencia es la agencia; en
  // modo promotor, la empresa del promotor. Reusa la misma forma para
  // que todo el render downstream (plantillas 1 y 2) siga usando `empresa`.
  const empresa = agencyMode ? AGENCY_IDENTITY : rawEmpresa;

  const [template, setTemplate] = useState<Template>(1);
  const [filter, setFilter] = useState<UnitFilter>("available");
  const [includeQR, setIncludeQR] = useState(true);
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  // En modo agencia el "Mostrar datos del promotor" arranca apagado
  // por defecto: la agencia no expone al promotor salvo que lo active
  // explícitamente.
  const [showDeveloperInfo, setShowDeveloperInfo] = useState(!agencyMode);
  // Aval bancario — configurable como bloque informativo en el PDF.
  const [includeAval, setIncludeAval] = useState(true);
  // Móvil/tablet: el panel de opciones es colapsable; en desktop siempre visible.
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  // Secciones opcionales de la Plantilla 2 (editorial multi-página).
  const [showPayment, setShowPayment] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showSignature, setShowSignature] = useState(false);

  const t = T[idioma];

  // Filtrar unidades según el criterio elegido.
  const units = unitsByPromotion[promotion.id] || [];
  const filteredUnits = useMemo(() => {
    const sorter = (a: Unit, b: Unit) =>
      a.block.localeCompare(b.block) || a.floor - b.floor || a.door.localeCompare(b.door);
    if (filter === "available") return units.filter((u) => u.status === "available").sort(sorter);
    if (filter === "available-reserved")
      return units.filter((u) => u.status === "available" || u.status === "reserved").sort(sorter);
    return [...units].sort(sorter);
  }, [units, filter]);

  // URL del microsite. En modo agencia apunta a la web de la agencia;
  // en modo promotor al microsite público byvaro.com/<slug>.
  const micrositeUrl = agencyMode
    ? (empresa.sitioWeb ? empresa.sitioWeb.replace(/^https?:\/\//, "") : "")
    : `byvaro.com/${promotion.name.toLowerCase().replace(/\s+/g, "-")}`;

  // Generar QR del microsite (si activo).
  useMemo(() => {
    if (!includeQR || !micrositeUrl) {
      setQrDataUrl("");
      return;
    }
    const url = `https://${micrositeUrl}`;
    QRCode.toDataURL(url, { margin: 1, width: 160 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [micrositeUrl, includeQR]);

  const handlePrint = () => {
    window.print();
    toast.success(idioma === "es" ? "Abriendo diálogo de impresión" : "Opening print dialog", {
      description:
        idioma === "es"
          ? "Usa 'Guardar como PDF' para descargar el listado."
          : "Use 'Save as PDF' to download the list.",
    });
  };

  if (!open) return null;

  const color = empresa.colorCorporativo || "#0f0f0f";
  const today = new Date().toLocaleDateString(idioma === "es" ? "es-ES" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex lg:items-center lg:justify-center lg:p-4 print:static print:inset-auto print:p-0">
      {/* Overlay — se oculta al imprimir */}
      <div
        className="hidden lg:block absolute inset-0 bg-foreground/40 backdrop-blur-sm print:hidden"
        onClick={() => onOpenChange(false)}
      />

      {/* Shell · móvil/tablet fullscreen; desktop modal centrado. */}
      <div className="relative w-full h-full lg:w-full lg:max-w-[1200px] lg:h-[92vh] bg-card lg:border lg:border-border lg:rounded-2xl lg:shadow-soft-lg overflow-hidden flex flex-col print:border-0 print:rounded-none print:shadow-none print:h-auto print:max-w-none">
        {/* Header del modal — selector de plantilla + idioma + X.
            Oculto al imprimir. */}
        <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-5 border-b border-border print:hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center shrink-0">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1 flex items-center gap-3">
              {/* Selector de plantilla inline · MinimalSort look. */}
              <MinimalSort
                value={String(template)}
                onChange={(v) => setTemplate(Number(v) as Template)}
                align="left"
                options={[
                  { value: "1", label: "Plantilla 1 · Clásica" },
                  { value: "2", label: "Plantilla 2 · Editorial" },
                ]}
              />
              {/* Idioma · pills compactas. */}
              <div className="hidden sm:flex items-center gap-1 text-[11px]">
                {(["es", "en"] as Idioma[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setIdioma(l)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                      idioma === l
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Cuerpo: preview + opciones · columna en móvil, fila en desktop. */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden print:overflow-visible">
          {/* Preview scrollable · padding reducido en móvil + zoom
              automático para que la A4 (210mm) quepa en el viewport. */}
          <div className="flex-1 overflow-auto bg-muted/30 p-2 sm:p-4 lg:p-6 print:p-0 print:bg-background print:overflow-visible">
            {template === 2 ? (
              <TemplateEditorial
                promotion={promotion}
                units={filteredUnits}
                empresa={empresa}
                idioma={idioma}
                color={color}
                showPayment={showPayment}
                showLocation={showLocation}
                showSignature={showSignature}
                showDeveloperInfo={showDeveloperInfo}
                includeAval={includeAval}
                today={today}
                qrDataUrl={qrDataUrl}
                includeQR={includeQR}
                micrositeUrl={micrositeUrl}
                t={t}
              />
            ) : (
            <div
              id="price-list-printable"
              className="mx-auto bg-background shadow-soft-lg print:shadow-none"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: "18mm",
              }}
            >
              {/* Header del documento */}
              <div className="flex items-center justify-between pb-5 mb-6 border-b-2" style={{ borderColor: color }}>
                <div className="flex items-center gap-3">
                  {empresa.logoUrl ? (
                    <img
                      src={empresa.logoUrl}
                      alt={empresa.nombreComercial}
                      className={cn(
                        "h-14 w-14 object-cover border border-border",
                        empresa.logoShape === "square" ? "rounded-xl" : "rounded-full"
                      )}
                    />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-xl grid place-items-center text-white font-bold text-lg"
                      style={{ backgroundColor: color }}
                    >
                      {(empresa.nombreComercial || "B").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[15px] font-bold text-foreground leading-tight">
                      {empresa.nombreComercial || "Tu empresa"}
                    </p>
                    {empresa.sitioWeb && (
                      <p className="text-[11px] text-muted-foreground leading-tight">{empresa.sitioWeb}</p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color }}
                  >
                    {t.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.actualizado} {today}</p>
                </div>
              </div>

              {/* Hero: foto + nombre */}
              <div className="relative rounded-xl overflow-hidden border border-border mb-5" style={{ aspectRatio: "16/7" }}>
                {promotion.image ? (
                  <img src={promotion.image} alt={promotion.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center bg-muted">
                    <Building2 className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <p className="text-[11px] uppercase tracking-wider opacity-90">
                    {promotion.location}
                  </p>
                  <p className="text-[28px] font-bold leading-tight mt-0.5">{promotion.name}</p>
                </div>
              </div>

              {/* Datos clave + QR */}
              <div className="grid grid-cols-[1fr_auto] gap-5 mb-6">
                <div className="grid grid-cols-3 gap-3">
                  <InfoCell label={t.ubicacion} value={promotion.location || "—"} color={color} />
                  <InfoCell label={t.entrega} value={promotion.delivery || "—"} color={color} />
                  <InfoCell
                    label={t.unidades}
                    value={`${filteredUnits.length} / ${promotion.totalUnits}`}
                    color={color}
                  />
                  <InfoCell
                    label={t.rango}
                    value={`${formatPrice(promotion.priceMin)} – ${formatPrice(promotion.priceMax)}`}
                    color={color}
                    wide
                  />
                  <InfoCell
                    label={t.disponibles}
                    value={`${promotion.availableUnits}`}
                    color={color}
                  />
                </div>
                {includeQR && qrDataUrl && (
                  <div className="flex flex-col items-center gap-1">
                    <img src={qrDataUrl} alt="QR microsite" className="h-24 w-24 rounded-lg border border-border" />
                    <p className="text-[9px] text-muted-foreground">byvaro.com</p>
                  </div>
                )}
              </div>

              {/* Tabla de unidades */}
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr style={{ backgroundColor: `${color}0D` }} className="text-foreground">
                    <th className="text-left py-2 px-2 font-semibold">{t.numero}</th>
                    <th className="text-left py-2 px-2 font-semibold">{t.planta}</th>
                    <th className="text-left py-2 px-2 font-semibold">{t.tipo}</th>
                    <th className="text-center py-2 px-2 font-semibold">{t.dormitorios}</th>
                    <th className="text-center py-2 px-2 font-semibold">{t.banos}</th>
                    <th className="text-right py-2 px-2 font-semibold">{t.construidos}</th>
                    <th className="text-right py-2 px-2 font-semibold">{t.terraza}</th>
                    <th className="text-left py-2 px-2 font-semibold">{t.orientacion}</th>
                    <th className="text-center py-2 px-2 font-semibold">{t.estado}</th>
                    <th className="text-right py-2 px-2 font-semibold">{t.precio}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((u, i) => {
                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          "border-b border-border/50",
                          u.status === "sold" && "text-muted-foreground/60 line-through"
                        )}
                      >
                        <td className="py-2 px-2 font-mono text-foreground">
                          {u.publicId || `${u.block}-${String(i + 1).padStart(2, "0")}`}
                        </td>
                        <td className="py-2 px-2">{floorLabel(u.floor, t)}</td>
                        <td className="py-2 px-2">{u.type}</td>
                        <td className="py-2 px-2 text-center">{u.bedrooms}</td>
                        <td className="py-2 px-2 text-center">{u.bathrooms}</td>
                        <td className="py-2 px-2 text-right">{u.builtArea}</td>
                        <td className="py-2 px-2 text-right">{u.terrace > 0 ? u.terrace : "—"}</td>
                        <td className="py-2 px-2">{u.orientation}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(u.status))} />
                            {t[u.status as "available" | "reserved" | "sold"] || u.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-foreground">
                          {formatPrice(u.price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-border grid grid-cols-[1fr_auto] gap-4 text-[9.5px] text-muted-foreground">
                <p className="italic leading-relaxed">{t.disclaimer}</p>
                <div className="text-right space-y-0.5">
                  <p className="font-semibold text-foreground">{t.contacto}</p>
                  {empresa.email && <p>{empresa.email}</p>}
                  {empresa.telefono && <p>{empresa.telefono}</p>}
                  {empresa.sitioWeb && <p>{empresa.sitioWeb}</p>}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Opciones · desktop lateral (280px); en móvil/tablet baja
              abajo como panel desplegable controlado por estado. */}
          <aside
            className={cn(
              "shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto print:hidden",
              // Desktop: siempre visible, ancho fijo.
              "lg:w-[280px] lg:block",
              // Móvil/tablet: sólo visible cuando mobileOptionsOpen=true.
              mobileOptionsOpen ? "block max-h-[55vh]" : "hidden"
            )}
          >
            <div className="p-5 space-y-5">
              {/* Secciones (solo Plantilla 2) */}
              {template === 2 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                    Secciones del dossier
                  </p>
                  <div className="space-y-2">
                    <ToggleRow
                      label="Plan de pagos"
                      description="Hitos + garantías"
                      checked={showPayment}
                      onChange={setShowPayment}
                      icon={CreditCard}
                    />
                    <ToggleRow
                      label="Ubicación"
                      description="Mapa + transportes y servicios"
                      checked={showLocation}
                      onChange={setShowLocation}
                      icon={MapIcon}
                    />
                    <ToggleRow
                      label="Firma"
                      description="Conformidad del cliente"
                      checked={showSignature}
                      onChange={setShowSignature}
                      icon={PenLine}
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Idioma
                </p>
                <div className="flex gap-1.5">
                  {(["es", "en"] as Idioma[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setIdioma(l)}
                      className={cn(
                        "h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                        idioma === l
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {l === "es" ? "Español" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Unidades a incluir
                </p>
                <div className="space-y-1.5">
                  {(
                    [
                      { value: "available", label: "Solo disponibles" },
                      { value: "available-reserved", label: "Disponibles + reservadas" },
                      { value: "all", label: "Todas (incluye vendidas)" },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-[12.5px]",
                        filter === opt.value
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-border hover:border-foreground/30"
                      )}
                    >
                      <input
                        type="radio"
                        name="unit-filter"
                        value={opt.value}
                        checked={filter === opt.value}
                        onChange={() => setFilter(opt.value)}
                        className="accent-primary"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Opciones
                </p>
                <div className="space-y-2">
                  <ToggleRow
                    label="Incluir QR del microsite"
                    description={agencyMode ? "Enlace a tu web" : "Enlace a la web pública"}
                    checked={includeQR}
                    onChange={setIncludeQR}
                    icon={QrCode}
                  />
                  <ToggleRow
                    label="Incluir aval bancario"
                    description="Garantías Ley 38/1999 en el PDF"
                    checked={includeAval}
                    onChange={setIncludeAval}
                    icon={ShieldCheck}
                  />
                  {agencyMode && (
                    <ToggleRow
                      label="Mostrar datos del promotor"
                      description="Por defecto oculto en modo agencia"
                      checked={showDeveloperInfo}
                      onChange={setShowDeveloperInfo}
                      icon={Building2}
                    />
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Filas:</span>
                <span className="font-semibold text-foreground">{filteredUnits.length}</span>
              </div>
            </div>

            {/* Footer de acciones · SOLO desktop. En móvil/tablet el
                footer vive fuera del aside (barra inferior siempre
                visible). */}
            <div className="hidden lg:flex sticky bottom-0 border-t border-border bg-card p-4 flex-col gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
              >
                <Printer className="h-4 w-4" />
                {idioma === "es" ? "Descargar PDF" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {idioma === "es" ? "Cancelar" : "Cancel"}
              </button>
            </div>
          </aside>
        </div>

        {/* Bottom bar móvil/tablet · "Opciones" toggle + "Descargar PDF". */}
        <div
          className="lg:hidden shrink-0 border-t border-border bg-card p-3 flex items-center gap-2 print:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="button"
            onClick={() => setMobileOptionsOpen((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors",
              mobileOptionsOpen
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            <Settings className="h-4 w-4" />
            {idioma === "es" ? "Opciones" : "Options"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-soft"
          >
            <Printer className="h-4 w-4" />
            {idioma === "es" ? "Descargar PDF" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-componentes ────────────────────────────────────────────── */

function InfoCell({
  label,
  value,
  color,
  wide,
}: {
  label: string;
  value: string;
  color: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/40 px-3 py-2", wide && "col-span-2")}>
      <p
        className="text-[9px] uppercase tracking-wider font-semibold"
        style={{ color }}
      >
        {label}
      </p>
      <p className="text-[12px] font-semibold text-foreground leading-tight mt-0.5">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-start gap-2 px-3 py-2 rounded-xl border transition-colors text-left",
        checked
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:border-foreground/30"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        </div>
        {description && (
          <p className="text-[10.5px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 mt-0.5 h-4 w-7 rounded-full transition-colors relative",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Plantilla 2 · Editorial multi-página (portada + disponibilidad +
   opcionales: plan de pagos / ubicación / firma).
   Portada inspirada en el dossier de Lovable, adaptada a tokens Byvaro.
   ═══════════════════════════════════════════════════════════════════ */
function TemplateEditorial({
  promotion,
  units,
  empresa,
  idioma,
  color,
  showPayment,
  showLocation,
  showSignature,
  showDeveloperInfo,
  includeAval,
  today,
  qrDataUrl,
  includeQR,
  micrositeUrl,
  t,
}: {
  promotion: Promotion;
  units: Unit[];
  empresa: ReturnType<typeof useEmpresa>["empresa"];
  idioma: Idioma;
  color: string;
  showPayment: boolean;
  showLocation: boolean;
  showSignature: boolean;
  showDeveloperInfo: boolean;
  includeAval: boolean;
  today: string;
  qrDataUrl: string;
  includeQR: boolean;
  micrositeUrl: string;
  t: typeof T["es"];
}) {
  // Plan de pagos demo (en la ficha real vendrá de promotion.paymentPlan).
  const paymentPlan = [
    { milestone: idioma === "es" ? "Reserva" : "Booking", value: 6000, isFixed: true, when: idioma === "es" ? "A la firma del contrato de reserva" : "On booking contract signature" },
    { milestone: idioma === "es" ? "Contrato privado" : "Private contract", value: 20, when: idioma === "es" ? "30 días tras la reserva" : "30 days after booking" },
    { milestone: idioma === "es" ? "Durante construcción" : "During construction", value: 20, when: idioma === "es" ? "Cuotas mensuales hasta entrega" : "Monthly installments until handover" },
    { milestone: idioma === "es" ? "Entrega de llaves" : "Handover", value: 60, when: idioma === "es" ? "Escritura pública" : "Public deed" },
  ];

  // Páginas numeradas dinámicamente según secciones activas.
  let pageNum = 0;
  const nextPage = () => String(++pageNum).padStart(2, "0");

  const pageClass =
    "editorial-page flex flex-col bg-background text-foreground";
  const pageStyle: React.CSSProperties = {
    width: "210mm",
    padding: "14mm 16mm",
    boxSizing: "border-box",
  };

  const available = units.filter((u) => u.status === "available");
  const pageLabel = nextPage; // alias for readability

  return (
    <div
      id="price-list-printable"
      className="mx-auto bg-background shadow-soft-lg print:shadow-none"
      style={{ width: "210mm" }}
    >
      {/* ============ PORTADA ============ */}
      <section className={pageClass} style={pageStyle}>
        <header
          className="flex items-center justify-between pb-4 border-b-2"
          style={{ borderColor: color }}
        >
          <div className="flex items-center gap-2.5">
            {empresa.logoUrl ? (
              <img
                src={empresa.logoUrl}
                alt={empresa.nombreComercial}
                className={cn(
                  "h-8 w-8 object-cover border border-border",
                  empresa.logoShape === "square" ? "rounded-lg" : "rounded-full"
                )}
              />
            ) : (
              <div
                className="h-8 w-8 rounded-lg grid place-items-center text-white text-[10px] font-bold"
                style={{ backgroundColor: color }}
              >
                {(empresa.nombreComercial || "B").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                {idioma === "es" ? "Preparado por" : "Prepared by"}
              </p>
              <p className="text-xs font-semibold text-foreground">{empresa.nombreComercial || "Tu empresa"}</p>
            </div>
          </div>
          <div className="text-right leading-tight">
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {idioma === "es" ? "Fecha" : "Date"}
            </p>
            <p className="text-xs font-semibold text-foreground">{today}</p>
          </div>
        </header>

        {/* Título editorial */}
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground" style={{ color }}>
            {idioma === "es" ? "Promoción" : "Development"} · {(promotion as unknown as { code?: string }).code || promotion.id}
          </p>
          <h1 className="mt-1.5 text-[32px] font-bold leading-[1.05] tracking-tight text-foreground">
            {promotion.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {promotion.location}
            {showDeveloperInfo && promotion.developer ? ` · ${promotion.developer}` : ""}
          </p>
        </div>

        {/* Hero */}
        <div className="mt-4 overflow-hidden" style={{ height: "260px" }}>
          {promotion.image ? (
            <img src={promotion.image} alt={promotion.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center bg-muted">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Cuadrícula de datos clave */}
        <dl className="mt-4 grid grid-cols-4 border-t border-b border-border divide-x divide-border">
          {[
            { label: idioma === "es" ? "Desde" : "From", value: formatPrice(promotion.priceMin, idioma === "es" ? "es-ES" : "en-GB") },
            { label: idioma === "es" ? "Hasta" : "Up to", value: formatPrice(promotion.priceMax, idioma === "es" ? "es-ES" : "en-GB") },
            { label: t.disponibles, value: `${promotion.availableUnits} / ${promotion.totalUnits}` },
            { label: t.entrega, value: promotion.delivery || "—" },
          ].map((item) => (
            <div key={item.label} className="px-3 py-3">
              <dt className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</dt>
              <dd className="text-sm font-semibold text-foreground mt-0.5">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Descripción */}
        <div className="mt-4">
          <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5">
            {idioma === "es" ? "Sobre la promoción" : "About the development"}
          </h2>
          <p className="text-[11px] leading-relaxed text-foreground/90">
            {idioma === "es" ? (
              <>
                {promotion.name} es un desarrollo residencial situado en <strong>{promotion.location}</strong>
                {showDeveloperInfo && promotion.developer && <> promovido por <strong>{promotion.developer}</strong></>}.
                Cuenta con {promotion.totalUnits} unidades totales, de las cuales {promotion.availableUnits} están disponibles.
                {promotion.constructionProgress != null && ` Estado de construcción: ${promotion.constructionProgress}%.`}
              </>
            ) : (
              <>
                {promotion.name} is a residential development located in <strong>{promotion.location}</strong>
                {showDeveloperInfo && promotion.developer && <> by <strong>{promotion.developer}</strong></>}.
                It features {promotion.totalUnits} units, with {promotion.availableUnits} currently available.
                {promotion.constructionProgress != null && ` Construction progress: ${promotion.constructionProgress}%.`}
              </>
            )}
          </p>
        </div>

        {/* Footer consolidado: QR + microsite + empresa + page number,
            todo en la parte baja de la portada. */}
        <footer className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-4 text-[9.5px] text-muted-foreground">
          <div className="flex items-center gap-3 min-w-0">
            {includeQR && qrDataUrl && (
              <img src={qrDataUrl} alt="QR" className="h-14 w-14 rounded-md border border-border shrink-0" />
            )}
            <div className="min-w-0">
              {includeQR && (
                <>
                  <p className="font-semibold text-foreground uppercase tracking-[0.12em] text-[9px]">
                    {idioma === "es" ? "Microsite público" : "Public microsite"}
                  </p>
                  <p className="truncate">{micrositeUrl}</p>
                </>
              )}
              <p className={cn("truncate uppercase tracking-wider text-[9px]", includeQR && "mt-1")}>
                {empresa.nombreComercial || "Tu empresa"}
                {empresa.email && ` · ${empresa.email}`}
              </p>
            </div>
          </div>
          <span className="uppercase tracking-wider text-[9px] shrink-0">{pageLabel()}</span>
        </footer>
      </section>

      {/* ============ DISPONIBILIDAD ============ */}
      <section className={cn(pageClass, "editorial-page-break")} style={pageStyle}>
        <header className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: color }}>
          <div className="flex items-center gap-2">
            {empresa.logoUrl && <img src={empresa.logoUrl} alt="" className="h-6 w-6 rounded object-cover border border-border" />}
            <span className="text-[11px] font-semibold text-foreground">{empresa.nombreComercial || "Tu empresa"}</span>
          </div>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            {promotion.name}
          </span>
        </header>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>{idioma === "es" ? "Sección 01" : "Section 01"}</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            {idioma === "es" ? "Disponibilidad" : "Availability"}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            {idioma === "es"
              ? `${units.length} unidades · Actualizado el ${today}`
              : `${units.length} units · Updated on ${today}`}
          </p>
        </div>

        <table className="mt-4 w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 text-foreground" style={{ borderColor: color }}>
              <th className="text-left py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{idioma === "es" ? "Ref." : "Ref."}</th>
              <th className="text-left py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.tipo}</th>
              <th className="text-center py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.dormitorios}</th>
              <th className="text-center py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.banos}</th>
              <th className="text-right py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.utiles}</th>
              <th className="text-right py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.construidos}</th>
              <th className="text-right py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.terraza}</th>
              <th className="text-left py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.orientacion}</th>
              <th className="text-right py-2 px-1.5 font-semibold uppercase tracking-wider text-[9px]">{t.precio}</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className={cn("border-b border-border/60", u.status === "sold" && "text-muted-foreground/60")}>
                <td className="py-2 px-1.5 font-mono text-foreground/80">{u.publicId || `${u.block}-${u.floor}${u.door}`}</td>
                <td className="py-2 px-1.5 text-foreground/80">{u.type}</td>
                <td className="py-2 px-1.5 text-center text-foreground/80">{u.bedrooms}</td>
                <td className="py-2 px-1.5 text-center text-foreground/80">{u.bathrooms}</td>
                <td className="py-2 px-1.5 text-right text-foreground/80">{u.usableArea} m²</td>
                <td className="py-2 px-1.5 text-right text-foreground/80">{u.builtArea} m²</td>
                <td className="py-2 px-1.5 text-right text-foreground/80">{u.terrace > 0 ? `${u.terrace} m²` : "—"}</td>
                <td className="py-2 px-1.5 text-foreground/80">{u.orientation}</td>
                <td className="py-2 px-1.5 text-right font-semibold text-foreground">{formatPrice(u.price, idioma === "es" ? "es-ES" : "en-GB")}</td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  {idioma === "es" ? "No hay unidades para mostrar." : "No units to show."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="mt-4 text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-3">
          <strong className="text-foreground/80">
            {idioma === "es" ? "Nota legal." : "Legal note."}
          </strong>{" "}
          {t.disclaimer}
        </p>

        <footer className="mt-auto pt-4 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
          <span>{empresa.nombreComercial || "Tu empresa"}{empresa.telefono && ` · ${empresa.telefono}`}</span>
          <span>{pageLabel()}</span>
        </footer>
      </section>

      {/* ============ PLAN DE PAGOS ============ */}
      {showPayment && (
        <section className={cn(pageClass, "editorial-page-break")} style={pageStyle}>
          <header className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: color }}>
            <div className="flex items-center gap-2">
              {empresa.logoUrl && <img src={empresa.logoUrl} alt="" className="h-6 w-6 rounded object-cover border border-border" />}
              <span className="text-[11px] font-semibold text-foreground">{empresa.nombreComercial || "Tu empresa"}</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{promotion.name}</span>
          </header>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>{idioma === "es" ? "Sección 02" : "Section 02"}</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {idioma === "es" ? "Plan de pagos" : "Payment plan"}
            </h2>
          </div>

          <table className="mt-4 w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b-2 text-foreground" style={{ borderColor: color }}>
                <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[9px]">{idioma === "es" ? "Hito" : "Milestone"}</th>
                <th className="text-left py-2 px-2 font-semibold uppercase tracking-wider text-[9px]">{idioma === "es" ? "Cuándo" : "When"}</th>
                <th className="text-right py-2 px-2 font-semibold uppercase tracking-wider text-[9px]">{idioma === "es" ? "Importe" : "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {paymentPlan.map((row, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2.5 px-2 font-semibold text-foreground">{row.milestone}</td>
                  <td className="py-2.5 px-2 text-muted-foreground">{row.when}</td>
                  <td className="py-2.5 px-2 text-right font-semibold text-foreground">
                    {row.isFixed ? formatPrice(row.value, idioma === "es" ? "es-ES" : "en-GB") : `${row.value}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={cn("mt-5 grid gap-4", includeAval ? "grid-cols-2" : "grid-cols-1")}>
            <div className="border border-border p-4 rounded-xl">
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{idioma === "es" ? "Forma de pago" : "Payment method"}</p>
              <p className="mt-1 text-[11px] text-foreground/90 leading-relaxed">
                {idioma === "es"
                  ? "Transferencia bancaria a cuenta escrow del promotor. Cada pago genera recibo nominal."
                  : "Bank transfer to escrow account. Each payment issues a nominal receipt."}
              </p>
            </div>
            {includeAval && (
              <div className="border border-border p-4 rounded-xl">
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" />
                  {idioma === "es" ? "Aval bancario" : "Bank guarantee"}
                </p>
                <p className="mt-1 text-[11px] text-foreground/90 leading-relaxed">
                  {idioma === "es"
                    ? "Cantidades anticipadas avaladas según Ley 38/1999. Aval bancario individual entregado al firmar contrato privado."
                    : "Advance amounts backed under Spanish Law 38/1999. Individual bank guarantee delivered on private contract signing."}
                </p>
              </div>
            )}
          </div>

          <footer className="mt-auto pt-4 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
            <span>{empresa.nombreComercial || "Tu empresa"}</span>
            <span>{pageLabel()}</span>
          </footer>
        </section>
      )}

      {/* ============ UBICACIÓN ============ */}
      {showLocation && (
        <section className={cn(pageClass, "editorial-page-break")} style={pageStyle}>
          <header className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: color }}>
            <div className="flex items-center gap-2">
              {empresa.logoUrl && <img src={empresa.logoUrl} alt="" className="h-6 w-6 rounded object-cover border border-border" />}
              <span className="text-[11px] font-semibold text-foreground">{empresa.nombreComercial || "Tu empresa"}</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{promotion.name}</span>
          </header>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>{idioma === "es" ? "Sección" : "Section"} {showPayment ? "03" : "02"}</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">{t.ubicacion}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {promotion.location}
            </p>
          </div>

          {/* Mapa estático (fallback a imagen genérica) */}
          <div className="mt-4 border border-border overflow-hidden rounded-xl" style={{ height: "280px" }}>
            <img
              src={`https://staticmap.openstreetmap.de/staticmap.php?center=40.4168,-3.7038&zoom=13&size=900x320&maptype=mapnik`}
              alt="Mapa"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&h=400&fit=crop";
              }}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{idioma === "es" ? "Transporte" : "Transport"}</p>
              <ul className="mt-1.5 text-[11px] text-foreground/90 space-y-1">
                <li>· {idioma === "es" ? "Metro — 8 min" : "Subway — 8 min"}</li>
                <li>· {idioma === "es" ? "Cercanías — 12 min" : "Rail — 12 min"}</li>
                <li>· {idioma === "es" ? "Aeropuerto — 25 min" : "Airport — 25 min"}</li>
              </ul>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{idioma === "es" ? "Servicios" : "Services"}</p>
              <ul className="mt-1.5 text-[11px] text-foreground/90 space-y-1">
                <li>· {idioma === "es" ? "Colegios bilingües" : "Bilingual schools"}</li>
                <li>· {idioma === "es" ? "Centro comercial" : "Shopping mall"}</li>
                <li>· {idioma === "es" ? "Hospital privado" : "Private hospital"}</li>
              </ul>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{idioma === "es" ? "Ocio" : "Leisure"}</p>
              <ul className="mt-1.5 text-[11px] text-foreground/90 space-y-1">
                <li>· {idioma === "es" ? "Parque urbano" : "Urban park"}</li>
                <li>· {idioma === "es" ? "Restaurantes y cafés" : "Restaurants and cafés"}</li>
                <li>· {idioma === "es" ? "Club deportivo" : "Sports club"}</li>
              </ul>
            </div>
          </div>

          <footer className="mt-auto pt-4 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
            <span>{empresa.nombreComercial || "Tu empresa"}</span>
            <span>{pageLabel()}</span>
          </footer>
        </section>
      )}

      {/* ============ FIRMA ============ */}
      {showSignature && (
        <section className={cn(pageClass, "editorial-page-break")} style={pageStyle}>
          <header className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: color }}>
            <div className="flex items-center gap-2">
              {empresa.logoUrl && <img src={empresa.logoUrl} alt="" className="h-6 w-6 rounded object-cover border border-border" />}
              <span className="text-[11px] font-semibold text-foreground">{empresa.nombreComercial || "Tu empresa"}</span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{promotion.name}</span>
          </header>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
              {idioma === "es" ? "Sección final" : "Final section"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {idioma === "es" ? "Conformidad y firma" : "Acknowledgement and signature"}
            </h2>
          </div>

          <div className="mt-6 text-[11px] text-foreground/90 leading-relaxed space-y-3">
            <p>
              {idioma === "es"
                ? <>Este documento tiene carácter <strong>informativo</strong> y no constituye oferta vinculante. Características, precios, superficies y plazos pueden sufrir modificaciones por exigencias técnicas, comerciales o normativas.</>
                : <>This document is <strong>informational only</strong> and does not constitute a binding offer. Features, prices, areas and timelines may change due to technical, commercial or regulatory requirements.</>}
            </p>
            <p>
              {idioma === "es"
                ? <>El receptor se compromete a tratar esta información como <strong>confidencial</strong> y a no difundirla a terceros sin autorización expresa.</>
                : <>The recipient commits to treating this information as <strong>confidential</strong> and not sharing it with third parties without express authorisation.</>}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-10">
            <div>
              <div className="border-b-2 h-20" style={{ borderColor: color }} />
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {idioma === "es" ? "Cliente" : "Client"}
              </p>
              <p className="text-[11px] text-foreground/90 mt-2">
                {idioma === "es" ? "Nombre · DNI · Fecha" : "Name · ID · Date"}
              </p>
            </div>
            <div>
              <div className="border-b-2 h-20" style={{ borderColor: color }} />
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {idioma === "es" ? "Asesor comercial" : "Sales advisor"}
              </p>
              <p className="text-[11px] text-foreground/90 mt-2">{empresa.nombreComercial || "Tu empresa"} · {today}</p>
            </div>
          </div>

          <footer className="mt-auto pt-4 border-t border-border flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-wider">
            <span>{empresa.nombreComercial || "Tu empresa"}{empresa.email && ` · ${empresa.email}`}</span>
            <span>{pageLabel()}</span>
          </footer>
        </section>
      )}
    </div>
  );
}
