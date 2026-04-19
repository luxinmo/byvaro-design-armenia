import { chromium } from "playwright";
import fs from "fs";

const OUT = "/tmp/screenshots";
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).forEach(f => fs.unlinkSync(`${OUT}/${f}`));

const URL_BASE = "http://localhost:8080";
const VIEWPORTS = [
  { name: "desktop", width: 1600, height: 900 },
  { name: "mobile",  width: 390,  height: 844 },
];

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}.png`);
}

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  await page.goto(`${URL_BASE}/empresa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, `${vp.name}-1-empresa-home`);

  // Click Invitar agencia (botón primario hero)
  await page.getByRole("button", { name: /Invitar agencia/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, `${vp.name}-2-modal-datos`);

  // Rellenar datos
  await page.locator('input[placeholder*="tuagencia"]').fill("test@agencia.com");
  await page.locator('input[placeholder*="Costa Invest"]').fill("Costa Invest Homes");
  await page.waitForTimeout(200);
  await shot(page, `${vp.name}-3-modal-datos-filled`);

  // Avanzar
  await page.getByRole("button", { name: /Siguiente/i }).click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-4-modal-condiciones`);

  // Crear
  await page.getByRole("button", { name: /Crear invitación/i }).click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-5-modal-preview`);

  // Cerrar modal
  await page.getByRole("button", { name: /Cerrar/i }).click().catch(() => {});
  await page.waitForTimeout(400);

  // Scroll al final para ver sidebar con invitación pendiente
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-6-bottom-with-invitation`);

  await ctx.close();
}

await browser.close();
console.log("done");
