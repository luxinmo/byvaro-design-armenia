import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-company-history";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });

// Promotor - debe ver todo
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });
  await p.goto(`${BASE}/colaboradores/ag-2`, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/promotor-ag-2.png`, fullPage: true });
  await ctx.close();
  console.log("✓ promotor");
}

// Agencia - NO debe ver el timeline (confidencial)
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });
  // Agencia entra directamente a /colaboradores/ag-2 por URL (no tiene link)
  await p.goto(`${BASE}/colaboradores/ag-2`, { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/agencia-ag-2.png`, fullPage: true });
  const url = p.url();
  console.log(`✓ agencia URL final: ${url}`);
  await ctx.close();
}

await b.close();
