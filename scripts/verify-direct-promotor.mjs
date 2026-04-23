import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-direct-promotor";
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
  // Pick "Cliente directo"
  await p.locator("[role='dialog'] button", { hasText: "Cliente directo" }).click();
  await p.waitForTimeout(300);
  // Escribir nombre en el buscador
  await p.locator("input[placeholder*='Buscar por nombre']").fill("Pedro Núñez Vera");
  await p.waitForTimeout(400);
  // Crear nuevo contacto
  await p.locator("[role='dialog'] button", { hasText: "Crear nuevo contacto" }).first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/1-create-prefilled.png`, fullPage: true });

  // 4 cifras PIN
  const inputs = await p.locator("[role='dialog'] input").all();
  if (inputs[1]) await inputs[1].fill("5");
  if (inputs[2]) await inputs[2].fill("6");
  if (inputs[3]) await inputs[3].fill("7");
  if (inputs[4]) await inputs[4].fill("8");
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/2-create-full.png`, fullPage: true });

  // Activar "Añadir visita" y abrir el selector de host
  await p.locator("[role='dialog'] button", { hasText: /Añadir visita/ }).click();
  await p.waitForTimeout(400);
  await p.locator("[role='dialog'] button", { hasText: /Selecciona miembro|Arman|^\w+ \w+$/ }).nth(-1).click().catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/3-visit-host-list.png` });
  console.log("✅ OK");
  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
