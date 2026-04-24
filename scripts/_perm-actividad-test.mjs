/**
 * E2E permission gating test for /actividad.
 * - Admin (Arman): sees sidebar entry, "Últimos movimientos" + "Ver todo", can reach /actividad.
 * - Member (Laura Gómez / laura@byvaro.com): no sidebar entry, "Mis últimos movimientos", no "Ver todo",
 *   /actividad direct nav shows "Sin acceso" with activity.dashboard.view key.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-perm-test";

const results = [];
const record = (id, pass, detail = "") => {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}${detail ? " · " + detail : ""}`);
};

async function loginManual(p, email, pwd) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  await p.fill("input#login-email", email);
  await p.fill("input#login-password", pwd);
  await p.locator("button", { hasText: "Iniciar sesión" }).click();
  await p.waitForURL(/\/inicio/, { timeout: 7000 });
  await p.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const consoleMsgs = [];
  const pageErrors = [];

  /* ══════════════ TEST 1 · ADMIN (Arman) ══════════════ */
  const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pA = await ctxAdmin.newPage();
  pA.on("pageerror", (e) => pageErrors.push(`[admin] ${e.message}`));
  pA.on("console", (m) => {
    if (m.type() === "error") consoleMsgs.push(`[admin] ${m.text()}`);
  });

  console.log("\n=== TEST 1 · ADMIN ===");
  await loginManual(pA, "arman@byvaro.com", "demo1234");

  // 1.3 Navigate to /inicio (already there)
  await pA.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await pA.waitForTimeout(600);

  // 1.4a Sidebar shows "Actividad"
  const sidebarA = await pA.locator("aside").first().innerText().catch(() => "");
  record("1.4a Sidebar shows 'Actividad'", sidebarA.includes("Actividad"), `sidebar len=${sidebarA.length}`);

  // 1.4b Widget title "Últimos movimientos" (NO "Mis")
  const bodyA = await pA.locator("body").innerText();
  const hasUltimos = /Últimos movimientos/.test(bodyA);
  const hasMis = /Mis últimos movimientos/.test(bodyA);
  record("1.4b Widget title 'Últimos movimientos' (no 'Mis')", hasUltimos && !hasMis, `ultimos=${hasUltimos} mis=${hasMis}`);

  // 1.4c "Ver todo" link visible
  const verTodoA = await pA.locator("a, button", { hasText: /Ver todo/ }).count();
  record("1.4c 'Ver todo' link shown", verTodoA > 0, `count=${verTodoA}`);

  await pA.screenshot({ path: `${OUT}/admin-inicio.png`, fullPage: true });

  // 1.5 Click Actividad in sidebar → loads full dashboard
  const actividadLink = pA.locator("aside a, aside button", { hasText: /^\s*Actividad\s*$/ }).first();
  const hasLink = (await actividadLink.count()) > 0;
  if (hasLink) {
    await actividadLink.click();
    await pA.waitForURL(/\/actividad/, { timeout: 5000 }).catch(() => {});
    await pA.waitForTimeout(800);
    const url = pA.url();
    const pageText = await pA.locator("body").innerText();
    const notBlocked = !pageText.includes("Sin acceso");
    record("1.5 Click sidebar 'Actividad' → /actividad loads full", url.includes("/actividad") && notBlocked, `url=${url}`);
    await pA.screenshot({ path: `${OUT}/admin-actividad.png`, fullPage: true });
  } else {
    record("1.5 Click sidebar 'Actividad'", false, "sidebar link not found");
  }

  await ctxAdmin.close();

  /* ══════════════ TEST 2 · MEMBER (Laura Gómez) ══════════════ */
  const ctxMember = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pM = await ctxMember.newPage();
  pM.on("pageerror", (e) => pageErrors.push(`[member] ${e.message}`));
  pM.on("console", (m) => {
    if (m.type() === "error") consoleMsgs.push(`[member] ${m.text()}`);
  });

  console.log("\n=== TEST 2 · MEMBER ===");
  await loginManual(pM, "laura@byvaro.com", "demo1234");

  // 2.4 on /inicio
  await pM.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
  await pM.waitForTimeout(700);

  // 2.5a Sidebar does NOT show "Actividad"
  const sidebarM = await pM.locator("aside").first().innerText().catch(() => "");
  record("2.5a Sidebar DOES NOT show 'Actividad'", !sidebarM.includes("Actividad"), `contains=${sidebarM.includes("Actividad")}`);

  // 2.5b Widget title "Mis últimos movimientos"
  const bodyM = await pM.locator("body").innerText();
  const misM = /Mis últimos movimientos/.test(bodyM);
  record("2.5b Widget title 'Mis últimos movimientos'", misM, `present=${misM}`);

  // 2.5c NO "Ver todo"
  // Scope to widget: we'll check whole page since admin only shows it from the widget area
  // count occurrences
  const verTodoM = await pM.locator("a, button", { hasText: /Ver todo/ }).count();
  record("2.5c 'Ver todo' link NOT shown", verTodoM === 0, `count=${verTodoM}`);

  // 2.5d Sidebar footer shows Laura Gómez + member label
  const hasLaura = sidebarM.includes("Laura Gómez");
  const hasMemberLabel = /member|Agente/i.test(sidebarM);
  record("2.5d Sidebar footer shows 'Laura Gómez' + member label", hasLaura && hasMemberLabel, `laura=${hasLaura} memberLbl=${hasMemberLabel}`);

  await pM.screenshot({ path: `${OUT}/member-inicio.png`, fullPage: true });

  // 2.6 Direct nav to /actividad
  await pM.goto(`${BASE}/actividad`, { waitUntil: "networkidle" });
  await pM.waitForTimeout(700);

  const pageTextM = await pM.locator("body").innerText();
  const hasSinAcceso = pageTextM.includes("Sin acceso");
  const hasKey = pageTextM.includes("activity.dashboard.view");
  // Shield icon: Lucide Shield SVG - check for svg with class containing lucide-shield
  const shieldCount = await pM.locator("svg.lucide-shield, svg[class*='shield']").count();
  record("2.7a 'Sin acceso' heading rendered", hasSinAcceso, `present=${hasSinAcceso}`);
  record("2.7b Mentions 'activity.dashboard.view'", hasKey, `present=${hasKey}`);
  record("2.7c Shield icon rendered", shieldCount > 0, `count=${shieldCount}`);

  await pM.screenshot({ path: `${OUT}/member-actividad-sin-acceso.png`, fullPage: true });

  await ctxMember.close();
  await browser.close();

  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.pass).length;
  console.log(`${passed}/${results.length} passed`);
  if (pageErrors.length) {
    console.log("\n=== PAGE ERRORS ===");
    pageErrors.forEach((e) => console.log(e));
  }
  if (consoleMsgs.length) {
    console.log("\n=== CONSOLE ERRORS ===");
    consoleMsgs.forEach((m) => console.log(m));
  }
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
