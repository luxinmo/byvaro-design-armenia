/* ════════════════════════════════════════════════════════════════════
 * 20260502 · Signup · crear workspace_plans con trial 6 meses
 *
 * Antes el trigger `handle_new_user_signup` solo creaba
 * organizations + organization_members + user_profiles, dejando
 * `workspace_plans` vacío. El frontend caía al default
 * `DEFAULT_PLAN_STATE_PROMOTER` y todo "funcionaba", pero:
 *
 *   · No teníamos `trial_ends_at` real en DB · no podíamos mostrar
 *     "tu prueba acaba el dd/mm/yyyy".
 *   · Si un día el frontend cambiaba de default, todos los users
 *     existentes "saltaban" de plan sin migración.
 *   · Stripe webhook no podía hacer upsert por organization_id sin
 *     fila previa.
 *
 * Esta migración:
 *
 *   1. Extiende el trigger para insertar en `workspace_plans` con
 *      `signup_kind` derivado del `org_kind` del metadata
 *      (developer→promoter, agency→agency), packs por defecto y
 *      `trial_ends_at = now() + 6 months` para promotores.
 *
 *   2. Backfill · inserta filas para cualquier organization existente
 *      que aún no tenga workspace_plans (idempotente · ON CONFLICT).
 * ════════════════════════════════════════════════════════════════════ */

create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_kind text;
  v_name text;
  v_org_id text;
  v_meta jsonb;
  v_signup_kind text;
  v_promoter_pack text;
  v_agency_pack text;
  v_trial_ends timestamptz;
begin
  v_kind := coalesce(NEW.raw_user_meta_data->>'org_kind', '');
  v_name := coalesce(NEW.raw_user_meta_data->>'org_name', '');
  if v_kind = '' or v_name = '' then
    return NEW;
  end if;

  if v_kind not in ('developer', 'agency') then
    raise warning 'handle_new_user_signup · invalid kind: %', v_kind;
    return NEW;
  end if;

  v_org_id := v_kind || '-' || replace(NEW.id::text, '-', '');
  v_org_id := substring(v_org_id from 1 for 36);

  insert into public.organizations (
    id, kind, legal_name, display_name, country, status
  ) values (
    v_org_id, v_kind::org_kind, v_name, v_name, 'ES', 'active'
  )
  on conflict (id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, role, status
  ) values (
    v_org_id, NEW.id, 'admin', 'active'
  )
  on conflict do nothing;

  /* Build user_profile metadata. */
  v_meta := '{}'::jsonb;
  if NEW.raw_user_meta_data ? 'phone'
     and NEW.raw_user_meta_data->>'phone' <> '' then
    v_meta := v_meta || jsonb_build_object('phone', NEW.raw_user_meta_data->>'phone');
  end if;
  if NEW.raw_user_meta_data ? 'sub_role'
     and NEW.raw_user_meta_data->>'sub_role' <> '' then
    v_meta := v_meta || jsonb_build_object('sub_role', NEW.raw_user_meta_data->>'sub_role');
  end if;
  if NEW.raw_user_meta_data ? 'terms_accepted' then
    v_meta := v_meta || jsonb_build_object('terms_accepted', NEW.raw_user_meta_data->'terms_accepted');
  end if;

  insert into public.user_profiles (
    user_id, full_name, metadata
  ) values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    v_meta
  )
  on conflict (user_id) do nothing;

  /* Workspace plan inicial · alineado con DEFAULT_PLAN_STATE_*
   *  del frontend (`src/lib/plan.ts`):
   *
   *  · developer → signup_kind=promoter, promoter_pack=trial,
   *    agency_pack=none · trial_ends_at = now() + 6 meses.
   *  · agency    → signup_kind=agency, agency_pack=free,
   *    promoter_pack=none · sin trial (gratis para siempre si
   *    les invitan). */
  if v_kind = 'developer' then
    v_signup_kind := 'promoter';
    v_promoter_pack := 'trial';
    v_agency_pack := 'none';
    v_trial_ends := now() + interval '6 months';
  else
    v_signup_kind := 'agency';
    v_promoter_pack := 'none';
    v_agency_pack := 'free';
    v_trial_ends := null;
  end if;

  insert into public.workspace_plans (
    organization_id, tier,
    signup_kind, agency_pack, promoter_pack,
    trial_started_at, trial_ends_at
  ) values (
    v_org_id,
    case
      when v_kind = 'developer' then 'trial'::plan_tier
      else 'agency_free'::plan_tier
    end,
    v_signup_kind, v_agency_pack, v_promoter_pack,
    case when v_kind = 'developer' then now() else null end,
    v_trial_ends
  )
  on conflict (organization_id) do nothing;

  return NEW;
exception when others then
  raise warning 'handle_new_user_signup error: %', sqlerrm;
  return NEW;
end;
$$;

/* Backfill · cualquier organization sin workspace_plans (legacy o
 *  creada antes de esta migración) recibe su fila por defecto.
 *  Idempotente · ON CONFLICT no machaca. */
insert into public.workspace_plans (
  organization_id, tier,
  signup_kind, agency_pack, promoter_pack,
  trial_started_at, trial_ends_at
)
select
  o.id,
  case when o.kind = 'developer' then 'trial'::plan_tier else 'agency_free'::plan_tier end,
  case when o.kind = 'developer' then 'promoter' else 'agency' end,
  case when o.kind = 'developer' then 'none' else 'free' end,
  case when o.kind = 'developer' then 'trial' else 'none' end,
  case when o.kind = 'developer' then now() else null end,
  case when o.kind = 'developer' then now() + interval '6 months' else null end
from public.organizations o
left join public.workspace_plans wp on wp.organization_id = o.id
where wp.organization_id is null
on conflict (organization_id) do nothing;
