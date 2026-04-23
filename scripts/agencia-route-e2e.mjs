/**
 * E2E · Ruta `/agencia` (picker + atajo directo).
 * Verifica que dos pestañas (promotor + agencia) no se pisan gracias a
 * sessionStorage, y que `/agencia/:id` redirige directo a /inicio.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-agencia-route";

const log = (msg, ok) => console.log(`${ok === false ? "❌" : ok === "warn" ? "🟡" : "✅"} ${msg}`);

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── Tab A: entra por /agencia → picker ──────────────────────────
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctxA.newPage();
  a.on("pageerror", (e) => console.log("  [A pageerror]", e.message));
  await a.goto(`${BASE}/agencia`, { waitUntil: "networkidle" });
  await a.waitForTimeout(500);
  const picker = await a.locator("body").innerText();
  log(`[Tab A] Picker muestra 4 agencias`,
    ["Prime Properties", "Nordic Home Finders", "Dutch & Belgian", "Meridian"].every((n) =>
      picker.includes(n),
    ));
  await a.screenshot({ path: `${OUT}/A1-picker.png` });

  // click Nordic Home Finders (ag-2) en tab A
  await a.locator("button", { hasText: "Nordic Home Finders" }).first().click();
  await a.waitForURL(/\/inicio$/, { timeout: 5000 });
  await a.waitForTimeout(400);
  const aHeaderText = await a.locator("header").first().innerText();
  log(`[Tab A] Redirige a /inicio con pill "Agencia · Nordic..." (visto: "${aHeaderText.slice(0, 120)}")`,
    aHeaderText.includes("Agencia") && aHeaderText.includes("Nordic"));
  await a.screenshot({ path: `${OUT}/A2-inicio-nordic.png` });

  // ── Tab B: en paralelo, /agencia/ag-1 (atajo directo a Prime Properties) ──
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const b = await ctxB.newPage();
  b.on("pageerror", (e) => console.log("  [B pageerror]", e.message));
  await b.goto(`${BASE}/agencia/ag-1`, { waitUntil: "networkidle" });
  await b.waitForURL(/\/inicio$/, { timeout: 5000 });
  await b.waitForTimeout(400);
  const bHeaderText = await b.locator("header").first().innerText();
  log(`[Tab B] Atajo directo /agencia/ag-1 → pill "Prime Properties" (visto: "${bHeaderText.slice(0, 120)}")`,
    bHeaderText.includes("Agencia") && bHeaderText.includes("Prime"));
  await b.screenshot({ path: `${OUT}/B1-inicio-prime.png` });

  // ── Tab A sigue siendo Nordic, Tab B es Prime (aislamiento sessionStorage) ──
  const aHeaderAfter = await a.locator("header").first().innerText();
  log(`[Aislamiento] Tab A sigue en Nordic tras abrir Tab B`,
    aHeaderAfter.includes("Nordic") && !aHeaderAfter.includes("Prime"));

  // ── Tab C: ruta promotor (sin /agencia) → sesión limpia como Promotor ──
  const ctxC = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const c = await ctxC.newPage();
  c.on("pageerror", (e) => console.log("  [C pageerror]", e.message));
  await c.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await c.waitForTimeout(400);
  const cHeaderText = await c.locator("header").first().innerText();
  log(`[Tab C] /inicio directo es Promotor (visto: "${cHeaderText.slice(0, 80)}")`,
    cHeaderText.includes("Promotor"));
  await c.screenshot({ path: `${OUT}/C1-inicio-promotor.png` });

  // ── Tab B: navega a /registros (debe estar scopeada a Prime ag-1) ──────
  await b.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await b.waitForTimeout(500);
  const bRegText = await b.locator("body").innerText();
  // ag-1 tiene registros con Émilie Rousseau, James O'Connor, Sofía Martínez, Pierre Lefèvre, Katarzyna Nowak, Johan De Vries
  const scopeOk = bRegText.includes("Émilie") || bRegText.includes("James") || bRegText.includes("Pierre");
  log(`[Tab B] /registros scopeada a Prime Properties`, scopeOk);
  await b.screenshot({ path: `${OUT}/B2-registros-prime.png` });

  // ── Tab B: /promociones debe mostrar SOLO las de Prime (2 cards) ──
  await b.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await b.waitForTimeout(500);
  const cards = await b.locator("main article.cursor-pointer").count();
  log(`[Tab B] /promociones muestra 2 cards (Prime colabora en dev-1, dev-2)`, cards === 2);
  await b.screenshot({ path: `${OUT}/B3-promos-prime.png` });

  // ── Tab A: /promociones debe mostrar SOLO las de Nordic (ag-2, dev-1..4) ──
  await a.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await a.waitForTimeout(500);
  const aCards = await a.locator("main article.cursor-pointer").count();
  log(`[Tab A] /promociones muestra 4 cards (Nordic colabora en dev-1, 2, 3, 4)`, aCards === 4);
  await a.screenshot({ path: `${OUT}/A3-promos-nordic.png` });

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
