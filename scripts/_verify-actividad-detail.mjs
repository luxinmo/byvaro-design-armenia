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
await page.waitForTimeout(2000);

// Find the Ventas cerradas KPI card and get its sub text
const ventasKpiSub = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('*')).filter(n => n.textContent?.trim() === 'Ventas cerradas' && n.children.length === 0);
  if (!nodes.length) return null;
  // Get parent card
  const card = nodes[0].closest('div')?.parentElement?.parentElement;
  return card ? card.innerText : null;
});

// Find the "Últimos movimientos" section and dump its children
const feed = await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('*')).find(n => n.textContent?.trim() === 'Últimos movimientos');
  if (!h) return null;
  const section = h.closest('section, div');
  if (!section) return null;
  // Get first 15 lines of text
  const txt = section.innerText;
  return txt.split('\n').slice(0, 40).join('\n');
});

await browser.close();

console.log('--- Ventas cerradas KPI ---');
console.log(ventasKpiSub);
console.log('\n--- Últimos movimientos (feed) ---');
console.log(feed);
