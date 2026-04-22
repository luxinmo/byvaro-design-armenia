import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const BASE_URL = "http://localhost:8080";
const OUT_DIR = "screenshots/emails-audit";
await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

// 768 email detail
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
// Click by position: y=193
await page.mouse.click(400, 203);
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT_DIR, "t768-email-open.png"), fullPage: false });
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log("768 detail:", m);

// 1440
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.mouse.click(900, 203);
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT_DIR, "w1440-email-open.png"), fullPage: false });

// 414 compose
await page.setViewportSize({ width: 414, height: 896 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("button:has-text('Redactar'):visible").first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT_DIR, "m414-compose.png"), fullPage: false });

await browser.close();
