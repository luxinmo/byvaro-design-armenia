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

async function metrics(label) {
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  console.log(`[${label}] scrollWidth=${m.sw} clientWidth=${m.cw} overflow=${m.sw > m.cw}`);
  return m;
}

// 1) Login
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(/\/inicio|\/registros|\/promociones|\//, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);

// 2) Go to /registros
await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await metrics("registros-default");
await page.screenshot({ path: join(OUT, "01-default.png"), fullPage: true });

// Header zoom (top 250px)
await page.screenshot({ path: join(OUT, "02-header.png"), fullPage: false, clip: { x: 0, y: 0, width: 375, height: 250 } });

// 3) Toolbar inspection — find all interactive elements widths
const toolbarInfo = await page.evaluate(() => {
  // Try to find tabs row / filter pills
  const els = Array.from(document.querySelectorAll('button, [role="tab"]'));
  return els.slice(0, 30).map((e) => ({
    text: (e.textContent || "").trim().slice(0, 30),
    rect: e.getBoundingClientRect(),
  })).filter((x) => x.rect.top < 220);
});
console.log("[toolbar btns]", JSON.stringify(toolbarInfo.slice(0, 20), null, 2));

// 4) Open Filtros drawer
const filtrosBtn = await page.locator('button:has-text("Filtros")').first();
if (await filtrosBtn.count()) {
  await filtrosBtn.click();
  await page.waitForTimeout(700);
  await metrics("filters-open");
  await page.screenshot({ path: join(OUT, "03-filtros-open.png"), fullPage: false });
  // Sticky footer view
  await page.screenshot({ path: join(OUT, "04-filtros-bottom.png"), fullPage: false, clip: { x: 0, y: 600, width: 375, height: 212 } });
  // Close
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
}

// 5) Open detail of first card
const firstCard = await page.locator('[data-testid="record-card"], .cursor-pointer').first();
// Try clicking first record (avoid checkbox)
const cardClick = await page.evaluate(() => {
  // Find first card-like element with a person name
  const candidates = Array.from(document.querySelectorAll('button, [role="button"], div'));
  for (const c of candidates) {
    const t = c.textContent || "";
    if (/Émilie|Anna|Katarzyna|Pendiente/.test(t) && c.getBoundingClientRect().height > 60 && c.getBoundingClientRect().height < 200) {
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 20 };
    }
  }
  return null;
});
if (cardClick) {
  await page.mouse.click(cardClick.x, cardClick.y);
  await page.waitForTimeout(900);
  await metrics("detail-open");
  await page.screenshot({ path: join(OUT, "05-detail.png"), fullPage: true });
  // Detail header zoom
  await page.screenshot({ path: join(OUT, "06-detail-header.png"), fullPage: false, clip: { x: 0, y: 0, width: 375, height: 300 } });
  // Detail bottom (footer Aprobar/Rechazar)
  await page.screenshot({ path: join(OUT, "07-detail-footer.png"), fullPage: false, clip: { x: 0, y: 600, width: 375, height: 212 } });
}

// 6) Bulk selection bar — go back, select 2 cards
await page.goBack().catch(() => {});
await page.waitForTimeout(500);
await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Click first 2 checkboxes
const cbs = await page.locator('input[type="checkbox"], [role="checkbox"]').all();
console.log("[checkboxes count]", cbs.length);
if (cbs.length >= 2) {
  await cbs[0].click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  await cbs[1].click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await metrics("bulk-selected");
  await page.screenshot({ path: join(OUT, "08-bulk-bar.png"), fullPage: false });
  await page.screenshot({ path: join(OUT, "08b-bulk-bottom.png"), fullPage: false, clip: { x: 0, y: 600, width: 375, height: 212 } });
}

// 7) Tabs row scroll check
const tabsInfo = await page.evaluate(() => {
  const labels = ["Todos", "Pendientes", "Aprobados", "Rechazados", "Duplicados"];
  return labels.map((l) => {
    const el = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || "").trim().startsWith(l));
    if (!el) return { label: l, found: false };
    const r = el.getBoundingClientRect();
    return { label: l, x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right), visible: r.right <= 375 };
  });
});
console.log("[tabs]", JSON.stringify(tabsInfo, null, 2));

console.log("\n--- ERRORS ---");
console.log(errs.length ? errs.join("\n") : "(none)");

await browser.close();
