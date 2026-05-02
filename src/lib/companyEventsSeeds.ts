/**
 * Seeds iniciales del historial cross-empresa. En producción estos
 * eventos los escribe el backend cuando ocurren las acciones reales
 * (crear invitación, aprobar registro, etc.); aquí los publicamos en
 * localStorage una sola vez para que la UI de `/colaboradores/:id`
 * muestre actividad desde el principio.
 *
 * Se ejecuta desde `src/main.tsx` antes de montar la app. Es
 * idempotente: si la clave ya tiene eventos, no reescribe nada.
 */

import { recordCompanyEvent } from "./companyEvents";
import { memCache } from "./memCache";

const SEED_DONE_KEY = "byvaro.companyEvents.seeded.v1";

type Seed = Parameters<typeof recordCompanyEvent>;

const seeds: Seed[] = [];

export function seedCompanyEventsIfEmpty() {
  if (typeof window === "undefined") return;
  if (memCache.getItem(SEED_DONE_KEY)) return;
  try {
    /* Los insertamos en orden inverso para que, al quedar ordenados
     * por fecha descendente, el más reciente (contract_sent) aparezca
     * primero en el timeline. */
    for (const [id, type, title, opts] of [...seeds].reverse()) {
      recordCompanyEvent(id, type, title, opts ?? {});
    }
    memCache.setItem(SEED_DONE_KEY, "1");
  } catch {
    /* storage bloqueado: seguimos sin fallar */
  }
}
