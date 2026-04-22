import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-7fixes-audit";
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

// Go to Enviados
const enviados = page.locator('aside button:has-text("Enviados")').first();
await enviados.click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, "1440-full-sent-list.png"), fullPage: true });

// Click the first row (Dossier Sotogrande) — use the onclick row element directly
await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).filter(e => e.offsetParent !== null);
  // Find row containing "Dossier Sotogrande actualizado"
  const target = rows.find(r => /Dossier Sotogrande actualizado/.test(r.textContent || ""));
  if (target) {
    // click the row itself (bubbles up)
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }
});
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, "1440-full-sotogrande-detail.png"), fullPage: true });

// Check TrackingCard presence in DOM
const trackingCard = await page.evaluate(() => {
  const txt = document.body.textContent || "";
  const matches = {
    "Tracking · Enviado vía sistema Byvaro": txt.includes("Tracking · Enviado vía sistema Byvaro"),
    "Enviado": /\bEnviado\b/.test(txt),
    "Entregado": /\bEntregado\b/.test(txt),
    "Aperturas": /\bAperturas\b/.test(txt),
    "Clicks": /\bClicks\b/.test(txt),
    "Destinatario:": /Destinatario:/.test(txt),
    "Primera apertura:": /Primera apertura:/.test(txt),
  };
  return matches;
});

// Go back, open bounced
const volver = page.locator('button[title="Volver a la bandeja"]').first();
if (await volver.count()) { await volver.click(); await page.waitForTimeout(500); }

await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).filter(e => e.offsetParent !== null);
  const target = rows.find(r => /Unidad B-204/.test(r.textContent || ""));
  if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
});
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, "1440-full-bounced-detail.png"), fullPage: true });

const bouncedCard = await page.evaluate(() => {
  const txt = document.body.textContent || "";
  return {
    hasRebotado: /\bRebotado\b/.test(txt),
    hasEnviado: /\bEnviado\b/.test(txt),
    hasAperturas: /\bAperturas\b/.test(txt),
    hasClicks: /\bClicks\b/.test(txt),
    hasMotivoRebote: /Motivo del rebote/.test(txt),
  };
});

await browser.close();
await writeFile(join(OUT, "report-part3.json"), JSON.stringify({ trackingCard, bouncedCard }, null, 2));
console.log(JSON.stringify({ trackingCard, bouncedCard }, null, 2));
