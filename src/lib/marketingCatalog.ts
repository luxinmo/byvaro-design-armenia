/**
 * Catálogos del bloque Marketing y mercado de la ficha de empresa.
 *
 * Tipos de producto que la agencia/promotor comercializa, fuentes de
 * clientes (portales, red, referidos, cartera propia), y constante
 * sentinel "OTROS" para distribuciones porcentuales.
 *
 * Estos catálogos NO son canónicos del sistema — son datos de
 * marketing declarados por la propia empresa. Son slugs libres con
 * label legible. Si en el futuro hay que estandarizarlos para
 * filtros / matching, este archivo es el punto único.
 */

/** Tipos de producto sugeridos · el usuario puede añadir slugs custom. */
export const MARKETING_PRODUCT_TYPES: Array<{ slug: string; label: string }> = [
  { slug: "villa-moderna",   label: "Villa moderna" },
  { slug: "villa-lujo",      label: "Villa de lujo" },
  { slug: "villa-rustica",   label: "Villa rústica" },
  { slug: "apartamento",     label: "Apartamento" },
  { slug: "atico",           label: "Ático" },
  { slug: "obra-nueva",      label: "Obra nueva" },
  { slug: "parcela",         label: "Parcela" },
  { slug: "edificio",        label: "Edificio" },
  { slug: "local-comercial", label: "Local comercial" },
  { slug: "oficina",         label: "Oficina" },
  { slug: "nave-industrial", label: "Nave industrial" },
  { slug: "rural",           label: "Finca rural" },
  { slug: "hotel",           label: "Hotel / hospedaje" },
];

export function productTypeLabel(slug: string): string {
  const found = MARKETING_PRODUCT_TYPES.find((t) => t.slug === slug);
  if (found) return found.label;
  /* Slugs custom (kebab-case) → label legible. */
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fuentes de clientes · catálogo cerrado. La fuente `otros-canales`
 *  cubre canales propios no listados (eventos, prensa, RR.PP., redes
 *  sociales propias, ferias, etc.). El sentinel `OTROS` (auto-calc)
 *  se añade en el render como fila al final, NO va aquí. */
export type FuenteCliente =
  | "portales"
  | "colab-nac"
  | "colab-int"
  | "referidos"
  | "cartera-propia"
  | "otros-canales";

export const FUENTES_CLIENTES: Array<{ value: FuenteCliente; label: string; description?: string }> = [
  { value: "portales",       label: "Portales inmobiliarios", description: "Idealista, Fotocasa, Habitaclia, Kyero…" },
  { value: "colab-nac",      label: "Colaboradores nacionales", description: "Otras agencias en España" },
  { value: "colab-int",      label: "Colaboradores internacionales", description: "Brokers de fuera del país" },
  { value: "referidos",      label: "Referidos", description: "Recomendación boca a boca de clientes previos" },
  { value: "cartera-propia", label: "Cartera de clientes propios", description: "Repeticiones e inversores fidelizados" },
  { value: "otros-canales",  label: "Otros canales propios", description: "Eventos, prensa, RR.PP., ferias, redes propias…" },
];

export function fuenteClienteLabel(f: string): string {
  return FUENTES_CLIENTES.find((x) => x.value === f)?.label ?? f;
}

/** Sentinel para el agrupador "Otros" en distribuciones porcentuales. */
export const PCT_OTROS = "OTROS";

/** Suma `pct` redondeando a entero · útil para validar = 100. */
export function sumPct(items: Array<{ pct: number }>): number {
  return items.reduce((acc, x) => acc + (Number.isFinite(x.pct) ? Math.round(x.pct) : 0), 0);
}
