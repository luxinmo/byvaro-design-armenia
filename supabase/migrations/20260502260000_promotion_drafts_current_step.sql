/* ════════════════════════════════════════════════════════════════════
 * 20260502 · promotion_drafts · persistir el paso actual del wizard
 *
 * Cuando el user guarda un borrador y sale, al volver a entrar lo
 * llevamos al MISMO paso del wizard donde estaba (no al inicial
 * "role"). Persistimos el id del step (string) en `current_step`.
 *
 * Compatibilidad · NULL si el draft se creó antes de esta migración
 * (caen al default "role" igual que ahora).
 * ════════════════════════════════════════════════════════════════════ */

alter table public.promotion_drafts
  add column if not exists current_step text;
