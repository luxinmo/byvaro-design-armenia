/**
 * dead-buttons-scan · detector de botones/opciones sin funcionalidad.
 *
 * Qué hace:
 *   Para cada ruta de Byvaro, localiza todos los botones visibles y los
 *   clica uno a uno. Por cada click mide si hubo algún cambio observable:
 *     · URL cambió
 *     · nuevo dialog/popover visible
 *     · toast (sonner) apareció
 *     · DOM cambió significativamente (hash rápido del <main>)
 *   Si NINGÚN cambio se detecta, el botón se marca como DEAD (candidato
 *   a placeholder sin acción). Si cambia URL, se vuelve atrás antes del
 *   siguiente click.
 *
 *   Output: `screenshots/dead-buttons/report.json` + lista legible en stdout.
 *
 * Uso:
 *   npm run dev
 *   node scripts/dead-buttons-scan.mjs   # ~2-3 min
 *
 * Limitaciones:
 *   · No detecta botones que abren menús nativos (file upload).
 *   · Un botón que sólo cambia estado interno sin reflejarse en el DOM
 *     del `main` puede falsamente marcarse DEAD.
 *   · No audita pasos de wizard — para eso existe `wizard-audit.mjs`.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const OUT_DIR = "screenshots/dead-buttons";

const ROUTES = [
  "/inicio",
  "/promociones",
  "/promociones/1",
  "/empresa",
  "/login",
  "/register",
];

async function domHash(page) {
  return await page.evaluate(() => {
    const m = document.querySelector("main") || document.body;
    const s = m.innerHTML.length + "|" + m.querySelectorAll("*").length;
    return s;
  });
}

async function listButtons(page) {
  return await page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll('main button, main [role="button"], header button')
    );
    return btns
      .map((b, idx) => {
        const rect = b.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return null;
        const cs = getComputedStyle(b);
        if (cs.visibility === "hidden" || cs.display === "none") return null;
        const text = (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 60);
        return {
          idx,
          text: text || "(sin texto)",
          hasClick: !!b.onclick || b.hasAttribute("data-has-click") || true, // React no expone onClick directo
        };
      })
      .filter(Boolean);
  });
}

async function scanRoute(page, route) {
  await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  const startUrl = page.url();
  const buttons = await listButtons(page);
  const results = [];

  for (let i = 0; i < buttons.length; i++) {
    // Re-query porque el DOM puede haber cambiado
    const btn = await page
      .evaluate((idx) => {
        const list = Array.from(
          document.querySelectorAll('main button, main [role="button"], header button')
        );
        return list[idx] ? idx : -1;
      }, i);
    if (btn < 0) continue;

    const before = {
      url: page.url(),
      domHash: await domHash(page),
      dialogs: await page.$$eval("[role='dialog']", (els) => els.length).catch(() => 0),
      toasts: await page.$$eval('[data-sonner-toast], [role="status"]', (els) => els.length).catch(() => 0),
    };

    try {
      await page.evaluate((idx) => {
        const list = Array.from(
          document.querySelectorAll('main button, main [role="button"], header button')
        );
        list[idx]?.click();
      }, i);
      await page.waitForTimeout(350);
    } catch {
      continue;
    }

    const after = {
      url: page.url(),
      domHash: await domHash(page),
      dialogs: await page.$$eval("[role='dialog']", (els) => els.length).catch(() => 0),
      toasts: await page.$$eval('[data-sonner-toast], [role="status"]', (els) => els.length).catch(() => 0),
    };

    const changed =
      before.url !== after.url ||
      before.domHash !== after.domHash ||
      after.dialogs > before.dialogs ||
      after.toasts > before.toasts;

    const b = buttons[i];
    results.push({
      route,
      idx: i,
      text: b.text,
      changed,
      details: {
        urlChanged: before.url !== after.url,
        dialogOpened: after.dialogs > before.dialogs,
        toastShown: after.toasts > before.toasts,
        domChanged: before.domHash !== after.domHash,
      },
    });

    // Si cambió URL, volver
    if (before.url !== after.url) {
      await page.goto(startUrl, { waitUntil: "networkidle", timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(300);
    }

    // Si abrió dialog, cerrar (Escape)
    if (after.dialogs > before.dialogs) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
  }

  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const all = [];
  for (const r of ROUTES) {
    console.log(`\n▶ ${r}`);
    const res = await scanRoute(page, r).catch((e) => {
      console.error(`  ✗ error en ${r}:`, e.message);
      return [];
    });
    const dead = res.filter((b) => !b.changed);
    console.log(`  ${res.length} botones · ${dead.length} sin respuesta`);
    dead.forEach((d) => console.log(`    ⚠ "${d.text}"`));
    all.push(...res);
  }

  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    totalButtons: all.length,
    deadButtons: all.filter((b) => !b.changed).length,
    byRoute: ROUTES.map((r) => {
      const rs = all.filter((b) => b.route === r);
      const dead = rs.filter((b) => !b.changed);
      return {
        route: r,
        total: rs.length,
        dead: dead.length,
        deadList: dead.map((d) => d.text),
      };
    }),
    results: all,
  };

  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(summary, null, 2));
  console.log(`\n→ ${summary.totalButtons} botones auditados · ${summary.deadButtons} sin respuesta visible`);
  console.log(`→ screenshots/dead-buttons/report.json`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
