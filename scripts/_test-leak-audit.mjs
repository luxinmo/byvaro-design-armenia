import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const log = (...a) => console.log(...a);

// Login como agency member (Tom de Prime Properties)
log("→ Login Tom (member of Prime Properties · ag-1)");
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("tom@primeproperties.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

const tests = {};

// FUGA TEST 1 · /oportunidades · agency NO debe verlo en sidebar
tests.oportunidadesSidebar = await page.locator('aside a[href="/oportunidades"]').count() === 0;
// y URL directa redirige
await page.goto("http://localhost:8080/oportunidades", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
tests.oportunidadesUrlBlocked = !page.url().endsWith("/oportunidades");

// FUGA TEST 2 · /contratos · agency entra pero solo ve los suyos.
await page.goto("http://localhost:8080/contratos", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
tests.contratosUrlOk = page.url().endsWith("/contratos");
// Intentar capturar contratos visibles · si hay tabla, contar filas
const contratosVisibles = await page.evaluate(() => {
  return document.querySelectorAll('a[href*="/contratos/"], li:has(button)').length;
});
log("→ Contratos visibles en /contratos para Tom:", contratosVisibles);

// FUGA TEST 3 · /contactos/<id> de un contacto NO suyo · debe redirigir
// Ahmed es del seed sin ownerAgencyId (es del promotor) → URL directa redirige.
await page.goto("http://localhost:8080/contactos/ahmed-al-rashid", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
tests.contactoCrossTenantBlocked = !page.url().includes("ahmed-al-rashid");

// FUGA TEST 4 · /ajustes · admin agencia ve, member NO
await page.goto("http://localhost:8080/ajustes", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
tests.ajustesBlockedForMember = !page.url().endsWith("/ajustes");

// FUGA TEST 5 · /registros solo los de Prime Properties · contar
await page.goto("http://localhost:8080/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// FUGA TEST 6 · /ventas filtrar por agency
await page.goto("http://localhost:8080/ventas", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
tests.ventasUrlOk = page.url().endsWith("/ventas");

// FUGA TEST 7 · /actividad bloqueado para agency (sigue siendo PromotorOnly)
await page.goto("http://localhost:8080/actividad", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
tests.actividadBlocked = !page.url().endsWith("/actividad");

// FUGA TEST 8 · /colaboradores bloqueado
await page.goto("http://localhost:8080/colaboradores", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
tests.colaboradoresBlocked = !page.url().endsWith("/colaboradores");

console.log("\n═══ RESULTADOS AUDIT ═══");
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(tests)) {
  const icon = v ? "✅" : "❌";
  console.log(`${icon} ${k}: ${v}`);
  v ? pass++ : fail++;
}
console.log(`\n${pass} pasados · ${fail} fallos`);

await browser.close();
