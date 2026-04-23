/**
 * Audit v2: viewport screenshots (no fullPage) + open a record with match.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:8080";
const OUT = "screenshots/_registros_v2";
const VP = [
  { name: "375",  w: 375,  h: 812 },
  { name: "414",  w: 414,  h: 896 },
  { name: "768",  w: 768,  h: 1024 },
  { name: "1024", w: 1024, h: 800 },
  { name: "1440", w: 1440, h: 900 },
];

async function shot(page, label, vp, fullPage = false) {
  const p = join(OUT, `${label}-${vp.name}${fullPage ? "-full" : ""}.png`);
  await page.screenshot({ path: p, fullPage });
  return p;
}

async function metrics(page) {
  return page.evaluate(() => {
    const docEl = document.documentElement;
    const vw = docEl.clientWidth;
    const vh = docEl.clientHeight;
    // Find mobile bottom nav
    const nav = document.querySelector('[class*="MobileBottom"], nav[class*="bottom"], .mobile-bottom-nav, [data-mobile-bottom-nav]');
    // Check any fixed element at bottom
    const fixedBottoms = [];
    document.querySelectorAll("*").forEach((el) => {
      const s = getComputedStyle(el);
      if (s.position === "fixed" && parseInt(s.bottom) < 100) {
        const r = el.getBoundingClientRect();
        if (r.width > 50) {
          fixedBottoms.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 120),
            bottom: s.bottom,
            height: Math.round(r.height),
            width: Math.round(r.width),
          });
        }
      }
    });
    // Find footer action buttons (approve/reject)
    const approve = document.querySelector('button:has(> svg)');
    return { vw, vh, fixedBottoms: fixedBottoms.slice(0, 6) };
  });
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const report = { generatedAt: new Date().toISOString(), viewports: {} };

  for (const vp of VP) {
    report.viewports[vp.name] = { states: {}, fixedBottoms: null };
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });

    // ---- LIST ----
    await page.goto(BASE + "/registros", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);
    report.viewports[vp.name].fixedBottoms = await metrics(page);
    report.viewports[vp.name].states.list = {
      shot: await shot(page, "list", vp),
      shotFull: await shot(page, "list", vp, true),
    };

    // Search for a record known to have matchPercentage > 0
    // reg-006 is "Lars Bergström" 96% match. Find by name or by clicking 5th card (James O'Connor 47%).
    // Simpler: click the article that contains "Lars Bergström" (first one without visita)
    // Use the 5th article index (after the 3 pending first, visita, Sofia...) — safer: click the article containing "96%"
    try {
      // Click the card for a high-match record (reg-006 Lars Bergström 96%)
      // We search for text "Lars Bergström" which appears twice — pick the one in red 96%
      const cards = page.locator('article');
      const count = await cards.count();
      // Find card containing "96%" text — scan text content
      let targetIdx = -1;
      for (let i = 0; i < Math.min(count, 20); i++) {
        const t = await cards.nth(i).innerText();
        if (t.includes("96%") || t.includes("Duplicado") || t.includes("Lars Bergström")) {
          targetIdx = i; break;
        }
      }
      if (targetIdx < 0) targetIdx = 4; // fallback
      await cards.nth(targetIdx).click();
      await page.waitForTimeout(600);
    } catch (e) { /* ignore */ }

    report.viewports[vp.name].states.detail = {
      shot: await shot(page, "detail", vp),
      shotFull: await shot(page, "detail", vp, true),
    };

    // Scroll to bottom inside detail to see footer + check overlap with MobileBottomNav
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    report.viewports[vp.name].states.detailBottom = {
      shot: await shot(page, "detail-bottom", vp),
    };

    // ---- TRIGGER GRACE PERIOD ----
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    try {
      const approve = page.getByRole("button", { name: /^Aprobar$/ }).last();
      if (await approve.isVisible({ timeout: 1500 })) {
        await approve.click();
        await page.waitForTimeout(700);
      }
    } catch (e) { /* ignore */ }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    report.viewports[vp.name].states.grace = {
      shot: await shot(page, "grace", vp),
      shotFull: await shot(page, "grace", vp, true),
    };

    // ---- MULTI-SELECT ---- navigate back to list and toggle 2 items
    try {
      if (vp.w < 1024) {
        const back = page.getByRole("button", { name: /Volver a la lista/i });
        if (await back.count() > 0) {
          await back.first().click();
          await page.waitForTimeout(400);
        }
      }
      // toggle checkboxes on 2 list cards
      const checks = page.locator('article button[aria-label*="Seleccionar"]');
      const cc = await checks.count();
      if (cc >= 2) {
        await checks.nth(0).click();
        await checks.nth(1).click();
        await page.waitForTimeout(400);
      }
    } catch (e) {}
    // scroll to bottom to see floating multiselect bar + any collision with bottomnav
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    report.viewports[vp.name].states.multiselectBottom = {
      shot: await shot(page, "multiselect-bottom", vp),
    };

    await page.close();
  }

  await browser.close();
  await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("done v2");
}

run().catch((e) => { console.error(e); process.exit(1); });
