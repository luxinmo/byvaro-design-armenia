/**
 * Ejecuta canPublishPromotion() / getMissingForPromotion() sobre TODAS las
 * promociones del repo y reporta qué badge debería ver el promotor en la
 * ficha. Compila los ts a ESM on-the-fly con esbuild.
 */
import { build } from "esbuild";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const dir = await mkdtemp(join(tmpdir(), "pub-check-"));
const entry = join(dir, "entry.mjs");
await writeFile(entry, `
  import { promotions } from "@/data/promotions";
  import { developerOnlyPromotions } from "@/data/developerPromotions";
  import { getMissingForPromotion, canPublishPromotion } from "@/lib/publicationRequirements";
  const all = [
    ...promotions.map((p) => ({ ...p, _src: "promotions" })),
    ...developerOnlyPromotions.map((p) => ({ ...p, _src: "developerPromotions" })),
  ];
  const out = all.map((p) => {
    const missing = getMissingForPromotion(p);
    const declared = Array.isArray(p.missingSteps) ? p.missingSteps : [];
    const publishable = canPublishPromotion(p);
    let badge;
    if (p.status === "sold-out") badge = "Agotada";
    else if (p.status === "incomplete") badge = "Sin publicar · incomplete";
    else if (publishable && p.status === "active") badge = "PUBLICADA";
    else badge = "Sin publicar";
    return {
      id: p.id, name: p.name, status: p.status, src: p._src, badge, publishable,
      validatorMissing: missing.map((m) => m.label),
      declaredMissing: declared,
      canShare: p.canShareWithAgencies !== false,
    };
  });
  console.log(JSON.stringify(out, null, 2));
`);
const out = join(dir, "out.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  outfile: out,
  format: "esm",
  platform: "node",
  target: "node18",
  alias: { "@": new URL("../src/", import.meta.url).pathname },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  logLevel: "silent",
});
await import(pathToFileURL(out).href);
await rm(dir, { recursive: true, force: true });
