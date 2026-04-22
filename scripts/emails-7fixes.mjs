/**
 * emails-7fixes.mjs · Audita los 7 cambios recientes del módulo /emails.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-7fixes-audit";
await mkdir(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const all = [];

for (const vp of VIEWPORTS) {
  const r = { viewport: vp.name, width: vp.width, checks: {}, errors: [], overflow: null };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => r.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") r.errors.push("console: " + m.text().slice(0, 200)); });

  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Overflow landing
  const m1 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  r.overflow = m1.sw > m1.cw + 1 ? `OVERFLOW ${m1.sw}>${m1.cw}` : "ok";
  await page.screenshot({ path: join(OUT, `${vp.name}-01-landing.png`), fullPage: false });

  // ========== FIX 1: Chrome Byvaro oculto al abrir email (desktop ≥1024) ==========
  // Grab chrome presence BEFORE opening an email
  const chromeBefore = await page.evaluate(() => {
    const byvaroAppSidebar = document.querySelector('aside[data-sidebar], aside.app-sidebar, [data-byvaro-appsidebar]');
    const appHeader = document.querySelector('[data-appheader]');
    // fallback heuristics: top-level AppLayout sidebar has "Byvaro" brand or Inicio link
    const aside = Array.from(document.querySelectorAll('aside'));
    const hasByvaroLogo = aside.find(el => /Byvaro/i.test(el.textContent || ''));
    const hasInicioLink = aside.find(el => /Inicio/.test(el.textContent || '') && /Promociones/.test(el.textContent || ''));
    return {
      asides: aside.length,
      byvaroLogoVisible: !!hasByvaroLogo,
      hasInicioPromociones: !!hasInicioLink,
    };
  });
  r.checks.chromeBeforeOpenEmail = chromeBefore;

  // Try to open first email in the list
  let openedEmail = false;
  try {
    // Look for the email list items. They're buttons/rows with the subject text.
    // Just click the first email subject we can find (heuristic: text nodes with capitalized sentence)
    // Easier: click first visible list row inside the central panel
    const rowClicked = await page.evaluate(() => {
      // find all clickable rows inside the emails list
      const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));
      // pick the row that has a date-ish label too (heuristic)
      const r = rows.find(el => el.offsetParent !== null && el.textContent && el.textContent.length > 20 && el.textContent.length < 500);
      if (r) { r.click(); return r.textContent.slice(0, 60); }
      return null;
    });
    openedEmail = !!rowClicked;
    r.checks.openedEmailSnippet = rowClicked;
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT, `${vp.name}-02-email-open.png`), fullPage: false });
  } catch (e) { r.checks.openEmailErr = e.message; }

  // Chrome presence AFTER opening
  const chromeAfter = await page.evaluate(() => {
    const aside = Array.from(document.querySelectorAll('aside'));
    const hasByvaroLogo = aside.find(el => /Byvaro/i.test(el.textContent || ''));
    const hasInicioPromociones = aside.find(el => /Inicio/.test(el.textContent || '') && /Promociones/.test(el.textContent || ''));
    // Gmail internal sidebar: contains "Bandeja de entrada", "Enviados", "ETIQUETAS"
    const gmailSide = aside.find(el => /Bandeja de entrada/i.test(el.textContent || '') && /Enviados/i.test(el.textContent || ''));
    return {
      asides: aside.length,
      byvaroLogoVisible: !!hasByvaroLogo,
      hasInicioPromociones: !!hasInicioPromociones,
      gmailSidebarPresent: !!gmailSide,
    };
  });
  r.checks.chromeAfterOpenEmail = chromeAfter;

  // FIX 1 evaluation
  if (vp.width >= 1024) {
    r.checks.fix1_chromeHidden = {
      byvaroSidebarHiddenOnOpen: chromeBefore.hasInicioPromociones && !chromeAfter.hasInicioPromociones,
      gmailSidebarStillThere: chromeAfter.gmailSidebarPresent,
    };
  } else {
    r.checks.fix1_chromeHidden = { skipped: "mobile viewport < 1024" };
  }

  // ========== FIX 2: Menú 3 puntos del toolbar del detalle ==========
  if (openedEmail) {
    try {
      const moreBtn = await page.evaluateHandle(() => {
        // Look for MoreVertical icon anywhere on the detail toolbar
        const btns = Array.from(document.querySelectorAll("button"));
        // filter those that have a visible lucide-more-vertical svg AND are near the "Volver a la bandeja" toolbar
        const volver = btns.find(b => b.getAttribute("title") === "Volver a la bandeja");
        if (!volver) return btns.find(b => b.querySelector("svg.lucide-ellipsis-vertical, svg.lucide-more-vertical"));
        const container = volver.closest("div");
        return Array.from(container?.querySelectorAll("button") || []).find(b => b.querySelector("svg.lucide-ellipsis-vertical, svg.lucide-more-vertical"));
      });
      const el = moreBtn.asElement();
      if (el) {
        await el.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(OUT, `${vp.name}-03-more-popover.png`), fullPage: false });
        const items = await page.evaluate(() => {
          const pop = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="menu"], [data-state="open"]'));
          const all = new Set();
          pop.forEach(p => p.querySelectorAll("button, [role='menuitem']").forEach(b => {
            const t = (b.textContent || "").trim();
            if (t && t.length < 60) all.add(t);
          }));
          const arr = Array.from(all);
          return {
            items: arr,
            hasResponder: arr.some(t => /Responder$/i.test(t) || /^Responder/.test(t)),
            hasReenviar: arr.some(t => /Reenviar/i.test(t)),
            hasArchivar: arr.some(t => /Archivar/i.test(t)),
            hasEliminar: arr.some(t => /Eliminar/i.test(t)),
            hasDestacar: arr.some(t => /Destacar|Quitar destacado/i.test(t)),
            hasImportante: arr.some(t => /importante/i.test(t)),
            hasImprimir: arr.some(t => /Imprimir/i.test(t)),
          };
        });
        r.checks.fix2_moreMenu = items;
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      } else {
        r.checks.fix2_moreMenu = { trigger: "not found" };
      }
    } catch (e) { r.checks.fix2_moreMenu = { err: e.message }; }

    // Close email → click "Volver" to go back
    try {
      const volver = page.locator('button[title="Volver a la bandeja"]').first();
      if (await volver.count()) { await volver.click(); await page.waitForTimeout(500); }
    } catch {}
  }

  // Chrome after close
  const chromeAfterClose = await page.evaluate(() => {
    const aside = Array.from(document.querySelectorAll('aside'));
    const hasInicioPromociones = aside.find(el => /Inicio/.test(el.textContent || '') && /Promociones/.test(el.textContent || ''));
    return { hasInicioPromociones: !!hasInicioPromociones };
  });
  r.checks.fix1_chromeReappearsOnVolver = (vp.width >= 1024) ? chromeAfterClose.hasInicioPromociones : "skipped";

  // ========== FIX 3: Folder Enviados → tracking states ==========
  try {
    // On mobile, sidebar is in a sheet — open via hamburger
    if (vp.width < 1024) {
      const hamburger = page.locator("button:has(svg.lucide-menu)").first();
      if (await hamburger.count()) { await hamburger.click(); await page.waitForTimeout(400); }
    }
    const enviados = page.locator('button:has-text("Enviados")').first();
    if (await enviados.count()) {
      await enviados.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT, `${vp.name}-04-sent-list.png`), fullPage: false });
      const badges = await page.evaluate(() => {
        // Look for spans with text "Abierto" or "Rebotado" in the list
        const all = Array.from(document.querySelectorAll("span, div"));
        const visible = all.filter(e => e.offsetParent !== null);
        const abierto = visible.filter(e => (e.textContent || "").trim() === "Abierto");
        const rebotado = visible.filter(e => (e.textContent || "").trim() === "Rebotado");
        // Look inside them for Eye and AlertTriangle icons
        const hasEye = abierto.some(e => e.closest("*")?.querySelector("svg.lucide-eye"));
        const hasAlert = rebotado.some(e => e.closest("*")?.querySelector("svg.lucide-alert-triangle"));
        return {
          abiertoCount: abierto.length,
          rebotadoCount: rebotado.length,
          abiertoHasEye: hasEye,
          rebotadoHasAlertTriangle: hasAlert,
        };
      });
      r.checks.fix3_sentBadges = badges;

      // Open the "Dossier Sotogrande actualizado" email
      try {
        const row = page.locator('text=/Dossier Sotogrande actualizado/').first();
        if (await row.count()) {
          await row.click();
          await page.waitForTimeout(600);
          await page.screenshot({ path: join(OUT, `${vp.name}-05-sent-detail-opened.png`), fullPage: false });
          const tracking = await page.evaluate(() => {
            // Look for the 4 stat labels: Enviado, Entregado/Rebotado, Aperturas, Clicks
            const txt = document.body.textContent || "";
            return {
              hasEnviado: /Enviado/.test(txt),
              hasEntregado: /Entregado|Rebotado/.test(txt),
              hasAperturas: /Aperturas/.test(txt),
              hasClicks: /Clicks/.test(txt),
              hasTrackingCard: document.querySelector('svg.lucide-check-circle-2, svg.lucide-mouse-pointer-click') !== null,
            };
          });
          r.checks.fix3_trackingCard = tracking;
          // Back
          const volver = page.locator('button[title="Volver a la bandeja"]').first();
          if (await volver.count()) { await volver.click(); await page.waitForTimeout(400); }
        } else {
          r.checks.fix3_trackingCard = "Dossier Sotogrande row not found";
        }
      } catch (e) { r.checks.fix3_trackingCardErr = e.message; }
    } else {
      r.checks.fix3_sentBadges = "Enviados button not clickable";
    }

    // Back to inbox
    if (vp.width < 1024) {
      const hamburger = page.locator("button:has(svg.lucide-menu)").first();
      if (await hamburger.count()) { await hamburger.click(); await page.waitForTimeout(300); }
    }
    const inbox = page.locator('button:has-text("Bandeja de entrada")').first();
    if (await inbox.count()) { await inbox.click(); await page.waitForTimeout(400); }
  } catch (e) { r.checks.fix3_err = e.message; }

  // ========== FIX 4: AccountSwitcher sin "Desconectar cuenta activa" ==========
  try {
    const switcher = page.locator("button:has(svg.lucide-chevron-down)").first();
    if (await switcher.count()) {
      await switcher.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${vp.name}-06-account-switcher.png`), fullPage: false });
      const options = await page.evaluate(() => {
        const pop = document.querySelector('[data-radix-popper-content-wrapper]');
        if (!pop) return { found: false };
        const btns = Array.from(pop.querySelectorAll("button"));
        const labels = btns.map(b => (b.textContent || "").trim()).filter(Boolean);
        return {
          found: true,
          labels,
          hasDesconectar: labels.some(l => /Desconectar/i.test(l)),
          hasAnadir: labels.some(l => /Añadir nueva cuenta/i.test(l)),
          hasGestionar: labels.some(l => /Gestionar cuentas/i.test(l)),
        };
      });
      r.checks.fix4_accountSwitcher = options;
    }
  } catch (e) { r.checks.fix4_err = e.message; }

  // ========== FIX 5: EmailSetup → botón Volver al correo ==========
  try {
    const addBtn = page.locator('button:has-text("Añadir nueva cuenta")').first();
    if (await addBtn.count()) {
      await addBtn.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(OUT, `${vp.name}-07-email-setup.png`), fullPage: false });
      const setup = await page.evaluate(() => {
        const txt = document.body.textContent || "";
        const volverBtn = Array.from(document.querySelectorAll("button")).find(b => /Volver al correo/i.test(b.textContent || ""));
        const cancelBtn = Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").trim() === "Cancelar");
        return {
          onEmailSetup: /Configura tu correo electrónico/i.test(txt),
          hasVolverAlCorreo: !!volverBtn,
          hasCancelar: !!cancelBtn,
        };
      });
      r.checks.fix5_emailSetupVolver = setup;

      // Click Volver al correo and verify return to GmailInterface
      if (setup.hasVolverAlCorreo) {
        const vbtn = page.locator('button:has-text("Volver al correo")').first();
        await vbtn.click();
        await page.waitForTimeout(600);
        const backToGmail = await page.evaluate(() => {
          const txt = document.body.textContent || "";
          return { backToGmail: /Bandeja de entrada/i.test(txt) && !/Configura tu correo/i.test(txt) };
        });
        r.checks.fix5_returnsToGmail = backToGmail;
        await page.screenshot({ path: join(OUT, `${vp.name}-08-back-to-gmail.png`), fullPage: false });
      }
    } else {
      r.checks.fix5_emailSetupVolver = "Añadir nueva cuenta not found";
    }
  } catch (e) { r.checks.fix5_err = e.message; }

  // ========== FIX 6: Barra de selección mejorada ==========
  // Reload to fresh state
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  try {
    // Select all via the master checkbox in toolbar (desktop) or individual checkboxes (any)
    if (vp.width >= 1024) {
      // Click the master checkbox inside the list toolbar (the "selectAll" checkbox)
      await page.evaluate(() => {
        // find the first circular checkbox that looks like the select-all control
        const checkboxes = Array.from(document.querySelectorAll("button")).filter(b => {
          const s = b.className || "";
          return /rounded-full/.test(s) && /h-[45]/.test(s);
        });
        // easier: click the first "role=checkbox" or first small round button near the top of the list toolbar
        const masters = document.querySelectorAll('button[aria-checked], button[role="checkbox"]');
        if (masters[0]) (masters[0]).click();
      });
      await page.waitForTimeout(400);
    }

    // Alternative: click individual email checkboxes to select multiple
    // Open a few via clicks on the circles
    await page.evaluate(() => {
      // Click the leading avatar/checkbox of the first 3 rows to select
      const rowCheckboxes = Array.from(document.querySelectorAll('[aria-label*="Seleccionar"], button[role="checkbox"]')).slice(0, 3);
      rowCheckboxes.forEach(b => b.click && b.click());
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `${vp.name}-09-selection-bar.png`), fullPage: false });

    const selection = await page.evaluate(() => {
      const txt = document.body.textContent || "";
      const hasArchivar = document.querySelector('button[title="Archivar"]') !== null;
      const hasEliminar = document.querySelector('button[title="Eliminar"], button[title="Eliminar permanentemente"]') !== null;
      const hasMarcarLeido = document.querySelector('button[title*="leído"], button[title*="leido"], button[title="Marcar como leído"]') !== null;
      const hasAsignarEtiqueta = document.querySelector('button[title="Asignar etiqueta"]') !== null;
      const hasCancelar = Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").trim() === "Cancelar");
      const hasSelectedCounter = /\d+ seleccionad[oa]s?/i.test(txt);
      const hasBannerAzul = /Se han seleccionado las \d+ conversaciones/i.test(txt);
      return { hasArchivar, hasEliminar, hasMarcarLeido, hasAsignarEtiqueta, hasCancelar, hasSelectedCounter, hasBannerAzul };
    });
    r.checks.fix6_selectionBar = selection;

    // Try opening Asignar etiqueta popover
    if (selection.hasAsignarEtiqueta) {
      const tagBtn = page.locator('button[title="Asignar etiqueta"]').first();
      await tagBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${vp.name}-10-tag-popover.png`), fullPage: false });
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
  } catch (e) { r.checks.fix6_err = e.message; }

  // ========== FIX 7: Buscador con filtros Gmail ==========
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  try {
    // Find search input
    const search = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
    if (await search.count()) {
      await search.click();
      await search.fill("Sotogrande");
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${vp.name}-11-search-query.png`), fullPage: false });
      const q1 = await page.evaluate(() => {
        const rows = document.querySelectorAll('[class*="cursor-pointer"]');
        return { visibleRows: Array.from(rows).filter(e => e.offsetParent !== null).length };
      });
      r.checks.fix7_searchResultsCount = q1.visibleRows;

      // Clear with X (if it exists, it's a small x icon inside the input)
      const clearX = page.locator('button:has(svg.lucide-x)').first();
      // Just re-fill to clear
      await search.fill("");
      await page.waitForTimeout(300);

      // Search nonexistent → empty state
      await search.fill("zzzzzzunexistentq__");
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `${vp.name}-12-empty-search.png`), fullPage: false });
      const empty = await page.evaluate(() => {
        const txt = document.body.textContent || "";
        return {
          hasEmptyMessage: /No hay resultados con estos filtros/i.test(txt),
          hasLimpiarBusqueda: Array.from(document.querySelectorAll("button")).some(b => /Limpiar búsqueda|Limpiar busqueda/i.test(b.textContent || "")),
        };
      });
      r.checks.fix7_emptyState = empty;
      await search.fill("");
      await page.waitForTimeout(300);
    } else {
      r.checks.fix7_search = "search input not found";
    }

    // Test SlidersHorizontal filter popover
    const sliders = page.locator('button:has(svg.lucide-sliders-horizontal)').first();
    if (await sliders.count()) {
      await sliders.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT, `${vp.name}-13-filters-popover.png`), fullPage: false });
      const filters = await page.evaluate(() => {
        const pop = document.querySelector('[data-radix-popper-content-wrapper]');
        if (!pop) return { found: false };
        const txt = pop.textContent || "";
        const inputs = pop.querySelectorAll("input");
        const cerrar = Array.from(pop.querySelectorAll("button")).some(b => (b.textContent || "").trim() === "Cerrar");
        const aplicar = Array.from(pop.querySelectorAll("button")).some(b => /Aplicar/i.test(b.textContent || ""));
        return {
          found: true,
          hasDe: /De\b/i.test(txt),
          hasPara: /Para\b/i.test(txt),
          hasAsunto: /Asunto/i.test(txt),
          hasContienePalabras: /Contiene palabras|contiene las palabras/i.test(txt),
          hasTieneAdjunto: /adjunto/i.test(txt),
          hasSoloNoLeidos: /no leídos|No leidos/i.test(txt),
          hasCerrar: cerrar,
          hasAplicar: aplicar,
          inputsCount: inputs.length,
        };
      });
      r.checks.fix7_filtersPopover = filters;

      // Fill "de" field and apply
      try {
        const deInput = page.locator('[data-radix-popper-content-wrapper] input').first();
        if (await deInput.count()) {
          await deInput.fill("maria");
          await page.waitForTimeout(200);
          const aplicar = page.locator('[data-radix-popper-content-wrapper] button:has-text("Aplicar")').first();
          if (await aplicar.count()) { await aplicar.click(); await page.waitForTimeout(400); }
          await page.screenshot({ path: join(OUT, `${vp.name}-14-filter-applied.png`), fullPage: false });
          const badge = await page.evaluate(() => {
            // Look for a small numeric badge near the sliders icon
            const slidersBtn = document.querySelector('button:has(svg.lucide-sliders-horizontal)');
            if (!slidersBtn) return null;
            const spans = slidersBtn.querySelectorAll("span");
            return Array.from(spans).map(s => s.textContent.trim()).filter(Boolean);
          });
          r.checks.fix7_filterBadge = badge;
          const limpiar = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("button")).some(b => /Limpiar/i.test(b.textContent || ""));
          });
          r.checks.fix7_hasLimpiarButton = limpiar;
        }
      } catch (e) { r.checks.fix7_applyErr = e.message; }
    } else {
      r.checks.fix7_slidersTrigger = "not found";
    }
  } catch (e) { r.checks.fix7_err = e.message; }

  // Final overflow check
  const m2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  r.overflowFinal = m2.sw > m2.cw + 1 ? `OVERFLOW ${m2.sw}>${m2.cw}` : "ok";

  await page.screenshot({ path: join(OUT, `${vp.name}-99-final.png`), fullPage: true });
  await ctx.close();
  all.push(r);
  console.log(`✓ ${vp.name} done, errors=${r.errors.length}, overflow=${r.overflow}`);
}

await browser.close();
await writeFile(join(OUT, "report.json"), JSON.stringify(all, null, 2));
console.log("\n→ report.json written to", OUT);
