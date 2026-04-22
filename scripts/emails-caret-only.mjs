import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-arregla-todo";
await mkdir(OUT_DIR, { recursive: true });

const COMPOSE_SEL = "div.fixed.z-50.border-border.shadow-soft-lg";
const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 1280, h: 800 },
];

const browser = await chromium.launch();
const results = {};

for (const vp of VIEWPORTS) {
  const label = `${vp.w}-caret`;
  results[label] = { errors: [], findings: {} };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results[label].errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") results[label].errors.push("console: " + m.text()); });

  try {
    await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(600);
    const redactar = page.locator("button:has-text('Redactar'):visible").first();
    await redactar.click({ timeout: 3000 });
    await page.waitForTimeout(800);

    const initial = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return { error: "no compose" };
      const body = root.querySelector('[contenteditable="true"]');
      if (!body) return { error: "no contenteditable" };
      const html = body.innerHTML;
      const sel1 = window.getSelection();
      let caretOffset = null;
      let caretParentTag = null;
      let caretParentIsBody = null;
      if (sel1 && sel1.rangeCount > 0) {
        const range = sel1.getRangeAt(0);
        caretOffset = range.startOffset;
        caretParentTag = range.startContainer.nodeName;
        caretParentIsBody = range.startContainer === body;
      }
      // Find where signature begins in rendered text
      const text = body.innerText;
      return {
        bodyInnerTextLen: text.length,
        firstChars: text.slice(0, 80),
        caretOffset,
        caretParentTag,
        caretParentIsBody,
        htmlPreview: html.slice(0, 400),
      };
    }, COMPOSE_SEL);
    results[label].findings.initial = initial;

    // Ensure focus on body then type
    await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const body = root.querySelector('[contenteditable="true"]');
      if (body) body.focus();
    }, COMPOSE_SEL);
    await page.keyboard.type("TEXTO_PRUEBA");
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT_DIR, `${label}-typed.png`), fullPage: false });

    const afterType = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return { error: "no compose" };
      const body = root.querySelector('[contenteditable="true"]');
      if (!body) return { error: "no contenteditable" };
      const text = body.innerText;
      const html = body.innerHTML;
      const iText = text.indexOf("TEXTO_PRUEBA");
      const iPhone = text.indexOf("📞");
      const iByvaro = text.indexOf("Byvaro");
      const iMail = text.indexOf("@");
      return {
        textLen: text.length,
        firstChars: text.slice(0, 120),
        textIndex: iText,
        phoneIndex: iPhone,
        byvaroIndex: iByvaro,
        mailIndex: iMail,
        textBeforeSig:
          iText >= 0 &&
          (iPhone < 0 || iText < iPhone) &&
          (iByvaro < 0 || iText < iByvaro) &&
          (iMail < 0 || iText < iMail),
        htmlPreview: html.slice(0, 600),
      };
    }, COMPOSE_SEL);
    results[label].findings.afterType = afterType;
  } catch (e) {
    results[label].errors.push("TOP: " + e.message);
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
