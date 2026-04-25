import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:8080";
const OUT = "screenshots/_registros_v3";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();

const errs = [];
page.on("pageerror", (e) => errs.push("PE: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CE: " + m.text()); });

// 1) Login
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);
await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// === DETAIL: click first card body (avoid filtros / checkbox) ===
const cards = await page.locator('article').all();
console.log("[articles count]", cards.length);
if (cards.length) {
  // Click first card on the name area (right side of the avatar)
  const box = await cards[0].boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width - 40, box.y + 30);
    await page.waitForTimeout(900);
  }
}
const m1 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log("[detail-open]", m1);
await page.screenshot({ path: join(OUT, "10-detail-full.png"), fullPage: true });
await page.screenshot({ path: join(OUT, "11-detail-top.png"), fullPage: false, clip: { x: 0, y: 0, width: 375, height: 400 } });

// Detail sticky footer? Scroll to bottom then capture
const inner = await page.evaluate(() => {
  const el = document.querySelector('[data-scroll-container], main, .overflow-auto');
  if (!el) return null;
  el.scrollTop = el.scrollHeight;
  return { sh: el.scrollHeight, st: el.scrollTop };
});
console.log("[detail-scroll]", inner);
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, "12-detail-bottom.png"), fullPage: false });

// Find Aprobar/Rechazar buttons location
const btnInfo = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('button'));
  const find = (re) => all.filter((b) => re.test((b.textContent || "").trim())).map((b) => {
    const r = b.getBoundingClientRect();
    return { text: b.textContent.trim().slice(0, 30), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    aprobar: find(/^Aprobar/i),
    rechazar: find(/^Rechazar/i),
    pendiente: find(/^Pendiente/i),
  };
});
console.log("[detail btns]", JSON.stringify(btnInfo, null, 2));

// === BULK BAR: go back to list, select 2 ===
await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const articles2 = await page.locator('article').all();
// Click checkbox button (first child button) of first 2 articles
for (let i = 0; i < Math.min(2, articles2.length); i++) {
  const cb = articles2[i].locator('button').first();
  await cb.click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
}
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, "20-bulk-list.png"), fullPage: false });

// Locate bulk bar
const bulkInfo = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('div, section, footer'));
  const fixed = all.filter((el) => {
    const cs = getComputedStyle(el);
    return cs.position === "fixed" && el.getBoundingClientRect().bottom > 600;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, classes: (el.className || "").toString().slice(0, 80), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), txt: (el.textContent || "").trim().slice(0, 80) };
  });
  return fixed.slice(0, 10);
});
console.log("[fixed bottom els]", JSON.stringify(bulkInfo, null, 2));

// MobileBottomNav location
const navInfo = await page.evaluate(() => {
  const nav = document.querySelector('nav.fixed, [data-mobile-nav], .fixed.bottom-0');
  if (!nav) return null;
  const r = nav.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log("[mobile nav]", navInfo);

console.log("\n--- ERRORS ---");
console.log(errs.length ? errs.join("\n") : "(none)");
await browser.close();
