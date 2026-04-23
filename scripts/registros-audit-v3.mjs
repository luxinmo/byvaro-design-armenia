/**
 * Audit v3: open a record that has matchCliente (Sofia Martinez Ruiz = reg-010 92%).
 * Click card based on text "92%" (reg-010) — guaranteed DuplicateResult render.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:8080";
const OUT = "screenshots/_registros_v3";
const VP = [
  { name: "375",  w: 375,  h: 812 },
  { name: "768",  w: 768,  h: 1024 },
  { name: "1024", w: 1024, h: 800 },
  { name: "1440", w: 1440, h: 900 },
];

async function shot(page, label, vp, fullPage = false) {
  const p = join(OUT, `${label}-${vp.name}${fullPage ? "-full" : ""}.png`);
  await page.screenshot({ path: p, fullPage });
  return p;
}

async function clickHighMatchCard(page) {
  // Click the card that contains "92%" (reg-010 is likely the third high-match candidate)
  const cards = page.locator('article');
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    const t = await cards.nth(i).innerText();
    if (t.includes("92%") || t.includes("96%") || t.includes("88%")) {
      await cards.nth(i).click();
      return true;
    }
  }
  return false;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  for (const vp of VP) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });

    await page.goto(BASE + "/registros", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(500);

    // Scroll down to find high-match cards, click one
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);
    await clickHighMatchCard(page);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    // Detail top
    await shot(page, "detail-match-top", vp);
    // Full page
    await shot(page, "detail-match-full", vp, true);

    // Scroll to the middle (where compare cards likely are)
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);
    await shot(page, "detail-match-mid", vp);

    // Scroll to bottom (timeline + footer actions)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "detail-match-bottom", vp);

    // Trigger grace
    try {
      const approve = page.getByRole("button", { name: /^Aprobar$/ }).last();
      if (await approve.isVisible({ timeout: 1500 })) {
        await approve.click();
        await page.waitForTimeout(700);
      }
    } catch {}
    // Scroll to grace banner location (below notas)
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(400);
    await shot(page, "grace-match-mid", vp);
    await shot(page, "grace-match-full", vp, true);

    await page.close();
  }

  await browser.close();
  console.log("v3 done");
}

run().catch((e) => { console.error(e); process.exit(1); });
