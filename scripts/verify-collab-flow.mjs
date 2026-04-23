import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-collab-flow";
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  await p.locator("button", { hasText: "Registrar cliente" }).first().click();
  await p.waitForTimeout(300);

  // Click "A través de colaborador"
  await p.locator("[role='dialog'] button", { hasText: "A través de colaborador" }).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/1-buscar-cliente.png`, fullPage: false });

  // Escribir nombre y crear nuevo
  await p.locator("input[placeholder*='Buscar por nombre']").fill("Juan Pérez");
  await p.waitForTimeout(300);
  await p.locator("[role='dialog'] button", { hasText: "Crear nuevo contacto" }).first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/2-crear-contacto.png`, fullPage: false });

  // Rellenar teléfono
  const inputs = await p.locator("[role='dialog'] input").all();
  await inputs[1].fill("+34 600 111 222");
  // Nacionalidad
  await p.locator("[role='dialog'] button", { hasText: /Selecciona nacionalidad/ }).click();
  await p.waitForTimeout(300);
  await p.locator("[role='dialog'] button", { hasText: "Spanish" }).first().click();
  await p.waitForTimeout(200);
  // Click Continuar del create
  await p.locator("[role='dialog'] button", { hasText: /^Continuar$/ }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/3-datos-registro.png`, fullPage: false });

  // Click "Continuar →" (del confirm) para pasar a colaborador
  await p.locator("[role='dialog'] button", { hasText: /^Continuar$/ }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/4-buscar-colaborador.png`, fullPage: false });

  console.log("✅ OK");
  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
