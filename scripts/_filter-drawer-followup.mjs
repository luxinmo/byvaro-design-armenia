import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/filter-drawer";

const browser = await chromium.launch();

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "arman@byvaro.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(inicio|registros|promociones)/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// Inspect Registros agency search placeholder
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Filtros")').first().click();
  await page.waitForTimeout(500);
  const placeholders = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({ ph: i.placeholder, type: i.type, visible: i.offsetParent !== null }));
  });
  console.log("REGISTROS inputs:", JSON.stringify(placeholders, null, 2));
  await ctx.close();
}

// Inspect Promociones drawer after click
for (const vp of [{ w: 1440, h: 900, tag: "1440" }, { w: 375, h: 812, tag: "375" }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[promo-${vp.tag}] pageerror:`, e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log(`[promo-${vp.tag}] console.error:`, m.text()); });

  await login(page);
  await page.goto(BASE + "/promociones", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const filterBtn = page.locator('button:has-text("Filtros")').first();
  const cnt = await filterBtn.count();
  console.log(`PROMO ${vp.tag}: Filtros btn count =`, cnt);
  if (cnt) {
    await filterBtn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/22-promociones-${vp.tag}-drawer-detail.png`, fullPage: false });

    const info = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const out = dialogs.map(d => {
        const r = d.getBoundingClientRect();
        const cs = getComputedStyle(d);
        return {
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          position: cs.position, dataState: d.getAttribute("data-state"),
          textSnippet: (d.textContent || "").slice(0, 200),
        };
      });
      return { dialogs: out, iw: window.innerWidth, ih: window.innerHeight };
    });
    console.log(`PROMO ${vp.tag} dialogs:`, JSON.stringify(info, null, 2));
  }
  await ctx.close();
}

await browser.close();
