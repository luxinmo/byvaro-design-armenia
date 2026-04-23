/**
 * audit-dual-role.mjs · captura las mismas pantallas en Promotor y
 * Agencia para encontrar incoherencias técnicas y comerciales.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-audit";
await mkdir(OUT, { recursive: true });

const PROMOTOR = "Arman Rahmanov";
const AGENCIA  = "Laura Sánchez";

async function login(p, userName) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: userName }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 8000 });
  await p.waitForLoadState("networkidle");
}

async function shot(p, role, label) {
  const file = `${OUT}/${role}__${label}.png`;
  await p.screenshot({ path: file, fullPage: true });
  return file;
}

const ROUTES = [
  { key: "inicio",       path: "/inicio" },
  { key: "promociones",  path: "/promociones" },
  { key: "registros",    path: "/registros" },
  { key: "ventas",       path: "/ventas" },
  { key: "calendario",   path: "/calendario" },
  { key: "colaboradores",path: "/colaboradores" },
  { key: "contactos",    path: "/contactos" },
  { key: "microsites",   path: "/microsites" },
  { key: "emails",       path: "/emails" },
  { key: "leads",        path: "/leads" },
  { key: "ajustes",      path: "/ajustes" },
  { key: "empresa",      path: "/empresa" },
];

async function captureRoutes(p, role) {
  const report = {};
  for (const { key, path } of ROUTES) {
    const errs = [];
    const onErr = (e) => errs.push(`[pageerror] ${e.message}`);
    const onCon = (m) => { if (m.type() === "error") errs.push(`[console] ${m.text().slice(0,140)}`); };
    p.on("pageerror", onErr);
    p.on("console", onCon);
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(700);
    const finalUrl = p.url();
    const title = (await p.title()).trim();
    const h1 = await p.locator("h1").first().textContent().catch(() => null);
    const sidebar = await p.locator("nav a, nav button").allTextContents().catch(() => []);
    const file = await shot(p, role, key);
    p.off("pageerror", onErr);
    p.off("console", onCon);
    report[key] = { path, finalUrl, title, h1: h1?.trim() ?? null, errs, file,
      redirected: !finalUrl.includes(path) };
  }
  return report;
}

async function capturePromotionDetail(p, role) {
  const report = {};
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const firstCard = p.locator("main article.cursor-pointer").first();
  if (!(await firstCard.count())) return report;
  await firstCard.click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(700);
  const urlAfter = p.url();
  report._meta = { urlAfter };
  await shot(p, role, "promocion__default");

  const tabs = ["Vista general", "Disponibilidad", "Agencias", "Comisiones", "Registros", "Documentos"];
  for (const t of tabs) {
    const tab = p.locator("button, a").filter({ hasText: new RegExp(`^${t}$`) }).first();
    if (await tab.count()) {
      await tab.click().catch(() => {});
      await p.waitForTimeout(600);
      await shot(p, role, `promocion__${t.toLowerCase().replace(/\s/g, "-")}`);
      report[t] = true;
    } else {
      report[t] = false;
    }
  }

  // Disponibilidad sub-segmentos
  const dispTab = p.locator("button, a").filter({ hasText: /^Disponibilidad$/ }).first();
  if (await dispTab.count()) {
    await dispTab.click();
    await p.waitForTimeout(500);
    for (const seg of ["Parkings", "Trasteros"]) {
      const segBtn = p.locator("button", { hasText: new RegExp(`^${seg}`) }).first();
      if (await segBtn.count()) {
        await segBtn.click().catch(() => {});
        await p.waitForTimeout(500);
        await shot(p, role, `promocion__disp-${seg.toLowerCase()}`);
      }
    }
  }
  return report;
}

async function captureRegistroAction(p, role) {
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(600);
  const btn = p.locator("button", { hasText: "Registrar cliente" }).first();
  if (await btn.count()) {
    await btn.click();
    await p.waitForTimeout(500);
    await shot(p, role, "dialog__registrar-cliente");
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};
  for (const [role, userName] of [["promotor", PROMOTOR], ["agencia", AGENCIA]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, userName);
    results[role] = { routes: await captureRoutes(page, role) };
    results[role].promotionDetail = await capturePromotionDetail(page, role);
    await captureRegistroAction(page, role);
    await ctx.close();
  }
  await browser.close();
  await writeFile(`${OUT}/_report.json`, JSON.stringify(results, null, 2));
  console.log(`📄 Report: ${OUT}/_report.json`);
  console.log(`📸 Screenshots: ${OUT}`);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
