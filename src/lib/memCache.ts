/**
 * memCache.ts · Cache en memoria compatible con la API de
 * `Storage` (localStorage / sessionStorage).
 *
 * Reemplaza al `localStorage` de la app · DB es source-of-truth y
 * este cache es solo para que los hooks `useState(() => readCache())`
 * sigan teniendo render síncrono después de la primera hidratación.
 *
 * REGLAS
 * ──────
 *  · NO persiste entre reloads (ese es justamente el objetivo · DB
 *    es la única fuente que sobrevive).
 *  · Cross-tab → no se sincroniza automáticamente · cada tab tiene su
 *    propio Map. Si necesitas notificar otra tab, escribe en DB y haz
 *    `hydrate*FromSupabase()` desde la otra.
 *  · Emite eventos de `storage` (compat con código que escucha el
 *    evento original) cuando cambia un valor.
 *
 * EXCEPCIONES (siguen usando localStorage REAL del navegador)
 * ──────────────────────────────────────────────────────────
 *  · `supabaseClient.ts` · Supabase guarda los tokens de auth ahí ·
 *    necesario para que el user no tenga que reloguearse en reload.
 *  · `accountType.ts` y `currentUser.ts` usan sessionStorage para
 *    persistir el rol activo per-tab · sigue siendo necesario.
 */

const cache = new Map<string, string>();

/** API idéntica a `Storage` de Web · drop-in replacement. */
export const memCache = {
  get length(): number {
    return cache.size;
  },

  key(index: number): string | null {
    return Array.from(cache.keys())[index] ?? null;
  },

  getItem(key: string): string | null {
    return cache.has(key) ? cache.get(key)! : null;
  },

  setItem(key: string, value: string): void {
    cache.set(key, value);
    /* Compat · disparamos `storage` event para hooks que escuchan
     *  cambios cross-tab via `window.addEventListener("storage", ...)`.
     *  Esos hooks ahora reciben notificación per-tab. */
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
    }
  },

  removeItem(key: string): void {
    cache.delete(key);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
    }
  },

  clear(): void {
    cache.clear();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    }
  },
};

/** Vacía completo el cache · llamar al sign-out. */
export function clearMemCache(): void {
  memCache.clear();
}
