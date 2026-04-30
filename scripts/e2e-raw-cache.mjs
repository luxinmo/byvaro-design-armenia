import { chromium } from "playwright";
const BASE = process.argv[2] ?? "https://byvaro-design-armenia.vercel.app";
const ACCOUNT = process.argv[3] ?? "arman@byvaro.com";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', ACCOUNT);
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(6000); // larger wait

const allKeys = await page.evaluate(() => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys.sort();
});
console.log(`══ ${ACCOUNT} · localStorage tiene ${allKeys.length} claves: ══`);
for (const k of allKeys) console.log(`  ${k}`);

const ag1Raw = await page.evaluate(() => {
  const v = localStorage.getItem("byvaro-empresa:ag-1");
  return v ? `len=${v.length} firstChars="${v.slice(0, 100)}"` : "null/empty";
});
console.log(`\n══ byvaro-empresa:ag-1 raw: ══\n  ${ag1Raw}`);

await browser.close();
