/**
 * responsive-audit · auditor responsive automatizado para Byvaro.
 *
 * Qué hace:
 *   1. Asume que hay un dev server corriendo en `http://localhost:8080`
 *      (o el que se pase por `BASE_URL`).
 *   2. Abre cada ruta en 5 viewports (375, 640, 768, 1024, 1440).
 *   3. En cada combinación:
 *      · Guarda screenshot en `screenshots/<slug>-<w>.png`.
 *      · Mide `scrollWidth` del body vs `innerWidth` → detecta overflow horizontal.
 *      · Registra errores de consola del navegador.
 *   4. Escribe `screenshots/report.json` con el resumen.
 *
 * Uso:
 *   npm run dev                        # en otra terminal
 *   node scripts/responsive-audit.mjs  # toma ~1-2 min
 *
 * El agente `.claude/agents/byvaro-tester.md` lo ejecuta y lee las imágenes
 * + el report para diagnosticar problemas responsive.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const OUT_DIR = "screenshots";

const VIEWPORTS = [
  { name: "mobile-sm", width: 375, height: 812 },
  { name: "mobile-lg", width: 640, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1024, height: 800 },
  { name: "desktop-xl", width: 1440, height: 900 },
];

const ROUTES = [
  "/inicio",
  "/promociones",
  "/promociones/1",
  "/registros",
  "/ventas",
  "/calendario",
  "/colaboradores",
  "/contactos",
  "/microsites",
  "/emails",
  "/ajustes",
  "/empresa",
  "/crear-promocion",
  "/login",
  "/register",
];

const slug = (r) => (r === "/" ? "root" : r.replace(/^\//, "").replace(/\//g, "_").replace(/:/g, ""));

async function auditOne(page, route, vp) {
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: vp.width, height: vp.height });
  const url = BASE_URL + route;
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  } catch (e) {
    return { route, viewport: vp.name, error: `navigation failed: ${e.message}`, elapsedMs: Date.now() - t0 };
  }

  await page.waitForTimeout(400); // dejar asentar animaciones

  const metrics = await page.evaluate(() => {
    const docEl = document.documentElement;
    return {
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
      scrollHeight: docEl.scrollHeight,
      clientHeight: docEl.clientHeight,
    };
  });

  const hasHOverflow = metrics.scrollWidth > metrics.clientWidth + 1;

  const shotPath = join(OUT_DIR, `${slug(route)}-${vp.width}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });

  return {
    route,
    viewport: vp.name,
    width: vp.width,
    ...metrics,
    hasHOverflow,
    consoleErrors,
    screenshot: shotPath,
    elapsedMs: Date.now() - t0,
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
      const flag = r.error ? "✗" : r.hasHOverflow ? "⚠" : "✓";
      console.log(`${flag} ${route.padEnd(22)} ${vp.name.padEnd(11)} (${r.width}px)  ${r.elapsedMs}ms${r.hasHOverflow ? `  overflow ${r.scrollWidth}>${r.clientWidth}` : ""}${r.error ? `  ${r.error}` : ""}`);
      results.push(r);
    }
  }

  await browser.close();

  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    total: results.length,
    overflowCount: results.filter((r) => r.hasHOverflow).length,
    errorCount: results.filter((r) => r.error).length,
    routesWithOverflow: [...new Set(results.filter((r) => r.hasHOverflow).map((r) => r.route))],
    results,
  };

  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(summary, null, 2));
  console.log(`\n→ ${summary.total} combos · ${summary.overflowCount} con overflow · ${summary.errorCount} fallos`);
  console.log(`→ screenshots/report.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
