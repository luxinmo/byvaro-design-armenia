/** Compara p.agencies (mock hardcoded) vs la realidad derivada de agencies.promotionsCollaborating. */
import { build } from "esbuild";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const dir = await mkdtemp(join(tmpdir(), "agc-"));
const entry = join(dir, "entry.mjs");
await writeFile(entry, `
  import { promotions } from "@/data/promotions";
  import { developerOnlyPromotions } from "@/data/developerPromotions";
  import { agencies, countAgenciesForPromotion } from "@/data/agencies";
  const all = [...promotions, ...developerOnlyPromotions];
  const out = all.map((p) => ({
    id: p.id, name: p.name,
    mock: p.agencies ?? 0,
    real: countAgenciesForPromotion(p.id),
    diff: (p.agencies ?? 0) !== countAgenciesForPromotion(p.id),
  }));
  console.log(JSON.stringify(out, null, 2));
`);
const out = join(dir, "out.mjs");
await build({
  entryPoints: [entry], bundle: true, outfile: out, format: "esm",
  platform: "node", target: "node18",
  alias: { "@": new URL("../src/", import.meta.url).pathname },
  loader: { ".ts": "ts", ".tsx": "tsx" }, logLevel: "silent",
});
await import(pathToFileURL(out).href);
await rm(dir, { recursive: true, force: true });
