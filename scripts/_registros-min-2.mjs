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

// Open filtros and pick one promo
await page.getByRole("button", { name: /filtros/i }).first().click();
await page.waitForTimeout(300);

// Click "Altea Hills Residences" option
const opt = page.locator('text="Altea Hills Residences"').first();
await opt.click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/1440-filter-selected.png`, fullPage: false });

// Now check the popover has Limpiar todo
const popText = await page.evaluate(() => {
  const portals = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"]'));
  return portals.map((p) => p.innerText).join("\n---\n");
});
console.log("POPOVER_AFTER_SELECT:", popText);

// Check the Filtros button became black
const filtrosBg = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("button"));
  const f = btns.find((b) => /filtros/i.test(b.innerText));
  if (!f) return null;
  const style = window.getComputedStyle(f);
  return {
    text: f.innerText,
    bg: style.backgroundColor,
    color: style.color,
    hasBadge: /\d/.test(f.innerText),
  };
});
console.log("FILTROS_BTN:", JSON.stringify(filtrosBg));

// Close popover
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Now let's look for RGPD pill by checking a specific registry that might have rgpdAccepted=false
// Click various cards and look at headers
const cards = await page.locator('[role="checkbox"]').all();
for (let i = 0; i < Math.min(cards.length, 5); i++) {
  const container = await cards[i].evaluateHandle((el) => el.closest("article, li, [class*='cursor-pointer']"));
  const el = await container.asElement();
  if (!el) continue;
  const box = await el.boundingBox();
  if (!box) continue;
  await page.mouse.click(box.x + box.width - 40, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const hasRGPDPill = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all.some((el) => {
      const t = (el.textContent || "").trim();
      return t === "RGPD" && el.children.length === 0;
    });
  });
  if (hasRGPDPill) {
    console.log(`Card ${i}: RGPD pill visible`);
    await page.screenshot({ path: `${OUT}/1440-rgpd-pill.png`, fullPage: false });
    break;
  }
}

await browser.close();
