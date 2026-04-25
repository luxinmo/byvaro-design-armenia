import { chromium } from "playwright";
const browser = await chromium.launch();

async function login(page) {
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "arman@byvaro.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
}

for (const vp of [{ w: 1440, h: 900, tag: "1440" }, { w: 375, h: 812, tag: "375" }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto("http://localhost:8080/promociones", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Snapshot DOM-children count BEFORE click
  const before = await page.evaluate(() => document.body.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"], [data-state="open"]').length);
  await page.locator('button:has-text("Filtros")').first().click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"], [data-state="open"], [data-vaul-drawer], [aria-modal="true"]'));
    return els.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        role: el.getAttribute("role"),
        ariaModal: el.getAttribute("aria-modal"),
        dataState: el.getAttribute("data-state"),
        dataVaul: el.hasAttribute("data-vaul-drawer"),
        position: cs.position,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        text: (el.textContent || "").slice(0, 150),
      };
    });
  });
  console.log(`PROMO ${vp.tag} before=${before} | after click:`, JSON.stringify(after, null, 2));
  await page.screenshot({ path: `/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/filter-drawer/30-promo-${vp.tag}-deep.png` });
  await ctx.close();
}
await browser.close();
