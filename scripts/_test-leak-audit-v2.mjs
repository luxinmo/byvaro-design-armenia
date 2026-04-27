import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("→ Login Tom (member of Prime Properties · ag-1)");
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("tom@primeproperties.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

const tests = {};
const checkBlocked = async (path) => {
  await page.goto(`http://localhost:8080${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return !page.url().endsWith(path);
};
const checkOpens = async (path) => {
  await page.goto(`http://localhost:8080${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return page.url().endsWith(path);
};
const sidebarHas = async (href) => {
  await page.goto("http://localhost:8080/inicio", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return await page.locator(`aside a[href="${href}"]`).count() > 0;
};

console.log("\n→ Tests para AGENCY MEMBER (Tom · Prime Properties)");

// Lo que SÍ debe ver:
tests.oportunidades_sidebar  = await sidebarHas("/oportunidades");
tests.oportunidades_url      = await checkOpens("/oportunidades");
tests.emails_url             = await checkOpens("/emails");
tests.contactos_url          = await checkOpens("/contactos");
tests.calendario_url         = await checkOpens("/calendario");
tests.ventas_url             = await checkOpens("/ventas");
tests.registros_url          = await checkOpens("/registros");
tests.promociones_url        = await checkOpens("/promociones");

// Lo que NO debe ver:
tests.no_ajustes_sidebar     = !(await sidebarHas("/ajustes"));
tests.no_ajustes_url         = await checkBlocked("/ajustes");
tests.no_empresa_sidebar     = !(await sidebarHas("/empresa"));
tests.no_empresa_url         = await checkBlocked("/empresa");
tests.no_equipo_sidebar      = !(await sidebarHas("/equipo"));
tests.no_equipo_url          = await checkBlocked("/equipo");
tests.no_contratos_sidebar   = !(await sidebarHas("/contratos"));
tests.no_contratos_url       = await checkBlocked("/contratos");
tests.no_colaboradores_url   = await checkBlocked("/colaboradores");
tests.no_microsites_url      = await checkBlocked("/microsites");
tests.no_actividad_url       = await checkBlocked("/actividad");

console.log("\n═══ MEMBER AGENCY ═══");
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(tests)) {
  const icon = v ? "✅" : "❌";
  console.log(`${icon} ${k}: ${v}`);
  v ? pass++ : fail++;
}
console.log(`\n${pass} pasados · ${fail} fallos`);

await browser.close();
