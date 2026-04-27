/**
 * dual-role-audit.mjs · auditor E2E con Playwright que comprueba que
 * NO hay fugas de información entre el rol Promotor y el rol Agencia
 * colaboradora.
 *
 * Cómo se usa:
 *   1) Levanta el dev server · `npm run dev` (puerto 8080).
 *   2) En otra terminal · `node scripts/dual-role-audit.mjs`.
 *   3) Lee el reporte que imprime al final · si todo es ✅ está listo
 *      para producción frontend (asumiendo backend con RLS aplicada,
 *      ver docs/backend-integration.md §1.5.2).
 *
 * Qué hace:
 *   A. Login como agencia · prueba acceso por URL a las 12 rutas
 *      promotor-only · verifica que se redirige a /inicio.
 *   B. Login como agencia · entra a /calendario, /registros, /ventas
 *      y comprueba que no aparecen agentes/clientes/ventas de OTRA
 *      agencia ni del equipo del promotor.
 *   C. Login como promotor · verifica que las rutas que la agencia
 *      tiene bloqueadas SÍ funcionan para él.
 *   D. Reporte · 3 listados · ✅ pasados · ⚠️ warnings · ❌ fallos.
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const OUT_DIR = "/tmp/dual-role-audit";
mkdirSync(OUT_DIR, { recursive: true });

/* ─── Cuentas demo · de src/data/mockUsers.ts ───────────────────── */
const PROMOTER = { email: "arman@byvaro.com", password: "demo1234" };
const AGENCY   = { email: "laura@primeproperties.com", password: "demo1234" };

/* ─── Rutas promotor-only · deben redirigir a /inicio para agencia ─ */
const PROMOTER_ONLY_ROUTES = [
  "/actividad",
  "/sugerencias",
  "/oportunidades",
  "/colaboradores",
  "/colaboradores/estadisticas",
  "/colaboradores/ag-1",
  "/colaboradores/ag-1/panel",
  "/colaboradores/ag-1/historial",
  "/contratos",
  "/equipo",
  "/microsites",
  "/emails",
];

/* ─── Rutas compartidas · agencia debe verlas pero filtradas ───── */
const SHARED_ROUTES = [
  "/inicio",
  "/promociones",
  "/registros",
  "/ventas",
  "/calendario",
  "/contactos",
  "/empresa",
  "/estadisticas",
];

/* ─── Helpers ──────────────────────────────────────────────────── */
const passes = [];
const warnings = [];
const failures = [];

const log = (level, msg) => {
  const prefix = level === "pass" ? "✅" : level === "warn" ? "⚠️ " : "❌";
  console.log(`${prefix} ${msg}`);
  if (level === "pass") passes.push(msg);
  else if (level === "warn") warnings.push(msg);
  else failures.push(msg);
};

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="password"]', who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function inspectBody(page) {
  return page.evaluate(() => ({
    text: document.body.innerText.slice(0, 4000),
    pathname: location.pathname,
    title: document.title,
  }));
}

/* ─── Tests ────────────────────────────────────────────────────── */

async function testPromoterOnlyRedirects(ctx) {
  const page = await ctx.newPage();
  await login(page, AGENCY);

  for (const route of PROMOTER_ONLY_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const path = new URL(page.url()).pathname;
    if (path === "/inicio") {
      log("pass", `[A] Agencia · ${route} redirige a /inicio`);
    } else if (path === route) {
      log("fail", `[A] Agencia · ${route} ACCESIBLE (esperado redirect a /inicio · pathname=${path})`);
    } else {
      log("warn", `[A] Agencia · ${route} → ${path} (no es /inicio · investigar)`);
    }
  }
  await page.close();
}

async function testCalendarLeak(ctx) {
  const page = await ctx.newPage();
  await login(page, AGENCY);
  await page.goto(`${BASE}/calendario`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/agency-calendar.png`, fullPage: true });

  /* Comprueba que no aparezcan nombres de agentes del promotor.
   * Lista de team members de Luxinmo (de src/lib/team.ts). */
  const promoterAgents = ["Carlos Martínez", "Ana García", "Diego López", "Marta Pérez", "Juan Ruiz"];
  const { text } = await inspectBody(page);
  const leaks = promoterAgents.filter((n) => text.includes(n));
  if (leaks.length === 0) {
    log("pass", `[B] Calendario · agencia no ve agentes del promotor (${promoterAgents.length} candidatos verificados)`);
  } else {
    log("fail", `[B] Calendario · agencia ve nombres del equipo promotor: ${leaks.join(", ")}`);
  }
  await page.close();
}

async function testRegistrosLeak(ctx) {
  const page = await ctx.newPage();
  await login(page, AGENCY);
  await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/agency-registros.png`, fullPage: true });

  /* La agencia es ag-1 (Prime Properties). No debe ver registros de
   * otras agencias (ag-2, ag-3) ni nombres de cliente que no sean
   * suyos. Heurística simple: textos típicos del seed de otras agencias. */
  const otherAgencyMarkers = ["Nordic Homes", "International Realty", "Mediterranean Estates", "Sky Living"];
  const { text } = await inspectBody(page);
  const leaks = otherAgencyMarkers.filter((n) => text.includes(n));
  if (leaks.length === 0) {
    log("pass", `[B] Registros · agencia no ve agencias rivales en su listado`);
  } else {
    log("fail", `[B] Registros · aparecen marcadores de otras agencias: ${leaks.join(", ")}`);
  }
  await page.close();
}

async function testVentasLeak(ctx) {
  const page = await ctx.newPage();
  await login(page, AGENCY);
  await page.goto(`${BASE}/ventas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/agency-ventas.png`, fullPage: true });

  /* Igual que registros · sin marcadores de otras agencias. */
  const otherAgencyMarkers = ["Nordic Homes", "International Realty", "Mediterranean Estates"];
  const { text } = await inspectBody(page);
  const leaks = otherAgencyMarkers.filter((n) => text.includes(n));
  if (leaks.length === 0) {
    log("pass", `[B] Ventas · agencia no ve ventas de otras agencias`);
  } else {
    log("fail", `[B] Ventas · marcadores filtrados: ${leaks.join(", ")}`);
  }
  await page.close();
}

async function testPromocionDetalleSensitive(ctx) {
  const page = await ctx.newPage();
  await login(page, AGENCY);
  // Busca primera promoción donde la agencia colabora
  await page.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const firstPromoLink = await page.locator("a[href^='/promociones/']").first();
  if (await firstPromoLink.count() === 0) {
    log("warn", "[B] Promoción detalle · agencia no ve ninguna promoción · skip");
    await page.close();
    return;
  }
  await firstPromoLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/agency-promo-detail.png`, fullPage: true });

  const { text } = await inspectBody(page);
  /* Sensibles que NO deben aparecer en la vista agencia */
  const forbidden = [
    "Reglas de marketing",     // dialog editable solo promotor
    "Editar reglas de marketing",
    "Invitar agencias",        // CTA de promotor
    "Compartir con agencias",
  ];
  const leaks = forbidden.filter((s) => text.toLowerCase().includes(s.toLowerCase()));
  if (leaks.length === 0) {
    log("pass", `[B] Promoción detalle · agencia no ve controles del promotor`);
  } else {
    log("fail", `[B] Promoción detalle · agencia ve controles promotor-only: ${leaks.join(", ")}`);
  }
  await page.close();
}

async function testPromoterAccess(ctx) {
  const page = await ctx.newPage();
  await login(page, PROMOTER);
  for (const route of PROMOTER_ONLY_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const path = new URL(page.url()).pathname;
    if (path === route || path.startsWith(route)) {
      log("pass", `[C] Promotor · ${route} accesible`);
    } else {
      log("warn", `[C] Promotor · ${route} → ${path} (¿bug?)`);
    }
  }
  await page.close();
}

/* ─── Runner ───────────────────────────────────────────────────── */

async function main() {
  console.log(`\n🔍 dual-role-audit · BASE=${BASE}\n`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  try {
    await testPromoterOnlyRedirects(ctx);
    await testCalendarLeak(ctx);
    await testRegistrosLeak(ctx);
    await testVentasLeak(ctx);
    await testPromocionDetalleSensitive(ctx);
    await testPromoterAccess(ctx);
  } catch (e) {
    log("fail", `Excepción del runner: ${e.message}`);
  }

  await browser.close();

  /* Reporte */
  const total = passes.length + warnings.length + failures.length;
  const summary = {
    base: BASE,
    timestamp: new Date().toISOString(),
    counts: { total, passes: passes.length, warnings: warnings.length, failures: failures.length },
    passes, warnings, failures,
    verdict: failures.length === 0
      ? (warnings.length === 0 ? "READY" : "READY_WITH_WARNINGS")
      : "BLOCKED",
  };
  writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(summary, null, 2));

  console.log("\n────────────────────────────────────────");
  console.log(`📊 ${total} checks · ✅ ${passes.length} · ⚠️  ${warnings.length} · ❌ ${failures.length}`);
  console.log(`📄 Reporte completo en ${OUT_DIR}/report.json`);
  console.log(`📸 Screenshots en ${OUT_DIR}/*.png`);
  console.log("────────────────────────────────────────\n");

  if (failures.length > 0) {
    console.log("❌ FALLOS · NO listo para producción frontend:");
    failures.forEach((f) => console.log(`  · ${f}`));
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log("⚠️  Listo con warnings · revisar:");
    warnings.forEach((w) => console.log(`  · ${w}`));
    process.exit(0);
  } else {
    console.log("✅ Frontend dual-role HERMÉTICO · backend debe replicar las reglas de docs/backend-integration.md §1.5.2.");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
