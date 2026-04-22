import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Llamar directamente a Sonner
await page.evaluate(() => {
  // Buscar Redactar y clickar
  const btns = [...document.querySelectorAll("button")];
  const r = btns.find((b) => b.textContent.trim() === "Redactar");
  r.click();
});
await page.waitForTimeout(800);

// Rellenar y cerrar
await page.locator('input[placeholder="Para"]').first().fill("test@example.com");
await page.locator('input[placeholder="Asunto"]').first().fill("Borrador test");
// Body
const body = page.locator("[contenteditable='true']").first();
await body.click();
await page.keyboard.press("Home");
await page.keyboard.type("Hola prueba");

// Click X del header
await page.evaluate(() => {
  const header = document.querySelector("div.h-12.bg-muted\\/40");
  const btns = [...header.querySelectorAll("button")];
  btns[btns.length - 1].click();
});
await page.waitForTimeout(500);

// Capturar DOM de toasts — todos los posibles selectores
const dom = await page.evaluate(() => {
  return {
    sonnerToasters: document.querySelectorAll("[data-sonner-toaster]").length,
    sonnerToasts: document.querySelectorAll("[data-sonner-toast]").length,
    sonnerToastHtml: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.outerHTML.slice(0, 300)),
    allToastsByAriaLive: [...document.querySelectorAll("[aria-live]")].map((t) => ({
      role: t.getAttribute("role"),
      html: t.outerHTML.slice(0, 200),
    })),
    hasTitle: [...document.querySelectorAll("[data-title]")].map((t) => t.textContent?.trim().slice(0, 80)),
  };
});
console.log(JSON.stringify(dom, null, 2));
await page.screenshot({ path: "/tmp/debug-toast.png", fullPage: true });
await browser.close();
