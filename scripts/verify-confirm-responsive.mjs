import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-confirm-responsive";
async function run(width, height, label) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log(`[${label} pageerror]`, e.message));
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.locator("main article").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  // Botón Registrar cliente puede ser FAB en móvil
  const btnSel = width >= 640
    ? p.locator("button", { hasText: "Registrar cliente" }).first()
    : p.locator("button:has(svg)").filter({ hasText: /^$/ }).last();
  const btnRegistrar = p.locator("button", { hasText: "Registrar cliente" }).first();
  if (await btnRegistrar.count() && await btnRegistrar.isVisible()) {
    await btnRegistrar.click();
  } else {
    // FAB móvil — click el botón flotante
    await p.locator("[aria-label='Acciones']").first().click().catch(() => {});
    await p.waitForTimeout(300);
    await p.locator("button", { hasText: "Registrar cliente" }).first().click().catch(() => {});
  }
  await p.waitForTimeout(500);
  await p.locator("input[placeholder*='Buscar por nombre']").fill("Nuevo Cliente Agencia");
  await p.waitForTimeout(300);
  await p.locator("[role='dialog'] button", { hasText: "Crear nuevo contacto" }).first().click();
  await p.waitForTimeout(400);
  // Rellenar PIN
  const inputs = await p.locator("[role='dialog'] input").all();
  await inputs[1].fill("5");
  await inputs[2].fill("6");
  await inputs[3].fill("7");
  await inputs[4].fill("8");
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
  await browser.close();
  console.log(`✅ ${label} (${width}x${height})`);
}
await run(1440, 900, "desktop");
await run(375, 812, "mobile");
