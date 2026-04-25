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
  await page.locator('button:has-text("Filtros")').first().click();
  await page.waitForTimeout(700);

  const info = await page.evaluate(() => {
    // Find ANY element whose text starts with "Filtros" and has a sibling section with sliders/chips
    const all = Array.from(document.querySelectorAll('*'));
    const candidates = all.filter(el => {
      const t = (el.textContent || "").trim();
      if (!t.startsWith("Filtros")) return false;
      if (el.children.length < 2) return false;
      const r = el.getBoundingClientRect();
      return r.width > 200 && r.height > 200;
    });
    // pick the smallest one (innermost)
    candidates.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    const best = candidates[0];
    if (!best) return null;
    const r = best.getBoundingClientRect();
    const cs = getComputedStyle(best);
    return {
      tag: best.tagName,
      cls: best.className,
      role: best.getAttribute("role"),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      iw: window.innerWidth, ih: window.innerHeight,
      position: cs.position,
      hasLimpiar: best.textContent.includes("Limpiar"),
      hasVer: /Ver \d+ resultado/.test(best.textContent),
    };
  });
  console.log(`PROMO ${vp.tag}:`, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
