import { chromium } from "playwright";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_equipo_audit";
const VPS = [{w:375,h:812},{w:414,h:896},{w:768,h:1024},{w:1024,h:800},{w:1440,h:900}];
const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addInitScript(() => { try { localStorage.removeItem("byvaro.equipo.viewMode.v1"); } catch(e){} });
const page = await ctx.newPage();
for (const vp of VPS) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto("http://localhost:8080/equipo", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  try {
    const gBtn = page.locator("button:has-text(\"Galería\")").first();
    if (await gBtn.count() > 0) { await gBtn.click(); await page.waitForTimeout(400); }
  } catch(e){}
  await page.screenshot({ path: `${OUT}/equipo-gallery-${vp.w}.png`, fullPage: true });
  console.log("gallery ok " + vp.w);
}
await browser.close();
