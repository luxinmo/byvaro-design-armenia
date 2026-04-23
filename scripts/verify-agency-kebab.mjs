import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-agency-kebab";
await mkdir(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));

  // Login como agencia
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });

  // Primera promoción
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(600);

  // Tab Disponibilidad / Unidades
  const tab = p.locator("button, a").filter({ hasText: /Disponibilidad/ }).first();
  if (await tab.count()) await tab.click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/01-disponibilidad.png`, fullPage: true });

  // Click en el primer MoreVertical de fila
  const kebabs = p.locator("table tbody button").filter({ has: p.locator("svg") });
  const kebabCount = await kebabs.count();
  // Buscamos el botón que sea el MoreVertical de la fila (posición fija en cada tr)
  const rows = p.locator("table tbody tr");
  if (await rows.count() > 0) {
    const firstRowKebab = rows.first().locator("button").last();
    await firstRowKebab.click({ force: true }).catch(() => {});
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/02-viviendas-kebab.png`, fullPage: false });
  }
  console.log(`📸 ${OUT}`);

  // Segmento Parkings (si existe)
  const parkSeg = p.locator("button", { hasText: /^Parkings/ }).first();
  if (await parkSeg.count()) {
    await parkSeg.click();
    await p.waitForTimeout(600);
    const rows2 = p.locator("table tbody tr");
    if (await rows2.count() > 0) {
      const k2 = rows2.first().locator("button").last();
      await k2.click({ force: true }).catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/03-parkings-kebab.png`, fullPage: false });
    }
  }

  await browser.close();
  console.log("✅ done");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
