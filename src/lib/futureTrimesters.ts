/**
 * futureTrimesters.ts · helper canónico para generar opciones de
 * trimestre de entrega · próximos N años descontando los que ya
 * pasaron del año actual.
 *
 * Ejemplo · si HOY es 5 mayo 2026 (mes=4, Q2):
 *   defaultYears = 4 → devuelve:
 *     T2 2026, T3 2026, T4 2026,
 *     T1 2027, T2 2027, T3 2027, T4 2027,
 *     T1 2028, T2 2028, T3 2028, T4 2028,
 *     T1 2029, T2 2029, T3 2029, T4 2029,
 *     T1 2030, T2 2030
 *
 * Garantiza:
 *   · Cero trimestres pasados.
 *   · Año actual incluido desde el trimestre vigente.
 *   · Resto de años completos hasta `now + years`.
 */

export function currentTrimesterIndex(d: Date = new Date()): 1 | 2 | 3 | 4 {
  const m = d.getMonth(); // 0..11
  if (m <= 2) return 1;
  if (m <= 5) return 2;
  if (m <= 8) return 3;
  return 4;
}

export function futureTrimesterOptions(years = 4, ref: Date = new Date()): string[] {
  const startYear = ref.getFullYear();
  const startQ = currentTrimesterIndex(ref);
  const out: string[] = [];
  for (let y = startYear; y <= startYear + years; y++) {
    const firstQ = y === startYear ? startQ : 1;
    for (let q = firstQ; q <= 4; q++) {
      out.push(`T${q} ${y}`);
    }
    if (y - startYear >= years) break;
  }
  return out;
}
