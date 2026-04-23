import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-promo4";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
await p.goto(`${BASE}/promociones/4`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/01-overview.png`, fullPage: true });
// Tab Comisiones
const tab = p.locator("button, a").filter({ hasText: /^Comisiones$/ }).first();
if (await tab.count()) {
  await tab.click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/02-comisiones.png`, fullPage: true });
}
console.log("✓");
await b.close();
