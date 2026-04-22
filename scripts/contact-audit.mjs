import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/tmp/byvaro-audit/shots";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = [
  "/contactos",
  "/contactos/ahmed-al-rashid",
  "/contactos/ahmed-al-rashid?tab=historial",
  "/contactos/ahmed-al-rashid?tab=registros",
  "/contactos/ahmed-al-rashid?tab=visitas",
  "/contactos/ahmed-al-rashid?tab=ofertas",
  "/contactos/sophie-laurent",
  "/contactos/diana-petrov",
  "/promociones/1",
];

const slug = (r) => r.replace(/^\//, "").replace(/[\/?=&]/g, "_");

async function auditOne(page, route, vp) {
  const consoleErrors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: vp.width, height: vp.height });
  const url = BASE_URL + route;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  } catch (e) {
    return { route, viewport: vp.name, error: `nav: ${e.message}` };
  }
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const docEl = document.documentElement;
    return {
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
      scrollHeight: docEl.scrollHeight,
    };
  });

  const hasHOverflow = metrics.scrollWidth > metrics.clientWidth + 1;
  const shotPath = join(OUT_DIR, `${slug(route)}-${vp.width}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });

  return {
    route, viewport: vp.name, width: vp.width,
    ...metrics, hasHOverflow, consoleErrors, screenshot: shotPath,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const r = await auditOne(page, route, vp);
      const flag = r.error ? "X" : r.hasHOverflow ? "!" : "OK";
      console.log(`${flag} ${route.padEnd(48)} ${vp.name.padEnd(8)} ${r.consoleErrors?.length ? `(${r.consoleErrors.length} err)` : ""}`);
      results.push(r);
    }
  }
  await browser.close();
  const summary = {
    total: results.length,
    overflowCount: results.filter(r => r.hasHOverflow).length,
    errorCount: results.filter(r => r.error).length,
    consoleErrorCount: results.filter(r => r.consoleErrors?.length).length,
    routesWithOverflow: [...new Set(results.filter(r => r.hasHOverflow).map(r => r.route))],
    results,
  };
  await writeFile("/tmp/byvaro-audit/report.json", JSON.stringify(summary, null, 2));
  console.log(`\n${summary.total} combos · ${summary.overflowCount} overflow · ${summary.errorCount} nav errors · ${summary.consoleErrorCount} console errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
