import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/registros-minimalist";
const errors = [];

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

// DESKTOP 1440
const page1 = await ctx.newPage();
page1.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[1440] ${msg.text()}`);
});
page1.on("pageerror", (e) => errors.push(`[1440-pageerror] ${e.message}`));
await page1.setViewportSize({ width: 1440, height: 900 });
await login(page1);
await page1.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page1.waitForTimeout(800);
await page1.screenshot({ path: `${OUT}/1440-initial.png`, fullPage: false });

// Check KPI strip absence
const kpiStripPresent = await page1.evaluate(() => {
  const text = document.body.innerText;
  const hasAllKPILabels =
    text.includes("Pendientes") &&
    text.includes("Visitas") &&
    text.includes("Esta semana") &&
    text.includes("Resp. media");
  return hasAllKPILabels;
});

// Count visible top-toolbar buttons (Filtros)
const toolbarInfo = await page1.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const filtros = buttons.filter((b) => /filtros/i.test(b.innerText));
  return {
    filtrosCount: filtros.length,
    filtrosTexts: filtros.map((b) => b.innerText.trim()),
  };
});

// Click on "Filtros" button
const filtrosBtn = page1.getByRole("button", { name: /filtros/i }).first();
await filtrosBtn.click();
await page1.waitForTimeout(400);
await page1.screenshot({ path: `${OUT}/1440-filtros-popover.png`, fullPage: false });

const popoverInfo = await page1.evaluate(() => {
  // radix popover portal
  const portals = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"]'));
  const texts = portals.map((p) => p.innerText).join("\n---\n");
  return {
    text: texts,
    hasPromocion: /promoci[oó]n/i.test(texts),
    hasAgencia: /agencia/i.test(texts),
    hasOrigen: /origen/i.test(texts),
    hasDuplicados: /duplicados/i.test(texts),
    hasLimpiar: /limpiar/i.test(texts),
  };
});

// Close popover
await page1.keyboard.press("Escape");
await page1.waitForTimeout(300);

// Check list cards
const cardInfo = await page1.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('article, [data-registry-card], li[class*="cursor"], button[class*="cursor"]'))
    .filter((el) => el.offsetWidth > 100);
  // Heuristic: list cards tend to have checkboxes
  const listCards = Array.from(document.querySelectorAll('button[role="checkbox"], [role="checkbox"]'))
    .map((cb) => cb.closest("article, li, [class*=cursor-pointer], [class*=rounded]"))
    .filter(Boolean);
  const uniqueCards = [...new Set(listCards)];
  const inspect = uniqueCards.slice(0, 5).map((c) => c.innerText);
  return {
    total: uniqueCards.length,
    samples: inspect,
    hasDirectoPill: inspect.some((t) => /\bDIRECTO\b/.test(t)),
    hasColabPill: inspect.some((t) => /\bCOLAB\.?\b/.test(t)),
  };
});

// Click a card to open detail
const firstCard = page1.locator('[role="checkbox"]').first();
const firstCardContainer = firstCard.locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or self::article or self::li][1]');
try {
  // click near the card but not on checkbox - click the name
  const cards = await page1.locator('[role="checkbox"]').all();
  if (cards.length > 0) {
    const container = await cards[0].evaluateHandle((el) => el.closest("article, li, [class*='cursor-pointer'], [class*='rounded']"));
    // click the container at a safe offset
    const box = await (await container.asElement()).boundingBox();
    if (box) {
      await page1.mouse.click(box.x + box.width - 40, box.y + box.height / 2);
    }
  }
} catch (e) {
  errors.push(`[card-click] ${e.message}`);
}
await page1.waitForTimeout(800);
await page1.screenshot({ path: `${OUT}/1440-detail-open.png`, fullPage: false });
await page1.screenshot({ path: `${OUT}/1440-detail-full.png`, fullPage: true });

// Inspect detail panel
const detailInfo = await page1.evaluate(() => {
  const text = document.body.innerText;
  return {
    hasConsentimientoRGPD: /Consentimiento\s+RGPD/i.test(text),
    hasHuellaDigital: /Huella\s+digital/i.test(text),
    hasContexto: /\bContexto\b/.test(text),
    hasRol: /\bRol\b/.test(text),
    hasDispositivo: /\bDispositivo\b/.test(text),
    hasEnviadoHace: /Enviado hace/.test(text),
    hasRGPDPill: !!Array.from(document.querySelectorAll("*")).find((el) => {
      const t = (el.innerText || "").trim();
      return t === "RGPD" && el.children.length === 0;
    }),
    hasPromocionRow: /Promoci[oó]n:/i.test(text),
    hasOrigenRow: /Origen:/i.test(text),
  };
});

// MOBILE 375
const page2 = await ctx.newPage();
page2.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[375] ${msg.text()}`);
});
page2.on("pageerror", (e) => errors.push(`[375-pageerror] ${e.message}`));
await page2.setViewportSize({ width: 375, height: 812 });
await login(page2);
await page2.goto(BASE + "/registros", { waitUntil: "networkidle" });
await page2.waitForTimeout(800);
await page2.screenshot({ path: `${OUT}/375-initial.png`, fullPage: false });
await page2.screenshot({ path: `${OUT}/375-full.png`, fullPage: true });

// Log all info
console.log(JSON.stringify({
  kpiStripPresent,
  toolbarInfo,
  popoverInfo,
  cardInfo,
  detailInfo,
  errors,
}, null, 2));

await browser.close();
