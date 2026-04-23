import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-status-badges";
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.locator("button", { hasText: "Arman Rahmanov" }).first().click();
await p.waitForURL(/\/inicio/, { timeout: 8000 });
for (const id of ["1", "2", "8", "dev-3", "dev-4"]) {
  await p.goto(`${BASE}/promociones/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${id}.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 200 } });
}
console.log("✓");
await b.close();
