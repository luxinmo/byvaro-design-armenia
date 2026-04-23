import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-promotor-anejos";
await mkdir(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });

  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  console.log("📍 URL:", p.url());

  // Disponibilidad
  await p.locator("button, a").filter({ hasText: /^Disponibilidad$/ }).first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/01-viviendas.png`, fullPage: true });

  // Parkings
  const park = p.locator("button", { hasText: /^Parkings/ }).first();
  if (await park.count()) {
    await park.click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/02-parkings.png`, fullPage: true });
    console.log("✓ Parkings segment OK");
  } else {
    console.log("⚠ No hay segmento Parkings");
  }

  // Trasteros
  const tras = p.locator("button", { hasText: /^Trasteros/ }).first();
  if (await tras.count()) {
    await tras.click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/03-trasteros.png`, fullPage: true });
    console.log("✓ Trasteros segment OK");
  } else {
    console.log("⚠ No hay segmento Trasteros");
  }

  console.log(`📸 ${OUT}`);
  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
