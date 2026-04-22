import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/private/tmp/byvaro-edit-contact-audit/shots";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE_URL + ROUTE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

/* Captura del header para diagnosticar. */
await page.screenshot({ path: join(OUT, '00-mobile-header-PRE.png'), fullPage: false });

/* Encuentra el botón de editar (ícono pencil sin texto en mobile). */
/* Aproximación: button con svg + class lucide-pencil dentro del header. */
const found = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  return buttons.map((b, i) => ({
    i,
    text: b.textContent?.trim().slice(0, 40),
    title: b.getAttribute('title'),
    aria: b.getAttribute('aria-label'),
    hasPencil: !!b.querySelector('svg.lucide-pencil, svg[class*="lucide-pencil"]'),
    hasEditTxt: /Editar/i.test(b.textContent || ''),
    visibleW: b.getBoundingClientRect().width,
  })).filter(x => x.hasPencil || x.hasEditTxt);
});
console.log('Edit candidates:', JSON.stringify(found, null, 2));

/* Click en el primer botón con pencil. */
const editBtn = page.locator('button:has(svg.lucide-pencil)').first();
const count = await editBtn.count();
console.log('Pencil buttons count:', count);
if (count === 0) {
  console.log('NO PENCIL — abortando');
  await browser.close();
  process.exit(0);
}
await editBtn.click();
await page.waitForTimeout(600);
await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 5000 });

/* Métricas. */
const m = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const region = Array.from(d.querySelectorAll('*')).find((el) => {
    const st = getComputedStyle(el);
    return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  });
  /* Footer: localizar por DialogFooter selector. */
  const footer = d.querySelector('[class*="border-t"][class*="bg-muted"]');
  const footerRect = footer && footer.getBoundingClientRect();
  /* Phone row width measurement. */
  const phoneRow = d.querySelector('div.flex.flex-wrap.items-center.gap-2.p-2\\.5');
  const phoneRect = phoneRow && phoneRow.getBoundingClientRect();
  const phoneChildren = phoneRow ? Array.from(phoneRow.children).map((c) => {
    const r = c.getBoundingClientRect();
    return { tag: c.tagName.toLowerCase(), w: r.width, h: r.height, top: r.top, left: r.left };
  }) : [];
  return {
    dialogRect: { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom },
    vh: window.innerHeight,
    vw: window.innerWidth,
    region: region && { sh: region.scrollHeight, ch: region.clientHeight },
    footer: footerRect && { y: footerRect.y, bottom: footerRect.bottom, h: footerRect.height },
    phoneRow: phoneRect && { w: phoneRect.width, h: phoneRect.height, children: phoneChildren },
  };
});
console.log('METRICS', JSON.stringify(m, null, 2));

await page.screenshot({ path: join(OUT, '01-default-mobile-375.png'), fullPage: false });
await page.screenshot({ path: join(OUT, '01-default-mobile-375-FULL.png'), fullPage: true });

/* Empresa */
const empresa = page.getByRole('button', { name: /^Empresa$/ }).first();
if (await empresa.isVisible().catch(() => false)) {
  await empresa.click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, '02-empresa-mobile-375.png'), fullPage: false });
  await page.getByRole('button', { name: /^Particular$/ }).first().click();
  await page.waitForTimeout(150);
}

/* Phone country dropdown */
const dialog = page.locator('[role="dialog"]').first();
try {
  const phoneTrigger = dialog.locator('button').filter({ hasText: /\+\d/ }).first();
  if (await phoneTrigger.isVisible({ timeout: 1500 })) {
    await phoneTrigger.scrollIntoViewIfNeeded();
    await phoneTrigger.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, '03-phone-country-mobile-375.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
} catch (e) { console.log('phone:', e.message); }

/* Add language */
try {
  const addLang = dialog.getByRole('button', { name: /A.adir idioma/i }).first();
  await addLang.scrollIntoViewIfNeeded();
  await addLang.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '04-language-popover-mobile-375.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
} catch (e) { console.log('lang:', e.message); }

/* Scroll bottom */
const scrollInfo = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const region = Array.from(d.querySelectorAll('*')).find((el) => {
    const st = getComputedStyle(el);
    return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  });
  if (!region) return null;
  region.scrollTop = region.scrollHeight;
  return { sh: region.scrollHeight, ch: region.clientHeight, st: region.scrollTop };
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, '05-scrolled-bottom-mobile-375.png'), fullPage: false });
const footerAfter = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const footer = d.querySelector('[class*="border-t"][class*="bg-muted"]');
  if (!footer) return null;
  const r = footer.getBoundingClientRect();
  return { y: r.y, bottom: r.bottom, vh: window.innerHeight, visible: r.bottom <= window.innerHeight + 1 };
});
console.log('SCROLL', JSON.stringify(scrollInfo));
console.log('FOOTER-AFTER', JSON.stringify(footerAfter));
console.log('ERRORS', errors.length, JSON.stringify(errors, null, 2));

await browser.close();
