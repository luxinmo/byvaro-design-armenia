import { chromium } from "playwright";
const BASE = process.argv[2] ?? "https://byvaro-design-armenia.vercel.app";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(4000);

console.log("══ Arman (Luxinmo) ve a Prime Properties ══");

const cache = await page.evaluate(() => {
  const v = localStorage.getItem("byvaro-empresa:ag-1");
  if (!v) return { found: false };
  const p = JSON.parse(v);
  return {
    found: true,
    nombre: p.nombreComercial,
    logoLen: p.logoUrl?.length ?? 0,
    logoIsData: p.logoUrl?.startsWith("data:") ?? false,
  };
});
console.log(`  Cache: ${JSON.stringify(cache)}`);

await page.goto(`${BASE}/colaboradores`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const primeImg = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll("img"));
  const prime = imgs.find((i) => /prime/i.test(i.alt));
  return prime ? { isData: prime.currentSrc?.startsWith("data:") ?? false } : null;
});
console.log(`  /colaboradores card Prime: ${primeImg?.isData ? "✓ logo nuevo data:" : "✗ logo viejo o no encontrado"}`);

await page.goto(`${BASE}/colaboradores/ag-1`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const heroImg = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll("img"));
  const prime = imgs.find((i) => /prime/i.test(i.alt));
  return prime ? { isData: prime.currentSrc?.startsWith("data:") ?? false } : null;
});
console.log(`  /colaboradores/ag-1 hero:  ${heroImg?.isData ? "✓ logo nuevo data:" : "✗"}`);

await browser.close();
