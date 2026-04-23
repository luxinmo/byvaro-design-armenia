import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-invitaciones-pendientes";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
// Limpia localStorage de invitaciones previas para forzar seed
await p.evaluate(() => {
  localStorage.removeItem("byvaro-invitaciones");
  localStorage.removeItem("byvaro.invitaciones.seeded.v1");
});
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.goto(`${BASE}/promociones/dev-1`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.locator("button, a").filter({ hasText: /^Agencias/ }).first().click();
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/agencias-con-invitaciones.png`, fullPage: true });
console.log("✓");
await b.close();
