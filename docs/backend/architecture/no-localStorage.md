# Arquitectura · No localStorage

> **Regla de oro · localStorage NO es source-of-truth de NADA.** Toda
> persistencia vive en Supabase. El frontend usa un cache en memoria
> (`memCache`) que se hidrata al login y se vacía al sign-out · cero
> residuos entre sesiones.

## 1 · Por qué

Byvaro arrancó como prototipo single-tenant con `localStorage` como
source-of-truth. Eso causó:

- **Datos divergentes cross-device** · usuario veía su perfil distinto
  en móvil vs desktop.
- **Datos divergentes cross-rol** · una agencia veía datos del
  promotor cacheados sin scope.
- **No había backups** · borrar caché del navegador = data loss.
- **Multi-tenancy imposible** · localStorage no tiene RLS.

El refactor 2026-05-02 eliminó `localStorage` como source-of-truth
completamente. Supabase es la única persistencia real.

## 2 · El módulo `memCache`

`src/lib/memCache.ts` expone una API **idéntica a `Storage`** del
navegador:

```ts
import { memCache } from "@/lib/memCache";

memCache.setItem("byvaro.foo.v1", JSON.stringify({...}));
const raw = memCache.getItem("byvaro.foo.v1");
memCache.removeItem("byvaro.foo.v1");
memCache.clear();
```

Internamente · una `Map<string, string>` de módulo (singleton). Nada
se persiste · al recargar la página, la memoria está vacía.

Cuando se llama a `setItem`/`removeItem`, dispara `StorageEvent` para
que los hooks que escuchan `window.addEventListener("storage", ...)`
reciban notificación per-tab (cross-tab no aplica al ser memoria).

### Excepciones · localStorage real del navegador

3 archivos siguen tocando `localStorage` REAL:

| Archivo | Motivo |
|---|---|
| `src/lib/supabaseClient.ts` | Supabase guarda tokens de auth ahí · necesario para que el user no tenga que reloguearse en reload. **NO TOCAR**. |
| `src/lib/accountType.ts` | `sessionStorage` (NO localStorage) para rol activo per-tab · una pestaña promotor + otra agencia sin colisionar. |
| `src/lib/currentUser.ts` | Idem · `sessionStorage`. |

## 3 · El patrón canónico de un store

Cada helper en `src/lib/*.ts` que mantiene estado sigue este patrón:

```ts
import { memCache } from "@/lib/memCache";

const KEY = "byvaro.foo.v1";
const EVENT = "byvaro:foo-changed";

/* ── Read · sync · safe-server ──────────────────────────────── */
function read(): Foo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/* ── Write · optimistic + write-through DB ──────────────────── */
function write(list: Foo[]) {
  memCache.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
  void syncFooToSupabase(list);    // async, best-effort
}

async function syncFooToSupabase(list: Foo[]) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("foo").upsert(rows, { onConflict: "id" });
    if (error) console.warn("[foo] sync:", error.message);
  } catch (e) {
    console.warn("[foo] sync skipped:", e);
  }
}

/* ── Hydrate · pull DB → memCache ───────────────────────────── */
export async function hydrateFooFromSupabase(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from("foo").select("*");
    if (error || !data) return;
    const list = data.map(rowToFoo);
    memCache.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch (e) {
    console.warn("[foo] hydrate skipped:", e);
  }
}

/* ── Hook reactivo · drop-in para componentes ──────────────── */
export function useFoo(): Foo[] {
  const [list, setList] = useState<Foo[]>(() => read());
  useEffect(() => {
    const onChange = () => setList(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return list;
}
```

## 4 · Hidratación bloqueante al login

`src/components/SupabaseHydrator.tsx` envuelve toda la app y bloquea
el render con un splash hasta que la primera tanda de hidratación
termine:

```tsx
<SupabaseHydrator>
  <Routes>...</Routes>
</SupabaseHydrator>
```

Internamente:

```ts
async function hydrateAll(): Promise<void> {
  await Promise.all([
    hydrateFromSupabase(),                    // orgs, profiles, offices, private_data
    hydrateSeedsFromSupabase(),               // promotions, units, leads, sales, registros
    hydrateInvitationsFromSupabase(),
    hydrateSentEmailsFromSupabase(),
    hydratePromoCollabStatusFromSupabase(),
    hydrateAgencyLicensesFromSupabase(),
    hydrateCompanyEventsFromSupabase(),
    hydrateFavoriteAgenciesFromSupabase(),
    hydrateAgencyOnboardingFromSupabase(),
    hydrateAgencyProfilesFromSupabase(),
    hydrateTwoFactorFromSupabase(),
    hydrateDeveloperPacksFromSupabase(),
  ]);
}
```

Tiempo típico · ~500ms-1s. Una sola espera al login. Después, todo
va instantáneo desde memoria.

Re-hidrata on:
- `SIGNED_IN` · primer login
- `TOKEN_REFRESHED` · refresh de JWT (cada hora)
- `SIGNED_OUT` · vacía memoria con `clearMemCache()` + `clearSupabaseCache()`

## 5 · Mutación in-place de seeds (Wave 2)

Caso especial · los arrays seed `developerOnlyPromotions`,
`promotions`, `unitsByPromotion`, `agencies`, `promotores`, `leads`,
`sales`, `registros`. Estos **NO se reasignan** · `seedHydrator.ts`
los **muta in-place**:

```ts
// Patch existing entries · preserva campos que aún no migraron
for (const p of developerOnlyPromotions) {
  const r = dbById.get(p.id);
  if (!r) continue;
  mergePromotionFromDb(p, r);  // pisa solo identitarios
}
// Append new entries from DB sin match en seed
for (const r of dbById.values()) {
  developerOnlyPromotions.push(rowToDevPromotion(r));
}
```

**Por qué**: 58 archivos importan estos arrays directamente. Un
refactor a hook async hubiera tocado todos. La mutación in-place
mantiene compat sin romper componentes · el evento
`byvaro:seed-hydrated` notifica a los suscriptores para forzar
re-render.

Componentes que necesiten reaccionar · `subscribeToSeedHydrated()`:

```tsx
const [, setTick] = useState(0);
useEffect(() => subscribeToSeedHydrated(() => setTick(t => t + 1)), []);
```

## 6 · Checklist al añadir un store nuevo

- [ ] ¿Tabla DB existe con RLS por `organization_id`?
- [ ] ¿Bridge view en `api.*` con `security_invoker=on`?
- [ ] ¿Helper en `src/lib/<feature>Storage.ts` con read/write/hydrate?
- [ ] ¿Usa `memCache` (NO localStorage)?
- [ ] ¿`saveX()` hace write-through asíncrono a Supabase?
- [ ] ¿`hydrateXFromSupabase()` está añadido a
  `SupabaseHydrator.hydrateAll()`?
- [ ] ¿`grep -rE "localStorage\.(get|set|remove)" src/lib/<file>.ts`
  devuelve 0?
- [ ] ¿`npx tsc --noEmit && npx vite build` pasa?
- [ ] ¿Test manual cross-device · login en otro browser muestra los
  mismos datos?

## 7 · Anti-patterns prohibidos

- ❌ `localStorage.setItem(...)` directo en cualquier archivo (excepto
  los 3 listados arriba)
- ❌ Componente importa `supabaseClient` y hace `from(table)` directo
  · siempre por un helper
- ❌ Hook que solo lee de DB sin cache · cada render dispara fetch
- ❌ Cache sin write-through · acumula divergencia con DB
- ❌ Hidratador que reasigna el array seed (`promotions = newArray`)
  · debe mutar in-place (`promotions.length = 0; promotions.push(...)`)
- ❌ Splash que bloquea más de 2s · si tarda más, optimizar queries o
  paginar

## 8 · Debugging desde devtools

```js
// Inspeccionar todo el cache
[...Array(memCache.length)].map((_, i) => memCache.key(i))

// Forzar re-hidratación manualmente (para tests)
const { hydrateInvitationsFromSupabase } = await import("/src/lib/invitaciones.ts");
await hydrateInvitationsFromSupabase();

// Vaciar todo (test sign-out)
const { clearMemCache } = await import("/src/lib/memCache.ts");
clearMemCache();
```

NOTA · estos imports solo funcionan en dev mode (Vite hot reload). En
producción los chunks están minificados.
