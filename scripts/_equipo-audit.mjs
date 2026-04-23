import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_equipo_audit";

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

async function measureOverflow(page) {
  return await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, scrollHeight: d.scrollHeight, clientHeight: d.clientHeight, hasHOverflow: d.scrollWidth > d.clientWidth + 1 };
  });
}

async function captureRoute(page, route, viewMode, vp, label) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.setViewportSize({ width: vp.width, height: vp.height });
  try {
    await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 20000 });
  } catch (e) { return { label, route, vp: vp.name, error: "nav: " + e.message }; }
  await page.waitForTimeout(700);
  if (viewMode === "list") {
    try {
      const btn = page.locator("button:has-text(\"Lista\")").first();
      if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(400); }
    } catch (e) {}
  }
  const metrics = await measureOverflow(page);
  const shotPath = join(OUT_DIR, label + "-" + vp.width + ".png");
  await page.screenshot({ path: shotPath, fullPage: true });
  return { label, route, vp: vp.name, width: vp.width, ...metrics, errors, screenshot: shotPath };
}

async function captureMemberForm(page, vp) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(BASE_URL + "/equipo", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(700);
  let opened = false;
  for (const name of ["Arman", "Laura"]) {
    try {
      const loc = page.locator("text=" + name).first();
      if (await loc.count() > 0) { await loc.click({ timeout: 4000 }); opened = true; break; }
    } catch (e) {}
  }
  await page.waitForTimeout(700);
  const metrics = await measureOverflow(page);
  const shotPath = join(OUT_DIR, "MemberFormDialog-" + vp.width + ".png");
  await page.screenshot({ path: shotPath, fullPage: true });
  const dlgInfo = await page.evaluate(() => {
    const dlg = document.querySelector("[role=\"dialog\"]");
    if (!dlg) return { present: false };
    const r = dlg.getBoundingClientRect();
    let innerOverflow = false, innerMax = 0, innerTag = "";
    dlg.querySelectorAll("*").forEach(el => {
      if (el.scrollWidth > el.clientWidth + 1) {
        innerOverflow = true;
        const diff = el.scrollWidth - el.clientWidth;
        if (diff > innerMax) { innerMax = diff; innerTag = el.tagName + "." + (el.className || "").toString().slice(0, 40); }
      }
    });
    return { present: true, dialogWidth: Math.round(r.width), dialogHeight: Math.round(r.height), dialogLeft: Math.round(r.left), dialogRight: Math.round(r.right), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, overflowsViewport: r.right > window.innerWidth + 1 || r.left < -1, dialogTaller: dlg.scrollHeight > window.innerHeight + 1, innerOverflow, innerMaxOverflowPx: innerMax, innerTag };
  });
  return { label: "MemberFormDialog", vp: vp.name, width: vp.width, opened, ...metrics, dialog: dlgInfo, errors, screenshot: shotPath };
}

async function captureInvite(page, vp, tab, label) {
  const errors = [];
  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(BASE_URL + "/equipo", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(700);
  try {
    const btn = page.locator("button:has-text(\"Añadir miembro\")").first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(700);
  } catch (e) { return { label, vp: vp.name, error: "open: " + e.message }; }
  if (tab === "crear") {
    try {
      const t = page.locator("[role=\"tab\"]").filter({ hasText: /Crear/i }).first();
      if (await t.count() > 0) { await t.click(); await page.waitForTimeout(400); }
    } catch (e) {}
  }
  const metrics = await measureOverflow(page);
  const shotPath = join(OUT_DIR, label + "-" + vp.width + ".png");
  await page.screenshot({ path: shotPath, fullPage: true });
  const dlgInfo = await page.evaluate(() => {
    const dlg = document.querySelector("[role=\"dialog\"]");
    if (!dlg) return { present: false };
    const r = dlg.getBoundingClientRect();
    let innerOverflow = false, innerMax = 0, innerTag = "";
    dlg.querySelectorAll("*").forEach(el => {
      if (el.scrollWidth > el.clientWidth + 1) {
        innerOverflow = true;
        const diff = el.scrollWidth - el.clientWidth;
        if (diff > innerMax) { innerMax = diff; innerTag = el.tagName + "." + (el.className || "").toString().slice(0, 40); }
      }
    });
    return { present: true, dialogWidth: Math.round(r.width), dialogHeight: Math.round(r.height), dialogLeft: Math.round(r.left), dialogRight: Math.round(r.right), viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, overflowsViewport: r.right > window.innerWidth + 1 || r.left < -1, dialogTaller: dlg.scrollHeight > window.innerHeight + 1, innerOverflow, innerMaxOverflowPx: innerMax, innerTag };
  });
  return { label, vp: vp.name, width: vp.width, ...metrics, dialog: dlgInfo, errors, screenshot: shotPath };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];
  for (const vp of VIEWPORTS) {
    console.log("\n=== " + vp.width + "px ===");
    const a = await captureRoute(page, "/equipo", "gallery", vp, "equipo-gallery");
    console.log("  gallery    " + (a.hasHOverflow ? "OVERFLOW" : "ok") + "  " + (a.scrollWidth||"-") + ">" + (a.clientWidth||"-"));
    results.push(a);
    const b = await captureRoute(page, "/equipo", "list", vp, "equipo-list");
    console.log("  list       " + (b.hasHOverflow ? "OVERFLOW" : "ok") + "  " + (b.scrollWidth||"-") + ">" + (b.clientWidth||"-"));
    results.push(b);
    const c = await captureRoute(page, "/equipo/u1/estadisticas", "default", vp, "equipo-stats");
    console.log("  stats      " + (c.hasHOverflow ? "OVERFLOW" : "ok") + "  " + (c.scrollWidth||"-") + ">" + (c.clientWidth||"-"));
    results.push(c);
    const d = await captureMemberForm(page, vp);
    console.log("  MemberForm " + (d.error ? d.error : (d.hasHOverflow ? "pgOV" : "pg_ok") + " · dlg " + (d.dialog && d.dialog.overflowsViewport ? "OV" : "ok") + " · inner " + (d.dialog && d.dialog.innerOverflow ? ("OV " + d.dialog.innerMaxOverflowPx + "px " + d.dialog.innerTag) : "ok")));
    results.push(d);
    const e = await captureInvite(page, vp, "invitar", "InviteDialog-invitar");
    console.log("  Inv/Invit  " + (e.error ? e.error : (e.hasHOverflow ? "pgOV" : "pg_ok") + " · dlg " + (e.dialog && e.dialog.overflowsViewport ? "OV" : "ok") + " · inner " + (e.dialog && e.dialog.innerOverflow ? ("OV " + e.dialog.innerMaxOverflowPx + "px " + e.dialog.innerTag) : "ok")));
    results.push(e);
    const f = await captureInvite(page, vp, "crear", "InviteDialog-crear");
    console.log("  Inv/Crear  " + (f.error ? f.error : (f.hasHOverflow ? "pgOV" : "pg_ok") + " · dlg " + (f.dialog && f.dialog.overflowsViewport ? "OV" : "ok") + " · inner " + (f.dialog && f.dialog.innerOverflow ? ("OV " + f.dialog.innerMaxOverflowPx + "px " + f.dialog.innerTag) : "ok")));
    results.push(f);
  }
  await browser.close();
  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), total: results.length, overflowCount: results.filter(r => r.hasHOverflow).length, errorCount: results.filter(r => r.error).length, results }, null, 2));
  console.log("\n→ " + results.length + " captures");
}

main().catch(e => { console.error(e); process.exit(1); });
