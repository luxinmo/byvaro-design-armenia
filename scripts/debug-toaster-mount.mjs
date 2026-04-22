import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const check = await page.evaluate(() => ({
  sonnerToaster: document.querySelectorAll("[data-sonner-toaster]").length,
  portalSections: document.querySelectorAll("section[aria-label*='otification']").length,
  allSections: [...document.querySelectorAll("section")].map(s => ({ aria: s.getAttribute("aria-label") || "", cls: s.className.slice(0, 80) })),
  anyToastClass: document.querySelectorAll(".sonner-toast, .toast, [data-toast]").length,
}));
console.log(JSON.stringify(check, null, 2));
await browser.close();
