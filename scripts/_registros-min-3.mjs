import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/registros-minimalist";

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "arman@byvaro.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(inicio|$)/, { timeout: 10000 });
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await login(page);
await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Open filtros
await page.getByRole("button", { name: /filtros/i }).first().click();
await page.waitForTimeout(400);

// Find a checkbox-like element inside the popover and click via JS
const clicked = await page.evaluate(() => {
  const portals = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'));
  if (!portals.length) return "no-portal";
  const portal = portals[0];
  // find the Altea option
  const btns = Array.from(portal.querySelectorAll('button, [role="menuitemcheckbox"], [role="option"], label'));
  const altea = btns.find(b => /Altea Hills/i.test(b.innerText || b.textContent || ""));
  if (altea) {
    altea.click();
    return "clicked-altea: " + altea.tagName;
  }
  return "not-found";
});
console.log("clickResult:", clicked);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/1440-after-filter-click.png`, fullPage: false });

// Re-query popover
const state1 = await page.evaluate(() => {
  const portals = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'));
  const text = portals.map(p => p.innerText).join("\n");
  const hasLimpiar = /Limpiar/i.test(text);
  return { text, hasLimpiar };
});
console.log("STATE1:", JSON.stringify(state1.hasLimpiar), "snippet:", state1.text.slice(0, 400));

// Close popover & check Filtros button
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

const filtrosState = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("button"));
  const f = btns.find(b => /filtros/i.test(b.innerText));
  if (!f) return null;
  const style = window.getComputedStyle(f);
  return { text: f.innerText, bg: style.backgroundColor, color: style.color };
});
console.log("FILTROS_AFTER_SEL:", JSON.stringify(filtrosState));
await page.screenshot({ path: `${OUT}/1440-filter-badge.png`, fullPage: false });

await browser.close();
