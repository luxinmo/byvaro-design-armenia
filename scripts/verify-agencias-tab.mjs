import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-agencias-tab";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
// Promoción con agencias invitadas
await p.goto(`${BASE}/promociones/dev-1`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const tab = p.locator("button, a").filter({ hasText: /^Agencias/ }).first();
if (await tab.count()) {
  await tab.click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/dev-1-agencias.png`, fullPage: true });
  console.log("✓ dev-1 tab agencias");
} else {
  console.log("⚠ no tab Agencias en dev-1");
}
// Vista general de dev-1
await p.goto(`${BASE}/promociones/dev-1`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/dev-1-overview.png`, fullPage: true });
await b.close();
