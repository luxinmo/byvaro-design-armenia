import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const BASE_URL = "http://localhost:8080";
const OUT_DIR = "screenshots/emails-audit";
await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

await page.setViewportSize({ width: 768, height: 1024 });
await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const rowInfo = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("*")).filter(el => el.textContent === "Ana Martínez").map(el => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      classes: el.className.slice(0, 150),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      display: style.display,
      visibility: style.visibility,
      parentClasses: el.parentElement ? el.parentElement.className.slice(0, 150) : null,
    };
  });
});
console.log("rows:", JSON.stringify(rowInfo, null, 2));

// Try clicking the row by JS
const clickRes = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll("div,tr,button")).filter(el => el.textContent && el.textContent.includes("Ana Martínez") && el.textContent.includes("Confirmación"));
  const r = rows[0];
  if (r) {
    const box = r.getBoundingClientRect();
    return { found: true, tag: r.tagName, rect: { x: box.x, y: box.y, w: box.width, h: box.height } };
  }
  return { found: false };
});
console.log("clickable row:", clickRes);

await browser.close();
