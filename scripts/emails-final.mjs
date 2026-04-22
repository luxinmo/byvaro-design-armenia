import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const BASE_URL = "http://localhost:8080";
const OUT_DIR = "screenshots/emails-audit";
await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

// 768 email detail
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("text=Ana Martínez").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT_DIR, "t768-email-open.png"), fullPage: false });
const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log("768 detail:", m);

// 1440 email detail
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("text=Ana Martínez").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT_DIR, "w1440-email-open.png"), fullPage: false });

// 414 compose full-screen
await page.setViewportSize({ width: 414, height: 896 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("button:has-text('Redactar'):visible").first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT_DIR, "m414-compose.png"), fullPage: false });

// AccountSwitcher popover at 768
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(500);
await page.locator("button:has(svg.lucide-chevron-down)").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT_DIR, "t768-account-popover.png"), fullPage: false });

console.log("errors:", errs);
await browser.close();
