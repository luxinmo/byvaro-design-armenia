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
import { Download, Printer, X, Building2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import type { Promotion } from "@/data/promotions";
import { unitsByPromotion, type Unit } from "@/data/units";
import { useEmpresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";

type Idioma = "es" | "en";
type UnitFilter = "available" | "available-reserved" | "all";

interface PriceListDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotion: Promotion;
}

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
  if (s === "available") return "bg-emerald-500";
  if (s === "reserved") return "bg-amber-500";
  if (s === "sold") return "bg-destructive";
  return "bg-muted-foreground/40";
}

/* ═══════════════════════════════════════════════════════════════════
   Componente principal
   ═══════════════════════════════════════════════════════════════════ */
export function PriceListDialog({ open, onOpenChange, promotion }: PriceListDialogProps) {
  const { empresa } = useEmpresa();
  const [filter, setFilter] = useState<UnitFilter>("available");
  const [includeCommission, setIncludeCommission] = useState(false);
  const [includeQR, setIncludeQR] = useState(true);
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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

  // Generar QR del microsite (si activo).
  useMemo(() => {
    if (!includeQR) {
      setQrDataUrl("");
      return;
    }
    const slug = promotion.name.toLowerCase().replace(/\s+/g, "-");
    const url = `https://byvaro.com/${slug}`;
    QRCode.toDataURL(url, { margin: 1, width: 160 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [promotion.name, includeQR]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:inset-auto print:p-0">
      {/* Overlay — se oculta al imprimir */}
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm print:hidden"
        onClick={() => onOpenChange(false)}
      />

      {/* Shell */}
      <div className="relative w-full max-w-[1200px] h-[92vh] bg-card border border-border rounded-2xl shadow-soft-lg overflow-hidden flex flex-col print:border-0 print:rounded-none print:shadow-none print:h-auto print:max-w-none">
        {/* Header del modal — oculto al imprimir */}
        <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border print:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">
                {t.title}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">{promotion.name}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Cuerpo: preview + opciones */}
        <div className="flex-1 flex overflow-hidden print:overflow-visible">
          {/* Preview scrollable */}
          <div className="flex-1 overflow-auto bg-muted/30 p-6 print:p-0 print:bg-background print:overflow-visible">
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
                    {includeCommission && (
                      <th className="text-right py-2 px-2 font-semibold">{t.comision}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((u, i) => {
                    const com = Math.round(u.price * (promotion.commission / 100));
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
                        {includeCommission && (
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {formatPrice(com)}
                          </td>
                        )}
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
          </div>

          {/* Opciones — oculto al imprimir */}
          <aside className="w-[280px] shrink-0 border-l border-border bg-card overflow-y-auto print:hidden">
            <div className="p-5 space-y-5">
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
                    label="Incluir comisión"
                    description="Visible para la versión agencia"
                    checked={includeCommission}
                    onChange={setIncludeCommission}
                  />
                  <ToggleRow
                    label="Incluir QR del microsite"
                    description="Enlace directo a la web pública"
                    checked={includeQR}
                    onChange={setIncludeQR}
                    icon={QrCode}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Filas:</span>
                <span className="font-semibold text-foreground">{filteredUnits.length}</span>
              </div>
            </div>

            {/* Footer de acciones */}
            <div className="sticky bottom-0 border-t border-border bg-card p-4 flex flex-col gap-2">
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
