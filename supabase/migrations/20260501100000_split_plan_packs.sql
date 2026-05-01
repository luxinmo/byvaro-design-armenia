-- ═══════════════════════════════════════════════════════════════════
-- Migration · 20260501100000 · Split workspace_plans en 2 packs
-- ═══════════════════════════════════════════════════════════════════
--
-- QUÉ
-- ----
-- El modelo viejo tenía UN solo `tier` por workspace · no permitía que
-- un mismo workspace tuviera capabilities de promotor Y de agencia a
-- la vez. Producto pidió separarlos:
--
--   · Pack Agencia (Inmobiliaria) · `none` / `free` (0€) / `marketplace` (99€)
--   · Pack Promotor/Comercializador · `none` / `trial` (6m gratis) /
--     `promoter_249` (249€) / `promoter_329` (329€)
--
-- Cada workspace puede tener AMBOS packs activos. El `signup_kind`
-- determina qué pack arranca con beneficios:
--
--   · signup_kind=agency · empieza con agency_pack=free + 10 solicitudes
--     (esas 10 son SOLO para nuevas altas de agencia · si activa
--     promoter_pack después, NO hereda trial 6m).
--   · signup_kind=promoter · empieza con promoter_pack=trial 6m gratis
--     (si activa agency_pack después, NO hereda las 10 solicitudes).
--
-- BACKWARDS COMPAT
-- ----------------
-- La columna `tier` legacy se mantiene · los nuevos campos derivan a
-- partir de ella en el migrate inline para los rows existentes.
-- Frontend leerá los packs nuevos · el `tier` queda para queries
-- legacy hasta que `useUsageGuard` se refactorice.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Añadir columnas nuevas ───────────────────────────────────────
alter table public.workspace_plans
  add column if not exists signup_kind text
    check (signup_kind in ('agency', 'promoter')),
  add column if not exists agency_pack text
    check (agency_pack in ('none', 'free', 'marketplace')),
  add column if not exists promoter_pack text
    check (promoter_pack in ('none', 'trial', 'promoter_249', 'promoter_329'));

-- ─── 2. Migrar rows existentes desde `tier` legacy ───────────────────
-- Reglas:
--   tier='trial'              → promoter_pack=trial          + signup=promoter
--   tier='promoter_249'       → promoter_pack=promoter_249   + signup=promoter
--   tier='promoter_329'       → promoter_pack=promoter_329   + signup=promoter
--   tier='enterprise'         → promoter_pack=promoter_329   + signup=promoter
--   tier='agency_free'        → agency_pack=free             + signup=agency
--   tier='agency_marketplace' → agency_pack=marketplace      + signup=agency
update public.workspace_plans
set
  signup_kind = coalesce(signup_kind, case
    when tier in ('agency_free', 'agency_marketplace') then 'agency'
    else 'promoter'
  end),
  agency_pack = coalesce(agency_pack, case
    when tier = 'agency_free' then 'free'
    when tier = 'agency_marketplace' then 'marketplace'
    else 'none'
  end),
  promoter_pack = coalesce(promoter_pack, case
    when tier = 'trial' then 'trial'
    when tier = 'promoter_249' then 'promoter_249'
    when tier = 'promoter_329' then 'promoter_329'
    when tier = 'enterprise' then 'promoter_329'
    else 'none'
  end);

-- ─── 3. Defaults para nuevos rows ────────────────────────────────────
alter table public.workspace_plans
  alter column signup_kind set default 'promoter',
  alter column agency_pack set default 'none',
  alter column promoter_pack set default 'trial';

-- ─── 4. Bridge view en api schema ────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'api') then
    execute 'drop view if exists api.workspace_plans';
    execute 'create view api.workspace_plans
      with (security_invoker = on) as
      select organization_id, tier, signup_kind, agency_pack, promoter_pack,
             trial_started_at, trial_ends_at, activated_at, cancelled_at,
             metadata, updated_at
      from public.workspace_plans';
  end if;
end $$;
