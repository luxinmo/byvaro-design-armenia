/**
 * Revisa los cambios pedidos en esta sesión:
 * 1. Leaks de promotor en agencia cerrados
 * 2. Badge de estado publicación (Publicada / Sin publicar / Solo uso interno)
 * 3. Agencia no ve promociones incompletas
 * 4. Kebab disponibilidad sin Editar/Iniciar compra para agencia
 * 5. CTA "Añadir anejo" solo en bloque Unidades y disponibilidad (promotor)
 * 6. Segmentos Parkings/Trasteros ocultos si vacíos
 * 7. Anejos retirados no visibles a agencia
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-final-audit";
await mkdir(OUT, { recursive: true });

const checks = [];

async function login(p, name) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: name }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // =========== PROMOTOR ===========
  const ctxP = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pp = await ctxP.newPage();
  await login(pp, "Arman Rahmanov");

  // 1. Home promotor (no AgencyHome)
  await pp.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(500);
  await pp.screenshot({ path: `${OUT}/p-01-home.png`, fullPage: false });
  const h1P = await pp.locator("h1").first().textContent();
  checks.push({ test: "Promotor /inicio muestra dashboard promotor", ok: h1P?.includes("Arman") && h1P?.includes("semana"), detail: h1P });

  // 2. Badge Publicada en promoción normal
  await pp.goto(`${BASE}/promociones/2`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(700);
  await pp.screenshot({ path: `${OUT}/p-02-publicada.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 220 } });
  const badgePublic = await pp.locator("h1").locator("..").locator("span", { hasText: /Publicada/ }).count();
  checks.push({ test: "Promoción /2 muestra badge 'Publicada'", ok: badgePublic > 0 });

  // 3. Badge Solo uso interno
  await pp.goto(`${BASE}/promociones/dev-5`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(700);
  await pp.screenshot({ path: `${OUT}/p-03-solo-interno.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  const internalBadge = await pp.locator("span", { hasText: /Solo uso interno/ }).count();
  const activarCompartir = await pp.locator("button", { hasText: /Activar compartir/ }).count();
  checks.push({ test: "Promoción dev-5 muestra 'Solo uso interno'", ok: internalBadge > 0, detail: `badges: ${internalBadge}` });
  checks.push({ test: "Promoción dev-5 tiene CTA 'Activar compartir'", ok: activarCompartir > 0 });

  // 4. Badge "Sin publicar · faltan N" + banner rojo dentro
  await pp.goto(`${BASE}/promociones/dev-3`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(700);
  await pp.screenshot({ path: `${OUT}/p-04-incompleta.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  const incBadge = await pp.locator("span", { hasText: /Sin publicar/ }).count();
  const noPuedes = await pp.locator("p", { hasText: /No puedes publicar todavía/ }).count();
  checks.push({ test: "Promoción dev-3 muestra 'Sin publicar · faltan N'", ok: incBadge > 0 });
  checks.push({ test: "Promoción dev-3 muestra banner 'No puedes publicar todavía'", ok: noPuedes > 0 });

  // 5. Promotor - "Añadir anejo" en Vista general
  await pp.goto(`${BASE}/promociones/1`, { waitUntil: "networkidle" });
  await pp.waitForTimeout(700);
  const anejosCTA = await pp.locator("button", { hasText: /Añadir anejo/ }).count();
  checks.push({ test: "Promotor ve '+Añadir anejo' en Vista general", ok: anejosCTA > 0 });
  await pp.screenshot({ path: `${OUT}/p-05-anejo-cta.png`, fullPage: true });

  // 6. Disponibilidad sin SegmentSwitcher si no hay anejos (promo 1)
  await pp.locator("button, a").filter({ hasText: /^Disponibilidad$/ }).first().click();
  await pp.waitForTimeout(600);
  const segParkings = await pp.locator("button", { hasText: /^Parkings/ }).count();
  const segTrasteros = await pp.locator("button", { hasText: /^Trasteros/ }).count();
  checks.push({ test: "Promo 1 sin anejos: NO muestra segmento Parkings", ok: segParkings === 0, detail: `count=${segParkings}` });
  checks.push({ test: "Promo 1 sin anejos: NO muestra segmento Trasteros", ok: segTrasteros === 0, detail: `count=${segTrasteros}` });
  await pp.screenshot({ path: `${OUT}/p-06-no-segments.png`, fullPage: false });

  // 7. Kebab de unidades · promotor ve "Editar" + "Iniciar compra"
  const firstRow = pp.locator("table tbody tr").first();
  if (await firstRow.count()) {
    const k = firstRow.locator("button").last();
    await k.click({ force: true }).catch(() => {});
    await pp.waitForTimeout(300);
    const verP = await pp.locator("[role='menuitem']", { hasText: /Ver$/ }).count();
    const editarP = await pp.locator("[role='menuitem']", { hasText: /Editar/ }).count();
    const compraP = await pp.locator("[role='menuitem']", { hasText: /Iniciar compra/ }).count();
    checks.push({ test: "Promotor kebab muestra Ver/Editar/Iniciar compra", ok: verP > 0 && editarP > 0 && compraP > 0, detail: `ver=${verP} edit=${editarP} compra=${compraP}` });
    await pp.screenshot({ path: `${OUT}/p-07-kebab-promotor.png`, fullPage: false });
    await pp.keyboard.press("Escape");
  }

  await ctxP.close();

  // =========== AGENCIA ===========
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pa = await ctxA.newPage();
  await login(pa, "Laura Sánchez");

  // 8. Home agencia
  await pa.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await pa.waitForTimeout(500);
  await pa.screenshot({ path: `${OUT}/a-01-home.png`, fullPage: false });
  const h1A = await pa.locator("h1").first().textContent();
  checks.push({ test: "Agencia /inicio muestra AgencyHome (Hola, Laura)", ok: h1A?.includes("Laura") && h1A?.includes("colaboración"), detail: h1A });

  // 9. Agencia no accede a rutas promotor-only
  const rutasProhibidas = ["/leads", "/microsites", "/colaboradores", "/emails"];
  for (const r of rutasProhibidas) {
    await pa.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await pa.waitForTimeout(400);
    const url = pa.url();
    checks.push({ test: `Agencia ${r} redirige a /inicio`, ok: url.endsWith("/inicio"), detail: url });
  }

  // 10. Agencia ve solo promociones publicables
  await pa.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await pa.waitForTimeout(500);
  await pa.screenshot({ path: `${OUT}/a-02-promos.png`, fullPage: true });
  const cardsAgencia = await pa.locator("main article").count();
  checks.push({ test: "Agencia ve menos de 5 promociones (filtro activo)", ok: cardsAgencia > 0 && cardsAgencia < 5, detail: `count=${cardsAgencia}` });

  // 11. No ve "Nueva promoción"
  const nuevaPromo = await pa.locator("button", { hasText: /Nueva promoción/ }).count();
  checks.push({ test: "Agencia NO ve botón 'Nueva promoción'", ok: nuevaPromo === 0 });

  // 12. Abre promoción, no ve badge de estado
  await pa.locator("main article").first().click();
  await pa.waitForLoadState("networkidle");
  await pa.waitForTimeout(700);
  await pa.screenshot({ path: `${OUT}/a-03-promocion.png`, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 300 } });
  const badgeAgencia = await pa.locator("h1").locator("..").locator("span", { hasText: /Publicada|Solo uso/ }).count();
  checks.push({ test: "Agencia NO ve badge de estado (solo promotor)", ok: badgeAgencia === 0 });

  // 13. Agencia: kebab sin Editar/Iniciar compra en disponibilidad
  await pa.locator("button, a").filter({ hasText: /^Disponibilidad$/ }).first().click();
  await pa.waitForTimeout(700);
  const firstRowA = pa.locator("table tbody tr").first();
  if (await firstRowA.count()) {
    const k = firstRowA.locator("button").last();
    await k.click({ force: true }).catch(() => {});
    await pa.waitForTimeout(300);
    const verA = await pa.locator("[role='menuitem']", { hasText: /Ver$/ }).count();
    const editarA = await pa.locator("[role='menuitem']", { hasText: /Editar/ }).count();
    const compraA = await pa.locator("[role='menuitem']", { hasText: /Iniciar compra/ }).count();
    checks.push({ test: "Agencia kebab solo muestra Ver + Enviar (sin Editar/Compra)", ok: verA > 0 && editarA === 0 && compraA === 0, detail: `ver=${verA} edit=${editarA} compra=${compraA}` });
    await pa.screenshot({ path: `${OUT}/a-04-kebab-agencia.png`, fullPage: false });
    await pa.keyboard.press("Escape");
  }

  // 14. Agencia: no ve "Añadir anejo"
  await pa.locator("button, a").filter({ hasText: /^Vista general$/ }).first().click();
  await pa.waitForTimeout(500);
  const anejosAgencia = await pa.locator("button", { hasText: /Añadir anejo/ }).count();
  checks.push({ test: "Agencia NO ve '+Añadir anejo'", ok: anejosAgencia === 0 });

  await ctxA.close();
  await browser.close();

  // Reporte
  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.filter((c) => !c.ok);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`RESULTADO: ${pass}/${checks.length} OK`);
  console.log("=".repeat(72));
  for (const c of checks) {
    const sym = c.ok ? "✅" : "❌";
    console.log(`${sym} ${c.test}${c.detail ? ` · ${c.detail}` : ""}`);
  }
  console.log("\n📸 " + OUT);
  await writeFile(`${OUT}/_report.json`, JSON.stringify(checks, null, 2));
  if (fail.length) process.exitCode = 1;
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
