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
  await page.waitForTimeout(600);
  await shot(page, `${vp.name}-1-home`);

  // Hover cover para ver el botón editar portada
  if (vp.name === "desktop") {
    await page.locator(".relative.h-48").first().hover().catch(() => {});
    await page.waitForTimeout(200);
    await shot(page, `${vp.name}-2-cover-hover`);

    // Click editar portada → abre modal
    await page.getByRole("button", { name: /portada/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `${vp.name}-3-modal-cover`);

    // Cerrar modal
    await page.getByRole("button", { name: /Cerrar/i }).click().catch(() => {});
    await page.waitForTimeout(300);

    // Hover logo
    await page.locator(".h-\\[100px\\], .sm\\:h-\\[120px\\]").first().hover().catch(() => {});
    await page.waitForTimeout(200);

    // Click logo → abre modal
    await page.locator("button", { hasText: /Editar/i }).filter({ has: page.locator(".lucide-camera") }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `${vp.name}-4-modal-logo`);
  }

  await ctx.close();
}

await browser.close();
console.log("done");
