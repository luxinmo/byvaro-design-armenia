import { chromium } from "playwright";
import fs from "fs";
const OUT = "/tmp/inm-screens";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => {
  sessionStorage.setItem("byvaro.accountType.v1", "developer");
  sessionStorage.setItem("byvaro.accountType.developerEmail.v1", "arman@byvaro.com");
});
const page = await ctx.newPage();

await page.goto("http://localhost:8080/inmuebles", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/sidebar-list-active.png`, fullPage: false });
console.log("✓ sidebar-list-active.png");

await page.goto("http://localhost:8080/inmuebles/cuadricula", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/sidebar-grid-active.png`, fullPage: false });
console.log("✓ sidebar-grid-active.png");

await ctx.close();
await browser.close();
