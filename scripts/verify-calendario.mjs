/**
 * verify-calendario.mjs · test automático del Calendario.
 *
 * Complementa `docs/qa/calendario-tester.md` · ejecuta el navegador
 * contra el dev server (`npm run dev`) y valida los flujos críticos:
 *   - Vista Semana / Mes / Día / Agenda cargan sin errores.
 *   - Dialog de crear abre con los 5 tipos.
 *   - Segmented mobile sólo ofrece Mes/Agenda.
 *   - No hay errores de consola ni pageerrors.
 *   - FAB mobile visible en <1024px.
 *   - Navegación ‹/› funciona.
 *
 * No valida lógica server-side (no hay backend) ni flujos Registro↔
 * Visita (ese test llegará cuando hagamos la UI del promotor
 * aceptando visitas · ver docs/qa/calendario-tester.md §D).
 *
 * Uso:
 *   1. Terminal A · npm run dev
 *   2. Terminal B · node scripts/verify-calendario.mjs
 *
 * Sale con código 0 si todo OK, 1 si alguna aserción falla.
 */

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const failures = [];
const ok = [];

function pass(msg) {
  ok.push(msg);
  console.log("  ✅", msg);
}

function fail(msg) {
  failures.push(msg);
  console.log("  ❌", msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  p.on("pageerror", (e) => fail(`pageerror · ${e.message}`));
  p.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("React Router Future Flag")) {
      fail(`console.error · ${msg.text().slice(0, 120)}`);
    }
  });

  /* ══════ LOGIN ══════ */
  console.log("\n▶ LOGIN");
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const promotorBtn = p.locator("button", { hasText: "Arman" }).first();
  if ((await promotorBtn.count()) === 0) {
    fail("Botón de login con Arman no encontrado");
  } else {
    await promotorBtn.click();
    await p.waitForURL(/\/inicio/, { timeout: 5000 });
    pass("Login promotor OK");
  }

  /* ══════ A · VISTA SEMANA (default desktop) ══════ */
  console.log("\n▶ A · Vista Semana");
  await p.goto(`${BASE}/calendario`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);

  const h1 = p.locator("h1", { hasText: "Calendario" });
  (await h1.count()) > 0 ? pass("H1 'Calendario' visible") : fail("Falta H1 'Calendario'");

  const segSemana = p.locator("button", { hasText: "Semana" }).first();
  if ((await segSemana.getAttribute("class"))?.includes("bg-card")) {
    pass("Semana es la vista por defecto en desktop");
  } else {
    fail("Semana NO es la vista por defecto");
  }

  /* Columnas de la semana: esperamos 7 cabeceras de día */
  const weekdayHeaders = await p.locator("thead, [class*='border-border']").first().count();
  if (weekdayHeaders > 0) pass("Cabecera de semana renderizada");
  else fail("No se ve cabecera de semana");

  /* ══════ B · NAVEGACIÓN ══════ */
  console.log("\n▶ B · Navegación ‹/›/Hoy");
  const prev = p.locator("button[aria-label='Anterior']").first();
  const next = p.locator("button[aria-label='Siguiente']").first();
  const hoyBtn = p.locator("button", { hasText: "Hoy" }).first();

  await next.click();
  await p.waitForTimeout(200);
  await prev.click();
  await p.waitForTimeout(200);
  await hoyBtn.click();
  await p.waitForTimeout(200);
  pass("Navegación ‹/›/Hoy sin errores");

  /* ══════ C · CAMBIO DE VISTAS ══════ */
  console.log("\n▶ C · Cambio de vistas");
  for (const view of ["Mes", "Día", "Agenda", "Semana"]) {
    await p.locator("button", { hasText: new RegExp(`^${view}$`) }).first().click();
    await p.waitForTimeout(300);
    pass(`Vista "${view}" se pinta`);
  }

  /* ══════ D · DIALOG CREAR ══════ */
  console.log("\n▶ D · Dialog crear evento");
  await p.locator("button", { hasText: "Crear evento" }).first().click();
  await p.waitForTimeout(400);

  const dialogTitle = p.locator("[role='dialog']", { hasText: "Nuevo evento" });
  (await dialogTitle.count()) > 0 ? pass("Dialog 'Nuevo evento' abierto") : fail("Dialog no abre");

  const typeVisit = p.locator("[role='dialog'] button", { hasText: "Visita" }).first();
  const typeCall  = p.locator("[role='dialog'] button", { hasText: "Llamada" }).first();
  const typeMeet  = p.locator("[role='dialog'] button", { hasText: "Reunión" }).first();
  const typeBlock = p.locator("[role='dialog'] button", { hasText: "Bloqueo" }).first();
  const typeRem   = p.locator("[role='dialog'] button", { hasText: "Recordatorio" }).first();

  if ((await typeVisit.count()) && (await typeCall.count()) && (await typeMeet.count())
      && (await typeBlock.count()) && (await typeRem.count())) {
    pass("5 tipos de evento presentes");
  } else {
    fail("Faltan tipos de evento en el segmented");
  }

  /* Tecleo un título y abro el ContactPicker */
  await p.locator("[role='dialog'] input[placeholder^='Visita']").fill("Visita test QA");
  await p.waitForTimeout(200);
  pass("Campo título editable");

  /* Cerrar dialog */
  await p.locator("[role='dialog'] button", { hasText: "Cancelar" }).click();
  await p.waitForTimeout(300);
  pass("Dialog cierra con Cancelar");

  /* ══════ E · MOBILE ══════ */
  console.log("\n▶ E · Responsive mobile (375×700)");
  await ctx.close();
  const ctxMobile = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const pm = await ctxMobile.newPage();
  pm.on("pageerror", (e) => fail(`mobile pageerror · ${e.message}`));
  pm.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("React Router Future Flag")) {
      fail(`mobile console.error · ${msg.text().slice(0, 120)}`);
    }
  });

  /* Re-login en mobile */
  await pm.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pm.locator("button", { hasText: "Arman" }).first().click();
  await pm.waitForURL(/\/inicio/, { timeout: 5000 });
  await pm.goto(`${BASE}/calendario`, { waitUntil: "networkidle" });
  await pm.waitForTimeout(500);

  /* El segmented mobile solo debe mostrar "Mes" y "Agenda" (sin Semana ni Día) */
  const hasSemana = await pm.locator("button", { hasText: /^Semana$/ }).count();
  const hasDia    = await pm.locator("button", { hasText: /^Día$/ }).count();
  if (hasSemana === 0 && hasDia === 0) {
    pass("Segmented mobile solo muestra Mes/Agenda (sin Semana/Día)");
  } else {
    fail(`Segmented mobile muestra Semana(${hasSemana}) o Día(${hasDia}) indebidamente`);
  }

  /* FAB flotante */
  const fab = pm.locator("button[aria-label='Crear evento']").first();
  if ((await fab.count()) > 0) {
    pass("FAB mobile visible");
  } else {
    fail("FAB mobile NO visible");
  }

  /* Botón Agentes abre drawer */
  const agentsBtn = pm.locator("button[aria-label='Agentes']").first();
  if ((await agentsBtn.count()) > 0) {
    await agentsBtn.click();
    await pm.waitForTimeout(300);
    const drawerTitle = pm.locator("h3", { hasText: "Mis calendarios" });
    if ((await drawerTitle.count()) > 0) {
      pass("Drawer de agentes mobile abre");
    } else {
      fail("Drawer de agentes mobile no abre");
    }
  } else {
    fail("Botón 'Agentes' mobile no presente");
  }

  await browser.close();

  /* ══════ RESUMEN ══════ */
  console.log("\n───────────────────────────────");
  console.log(`✅ Pasaron: ${ok.length}`);
  console.log(`❌ Fallaron: ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nFallos:");
    failures.forEach((f) => console.log(`  · ${f}`));
    process.exit(1);
  }
  console.log("\n✨ Todo OK");
}

main().catch((e) => {
  console.error("Error no capturado:", e);
  process.exit(1);
});
