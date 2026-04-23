/**
 * Compara visualmente la ficha de promoción entre vista Promotor y Agencia,
 * enfocándose en el layout del rail "Acciones rápidas".
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-rail-check";

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── Tab Promotor ─────────────────────────────────────
  const ctxP = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctxP.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });

  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/promotor-ficha.png`, fullPage: true });

  // ── Tab Agencia ──────────────────────────────────────
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctxA.newPage();
  await a.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await a.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await a.waitForURL(/\/inicio/, { timeout: 5000 });

  await a.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await a.waitForTimeout(500);
  await a.locator("main article.cursor-pointer").first().click();
  await a.waitForTimeout(1200);
  await a.screenshot({ path: `${OUT}/agencia-ficha.png`, fullPage: true });

  // Check structural: el rail debería estar a la derecha, no abajo
  const railBoxA = await a.locator("text=Acciones rápidas").first().boundingBox();
  const mainA = await a.locator("section:has-text('Multimedia'), [class*='flex-1']").first().boundingBox();
  console.log("Agency rail position:", railBoxA);
  console.log("Agency main position:", mainA);
  if (railBoxA && mainA) {
    const sideBySide = railBoxA.x > mainA.x + mainA.width - 50;
    console.log(sideBySide ? "✅ Agencia: rail AL LADO del contenido" : "❌ Agencia: rail DEBAJO del contenido");
  }

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
