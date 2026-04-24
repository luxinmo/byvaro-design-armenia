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

// Switch range to 12m to maximize
const btn12 = page.locator('button').filter({ hasText: /12\s*m/i }).first();
if (await btn12.count()) { await btn12.click().catch(() => {}); await page.waitForTimeout(600); }

// Expand
for (let i = 0; i < 10; i++) {
  const vm = page.locator('button:has-text("Ver más")').first();
  if (await vm.count()) {
    await vm.scrollIntoViewIfNeeded().catch(()=>{});
    await vm.click().catch(() => {});
    await page.waitForTimeout(250);
  } else break;
}

const all = await page.evaluate(() => document.body.innerText);
const cerradaMatches = (all.match(/Venta cerrada[^\n]*/g) || []).slice(0, 5);
const terminadaMatches = (all.match(/Venta terminada[^\n]*/g) || []).slice(0, 5);
const contratoMatches = (all.match(/Contrato firmado[^\n]*/g) || []).slice(0, 5);

await browser.close();

console.log('Venta cerrada matches:', cerradaMatches);
console.log('Venta terminada matches:', terminadaMatches);
console.log('Contrato firmado matches:', contratoMatches);
