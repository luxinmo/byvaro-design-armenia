/**
 * matchScore.ts · Cálculo del `matchPercentage` 0-100 entre cliente
 * entrante y otro cliente existente (registro o contacto del CRM).
 *
 * Reglas (ver `docs/registration-system.md §2.4 Nivel C`):
 *
 *   · Email exacto normalizado          · 40 puntos
 *   · Teléfono exacto normalizado       · 35 puntos
 *   · Nombre exacto normalizado         · 10 puntos
 *   · Nombre con typo Levenshtein ≤2    · 5 puntos
 *   · Misma nacionalidad ISO            · 3 puntos
 *   · Mismo apellido                    · 2 puntos
 *
 * Total cap a 100. La suma se interpreta así (`getMatchLevel`):
 *
 *   · 0-39   · sin coincidencias relevantes (banner verde)
 *   · 40-69  · coincidencia parcial         (banner ámbar)
 *   · 70-89  · posible duplicado            (banner rojo)
 *   · 90-100 · casi exacto                  (CTA "es el mismo cliente")
 *
 * Phase 2 frontend mock · cuando exista IA backend, sustituir por
 * `POST /api/match/score` con embedding/ML (ver TODO al final).
 */

type ClienteShape = {
  nombre?: string;
  email?: string;
  telefono?: string;
  nacionalidad?: string;
};

/* ══════ Helpers de normalización ════════════════════════════════ */

function normEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}
function normName(s?: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/\s+/g, " ");
}

/** Distancia de Levenshtein simple · O(n·m) suficiente para nombres. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Extrae apellidos · last 2 tokens del nombre normalizado. */
function getLastNames(name: string): string[] {
  const tokens = normName(name).split(" ").filter(Boolean);
  if (tokens.length <= 1) return [];
  return tokens.slice(-2); // últimos 2 (compuestos español)
}

/* ══════ API pública ═════════════════════════════════════════════ */

export type MatchScore = {
  /** Score 0-100. */
  score: number;
  /** Desglose · qué señales contribuyeron · útil para UI tooltip. */
  breakdown: Array<{ signal: string; weight: number; matched: boolean }>;
};

/**
 * Calcula score entre 2 clientes. Devuelve 0 si ningún campo identificador
 * (email/phone) coincide · evita falsos positivos por solo nombre.
 */
export function computeMatchScore(
  incoming: ClienteShape,
  existing: ClienteShape,
): MatchScore {
  const breakdown: MatchScore["breakdown"] = [];
  let score = 0;

  /* Email · 40 puntos */
  const emailA = normEmail(incoming.email);
  const emailB = normEmail(existing.email);
  const emailMatch = !!emailA && emailA === emailB;
  breakdown.push({ signal: "email", weight: 40, matched: emailMatch });
  if (emailMatch) score += 40;

  /* Teléfono · 35 puntos · matchea también si los últimos 9 dígitos
     coinciden (cubre prefijos +34 vs sin +34). */
  const phoneA = normPhone(incoming.telefono);
  const phoneB = normPhone(existing.telefono);
  const phoneMatch = !!phoneA && phoneA.length >= 7
    && (phoneA === phoneB || phoneA.slice(-9) === phoneB.slice(-9));
  breakdown.push({ signal: "telefono", weight: 35, matched: phoneMatch });
  if (phoneMatch) score += 35;

  /* Nombre exacto · 10 puntos */
  const nameA = normName(incoming.nombre);
  const nameB = normName(existing.nombre);
  const nameExact = !!nameA && nameA === nameB;
  breakdown.push({ signal: "nombre_exacto", weight: 10, matched: nameExact });
  if (nameExact) score += 10;

  /* Nombre con typo · 5 puntos · solo si NO matchea exacto. */
  let typoMatch = false;
  if (!nameExact && nameA && nameB) {
    const dist = levenshtein(nameA, nameB);
    typoMatch = dist > 0 && dist <= 2;
  }
  breakdown.push({ signal: "nombre_typo", weight: 5, matched: typoMatch });
  if (typoMatch) score += 5;

  /* Nacionalidad · 3 puntos */
  const natA = (incoming.nacionalidad ?? "").trim().toLowerCase();
  const natB = (existing.nacionalidad ?? "").trim().toLowerCase();
  const natMatch = !!natA && natA === natB;
  breakdown.push({ signal: "nacionalidad", weight: 3, matched: natMatch });
  if (natMatch) score += 3;

  /* Apellido · 2 puntos · si comparten al menos uno. */
  const lastA = getLastNames(incoming.nombre ?? "");
  const lastB = getLastNames(existing.nombre ?? "");
  const lastMatch = lastA.some((a) => lastB.includes(a));
  breakdown.push({ signal: "apellido", weight: 2, matched: lastMatch });
  if (lastMatch) score += 2;

  /* Anti-falso-positivo: si NO hay match ni de email ni de teléfono,
     forzamos score a 0 · evita que "Pedro García español" haga match
     genérico con cualquier otro Pedro. */
  if (!emailMatch && !phoneMatch) {
    return { score: 0, breakdown };
  }

  return { score: Math.min(100, score), breakdown };
}

/**
 * Para un cliente entrante, encuentra el MEJOR match en una lista de
 * candidatos (otros registros + contactos). Devuelve { score, target }
 * o null si nada supera 0.
 */
export function findBestMatch<T extends { cliente?: ClienteShape; nombre?: string; email?: string; phone?: string }>(
  incoming: ClienteShape,
  candidates: ReadonlyArray<T>,
): { target: T; score: number } | null {
  let best: { target: T; score: number } | null = null;
  for (const c of candidates) {
    /* Adapta tanto Registro (`.cliente`) como Contact (campos flat). */
    const shape: ClienteShape = c.cliente ?? {
      nombre: c.nombre,
      email: c.email,
      telefono: c.phone,
    };
    const { score } = computeMatchScore(incoming, shape);
    if (score > 0 && (!best || score > best.score)) {
      best = { target: c, score };
    }
  }
  return best;
}

/* TODO(backend): sustituir por POST /api/match/score con IA real
 * (embeddings + similitud coseno + reglas de negocio adicionales).
 * El frontend mantiene `computeMatchScore` como fallback offline. */
