import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-unpublish";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });

// 1. Listado — tag de estado real (no más "Activa" crudo)
await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/01-listado.png`, fullPage: true });

// 2. Ficha dev-1 (Villa Serena) — realmente publicable
await p.goto(`${BASE}/promociones/dev-1`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/02-publicada.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 250 } });

// Click en el badge Publicada
const badge = p.locator("button", { hasText: /Publicada/ }).first();
if (await badge.count()) {
  await badge.click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/03-confirm-despublicar.png`, fullPage: false });

  // Confirmar
  const ok = p.locator("button", { hasText: /Despublicar/ }).last();
  if (await ok.count()) {
    await ok.click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/04-tras-despublicar.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  }
}
console.log("✓");
await b.close();
