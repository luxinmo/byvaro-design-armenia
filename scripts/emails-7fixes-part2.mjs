/** Re-audit the specific checks my first pass failed to automate correctly. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-7fixes-audit";
await mkdir(OUT, { recursive: true });

// desktop for selection bar + tracking card; mobile-sm for bottom selection bar sanity
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const all = [];

for (const vp of VIEWPORTS) {
  const r = { viewport: vp.name, width: vp.width, checks: {} };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // ========== FIX 3: Navigate to Enviados in desktop directly ==========
  if (vp.width >= 1024) {
    try {
      // click "Enviados" in the Gmail sidebar (always visible desktop)
      const enviadosDesktop = page.locator('aside button:has-text("Enviados")').first();
      if (await enviadosDesktop.count()) {
        await enviadosDesktop.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(OUT, `${vp.name}-re-04-sent-list.png`), fullPage: false });

        // Gather list structure + badges
        const sent = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).filter(e => e.offsetParent !== null);
          return rows.slice(0, 10).map(r => ({
            text: (r.textContent || "").slice(0, 200),
            hasAbierto: /Abierto/.test(r.textContent || ""),
            hasRebotado: /Rebotado/.test(r.textContent || ""),
            hasEye: !!r.querySelector("svg.lucide-eye"),
            hasAlert: !!r.querySelector("svg.lucide-alert-triangle"),
          }));
        });
        r.checks.fix3_sentRows = sent;

        // Open Dossier Sotogrande row
        const row = page.locator('div:has-text("Dossier Sotogrande actualizado")').first();
        if (await row.count()) {
          await row.click({ force: true });
          await page.waitForTimeout(800);
          await page.screenshot({ path: join(OUT, `${vp.name}-re-05-sent-detail.png`), fullPage: false });
          const tracking = await page.evaluate(() => {
            const txt = document.body.textContent || "";
            // TrackingCard has 4 StatTiles: Enviado, Entregado/Rebotado, Aperturas, Clicks
            return {
              hasEnviadoLabel: /Enviado[^a-záéíóú]/i.test(txt),
              hasEntregadoLabel: /Entregado\b/i.test(txt),
              hasAperturas: /Aperturas/i.test(txt),
              hasClicks: /Clicks/i.test(txt),
              hasDestinatarioLine: /Destinatario/i.test(txt),
            };
          });
          r.checks.fix3_trackingCardSotogrande = tracking;

          // Volver
          const volver = page.locator('button[title="Volver a la bandeja"]').first();
          if (await volver.count()) { await volver.click(); await page.waitForTimeout(400); }
        }

        // Open Rebotado email (Re: Nueva oferta recibida · Unidad B-204)
        const rowB = page.locator('div:has-text("Re: Nueva oferta recibida"), div:has-text("Unidad B-204")').first();
        if (await rowB.count()) {
          await rowB.click({ force: true });
          await page.waitForTimeout(800);
          await page.screenshot({ path: join(OUT, `${vp.name}-re-05b-bounced-detail.png`), fullPage: false });
          const bouncedDetail = await page.evaluate(() => {
            const txt = document.body.textContent || "";
            return {
              hasRebotado: /Rebotado/i.test(txt),
              hasEnviado: /Enviado[^a-záéíóú]/i.test(txt),
              hasAperturas: /Aperturas/i.test(txt),
              hasClicks: /Clicks/i.test(txt),
            };
          });
          r.checks.fix3_bouncedTrackingCard = bouncedDetail;
          const volver = page.locator('button[title="Volver a la bandeja"]').first();
          if (await volver.count()) { await volver.click(); await page.waitForTimeout(400); }
        } else {
          r.checks.fix3_bouncedTrackingCard = "B-204 row not found";
        }

        // Go back to inbox
        const inbox = page.locator('aside button:has-text("Bandeja de entrada")').first();
        if (await inbox.count()) { await inbox.click(); await page.waitForTimeout(400); }
      }
    } catch (e) { r.checks.fix3_err = e.message; }
  }

  // ========== FIX 6: Selection bar (desktop) ==========
  if (vp.width >= 1024) {
    try {
      // Find & click the "Seleccionar todo" master checkbox button
      const selectAllBtn = page.locator('button[title="Seleccionar todo"]').first();
      if (await selectAllBtn.count()) {
        await selectAllBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(OUT, `${vp.name}-re-09-select-all.png`), fullPage: false });

        const selection = await page.evaluate(() => {
          const titles = Array.from(document.querySelectorAll("button[title]")).map(b => b.getAttribute("title")).filter(Boolean);
          const uniq = Array.from(new Set(titles));
          const txt = document.body.textContent || "";
          const cancelBtn = Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").trim() === "Cancelar");
          return {
            titlesSample: uniq.slice(0, 30),
            hasArchivar: uniq.includes("Archivar"),
            hasEliminar: uniq.includes("Eliminar") || uniq.includes("Eliminar permanentemente"),
            hasMarcarLeido: uniq.includes("Marcar como leído"),
            hasAsignarEtiqueta: uniq.includes("Asignar etiqueta"),
            hasCancelar: cancelBtn,
            hasSelectedCounter: /\d+ seleccionad[oa]s?/i.test(txt),
            hasBannerAzul: /Se han seleccionado las \d+ conversaciones de esta vista/i.test(txt),
          };
        });
        r.checks.fix6_selectionBarDesktop = selection;

        // Open the "Asignar etiqueta" popover
        const tagBtn = page.locator('button[title="Asignar etiqueta"]').first();
        if (await tagBtn.count()) {
          await tagBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(OUT, `${vp.name}-re-10-assign-tag.png`), fullPage: false });
          const tagPop = await page.evaluate(() => {
            const pop = document.querySelector('[data-radix-popper-content-wrapper]');
            if (!pop) return { found: false };
            const txt = pop.textContent || "";
            return {
              found: true,
              hasVisitas: /Visitas/.test(txt),
              hasOfertas: /Ofertas/.test(txt),
              hasClientesVIP: /Clientes VIP/.test(txt),
              hasProveedores: /Proveedores/.test(txt),
            };
          });
          r.checks.fix6_tagPopover = tagPop;
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        }

        // Deselect and close
        const cancelar = page.locator('button:has-text("Cancelar")').first();
        if (await cancelar.count()) await cancelar.click();
        await page.waitForTimeout(300);
      }
    } catch (e) { r.checks.fix6_err = e.message; }
  }

  // ========== FIX 6 mobile: select via row checkbox on mobile ==========
  if (vp.width < 1024) {
    try {
      // Mobile list rows have an avatar/checkbox zone. Click the avatar circle first.
      // We look for rows with `cursor-pointer` and click their leading avatar.
      await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).filter(e => e.offsetParent !== null);
        // click the first leading rounded element inside row 0 to select
        const r0 = rows[0];
        if (!r0) return;
        // try first button inside
        const inner = r0.querySelector("button, [role='checkbox'], [class*='rounded-full']");
        inner && inner.click && inner.click();
      });
      await page.waitForTimeout(400);
      // Also try individual checkbox buttons
      const result = await page.evaluate(() => {
        const txt = document.body.textContent || "";
        const titles = Array.from(document.querySelectorAll("button[title]")).map(b => b.getAttribute("title")).filter(Boolean);
        const uniq = Array.from(new Set(titles));
        return {
          titlesSample: uniq.slice(0, 30),
          selectionCounterText: (txt.match(/\d+ seleccionad[oa]s?/i) || [null])[0],
        };
      });
      r.checks.fix6_mobileAttempt = result;
    } catch (e) { r.checks.fix6_mobileErr = e.message; }
  }

  // ========== FIX 7: De / Para filter labels verification ==========
  try {
    await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const sliders = page.locator('button:has(svg.lucide-sliders-horizontal)').first();
    if (await sliders.count()) {
      await sliders.click();
      await page.waitForTimeout(500);
      const popData = await page.evaluate(() => {
        const pop = document.querySelector('[data-radix-popper-content-wrapper]');
        if (!pop) return { found: false };
        const labels = Array.from(pop.querySelectorAll("label, p, span, div"))
          .filter(e => e.children.length === 0)
          .map(e => (e.textContent || "").trim())
          .filter(t => t.length > 0 && t.length < 40);
        return {
          found: true,
          labels: Array.from(new Set(labels)),
          hasDe: labels.includes("De"),
          hasPara: labels.includes("Para"),
          hasAsunto: labels.includes("Asunto"),
          hasContieneLasPalabras: labels.includes("Contiene las palabras"),
        };
      });
      r.checks.fix7_filterLabels = popData;
      await page.screenshot({ path: join(OUT, `${vp.name}-re-13-filter-popover.png`), fullPage: false });
      await page.keyboard.press("Escape");
    }
  } catch (e) { r.checks.fix7_err = e.message; }

  await ctx.close();
  all.push(r);
  console.log(`✓ ${vp.name} re-audit done`);
}

await browser.close();
await writeFile(join(OUT, "report-part2.json"), JSON.stringify(all, null, 2));
console.log("\n→ report-part2.json written");
