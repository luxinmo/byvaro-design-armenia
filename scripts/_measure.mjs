import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
const p = await ctx.newPage();
await p.goto("http://localhost:8080/ajustes/email", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
// scroll to bottom
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(400);
const info = await p.evaluate(() => {
  const link = [...document.querySelectorAll("a")].find(a => /Volver al cliente/i.test(a.textContent||""));
  const nav = [...document.querySelectorAll("nav, div")].find(n => {
    const cs = getComputedStyle(n);
    const cls = (n.className||"").toString();
    return cs.position === "fixed" && cs.bottom === "0px" && /lg:hidden/.test(cls) && n.querySelector("button");
  });
  return {
    linkBox: link ? link.getBoundingClientRect() : null,
    linkText: link ? link.textContent.trim() : null,
    navBox: nav ? nav.getBoundingClientRect() : null,
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    scrollHeight: document.body.scrollHeight,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
