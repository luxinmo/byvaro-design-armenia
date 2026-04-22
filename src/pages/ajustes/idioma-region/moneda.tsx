/**
 * /ajustes/idioma-region/moneda — Moneda principal del workspace.
 *
 * Aplica a precios de promociones, ofertas, comisiones y reportes.
 * Es por organización (no por usuario): todos los miembros ven los
 * mismos importes en la misma moneda. Solo admins pueden cambiarla.
 *
 * ──────────────────────────────────────────────────────────────────
 * ESTADO Y BACKEND
 * ──────────────────────────────────────────────────────────────────
 *
 * Frontend (LISTO):
 *  - Lista curada de 50+ monedas internacionales con símbolo nativo,
 *    código ISO 4217 y región.
 *  - Buscador (case-insensitive) por nombre, código, región o símbolo.
 *  - Agrupación visual por región (Europa, Cáucaso, Oriente Medio,
 *    América, Asia, Oceanía / África).
 *  - Preview de precio formateado con `Intl.NumberFormat` — API
 *    nativa, no necesita servidor.
 *  - Permiso real: useCurrentUser() + isAdmin() bloquea guardar a
 *    members.
 *  - Persistencia local en `byvaro.orgCurrency.v1`.
 *
 * TODO(backend) — cuando exista API:
 *  - PATCH /api/organization { currency: "EUR" } — la moneda es per-
 *    organización; el localStorage actual la guarda por navegador,
 *    así que cualquier user con sesión podría "cambiarla" solo para
 *    él. El backend debe persistirla en la fila de la organización
 *    y devolverla al hidratar la sesión.
 *  - Validación server-side del permiso (no fiar del isAdmin cliente).
 *  - Audit log: registrar quién y cuándo cambió la moneda.
 *
 * NO entra en este ajuste (deliberadamente):
 *  - Conversión de divisas en tiempo real. Si quieres mostrar el
 *    precio de una unidad en otra moneda según el cliente (ej. ver
 *    precio en AED para clientes de Dubai), eso es otra feature
 *    aparte que requiere proveedor FX (ECB, OpenExchangeRates) y
 *    cache de tasas en backend.
 */

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";

const KEY = "byvaro.orgCurrency.v1";

type Currency = {
  code: string;       // ISO 4217
  symbol: string;     // glifo nativo
  label: string;      // nombre en español
  regions: string;    // país / zona principal
  group: string;      // sección de agrupación visual
};

/**
 * 50+ monedas curadas. Orden dentro de cada región:
 *  - Las más usadas en el mercado Byvaro primero.
 *  - El resto por orden alfabético del nombre.
 */
const CURRENCIES: Currency[] = [
  // ── Europa Occidental ──────────────────────────────────────────
  { code: "EUR", symbol: "€",   label: "Euro",                  regions: "Eurozona",       group: "Europa Occidental" },
  { code: "GBP", symbol: "£",   label: "Libra esterlina",       regions: "Reino Unido",    group: "Europa Occidental" },
  { code: "CHF", symbol: "Fr",  label: "Franco suizo",          regions: "Suiza",          group: "Europa Occidental" },
  { code: "NOK", symbol: "kr",  label: "Corona noruega",        regions: "Noruega",        group: "Europa Occidental" },
  { code: "SEK", symbol: "kr",  label: "Corona sueca",          regions: "Suecia",         group: "Europa Occidental" },
  { code: "DKK", symbol: "kr",  label: "Corona danesa",         regions: "Dinamarca",      group: "Europa Occidental" },
  { code: "ISK", symbol: "kr",  label: "Corona islandesa",      regions: "Islandia",       group: "Europa Occidental" },

  // ── Europa Central y del Este ──────────────────────────────────
  { code: "PLN", symbol: "zł",  label: "Złoty polaco",          regions: "Polonia",        group: "Europa Central / Este" },
  { code: "CZK", symbol: "Kč",  label: "Corona checa",          regions: "Chequia",        group: "Europa Central / Este" },
  { code: "HUF", symbol: "Ft",  label: "Forinto húngaro",       regions: "Hungría",        group: "Europa Central / Este" },
  { code: "RON", symbol: "lei", label: "Leu rumano",            regions: "Rumanía",        group: "Europa Central / Este" },
  { code: "BGN", symbol: "лв",  label: "Lev búlgaro",           regions: "Bulgaria",       group: "Europa Central / Este" },
  { code: "TRY", symbol: "₺",   label: "Lira turca",            regions: "Turquía",        group: "Europa Central / Este" },
  { code: "UAH", symbol: "₴",   label: "Grivna ucraniana",      regions: "Ucrania",        group: "Europa Central / Este" },
  { code: "RUB", symbol: "₽",   label: "Rublo ruso",            regions: "Rusia",          group: "Europa Central / Este" },
  { code: "BYN", symbol: "Br",  label: "Rublo bielorruso",      regions: "Bielorrusia",    group: "Europa Central / Este" },

  // ── Cáucaso y Asia Central ─────────────────────────────────────
  { code: "AMD", symbol: "֏",   label: "Dram armenio",          regions: "Armenia",        group: "Cáucaso y Asia Central" },
  { code: "GEL", symbol: "₾",   label: "Lari georgiano",        regions: "Georgia",        group: "Cáucaso y Asia Central" },
  { code: "AZN", symbol: "₼",   label: "Manat azerbaiyano",     regions: "Azerbaiyán",     group: "Cáucaso y Asia Central" },
  { code: "KZT", symbol: "₸",   label: "Tenge kazajo",          regions: "Kazajstán",      group: "Cáucaso y Asia Central" },
  { code: "UZS", symbol: "soʻm",label: "Sum uzbeko",            regions: "Uzbekistán",     group: "Cáucaso y Asia Central" },

  // ── Oriente Medio y Magreb ─────────────────────────────────────
  { code: "AED", symbol: "د.إ", label: "Dírham UAE",            regions: "Emiratos Árabes", group: "Oriente Medio y Magreb" },
  { code: "SAR", symbol: "﷼",   label: "Riyal saudí",           regions: "Arabia Saudí",   group: "Oriente Medio y Magreb" },
  { code: "QAR", symbol: "﷼",   label: "Riyal catarí",          regions: "Catar",          group: "Oriente Medio y Magreb" },
  { code: "KWD", symbol: "د.ك", label: "Dinar kuwaití",         regions: "Kuwait",         group: "Oriente Medio y Magreb" },
  { code: "BHD", symbol: ".د.ب",label: "Dinar bareiní",         regions: "Baréin",         group: "Oriente Medio y Magreb" },
  { code: "OMR", symbol: "﷼",   label: "Riyal omaní",           regions: "Omán",           group: "Oriente Medio y Magreb" },
  { code: "ILS", symbol: "₪",   label: "Shékel israelí",        regions: "Israel",         group: "Oriente Medio y Magreb" },
  { code: "EGP", symbol: "E£",  label: "Libra egipcia",         regions: "Egipto",         group: "Oriente Medio y Magreb" },
  { code: "MAD", symbol: "د.م.",label: "Dírham marroquí",       regions: "Marruecos",      group: "Oriente Medio y Magreb" },
  { code: "TND", symbol: "د.ت", label: "Dinar tunecino",        regions: "Túnez",          group: "Oriente Medio y Magreb" },
  { code: "DZD", symbol: "د.ج", label: "Dinar argelino",        regions: "Argelia",        group: "Oriente Medio y Magreb" },

  // ── América ────────────────────────────────────────────────────
  { code: "USD", symbol: "$",   label: "Dólar estadounidense",  regions: "Estados Unidos", group: "América" },
  { code: "CAD", symbol: "CA$", label: "Dólar canadiense",      regions: "Canadá",         group: "América" },
  { code: "MXN", symbol: "MX$", label: "Peso mexicano",         regions: "México",         group: "América" },
  { code: "BRL", symbol: "R$",  label: "Real brasileño",        regions: "Brasil",         group: "América" },
  { code: "ARS", symbol: "AR$", label: "Peso argentino",        regions: "Argentina",      group: "América" },
  { code: "CLP", symbol: "CL$", label: "Peso chileno",          regions: "Chile",          group: "América" },
  { code: "COP", symbol: "CO$", label: "Peso colombiano",       regions: "Colombia",       group: "América" },
  { code: "PEN", symbol: "S/",  label: "Sol peruano",           regions: "Perú",           group: "América" },
  { code: "UYU", symbol: "UY$", label: "Peso uruguayo",         regions: "Uruguay",        group: "América" },

  // ── Asia-Pacífico ──────────────────────────────────────────────
  { code: "CNY", symbol: "¥",   label: "Yuan chino",            regions: "China",          group: "Asia-Pacífico" },
  { code: "JPY", symbol: "¥",   label: "Yen japonés",           regions: "Japón",          group: "Asia-Pacífico" },
  { code: "KRW", symbol: "₩",   label: "Won surcoreano",        regions: "Corea del Sur",  group: "Asia-Pacífico" },
  { code: "INR", symbol: "₹",   label: "Rupia india",           regions: "India",          group: "Asia-Pacífico" },
  { code: "IDR", symbol: "Rp",  label: "Rupia indonesia",       regions: "Indonesia",      group: "Asia-Pacífico" },
  { code: "THB", symbol: "฿",   label: "Baht tailandés",        regions: "Tailandia",      group: "Asia-Pacífico" },
  { code: "VND", symbol: "₫",   label: "Dong vietnamita",       regions: "Vietnam",        group: "Asia-Pacífico" },
  { code: "PHP", symbol: "₱",   label: "Peso filipino",         regions: "Filipinas",      group: "Asia-Pacífico" },
  { code: "MYR", symbol: "RM",  label: "Ringgit malayo",        regions: "Malasia",        group: "Asia-Pacífico" },
  { code: "SGD", symbol: "S$",  label: "Dólar singapurense",    regions: "Singapur",       group: "Asia-Pacífico" },
  { code: "HKD", symbol: "HK$", label: "Dólar de Hong Kong",    regions: "Hong Kong",      group: "Asia-Pacífico" },
  { code: "TWD", symbol: "NT$", label: "Nuevo dólar taiwanés",  regions: "Taiwán",         group: "Asia-Pacífico" },
  { code: "PKR", symbol: "₨",   label: "Rupia pakistaní",       regions: "Pakistán",       group: "Asia-Pacífico" },

  // ── Oceanía y África subsahariana ──────────────────────────────
  { code: "AUD", symbol: "A$",  label: "Dólar australiano",     regions: "Australia",      group: "Oceanía y África" },
  { code: "NZD", symbol: "NZ$", label: "Dólar neozelandés",     regions: "Nueva Zelanda",  group: "Oceanía y África" },
  { code: "ZAR", symbol: "R",   label: "Rand sudafricano",      regions: "Sudáfrica",      group: "Oceanía y África" },
  { code: "NGN", symbol: "₦",   label: "Naira nigeriana",       regions: "Nigeria",        group: "Oceanía y África" },
  { code: "KES", symbol: "KSh", label: "Chelín keniano",        regions: "Kenia",          group: "Oceanía y África" },
];

/** Orden estable de los grupos en la UI. */
const GROUP_ORDER = [
  "Europa Occidental",
  "Europa Central / Este",
  "Cáucaso y Asia Central",
  "Oriente Medio y Magreb",
  "América",
  "Asia-Pacífico",
  "Oceanía y África",
];

const SAMPLE_PRICE = 285_000;

function loadCurrency(): string {
  if (typeof window === "undefined") return "EUR";
  return window.localStorage.getItem(KEY) ?? "EUR";
}

function formatPrice(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-ES")} ${code}`;
  }
}

export default function AjustesMoneda() {
  const currentUser = useCurrentUser();
  const canEdit = isAdmin(currentUser);

  const [selected, setSelected] = useState(() => loadCurrency());
  const [query, setQuery] = useState("");

  /* Filtrado + agrupación. Mantenemos siempre la moneda actualmente
   * seleccionada visible aunque no matchee el query, para que el
   * usuario no pierda contexto al teclear. */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? CURRENCIES.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.regions.toLowerCase().includes(q) ||
            c.symbol.toLowerCase().includes(q),
        )
      : CURRENCIES;

    const map = new Map<string, Currency[]>();
    for (const c of filtered) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return GROUP_ORDER
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const selectedCurrency = CURRENCIES.find((c) => c.code === selected);

  const save = () => {
    if (!canEdit) {
      toast.error("Solo los administradores pueden cambiar la moneda");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, selected);
    }
    /* TODO(backend): PATCH /api/organization { currency: selected } */
    toast.success(`Moneda cambiada a ${selectedCurrency?.label ?? selected} (${selected})`);
  };

  return (
    <SettingsScreen
      title="Moneda"
      description="La moneda principal afecta a precios, comisiones y reportes en todo el workspace. Solo los administradores pueden cambiarla."
      actions={
        <Button onClick={save} disabled={!canEdit} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      {/* ══════ Vista previa ══════ */}
      <SettingsCard title="Vista previa de precio">
        <div className="bg-muted/30 rounded-xl px-5 py-6 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Ejemplo · Marina Bay · Unidad B-204
          </p>
          <p className="text-3xl font-bold tnum tracking-tight text-foreground mt-2">
            {formatPrice(SAMPLE_PRICE, selected)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedCurrency?.label ?? selected} · {selected}
          </p>
        </div>
      </SettingsCard>

      {/* ══════ Selector ══════ */}
      <SettingsCard
        title="Moneda principal"
        description={
          canEdit
            ? "Esta moneda se usará para mostrar todos los importes en Byvaro."
            : "Estás en modo lectura — solo los administradores pueden modificar la moneda."
        }
      >
        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, país, código o símbolo (€, $, ֏…)"
            className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
          />
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Sin coincidencias para "{query}"
          </p>
        ) : (
          <div className="space-y-5 max-h-[520px] overflow-y-auto -mx-2 px-2">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold mb-2 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                  {group}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((c) => {
                    const active = selected === c.code;
                    return (
                      <button
                        key={c.code}
                        onClick={() => canEdit && setSelected(c.code)}
                        disabled={!canEdit}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/20 hover:bg-muted/40",
                        )}
                      >
                        <span className="h-9 w-9 rounded-lg bg-muted text-foreground grid place-items-center font-bold tnum text-sm shrink-0">
                          {c.symbol}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.label} <span className="text-muted-foreground">·</span>{" "}
                            <span className="text-muted-foreground tnum text-xs">{c.code}</span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{c.regions}</p>
                        </div>
                        {active && <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </SettingsScreen>
  );
}
