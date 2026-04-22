import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const r = btns.find((b) => b.textContent.trim() === "Redactar");
  r.click();
});
await page.waitForTimeout(700);

const info = await page.evaluate(() => {
  const allFixed = [...document.querySelectorAll("div.fixed")];
  const withEditor = allFixed.filter((d) => d.querySelector("[contenteditable='true']"));
  const withPara = allFixed.filter((d) => d.querySelector('input[placeholder="Para"]'));
  const compose = allFixed.find((d) =>
    d.querySelector("[contenteditable='true']") && d.querySelector('input[placeholder="Para"]'),
  );
  if (!compose) return { found: false, fixed: allFixed.length, withEditor: withEditor.length, withPara: withPara.length };
  const btns = [...compose.querySelectorAll("button")];
  const svgs = btns.map((b) => {
    const svg = b.querySelector("svg");
    return {
      title: b.getAttribute("title"),
      svgClass: svg?.getAttribute("class") || null,
      svgClassList: svg ? [...svg.classList] : [],
    };
  });
  return { found: true, btnCount: btns.length, svgs };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
