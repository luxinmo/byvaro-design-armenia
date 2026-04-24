import { chromium } from 'playwright';

const OUT = '/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots';
const errors = [];
const consoleErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`);
});

// Login
await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
try {
  const demo = page.locator('text=arman@byvaro.com').first();
  if (await demo.count()) { await demo.click(); await page.waitForTimeout(300); }
} catch {}
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) {
  const val = await pwd.inputValue().catch(() => '');
  if (!val) await pwd.fill('demo1234');
}
const submit = page.locator('button[type="submit"]').first();
if (await submit.count()) await submit.click();
await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(500);

// Navigate to /actividad
await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Grab all text content for inspection
const bodyText = await page.evaluate(() => document.body.innerText);

// Golden rule checks
const checks = {
  // KPI row
  kpi_pipeline_abierto: /Pipeline abierto/i.test(bodyText),
  kpi_pipeline_sub_cierre_cobro: /cierre.*cobro/i.test(bodyText),
  kpi_pipeline_NOT_old: !/reservas\s*\+\s*contratos\s*vivos/i.test(bodyText),
  kpi_ventas_cerradas: /Ventas cerradas/i.test(bodyText) && !/Ventas € cerradas/i.test(bodyText),
  kpi_ventas_sub_contratos_terminadas: /contratos.*terminadas/i.test(bodyText),
  kpi_visitas_realizadas: /Visitas realizadas/i.test(bodyText),
  kpi_tiempo_respuesta: /Tiempo de respuesta/i.test(bodyText),
  kpi_conversion: /Conversión lead/i.test(bodyText),
  kpi_nuevos_leads: /Nuevos leads/i.test(bodyText),
  // Funnel 6 steps
  funnel_nuevos_leads: /Nuevos leads/i.test(bodyText),
  funnel_registros_aprobados: /Registros aprobados/i.test(bodyText),
  funnel_visitas_realizadas: /Visitas realizadas/i.test(bodyText),
  funnel_reservas: /Reservas/i.test(bodyText),
  funnel_cerradas_contrato: /Cerradas.*contrato|Cerradas \(contrato\)/i.test(bodyText),
  funnel_terminadas_escrit: /Terminadas.*escrit|Terminadas \(escrit/i.test(bodyText),
  // Ventas por mes
  ventas_cerradas_6meses: /Ventas cerradas.*6\s*meses/i.test(bodyText),
  ventas_sub_contratos_firmados: /contratos firmados/i.test(bodyText),
  // Velocidad 4 mini KPIs
  vel_lead_visita: /Lead.*Visita/i.test(bodyText),
  vel_visita_reserva: /Visita.*Reserva/i.test(bodyText),
  vel_reserva_cerrada: /Reserva.*Cerrada/i.test(bodyText),
  vel_cerrada_terminada: /Cerrada.*Terminada/i.test(bodyText),
  // Feed
  feed_venta_cerrada: /Venta cerrada/i.test(bodyText),
  feed_venta_terminada: /Venta terminada/i.test(bodyText),
  feed_NOT_contrato_firmado: !/Contrato firmado/i.test(bodyText),
};

// Take 1280 screenshot (full page)
await page.screenshot({ path: `${OUT}/actividad-verify-1280.png`, fullPage: true });
const ww1280 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));

// Mobile 375
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/actividad-verify-375.png`, fullPage: true });
const ww375 = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  inner: window.innerWidth,
  bodyScroll: document.body.scrollWidth,
  overflow: document.documentElement.scrollWidth > window.innerWidth
}));

const bodyText375 = await page.evaluate(() => document.body.innerText);
const checks375 = {
  kpi_pipeline_abierto: /Pipeline abierto/i.test(bodyText375),
  kpi_ventas_cerradas: /Ventas cerradas/i.test(bodyText375),
  funnel_cerradas_contrato: /Cerradas.*contrato/i.test(bodyText375),
  funnel_terminadas_escrit: /Terminadas.*escrit/i.test(bodyText375),
  vel_cerrada_terminada: /Cerrada.*Terminada/i.test(bodyText375),
};

await browser.close();

console.log(JSON.stringify({
  checks,
  checks375,
  ww1280,
  ww375,
  errors,
  consoleErrors,
}, null, 2));
