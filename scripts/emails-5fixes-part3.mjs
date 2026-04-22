import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-5fixes-audit";
await mkdir(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const report = { viewport: vp.name, width: vp.width, checks: {}, errors: [] };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text().slice(0, 200)); });

  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // For mobile (<768) the sidebar is a Sheet — open it first via the menu icon
  if (vp.width < 768) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b =>
        b.querySelector("svg.lucide-menu") && b.classList.contains("md:hidden")
      ) || Array.from(document.querySelectorAll("button")).find(b => b.querySelector("svg.lucide-menu"));
      btn?.click();
    });
    await page.waitForTimeout(500);
  }

  // Now look for "Etiquetas" header
  const etqHeader = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("span")).filter(e =>
      e.textContent && e.textContent.trim() === "Etiquetas" && e.children.length === 0
    );
    if (!all.length) return { exists: false };
    const span = all[0];
    const row = span.parentElement;
    const plusBtn = row?.querySelector('button[title="Nueva etiqueta"]');
    return {
      exists: true,
      plusFound: !!plusBtn,
      plusTitle: plusBtn?.getAttribute("title"),
    };
  });
  report.checks.etiquetas = etqHeader;

  if (etqHeader.plusFound) {
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Nueva etiqueta"]');
      btn?.click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p3-etiqueta-input.png`), fullPage: false });

    const inp = await page.evaluate(() => {
      const i = Array.from(document.querySelectorAll("input")).find(i =>
        i.placeholder === "Nombre de etiqueta" && i.offsetParent !== null
      );
      return i ? { found: true, focused: document.activeElement === i, placeholder: i.placeholder } : { found: false };
    });
    report.checks.inputAfterPlus = inp;

    if (inp.found) {
      const newLabel = `Audit_${vp.name}`;
      await page.keyboard.type(newLabel);
      await page.waitForTimeout(150);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p3-etiqueta-created.png`), fullPage: false });
      const created = await page.evaluate((l) => {
        return Array.from(document.querySelectorAll("button span")).some(s =>
          s.textContent && s.textContent.trim() === l
        );
      }, newLabel);
      report.checks.labelCreated = created;

      // Test Escape cancels
      await page.evaluate(() => {
        const btn = document.querySelector('button[title="Nueva etiqueta"]');
        btn?.click();
      });
      await page.waitForTimeout(200);
      await page.keyboard.type("CancelTest");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const cancelled = await page.evaluate(() =>
        !Array.from(document.querySelectorAll("button span")).some(s => s.textContent && s.textContent.trim() === "CancelTest")
      );
      report.checks.escapeCancels = cancelled;
    }
  }

  await ctx.close();
  results.push(report);
}

await browser.close();
await writeFile(join(OUT_DIR, "report-p3.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
