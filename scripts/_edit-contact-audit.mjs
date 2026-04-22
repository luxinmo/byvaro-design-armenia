import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/private/tmp/byvaro-edit-contact-audit/shots";
await mkdir(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile",  width: 375,  height: 812 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const allFindings = [];

async function openDialog(page) {
  /* Cazamos el botón "Editar" del header. */
  const editBtn = page.getByRole("button", { name: /^Editar$/i }).first();
  await editBtn.waitFor({ state: "visible", timeout: 8000 });
  await editBtn.click();
  /* Espera al DialogContent visible. */
  await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(400);
}

async function dialogMetrics(page) {
  return await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    /* Encuentra el área de scroll interno. */
    const scrollRegions = Array.from(d.querySelectorAll('*')).filter((el) => {
      const st = getComputedStyle(el);
      return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    }).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: el.className?.toString?.().slice(0, 90) ?? '',
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    /* Footer info. */
    const footer = d.querySelector('div.bg-muted\\/30, .DialogFooter, footer, [class*="border-t"][class*="bg-muted"]');
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    return {
      dialogRect: { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bodyScrollW: document.documentElement.scrollWidth,
      bodyClientW: document.documentElement.clientWidth,
      scrollRegions,
      footer: footerRect && {
        x: footerRect.x, y: footerRect.y, width: footerRect.width,
        height: footerRect.height, bottom: footerRect.bottom,
      },
    };
  });
}

async function captureViewport(page, vp) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(BASE_URL + ROUTE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await openDialog(page);

  /* === 1) Default state (Particular) === */
  const m1 = await dialogMetrics(page);
  await page.screenshot({ path: join(OUT, `01-default-${vp.name}-${vp.width}.png`), fullPage: false });
  await page.screenshot({ path: join(OUT, `01-default-${vp.name}-${vp.width}-FULL.png`), fullPage: true });

  /* === 2) Empresa === */
  const empresaBtn = page.getByRole('button', { name: /^Empresa$/ }).first();
  if (await empresaBtn.isVisible().catch(() => false)) {
    await empresaBtn.click();
    await page.waitForTimeout(250);
  }
  const m2 = await dialogMetrics(page);
  await page.screenshot({ path: join(OUT, `02-empresa-${vp.name}-${vp.width}.png`), fullPage: false });

  /* Volver a Particular para los demás capturas. */
  const partBtn = page.getByRole('button', { name: /^Particular$/ }).first();
  if (await partBtn.isVisible().catch(() => false)) {
    await partBtn.click();
    await page.waitForTimeout(150);
  }

  /* === 3) Phone country dropdown === */
  /* El PhoneInput trigger suele tener el flag/prefijo. Buscamos el primer botón dentro del wrapper de phone. */
  const dialog = page.locator('[role="dialog"]').first();
  /* Scroll hasta la sección teléfonos. */
  await dialog.locator('text=/^Tel.fonos$/').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);
  /* PhoneInput: el primer botón con bandera está al inicio del contenedor del primer teléfono. */
  let phoneCaptured = false;
  try {
    const phoneTrigger = dialog.locator('button').filter({ hasText: /\+\d/ }).first();
    if (await phoneTrigger.isVisible({ timeout: 1500 })) {
      await phoneTrigger.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `03-phone-country-${vp.name}-${vp.width}.png`), fullPage: false });
      phoneCaptured = true;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch (e) {
    errors.push(`phone-trigger: ${e.message}`);
  }
  if (!phoneCaptured) {
    /* Plan B: clic en el primer .ui-PhoneInput div / cualquier botón dentro del primer phone row */
    try {
      const firstPhoneRow = dialog.locator('div.flex.flex-wrap.items-center.gap-2.p-2\\.5').first();
      const firstBtn = firstPhoneRow.locator('button').first();
      await firstBtn.click({ timeout: 1500 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `03-phone-country-${vp.name}-${vp.width}.png`), fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    } catch (e) {
      errors.push(`phone-trigger-b: ${e.message}`);
    }
  }

  /* === 4) Add language popover === */
  try {
    const addLang = dialog.getByRole('button', { name: /A.adir idioma/i }).first();
    await addLang.scrollIntoViewIfNeeded();
    await addLang.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `04-language-popover-${vp.name}-${vp.width}.png`), fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } catch (e) {
    errors.push(`add-language: ${e.message}`);
  }

  /* === 5) Scroll dentro del dialog → comprobar fixed footer === */
  const scrollInfo = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const region = Array.from(d.querySelectorAll('*')).find((el) => {
      const st = getComputedStyle(el);
      return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    });
    if (!region) return { scrolled: false, reason: 'no-scroll-region' };
    region.scrollTop = region.scrollHeight;
    return {
      scrolled: true,
      scrollTop: region.scrollTop,
      scrollHeight: region.scrollHeight,
      clientHeight: region.clientHeight,
    };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `05-scrolled-bottom-${vp.name}-${vp.width}.png`), fullPage: false });
  /* Comprobamos que el footer sigue en pantalla. */
  const footerAfterScroll = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    /* Buscamos el footer de DialogFooter por su clase distintiva. */
    const footer = d.querySelector('div[class*="border-t"][class*="bg-muted"]');
    if (!footer) return null;
    const r = footer.getBoundingClientRect();
    return { y: r.y, bottom: r.bottom, h: r.height, vh: window.innerHeight, visible: r.bottom <= window.innerHeight + 1 };
  });

  allFindings.push({
    viewport: vp.name + '-' + vp.width,
    consoleErrors: errors,
    metricsDefault: m1,
    metricsEmpresa: m2,
    scrollInfo,
    footerAfterScroll,
  });
}

const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (const vp of VIEWPORTS) {
  console.log('--', vp.name);
  try { await captureViewport(page, vp); }
  catch (e) { allFindings.push({ viewport: vp.name, fatal: e.message }); }
}

await writeFile(join(OUT, '..', 'report.json'), JSON.stringify(allFindings, null, 2));
console.log('DONE');
await browser.close();
