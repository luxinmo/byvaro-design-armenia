import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
try {
  const demo = page.locator('text=arman@byvaro.com').first();
  if (await demo.count()) { await demo.click(); await page.waitForTimeout(300); }
} catch {}
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) {
  const val = await pwd.inputValue().catch(() => '');
  if (!val) await pwd.fill('demo1234');
}
const submit = page.locator('button[type="submit"]').first();
if (await submit.count()) await submit.click();
await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(500);

await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Switch range to 90 days or 12m to maximize events
const btn90 = page.locator('button:has-text("90")').first();
if (await btn90.count()) { await btn90.click().catch(() => {}); await page.waitForTimeout(600); }

// Click Ver más multiple times
for (let i = 0; i < 5; i++) {
  const vm = page.locator('button:has-text("Ver más"), [role="button"]:has-text("Ver más")').first();
  if (await vm.count()) {
    await vm.scrollIntoViewIfNeeded().catch(()=>{});
    await vm.click().catch(() => {});
    await page.waitForTimeout(300);
  } else break;
}

const all = await page.evaluate(() => document.body.innerText);
const hasVentaCerrada = /Venta cerrada/i.test(all);
const hasVentaTerminada = /Venta terminada/i.test(all);
const hasContratoFirmado = /Contrato firmado/i.test(all);

// Grab just feed events
const feed = await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('*')).find(n => n.textContent?.trim() === 'Últimos movimientos');
  if (!h) return null;
  const section = h.closest('section, div');
  return section ? section.innerText : null;
});

await browser.close();

console.log(JSON.stringify({ hasVentaCerrada, hasVentaTerminada, hasContratoFirmado }, null, 2));
console.log('\n--- FEED ---');
console.log(feed);
