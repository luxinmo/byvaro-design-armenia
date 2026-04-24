import { chromium } from 'playwright';
import fs from 'fs';

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
// Click first demo account chip (arman@byvaro.com)
try {
  const demo = page.locator('text=arman@byvaro.com').first();
  if (await demo.count()) {
    await demo.click();
    await page.waitForTimeout(300);
  }
} catch {}
// Fill password if needed
const pwd = page.locator('input[type="password"]');
if (await pwd.count()) {
  const val = await pwd.inputValue().catch(() => '');
  if (!val) await pwd.fill('demo1234');
}
// Submit
const submit = page.locator('button[type="submit"]').first();
if (await submit.count()) {
  await submit.click();
}
await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(500);

// Navigate to /actividad
await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Check expected blocks
const checks = {
  '1_header': await page.locator('text=/cómo va la empresa/i').count() > 0,
  '1_range_7d': await page.locator('text=/7\\s*días/i').count() > 0 || await page.locator('text=7d').count() > 0,
  '1_range_30d': await page.locator('text=/30\\s*días/i').count() > 0 || await page.locator('text=30d').count() > 0,
  '1_range_90d': await page.locator('text=/90\\s*días/i').count() > 0 || await page.locator('text=90d').count() > 0,
  '1_range_12m': await page.locator('text=/12\\s*meses/i').count() > 0 || await page.locator('text=12m').count() > 0,
  '2_ai_insights': await page.locator('text=/Byvaro ha detectado/i').count() > 0,
  '3_kpi_pipeline': await page.locator('text=/Pipeline abierto/i').count() > 0,
  '3_kpi_ventas_€': await page.locator('text=/Ventas.*cerradas/i').count() > 0,
  '3_kpi_visitas': await page.locator('text=/Visitas realizadas/i').count() > 0,
  '3_kpi_tiempo_respuesta': await page.locator('text=/Tiempo de respuesta/i').count() > 0,
  '3_kpi_conversion': await page.locator('text=/Conversión lead/i').count() > 0,
  '3_kpi_nuevos_leads': await page.locator('text=/Nuevos leads/i').count() > 0,
  '4_funnel_nuevos_leads': await page.locator('text=/Nuevos leads/i').count() > 0,
  '4_funnel_registros_aprobados': await page.locator('text=/Registros aprobados/i').count() > 0,
  '4_funnel_visitas_realizadas': await page.locator('text=/Visitas realizadas/i').count() > 0,
  '4_funnel_reservas': await page.locator('text=/Reservas/i').count() > 0,
  '4_funnel_escrituras': await page.locator('text=/Escrituras/i').count() > 0,
  '5_actividad_dia': await page.locator('text=/Actividad por día/i').count() > 0,
  '5_ventas_6_meses': await page.locator('text=/Ventas.*6\\s*meses/i').count() > 0,
  '6_velocidad_cierre': await page.locator('text=/Velocidad de cierre/i').count() > 0,
  '6_lead_visita': await page.locator('text=/Lead.*Visita/i').count() > 0,
  '6_visita_reserva': await page.locator('text=/Visita.*Reserva/i').count() > 0,
  '6_reserva_escritura': await page.locator('text=/Reserva.*Escritura/i').count() > 0,
  '6_mix_nacionalidad': await page.locator('text=/Mix por nacionalidad/i').count() > 0,
  '7_heatmap': await page.locator('text=/Heatmap/i').count() > 0 || await page.locator('text=/día.*hora/i').count() > 0,
  '7_salud_equipo': await page.locator('text=/Salud del equipo/i').count() > 0,
  '8_top_miembros': await page.locator('text=/Top miembros/i').count() > 0,
  '8_top_promociones': await page.locator('text=/Top promociones/i').count() > 0,
  '8_top_agencias': await page.locator('text=/Top agencias/i').count() > 0,
  '9_ultimos_movimientos': await page.locator('text=/Últimos movimientos/i').count() > 0,
  '9_ver_mas': await page.locator('text=/Ver más/i').count() > 0,
};

// Take 1280 screenshot (full page)
await page.screenshot({ path: `${OUT}/actividad-1280.png`, fullPage: true });

// Get page height for 1280
const ww1280 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));

// Interact: Click "7 días"
let click7d_ok = true, click12m_ok = true, toggle_ok = true, verMas_ok = true;
const errsBefore = errors.length + consoleErrors.length;
try {
  const btn7 = page.locator('button:has-text("7"), [role="button"]:has-text("7")').first();
  if (await btn7.count()) { await btn7.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }
} catch (e) { click7d_ok = false; }

try {
  // Find 12 meses / 12m
  const btn12 = page.locator('button:has-text("12 m"), button:has-text("12m"), button:has-text("12 meses")').first();
  if (await btn12.count()) { await btn12.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }
} catch (e) { click12m_ok = false; }

// Top agencias toggle: find "Registros" / "Ventas €" toggle inside Top agencias card
try {
  const topAgenciasCard = page.locator('text=/Top agencias/i').first();
  if (await topAgenciasCard.count()) {
    // Get container
    const toggle = page.locator('button:has-text("Ventas"), button:has-text("Ventas €")').last();
    if (await toggle.count()) await toggle.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
} catch (e) { toggle_ok = false; }

// Click Ver más
try {
  const verMas = page.locator('button:has-text("Ver más"), text=Ver más').first();
  if (await verMas.count()) { await verMas.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }
} catch (e) { verMas_ok = false; }

const errsAfter = errors.length + consoleErrors.length;
const interactionErrors = errsAfter - errsBefore;

// Mobile 375
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('http://localhost:8080/actividad', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/actividad-375.png`, fullPage: true });
const ww375 = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, bodyScroll: document.body.scrollWidth }));

await browser.close();

console.log(JSON.stringify({
  checks,
  ww1280,
  ww375,
  errors,
  consoleErrors,
  interactionErrors,
  interactions: { click7d_ok, click12m_ok, toggle_ok, verMas_ok }
}, null, 2));
