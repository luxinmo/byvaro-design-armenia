/**
 * Audit dedicado a /registros — lista, detalle, grace period.
 * Produce screenshots + report.json en screenshots/_registros/.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "http://localhost:8080";
const OUT = "screenshots/_registros";

const VP = [
  { name: "375",  w: 375,  h: 812 },
  { name: "414",  w: 414,  h: 896 },
  { name: "768",  w: 768,  h: 1024 },
  { name: "1024", w: 1024, h: 800 },
  { name: "1440", w: 1440, h: 900 },
];

async function gatherMetrics(page) {
  return page.evaluate(() => {
    const docEl = document.documentElement;
    // Detect elements that overflow beyond viewport
    const vw = docEl.clientWidth;
    const offenders = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right - vw > 2 && r.width > 4 && r.width < 4000) {
        // Only report elements that actually cross the viewport's right edge
        if (r.left < vw) {
          const cls = (el.className && typeof el.className === "string") ? el.className.slice(0, 90) : "";
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls,
            overflowBy: Math.round(r.right - vw),
            text: (el.textContent || "").trim().slice(0, 60),
          });
        }
      }
    });
    return {
      scrollW: docEl.scrollWidth,
      clientW: docEl.clientWidth,
      scrollH: docEl.scrollHeight,
      offenders: offenders.slice(0, 8),
    };
  });
}

async function auditState(page, label, vp) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    if (msg.type() === "warning") consoleWarnings.push(msg.text().slice(0, 300));
  });

  const m = await gatherMetrics(page);
  const overflow = m.scrollW > m.clientW + 1;
  const shot = join(OUT, `${label}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  return {
    label, vp: vp.name, width: vp.w,
    scrollW: m.scrollW, clientW: m.clientW,
    overflow, offenders: m.offenders,
    consoleErrors, consoleWarnings, pageErrors,
    screenshot: shot,
  };
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const results = [];

  for (const vp of VP) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.w, height: vp.h });

    // 1) LIST state
    await page.goto(BASE + "/registros", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(600);
    results.push(await auditState(page, "list", vp));

    // 2) DETAIL state — click first card (or list article)
    //   In desktop the detail is already auto-opened; in mobile need to click.
    try {
      // Click first article in the aside list
      const firstCard = page.locator('article').first();
      await firstCard.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    } catch (e) { /* desktop already has one opened */ }
    results.push(await auditState(page, "detail", vp));

    // 3) GRACE PERIOD simulation — click Aprobar
    try {
      const approve = page.getByRole("button", { name: /Aprobar$/ }).last();
      if (await approve.isVisible({ timeout: 1500 })) {
        await approve.click();
        await page.waitForTimeout(700);
      }
    } catch (e) { /* ignore */ }
    results.push(await auditState(page, "grace", vp));

    // 4) MULTI-SELECT state — go back to list if mobile, then toggle checkbox on 2 items
    try {
      if (vp.w < 1024) {
        // In mobile, go back
        const back = page.getByRole("button", { name: /Volver a la lista/i });
        if (await back.isVisible({ timeout: 500 })) await back.click();
        await page.waitForTimeout(400);
      }
      const checks = page.locator('article button[aria-label*="Seleccionar"]');
      const count = await checks.count();
      if (count >= 2) {
        await checks.nth(0).click();
        await page.waitForTimeout(150);
        await checks.nth(1).click();
        await page.waitForTimeout(400);
      }
    } catch (e) { /* ignore */ }
    results.push(await auditState(page, "multiselect", vp));

    await page.close();
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    total: results.length,
    overflowCount: results.filter((r) => r.overflow).length,
    overflowStates: results.filter((r) => r.overflow).map((r) => ({ label: r.label, vp: r.vp, scrollW: r.scrollW, clientW: r.clientW, offenders: r.offenders })),
    consoleErrors: results.flatMap((r) => r.consoleErrors.map((e) => ({ label: r.label, vp: r.vp, msg: e }))),
    consoleWarnings: results.flatMap((r) => r.consoleWarnings.map((e) => ({ label: r.label, vp: r.vp, msg: e }))),
    pageErrors: results.flatMap((r) => r.pageErrors.map((e) => ({ label: r.label, vp: r.vp, msg: e }))),
    results,
  };
  await writeFile(join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(`\n== registros audit ==`);
  console.log(`combos: ${summary.total} · overflow: ${summary.overflowCount} · console-errors: ${summary.consoleErrors.length} · warnings: ${summary.consoleWarnings.length} · pageErrors: ${summary.pageErrors.length}`);
  if (summary.overflowCount > 0) {
    summary.overflowStates.forEach((s) => console.log(`  OVERFLOW ${s.label}@${s.vp}  scrollW=${s.scrollW}>${s.clientW}`));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
