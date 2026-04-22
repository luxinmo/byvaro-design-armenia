// Auditoría del modal de WhatsApp en la ficha de contacto.
// Verifica: header duplicado, padding, scroll horizontal, posición del cerrar,
// errores de consola, comportamiento mobile.

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/whatsapp-modal";

const findings = [];
function log(level, msg, data = {}) {
  findings.push({ level, msg, ...data });
  console.log(`[${level}] ${msg}`, Object.keys(data).length ? JSON.stringify(data) : "");
}

async function captureConsole(page, label) {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ kind: "pageerror", text: String(e?.message ?? e) }));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push({ kind: "console.error", text: m.text() });
    if (m.type() === "warning") errors.push({ kind: "console.warning", text: m.text() });
  });
  return errors;
}

async function checkOverflow(page, viewportW) {
  const o = await page.evaluate((vw) => {
    const docW = document.documentElement.scrollWidth;
    const bodyW = document.body.scrollWidth;
    return { docW, bodyW, vw, overflow: Math.max(docW, bodyW) - vw };
  }, viewportW);
  return o;
}

async function inspectDialog(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('[data-state="open"][class*="backdrop-blur"]');
    const content = document.querySelector('[role="dialog"][data-state="open"]');
    if (!content) return { found: false };
    const rect = content.getBoundingClientRect();
    const closeBtn = content.querySelector('[aria-label="Cerrar WhatsApp"]');
    const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
    // Headers visibles dentro del modal: el header del chat (con avatar+nombre)
    const headers = Array.from(content.querySelectorAll("header")).map((h) => ({
      text: (h.innerText || "").slice(0, 100),
      top: h.getBoundingClientRect().top,
      left: h.getBoundingClientRect().left,
      height: h.getBoundingClientRect().height,
    }));
    // sr-only Title (DialogTitle)
    const srTitle = content.querySelector(".sr-only");
    const innerScroll = content.querySelector(".overflow-y-auto");
    const innerRect = innerScroll ? innerScroll.getBoundingClientRect() : null;
    // ChatView <section> dimensions
    const section = content.querySelector("section");
    const sectionRect = section ? section.getBoundingClientRect() : null;
    const sectionStyle = section ? getComputedStyle(section) : null;
    return {
      found: true,
      backdrop: !!overlay,
      backdropBlur: overlay ? getComputedStyle(overlay).backdropFilter : null,
      content: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      close: closeRect ? { x: closeRect.x, y: closeRect.y, w: closeRect.width, h: closeRect.height } : null,
      headers,
      srTitle: srTitle ? srTitle.textContent : null,
      innerScroll: innerRect ? { x: innerRect.x, y: innerRect.y, w: innerRect.width, h: innerRect.height, scrollH: innerScroll.scrollHeight, clientH: innerScroll.clientHeight } : null,
      section: sectionRect ? { x: sectionRect.x, y: sectionRect.y, w: sectionRect.width, h: sectionRect.height, minHeight: sectionStyle.minHeight, height: sectionStyle.height } : null,
    };
  });
}

async function run() {
  const browser = await chromium.launch();

  /* ───── DESKTOP 1280x800 ───── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = await captureConsole(page);

    await page.goto(BASE + ROUTE, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // 1) Screenshot del header con tabs
    await page.screenshot({ path: `${OUT}/01-desktop-tabs-header.png`, fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 240 } });

    // Comprobar overflow horizontal de la página antes de abrir
    const oBefore = await checkOverflow(page, 1280);
    if (oBefore.overflow > 0) log("WARN", "Overflow horizontal en ficha (antes modal)", oBefore);

    // 2) Click en tab WhatsApp
    const whatsappTab = page.locator('button[role="tab"]', { hasText: "WhatsApp" }).first();
    const tabExists = await whatsappTab.count();
    if (!tabExists) {
      // El handler intercepta antes de cambiar de tab → el botón puede no ser role="tab"
      // Buscar por texto en cualquier botón del nav de tabs
      const altTab = page.locator('button:has-text("WhatsApp")').first();
      await altTab.click();
    } else {
      await whatsappTab.click();
    }
    await page.waitForTimeout(800);

    const dlg = await inspectDialog(page);
    log("INFO", "Modal desktop 1280×800", dlg);

    await page.screenshot({ path: `${OUT}/02-desktop-modal-open.png`, fullPage: false });

    const oOpen = await checkOverflow(page, 1280);
    if (oOpen.overflow > 0) log("CRIT", "Overflow horizontal con modal abierto (desktop)", oOpen);

    // Cerrar
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // 3) Abrir desde el icono WhatsApp del bloque "Teléfonos" en Resumen
    // Volver al tab Resumen primero por si acaso
    const resumenTab = page.locator('button:has-text("Resumen")').first();
    if (await resumenTab.count()) {
      await resumenTab.click();
      await page.waitForTimeout(300);
    }

    // Buscar botones con icono WhatsApp dentro del bloque teléfonos
    const phoneWa = page.locator('button[title*="WhatsApp" i], button[aria-label*="WhatsApp" i]').first();
    const phoneWaCount = await page.locator('button[title*="WhatsApp" i], button[aria-label*="WhatsApp" i]').count();
    log("INFO", `Botones WhatsApp encontrados en Resumen: ${phoneWaCount}`);

    if (phoneWaCount > 0) {
      await phoneWa.click();
      await page.waitForTimeout(700);
      const dlg2 = await inspectDialog(page);
      log("INFO", "Modal abierto desde Resumen→Teléfonos", { found: dlg2.found, content: dlg2.content });
      await page.screenshot({ path: `${OUT}/03-desktop-modal-from-phones.png`, fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      log("WARN", "No se encontró botón WhatsApp en bloque Teléfonos del Resumen");
    }

    log("CONSOLE", `Errores consola desktop: ${errors.length}`, { errors: errors.slice(0, 10) });
    await ctx.close();
  }

  /* ───── MOBILE 375x812 ───── */
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    const errors = await captureConsole(page);

    await page.goto(BASE + ROUTE, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${OUT}/04-mobile-tabs-header.png`, fullPage: false });

    const oBefore = await checkOverflow(page, 375);
    if (oBefore.overflow > 0) log("WARN", "Overflow horizontal en ficha mobile (antes modal)", oBefore);

    // Tab WhatsApp en mobile (el header tabs puede ser scroll horizontal)
    const tabsBar = page.locator('[role="tablist"], nav').first();
    const waBtn = page.locator('button:has-text("WhatsApp")').first();
    if (!(await waBtn.isVisible().catch(() => false))) {
      // Scroll dentro de tabs
      await tabsBar.evaluate((el) => el.scrollBy({ left: 400 }));
      await page.waitForTimeout(200);
    }
    await waBtn.click();
    await page.waitForTimeout(800);

    const dlg = await inspectDialog(page);
    log("INFO", "Modal mobile 375×812", dlg);

    await page.screenshot({ path: `${OUT}/05-mobile-modal-open.png`, fullPage: false });

    const oOpen = await checkOverflow(page, 375);
    if (oOpen.overflow > 0) log("CRIT", "Overflow horizontal con modal abierto (mobile)", oOpen);

    // Verificar que el chat ocupa todo el alto y no se ve cortado
    const dims = await page.evaluate(() => {
      const content = document.querySelector('[role="dialog"][data-state="open"]');
      if (!content) return null;
      const r = content.getBoundingClientRect();
      const inner = content.querySelector(".overflow-y-auto");
      const ir = inner ? inner.getBoundingClientRect() : null;
      const composer = content.querySelector("footer");
      const cr = composer ? composer.getBoundingClientRect() : null;
      return { content: { w: r.width, h: r.height, b: r.bottom },
               inner: ir ? { w: ir.width, h: ir.height, b: ir.bottom } : null,
               composer: cr ? { y: cr.y, b: cr.bottom, h: cr.height } : null,
               vh: window.innerHeight };
    });
    log("INFO", "Dims modal mobile", dims);

    // Cerrar y reabrir
    await page.locator('[aria-label="Cerrar WhatsApp"]').click();
    await page.waitForTimeout(400);
    await waBtn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/06-mobile-modal-reopen.png`, fullPage: false });

    log("CONSOLE", `Errores consola mobile: ${errors.length}`, { errors: errors.slice(0, 10) });
    await ctx.close();
  }

  await browser.close();

  console.log("\n────────── RESUMEN FINDINGS ──────────");
  console.log(JSON.stringify(findings, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
