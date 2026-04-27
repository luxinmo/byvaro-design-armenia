import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_registros_fullscreen_test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// Click first card
await page.evaluate(() => {
  const main = document.querySelector('main') || document.body;
  const cards = main.querySelectorAll('button, [role="button"], article');
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (r.width >= 250 && r.height >= 60 && r.height <= 200 && r.x < 100) {
      const t = c.textContent || "";
      if (t.length > 10 && !t.includes("Pendientes 14") && !t.includes("Comercial")) {
        c.click();
        return;
      }
    }
  }
});
await page.waitForTimeout(800);

// Click ONLY the back button by aria-label
const backResult = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Volver a la lista"]');
  if (!btn) return { ok: false };
  btn.click();
  return { ok: true };
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-post-back.png`, fullPage: false });

const post = await page.evaluate(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  // Largest fixed element check — should NOT cover viewport anymore
  const all = document.querySelectorAll('*');
  let largest = null, area = 0;
  for (const el of all) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") continue;
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width >= vw * 0.8 && r.height >= vh * 0.5) {
      const a = r.width * r.height;
      if (a > area) { area = a; largest = { tag: el.tagName, cls: (typeof el.className === "string" ? el.className : "").slice(0,150), z: cs.zIndex }; }
    }
  }
  const findText = (txt) => {
    const els = Array.from(document.querySelectorAll('*')).filter(e => (e.textContent||"").includes(txt) && (e.textContent||"").length<150);
    for (const el of els) { const r = el.getBoundingClientRect(); const cs = window.getComputedStyle(el);
      if (r.width>0 && r.height>0 && cs.display!=="none" && r.y<vh) return true;
    } return false;
  };
  const navs = document.querySelectorAll('nav');
  let bn = null;
  for (const n of navs) { const cs = window.getComputedStyle(n); const r = n.getBoundingClientRect();
    if (cs.position==="fixed" && r.bottom>=vh-5 && r.width>200) { bn = { y: r.y, h: r.height, visible: cs.display!=="none" }; break; }
  }
  return { largestFixed: largest, breadcrumb: findText("Comercial"), pendientes14: findText("Pendientes 14"), bottomNav: bn, url: location.pathname + location.search };
});
console.log(JSON.stringify({ backResult, post }, null, 2));
await browser.close();
