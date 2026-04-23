import { chromium } from "playwright";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_equipo_audit";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
for (const w of [375, 414, 768]) {
  await page.setViewportSize({ width: w, height: w === 375 ? 812 : (w === 414 ? 896 : 1024) });
  await page.goto("http://localhost:8080/equipo", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("button:has-text(\"Añadir miembro\")").first().click();
  await page.waitForTimeout(400);
  await page.locator("[role=\"dialog\"] [role=\"radio\"]").nth(1).click();
  await page.waitForTimeout(400);
  // Scroll inside dialog body
  await page.evaluate(() => {
    const body = document.querySelector("[role=\"dialog\"] .overflow-y-auto");
    if (body) body.scrollTop = 600;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/InviteDialog-crear-scrolled-${w}.png`, fullPage: false });
  console.log("scrolled " + w);
}
await browser.close();
