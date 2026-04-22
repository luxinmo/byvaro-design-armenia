import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(700);

const asides = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("aside")).map(a => {
    const r = a.getBoundingClientRect();
    return {
      classes: a.className.slice(0, 200),
      visible: getComputedStyle(a).display !== "none",
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      parentTag: a.parentElement?.tagName,
      parentClasses: a.parentElement?.className?.slice(0, 100),
    };
  });
});
console.log("ASIDES (list view):");
console.log(JSON.stringify(asides, null, 2));

// Click on email
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll("*"));
  const target = all.find(el => el.textContent && el.textContent.includes("Confirmación visita Promoción Sotogrande") && el.children.length === 0);
  let row = target;
  while (row && !row.className?.includes?.("cursor-pointer")) row = row.parentElement;
  row?.click();
});
await page.waitForTimeout(700);

const asides2 = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("aside")).map(a => {
    const r = a.getBoundingClientRect();
    return {
      classes: a.className.slice(0, 200),
      visible: getComputedStyle(a).display !== "none",
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      parentTag: a.parentElement?.tagName,
    };
  });
});
console.log("\nASIDES (detail view):");
console.log(JSON.stringify(asides2, null, 2));

await browser.close();
