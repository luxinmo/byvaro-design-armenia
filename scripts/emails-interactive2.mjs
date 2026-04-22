import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "screenshots/emails-audit";
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

// ===== 375px =====
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Enumerate all Redactar buttons with their visibility & position
const redactarInfo = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("button")).filter(b => b.textContent && b.textContent.includes("Redactar")).map(b => {
    const r = b.getBoundingClientRect();
    const style = getComputedStyle(b);
    return {
      classes: b.className.slice(0, 160),
      visible: style.display !== "none" && style.visibility !== "hidden",
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      z: style.zIndex,
      position: style.position,
      parentZ: b.parentElement ? getComputedStyle(b.parentElement).zIndex : null,
    };
  });
});
console.log("375 Redactar buttons:", JSON.stringify(redactarInfo, null, 2));

// Visually confirm FAB present in initial screenshot
await page.screenshot({ path: join(OUT_DIR, "m375-fab.png"), fullPage: false });

// Try visible one
const fab = page.locator("button:has-text('Redactar'):visible").first();
const fabCount = await fab.count();
console.log("visible Redactar count:", fabCount);
if (fabCount > 0) {
  const fabBox = await fab.boundingBox();
  console.log("FAB box:", fabBox, "winH=812");
  await fab.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT_DIR, "m375-compose.png"), fullPage: false });
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom };
  });
  console.log("compose 375 dialog:", dlg);
}

// ===== 1280 compose =====
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(500);

const fabD = page.locator("button:has-text('Redactar'):visible").first();
if (await fabD.count()) {
  await fabD.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT_DIR, "d1280-compose.png"), fullPage: false });
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom, winW: window.innerWidth, winH: window.innerHeight };
  });
  console.log("compose 1280 dialog:", dlg);
}

// ===== 375 AccountSwitcher popover =====
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
const trigger = page.locator("button:has(svg.lucide-chevron-down)").first();
if (await trigger.count()) {
  await trigger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, "m375-account-popover.png"), fullPage: false });
  const info = await page.evaluate(() => {
    // Radix uses data-radix-popper-content-wrapper OR data-state=open
    const el = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!el) return null;
    const child = el.firstElementChild;
    const r = (child || el).getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, winW: window.innerWidth };
  });
  console.log("account popover 375:", info);
}

console.log("\n==== ERRORS ====");
console.log(errors);
await browser.close();
