/**
 * Phase 2 E2E · verifica que tras login, los stores legacy se hidraten
 * con datos de Supabase (registros, sales, calendar, notifications,
 * favoritos).
 */
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:8080";
const PASSWORD = "Luxinmo2026Byvaro";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(3500);

const stores = await page.evaluate(() => {
  const keys = [
    "byvaro.registros.created.v1",
    "byvaro.sales.created.v1",
    "byvaro.calendar.created.v1",
    "byvaro.notifications.v1",
    "byvaro-favoritos-agencias",
    "byvaro-empresa:developer-default",
    "byvaro-oficinas:developer-default",
    "byvaro.org-collab-requests.v1",
  ];
  const out = {};
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) {
      try {
        const parsed = JSON.parse(v);
        out[k] = Array.isArray(parsed) ? `array[${parsed.length}]` : "object";
      } catch {
        out[k] = "raw";
      }
    } else {
      out[k] = "null";
    }
  }
  return out;
});

console.log("\n══ Hidratación de stores tras login (arman@byvaro.com) ══\n");
for (const [k, v] of Object.entries(stores)) {
  console.log(`  ${v.startsWith("array[") || v === "object" ? "✓" : "✗"} ${k.padEnd(45)} → ${v}`);
}

// Visita /registros y /ventas para verificar que se renderizan
await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const registroRows = await page.locator("[role='row'], article, li").count();
console.log(`\n  /registros · ${registroRows} elementos en lista`);

await page.goto(`${BASE}/ventas`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const ventaRows = await page.locator("[role='row'], article, li").count();
console.log(`  /ventas · ${ventaRows} elementos en lista`);

await page.goto(`${BASE}/calendario`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const calRows = await page.locator("[role='gridcell'], article").count();
console.log(`  /calendario · ${calRows} elementos`);

await ctx.close();
await browser.close();
