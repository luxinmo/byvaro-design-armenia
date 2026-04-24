import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
const demo = page.locator('text=arman@byvaro.com').first();
if (await demo.count()) await demo.click();
await page.waitForTimeout(600);
// If redirect didn't happen, fill password
if (page.url().includes('/login')) {
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) { await pwd.fill('demo1234'); await page.waitForTimeout(200); }
  const sub = page.locator('button[type="submit"]:not([disabled])').first();
  if (await sub.count()) await sub.click();
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 8000 }).catch(()=>{});
}

await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Count feed items before
const feedItemsBefore = await page.locator('text=/Últimos movimientos/i').first()
  .locator('xpath=ancestor::*[self::section or self::div][1]').locator('li').count().catch(()=>0);

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
const verMas = page.getByRole('button', { name: /Ver más/i }).first();
const verMasCount = await verMas.count();
let clicked = false, errorThrown = null;
if (verMasCount) {
  try {
    await verMas.scrollIntoViewIfNeeded();
    await verMas.click({ timeout: 4000 });
    clicked = true;
    await page.waitForTimeout(600);
  } catch (e) { errorThrown = e.message.split('\n')[0]; }
}
const verMenos = await page.locator('text=/Ver menos/i').count();
const feedItemsAfter = await page.locator('text=/Últimos movimientos/i').first()
  .locator('xpath=ancestor::*[self::section or self::div][1]').locator('li').count().catch(()=>0);

await browser.close();
console.log(JSON.stringify({ verMasCount, clicked, errorThrown, verMenosAfter: verMenos, feedItemsBefore, feedItemsAfter, errs }, null, 2));
