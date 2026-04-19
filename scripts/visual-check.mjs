import { chromium } from "playwright";
import fs from "fs";

const OUT = "/tmp/screenshots";
fs.mkdirSync(OUT, { recursive: true });
// Limpiamos screenshots previos
fs.readdirSync(OUT).forEach(f => fs.unlinkSync(`${OUT}/${f}`));

const URL_BASE = "http://localhost:8080";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile",  width: 390,  height: 844 },
];

async function shot(page, name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`✓ ${name}.png`);
}

const browser = await chromium.launch({ headless: true });
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  let logoChooserFired = false;
  let coverChooserFired = false;
  page.on("filechooser", async (chooser) => {
    if (!logoChooserFired) logoChooserFired = true;
    else if (!coverChooserFired) coverChooserFired = true;
    await chooser.setFiles([]).catch(() => {});
  });

  // /empresa home
  await page.goto(`${URL_BASE}/empresa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, `${vp.name}-1-home`);

  // Preview mode
  await page.getByText("Ver como usuario").click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-2-preview`);
  await page.getByText("Volver a editar").click().catch(() => {});
  await page.waitForTimeout(300);

  // Tabs
  await page.getByRole("button", { name: "Sobre nosotros" }).click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-3-about`);

  await page.getByRole("button", { name: "Agentes" }).click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-4-agents`);

  await page.getByRole("button", { name: "Inicio" }).first().click().catch(() => {});
  await page.waitForTimeout(300);

  // Test logo picker (desktop: hover + click del botón Upload dentro del círculo)
  if (vp.name === "desktop") {
    await page.locator(".rounded-full.border-\\[5px\\]").first().hover().catch(() => {});
    await page.waitForTimeout(200);
    try {
      await Promise.race([
        page.waitForEvent("filechooser", { timeout: 2000 }),
        page.locator(".rounded-full.border-\\[5px\\]").locator("xpath=..").locator("button").first().click({ force: true }),
      ]);
    } catch (e) {}
    await page.waitForTimeout(300);

    // Cover picker
    await page.locator(".h-48, .h-56, .sm\\:h-56").first().hover().catch(() => {});
    await page.waitForTimeout(200);
    try {
      await Promise.race([
        page.waitForEvent("filechooser", { timeout: 2000 }),
        page.getByRole("button", { name: /portada/i }).first().click({ force: true }),
      ]);
    } catch (e) {}
    await page.waitForTimeout(300);
  }

  // Scroll al final
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-5-home-bottom`);

  // Editar oficinas
  await page.getByRole("button", { name: /^Editar$/i }).last().click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-6-oficinas-edit`);

  await page.getByText("Añadir oficina").click().catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-7-oficinas-new`);

  results.push({ viewport: vp.name, logoChooserFired, coverChooserFired });
  await ctx.close();
}

await browser.close();

console.log("\n=== RESULTADOS ===");
console.log(JSON.stringify(results, null, 2));
console.log("done");
