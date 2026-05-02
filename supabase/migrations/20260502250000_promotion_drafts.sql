/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Borradores de promoción · cross-device
 *
 * Hasta ahora los borradores del wizard "Crear promoción" vivían SOLO
 * en `memCache` (in-memory, NO persistente entre reloads). Resultado:
 * el user creaba un borrador, recargaba la página, y desaparecía.
 *
 * Esta tabla persiste el `WizardState` completo del wizard como JSONB
 * scoped al `user_id` propietario · cualquier dispositivo / navegador
 * del mismo user verá sus borradores al hidratar.
 *
 * RLS · solo el dueño puede leer/escribir/borrar sus drafts. Nunca
 * visible cross-user, ni siquiera dentro del mismo workspace (es
 * trabajo en curso del individuo, no estado compartido).
 *
 * Cuando el user activa el borrador como promoción real (botón
 * "Activar" del wizard), el cliente:
 *   1. Llama `createPromotionFromWizard` → INSERT en `promotions`.
 *   2. Llama `deleteDraft(id)` → DELETE en `promotion_drafts`.
 * El draft no sobrevive a la activación · la tabla solo guarda WIP.
 * ════════════════════════════════════════════════════════════════════ */

create table if not exists public.promotion_drafts (
  id text primary key,
  /* Owner del draft · siempre coincide con auth.uid() en INSERT/UPDATE
   * via RLS. Si el user es eliminado, los drafts se borran con él
   * (no tienen utilidad sin owner). */
  user_id uuid not null references auth.users(id) on delete cascade,
  /* Workspace activo cuando se creó · facilita filtrar drafts del
   * workspace actual si el user pertenece a varios. NULL si el
   * draft se inició antes de tener workspace resuelto. */
  organization_id text references public.organizations(id) on delete set null,
  /* Display · mostrado en el listado de incompletas. Cae a "Promoción
   * sin nombre" si el user aún no ha tecleado el nombre. */
  name text not null default 'Promoción sin nombre',
  /* % de completitud heurístico · 0-100 · derivado del wizard state
   * por el cliente. Sirve para barra de progreso en la card. */
  progress integer not null default 0 check (progress between 0 and 100),
  /* WizardState completo · es el tipo `WizardState` de
   * `src/components/crear-promocion/types.ts` serializado a JSON.
   * Acepta crecer · cualquier campo nuevo del wizard se guarda sin
   * tocar el schema. */
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promotion_drafts_user
  on public.promotion_drafts(user_id, updated_at desc);

create index if not exists idx_promotion_drafts_org
  on public.promotion_drafts(organization_id) where organization_id is not null;

/* ─── RLS · solo el dueño ────────────────────────────────────────── */

alter table public.promotion_drafts enable row level security;

drop policy if exists "drafts_owner_select" on public.promotion_drafts;
create policy "drafts_owner_select"
  on public.promotion_drafts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "drafts_owner_insert" on public.promotion_drafts;
create policy "drafts_owner_insert"
  on public.promotion_drafts
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "drafts_owner_update" on public.promotion_drafts;
create policy "drafts_owner_update"
  on public.promotion_drafts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "drafts_owner_delete" on public.promotion_drafts;
create policy "drafts_owner_delete"
  on public.promotion_drafts
  for delete
  to authenticated
  using (user_id = auth.uid());

/* ─── Touch updated_at en cada UPDATE ──────────────────────────────── */

do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'touch_updated_at' and pronamespace = 'public'::regnamespace
  ) then
    /* Si la función no existe (entorno fresco sin migraciones previas
     * que la creen), la definimos aquí. El cuerpo es idempotente con
     * cualquier definición existente: solo setea updated_at = now(). */
    create function public.touch_updated_at() returns trigger
    language plpgsql as $f$
    begin NEW.updated_at = now(); return NEW; end;
    $f$;
  end if;
end $$;

drop trigger if exists trg_touch_promotion_drafts on public.promotion_drafts;
create trigger trg_touch_promotion_drafts
  before update on public.promotion_drafts
  for each row execute function public.touch_updated_at();
