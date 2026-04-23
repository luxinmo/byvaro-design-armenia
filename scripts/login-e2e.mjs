/**
 * E2E · Login con credenciales mock.
 *
 *  1. /login muestra 5 cuentas demo.
 *  2. Quick-login como Laura (Prime Properties) → /inicio en modo agencia.
 *  3. Sidebar y contenido correctos.
 *  4. Logout desde el AccountSwitcher → vuelve a /login.
 *  5. Login manual con credenciales del promotor → /inicio modo promotor.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-login-test";

const log = (msg, ok) => console.log(`${ok === false ? "❌" : ok === "warn" ? "🟡" : "✅"} ${msg}`);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));

  // 1 — /login
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const loginText = await p.locator("body").innerText();
  const hasDemoSection = loginText.includes("Cuentas de demo") && loginText.includes("demo1234");
  const hasAllAccounts =
    loginText.includes("Arman Rahmanov") &&
    loginText.includes("Laura Sánchez") &&
    loginText.includes("Erik Lindqvist") &&
    loginText.includes("Pieter De Vries") &&
    loginText.includes("James Whitfield");
  log(`1. /login muestra sección demo + 5 cuentas`, hasDemoSection && hasAllAccounts);
  await p.screenshot({ path: `${OUT}/1-login.png`, fullPage: true });

  // 2 — quick login Laura Sánchez (agencia Prime Properties)
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
  await p.waitForTimeout(500);
  const headerText = await p.locator("header").first().innerText();
  log(`2. Quick-login → /inicio con pill "Agencia · Prime" (visto: "${headerText.slice(0, 120)}")`,
    headerText.includes("Agencia") && headerText.includes("Prime"));
  await p.screenshot({ path: `${OUT}/2-logged-agency.png` });

  // 3 — sidebar correcto
  const sidebar = await p.locator("aside").first().innerText();
  const sidebarOk =
    !sidebar.includes("Colaboradores") &&
    !sidebar.includes("Microsites") &&
    !sidebar.includes("Empresa") &&
    sidebar.includes("Laura Sánchez");
  log(`3. Sidebar correcto en modo agencia`, sidebarOk);

  // 4 — logout
  await p.locator("header button[aria-haspopup='menu']").first().click();
  await p.waitForTimeout(200);
  await p.locator("[role='menu'] button", { hasText: "Cerrar sesión" }).click();
  await p.waitForURL(/\/login/, { timeout: 5000 });
  await p.waitForTimeout(400);
  log(`4. Logout → redirige a /login`, p.url().includes("/login"));
  await p.screenshot({ path: `${OUT}/3-logged-out.png` });

  // 5 — login manual promotor con email+pwd
  await p.fill("input#login-email", "arman@byvaro.com");
  await p.fill("input#login-password", "demo1234");
  await p.locator("button", { hasText: "Iniciar sesión" }).click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
  await p.waitForTimeout(400);
  const headerDev = await p.locator("header").first().innerText();
  log(`5. Login manual promotor → pill "Promotor · Luxinmo"`, headerDev.includes("Promotor"));
  await p.screenshot({ path: `${OUT}/4-logged-dev.png` });

  // 6 — credenciales malas
  await p.locator("header button[aria-haspopup='menu']").first().click();
  await p.waitForTimeout(200);
  await p.locator("[role='menu'] button", { hasText: "Cerrar sesión" }).click();
  await p.waitForURL(/\/login/, { timeout: 5000 });
  await p.fill("input#login-email", "malo@ejemplo.com");
  await p.fill("input#login-password", "wrongpass");
  await p.locator("button", { hasText: "Iniciar sesión" }).click();
  await p.waitForTimeout(1000);
  const errShown = (await p.locator("body").innerText()).includes("incorrect");
  log(`6. Credenciales inválidas muestran error`, errShown);

  await browser.close();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
