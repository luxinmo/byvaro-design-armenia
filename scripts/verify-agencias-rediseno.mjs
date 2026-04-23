import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-agencias-redesign";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
// Reset seeds
await p.evaluate(() => {
  localStorage.removeItem("byvaro-invitaciones");
  localStorage.removeItem("byvaro.invitaciones.seeded.v1");
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.goto(`${BASE}/promociones/dev-1`, { waitUntil: "networkidle" });
await p.waitForTimeout(600);
await p.locator("button, a").filter({ hasText: /^Agencias/ }).first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/01-tab-stats.png`, fullPage: true });

// Abrir dialog pendientes
const btn = p.locator("button", { hasText: /Pendientes/ }).first();
if (await btn.count()) {
  await btn.click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/02-dialog-pendientes.png`, fullPage: false });
}
console.log("✓");
await b.close();
