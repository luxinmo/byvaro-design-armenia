import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-confirm-agency";
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });

  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  await p.locator("button", { hasText: "Registrar cliente" }).first().click();
  await p.waitForTimeout(400);

  // A) Cliente existente: buscar Carlos
  await p.locator("input[placeholder*='Buscar por nombre']").fill("Carlos");
  await p.waitForTimeout(400);
  await p.locator("[role='dialog'] button", { hasText: "Carlos García" }).first().click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/1-existing.png`, fullPage: true });

  // Volver atrás
  await p.locator("[role='dialog'] button", { hasText: "Cambiar cliente" }).click();
  await p.waitForTimeout(300);

  // B) Cliente nuevo: escribir en el buscador el nombre y arrastrarlo al modal
  await p.locator("input[placeholder*='Buscar por nombre']").fill("María Gómez Ruiz");
  await p.waitForTimeout(400);
  await p.locator("[role='dialog'] button", { hasText: "Crear nuevo contacto" }).first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/2-new-prefilled.png`, fullPage: true });

  // Completar las 4 cifras del teléfono
  const inputs = await p.locator("[role='dialog'] input").all();
  // inputs[0] = nombre (ya pre-rellenado), inputs[1..4] = las 4 casillas OTP
  await inputs[1].fill("5");
  await inputs[2].fill("6");
  await inputs[3].fill("7");
  await inputs[4].fill("8");
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/3-new-filled.png`, fullPage: true });

  // Click en el link "términos del registro" para abrir el modal legal
  await p.locator("button", { hasText: "términos del registro" }).first().click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/4-terms-modal.png`, fullPage: false });

  console.log("✅ OK");
  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
