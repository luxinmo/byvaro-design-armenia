import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

console.log("→ Reset · sin sesión");
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

console.log("→ Inyectar invitación demo a juan@primeproperties.com (dominio match Prime Properties)");
await page.evaluate(() => {
  const inv = {
    id: "inv-demo-domain",
    token: "demo-domain-match",
    emailAgencia: "juan@primeproperties.com",  // dominio coincide con Prime Properties
    nombreAgencia: "",                            // vacío · no es invitación a agencia conocida
    agencyId: undefined,                           // sin agencyId · solo email
    mensajePersonalizado: "",
    comisionOfrecida: 4.5,
    idiomaEmail: "es",
    estado: "pendiente",
    createdAt: Date.now(),
    expiraEn: Date.now() + 30*24*60*60*1000,
    promocionId: "dev-2",
    promocionNombre: "Villas del Pinar",
    duracionMeses: 12,
    formaPago: [{ tramo: 1, completado: 25, colaborador: 75 }, { tramo: 2, completado: 75, colaborador: 25 }],
    datosRequeridos: [],
    events: [{ id: "ev-d", type: "created", at: Date.now() }],
  };
  localStorage.setItem("byvaro-invitaciones", JSON.stringify([inv]));
});

console.log("→ Abrir /invite/demo-domain-match");
await page.goto("http://localhost:8080/invite/demo-domain-match", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const url = page.url();
console.log("→ URL:", url);

const heading = await page.locator("h1").first().textContent().catch(() => null);
console.log("→ Heading:", heading);

const adminMention = await page.locator('text=Pide a').count();
console.log("→ Mensaje 'Pide a admin' visible:", adminMention > 0);

const sentEmails = await page.evaluate(() => {
  const raw = localStorage.getItem("byvaro.sent-emails.v1");
  return raw ? JSON.parse(raw).map((e) => ({ to: e.to, kind: e.kind, refId: e.refId, subject: e.subject.slice(0, 50) })) : [];
});
console.log("→ Emails enviados (notificación admin):");
for (const e of sentEmails) console.log("  ", JSON.stringify(e));

await page.screenshot({ path: "/tmp/case2c-domain-match.png", fullPage: false });
console.log("→ Screenshot: /tmp/case2c-domain-match.png");

if (errors.length) {
  console.log("\n❌ ERRORES:"); for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}

await browser.close();
