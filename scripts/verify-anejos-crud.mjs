import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-anejos";
await mkdir(OUT, { recursive: true });

async function login(p, userName) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: userName }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
}

async function openFirstPromotion(p) {
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
}

async function gotoDisponibilidad(p) {
  // Tab Disponibilidad/Unidades
  const tab = p.locator("button, a").filter({ hasText: /Unidades|Disponibilidad/ }).first();
  if (await tab.count()) await tab.click();
  await p.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errs = [];

  // 1) PROMOTOR · CRUD + toggle visibilidad
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(`[pageerror-promotor] ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error") errs.push(`[console-promotor] ${m.text()}`); });

    await login(p, "Arman Rahmanov");
    await openFirstPromotion(p);
    await gotoDisponibilidad(p);

    // Cambia al segmento Parkings
    await p.locator("button", { hasText: /^Parkings/ }).first().click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/01-promotor-parkings-inicial.png`, fullPage: true });

    // Añadir parking nuevo
    await p.locator("button", { hasText: /Añadir parking/ }).first().click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/02-promotor-modal-nuevo.png`, fullPage: true });

    // Rellenar ID + precio
    await p.locator("[role='dialog'] input").nth(0).fill("P99");
    await p.locator("[role='dialog'] input").nth(1).fill("19500");
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/03-promotor-modal-relleno.png`, fullPage: true });

    // Desactivar visibilidad (ejemplo)
    await p.locator("[role='dialog'] button", { hasText: "Visible para agencias" }).click();
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/04-promotor-visibilidad-off.png`, fullPage: true });

    // Guardar
    await p.locator("[role='dialog'] button", { hasText: /Añadir anejo/ }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/05-promotor-tabla-tras-crear.png`, fullPage: true });

    // Kebab de la nueva fila — tomar la 1ª fila (ordenada al principio)
    const firstKebab = p.locator("table tbody tr button[class*='text-muted-foreground']").first();
    await firstKebab.click({ force: true }).catch(() => {});
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/06-promotor-kebab-abierto.png`, fullPage: true });

    await ctx.close();
  }

  // 2) AGENCIA · ver que solo se ven los visibles+disponibles
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(`[pageerror-agencia] ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error") errs.push(`[console-agencia] ${m.text()}`); });

    await login(p, "Laura Sánchez");
    await openFirstPromotion(p);
    await gotoDisponibilidad(p);

    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/10-agencia-disponibilidad.png`, fullPage: true });

    // Si existe segmento Parkings, entrar
    const parkSeg = p.locator("button", { hasText: /^Parkings/ }).first();
    if (await parkSeg.count()) {
      await parkSeg.click();
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/11-agencia-parkings.png`, fullPage: true });
    }

    const trasSeg = p.locator("button", { hasText: /^Trasteros/ }).first();
    if (await trasSeg.count()) {
      await trasSeg.click();
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/12-agencia-trasteros.png`, fullPage: true });
    }

    await ctx.close();
  }

  await browser.close();

  if (errs.length) {
    console.log("⚠️ Errors capturados:");
    for (const e of errs) console.log(" -", e);
  } else {
    console.log("✅ Sin errores de consola.");
  }
  console.log(`📸 Screenshots en ${OUT}`);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
