import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_equipo_audit";
const VPS = [{w:375,h:812},{w:414,h:896},{w:768,h:1024},{w:1024,h:800},{w:1440,h:900}];
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await mkdir(OUT, { recursive: true });
for (const vp of VPS) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto("http://localhost:8080/equipo", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  try {
    await page.locator("button:has-text(\"Añadir miembro\")").first().click({ timeout: 8000 });
    await page.waitForTimeout(500);
    // Click 2nd role=radio in dialog (Crear cuenta)
    const btn = page.locator("[role=\"dialog\"] [role=\"radio\"]").nth(1);
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/InviteDialog-crear-${vp.w}.png`, fullPage: true });
    console.log("crear tab shot " + vp.w);
  } catch (e) { console.log("FAIL " + vp.w + " " + e.message.split("\\n")[0]); }
}
await browser.close();
