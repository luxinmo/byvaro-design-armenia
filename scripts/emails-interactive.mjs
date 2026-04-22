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

// ── 375px: check hamburger opens sheet, redactar opens dialog, click an email
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Screenshot initial
await page.screenshot({ path: join(OUT_DIR, "m375-01-initial.png"), fullPage: false });

// Click the hamburger icon inside the gmail top bar (not the app one)
const hamburgers = await page.locator("button:has(svg.lucide-menu)").all();
console.log("found hamburgers:", hamburgers.length);
if (hamburgers.length >= 2) {
  // Second hamburger = GmailInterface one (first is MobileHeader)
  await hamburgers[1].click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, "m375-02-sheet-open.png"), fullPage: false });

  // Check sheet metrics
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: r.width, left: r.left, right: r.right };
  });
  console.log("sheet:", sheet);

  // Close by pressing Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// Click an email row (first one with "Ana Martínez")
const anaRow = page.locator("text=Ana Martínez").first();
if (await anaRow.count()) {
  await anaRow.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT_DIR, "m375-03-email-open.png"), fullPage: false });

  const detailMetrics = await page.evaluate(() => {
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    };
  });
  console.log("detail metrics 375:", detailMetrics);
}

// Go back
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

// FAB "Redactar"
const redactar = page.locator("button:has-text('Redactar')").first();
if (await redactar.count()) {
  const fabBox = await redactar.boundingBox();
  console.log("Redactar FAB box:", fabBox);
  await redactar.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT_DIR, "m375-04-compose-open.png"), fullPage: false });

  const compose = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const r = dialog.getBoundingClientRect();
    return { width: r.width, height: r.height, left: r.left, top: r.top };
  });
  console.log("compose dialog 375:", compose);
}

// ── 768px: same tests
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT_DIR, "m768-01-initial.png"), fullPage: false });

// Click email at 768
const anaRow2 = page.locator("text=Ana Martínez").first();
if (await anaRow2.count()) {
  await anaRow2.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT_DIR, "m768-02-email-open.png"), fullPage: false });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log("detail 768:", m);
}

// ── 1280px: Compose on desktop
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(500);

const redactarD = page.locator("button:has-text('Redactar')").first();
if (await redactarD.count()) {
  await redactarD.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT_DIR, "d1280-03-compose.png"), fullPage: false });
  const compose = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    return { width: r.width, height: r.height, left: r.left, right: r.right, bottom: r.bottom, top: r.top, winW: window.innerWidth, winH: window.innerHeight };
  });
  console.log("compose 1280:", compose);
}

// ── 375px: AccountSwitcher popover
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
// Find switcher: button containing an avatar and chevron
const accSwitch = page.locator("button:has(svg.lucide-chevron-down)").first();
if (await accSwitch.count()) {
  await accSwitch.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, "m375-05-account-popover.png"), fullPage: false });
  const popover = await page.evaluate(() => {
    const el = document.querySelector('[data-radix-popper-content-wrapper], [role="menu"], [role="dialog"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: r.width, left: r.left, right: r.right, winW: window.innerWidth };
  });
  console.log("account popover 375:", popover);
}

console.log("\n==== ERRORS ====");
console.log(errors);
await browser.close();
