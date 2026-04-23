import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-internal";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
for (const id of ["2", "dev-5"]) {
  await p.goto(`${BASE}/promociones/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${id}-header.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 300 } });
  await p.screenshot({ path: `${OUT}/${id}-full.png`, fullPage: true });
}
console.log("✓");
await b.close();
