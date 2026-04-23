/**
 * E2E · AccountSwitcher + flow de registro desde agencia.
 *
 * Recorre el flow completo:
 *   1. Abre /inicio y busca el pill del AccountSwitcher.
 *   2. Cambia a agencia Prime Properties.
 *   3. Verifica sidebar sin Colaboradores / Microsites / Empresa.
 *   4. Va a /promociones y cuenta cards.
 *   5. Entra a una promoción activa y dispara "Registrar cliente".
 *   6. Crea un cliente nuevo "Test Agencia E2E".
 *   7. Confirma y comprueba que aparece arriba del todo en /registros.
 *
 * Uso: `node scripts/account-switcher-e2e.mjs` con dev server levantado.
 */

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-account-test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push({ source: "page", msg: e.message }));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push({ source: "console", msg: m.text() });
  });

  const log = (step, status, extra = "") =>
    console.log(`${status === "ok" ? "✅" : status === "warn" ? "🟡" : "❌"} ${step}${extra ? " · " + extra : ""}`);

  // 1 — home
  await page.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  const pill = page.locator("header button", { hasText: /Promotor · /i }).first();
  await pill.waitFor({ timeout: 5000 });
  const pillLabel = (await pill.innerText()).trim();
  log(`1. Pill visible — "${pillLabel}"`, "ok");
  await page.screenshot({ path: `${OUT}/1-home.png` });

  // 2 — abrir dropdown
  await pill.click();
  await page.waitForTimeout(200);
  const menuText = (await page.locator("[role='menu']").innerText()).trim();
  const agenciesOk = ["Prime Properties", "Nordic Home Finders", "Dutch & Belgian", "Meridian"].every((n) =>
    menuText.includes(n),
  );
  const noPending = !menuText.includes("Iberia Luxury") && !menuText.includes("Baltic Property");
  log(`2. Dropdown con agencias correctas`, agenciesOk && noPending ? "ok" : "fail",
    `agenciesOk=${agenciesOk} noPending=${noPending}`);
  await page.screenshot({ path: `${OUT}/2-dropdown.png` });

  // 3 — click Prime Properties
  await page.locator("[role='menu'] button", { hasText: "Prime Properties Costa del Sol" }).click();
  await page.waitForTimeout(400);
  /* El pill ha cambiado de texto — lo releemos por posición (es el primer
   * botón aria-haspopup=menu del header). */
  const anyPill = page.locator("header button[aria-haspopup='menu']").first();
  const pill2 = (await anyPill.innerText()).trim();
  log(`3. Pill cambiado a Agencia — "${pill2}"`, pill2.includes("Agencia · Prime") ? "ok" : "fail");
  await page.screenshot({ path: `${OUT}/3-agency-active.png` });

  // 4 — sidebar
  const sidebar = page.locator("aside").first();
  const sidebarText = await sidebar.innerText();
  const sidebarOk =
    !sidebarText.includes("Colaboradores") &&
    !sidebarText.includes("Microsites") &&
    !sidebarText.includes("Empresa") &&
    sidebarText.includes("Laura Sánchez") &&
    sidebarText.includes("Prime Properties");
  log(`4. Sidebar limpio + usuario Laura Sánchez`, sidebarOk ? "ok" : "fail");
  if (!sidebarOk) {
    console.log("   Sidebar text:", sidebarText.split("\n").slice(0, 20).join(" | "));
  }

  // 5 — promociones listado
  await page.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const promoCards = await page.locator("[data-promo-card], article").count();
  log(`5. /promociones en modo agencia — ${promoCards} cards visibles`, promoCards > 0 && promoCards < 20 ? "ok" : "warn");
  await page.screenshot({ path: `${OUT}/5-promos.png` });

  // 6 — entrar a una promoción (article con cursor-pointer)
  const firstCard = page.locator("main article.cursor-pointer").first();
  await firstCard.waitFor({ timeout: 5000 });
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  const pageText = await page.locator("body").innerText();
  const hasPreviewBanner = pageText.includes("Previsualizando como colaborador");
  const hasRegisterBtn = pageText.includes("Registrar cliente");
  log(`6. Ficha promoción · sin banner preview`, !hasPreviewBanner ? "ok" : "fail");
  log(`6. Ficha promoción · botón Registrar visible`, hasRegisterBtn ? "ok" : "fail");
  await page.screenshot({ path: `${OUT}/6-ficha.png` });

  // 7 — click Registrar
  await page.locator("button", { hasText: "Registrar cliente" }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/7-dialog-open.png` });

  // Escribir en el buscador para desbloquear "Crear nuevo"
  const searchInput = page.locator("input[placeholder*='Buscar por nombre']").first();
  await searchInput.fill("Test Agencia E2E");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/7-after-search.png` });

  // Click en "Crear nuevo" o similar
  const createBtn = page.locator("button", { hasText: /Crear nuevo/i }).first();
  if (await createBtn.count()) {
    await createBtn.click();
    await page.waitForTimeout(300);
  } else {
    log("7. No apareció botón Crear nuevo", "warn");
  }
  await page.screenshot({ path: `${OUT}/7-form-shown.png` });

  /* Formulario: NOMBRE · TELÉFONO · EMAIL · NACIONALIDAD. Rellenamos por
   * posición (los inputs siempre vienen en ese orden) + blur para disparar
   * la validación. La nacionalidad es un popover con búsqueda. */
  const dialogInputs = page.locator("[role='dialog'] input");
  await dialogInputs.nth(0).fill("Test Agencia E2E");
  await dialogInputs.nth(0).blur();
  await dialogInputs.nth(1).fill("+34 600 000 000");
  await dialogInputs.nth(1).blur();
  await dialogInputs.nth(2).fill("test.e2e@agencia.com");
  await dialogInputs.nth(2).blur();
  await page.waitForTimeout(200);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/7-form-filled.png` });

  // Avanzar (puede requerir "Siguiente" antes de "Confirmar")
  const nextBtn = page.locator("[role='dialog'] button", { hasText: /Siguiente|Continuar/ });
  if (await nextBtn.count()) {
    await nextBtn.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/7-after-next.png` });
  }

  const confirmBtn = page.locator("[role='dialog'] button", {
    hasText: /Confirmar registro|Registrar cliente|Confirmar$/,
  }).last();
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForTimeout(800);
    log(`7. Confirmación lanzada`, "ok");
  } else {
    log("7. No se encontró botón Confirmar", "warn");
  }

  // 8 — ir a registros
  await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const regsText = await page.locator("body").innerText();
  const foundNewReg = regsText.includes("Test Agencia E2E");
  log(`8. /registros contiene el nuevo registro`, foundNewReg ? "ok" : "fail");
  await page.screenshot({ path: `${OUT}/8-registros-agencia.png` });

  // 9 — volver a Promotor
  const pillAgain = page.locator("header button[aria-haspopup='menu']").first();
  await pillAgain.click();
  await page.waitForTimeout(200);
  await page.locator("[role='menu'] button", { hasText: /^Promotor/ }).first().click();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const promotorSidebarText = await page.locator("aside").first().innerText();
  const hasColaboradores = promotorSidebarText.includes("Colaboradores");
  const hasMicrosites = promotorSidebarText.includes("Microsites");
  const hasEmpresa = promotorSidebarText.includes("Empresa");
  log(`9. Sidebar promotor con Colaboradores/Microsites/Empresa`,
    hasColaboradores && hasMicrosites && hasEmpresa ? "ok" : "fail");
  await page.screenshot({ path: `${OUT}/9-promotor-sidebar.png` });

  console.log("\n── Errores de consola/runtime ──");
  if (errors.length === 0) console.log("✅ Ninguno");
  else errors.forEach((e) => console.log(`❌ [${e.source}] ${e.msg}`));

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
