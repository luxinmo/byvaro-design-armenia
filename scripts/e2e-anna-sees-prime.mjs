/**
 * Anna logs in as ag-2 · ¿ve el logo nuevo de Prime Properties (ag-1)?
 *
 * Si funciona la cross-tenant visibility:
 *   1. La hidratación tira data desde Supabase a localStorage de Anna.
 *   2. Anna ve `byvaro-empresa:ag-1` con el logo data:image/png en su cache.
 *   3. /colaboradores list-card de Prime Properties muestra el logo nuevo.
 *   4. /colaboradores/ag-1 hero muestra el logo nuevo.
 */
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:8080";
const PASSWORD = "Luxinmo2026Byvaro";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "anna@nordichomefinders.com");
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(3500); // hidratación

console.log("══ Anna (ag-2) tras login ══\n");

const cache = await page.evaluate(() => {
  const v = localStorage.getItem("byvaro-empresa:ag-1");
  if (!v) return { found: false };
  const p = JSON.parse(v);
  return {
    found: true,
    nombre: p.nombreComercial,
    logoLen: p.logoUrl?.length,
    logoIsData: p.logoUrl?.startsWith("data:") ?? false,
    logoStart: p.logoUrl?.slice(0, 50),
  };
});
console.log(`  Cache localStorage byvaro-empresa:ag-1:`);
console.log(`    nombre:      ${cache.nombre}`);
console.log(`    logoLen:     ${cache.logoLen}`);
console.log(`    isData URL:  ${cache.logoIsData ? "✓" : "✗"}`);
console.log(`    logoStart:   ${cache.logoStart}`);

console.log("\n  ─ Visita /colaboradores listing ─");
await page.goto(`${BASE}/colaboradores`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const primeImg = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll("img"));
  const prime = imgs.find((i) => /prime/i.test(i.alt));
  return prime ? {
    alt: prime.alt,
    isData: prime.currentSrc?.startsWith("data:") ?? false,
    srcStart: prime.currentSrc?.slice(0, 50),
  } : null;
});
console.log(`    Card Prime Properties: ${primeImg ? `${primeImg.isData ? "✓" : "✗"} src=${primeImg.srcStart}` : "no encontrado"}`);

console.log("\n  ─ Visita /colaboradores/ag-1 ficha pública ─");
await page.goto(`${BASE}/colaboradores/ag-1`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const heroImg = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll("img"));
  const prime = imgs.find((i) => /prime/i.test(i.alt));
  return prime ? {
    alt: prime.alt,
    isData: prime.currentSrc?.startsWith("data:") ?? false,
    srcStart: prime.currentSrc?.slice(0, 50),
  } : null;
});
console.log(`    Hero ficha:            ${heroImg ? `${heroImg.isData ? "✓" : "✗"} src=${heroImg.srcStart}` : "no encontrado"}`);

await browser.close();
