import { chromium } from "playwright";
const BASE = process.argv[2] ?? "https://byvaro-design-armenia.vercel.app";
const PASSWORD = "Luxinmo2026Byvaro";
const ACCOUNT = process.argv[3] ?? "anna@nordichomefinders.com";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', ACCOUNT);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(4500); // hidratación completa

console.log(`══ ${ACCOUNT} · localStorage scoped keys ══\n`);
const data = await page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("byvaro-empresa:")) continue;
    const v = localStorage.getItem(k);
    if (!v) continue;
    try {
      const p = JSON.parse(v);
      out[k] = {
        nombre: p.nombreComercial,
        razonSocial: p.razonSocial,
        logoLen: p.logoUrl?.length ?? 0,
        logoIsData: p.logoUrl?.startsWith("data:") ?? false,
        keys: Object.keys(p).length,
      };
    } catch {
      out[k] = "PARSE_ERROR";
    }
  }
  return out;
});

for (const [k, v] of Object.entries(data)) {
  console.log(`  ${k}`);
  console.log(`    ${JSON.stringify(v)}`);
}

await browser.close();
