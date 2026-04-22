import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/debug-emails-1440.png", fullPage: true });

// Check rows
const rows = await page.evaluate(() => {
  const items = [...document.querySelectorAll("div, li, button, a")];
  return items
    .filter((el) => el.textContent?.includes("Confirmación visita"))
    .slice(0, 5)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: el.className?.toString().slice(0, 120),
        text: el.textContent.slice(0, 80),
        visible: r.width > 0 && r.height > 0,
        r: { x: r.x, y: r.y, w: r.width, h: r.height },
        hidden: getComputedStyle(el).display === "none" || getComputedStyle(el).visibility === "hidden",
      };
    });
});
console.log("rows:", JSON.stringify(rows, null, 2));

await browser.close();
